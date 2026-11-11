const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: pausa } = require('node:timers/promises');
const { errore, numero, scrivi, leggiCapitolo } = require('./archivio');

function leggiVtt(vtt) {
  const secondi = x => x.split(':').reduce((n, k) => n * 60 + Number(k), 0);
  return Array.from(vtt.matchAll(/^(\d{2}:\d{2}:\d{2}\.\d+) --> (\d{2}:\d{2}:\d{2}\.\d+)\r?\n([^\r\n]*)/gm),
    ([, da, a, testo]) => [secondi(da), secondi(a), testo]);
}

function indiceVtt(vtt, tempo, frase) {
  const cue = leggiVtt(vtt);
  if (frase) {
    const normalizza = t => t.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const selezionata = normalizza(frase);
    const vicini = cue.flatMap(([da, a, t], i) => da <= tempo + 0.0051 && tempo - 0.0051 < a && normalizza(t).includes(selezionata) ? [i] : []);
    if (selezionata && vicini.length === 1) return vicini[0];
    throw errore(409, 'La frase selezionata non coincide con l’audio. Riselezionala dal testo aggiornato.');
  }
  const indice = cue.findIndex(([da, a]) => da <= tempo && tempo < a);
  if (indice < 0) throw errore(400, 'Il punto è fuori dal testo sincronizzato.');
  return indice;
}

function creaAudio(root) {
  const base = path.join(root, 'Audiolibro');
  const autore = path.join(base, 'audio', 'autore');
  const tmp = path.join(base, 'tmp');
  const bash = process.env.AUTORE_BASH || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');

  function esegui(j, comando, argomenti, env = {}) {
    const log = path.join(autore, `${j.id}.log`);
    const fd = fs.openSync(log, 'a');
    return new Promise((resolve, reject) => {
      let figlio;
      try {
        figlio = spawn(comando, argomenti, { cwd: base, env: { ...process.env, PUBBLICA: 'no', ...env },
          windowsHide: true, stdio: ['ignore', fd, fd] });
      } finally { fs.closeSync(fd); }
      figlio.once('error', reject);
      figlio.once('close', codice => codice === 0 ? resolve() : reject(new Error(`Elaborazione interrotta (${codice}). Registro: ${j.id}.log`)));
    });
  }

  function sessione(nome) {
    if (!fs.existsSync(tmp)) return undefined;
    const trovate = [];
    for (const p of fs.readdirSync(tmp, { withFileTypes: true })) {
      if (!p.isDirectory() || !p.name.startsWith('proc-')) continue;
      const proc = path.join(tmp, p.name);
      for (const cartella of fs.readdirSync(proc, { withFileTypes: true })) {
        if (!cartella.isDirectory()) continue;
        const f = path.join(proc, cartella.name, `__current_${nome}.json`);
        const info = fs.statSync(f, { throwIfNoEntry: false });
        if (info?.isFile()) trovate.push({ f, tempo: info.mtimeMs });
      }
    }
    const ultima = trovate.sort((a, b) => b.tempo - a.tempo)[0];
    return ultima && JSON.parse(fs.readFileSync(ultima.f, 'utf8')).blocks[0];
  }

  async function attendiCapitolo(nome) {
    const porte = new Set([8770, 8771, Number(process.env.TTS_PORTA || 8770)]);
    const lavoro = async porta => {
      try {
        const r = await fetch(`http://127.0.0.1:${porta}/stato`, { signal: AbortSignal.timeout(1500) });
        return await r.json();
      } catch { return null; }
    };
    while ((await Promise.all([...porte].map(lavoro))).some(s =>
      s?.occupato && s.lavoro?.includes(`/app/testo/${nome}.txt`))) await pausa(2000);
  }

  // Avanzamento della generazione: il server TTS scrive nel registro del capitolo righe con
  // "frase fatte/totali". Si legge la coda del registro toccato dopo l'avvio del lavoro.
  function progresso(j) {
    const avvio = Date.parse(j.avviato || '');
    if (!Number.isFinite(avvio)) return undefined;
    const id = numero(j.capitolo);
    let scelto;
    for (const nome of [`rifai-${id}.txt`, `log-${id}.txt`]) {
      const f = path.join(base, 'audio', nome);
      const info = fs.statSync(f, { throwIfNoEntry: false });
      if (info?.isFile() && info.mtimeMs >= avvio && (!scelto || info.mtimeMs > scelto.tempo)) scelto = { f, tempo: info.mtimeMs };
    }
    if (!scelto) return undefined;
    const fd = fs.openSync(scelto.f, 'r');
    try {
      const info = fs.fstatSync(fd);
      const lungo = Math.min(info.size, 16384);
      const buffer = Buffer.alloc(lungo);
      fs.readSync(fd, buffer, 0, lungo, info.size - lungo);
      const righe = buffer.toString('utf8');
      const ultimo = [...righe.matchAll(/(\d+)\/(\d+)/g)].at(-1);
      if (!ultimo) return undefined;
      const [, fatte, totali] = ultimo.map(Number);
      if (!totali || fatte > totali) return undefined;
      // Dopo l'ultima frase restano montaggio ed esportazione: il conteggio non sale più.
      const coda = righe.slice(ultimo.index + ultimo[0].length);
      const fase = /Combining sentences|Get duration|Export|monto l'audio/i.test(coda) ? 'montaggio' : undefined;
      return { fatte, totali, ...(fase && { fase }), aggiornato: new Date(scelto.tempo).toISOString() };
    } finally { fs.closeSync(fd); }
  }

  function filePresa(j, k) {
    return path.join(autore, 'prese', j.id, `${numero(j.capitolo)}-${j.indice}-${k}.mp3`);
  }

  function segmento(n, nome, tempo, testoLetto) {
    const vtt = path.join(base, 'audiobooks', `${nome}.vtt`);
    const blocco = sessione(nome);
    if (!blocco || !fs.existsSync(vtt)) throw errore(409, 'Il capitolo non ha ancora una sessione audio pronta.');
    const contenuto = fs.readFileSync(vtt, 'utf8');
    const voci = testoLetto ? fs.readFileSync(path.join(base, 'pronuncia.tsv'), 'utf8').split(/\r?\n/)
      .filter(r => r && !r.startsWith('#')).map(r => r.split('\t')).sort((a, b) => b[0].length - a[0].length) : [];
    const parlato = voci.reduce((testo, [da, a]) => testo.replace(new RegExp(String.raw`(?<!\p{L})${da}(?!\p{L})`, 'gu'), a), testoLetto);
    const indice = indiceVtt(contenuto, tempo, parlato);
    const frase = blocco.sentences[indice];
    if (!frase || leggiVtt(contenuto).length !== blocco.sentences.length) throw errore(409, 'Sessione audio e sottotitoli non coincidono.');
    return { indice, frase, tempo };
  }

  async function lavora(j) {
    await attendiCapitolo(j.nome);
    await attendiPubblicazione();
    if (j.revisione && leggiCapitolo(root, j.capitolo).revisione !== j.revisione) return;
    const id = String(j.capitolo);
    const rifai = (args, env) => esegui(j, bash, ['rifai.sh', id, ...args.map(String)], env);
    const mp3 = path.join(base, 'audiobooks', `${j.nome}.mp3`);
    const vtt = path.join(base, 'audiobooks', `${j.nome}.vtt`);
    const blocco = sessione(j.nome);
    const testuale = ['modifica', 'stacco'].includes(j.tipo);
    if (testuale && !blocco) {
      if (fs.existsSync(mp3)) fs.renameSync(mp3, path.join(autore, `${j.id}-prima.mp3`));
      await esegui(j, bash, ['genera.sh', id, id]);
    } else if (testuale) {
      const prima = fs.statSync(mp3, { throwIfNoEntry: false })?.mtimeMs;
      await rifai(['--testo']);
      const dopo = fs.statSync(mp3, { throwIfNoEntry: false });
      if (!dopo?.size || dopo.mtimeMs === prima || !fs.existsSync(vtt)) await rifai(['--monta']);
    } else {
      if (blocco?.sentences[j.indice] !== j.frase) throw new Error('Il segmento audio è cambiato. Selezionalo di nuovo nel lettore.');
      if (j.tipo === 'prese') {
        await rifai(['--prove', j.indice, j.numero], { GRUPPO_PRESE: j.id });
        const prese = Array.from({ length: j.numero + 1 }, (_, k) => k);
        if (prese.some(k => !fs.statSync(filePresa(j, k), { throwIfNoEntry: false })?.size)) throw new Error('Mancano una o più prese audio.');
        return { prese };
      }
      if (j.tipo === 'scegli') await rifai(['--scegli', j.indice, j.presa], { GRUPPO_PRESE: j.gruppo });
      else await rifai([j.indice]);
    }
    if (!fs.statSync(mp3, { throwIfNoEntry: false })?.size) throw new Error('XTTS non ha prodotto il nuovo MP3.');
    const controllo = path.join(base, 'controlli', `${j.nome}.json`);
    if ((fs.statSync(controllo, { throwIfNoEntry: false })?.mtimeMs ?? 0) < fs.statSync(mp3).mtimeMs) {
      await esegui(j, bash, ['controlla.sh', j.nome]);
    }
    return { segnalazioni: JSON.parse(fs.readFileSync(controllo, 'utf8')).problemi };
  }

  const lock = path.join(base, 'audio', '.dopo.lock');
  const proprietario = path.join(lock, 'autore.pid');
  async function attendiPubblicazione() {
    const fine = Date.now() + 300000;
    while (fs.existsSync(lock)) {
      if (fs.existsSync(proprietario)) {
        try { process.kill(Number(fs.readFileSync(proprietario, 'utf8')), 0); }
        catch (e) {
          if (e.code === 'ESRCH') {
            fs.rmSync(proprietario, { force: true });
            fs.rmdirSync(lock);
            continue;
          }
        }
      }
      if (Date.now() >= fine) throw new Error('È in corso un altro aggiornamento del lettore. Riprova più tardi.');
      await pausa(1000);
    }
  }

  async function pubblica(j) {
    while (true) {
      await attendiPubblicazione();
      try { fs.mkdirSync(lock); break; } catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    try {
      fs.writeFileSync(proprietario, String(process.pid));
      if (leggiCapitolo(root, j.capitolo).revisione === j.revisione) await aggiornaLettore(j);
    } finally {
      fs.rmSync(proprietario, { force: true });
      fs.rmdirSync(lock);
    }
  }

  // Su Windows il file non si può sostituire mentre il lettore lo sta leggendo: si riprova per qualche secondo.
  async function rinomina(da, a) {
    for (let tentativo = 0; ; tentativo++) {
      try { return fs.renameSync(da, a); }
      catch (e) {
        if (tentativo >= 60 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) {
          if (tentativo >= 60) throw new Error(`Il lettore sta usando ${path.basename(a)}: ricarica la pagina del lettore e riprova.`);
          throw e;
        }
        await pausa(250);
      }
    }
  }

  async function aggiornaLettore(j) {
    const dest = path.join(autore, `lettore-${j.id}`);
    await esegui(j, process.execPath, ['pubblica.js', `--capitolo=${j.capitolo}`, `--destino=${dest}`]);
    if (leggiCapitolo(root, j.capitolo).revisione !== j.revisione) return;
    const id = numero(j.capitolo);
    const files = [`audio/${id}.mp3`, `testi/${id}.json`, 'capitoli.json'].map(f => ({
      file: path.join(root, 'docs', f), nuovo: path.join(dest, f),
    }));
    for (const f of files) f.prima = fs.existsSync(f.file) ? fs.readFileSync(f.file) : null;
    const cambiati = [];
    try {
      for (const f of files) {
        await rinomina(f.nuovo, f.file);
        cambiati.push(f);
      }
    } catch (e) {
      for (const f of cambiati.reverse()) {
        if (f.prima) scrivi(f.file, f.prima);
        else fs.rmSync(f.file, { force: true });
      }
      throw e;
    }
  }

  return { segmento, filePresa, lavora, pubblica, progresso };
}

module.exports = { creaAudio, indiceVtt };
