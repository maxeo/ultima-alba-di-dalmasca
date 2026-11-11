const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ePassaggio = t => t && !/^#{1,6}\s|^-{3,}$/.test(t);
// Lo stacco di scena vale come un paragrafo a se': si scrive e si incolla insieme al testo.
const eStacco = t => /^\s*(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(t || '');
const soloParagrafi = v => v.filter(t => !eStacco(t));

function errore(status, messaggio) {
  return Object.assign(new Error(messaggio), { status });
}

function scrivi(file, dati) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, dati);
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function numero(n) {
  if (!Number.isInteger(n) || n < 1 || n > 999) throw errore(400, 'Numero di capitolo non valido.');
  return String(n).padStart(3, '0');
}

function testoValido(testo) {
  if (typeof testo !== 'string' || !testo.trim() || testo.length > 25000 || /[\r\n\0]/.test(testo) ||
      /^\s*#/.test(testo) || /^\s*-{3,}/.test(testo) && !eStacco(testo)) {
    throw errore(400, 'Scrivi un paragrafo su una riga.');
  }
  return eStacco(testo) ? '---' : testo.trim();
}

function leggiCapitolo(root, n) {
  const id = numero(n);
  const dir = path.join(root, 'Romanzo', 'capitoli');
  const nome = fs.readdirSync(dir).find(x => x.startsWith(`${id}-`) && x.endsWith('.md'));
  if (!nome) throw errore(404, 'Capitolo non trovato.');
  const file = path.join(dir, nome);
  const fonte = fs.readFileSync(file, 'utf8');
  const revisione = createHash('sha256').update(fonte).digest('hex');
  return { nome: nome.slice(0, -3), file, fonte, revisione, ...analizzaCapitolo(fonte) };
}

function analizzaCapitolo(fonte) {
  const righe = fonte.split(/(\r?\n)/);
  const passaggi = [];
  let stacco = false;
  for (let i = 0; i < righe.length; i += 2) {
    const testo = righe[i].trim();
    if (/^-{3,}$/.test(testo)) stacco = true;
    if (ePassaggio(testo)) {
      passaggi.push({ riga: i / 2, testo, ...(stacco && { stacco }) });
      stacco = false;
    }
  }
  return { righe, passaggi };
}

function bloccoValido(capitolo, riga, fine, testo) {
  const ordine = capitolo.passaggi.findIndex(p => p.riga === riga);
  const ultimo = capitolo.passaggi.findIndex(p => p.riga === fine);
  if (ordine < 0 || ultimo < ordine || typeof testo !== 'string') throw errore(400, 'Seleziona i paragrafi da correggere.');
  const righe = capitolo.passaggi.slice(ordine, ultimo + 1);
  const prima = righe.flatMap((p, i) => i && p.stacco ? ['---', p.testo] : [p.testo]);
  const blocco = capitolo.righe.slice(riga * 2, fine * 2 + 1).join('');
  if (/^#{1,6}\s/m.test(blocco)) throw errore(400, 'Seleziona paragrafi dello stesso capitolo.');
  const dopo = testo.trim().split(/\r?\n(?:[ \t]*\r?\n)+/).map(t => testoValido(t.replace(/\s*\r?\n\s*/g, ' ')));
  return { riga, fine, ordine, prima, dopo };
}

// Il testo sta in due posti soltanto: il capitolo e il romanzo intero, che ne è una copia. Si cambiano
// insieme o non si scrive niente, e nient'altro nel repository viene toccato da qui.
function sostituisci(root, n, capitolo, blocchi) {
  const indiciBase = blocchi.map(b => capitolo.passaggi.slice(b.ordine, b.ordine + soloParagrafi(b.prima).length).map(p => p.riga * 2));
  function aggiorna(righe, indici, nome) {
    const occupati = new Set();
    const cambi = indici.map((v, k) => {
      const da = v[0], a = v.at(-1);
      const indiciAttesi = righe.flatMap((t, i) => i % 2 === 0 && i >= da && i <= a && t.trim() && !eStacco(t) ? [i] : []);
      if (v.includes(-1) || v.some((i, j) => i !== indiciAttesi[j] || occupati.has(i)) || indiciAttesi.length !== v.length) {
        throw errore(409, `Passaggio divergente in ${path.relative(root, nome)}.`);
      }
      v.forEach(i => occupati.add(i));
      const separatore = righe[da + 1] || (righe.includes('\r\n') ? '\r\n' : '\n');
      const t = blocchi[k].dopo;
      const testo = t.length === 1 && a === da ? righe[da].replace(righe[da].trim(), () => t[0]) : t.join(separatore + separatore);
      return { da, a, testo };
    });
    for (const { da, a, testo } of cambi.sort((x, y) => y.da - x.da)) righe.splice(da, a - da + 1, testo);
    return righe.join('');
  }
  const file = [{ file: capitolo.file, prima: capitolo.fonte, dopo: aggiorna([...capitolo.righe], indiciBase, capitolo.file) }];
  let versioneBase;
  function testoBase(ordine) {
    if (versioneBase === undefined) try {
      const ref = `HEAD:Romanzo/capitoli/${capitolo.nome}.md`;
      const originale = execFileSync('git', ['show', ref], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      const passaggi = originale.split(/\r?\n/).map(x => x.trim()).filter(ePassaggio);
      versioneBase = passaggi.length === capitolo.passaggi.length ? passaggi : null;
    } catch { versioneBase = null; }
    return versioneBase?.[ordine];
  }
  function copiaAggiornata(nome) {
    if (!fs.existsSync(nome)) throw errore(409, `Copia mancante: ${path.relative(root, nome)}`);
    const fonte = fs.readFileSync(nome, 'utf8');
    const righe = fonte.split(/(\r?\n)/);
    const indice = righe.findIndex(x => new RegExp(`^## ${n}\\. `).test(x));
    const fine = righe.findIndex((x, i) => i > indice && /^## \d+\. |^# /.test(x));
    const limite = fine < 0 ? righe.length : fine;
    const posizioni = righe.flatMap((x, i) => i % 2 === 0 && i > indice && i < limite && ePassaggio(x.trim()) ? [i] : []);
    const indici = blocchi.map(b => soloParagrafi(b.prima).map((prima, j) => {
      const ordine = b.ordine + j;
      const uguali = posizioni.filter(i => righe[i].trim() === prima);
      const corrispondente = posizioni[ordine];
      const stessaStruttura = indice >= 0 && posizioni.length === capitolo.passaggi.length;
      if (stessaStruttura && righe[corrispondente]?.trim() === prima) return corrispondente;
      if (indice >= 0 && uguali.length === 1) return uguali[0];
      const vicino = [-1, 1].some(s => capitolo.passaggi[ordine + s]?.testo &&
        righe[posizioni[ordine + s]]?.trim() === capitolo.passaggi[ordine + s].testo);
      if (stessaStruttura && !uguali.length && vicino && righe[corrispondente]?.trim() === testoBase(ordine)) return corrispondente;
      return -1;
    }));
    return { file: nome, prima: fonte, dopo: aggiorna(righe, indici, nome) };
  }
  file.push(copiaAggiornata(path.join(root, 'Romanzo', 'romanzo.md')));
  return file;
}

// Mette, toglie o sposta la riga --- che separa le scene prima di un paragrafo, in tutte le copie.
// I cambi sono [{riga, stacco}]: per spostare lo stacco si toglie da un paragrafo e si mette su un altro.
function cambiaStacco(root, n, capitolo, cambi) {
  const richieste = cambi.map(({ riga, stacco }) => {
    const ordine = capitolo.passaggi.findIndex(p => p.riga === riga);
    if (ordine < 0) throw errore(400, 'Scegli un paragrafo del capitolo.');
    return { ordine, stacco, atteso: capitolo.passaggi[ordine].testo };
  });
  if (!richieste.length) throw errore(400, 'Scegli un paragrafo del capitolo.');
  if (new Set(richieste.map(r => r.ordine)).size !== richieste.length) throw errore(400, 'Scegli un altro paragrafo.');
  function aggiorna(righe, nome) {
    const indice = righe.findIndex(x => new RegExp(`^## ${n}\. `).test(x));
    const fine = righe.findIndex((x, i) => i > indice && /^## \d+\. |^# /.test(x));
    const limite = fine < 0 ? righe.length : fine;
    const posizioni = righe.flatMap((x, i) => i % 2 === 0 && i > indice && i < limite && ePassaggio(x.trim()) ? [i] : []);
    if (posizioni.length !== capitolo.passaggi.length) throw errore(409, `Passaggio divergente in ${path.relative(root, nome)}.`);
    // Dal fondo verso l'inizio, così le righe aggiunte o tolte non spostano i punti ancora da sistemare.
    for (const { ordine, stacco, atteso } of [...richieste].sort((x, y) => y.ordine - x.ordine)) {
      const i = posizioni[ordine];
      if (righe[i]?.trim() !== atteso) throw errore(409, `Passaggio divergente in ${path.relative(root, nome)}.`);
      let j = i - 2;
      while (j >= 0 && !righe[j].trim()) j -= 2;
      const separatore = /^-{3,}$/.test(righe[j]?.trim() || '');
      if (separatore === stacco) throw errore(409, 'Lo stacco è già così.');
      const fineRiga = righe[i + 1] || (righe.includes('\r\n') ? '\r\n' : '\n');
      if (stacco) righe.splice(i, 0, '---', fineRiga, '', fineRiga);
      else righe.splice(j, Math.min(4, i - j));
    }
    return righe.join('');
  }
  const file = [{ file: capitolo.file, prima: capitolo.fonte, dopo: aggiorna([...capitolo.righe], capitolo.file) }];
  function copiaAggiornata(nome) {
    if (!fs.existsSync(nome)) throw errore(409, `Copia mancante: ${path.relative(root, nome)}`);
    const fonte = fs.readFileSync(nome, 'utf8');
    return { file: nome, prima: fonte, dopo: aggiorna(fonte.split(/(\r?\n)/), nome) };
  }
  file.push(copiaAggiornata(path.join(root, 'Romanzo', 'romanzo.md')));
  return file;
}

module.exports = { errore, scrivi, numero, testoValido, leggiCapitolo, analizzaCapitolo, bloccoValido, sostituisci, cambiaStacco, eStacco, soloParagrafi };
