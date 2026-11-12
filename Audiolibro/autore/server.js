const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { errore, scrivi, numero, testoValido, leggiCapitolo, analizzaCapitolo, bloccoValido, sostituisci, cambiaStacco,
  soloParagrafi } = require('./archivio');

const prefisso = '/__autore/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain' };

function json(res, status, dati) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(dati));
}

async function corpo(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw errore(415, 'Usa application/json.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256000) throw errore(413, 'Richiesta troppo grande.');
    chunks.push(chunk);
  }
  try {
    const dati = JSON.parse(Buffer.concat(chunks));
    if (dati && typeof dati === 'object' && !Array.isArray(dati)) return dati;
  } catch {}
  throw errore(400, 'Dati JSON non validi.');
}

// Windows non lascia sostituire un file mentre qualcuno lo sta leggendo, e chi lo tiene aperto è questo server:
// il lettore scarica l'MP3 a pezzi e la connessione resta lì. Teniamo da parte i flussi per poterli chiudere noi.
const flussiAperti = new Map();

function liberaFile(file) {
  const chiave = path.resolve(file);
  for (const flusso of flussiAperti.get(chiave) || []) flusso.destroy();
  flussiAperti.delete(chiave);
}

function serveFile(req, res, file, inserisciAutore = false) {
  const info = fs.statSync(file, { throwIfNoEntry: false });
  if (!info?.isFile()) throw errore(404, 'File non trovato.');
  const type = mime[path.extname(file)] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
  // Il cookie dice alle richieste successive (anche quelle del service worker) di dare l'elenco completo.
  if (path.basename(file) === 'index.html') headers['Set-Cookie'] = inserisciAutore ? 'autore=1; Path=/; SameSite=Strict' : 'autore=; Path=/; Max-Age=0';
  if (inserisciAutore) {
    const html = fs.readFileSync(file, 'utf8').replace('</body>', `<script defer src="${prefisso}ui.js"></script></body>`);
    res.writeHead(200, { ...headers, 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(html) });
    return res.end(req.method === 'HEAD' ? undefined : html);
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const start = range?.[1] ? Number(range[1]) : range ? Math.max(0, info.size - Number(range[2])) : 0;
  const end = range?.[1] && range[2] ? Math.min(info.size - 1, Number(range[2])) : info.size - 1;
  if (range && (start > end || start >= info.size)) {
    res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
    return res.end();
  }
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  headers['Content-Length'] = range ? end - start + 1 : info.size;
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD' || !info.size) return res.end();
  const stream = fs.createReadStream(file, { start, end });
  const chiave = path.resolve(file);
  const aperti = flussiAperti.get(chiave) || flussiAperti.set(chiave, new Set()).get(chiave);
  aperti.add(stream);
  stream.on('close', () => { aperti.delete(stream); if (!aperti.size) flussiAperti.delete(chiave); });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function creaServer({ root = path.resolve(__dirname, '../..'), audio } = {}) {
  const dir = path.join(root, 'Audiolibro', 'audio', 'autore');
  fs.mkdirSync(dir, { recursive: true });
  const stato = path.join(dir, 'lavori.json');
  const transazione = path.join(dir, 'salvataggio.json');
  const lavori = fs.existsSync(stato) ? JSON.parse(fs.readFileSync(stato, 'utf8')) : [];
  let selezione = null;
  const sequenzeSelezione = new Map();
  const salva = () => scrivi(stato, JSON.stringify(lavori, null, 2));
  if (fs.existsSync(transazione)) {
    const { j, file, bozza } = JSON.parse(fs.readFileSync(transazione, 'utf8'));
    if (!lavori.some(x => x.id === j.id)) {
      if (file.some(f => ![f.prima, f.dopo].includes(fs.readFileSync(f.file, 'utf8')))) {
        throw new Error('Una copia è cambiata durante il recupero del salvataggio autore.');
      }
      for (const f of file) scrivi(f.file, f.dopo);
      lavori.push(j);
      if (bozza) lavori.push(bozza);
      salva();
    }
    fs.rmSync(transazione);
  }
  audio ??= require('./audio').creaAudio(root, liberaFile);
  let attivo = false;
  let chiuso = false;
  for (const j of lavori) if (j.stato === 'in generazione') { j.stato = 'in coda'; delete j.avviato; }

  // Al lettore i lavori arrivano con l'avanzamento della frase in corso, che sta nei registri del TTS.
  function conAvanzamento(elenco) {
    return elenco.map(j => {
      if (j.stato !== 'in generazione') return j;
      let progresso;
      try { progresso = audio.progresso?.(j); } catch { progresso = undefined; }
      return progresso ? { ...j, progresso } : j;
    });
  }

  function generazioneInCorso(n) {
    return lavori.some(j => j.capitolo === n && ['in coda', 'in generazione'].includes(j.stato));
  }

  function corrente(j) {
    try { return leggiCapitolo(root, j.capitolo).revisione === j.revisione; }
    catch (e) { if (e.status === 404 || e.code === 'ENOENT') return false; throw e; }
  }

  async function coda() {
    if (attivo || chiuso) return;
    attivo = true;
    try {
      let j;
      while (!chiuso && (j = lavori.find(x => x.stato === 'in coda'))) {
        try {
          if (!corrente(j)) { j.stato = 'superato'; continue; }
          j.stato = 'in generazione';
          j.avviato = new Date().toISOString();
          salva();
          const risultato = await audio.lavora(j);
          if (!corrente(j)) { j.stato = 'superato'; continue; }
          if (j.tipo !== 'prese') {
            await audio.pubblica(j);
            if (!corrente(j)) { j.stato = 'superato'; continue; }
          }
          Object.assign(j, risultato, { stato: 'pronto' });
        } catch (e) {
          j.stato = corrente(j) ? 'errore' : 'superato';
          if (j.stato === 'errore') j.errore = e.message;
        } finally {
          j.aggiornato = new Date().toISOString();
          salva();
        }
      }
    } finally {
      attivo = false;
    }
  }

  function avviaCoda() {
    setImmediate(() => coda().catch(e => console.error('Coda autore:', e)));
  }

  function aggiungi(dati, tipo, capitolo, extra, file = [], blocchiBozza = []) {
    const j = { id: randomUUID(), tipo, capitolo: dati.capitolo, nome: capitolo.nome, revisione: capitolo.revisione,
      stato: 'in coda', creato: new Date().toISOString(), ...extra };
    const scritti = [];
    const numeroLavori = lavori.length;
    let bozza;
    try {
      if (file.length) {
        j.revisione = createHash('sha256').update(file[0].dopo).digest('hex');
        if (blocchiBozza.length) bozza = { id: randomUUID(), tipo: 'bozza', capitolo: j.capitolo, nome: j.nome,
          revisione: j.revisione, creato: j.creato, blocchi: blocchiBozza, stato: 'bozza locale' };
        scrivi(transazione, JSON.stringify({ j, file, bozza }));
      }
      for (const f of file) { scrivi(f.file, f.dopo); scritti.push(f); }
      lavori.push(j);
      if (bozza) lavori.push(bozza);
      salva();
    } catch (e) {
      lavori.splice(numeroLavori);
      for (const f of scritti.reverse()) scrivi(f.file, f.prima);
      if (file.length) fs.rmSync(transazione, { force: true });
      throw e;
    }
    if (file.length) fs.rmSync(transazione, { force: true });
    avviaCoda();
    return j;
  }

  function verificaVersione(dati) {
    const c = leggiCapitolo(root, dati.capitolo);
    if (dati.revisione !== c.revisione) throw errore(409, 'Il capitolo è cambiato. Riapri il passaggio.');
    return c;
  }

  function trova(id, tipo) {
    const tipi = tipo === undefined ? undefined : [tipo].flat();
    const j = lavori.find(x => x.id === id && (!tipi || tipi.includes(x.tipo)));
    if (!j) throw errore(404, 'Lavoro non trovato.');
    return j;
  }

  function verificaAudio(n) {
    const ultimo = lavori.findLast(j => j.capitolo === n && ['modifica', 'stacco', 'scegli', 'rigenera'].includes(j.tipo));
    if (ultimo && ultimo.stato !== 'pronto') throw errore(409, 'Attendi l’aggiornamento dell’audio di questo capitolo.');
  }

  function ultimaBozza(n, revisione) {
    const ultima = lavori.findLast(j => j.capitolo === n && ['bozza', 'modifica'].includes(j.tipo));
    if (ultima?.tipo === 'bozza' && ultima.revisione === revisione) return ultima;
  }

  function riallineaBozza(bozza, inverso, fonte) {
    if (!bozza?.blocchi.length) return [];
    const c = analizzaCapitolo(fonte);
    const fine = inverso.ordine + soloParagrafi(inverso.prima).length;
    const scarto = soloParagrafi(inverso.dopo).length - soloParagrafi(inverso.prima).length;
    return bozza.blocchi.map(b => {
      let da = b.ordine, a = da + soloParagrafi(b.prima).length;
      if (da >= fine) { da += scarto; a += scarto; }
      else if (a > inverso.ordine && scarto) {
        if (da > inverso.ordine || a < fine) throw errore(409, 'La bozza locale tocca solo una parte del blocco. Ripristina prima quella bozza.');
        a += scarto;
      }
      return bloccoValido(c, c.passaggi[da].riga, c.passaggi[a - 1].riga, b.dopo.join('\n\n'));
    }).filter(b => b.prima.join('\n\n') !== b.dopo.join('\n\n'));
  }

  async function api(req, res, url) {
    const route = url.pathname.slice(prefisso.length);
    const get = req.method === 'GET' || req.method === 'HEAD';
    if (get && (['ui.js', 'ui.css'].includes(route) || /^ui[/][a-z-]+[.]mjs$/.test(route))) return serveFile(req, res, path.join(__dirname, route));
    const presa = /^prese\/([a-f\d-]{36})\/(\d{1,2})\.mp3$/.exec(route);
    if (get && presa) {
      const j = trova(presa[1], 'prese');
      if (j.stato !== 'pronto' || !j.prese?.includes(Number(presa[2]))) throw errore(404, 'Presa non trovata.');
      return serveFile(req, res, audio.filePresa(j, Number(presa[2])));
    }
    const cap = /^capitolo\/(\d{1,3})$/.exec(route);
    if (get && cap) {
      const n = Number(cap[1]);
      const { nome, revisione, passaggi } = leggiCapitolo(root, n);
      const bozza = ultimaBozza(n, revisione) || null;
      return json(res, 200, { capitolo: n, nome, revisione, passaggi, bozza, salvaSoloTesto: true,
        lavori: conAvanzamento(lavori.filter(j => j.capitolo === n)).reverse() });
    }
    if (get && route === 'lavori') {
      const n = url.searchParams.get('capitolo');
      if (n !== null) numero(Number(n));
      return json(res, 200, conAvanzamento(lavori.filter(j => n === null || j.capitolo === Number(n))).reverse());
    }
    if (get && route === 'selezione') return json(res, 200, selezione?.dati || null);
    if (req.method !== 'POST') throw errore(404, 'Comando non trovato.');
    if (req.headers.origin && req.headers.origin !== url.origin) throw errore(403, 'Origine diversa dal lettore.');
    if (req.headers['sec-fetch-site'] === 'cross-site') throw errore(403, 'Richiesta da un altro sito.');
    const d = await corpo(req);
    if (route === 'selezione') {
      if (typeof d.tab !== 'string' || !/^[a-f0-9-]{36}$/.test(d.tab) || !Number.isSafeInteger(d.seq) || d.seq < 1) throw errore(400, 'Selezione non valida.');
      if (d.seq <= (sequenzeSelezione.get(d.tab) || 0)) return json(res, 200, { ok: true });
      if (d.dati !== null) {
        const x = d.dati;
        if (!x || typeof x.testo !== 'string' || !Number.isInteger(x.da) || !Number.isInteger(x.a) || x.da < 0 || x.a < x.da || x.a > x.testo.length) {
          throw errore(400, 'Intervallo di selezione non valido.');
        }
        numero(x.capitolo);
        selezione = { tab: d.tab, dati: { ...x, testoSelezionato: x.testo.slice(x.da, x.a) } };
      } else if (selezione?.tab === d.tab) selezione = null;
      sequenzeSelezione.set(d.tab, d.seq);
      return json(res, 200, { ok: true });
    }
    if (route === 'bozza') {
      const c = verificaVersione(d);
      const precedente = ultimaBozza(d.capitolo, c.revisione);
      if ((d.bozza ?? null) !== (precedente?.id ?? null)) throw errore(409, 'La bozza è cambiata. Riapri il passaggio.');
      const nuovo = bloccoValido(c, d.riga, d.fine ?? d.riga, d.testo);
      const blocchi = [];
      for (const b of precedente?.blocchi || []) {
        if (b.fine < nuovo.riga || b.riga > nuovo.fine) blocchi.push(b);
        else if (b.riga < nuovo.riga || b.fine > nuovo.fine) throw errore(409, 'Includi per intero il blocco già in bozza.');
      }
      if (nuovo.prima.join('\n\n') !== nuovo.dopo.join('\n\n')) blocchi.push(nuovo);
      blocchi.sort((a, b) => a.ordine - b.ordine);
      return json(res, 202, aggiungi(d, 'bozza', c, { blocchi, stato: 'bozza locale' }));
    }
    if (route === 'applica-bozza') {
      const j = trova(d.id, 'bozza');
      const c = verificaVersione(j);
      if (ultimaBozza(j.capitolo, c.revisione) !== j || !j.blocchi.length) throw errore(409, 'La bozza è cambiata o è vuota.');
      const file = sostituisci(root, j.capitolo, c, j.blocchi);
      // Applicare la bozza vuol dire volerla sentire: l'audio si accoda subito, dietro a quello che c'è già.
      return json(res, 202, aggiungi(j, 'modifica', c, { blocchi: j.blocchi, stato: 'in coda' }, file));
    }
    if (route === 'ripristina') {
      const j = trova(d.id);
      if (j.tipo !== 'bozza' && j.tipo !== 'modifica') throw errore(400, 'Scegli una modifica del testo.');
      if (j.tipo === 'modifica' && generazioneInCorso(j.capitolo)) throw errore(409, 'Audio in generazione: attendi la fine prima di ripristinare il testo.');
      const c = verificaVersione(j);
      const bozza = ultimaBozza(j.capitolo, c.revisione);
      const corrente = j.tipo === 'bozza' ? bozza : lavori.findLast(x =>
        x.tipo === 'modifica' && x.capitolo === j.capitolo && x.revisione === c.revisione);
      if (corrente !== j) throw errore(409, 'Le modifiche sono cambiate. Riapri il pannello.');
      const blocchi = j.blocchi || [{ ordine: c.passaggi.findIndex(p => p.riga === j.riga), prima: [j.prima], dopo: [j.dopo] }];
      const b = Number.isInteger(d.indice) && blocchi[d.indice];
      if (!b) throw errore(400, 'Scegli il blocco da ripristinare.');
      const rimanenti = blocchi.filter((_, i) => i !== d.indice);
      if (j.tipo === 'bozza') return json(res, 202, aggiungi(j, 'bozza', c, { blocchi: rimanenti, stato: 'bozza locale' }));
      const scarto = blocchi.slice(0, d.indice).reduce((n, x) => n + soloParagrafi(x.dopo).length - soloParagrafi(x.prima).length, 0);
      const ordine = b.ordine + scarto;
      const dopoBlocco = soloParagrafi(b.dopo);
      const attuali = c.passaggi.slice(ordine, ordine + dopoBlocco.length);
      if (ordine < 0 || attuali.length !== dopoBlocco.length || attuali.some((p, i) => p.testo !== dopoBlocco[i])) {
        throw errore(409, 'Il blocco è cambiato. Riapri il pannello.');
      }
      const inverso = bloccoValido(c, attuali[0].riga, attuali.at(-1).riga, b.prima.join('\n\n'));
      const file = sostituisci(root, j.capitolo, c, [inverso]);
      const bozze = riallineaBozza(bozza, inverso, file[0].dopo);
      return json(res, 202, aggiungi(j, 'modifica', c, { blocchi: rimanenti, ripristinaDi: j.id, stato: 'audio da aggiornare' }, file, bozze));
    }
    if (route === 'modifica' || route === 'proposta') {
      const c = verificaVersione(d);
      const dopo = testoValido(d.testo);
      const prima = c.passaggi.find(p => p.riga === d.riga)?.testo;
      if (!prima) throw errore(400, 'Scegli un paragrafo del capitolo.');
      if (prima === dopo) throw errore(400, 'Il passaggio è già così.');
      if (route === 'proposta') return json(res, 201, aggiungi(d, 'proposta', c, { riga: d.riga, prima, dopo, stato: 'proposta' }));
      if (d.audio !== undefined && typeof d.audio !== 'boolean') throw errore(400, 'Indica se aggiornare anche l’audio.');
      const file = sostituisci(root, d.capitolo, c, [bloccoValido(c, d.riga, d.riga, dopo)]);
      const stato = d.audio === false ? 'audio da aggiornare' : 'in coda';
      return json(res, 202, aggiungi(d, 'modifica', c, { riga: d.riga, prima, dopo, stato }, file));
    }
    if (route === 'stacco') {
      const c = verificaVersione(d);
      const sposta = d.a !== undefined;
      if (!sposta && typeof d.stacco !== 'boolean') throw errore(400, 'Indica se mettere o togliere lo stacco.');
      if (d.audio !== undefined && typeof d.audio !== 'boolean') throw errore(400, 'Indica se aggiornare anche l’audio.');
      // Spostare lo stacco è toglierlo da dov'è e rimetterlo prima di un altro paragrafo, in un colpo solo.
      const cambi = sposta ? [{ riga: d.riga, stacco: false }, { riga: d.a, stacco: true }] : [{ riga: d.riga, stacco: d.stacco }];
      const file = cambiaStacco(root, d.capitolo, c, cambi);
      const stato = d.audio === false ? 'audio da aggiornare' : 'in coda';
      const extra = sposta ? { riga: d.a, da: d.riga, stacco: true, stato } : { riga: d.riga, stacco: d.stacco, stato };
      return json(res, 202, aggiungi(d, 'stacco', c, extra, file));
    }
    if (route === 'aggiorna-audio') {
      const j = trova(d.id, ['modifica', 'stacco']);
      verificaVersione(j);
      if (j.stato !== 'audio da aggiornare') throw errore(409, 'Questo aggiornamento audio è già stato richiesto.');
      j.stato = 'in coda';
      salva();
      avviaCoda();
      return json(res, 202, j);
    }
    if (route === 'prese' || route === 'rigenera') {
      const c = verificaVersione(d);
      verificaAudio(d.capitolo);
      if (!Number.isFinite(d.tempo) || d.tempo < 0) throw errore(400, 'Minuto di ascolto non valido.');
      if (d.testoLetto !== undefined && (typeof d.testoLetto !== 'string' || d.testoLetto.length > 4000)) throw errore(400, 'Frase selezionata non valida.');
      const n = d.numero ?? 3;
      if (!Number.isInteger(n) || n < 2 || n > 6) throw errore(400, 'Scegli da 2 a 6 prese.');
      const segmento = audio.segmento(d.capitolo, c.nome, d.tempo, d.testoLetto);
      return json(res, 202, aggiungi(d, route, c, { ...segmento, numero: n }));
    }
    if (route === 'scegli') {
      const j = trova(d.id, 'prese');
      if (j.stato !== 'pronto' || !j.prese?.includes(d.presa) || d.presa === 0) throw errore(400, 'Scegli una nuova presa pronta.');
      const c = verificaVersione(j);
      verificaAudio(j.capitolo);
      return json(res, 202, aggiungi(j, route, c, { gruppo: j.id, indice: j.indice, presa: d.presa, frase: j.frase }));
    }
    if (route === 'riprova') {
      const j = trova(d.id);
      if (j.stato !== 'errore') throw errore(400, 'Il lavoro non è in errore.');
      // Se intanto il capitolo è cambiato il lavoro non si può più rifare: finisce nello storico.
      if (!corrente(j)) {
        j.stato = 'superato';
        delete j.errore;
        salva();
        return json(res, 202, j);
      }
      j.stato = 'in coda';
      delete j.errore;
      salva();
      avviaCoda();
      return json(res, 202, j);
    }
    if (route === 'ignora') {
      const j = trova(d.id);
      if (j.stato !== 'errore') throw errore(400, 'Si mettono da parte solo i lavori in errore.');
      j.stato = 'superato';
      delete j.errore;
      salva();
      return json(res, 202, j);
    }
    if (route === 'pulisci') {
      // Toglie dallo storico i lavori chiusi e i file che si portavano dietro.
      const finiti = lavori.filter(j => j.capitolo === d.capitolo &&
        (['superato', 'errore'].includes(j.stato) || j.stato === 'pronto' && !corrente(j) ||
         j.tipo === 'bozza' && !j.blocchi?.length && ultimaBozza(j.capitolo, j.revisione) !== j));
      for (const j of finiti) {
        lavori.splice(lavori.indexOf(j), 1);
        for (const resto of [`${j.id}.log`, `${j.id}-prima.mp3`, `lettore-${j.id}`, path.join('prese', j.id)]) {
          fs.rmSync(path.join(dir, resto), { recursive: true, force: true });
        }
      }
      salva();
      return json(res, 202, { capitolo: d.capitolo, tolti: finiti.length });
    }
    throw errore(404, 'Comando non trovato.');
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host || '') ||
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw errore(403, 'Solo sul PC.');
      const url = new URL(`http://${req.headers.host}${req.url}`);
      if (url.pathname.startsWith(prefisso)) return await api(req, res, url);
      if (!['GET', 'HEAD'].includes(req.method)) throw errore(405, 'Metodo non supportato.');
      const cartella = path.join(root, 'docs');
      const nome = decodeURIComponent(url.pathname.replace(/\/$/, '/index.html'));
      const file = path.resolve(cartella, '.' + nome);
      if (!file.startsWith(cartella + path.sep)) throw errore(404, 'File non trovato.');
      // Nel pannello dell'autore l'elenco comprende anche i capitoli non ancora pubblici.
      if (nome === '/capitoli.json' && /(?:^|;\s*)autore=1(?:;|$)/.test(req.headers.cookie || '')) {
        const tutti = path.join(root, 'Audiolibro', 'capitoli-autore.json');
        if (fs.existsSync(tutti)) return serveFile(req, res, tutti);
      }
      return serveFile(req, res, file, file === path.join(cartella, 'index.html') && url.searchParams.get('write') === 'true');
    } catch (e) {
      if (res.headersSent) return res.destroy();
      if (!e.status) console.error(e);
      json(res, e.status || 500, { errore: e.message });
    }
  });
  server.once('listening', avviaCoda);
  server.once('close', () => { chiuso = true; });
  return server;
}

if (require.main === module) {
  const porta = Number(process.argv[2] || 8765);
  creaServer().listen(porta, '127.0.0.1', () => console.log(`Leggio autore: http://localhost:${porta}/?write=true`));
}

module.exports = { creaServer };
