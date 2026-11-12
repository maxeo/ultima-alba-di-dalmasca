// Prepara il testo da leggere per un capitolo: node prepara.js 1 2 3
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'Romanzo', 'capitoli');
const unita = ['', 'primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto', 'settimo', 'ottavo', 'nono', 'decimo'];
const base = { 1: 'un', 2: 'due', 3: 'tre', 4: 'quattro', 5: 'cinque', 6: 'sei', 7: 'sette', 8: 'otto', 9: 'nove', 10: 'dieci', 11: 'undici', 12: 'dodici', 13: 'tredici', 14: 'quattordici', 15: 'quindici', 16: 'sedici', 17: 'diciassette', 18: 'diciotto', 19: 'diciannove', 20: 'venti', 30: 'trenta', 40: 'quaranta', 50: 'cinquanta', 60: 'sessanta', 70: 'settanta', 80: 'ottanta', 90: 'novanta', 100: 'cento' };
function cardinale(n) {
  if (n > 100) return 'cento' + cardinale(n - 100);
  if (base[n]) return base[n];
  const d = Math.floor(n / 10) * 10, u = n % 10;
  return (u === 1 || u === 8 ? base[d].slice(0, -1) : base[d]) + (u === 1 ? 'uno' : base[u]);
}
function ordinale(n) {
  if (n === 101) return 'centunesimo';
  if (n === 110) return 'centodecimo';
  if (n <= 10) return unita[n];
  if (n % 10 === 6 && n !== 16) return cardinale(n) + 'esimo';
  let c = cardinale(n);
  return (n % 10 === 3 && n % 100 !== 13 ? c : c.slice(0, -1)) + 'esimo';
}
const romani = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13 };
const femm = s => s.replace(/o$/, 'a');
const voci = fs.readFileSync(path.join(__dirname, 'pronuncia.tsv'), 'utf8').split(/\r?\n/)
  .filter(r => r && !r.startsWith('#')).map(r => r.split('\t')).sort((a, b) => b[0].length - a[0].length);
function pronuncia(t) {
  for (const [da, a] of voci) {
    const e = da;
    t = t.replace(new RegExp(String.raw`(?<!\p{L})${e}(?!\p{L})`, 'gu'), a);
  }
  return t;
}
for (const arg of process.argv.slice(2)) {
  const n = String(arg).padStart(3, '0');
  const f = fs.readdirSync(dir).find(x => x.startsWith(n + '-'));
  const out = [];
  for (let r of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
    r = r.trim();
    if (!r) continue;
    let m;
    if ((m = r.match(/^# Parte ([IVX]+)\. (.+)$/))) { out.push(`Parte ${femm(ordinale(romani[m[1]]))}. ${m[2]}.`, '[pause:2]'); continue; }
    if (r.startsWith('# ')) { out.push(r.slice(2).replace(/\.$/, '') + '.', '[pause:2]'); continue; }
    if ((m = r.match(/^## (\d+)\. (.+)$/))) { out.push('[pause:2]', `Capitolo ${ordinale(+m[1])}: ${m[2]}.`, '[pause:2]'); continue; }
    if (/^-{3,}$/.test(r)) { out.push('[pause:2]'); continue; }
    // Il > che in Markdown apre una citazione non si legge ad alta voce.
    out.push(r.replace(/^>\s+/, '').replace(/[*_]/g, '').replace(/[«»]/g, ''));
  }
  // Dopo un paragrafo breve (una battuta di dialogo) il paragrafo seguente si attacca con un solo a capo:
  // lo scambio di battute diventa un paragrafo unico, senza la pausa lunga tra l'una e l'altra.
  const BREVE = 90, gruppi = [];
  for (const r of out) {
    const g = gruppi[gruppi.length - 1], prec = g && g[g.length - 1];
    if (prec && !r.startsWith('[') && !prec.startsWith('[') && prec.length <= BREVE) g.push(r);
    else gruppi.push([r]);
  }
  const dest = path.join(__dirname, 'testo', f.replace(/\.md$/, '.txt'));
  fs.writeFileSync(dest, pronuncia(gruppi.map(g => g.join('\n')).join('\n\n')) + '\n');
  console.log(dest);
}
