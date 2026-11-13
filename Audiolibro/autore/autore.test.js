const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const { indiceVtt } = require('./audio');

test('la proiezione mostra le citazioni senza il marcatore Markdown', async () => {
  const { compatto, testoVisibile } = await import('./ui/testo.mjs');
  assert.equal(testoVisibile('> *Una citazione.*'), 'Una citazione.');
  assert.equal(compatto('> «Figli e figlie.»'), compatto('«Figli e figlie.»'));
  assert.equal(testoVisibile('Il segno > resta nel testo.'), 'Il segno > resta nel testo.');
});

test('il riepilogo autore è pronto solo dopo avere sia le modifiche sia il testo', async () => {
  const { statoCaricamentoAutore } = await import('./ui/testo.mjs');
  assert.equal(statoCaricamentoAutore(4, null, 'pronto'), 'caricamento');
  assert.equal(statoCaricamentoAutore(4, 4, 'caricamento'), 'caricamento');
  assert.equal(statoCaricamentoAutore(4, 3, 'pronto'), 'caricamento');
  assert.equal(statoCaricamentoAutore(4, null, 'pronto', 4), 'errore');
  assert.equal(statoCaricamentoAutore(4, 4, 'errore'), 'errore');
  assert.equal(statoCaricamentoAutore(4, 4, 'pronto'), 'pronto');
});

test('il testo in linea evidenzia solo i cambiamenti, anche se sono separati', async () => {
  const { differenze, riepilogoParole } = await import('./ui/testo.mjs');
  const prima = 'Un cavaliere stanco passò di corsa.';
  const dopo = 'Un soldato stanco passò piano.';
  const { aggiunte, rimosse } = differenze(prima, dopo);
  assert.deepEqual(aggiunte.map(([a, b]) => dopo.slice(a, b)), ['soldato', 'piano']);
  assert.deepEqual(rimosse.map(([a, b]) => prima.slice(a, b)), ['cavaliere', 'di corsa']);
  assert.deepEqual(differenze('Una,  frase.', 'Una frase.'), { aggiunte: [], rimosse: [[3, 4]], tagli: [4] });
  assert.deepEqual(riepilogoParole('Un cavaliere passò. Rimase fermo.', 'Un soldato passò. Rimase fermo.'), { piu: 1, meno: 1, audio: 3 });
  assert.deepEqual(riepilogoParole('Un cavaliere stanco passò. Rimase fermo.', 'Un cavaliere passò. Rimase fermo.'), { piu: 0, meno: 1, audio: 3 });
});

test('il diff colloca le rimozioni accanto alla sostituzione o al testo conservato', async () => {
  const { diffConRimozioni } = await import('./ui/testo.mjs');
  const sostituzione = diffConRimozioni('Il capitano parla.', 'Il soldato parla.');
  assert.deepEqual(sostituzione.rimozioni, [{ posizione: 3, testo: 'capitano', prima: '', dopo: ' ' }]);
  assert.deepEqual(diffConRimozioni('Una, frase.', 'Una frase.').rimozioni, [{ posizione: 3, testo: ',', prima: '', dopo: '' }]);
  assert.deepEqual(diffConRimozioni('Prima.\n\nPoi il capitano riparte.', 'Prima.\n\nPoi riparte.').rimozioni,
    [{ posizione: 12, testo: 'il capitano', prima: '', dopo: ' ' }]);
});

test('un estratto naviga al paragrafo della modifica anche quando il contesto parte prima', async () => {
  const { diffConRimozioni, puntoDiff } = await import('./ui/testo.mjs');
  const prima = 'Prima frase.\n\nIl capitano parla.';
  const dopo = 'Prima frase.\n\nIl soldato parla.';
  assert.deepEqual(puntoDiff(dopo, diffConRimozioni(prima, dopo), 0, dopo.length), { indice: 1, testo: 'Il soldato parla.', offset: 3 });
});

test('la prima anteprima limita anche le parole rimosse e consente di vedere il diff completo', async () => {
  const { anteprimaDiff, diffConRimozioni } = await import('./ui/testo.mjs');
  const dopo = 'In città il capitano attese in silenzio.';
  const diff = diffConRimozioni('In città ' + 'un lungo inciso ormai superato '.repeat(10) + 'il capitano attese in silenzio.', dopo);
  const breve = anteprimaDiff(dopo, diff, [0, dopo.length], 85);
  assert.equal(breve.tagliata, true);
  assert.equal(breve.diff.rimozioni.length, 1);
  assert.ok(breve.fine + breve.diff.rimozioni[0].testo.length <= 85);
  assert.ok(breve.diff.rimozioni[0].testo.endsWith('…'));
  assert.equal(diff.rimozioni[0].testo.includes('…'), false);
  assert.equal(anteprimaDiff(dopo, diffConRimozioni('In città il furiere attese in silenzio.', dopo), [0, dopo.length]).tagliata, false);
});

test('un minuto del lettore individua il blocco XTTS che lo contiene', () => {
  const vtt = 'WEBVTT\r\n\r\n00:00:00.000 --> 00:00:02.100\r\nPrima.\r\n\r\n00:00:02.100 --> 00:00:04.000\r\nSeconda.\r\n';
  assert.equal(indiceVtt(vtt, 2.1), 1);
  assert.equal(indiceVtt(vtt, 0), 0);
  assert.throws(() => indiceVtt(vtt, 5), /fuori/);
  const arrotondato = vtt.replaceAll('02.100', '02.103');
  assert.equal(indiceVtt(arrotondato, 2.1, 'Seconda.'), 1);
  assert.throws(() => indiceVtt(arrotondato, 2.1, 'Frase precedente diversa.'), /non coincide/);
});

test('Leggio e CLI condividono una coda che pubblica solo la revisione corrente', async t => {
  const { creaServer } = require('./server');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leggio-autore-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const copie = ['Romanzo', '.claude/worktrees/revisione-ia/Romanzo'];
  for (const copia of copie) {
    fs.mkdirSync(path.join(root, copia, 'capitoli'), { recursive: true });
    fs.writeFileSync(path.join(root, copia, 'capitoli/004-reks.md'), '## 4. Reks\r\n\r\nTesto prima.\r\n\r\nAltro.\r\n\r\nTesto prima.\r\n');
    fs.writeFileSync(path.join(root, copia, 'romanzo.md'), '# Libro\n\n## 4. Reks\n\nTesto prima.\n\nAltro.\n\nTesto prima.\n\n## 5. Dopo\n\nTesto prima.\n');
  }
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs/index.html'), '<body>Leggio</body>');
  let sblocca;
  const primo = new Promise(resolve => { sblocca = resolve; });
  let avvia;
  const avviato = new Promise(resolve => { avvia = resolve; });
  const pubblicati = [];
  const server = creaServer({ root, audio: {
    async lavora(lavoro) { if (lavoro.dopo === 'Prima modifica.') { avvia(); await primo; } },
    async pubblica(lavoro) { pubblicati.push(lavoro.dopo); },
  } });
  server.listen(0, '127.0.0.1');
  t.after(() => { server.close(); });
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const api = (p, body, origin) => fetch(url + '/__autore/' + p, body && {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin && { Origin: origin }) }, body: JSON.stringify(body),
  });
  const capitolo = async () => (await api('capitolo/4')).json();
  const modifica = (revisione, testo, origin) => api('modifica', { capitolo: 4, revisione, riga: 2, testo }, origin);
  assert.doesNotMatch(await (await fetch(url)).text(), /__autore/);
  assert.match(await (await fetch(url + '/?write=true')).text(), /__autore\/ui\.js/);
  const originale = await capitolo();
  assert.equal(originale.passaggi[0].testo, 'Testo prima.');
  const cli = async (...args) => JSON.parse((await promisify(execFile)(process.execPath, [path.join(__dirname, 'cli.js'), ...args], {
    env: { ...process.env, AUTORE_URL: url },
  })).stdout);
  const tab = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const dati = { capitolo: 4, riga: 2, fine: 4, revisione: originale.revisione, testo: 'Testo prima.\n\nAltro.', da: 6, a: 18 };
  assert.equal((await api('selezione', { tab, seq: 1, dati })).status, 200);
  assert.equal((await cli('selezione')).testoSelezionato, 'prima.\n\nAltr');
  assert.equal((await api('selezione', { tab, seq: 2, dati: null })).status, 200);
  await api('selezione', { tab, seq: 1, dati });
  assert.equal(await cli('selezione'), null);
  const proposta = await cli('proponi', '4', '2', originale.revisione, 'Alternativa dell’agente.');
  assert.equal((await capitolo()).passaggi[0].testo, 'Testo prima.');
  assert.equal((await cli('diff', '4'))[0].id, proposta.id);
  assert.equal((await modifica(originale.revisione, 'Prima modifica.', 'https://example.com')).status, 403);
  assert.equal((await modifica(originale.revisione, 'Prima modifica.')).status, 202);
  await avviato;
  assert.equal((await modifica(originale.revisione, 'Versione obsoleta.')).status, 409);
  assert.equal((await modifica((await capitolo()).revisione, 'Ultima modifica.')).status, 202);
  sblocca();
  const scadenza = Date.now() + 3000;
  let finale;
  do {
    finale = await capitolo();
    if (finale.lavori.some(j => j.stato === 'pronto')) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < scadenza);
  assert.deepEqual(pubblicati, ['Ultima modifica.']);
  assert.equal(finale.lavori.find(j => j.dopo === 'Prima modifica.').stato, 'superato');
  assert.equal((await cli('stato', '4')).find(j => j.id === proposta.id).stato, 'proposta');
  assert.equal(finale.passaggi[0].testo, 'Ultima modifica.');
  assert.match(fs.readFileSync(path.join(root, copie[0], 'capitoli/004-reks.md'), 'utf8'), /\r\nUltima modifica\.\r\n/);
  assert.match(fs.readFileSync(path.join(root, copie[0], 'romanzo.md'), 'utf8'), /## 4\. Reks\n\nUltima modifica\.\n\nAltro\.\n\nTesto prima\.\n\n## 5\. Dopo\n\nTesto prima\./);
  const copia = path.join(root, copie[1], 'capitoli/004-reks.md');
  const soloTesto = await api('modifica', { capitolo: 4, revisione: finale.revisione, riga: 2, testo: 'Correzione senza voce.', audio: false });
  assert.equal(soloTesto.status, 202);
  const j = await soloTesto.json();
  assert.equal(j.stato, 'audio da aggiornare');
  const senzaAudio = await capitolo();
  assert.equal(senzaAudio.passaggi[0].testo, 'Correzione senza voce.');
  assert.deepEqual(pubblicati, ['Ultima modifica.']);
  // Il romanzo.md non è una cortesia: se diverge, la correzione si ferma e non scrive da nessuna parte.
  const romanzo = path.join(root, copie[0], 'romanzo.md');
  const divergi = (file, da, a) => fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(da, a));
  divergi(romanzo, 'Correzione senza voce.', 'Divergenza.');
  assert.equal((await modifica(senzaAudio.revisione, 'Non sovrascrivere.')).status, 409);
  assert.equal((await capitolo()).passaggi[0].testo, 'Correzione senza voce.');
  divergi(romanzo, 'Divergenza.', 'Correzione senza voce.');
  assert.equal((await api('aggiorna-audio', { id: j.id })).status, 202);
  const attesa = Date.now() + 3000;
  while (!pubblicati.includes('Correzione senza voce.') && Date.now() < attesa) await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(pubblicati.filter(x => x !== undefined), ['Ultima modifica.', 'Correzione senza voce.']);
  const revisione = (await capitolo()).revisione;
  const bozza = await api('bozza', { capitolo: 4, revisione, riga: 4, fine: 6,
    testo: 'Secondo paragrafo.\n\nNuovo paragrafo.\n\nTerzo paragrafo.' });
  assert.equal(bozza.status, 202);
  const salvata = await bozza.json();
  assert.deepEqual((await capitolo()).passaggi.map(p => p.testo), ['Correzione senza voce.', 'Altro.', 'Testo prima.']);
  assert.equal((await cli('diff', '4'))[0].id, salvata.id);
  const salvaBlocco = () => api('applica-bozza', { id: salvata.id });
  divergi(romanzo, 'Testo prima.', 'Divergenza nel terzo.');
  assert.equal((await salvaBlocco()).status, 409);
  assert.equal((await capitolo()).passaggi[1].testo, 'Altro.');
  divergi(romanzo, 'Divergenza nel terzo.', 'Testo prima.');
  const blocco = await salvaBlocco();
  assert.equal(blocco.status, 202);
  // Applicare la bozza accoda l'audio da solo: non resta un secondo passo da fare a mano.
  const bloccoApplicato = await blocco.json();
  assert.equal(bloccoApplicato.stato, 'in coda');
  const statoBlocco = async () => (await capitolo()).lavori.find(j => j.id === bloccoApplicato.id)?.stato;
  const scadenzaBlocco = Date.now() + 3000;
  while (Date.now() < scadenzaBlocco && await statoBlocco() !== 'pronto') await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await statoBlocco(), 'pronto');
  assert.deepEqual((await capitolo()).passaggi.map(p => p.testo), ['Correzione senza voce.', 'Secondo paragrafo.', 'Nuovo paragrafo.', 'Terzo paragrafo.']);
  assert.match(fs.readFileSync(path.join(root, copie[0], 'capitoli/004-reks.md'), 'utf8'), /Secondo paragrafo\.\r\n\r\nNuovo paragrafo\.\r\n\r\nTerzo paragrafo\./);
  assert.deepEqual(pubblicati.filter(x => x !== undefined), ['Ultima modifica.', 'Correzione senza voce.']);
  const applicato = (await capitolo()).lavori.find(x => x.tipo === 'modifica' && x.blocchi?.length);
  const corrente = await capitolo();
  const primaBozza = await (await api('bozza', { capitolo: 4, revisione: corrente.revisione, riga: 4, testo: 'Bozza due.' })).json();
  const dueBozze = await (await api('bozza', { capitolo: 4, revisione: corrente.revisione, bozza: primaBozza.id, riga: 8, testo: 'Bozza tre.' })).json();
  const annullaUna = await api('ripristina', { id: dueBozze.id, indice: 0 });
  assert.equal(annullaUna.status, 202);
  assert.deepEqual((await capitolo()).bozza.blocchi.map(b => b.dopo[0]), ['Bozza tre.']);
  assert.equal((await api('ripristina', { id: applicato.id, indice: 0 })).status, 409);
  const rimanente = (await capitolo()).bozza;
  assert.equal((await api('ripristina', { id: rimanente.id, indice: 0 })).status, 202);
  const ripristino = await api('ripristina', { id: applicato.id, indice: 0 });
  assert.equal(ripristino.status, 202);
  assert.deepEqual((await capitolo()).passaggi.map(p => p.testo), ['Correzione senza voce.', 'Altro.', 'Testo prima.']);
  assert.deepEqual(pubblicati.filter(x => x !== undefined), ['Ultima modifica.', 'Correzione senza voce.']);
  const base = await capitolo();
  const b1 = await (await api('bozza', { capitolo: 4, revisione: base.revisione, riga: 4, testo: 'Prima parte.\n\nSeconda parte.' })).json();
  const b2 = await (await api('bozza', { capitolo: 4, revisione: base.revisione, bozza: b1.id, riga: 6, testo: 'Terza modifica.' })).json();
  const dueApplicati = await (await api('applica-bozza', { id: b2.id })).json();
  const nuova = await capitolo();
  await api('bozza', { capitolo: 4, revisione: nuova.revisione, riga: 8, testo: 'Terza bozza.' });
  const senzaPrimo = await api('ripristina', { id: dueApplicati.id, indice: 0 });
  assert.equal(senzaPrimo.status, 202);
  const uno = await capitolo();
  assert.deepEqual(uno.passaggi.map(p => p.testo), ['Correzione senza voce.', 'Altro.', 'Terza modifica.']);
  assert.deepEqual(uno.bozza.blocchi[0], { riga: 6, fine: 6, ordine: 2, prima: ['Terza modifica.'], dopo: ['Terza bozza.'] });
  const ultimo = await api('ripristina', { id: (await senzaPrimo.json()).id, indice: 0 });
  assert.equal(ultimo.status, 202);
  const due = await capitolo();
  assert.deepEqual(due.passaggi.map(p => p.testo), ['Correzione senza voce.', 'Altro.', 'Testo prima.']);
  assert.deepEqual(due.bozza.blocchi[0], { riga: 6, fine: 6, ordine: 2, prima: ['Testo prima.'], dopo: ['Terza bozza.'] });
  assert.deepEqual(pubblicati.filter(x => x !== undefined), ['Ultima modifica.', 'Correzione senza voce.']);
  // Il testo non esce dal romanzo: di tutto questo, nella copia del worktree non è arrivato niente.
  assert.equal(fs.readFileSync(copia, 'utf8'), '## 4. Reks\r\n\r\nTesto prima.\r\n\r\nAltro.\r\n\r\nTesto prima.\r\n');
  assert.equal(fs.readFileSync(path.join(root, copie[1], 'romanzo.md'), 'utf8'), '# Libro\n\n## 4. Reks\n\nTesto prima.\n\nAltro.\n\nTesto prima.\n\n## 5. Dopo\n\nTesto prima.\n');
});

test('un riavvio completa un salvataggio interrotto prima di accodare la voce', async t => {
  const { creaServer } = require('./server');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leggio-ripresa-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'Audiolibro/audio/autore');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(root, 'Romanzo/capitoli'), { recursive: true });
  const prima = '## 4. Reks\n\nPrima.\n';
  const dopo = '## 4. Reks\n\nDopo.\n';
  const file = ['Romanzo/capitoli/004-reks.md', 'Romanzo/romanzo.md'].map(f => ({ file: path.join(root, f), prima, dopo }));
  fs.writeFileSync(file[0].file, dopo);
  fs.writeFileSync(file[1].file, prima);
  const revisione = createHash('sha256').update(dopo).digest('hex');
  const j = { id: 'ripresa', tipo: 'modifica', capitolo: 4, revisione, stato: 'in coda' };
  fs.writeFileSync(path.join(dir, 'salvataggio.json'), JSON.stringify({ j, file }));
  let pubblicato;
  const pronto = new Promise(resolve => { pubblicato = resolve; });
  const server = creaServer({ root, audio: {
    async lavora() { assert.equal(fs.readFileSync(file[1].file, 'utf8'), dopo); },
    async pubblica(lavoro) { pubblicato(lavoro.id); },
  } });
  server.listen(0, '127.0.0.1');
  t.after(() => server.close());
  assert.equal(await pronto, 'ripresa');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fs.existsSync(path.join(dir, 'salvataggio.json')), false);
  const stato = JSON.parse(fs.readFileSync(path.join(dir, 'lavori.json'), 'utf8'));
  assert.deepEqual(stato.map(x => [x.id, x.stato]), [['ripresa', 'pronto']]);
});

test('durante la generazione il lettore vede l’avanzamento e non può ripristinare il testo', async t => {
  const { creaServer } = require('./server');
  const { creaAudio } = require('./audio');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leggio-generazione-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'Romanzo/capitoli'), { recursive: true });
  fs.mkdirSync(path.join(root, 'Audiolibro/audio'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Romanzo/capitoli/004-reks.md'), '## 4. Reks\n\nTesto prima.\n');
  fs.writeFileSync(path.join(root, 'Romanzo/romanzo.md'), '# Libro\n\n## 4. Reks\n\nTesto prima.\n');
  const registro = path.join(root, 'Audiolibro/audio/rifai-004.txt');
  let sblocca;
  const inCorso = new Promise(resolve => { sblocca = resolve; });
  let avvia;
  const avviato = new Promise(resolve => { avvia = resolve; });
  const vero = creaAudio(root);
  const server = creaServer({ root, audio: {
    progresso: vero.progresso,
    async lavora() { avvia(); await inCorso; },
    async pubblica() {},
  } });
  server.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/__autore/`;
  const api = (p, body) => fetch(url + p, body && {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const capitolo = async () => (await api('capitolo/4')).json();
  const prima = await capitolo();
  assert.equal((await api('modifica', { capitolo: 4, revisione: prima.revisione, riga: 2, testo: 'Testo dopo.' })).status, 202);
  await avviato;
  fs.writeFileSync(registro, 'avvio\n12.79%: : 22/172 13.37%: : 22/172  : Una frase.\n');
  const durante = await capitolo();
  const lavoro = durante.lavori.find(j => j.tipo === 'modifica');
  assert.equal(lavoro.stato, 'in generazione');
  assert.deepEqual({ fatte: lavoro.progresso.fatte, totali: lavoro.progresso.totali }, { fatte: 22, totali: 172 });
  const rifiuto = await api('ripristina', { id: lavoro.id, indice: 0 });
  assert.equal(rifiuto.status, 409);
  assert.match((await rifiuto.json()).errore, /generazione/);
  assert.equal((await capitolo()).passaggi[0].testo, 'Testo dopo.');
  sblocca();
  const scadenza = Date.now() + 3000;
  let finale;
  do {
    finale = await capitolo();
    if (finale.lavori.every(j => j.stato !== 'in generazione')) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < scadenza);
  assert.equal(finale.lavori.find(j => j.tipo === 'modifica').progresso, undefined);
  assert.equal((await api('ripristina', { id: lavoro.id, indice: 0 })).status, 202);
  assert.equal((await capitolo()).passaggi[0].testo, 'Testo prima.');
});

test('lo stacco di scena si sposta dal lettore e vale in tutte le copie', async t => {
  const { creaServer } = require('./server');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leggio-stacco-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const copie = ['Romanzo', '.claude/worktrees/revisione-ia/Romanzo'];
  for (const copia of copie) {
    fs.mkdirSync(path.join(root, copia, 'capitoli'), { recursive: true });
    fs.writeFileSync(path.join(root, copia, 'capitoli/004-reks.md'), '## 4. Reks\n\nPrimo.\n\n---\n\nSecondo.\n\nTerzo.\n');
    fs.writeFileSync(path.join(root, copia, 'romanzo.md'), '# Libro\n\n## 4. Reks\n\nPrimo.\n\n---\n\nSecondo.\n\nTerzo.\n\n## 5. Dopo\n\nAltro.\n');
  }
  const accodati = [];
  const server = creaServer({ root, audio: { async lavora(j) { accodati.push(j.tipo); }, async pubblica() {} } });
  server.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/__autore/`;
  const api = (p, body) => fetch(url + p, body && {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const capitolo = async () => (await api('capitolo/4')).json();
  const prima = await capitolo();
  assert.deepEqual(prima.passaggi.map(p => [p.testo, !!p.stacco]), [['Primo.', false], ['Secondo.', true], ['Terzo.', false]]);
  const riga = p => prima.passaggi.find(x => x.testo === p).riga;
  assert.equal((await api('stacco', { capitolo: 4, revisione: prima.revisione, riga: riga('Secondo.'), stacco: true })).status, 409);
  const tolto = await api('stacco', { capitolo: 4, revisione: prima.revisione, riga: riga('Secondo.'), stacco: false });
  assert.equal(tolto.status, 202);
  assert.equal((await tolto.json()).tipo, 'stacco');
  const senza = await capitolo();
  assert.deepEqual(senza.passaggi.map(p => [p.testo, !!p.stacco]), [['Primo.', false], ['Secondo.', false], ['Terzo.', false]]);
  const messo = await api('stacco', { capitolo: 4, revisione: senza.revisione, riga: senza.passaggi[2].riga, stacco: true });
  assert.equal(messo.status, 202);
  const dopo = await capitolo();
  assert.deepEqual(dopo.passaggi.map(p => [p.testo, !!p.stacco]), [['Primo.', false], ['Secondo.', false], ['Terzo.', true]]);
  assert.match(fs.readFileSync(path.join(root, copie[0], 'capitoli/004-reks.md'), 'utf8'), /Primo\.\n\nSecondo\.\n\n---\n\nTerzo\./);
  assert.match(fs.readFileSync(path.join(root, copie[0], 'romanzo.md'), 'utf8'), /Primo\.\n\nSecondo\.\n\n---\n\nTerzo\.\n\n## 5\. Dopo/);
  const spostato = await api('stacco', { capitolo: 4, revisione: dopo.revisione, riga: dopo.passaggi[2].riga, a: dopo.passaggi[1].riga });
  assert.equal(spostato.status, 202);
  const mosso = await capitolo();
  assert.deepEqual(mosso.passaggi.map(p => [p.testo, !!p.stacco]), [['Primo.', false], ['Secondo.', true], ['Terzo.', false]]);
  assert.match(fs.readFileSync(path.join(root, copie[0], 'capitoli/004-reks.md'), 'utf8'), /Primo\.\n\n---\n\nSecondo\.\n\nTerzo\./);
  // Nemmeno lo stacco esce dal romanzo: la copia nel worktree è rimasta com'era.
  assert.equal(fs.readFileSync(path.join(root, copie[1], 'capitoli/004-reks.md'), 'utf8'),
    '## 4. Reks\n\nPrimo.\n\n---\n\nSecondo.\n\nTerzo.\n');
  const scadenza = Date.now() + 3000;
  while (accodati.length < 3 && Date.now() < scadenza) await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(accodati, ['stacco', 'stacco', 'stacco']);
});

test('un lavoro in errore si mette da parte e lo storico si pulisce', async t => {
  const { creaServer } = require('./server');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leggio-pulisci-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'Romanzo', 'capitoli'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Romanzo', 'capitoli', '004-reks.md'), '## 4. Reks\n\nPrimo.\n\nSecondo.\n');
  fs.writeFileSync(path.join(root, 'Romanzo', 'romanzo.md'), '# Libro\n\n## 4. Reks\n\nPrimo.\n\nSecondo.\n');
  const server = creaServer({ root, audio: { async lavora() { throw new Error('XTTS fermo'); }, async pubblica() {} } });
  server.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/__autore/`;
  const api = (p, body) => fetch(url + p, body && {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const lavori = async () => (await api('lavori?capitolo=4')).json();
  const c = await (await api('capitolo/4')).json();
  const modifica = await (await api('modifica', { capitolo: 4, revisione: c.revisione, riga: c.passaggi[0].riga, testo: 'Primo cambiato.' })).json();
  const scadenza = Date.now() + 3000;
  let j;
  while (Date.now() < scadenza && (j = (await lavori()).find(x => x.id === modifica.id))?.stato !== 'errore') {
    await new Promise(r => setTimeout(r, 20));
  }
  assert.equal(j.stato, 'errore');
  assert.equal(j.errore, 'XTTS fermo');
  assert.equal((await api('ignora', { id: modifica.id })).status, 202);
  const messoDaParte = (await lavori()).find(x => x.id === modifica.id);
  assert.equal(messoDaParte.stato, 'superato');
  assert.equal(messoDaParte.errore, undefined);
  assert.equal((await (await api('pulisci', { capitolo: 4 })).json()).tolti, 1);
  assert.deepEqual(await lavori(), []);
  // Il testo già scritto nel capitolo resta dov'è: si pulisce lo storico, non il romanzo.
  assert.match(fs.readFileSync(path.join(root, 'Romanzo', 'capitoli', '004-reks.md'), 'utf8'), /Primo cambiato\./);
});

test('una correzione può attraversare lo stacco di scena, anche incollata', async t => {
  const { creaServer } = require('./server');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leggio-scene-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const testo = '## 4. Reks\n\nPrimo.\n\nSecondo.\n\n---\n\nTerzo.\n\nQuarto.\n';
  fs.mkdirSync(path.join(root, 'Romanzo', 'capitoli'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Romanzo', 'capitoli', '004-reks.md'), testo);
  fs.writeFileSync(path.join(root, 'Romanzo', 'romanzo.md'), '# Libro\n\n' + testo + '\n## 5. Dopo\n\nAltro.\n');
  const server = creaServer({ root, audio: { async lavora() {}, async pubblica() {} } });
  server.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/__autore/`;
  const api = (p, body) => fetch(url + p, body && {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const capitolo = async () => (await api('capitolo/4')).json();
  const capitoloFile = () => fs.readFileSync(path.join(root, 'Romanzo', 'capitoli', '004-reks.md'), 'utf8');
  const c = await capitolo();
  assert.deepEqual(c.passaggi.map(p => [p.testo, !!p.stacco]),
    [['Primo.', false], ['Secondo.', false], ['Terzo.', true], ['Quarto.', false]]);
  // Il pezzo incollato arriva con lo stacco scritto come capita negli appunti.
  const bozza = await api('bozza', { capitolo: 4, revisione: c.revisione, bozza: null,
    riga: c.passaggi[1].riga, fine: c.passaggi[2].riga, testo: 'Secondo nuovo.\n\n* * *\n\nTerzo nuovo.' });
  assert.equal(bozza.status, 202);
  const salvata = await bozza.json();
  assert.deepEqual(salvata.blocchi[0].prima, ['Secondo.', '---', 'Terzo.']);
  assert.deepEqual(salvata.blocchi[0].dopo, ['Secondo nuovo.', '---', 'Terzo nuovo.']);
  const modifica = await (await api('applica-bozza', { id: salvata.id })).json();
  assert.match(capitoloFile(), /Primo\.\n\nSecondo nuovo\.\n\n---\n\nTerzo nuovo\.\n\nQuarto\./);
  assert.match(fs.readFileSync(path.join(root, 'Romanzo', 'romanzo.md'), 'utf8'), /Secondo nuovo\.\n\n---\n\nTerzo nuovo\./);
  const dopo = await capitolo();
  assert.deepEqual(dopo.passaggi.map(p => [p.testo, !!p.stacco]),
    [['Primo.', false], ['Secondo nuovo.', false], ['Terzo nuovo.', true], ['Quarto.', false]]);
  // Tornando indietro lo stacco di scena resta al suo posto.
  assert.equal((await api('ripristina', { id: modifica.id, indice: 0 })).status, 202);
  assert.equal(capitoloFile(), testo);
});

test('i contatori contano il lavoro in sospeso, non la distanza dall’audio pubblicato', async () => {
  const { conteggiPendenti, paragrafiPendenti } = await import('./ui/pendenti.mjs');
  const dati = {
    lavori: [
      { tipo: 'modifica', stato: 'audio da aggiornare', riga: 8, prima: 'Il soldato tacque.', dopo: 'Il soldato non disse nulla.' },
      { tipo: 'modifica', stato: 'audio da aggiornare', riga: 8, prima: 'Il capitano tacque.', dopo: 'Il soldato tacque.' },
      { tipo: 'modifica', stato: 'pronto', riga: 20, prima: 'Vecchio passaggio già riletto.', dopo: 'Nuovo passaggio già riletto.' },
      { tipo: 'bozza', stato: 'bozza locale', blocchi: [{ riga: 40, prima: ['Non conta.'], dopo: ['Conta solo la bozza in cima.'] }] },
    ],
    bozza: { blocchi: [{ riga: 12, prima: ['Vaan corse.', '---', 'Reks lo seguì.'], dopo: ['Vaan corse via.', '---', 'Reks lo seguì.'] }] },
  };
  const conteggi = conteggiPendenti(dati);
  assert.deepEqual([...conteggi.keys()], [8, 12]);
  // Due correzioni sullo stesso paragrafo: la voce è ferma alla più vecchia, quindi si conta da quella.
  assert.deepEqual(conteggi.get(8), { piu: 4, meno: 2, audio: 5 });
  assert.deepEqual(conteggi.get(12), { piu: 1, meno: 0, audio: 3 });
  // Il budget dei paragrafi è una stima per eccesso: serve solo a riconoscere un audio di un'altra versione.
  assert.equal(paragrafiPendenti(dati), 4);
  assert.equal(conteggiPendenti({ lavori: [] }).size, 0);
  assert.equal(paragrafiPendenti(undefined), 0);
});

test('incollare un capitolo intero non porta dentro la riga del titolo', () => {
  const { analizzaCapitolo, bloccoValido, testoValido } = require('./archivio');
  const capitolo = analizzaCapitolo('## 6. La morte di un regno\n\nPrimo.\n\n---\n\nSecondo.\n');
  const tutto = (testo) => bloccoValido(capitolo, capitolo.passaggi[0].riga, capitolo.passaggi.at(-1).riga, testo).dopo;
  // Chi copia il capitolo da un editor si porta dietro il titolo: è già nel file, quindi si toglie da solo.
  assert.deepEqual(tutto('## 6. La morte di un regno\n\nNuovo primo.\n\n---\n\nNuovo secondo.'),
    ['Nuovo primo.', '---', 'Nuovo secondo.']);
  assert.deepEqual(tutto('Nuovo primo.\n\nNuovo secondo.'), ['Nuovo primo.', 'Nuovo secondo.']);
  // Un titolo in mezzo invece vuol dire due capitoli insieme, e lo si dice.
  assert.throws(() => tutto('Primo.\n\n## 7. Altro capitolo\n\nSecondo.'), /titolo del capitolo/);
  assert.throws(() => testoValido('## 7. Altro capitolo'), /titolo del capitolo/);
  assert.equal(testoValido('  Un paragrafo.  '), 'Un paragrafo.');
});

test('il prologo e i capitoli che aprono una Parte si correggono anche nel romanzo intero', t => {
  const { leggiCapitolo, sostituisci, bloccoValido, cambiaStacco } = require('./archivio');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leggio-parte-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'Romanzo', 'capitoli'), { recursive: true });
  const capitolo = '# Parte II. Le segrete\n\n*Epigrafe.*\n\n## 19. Il fazzoletto\n\nPrimo.\n\nSecondo.\n';
  fs.writeFileSync(path.join(root, 'Romanzo', 'capitoli', '019-il-fazzoletto.md'), capitolo);
  fs.writeFileSync(path.join(root, 'Romanzo', 'romanzo.md'), `# Libro\n\n## 18. Prima\n\nAltro.\n\n${capitolo}\n## 20. Dopo\n\nFine.\n`);
  // Nel file del capitolo l'epigrafe è il primo paragrafo; nel romanzo intero sta prima di «## 19.». Prima della
  // correzione la sezione cominciava dal titolo, i paragrafi non tornavano e tutto finiva in 409.
  const c = leggiCapitolo(root, 19);
  assert.deepEqual(c.passaggi.map(p => p.testo), ['*Epigrafe.*', 'Primo.', 'Secondo.']);
  for (const [i, testo] of [[0, '*Epigrafe nuova.*'], [2, 'Secondo, corretto.']]) {
    const [, romanzo] = sostituisci(root, 19, c, [bloccoValido(c, c.passaggi[i].riga, c.passaggi[i].riga, testo)]);
    assert.equal(romanzo.dopo, romanzo.prima.replace(c.passaggi[i].testo, testo));
  }
  const [file, romanzo] = cambiaStacco(root, 19, c, [{ riga: c.passaggi[2].riga, stacco: true }]);
  assert.match(file.dopo, /Primo\.\n\n---\n\nSecondo\.\n$/);
  assert.match(romanzo.dopo, /Altro\.\n\n# Parte II[^]*Primo\.\n\n---\n\nSecondo\.\n\n## 20\. Dopo/);
});

test('il ripristino trova il blocco che tiene quel paragrafo', async () => {
  const { bloccoDelPassaggio } = await import('./ui/pendenti.mjs');
  const bozza = { id: 'b1', blocchi: [{ riga: 30, fine: 32, prima: ['Vecchio.'], dopo: ['Nuovo.'] }] };
  const dati = {
    revisione: 'r7',
    bozza,
    passaggi: [{ riga: 8 }, { riga: 10 }, { riga: 30 }, { riga: 32 }],
    lavori: [
      { id: 'm1', tipo: 'modifica', stato: 'audio da aggiornare', revisione: 'r7', riga: 8 },
      { id: 'm2', tipo: 'modifica', stato: 'pronto', revisione: 'r7', riga: 10 },
      { id: 'm3', tipo: 'modifica', stato: 'audio da aggiornare', revisione: 'r6', riga: 12 },
      { id: 'm4', tipo: 'modifica', stato: 'audio da aggiornare', revisione: 'r7', riga: 14 },
      { id: 'm5', tipo: 'modifica', stato: 'audio da aggiornare', revisione: 'r7', riga: 16, ripristinaDi: 'm4' },
      { ...bozza, tipo: 'bozza', stato: 'bozza locale', revisione: 'r7' },
    ],
  };
  assert.equal(bloccoDelPassaggio(dati, 8).lavoro.id, 'm1');
  // Già letto dalla voce: non c'è più niente da disfare.
  assert.equal(bloccoDelPassaggio(dati, 10), undefined);
  // Di un'altra revisione del capitolo, e quindi di un altro testo.
  assert.equal(bloccoDelPassaggio(dati, 12), undefined);
  // Disfatto una volta non si disfa due.
  assert.equal(bloccoDelPassaggio(dati, 14), undefined);
  // Il blocco della bozza tiene tutti i paragrafi fra la riga e la fine.
  assert.deepEqual(bloccoDelPassaggio(dati, 32), { lavoro: dati.lavori[5], indice: 0 });
  assert.equal(bloccoDelPassaggio(dati, undefined), undefined);
});
