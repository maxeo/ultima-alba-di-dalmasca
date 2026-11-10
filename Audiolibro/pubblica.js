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
const BITRATE = '48k'; // Con circa 40 ore di audio il sito resta sotto il limite di 1 GB di GitHub Pages.
fs.mkdirSync(AUDIO, { recursive: true });
fs.mkdirSync(TESTI, { recursive: true });

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

// Abbina frasi lette e paragrafi. Se testo e audio non coincidono, usa le frasi come sono state lette.
function sincronizza(f, cue) {
  // Le righe di --- separano le scene: il paragrafo che segue lo ricorda per mostrare lo stacco.
  const righe = [], dopoStacco = [];
  let stacco = false;
  for (const r of fs.readFileSync(path.join(CAP, f + '.md'), 'utf8').split(/\r?\n/).map(r => r.trim())) {
    if (!r) continue;
    if (/^-{3,}$/.test(r)) { stacco = true; continue; }
    righe.push(r); dopoStacco.push(stacco); stacco = false;
  }
  // Paragrafo tutto in corsivo: citazione (cit); se è breve e senza punto finale, è la firma della citazione (firma).
  const stile = (r, i) => {
    const o = dopoStacco[i] ? { st: 1 } : {};
    if (/^\*[^*][\s\S]*\*$/.test(r)) { if (r.length < 90 && !/[.!?…»]\*$/.test(r)) o.firma = 1; else o.cit = 1; }
    return o;
  };
  const letti = fs.readFileSync(path.join(TESTO, f + '.txt'), 'utf8').split(/\n+/).map(r => r.trim())
    .filter(r => r && !r.startsWith('[pause'));
  const piano = () => ({ par: [{ c: cue.filter(c => c.testo).map(c => [+c.t.toFixed(2), c.testo]) }], esatto: false, ripiego: true });
  if (righe.length !== letti.length) return piano();
  const par = righe.map((r, i) => /^#/.test(r)
    ? { h: 1, s: nomi(letti[i]) }
    : { s: r.replace(/[*_]/g, ''), ...stile(r, i) });

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
const capitoli = [];
const codaAutore = path.join(QUI, 'audio', 'autore', 'lavori.json');
const sospesi = new Map();
if (solo === null && fs.existsSync(codaAutore)) {
  for (const j of JSON.parse(fs.readFileSync(codaAutore, 'utf8'))) {
    if (['modifica', 'scegli', 'rigenera'].includes(j.tipo)) sospesi.set(j.capitolo, j.stato !== 'pronto');
  }
}
// Capitolo in rigenerazione (mp3 tolto da audiobooks): resta ascoltabile la versione già pubblicata.
const prima = (() => { try { return Object.fromEntries(JSON.parse(fs.readFileSync(path.join(sito, 'capitoli.json'), 'utf8')).capitoli.map(c => [c.n, c])); } catch { return {}; } })();
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
  if ((solo !== null && n !== solo) || sospesi.get(n)) { capitoli.push(prima[n] || voce); continue; }

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
    voce.durata = Math.round(cue[cue.length - 1].fine);
    voce.byte = fs.statSync(out).size;
    if (solo !== null) voce.versioneAudio = fs.statSync(mp3).mtimeMs;
    console.log(`${id} ${voce.durata}s ${(voce.byte / 1048576).toFixed(1)} MiB testo ${esatto ? 'esatto' : 'come letto'}`);
  }
  else if (solo !== null) throw new Error(`${id}: MP3 o sottotitoli mancanti.`);
  else if (prima[n] && prima[n].durata && fs.existsSync(out)) { voce.durata = prima[n].durata; voce.byte = prima[n].byte; }
  capitoli.push(voce);
}
fs.writeFileSync(path.join(DOCS, 'capitoli.json'), JSON.stringify({ parti, capitoli }));
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
