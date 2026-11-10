// Porta nella sessione di ebook2audiobook le modifiche fatte al testo di un capitolo già generato,
// così si rifanno solo le frasi cambiate e non tutto il capitolo.
// Uso: node aggiorna.js <cartella di sessione> <nome capitolo>   (lo chiama rifai.sh --testo)
// Scrive sulla prima riga gli indici delle frasi cambiate, separati da spazi.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [P, f] = process.argv.slice(2);
const nuovo = fs.readFileSync(path.join(__dirname, 'testo', f + '.txt'), 'utf8');
const files = ['__current_', '__saved_', '__'].map(x => path.join(P, x + f + '.json')).filter(fs.existsSync);
const j = JSON.parse(fs.readFileSync(files[0], 'utf8'));
const frasi = j.blocks[0].sentences;

// Parole confrontate: solo lettere e numeri (pause, punteggiatura e spazi cambiati dal programma non contano).
const parole = t => [...t.matchAll(/\[[^\]]*\]|[\p{L}\p{N}]+/gu)].filter(m => m[0][0] !== '[').map(m => ({ a: m.index, b: m.index + m[0].length, k: m[0].toLowerCase() }));
const vecchie = [];
frasi.forEach((s, i) => { for (const w of parole(s)) vecchie.push({ ...w, i }); });
// Gli a capo diventano le pause che usa il programma: [pause] fra paragrafi, [break] dentro un paragrafo.
const piatto = nuovo.replace(/\r/g, '').trim().replace(/\[pause:2\]/g, '[pause][pause].').replace(/\n\n+/g, ' [pause]').replace(/\n/g, ' [break]')
  .replace(/[«»“”"]/g, '').replace(/[ \t]+/g, ' ');
const nuove = parole(piatto);

// LCS sulle chiavi.
const n = vecchie.length, m = nuove.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
for (let x = n - 1; x >= 0; x--) for (let y = m - 1; y >= 0; y--)
  L[x][y] = vecchie[x].k === nuove[y].k ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
const cambi = []; let x = 0, y = 0;
while (x < n || y < m) {
  if (x < n && y < m && vecchie[x].k === nuove[y].k) { x++; y++; continue; }
  const c = { i1: x, j1: y };
  while ((x < n || y < m) && !(x < n && y < m && vecchie[x].k === nuove[y].k)) {
    if (y >= m || (x < n && L[x + 1][y] >= L[x][y + 1])) x++; else y++;
  }
  c.i2 = x; c.j2 = y;
  // Se le parole sono tante quante prima, ogni parola è un cambio a sé (può stare in frasi diverse).
  if (c.i2 - c.i1 === c.j2 - c.j1) for (let k = 0; k < c.i2 - c.i1; k++) cambi.push({ i1: c.i1 + k, i2: c.i1 + k + 1, j1: c.j1 + k, j2: c.j1 + k + 1 });
  else cambi.push(c);
}

// Per ogni cambio cerca un aggancio: la parola uguale a sinistra, nessuna (se si sostituiscono parole)
// o quella a destra, preferendo quello che resta dentro una sola frase.
const tratti = cambi.map(c => {
  // Se le parole uguali ai due lati stanno nella stessa frase, si sostituisce tutto lo spazio fra loro,
  // punteggiatura compresa (così togliere parole non si porta via un punto).
  if (c.i1 > 0 && c.i2 < n && c.j1 > 0 && c.j2 < m && vecchie[c.i1 - 1].i === vecchie[c.i2].i)
    return { a: { i: vecchie[c.i1 - 1].i, a: vecchie[c.i1 - 1].b }, b: { i: vecchie[c.i2].i, b: vecchie[c.i2].a },
             na: { a: nuove[c.j1 - 1].b }, nb: { b: nuove[c.j2].a } };
  const prove = [[1, 0], [0, 0], [0, 1]].filter(([s, d]) =>
    c.i1 - s >= 0 && c.j1 - s >= 0 && c.i2 + d <= n && c.j2 + d <= m && c.i2 + d > c.i1 - s && c.j2 + d > c.j1 - s)
    .map(([s, d]) => ({ a: vecchie[c.i1 - s], b: vecchie[c.i2 + d - 1], na: nuove[c.j1 - s], nb: nuove[c.j2 + d - 1] }));
  // Se fra la parola a sinistra e il cambio c'è una fine di frase o una pausa, l'aggancio giusto è a destra.
  const confine = c.j1 > 0 && c.j1 < m && /[.!?…]|\[/.test(piatto.slice(nuove[c.j1 - 1].b, nuove[c.j1].a));
  if (confine) prove.push(prove.shift());
  return prove.find(p => p.a.i === p.b.i) || prove[0];
});
// I cambi che toccano le stesse frasi diventano un tratto solo.
const uniti = [];
for (const t of tratti) {
  const u = uniti[uniti.length - 1];
  if (u && t.a.i <= u.b.i) { u.b = t.b; u.nb = t.nb; } else uniti.push({ ...t });
}
// Divide un testo lungo in frasi intere fino a 200 caratteri; un [pause] apre sempre una frase nuova.
const pulito = t => t.replace(/\[[^\]]*\]/g, '').trim().length;
function dividi(t) {
  const out = [];
  for (const p of t.split(/(?<=[.!?…])\s+(?=\S)/u)) {
    const u = out[out.length - 1];
    if (u !== undefined && !p.startsWith('[pause]') && pulito(u) + 1 + pulito(p) <= 200) out[out.length - 1] = u + ' ' + p;
    else out.push(p);
  }
  return out;
}
// Applica dal fondo. Ogni frase ricorda il suo indice di prima (null se è nuova o cambiata).
let lista = frasi.map((t, i) => ({ t, orig: i }));
for (const u of uniti.reverse()) {
  const testo = lista[u.a.i].t.slice(0, u.a.a) + piatto.slice(u.na.a, u.nb.b) + lista[u.b.i].t.slice(u.b.b);
  const nuoveFrasi = (u.a.i === u.b.i && pulito(testo) <= 250 ? [testo] : dividi(testo)).map(t => ({ t: t.trim(), orig: null }));
  lista.splice(u.a.i, u.b.i - u.a.i + 1, ...nuoveFrasi);
}
const idx = lista.map((x, p) => x.orig === null ? p : -1).filter(p => p >= 0);
for (const i of idx) console.error(`${i}: ${lista[i].t}`);
if (idx.length) {
  const nuoveSent = lista.map(x => x.t);
  for (const file of files) {
    const k = JSON.parse(fs.readFileSync(file, 'utf8'));
    k.blocks[0].sentences = nuoveSent; k.blocks[0].text = nuoveSent.join(' ');
    fs.writeFileSync(file, JSON.stringify(k, null, 4));
  }
  // Le frasi rimaste uguali ma spostate di posto: il loro audio cambia nome (in due passaggi, per non sovrascrivere).
  const dir = path.join(P, 'chapters', 'sentences', j.blocks[0].id);
  if (fs.existsSync(dir)) {
    const tieni = lista.map((x, p) => [x.orig, p]).filter(([o]) => o !== null);
    for (const [o] of tieni) { const da = path.join(dir, o + '.flac'); if (fs.existsSync(da)) fs.renameSync(da, path.join(dir, 't' + o + '.flac')); }
    for (const nome of fs.readdirSync(dir)) if (/^\d+\.flac$/.test(nome)) fs.unlinkSync(path.join(dir, nome));
    for (const [o, p] of tieni) { const da = path.join(dir, 't' + o + '.flac'); if (fs.existsSync(da)) fs.renameSync(da, path.join(dir, p + '.flac')); }
  }
}
// Impronta del nuovo testo: se non coincide, il programma rifà tutto il capitolo.
fs.writeFileSync(path.join(P, 'checksum'), crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'testo', f + '.txt'))).digest('hex'));
console.log(idx.join(' '));
