const fs = require('node:fs');

const base = new URL(process.env.AUTORE_URL || 'http://127.0.0.1:8765');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || base.protocol !== 'http:') throw new Error('La CLI richiede un server autore sul PC.');

async function api(route, dati) {
  const r = await fetch(new URL(`/__autore/${route}`, base), dati && {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati),
  });
  const risposta = await r.json();
  if (!r.ok) throw new Error(risposta.errore);
  return risposta;
}

const aiuto = `Uso: node Audiolibro/autore/cli.js <comando>
  capitolo N                           testo, revisione e righe modificabili
  stato [N]                            stato dei lavori e link alle prese pronte
  diff [N]                             prima e dopo delle modifiche e delle proposte
  selezione                            testo selezionato nell’editor attivo
  modifica N RIGA REVISIONE TESTO      salva e avvia l'audio in background
                                      con --solo-testo lascia l'audio da aggiornare
  aggiorna-audio ID                    accoda l'audio di una modifica salvata
  proponi N RIGA REVISIONE TESTO       mostra una proposta nel lettore
  rigenera N SECONDI                   rigenera il segmento al tempo indicato
  prese N SECONDI [QUANTE]             prepara più letture (2–6)
  prese --selezione [QUANTE]            prepara letture della frase associata alla selezione
  scegli ID PRESA                      applica una presa
  riprova ID                           rimette in coda un lavoro fallito

Per modifica e proponi, passa --file PERCORSO al posto di TESTO per leggere un file UTF-8.
SECONDI accetta anche MM:SS. I risultati dei comandi sono JSON.`;

function tempo(s) {
  if (!/^\d+(?::[0-5]\d)?(?:\.\d+)?$/.test(s || '')) throw new Error('Indica i secondi o MM:SS.');
  return s.split(':').reduce((n, x) => n * 60 + Number(x), 0);
}

async function esegui([comando, ...arg]) {
  const soloTesto = comando === 'modifica' && arg.at(-1) === '--solo-testo';
  if (soloTesto) arg.pop();
  const [a, b, c, d, e] = arg;
  const capitolo = Number(a);
  if (comando === 'selezione') return api('selezione');
  if (comando === 'capitolo') return api(`capitolo/${capitolo}`);
  if (comando === 'stato' || comando === 'diff') {
    const lavori = await api(a ? `lavori?capitolo=${capitolo}` : 'lavori');
    if (comando === 'diff') return lavori.filter(j => j.prima !== undefined || j.blocchi?.length);
    return lavori.map(j => j.prese ? { ...j, anteprime: j.prese.map(k => new URL(`/__autore/prese/${j.id}/${k}.mp3`, base).href) } : j);
  }
  if (comando === 'modifica' || comando === 'proponi') {
    const testo = d === '--file' ? fs.readFileSync(e, 'utf8').trim() : d;
    return api(comando === 'proponi' ? 'proposta' : comando, { capitolo, riga: Number(b), revisione: c, testo, ...(soloTesto && { audio: false }) });
  }
  if (comando === 'prese' || comando === 'rigenera') {
    if (a === '--selezione') {
      const s = await api('selezione');
      if (!Number.isFinite(s?.riferimento?.tempo)) throw new Error('La selezione non è associata a una frase dell’audio precedente.');
      return api(comando, { capitolo: s.capitolo, revisione: s.revisione, ...s.riferimento, ...(b && { numero: Number(b) }) });
    }
    const t = tempo(b);
    const { revisione } = await api(`capitolo/${capitolo}`);
    return api(comando, { capitolo, revisione, tempo: t, ...(c && { numero: Number(c) }) });
  }
  if (comando === 'scegli') return api('scegli', { id: a, presa: Number(b) });
  if (comando === 'riprova' || comando === 'aggiorna-audio') return api(comando, { id: a });
  throw new Error(aiuto);
}

const args = process.argv.slice(2);
if (!args.length || ['--help', '--aiuto'].includes(args[0])) console.log(aiuto);
else esegui(args).then(r => console.log(JSON.stringify(r, null, 2)), e => {
  console.error(e.cause?.code === 'ECONNREFUSED' ? 'Avvia Leggio autore sul PC.' : e.message);
  process.exitCode = 1;
});
