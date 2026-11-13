// Taglia le parole in più di XTTS: una frase detta due volte di seguito («Nessuno si fermò a dare spiegazioni.
// Nessuno si fermò a dare spiegazioni.») o parole inventate fra due pezzi giusti («Sì. mi sento ne all'isano…»).
// Parte dal controllo Whisper: per ogni punto «in più» allinea le parole sentite in quella frase con il testo della
// frase. Se il resto coincide e in mezzo ci sono almeno 3 parole che nel testo non ci sono, le taglia.
// Il taglio si fa sul file della frase nella sessione (chapters/sentences/<blocco>/<i>.flac), così resta anche nei
// rimontaggi successivi. Va dalla pausa dopo l'ultima parola giusta alla pausa prima della successiva (o alla pausa
// finale, se le parole in più chiudono la frase). Se una delle due pause non si trova, la frase non si tocca.
// Uso: node taglia.js <cartella di sessione> <nome capitolo> [--prova]   (lo chiama rifai.sh; con --prova dice solo
// cosa taglierebbe). Scrive sulla prima riga gli indici delle frasi tagliate, separati da spazi.
const fs = require('fs'), path = require('path'), { execFileSync, spawnSync } = require('child_process');
const [P, f] = process.argv.slice(2);
const prova = process.argv.includes('--prova');
const base = __dirname;
const leggi = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const MIN_PAROLE = 3;
// Fuori dalle parole tagliate la frase deve coincidere col testo: al più due parole diverse di fila (nomi sentiti male).
const TOLLERANZA = 3;

const norm = w => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const chiavi = t => t.replace(/\[[^\]]*\]/g, ' ').split(/[\s'’-]+/).map(norm).filter(Boolean);

// Le parole che Whisper sente sempre male (whisper-sente.tsv, «sentito<TAB>scritto»), come in controlla.py.
const sente = (() => {
  const f = path.join(base, 'whisper-sente.tsv');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(r => r && !r.startsWith('#') && r.includes('\t'))
    .map(r => r.split('\t').map(chiavi)).filter(([a]) => a.length).sort((x, y) => y[0].length - x[0].length);
})();
function corrette(sentite) {
  const fuori = [];
  for (let i = 0; i < sentite.length;) {
    const voce = sente.find(([a]) => a.every((k, j) => sentite[i + j]?.k === k));
    if (!voce) { fuori.push(sentite[i++]); continue; }
    const [a, b] = voce, primo = sentite[i], ultimo = sentite[i + a.length - 1];
    for (const k of b) fuori.push({ da: primo.da, al: ultimo.al, k, w: primo.w });
    i += a.length;
  }
  return fuori;
}

function leggiVtt(file) {
  const sec = x => x.split(':').reduce((n, k) => n * 60 + Number(k), 0);
  return Array.from(fs.readFileSync(file, 'utf8').matchAll(/^(\d{2}:\d{2}:\d{2}\.\d+) --> (\d{2}:\d{2}:\d{2}\.\d+)/gm),
    ([, a, b]) => [sec(a), sec(b)]);
}

// Allineamento parola per parola (LCS): blocchi uguali e buchi, come difflib.
function allinea(a, b) {
  const L = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let x = a.length - 1; x >= 0; x--) for (let y = b.length - 1; y >= 0; y--)
    L[x][y] = a[x] === b[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
  const pezzi = [];
  let x = 0, y = 0, da = [0, 0];
  const chiudi = () => { if (da[0] < x || da[1] < y) pezzi.push({ a1: da[0], a2: x, b1: da[1], b2: y }); };
  while (x < a.length && y < b.length) {
    if (a[x] === b[y]) { chiudi(); x++; y++; da = [x, y]; }
    else if (L[x + 1][y] >= L[x][y + 1]) x++;
    else y++;
  }
  x = a.length; y = b.length; chiudi();
  return pezzi;
}

function silenzi(flac) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', flac, '-af', 'silencedetect=n=-40dB:d=0.1', '-f', 'null', '-'],
    { encoding: 'utf8' }).stderr;
  const inizi = [...r.matchAll(/silence_start: ([\d.]+)/g)].map(m => Number(m[1]));
  const fini = [...r.matchAll(/silence_end: ([\d.]+)/g)].map(m => Number(m[1]));
  return inizi.map((da, k) => ({ da, a: fini[k] ?? Infinity }));
}

function durata(flac) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', flac], { encoding: 'utf8' }));
}

// Il pezzo da togliere in una frase, in secondi dall'inizio del suo file; null se non è un caso sicuro.
function taglio(frase, sentite, flac, inizio) {
  const attese = chiavi(frase);
  const buchi = allinea(attese, sentite.map(w => w.k));
  const inPiu = buchi.filter(g => g.a1 === g.a2 && g.b2 - g.b1 >= MIN_PAROLE);
  if (inPiu.length !== 1) return null;
  const altri = buchi.filter(g => g !== inPiu[0]);
  if (altri.some(g => Math.max(g.a2 - g.a1, g.b2 - g.b1) >= TOLLERANZA)) return null;
  const { b1, b2 } = inPiu[0];
  const prima = sentite[b1 - 1], dopo = sentite[b2], primaInPiu = sentite[b1], ultimaInPiu = sentite[b2 - 1];
  const pause = silenzi(flac), fine = durata(flac);
  const t = x => x - inizio;
  // Whisper allunga le parole fino alla successiva, attaccandoci il silenzio: le pause si cercano fra le parole,
  // non attorno ai loro tempi esatti.
  // Inizio: la prima pausa dopo l'inizio dell'ultima parola giusta, prima della fine della prima parola in più.
  const pa = prima && pause.find(p => p.da >= t(prima.da) + 0.15 && p.da <= t(primaInPiu.al));
  const da = prima ? pa?.da : 0;
  if (da === undefined) return null;
  // Fine: l'ultima pausa che finisce prima della fine della parola giusta successiva; da lì in poi resta tutto,
  // pausa compresa. Se le parole in più chiudono la frase, si arriva alla pausa finale (o alla fine del file).
  let al;
  if (dopo) al = pause.filter(p => p.da > da && p.a <= t(dopo.al) + 0.05 && p.a >= t(ultimaInPiu.da)).at(-1)?.da;
  else {
    const coda = pause.find(p => p.a >= fine - 0.05 && p.da > da);
    al = coda ? coda.da : fine;
  }
  if (al === undefined || al - da < 0.3) return null;
  // Il taglio non deve mangiare più di quanto durano le parole in più (con un margine per le pause).
  if (al - da > t(ultimaInPiu.al) - t(primaInPiu.da) + 2) return null;
  return { da, al, parole: sentite.slice(b1, b2).map(w => w.w).join(' ') };
}

function main() {
  const controllo = path.join(base, 'controlli', `${f}.json`), fileParole = path.join(base, 'controlli', `${f}.parole.json`);
  const vtt = path.join(base, 'audiobooks', `${f}.vtt`);
  if (![controllo, fileParole, vtt].every(fs.existsSync)) return [];
  const blocco = leggi(path.join(P, `__current_${f}.json`)).blocks[0];
  const cue = leggiVtt(vtt);
  if (cue.length !== blocco.sentences.length) { console.error(`${f}: sessione e sottotitoli non coincidono, niente tagli`); return []; }
  const parole = leggi(fileParole);
  const indici = new Set();
  for (const p of leggi(controllo).problemi) {
    if (p.tipo !== 'in più') continue;
    const i = cue.findIndex(([a, b]) => a <= p.secondi && p.secondi < b);
    if (i >= 0) indici.add(i);
  }
  const tagliate = [];
  for (const i of indici) {
    const [a, b] = cue[i];
    const sentite = parole.filter(([da]) => da >= a - 0.05 && da < b)
      .flatMap(([da, al, w]) => chiavi(w).map(k => ({ da, al, k, w })));
    const giuste = corrette(sentite);
    const flac = path.join(P, 'chapters', 'sentences', blocco.id, `${i}.flac`);
    if (!fs.existsSync(flac)) continue;
    const t = taglio(blocco.sentences[i], giuste, flac, a);
    if (!t) { console.error(`${f}: frase ${i}, parole in più ma nessun taglio sicuro: resta da ascoltare`); continue; }
    if (prova) { console.error(`${f}: frase ${i}, taglierei «${t.parole}» da ${t.da.toFixed(2)} a ${t.al.toFixed(2)} s`); tagliate.push(i); continue; }
    const tmp = flac.replace(/\.flac$/, '.taglio.flac');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', flac, '-af', `aselect='not(between(t,${t.da.toFixed(4)},${t.al.toFixed(4)}))',asetpts=N/SR/TB`,
      '-c:a', 'flac', '-sample_fmt', 's32', tmp]);
    fs.renameSync(tmp, flac);
    const ora = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');
    const riga = `${ora} ${f} frase ${i}: tolto «${t.parole}» (${t.da.toFixed(2)}-${t.al.toFixed(2)} s)`;
    fs.appendFileSync(path.join(base, 'audio', 'tagli.txt'), riga + '\n');
    console.error(riga);
    tagliate.push(i);
  }
  return tagliate;
}

console.log(main().sort((x, y) => x - y).join(' '));
