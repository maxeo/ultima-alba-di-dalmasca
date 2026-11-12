// Prepara per il lettore web i capitoli gia' generati: audio compresso, testo sincronizzato, indice.
// Il lettore e' Leggio (https://github.com/maxeo/leggio), uno strumento a parte: qui si scrivono solo i dati,
// e "leggio sito" ci mette sopra la pagina leggendo docs/libro.json.
// Uso: node pubblica.js [--push]
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const QUI = __dirname, ROOT = path.join(QUI, '..');
const CAP = path.join(ROOT, 'Romanzo', 'capitoli');
const SRC = path.join(QUI, 'audiobooks'), TESTO = path.join(QUI, 'testo');
const sito = path.join(ROOT, 'docs');
const capArg = process.argv.find(x => x.startsWith('--capitolo='));
const destinazione = process.argv.find(x => x.startsWith('--destino='));
const solo = capArg ? Number(capArg.slice('--capitolo='.length)) : null;
if ((solo !== null && (!Number.isInteger(solo) || solo < 1 || solo > 999 || process.argv.includes('--push'))) || (destinazione && solo === null)) {
  throw new Error('Usa --capitolo=N [--destino=cartella] per preparare un solo capitolo in locale.');
}
const DOCS = destinazione ? path.resolve(destinazione.slice('--destino='.length)) : sito;
const AUDIO = path.join(DOCS, 'audio'), TESTI = path.join(DOCS, 'testi');
// Sul sito pubblico l'audio c'e' fino a questo capitolo (fine del prologo); dopo, solo il testo. Nel pannello
// dell'autore (?write=true) l'elenco viene da capitoli-autore.json: audio dove c'e', testo per il resto.
const ULTIMO_PUBBLICO = 7;
const ELENCO_AUTORE = destinazione ? path.join(DOCS, 'capitoli-autore.json') : path.join(QUI, 'capitoli-autore.json');
const BITRATE = '48k'; // Con circa 40 ore di audio il sito resta sotto il limite di 1 GB di GitHub Pages.
fs.mkdirSync(AUDIO, { recursive: true });
fs.mkdirSync(TESTI, { recursive: true });
const SOLOTESTO = path.join(DOCS, 'solotesto');
fs.mkdirSync(SOLOTESTO, { recursive: true });

// Il dizionario di pronuncia al contrario: nei sottotitoli i nomi tornano come nel romanzo.
const voci = fs.readFileSync(path.join(QUI, 'pronuncia.tsv'), 'utf8').split(/\r?\n/)
  .filter(r => r && !r.startsWith('#')).map(r => r.split('\t')).sort((a, b) => b[1].length - a[1].length);
const nomi = t => voci.reduce((s, [da, a]) => s.replace(new RegExp(String.raw`(?<!\p{L})${a}(?!\p{L})`, 'gu'), da), t);
const lettere = t => t.normalize('NFD').replace(/[^\p{L}]/gu, '').toLowerCase();

function leggiVtt(file) {
  const cue = [];
  const blocchi = fs.readFileSync(file, 'utf8').split(/\r?\n\r?\n/);
  const sec = s => { const [h, m, r] = s.split(':'); return +h * 3600 + +m * 60 + +r; };
  for (const b of blocchi) {
    const m = b.match(/(\d\d:\d\d:\d\d\.\d+) --> (\d\d:\d\d:\d\d\.\d+)\r?\n([\s\S]+)/);
    if (!m) continue;
    const testo = nomi(m[3].replace(/\[pause[^\]]*\]/g, ' ').replace(/\s+/g, ' ').replace(/(\s*\.\s*)+$/, '.').trim());
    cue.push({ t: sec(m[1]), fine: sec(m[2]), testo });
  }
  return cue;
}

// Durata dell'mp3 pubblicato, quello che il lettore suona: si contano i frame MPEG (1152 campioni in MPEG-1,
// 576 in MPEG-2 e 2.5, che a 24 kHz è il nostro caso). Il frame «Info» che LAME mette in testa è silenzio di
// servizio e non si conta.
function durataMp3(file) {
  const b = fs.readFileSync(file);
  const kbps = { 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
  const hz = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  let i = b.length > 10 && b.toString('latin1', 0, 3) === 'ID3' ? 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) : 0;
  let secondi = 0, primo = true;
  while (i + 4 <= b.length) {
    const v = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, br = b[i + 2] >> 4, sr = (b[i + 2] >> 2) & 3;
    if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0 || v === 1 || layer !== 1 || br === 0 || br === 15 || sr === 3) { i++; continue; }
    const campioni = v === 3 ? 1152 : 576, frequenza = hz[v][sr];
    const lunghezza = Math.floor(campioni / 8 * kbps[v === 3 ? 3 : 2][br] * 1000 / frequenza) + ((b[i + 2] >> 1) & 1);
    const servizio = primo && /Info|Xing/.test(b.toString('latin1', i + 4, Math.min(i + 40, b.length)));
    if (!servizio) secondi += campioni / frequenza;
    primo = false;
    i += lunghezza;
  }
  return secondi;
}

// Le righe del capitolo (senza vuote né stacchi) e lo stile di ciascun paragrafo.
function righeCapitolo(f) {
  // Le righe di --- separano le scene: il paragrafo che segue lo ricorda per mostrare lo stacco.
  const righe = [], dopoStacco = [];
  let stacco = false;
  for (const r of fs.readFileSync(path.join(CAP, f + '.md'), 'utf8').split(/\r?\n/).map(r => r.trim())) {
    if (!r) continue;
    if (/^-{3,}$/.test(r)) { stacco = true; continue; }
    righe.push(r); dopoStacco.push(stacco); stacco = false;
  }
  // Paragrafo tutto in corsivo: citazione (cit); se è breve e senza punto finale, è la firma della citazione (firma).
  // Lo è anche una riga che comincia con >, come i proclami: è il modo di scrivere una citazione in Markdown.
  const stile = (r, i) => {
    const o = dopoStacco[i] ? { st: 1 } : {};
    if (/^>\s/.test(r)) o.cit = 1;
    else if (/^\*[^*][\s\S]*\*$/.test(r)) { if (r.length < 90 && !/[.!?…»]\*$/.test(r)) o.firma = 1; else o.cit = 1; }
    return o;
  };
  return { righe, stile };
}

// Il capitolo senza audio: paragrafi di solo testo, come li vuole Leggio.
function paragrafiTesto(f) {
  const { righe, stile } = righeCapitolo(f);
  return righe.map((r, i) => /^#/.test(r)
    ? { h: 1, s: r.replace(/^#+\s*/, '') }
    : { s: r.replace(/^>\s+/, '').replace(/[*_]/g, ''), ...stile(r, i) });
}

// Abbina frasi lette e paragrafi. Se testo e audio non coincidono, usa le frasi come sono state lette.
function sincronizza(f, cue) {
  const { righe, stile } = righeCapitolo(f);
  const letti = fs.readFileSync(path.join(TESTO, f + '.txt'), 'utf8').split(/\n+/).map(r => r.trim())
    .filter(r => r && !r.startsWith('[pause'));
  const piano = () => ({ par: [{ c: cue.filter(c => c.testo).map(c => [+c.t.toFixed(2), c.testo]) }], esatto: false, ripiego: true });
  if (righe.length !== letti.length) return piano();
  const par = righe.map((r, i) => /^#/.test(r)
    ? { h: 1, s: nomi(letti[i]) }
    : { s: r.replace(/^>\s+/, '').replace(/[*_]/g, ''), ...stile(r, i) });

  let p = 0, pos = 0;
  const avanza = quante => { // Prende dal paragrafo corrente fino a contare quante lettere.
    const pezzi = [];
    while (quante > 0 && p < par.length) {
      const s = par[p].s;
      const ini = pos;
      while (pos < s.length && quante > 0) {
        const ch = String.fromCodePoint(s.codePointAt(pos));
        if (lettere(ch)) quante--;
        pos += ch.length;
      }
      while (pos < s.length && !lettere(String.fromCodePoint(s.codePointAt(pos))) && !/[\s]/.test(s[pos])) pos++;
      pezzi.push({ p, s: s.slice(ini, pos) });
      if (pos >= s.length) { p++; pos = 0; }
    }
    return pezzi;
  };
  // Tempi delle parole presi da Whisper (controlla.sh), se sono più recenti dell'audio.
  const fp = path.join(QUI, 'controlli', f + '.parole.json');
  const sentite = fs.existsSync(fp) && fs.statSync(fp).mtimeMs >= fs.statSync(path.join(SRC, f + '.mp3')).mtimeMs
    ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null;
  // Tempo d'inizio di ogni parola di un blocco letto. Con Whisper le parole del testo si abbinano a quelle
  // sentite (sottosequenza comune più lunga); le parole non abbinate, per esempio i numeri che Whisper scrive
  // in cifre, prendono il tempo in proporzione alle lettere fra le due parole abbinate più vicine.
  // Senza Whisper la durata del blocco si divide in parti uguali per lettera.
  const tempiParole = (c, tok) => {
    const cum = []; let n = 0;
    for (const w of tok) { cum.push(n); n += lettere(w).length; }
    const ws = sentite ? sentite.filter(([s, e]) => (s + e) / 2 >= c.t && (s + e) / 2 < c.fine) : [];
    if (!ws.length) return cum.map(k => c.t + (c.fine - c.t) * k / (n || 1));
    // Whisper attacca la pausa che precede una parola all'inizio della parola stessa:
    // l'inizio si ricava dalla fine, stimando la durata dal numero di lettere.
    const ini = ws.map(([s, e, w]) => Math.max(s, e - (0.065 * (lettere(w).length || 2) + 0.08)));
    const A = tok.map(lettere), B = ws.map(w => lettere(w[2]));
    const L = Array.from({ length: A.length + 1 }, () => new Int16Array(B.length + 1));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--)
      L[i][j] = A[i] && A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ancora = new Array(A.length).fill(null);
    for (let i = 0, j = 0; i < A.length && j < B.length;) {
      if (A[i] && A[i] === B[j]) { ancora[i] = ini[j]; i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
    }
    const fine = ws[ws.length - 1][1], out = [];
    for (let i = 0; i < A.length; i++) {
      if (ancora[i] != null) { out.push(ancora[i]); continue; }
      let p = i - 1; while (p >= 0 && ancora[p] == null) p--;
      let q = i + 1; while (q < A.length && ancora[q] == null) q++;
      const tp = p >= 0 ? ancora[p] : ini[0], cp = p >= 0 ? cum[p] : 0;
      const tq = q < A.length ? ancora[q] : fine, cq = q < A.length ? cum[q] : n;
      out.push(p < 0 && i === 0 ? ini[0] : tp + (tq - tp) * (cum[i] - cp) / ((cq - cp) || 1));
    }
    for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1]);
    return out.map(t => Math.min(c.fine, Math.max(c.t, t)));
  };
  for (const q of par) q.c = [];
  for (const c of cue) {
    const n = lettere(c.testo).length;
    if (!n) continue;
    const pezzi = avanza(n);
    if (lettere(pezzi.map(x => x.s).join('')) !== lettere(c.testo)) return piano();
    // Un blocco letto puo' coprire piu' frasi e paragrafi: ogni frase e ogni parola prende il suo tempo.
    const frasi = [];
    for (const x of pezzi) for (const frase of x.s.split(/(?<=[.!?…]+[»"”')]*)(?=\s)/u))
      frasi.push({ p: x.p, frase, w: frase.split(/\s+/).filter(Boolean) });
    const tempi = tempiParole(c, frasi.flatMap(x => x.w));
    let k = 0;
    for (const x of frasi) {
      const tp = x.w.map(() => +tempi[k++].toFixed(2));
      const t = tp.length ? tp[0] : +c.t.toFixed(2);
      par[x.p].c.push(sentite ? [t, x.frase, tp] : [t, x.frase]);
    }
  }
  return { par: par.map(q => (q.h ? { h: 1, c: q.c } : { c: q.c, ...(q.cit && { cit: 1 }), ...(q.firma && { firma: 1 }), ...(q.st && { st: 1 }) })), esatto: p >= par.length };
}

const parti = [];
const capitoli = [], pubblici = [];
const codaAutore = path.join(QUI, 'audio', 'autore', 'lavori.json');
const sospesi = new Map();
if (solo === null && fs.existsSync(codaAutore)) {
  for (const j of JSON.parse(fs.readFileSync(codaAutore, 'utf8'))) {
    // Un lavoro chiuso, anche superato, non tiene piu' fermo il capitolo: solo quelli ancora da finire.
    if (['modifica', 'scegli', 'rigenera', 'stacco'].includes(j.tipo)) sospesi.set(j.capitolo, !['pronto', 'superato'].includes(j.stato));
  }
}
// Capitolo in rigenerazione (mp3 tolto da audiobooks): resta ascoltabile la versione già pubblicata.
const prima = (() => { try { return Object.fromEntries(JSON.parse(fs.readFileSync(path.join(QUI, 'capitoli-autore.json'), 'utf8')).capitoli.map(c => [c.n, c])); } catch { return {}; } })();
let parte = '';
let nuovi = [];
for (const file of fs.readdirSync(CAP).filter(x => x.endsWith('.md')).sort()) {
  const f = file.slice(0, -3), id = f.slice(0, 3), n = +id;
  const righe = fs.readFileSync(path.join(CAP, file), 'utf8').split(/\r?\n/);
  const sez = righe.find(r => /^# /.test(r));
  if (sez) { parte = sez.slice(2).replace(/\.$/, ''); parti.push(parte); }
  const tit = righe.find(r => /^## /.test(r));
  const titolo = tit ? tit.replace(/^## (\d+\. )?/, '') : f.slice(4).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
  const voce = { n, titolo, parte };
  // Il testo da solo, per i capitoli senza audio o con l'audio non ancora pubblico.
  const soloTesto = () => {
    const par = paragrafiTesto(f);
    fs.writeFileSync(path.join(SOLOTESTO, id + '.json'), JSON.stringify(par));
    const parole = par.reduce((x, q) => x + q.s.split(/\s+/).filter(Boolean).length, 0);
    return { n, titolo, parte, parole, testo: `solotesto/${id}.json` };
  };
  const metti = v => {
    const conAudio = v.durata > 0;
    const t = conAudio && n <= ULTIMO_PUBBLICO ? null : soloTesto();
    capitoli.push(conAudio ? v : t);
    pubblici.push(t || v);
  };
  if ((solo !== null && n !== solo) || sospesi.get(n)) { metti(prima[n] || voce); continue; }

  const mp3 = path.join(SRC, f + '.mp3'), vtt = path.join(SRC, f + '.vtt');
  const out = path.join(AUDIO, id + '.mp3'), js = path.join(TESTI, id + '.json');
  if (fs.existsSync(mp3) && fs.existsSync(vtt) && fs.statSync(mp3).size > 0) {
    // Si riconverte anche quando il capitolo è stato rigenerato dopo l'ultima pubblicazione.
    if (!fs.existsSync(out) || fs.statSync(mp3).mtimeMs > fs.statSync(out).mtimeMs) {
      const tmp = id + '.tmp.mp3';
      execFileSync('docker', ['run', '--rm', '--entrypoint', 'ffmpeg',
        '-v', `${SRC}:/in:ro`, '-v', `${AUDIO}:/out`, 'e2a-locale:cu126',
        '-y', '-loglevel', 'error', '-i', `/in/${f}.mp3`, '-vn', '-map_metadata', '-1',
        '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', BITRATE, `/out/${tmp}`], { stdio: 'inherit' });
      // Su Windows il file può essere aperto per un momento (lettore locale, antivirus): si riprova, poi si copia.
      for (let k = 0; ; k++) {
        try { fs.renameSync(path.join(AUDIO, tmp), out); break; } catch (e) {
          if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e;
          if (k < 10) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500); continue; }
          fs.copyFileSync(path.join(AUDIO, tmp), out); fs.unlinkSync(path.join(AUDIO, tmp)); break;
        }
      }
      nuovi.push(n);
    }
    const cue = leggiVtt(vtt);
    const { par, esatto, ripiego } = sincronizza(f, cue);
    if (solo !== null && (!esatto || !cue.length)) throw new Error(`${id}: il testo letto non coincide con il capitolo.`);
    // Se il testo e' stato corretto dopo l'audio non combaciano piu': fino alla rigenerazione resta il file con i paragrafi.
    if (ripiego && fs.existsSync(js)) console.log(`${id} testo diverso dall'audio: da rigenerare, tengo il file esistente`);
    else fs.writeFileSync(js, JSON.stringify(par));
    voce.durata = Math.round(durataMp3(out));
    voce.byte = fs.statSync(out).size;
    if (solo !== null) voce.versioneAudio = fs.statSync(mp3).mtimeMs;
    console.log(`${id} ${voce.durata}s ${(voce.byte / 1048576).toFixed(1)} MiB testo ${esatto ? 'esatto' : 'come letto'}`);
  }
  else if (solo !== null) throw new Error(`${id}: MP3 o sottotitoli mancanti.`);
  else if (fs.existsSync(out)) { voce.durata = Math.round(durataMp3(out)); voce.byte = fs.statSync(out).size; }
  metti(voce);
}
const elenco = lista => ({ parti: parti.filter(p => lista.some(c => c.parte === p)), capitoli: lista });
fs.writeFileSync(ELENCO_AUTORE, JSON.stringify(elenco(capitoli)));
fs.writeFileSync(path.join(DOCS, 'capitoli.json'), JSON.stringify(elenco(pubblici)));
if (solo !== null) process.exit(0);

// Rifa' il lettore in docs/ con Leggio: installato con npm, clonato accanto al repo, oppure indicato da $LEGGIO.
const leggio = [process.env.LEGGIO, path.join(ROOT, 'node_modules', 'leggio'), path.join(ROOT, '..', 'leggio')]
  .filter(Boolean).map(d => path.join(d, 'strumenti', 'crea-sito.js')).find(f => fs.existsSync(f));
if (leggio) execFileSync(process.execPath, [leggio, DOCS], { stdio: 'inherit' });
else console.log("Leggio non trovato: il lettore in docs/ resta com'e' (npm install --save-dev github:maxeo/leggio)");

if (process.argv.includes('--push')) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'pipe' }).toString().trim();
  git('add', 'docs');
  if (git('diff', '--cached', '--name-only', '--', 'docs')) {
    const quali = nuovi.length ? nuovi.join(', ') : 'indice';
    git('commit', '-m', `Pubblicato l'audio del lettore: ${quali}`.slice(0, 60), '--', 'docs');
  }
  git('push', 'origin', 'main');
  console.log('pubblicato', new Date().toISOString(), nuovi.join(','));
}
