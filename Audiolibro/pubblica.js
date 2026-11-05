// Prepara per il lettore web i capitoli gia' generati: audio compresso, testo sincronizzato, indice.
// Uso: node pubblica.js [--push]
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const QUI = __dirname, ROOT = path.join(QUI, '..');
const CAP = path.join(ROOT, 'Romanzo', 'capitoli');
const SRC = path.join(QUI, 'audiobooks'), TESTO = path.join(QUI, 'testo');
const DOCS = path.join(ROOT, 'docs'), AUDIO = path.join(DOCS, 'audio'), TESTI = path.join(DOCS, 'testi');
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
  const righe = fs.readFileSync(path.join(CAP, f + '.md'), 'utf8').split(/\r?\n/).map(r => r.trim())
    .filter(r => r && !/^-{3,}$/.test(r));
  const letti = fs.readFileSync(path.join(TESTO, f + '.txt'), 'utf8').split(/\n\n+/).map(r => r.trim())
    .filter(r => r && !r.startsWith('[pause'));
  const piano = () => ({ par: [{ c: cue.filter(c => c.testo).map(c => [+c.t.toFixed(2), c.testo]) }], esatto: false });
  if (righe.length !== letti.length) return piano();
  const par = righe.map((r, i) => /^#/.test(r)
    ? { h: 1, s: nomi(letti[i]) }
    : { s: r.replace(/[*_]/g, '') });

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
  for (const q of par) q.c = [];
  for (const c of cue) {
    const n = lettere(c.testo).length;
    if (!n) continue;
    const pezzi = avanza(n);
    if (lettere(pezzi.map(x => x.s).join('')) !== lettere(c.testo)) return piano();
    for (const x of pezzi) par[x.p].c.push([+c.t.toFixed(2), x.s]);
  }
  return { par: par.map(q => (q.h ? { h: 1, c: q.c } : { c: q.c })), esatto: p >= par.length };
}

const parti = [];
const capitoli = [];
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

  const mp3 = path.join(SRC, f + '.mp3'), vtt = path.join(SRC, f + '.vtt');
  const out = path.join(AUDIO, id + '.mp3'), js = path.join(TESTI, id + '.json');
  if (fs.existsSync(mp3) && fs.existsSync(vtt) && fs.statSync(mp3).size > 0) {
    if (!fs.existsSync(out)) {
      const tmp = id + '.tmp.mp3';
      execFileSync('docker', ['run', '--rm', '--entrypoint', 'ffmpeg',
        '-v', `${SRC}:/in:ro`, '-v', `${AUDIO}:/out`, 'e2a-locale:cu126',
        '-y', '-loglevel', 'error', '-i', `/in/${f}.mp3`, '-vn', '-map_metadata', '-1',
        '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', BITRATE, `/out/${tmp}`], { stdio: 'inherit' });
      fs.renameSync(path.join(AUDIO, tmp), out);
      nuovi.push(n);
    }
    const cue = leggiVtt(vtt);
    const { par, esatto } = sincronizza(f, cue);
    fs.writeFileSync(js, JSON.stringify(par));
    voce.durata = Math.round(cue[cue.length - 1].fine);
    voce.byte = fs.statSync(out).size;
    console.log(`${id} ${voce.durata}s ${(voce.byte / 1048576).toFixed(1)} MiB testo ${esatto ? 'esatto' : 'come letto'}`);
  }
  capitoli.push(voce);
}
fs.writeFileSync(path.join(DOCS, 'capitoli.json'), JSON.stringify({ parti, capitoli }));

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
