// Le schede dei lavori nel pannello: diff, ripristini, prese audio, stato della generazione.
import { api, apiBase, bottone, bottoneIcona, el, matita, pagina, tooltipSu, voce } from './base.mjs';
import { allineaParagrafi, compatto, dataBreve, soloParagrafi, unisci } from './testo.mjs';
import { cap, paragrafi, passaggioDi } from './stato.mjs';
import { aggiorna, azione, dati } from './dati.mjs';
import { elenco, stato } from './pannello.mjs';
import { audioDelPassaggio, bozzaAperta, chiudiEditor, inLinea, modificaInLinea, scegliPassaggio,
  setRiferimento } from './editor.mjs';
import { apriTesto, confrontoModifiche, paragrafoDelDiff, selezionaNelTesto, vaiAllaModifica } from './diff-testo.mjs';

let sigla;

export function bloccoConAzioni(anteprima, j, indice, dopo, righe, offset = 0, paragrafiBlocco = 1) {
  const locale = j.tipo === 'bozza';
  const blocco = el('div', 'autore-blocco-diff');
  const comandi = el('div', 'autore-azioni-blocco');
  const richiesta = el('div', 'autore-ripristino');
  richiesta.hidden = true;
  const insieme = paragrafiBlocco > 1 ? ' Riguarda tutti i paragrafi del blocco.' : '';
  const domanda = el('span', '', (locale ? 'Scartare questo blocco della bozza?' : 'Ripristinare il testo precedente di questo blocco?') + insieme);
  const modifica = bottoneIcona('Modifica', matita(), () => {
    if (bozzaAperta()) return;
    if (inLinea.isConnected) chiudiEditor();
    const tutti = paragrafi();
    const nodi = dopo.map((t, i) => paragrafoDelDiff(t, righe[i], locale ? offset + i : 0));
    const da = tutti.indexOf(nodi[0]);
    const a = tutti.indexOf(nodi.at(-1));
    if (da < 0 || a < da || nodi.some(p => !p)) { stato.textContent = 'Il blocco non è disponibile nel testo corrente.'; return; }
    apriTesto();
    const riga = passaggioDi(tutti[da])?.riga;
    setRiferimento(audioDelPassaggio(riga));
    scegliPassaggio(riga);
    modificaInLinea('', undefined, { da, a });
  });
  const ripristina = bottoneIcona('Ripristina', icona('i-ripristina'), () => {
    if (bozzaAperta() || ripristina.disabled) return;
    richiesta.hidden = false;
    comandi.hidden = true;
    annulla.focus();
  }, false, () => ripristina.disabled ? 'Audio in generazione: attendi la fine' : 'Ripristina');
  ripristina.classList.add('autore-ripristina-blocco');
  ripristina.dataset.tipo = j.tipo;
  const conferma = bottone('Conferma', async () => {
    conferma.disabled = annulla.disabled = true;
    try {
      await api('ripristina', { id: j.id, indice });
      if (cap() !== j.capitolo) return;
      await aggiorna(j.capitolo);
      stato.textContent = locale ? 'Blocco rimosso dalla bozza.' : 'Testo del blocco ripristinato.';
    } catch (e) {
      domanda.textContent = e.message;
      conferma.disabled = annulla.disabled = false;
    }
  });
  const annulla = bottone('Annulla', () => {
    richiesta.hidden = true;
    comandi.hidden = false;
    ripristina.focus();
  });
  conferma.className = 'autore-ripristina';
  richiesta.append(domanda, conferma, annulla);
  comandi.append(modifica, ripristina);
  blocco.append(anteprima, comandi, richiesta);
  return blocco;
}
const nomiLavoro = { bozza: 'Testo', modifica: 'Testo', stacco: 'Stacco di scena', prese: 'Prese audio', rigenera: 'Nuova lettura', scegli: 'Presa scelta', proposta: 'Proposta di testo' };
// Le frasi valgono fino al 90%: il montaggio che segue non ha avanzamento, quindi sale da solo verso il 99%.
const montaggioDa = new Map();
export function percentuale(j) {
  const p = j.stato === 'in generazione' ? j.progresso : undefined;
  if (!p?.totali) { montaggioDa.delete(j.id); return undefined; }
  if (!p.fase) {
    montaggioDa.delete(j.id);
    return Math.min(90, Math.round(p.fatte / p.totali * 90));
  }
  if (!montaggioDa.has(j.id)) montaggioDa.set(j.id, Date.now());
  const secondi = (Date.now() - montaggioDa.get(j.id)) / 1000;
  return Math.min(99, Math.round(90 + 9 * (1 - Math.exp(-secondi / 60))));
}

export function etichettaLavoro(j) {
  const valido = j.revisione === dati?.revisione;
  const stato = !valido && ['prese', 'proposta'].includes(j.tipo) ? 'superato' : j.stato;
  const percento = percentuale(j);
  const avanzamento = percento === undefined ? '' : ` ${percento}%`;
  const data = dataBreve(j.aggiornato || j.creato);
  return `${nomiLavoro[j.tipo]} · ${stato}${avanzamento}${data ? ' · ' + data : ''}`;
}

// L'MP3 nuovo prende il posto del vecchio mentre il lettore lo sta ancora leggendo: il server chiude il flusso
// aperto su quel file e qui l'audio si ferma. Invece di tenerlo staccato per tutta la generazione, lo si
// riattacca subito dov'era: lo stacco dura un istante.
let ripresa = 0;
export function riprendiAudio() {
  const a = document.querySelector('audio');
  const src = a?.getAttribute('src');
  // Se cade di continuo il file non c'è più o è rotto: si lascia stare, l'errore lo deve vedere il lettore.
  if (!src || Date.now() - ripresa < 2000) return;
  ripresa = Date.now();
  const punto = a.currentTime;
  const andava = !a.paused;
  a.load();
  a.addEventListener('loadedmetadata', () => {
    if (punto && !a.currentTime) a.currentTime = punto;
    if (andava) a.play().catch(() => {});
  }, { once: true });
}
// Stato della generazione del capitolo aperto: serve al contatore in testata e al pannello.
export function generazione() {
  const elencoLavori = dati?.lavori || [];
  const inCorso = elencoLavori.find(j => j.stato === 'in generazione');
  const inCoda = elencoLavori.filter(j => j.stato === 'in coda').length;
  if (!inCorso && !inCoda) return null;
  const percento = inCorso ? percentuale(inCorso) : undefined;
  const testoBase = inCorso
    ? `audio in corso${percento === undefined ? '' : ` · ${percento}%`}`
    : 'audio in coda';
  return { inCorso, inCoda, testo: inCoda ? `${testoBase} · ${inCoda} in coda` : testoBase };
}

// Le righe di stato e i comandi cambiano a ogni lettura, senza ridisegnare i diff.
export function aggiornaStatiLavori() {
  const g = generazione();
  for (const nodo of elenco.querySelectorAll('[data-lavoro]')) {
    const j = dati?.lavori.find(x => x.id === nodo.dataset.lavoro);
    if (!j) continue;
    const testo = etichettaLavoro(j);
    if (nodo.textContent !== testo) nodo.textContent = testo;
  }
  for (const b of elenco.querySelectorAll('.autore-ripristina-blocco')) {
    const bloccato = !!g?.inCorso && b.dataset.tipo === 'modifica';
    if (b.disabled !== bloccato) {
      b.disabled = bloccato;
      b.setAttribute('aria-label', bloccato ? 'Ripristina, non disponibile durante la generazione' : 'Ripristina');
    }
  }
}
const ordineDiRiga = r => {
  const i = dati.passaggi.findIndex(p => p.riga === r);
  return i < 0 ? Infinity : i;
};
export function cartaTesto(j, valido, prima, dopo, righe, indice, offset, paragrafiBlocco, extra) {
  const carta = el('section', 'autore-voce');
  const intestazione = el('p', 'autore-riga-stato');
  intestazione.dataset.lavoro = j.id;
  intestazione.textContent = etichettaLavoro(j);
  const anteprima = confrontoModifiche(unisci(prima), unisci(dopo),
    p => vaiAllaModifica(p, valido ? righe[p.indice] : undefined, j.tipo === 'bozza' ? offset + p.indice : 0));
  carta.append(intestazione, indice === undefined ? anteprima
    : bloccoConAzioni(anteprima, j, indice, dopo, righe, offset, paragrafiBlocco));
  if (extra) carta.append(extra);
  return carta;
}
// Le segnalazioni di Whisper si mostrano una volta sola per lavoro, sul primo blocco.
export function avvisiLavoro(j, visti) {
  if (!j.segnalazioni?.length || visti.has(j.id)) return null;
  visti.add(j.id);
  const avvisi = el('ul', 'autore-segnalazioni');
  for (const p of j.segnalazioni) avvisi.append(el('li', '', `${p.tempo} · ${p.audio || p.testo}`));
  return avvisi;
}

// Di un lavoro andato male si può riprendere il testo e rimetterlo a mano dove va,
// se il paragrafo di partenza è ancora quello di prima.
export function testoDelLavoro(j) {
  const blocchi = j.blocchi?.length ? j.blocchi : j.prima && j.dopo ? [{ prima: [j.prima], dopo: [j.dopo] }] : [];
  for (const b of blocchi) {
    const p = dati?.passaggi.find(x => compatto(x.testo) === compatto(b.prima[0]));
    if (p) return { riga: p.riga, testo: unisci(b.dopo) };
  }
  return undefined;
}
// Le divergenze che Whisper ha sentito nell'audio attuale: si riascoltano dal punto e si mettono da parte
// quelle che vanno bene. Le messe da parte restano in fondo, si possono riprendere.
let controlloAperto = false, ignoratiAperti = false;
// Testo e sentito parola per parola: in ognuno si segna quello che nell'altro non c'è.
// Il confronto ignora accenti, maiuscole e punteggiatura, come il controllo.
function diffPunto(scritto, sentito) {
  const chiave = w => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const A = scritto.split(/\s+/).filter(Boolean), B = sentito.split(/\s+/).filter(Boolean);
  const a = A.map(chiave), b = B.map(chiave);
  const L = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let x = a.length - 1; x >= 0; x--) for (let y = b.length - 1; y >= 0; y--)
    L[x][y] = a[x] && a[x] === b[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
  const uguali = [new Set(), new Set()];
  for (let x = 0, y = 0; x < a.length && y < b.length;) {
    if (a[x] && a[x] === b[y]) { uguali[0].add(x++); uguali[1].add(y++); }
    else if (L[x + 1][y] >= L[x][y + 1]) x++;
    else y++;
  }
  const riga = (etichetta, parole, visti, classe) => {
    const r = el('span', 'autore-diff-punto');
    r.append(`${etichetta} `);
    // Le parole diverse vicine si segnano insieme, in un pezzo solo.
    let pezzo;
    parole.forEach((w, i) => {
      if (visti.has(i)) { r.append(i ? ' ' : '', w); pezzo = null; return; }
      if (pezzo) { pezzo.append(' ' + w); return; }
      if (i) r.append(' ');
      pezzo = el(classe, '', w);
      r.append(pezzo);
    });
    return r;
  };
  const diverse = a.filter((k, i) => k && !uguali[0].has(i));
  return [riga('Testo:', A, uguali[0], 'del'), riga('Sentito:', B, uguali[1], 'mark'), diverse];
}
// Come un clic su una frase del lettore: la voce riparte da lì e il testo la segue, anche se lo si era
// scorso a mano (seguiVoce, cue e segnaCue sono del lettore).
function ascoltaDa(t) {
  if (typeof apriPagina === 'function' && pagina?.classList.contains('nascosto')) apriPagina();
  voce.currentTime = t;
  voce.play().catch(() => {});
  if (typeof seguiVoce !== 'undefined') {
    seguiVoce = true;
    document.getElementById('segui')?.classList.add('nascosto');
  }
  if (typeof segnaCue === 'function' && typeof cue !== 'undefined') {
    segnaCue(t);
    cue[cueOra]?.el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
}
// Solo il testo: porta al punto e lo fa lampeggiare, la voce resta dov'è e non parte. Il lettore smette di
// seguire la voce, come quando si scorre a mano.
// Whisper fa cominciare una parola dentro la pausa che la precede, quindi il tempo può cadere nella frase
// prima: fra le frasi vicine vince quella che contiene le parole del testo segnate come diverse.
function mostraPunto(t, diverse = []) {
  if (typeof cue === 'undefined' || !cue.length) return;
  let i = cue.findIndex(c => c.t > t) - 1;
  if (i < -1) i = cue.length - 1;
  i = Math.max(0, i);
  if (diverse.length) {
    const chiave = w => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const quante = c => { const k = new Set((c?.testo || '').split(/[\s'’-]+/).map(chiave)); return diverse.filter(w => k.has(w)).length; };
    for (const j of [i + 1, i + 2]) if (quante(cue[j]) > quante(cue[i])) i = j;
  }
  const frase = cue[i]?.el;
  if (!frase) return;
  portaA(frase);
  frase.classList.add('autore-destinazione');
  setTimeout(() => frase.classList.remove('autore-destinazione'), 1800);
}
function schedaControllo(punti) {
  const box = el('details', 'autore-storico autore-controllo-voce');
  box.open = controlloAperto;
  box.addEventListener('toggle', () => { controlloAperto = box.open; });
  const attivi = punti.filter(p => !p.ignorato), via = punti.filter(p => p.ignorato);
  box.append(el('summary', '', attivi.length === 1 ? '1 punto da ascoltare (Whisper)'
    : `${attivi.length} punti da ascoltare (Whisper)`));
  const nomiTipo = { 'in più': 'detto in più', saltato: 'saltato', diverso: 'diverso' };
  const riga = p => {
    const r = el('div', 'autore-punto-voce');
    const ascolta = bottone(`▶ ${p.tempo}`, () => ascoltaDa(Math.max(0, p.secondi - 1.5)));
    ascolta.className = 'autore-ascolta-punto';
    tooltipSu(ascolta, 'Ascolta da poco prima di questo punto');
    const vai = bottone('Vai', () => mostraPunto(p.secondi, diverse));
    vai.className = 'autore-ascolta-punto';
    tooltipSu(vai, 'Mostra il punto nel testo, senza far partire la voce');
    const tempi = el('div', 'autore-comandi-punto');
    tempi.append(ascolta, vai);
    const testo = el('div', 'autore-testo-punto');
    const [scritto, sentito, diverse] = diffPunto(p.testo, p.audio);
    testo.append(el('span', 'autore-tipo-punto', nomiTipo[p.tipo] || p.tipo), scritto, sentito);
    const metti = bottone(p.ignorato ? 'Riprendi' : 'Ignora', async () => {
      metti.disabled = true;
      try {
        await api('controllo', { capitolo: dati.capitolo, chiave: p.chiave, ignora: !p.ignorato });
        await aggiorna(dati.capitolo);
      } catch (e) { stato.textContent = e.message; metti.disabled = false; }
    });
    metti.className = 'autore-ignora-punto';
    const comandi = el('div', 'autore-comandi-punto');
    if (!p.ignorato) {
      const prese = bottone('Prese', () => azione('prese', { capitolo: dati.capitolo, revisione: dati.revisione, tempo: p.secondi, numero: 3 }));
      prese.className = 'autore-ignora-punto';
      tooltipSu(prese, 'Rifai la frase in tre prese da ascoltare e scegliere');
      comandi.append(prese);
    }
    comandi.append(metti);
    r.append(tempi, testo, comandi);
    return r;
  };
  if (!attivi.length) box.append(el('p', 'autore-didascalia', 'Nessun punto da ascoltare.'));
  for (const p of attivi) box.append(riga(p));
  if (via.length) {
    const sotto = el('details', 'autore-ignorati');
    sotto.open = ignoratiAperti;
    sotto.addEventListener('toggle', () => { ignoratiAperti = sotto.open; });
    sotto.append(el('summary', '', via.length === 1 ? '1 ignorato' : `${via.length} ignorati`));
    for (const p of via) sotto.append(riga(p));
    box.append(sotto);
  }
  return box;
}

// Sopra le prese: la frase nel testo e un volume solo per tutte (ricordato su questo dispositivo).
let volumePrese = 1;
try { volumePrese = Math.min(1, Math.max(0, Number(localStorage.getItem('autore-volume-prese') ?? 1))); } catch {}
// Apre il testo se è chiuso e porta lì il nodo. Appena aperta, la pagina si sistema da sola sulla voce:
// si aspetta un attimo, altrimenti lo scorrimento si perde.
function portaA(nodo) {
  const chiuso = typeof apriPagina === 'function' && pagina?.classList.contains('nascosto');
  if (chiuso) apriPagina();
  if (typeof staccaSegui === 'function') staccaSegui();
  // A pagina appena aperta lo scorrimento animato si perde: si va subito, senza animazione.
  const animato = !chiuso && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vai = () => nodo.scrollIntoView({ block: 'center', behavior: animato ? 'smooth' : 'instant' });
  if (chiuso) setTimeout(vai, 150); else vai();
}
// Il pezzo delle prese è una frase della sessione audio, che nel lettore può essere spezzata in più frasi:
// si parte da quella al tempo delle prese e si allarga alle vicine che stanno nello stesso testo.
function selezionaFrase(t, testo) {
  if (typeof cue === 'undefined' || !cue.length) { stato.textContent = 'La frase non è nel testo aperto.'; return; }
  const chiave = x => (x || '').replace(/\[[^\]]*\]/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const pezzo = chiave(testo);
  const dentro = i => cue[i] && chiave(cue[i].testo) && pezzo.includes(chiave(cue[i].testo));
  let i = Math.max(0, cue.findIndex(c => c.t > t + 0.05) - 1);
  if (i < 0 || cue.findIndex(c => c.t > t + 0.05) < 0) i = cue.length - 1;
  if (!dentro(i)) for (const j of [i + 1, i - 1]) if (dentro(j)) { i = j; break; }
  let da = i, a = i;
  while (dentro(da - 1)) da--;
  while (dentro(a + 1)) a++;
  portaA(cue[da].el);
  const range = document.createRange();
  range.setStartBefore(cue[da].el);
  range.setEndAfter(cue[a].el);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
function comandiPrese(j, valido) {
  const riga = el('div', 'autore-comandi-prese');
  if (valido) {
    const seleziona = bottone('Seleziona nel testo', () => selezionaFrase(j.tempo, j.frase));
    tooltipSu(seleziona, 'Seleziona nel testo la frase di queste prese');
    riga.append(seleziona);
  }
  const volume = el('label', 'autore-volume-prese');
  const cursore = el('input');
  cursore.type = 'range';
  cursore.min = '0';
  cursore.max = '1';
  cursore.step = '0.05';
  cursore.value = String(volumePrese);
  cursore.setAttribute('aria-label', 'Volume delle prese');
  cursore.addEventListener('input', () => {
    volumePrese = Number(cursore.value);
    for (const a of elenco.querySelectorAll('.autore-presa audio')) a.volume = volumePrese;
    try { localStorage.setItem('autore-volume-prese', String(volumePrese)); } catch {}
  });
  volume.append(el('span', '', '🔊'), cursore);
  riga.append(volume);
  return riga;
}

// Una presa per riga: play, nome con barra e tempi, «Usa» a destra. Il lettore nativo occupava tre righe a presa.
const durataBreve = t => Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '–:––';
function rigaPresa(j, k, valido) {
  const r = el('div', 'autore-presa');
  const etichetta = k === 0 ? 'Lettura attuale' : `Presa ${k}`;
  const sample = el('audio');
  sample.preload = 'metadata';
  sample.volume = volumePrese;
  sample.src = `${apiBase}prese/${j.id}/${k}.mp3`;
  const play = bottone('▶', () => {
    if (!sample.paused) return sample.pause();
    voce.pause();
    for (const altro of elenco.querySelectorAll('audio')) if (altro !== sample) altro.pause();
    if (sample.ended) sample.currentTime = 0;
    sample.play().catch(e => { stato.textContent = e.message; });
  });
  play.className = 'autore-play-presa';
  play.setAttribute('aria-label', `Ascolta: ${etichetta}`);
  const centro = el('div', 'autore-centro-presa');
  const testa = el('div', 'autore-testa-presa');
  const tempo = el('span', 'autore-tempo-presa', '–:––');
  testa.append(el('span', k === 0 ? 'autore-nome-presa autore-attuale' : 'autore-nome-presa', etichetta), tempo);
  const barra = el('div', 'autore-barra-presa');
  const riempi = el('span');
  barra.append(riempi);
  barra.setAttribute('role', 'slider');
  barra.setAttribute('aria-label', `Posizione in ${etichetta}`);
  // Clic o trascinamento, anche col dito: con la cattura del puntatore la barra segue il movimento anche fuori
  // dalla riga e il punto vale dove si lascia.
  const porta = e => {
    if (!Number.isFinite(sample.duration)) return;
    const box = barra.getBoundingClientRect();
    sample.currentTime = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * sample.duration;
    disegna();
  };
  barra.addEventListener('pointerdown', e => {
    barra.setPointerCapture(e.pointerId);
    porta(e);
  });
  barra.addEventListener('pointermove', e => { if (barra.hasPointerCapture(e.pointerId)) porta(e); });
  barra.addEventListener('pointerup', e => { if (barra.hasPointerCapture(e.pointerId)) { porta(e); barra.releasePointerCapture(e.pointerId); } });
  centro.append(testa, barra);
  const disegna = () => {
    const d = sample.duration, t = sample.currentTime || 0;
    tempo.textContent = sample.paused && !t ? durataBreve(d) : `${durataBreve(t)} / ${durataBreve(d)}`;
    riempi.style.width = Number.isFinite(d) && d ? `${(t / d) * 100}%` : '0';
    play.textContent = sample.paused ? '▶' : '❚❚';
    r.classList.toggle('autore-in-ascolto', !sample.paused);
  };
  for (const ev of ['loadedmetadata', 'timeupdate', 'play', 'pause', 'ended']) sample.addEventListener(ev, disegna);
  r.append(play, centro, sample);
  if (k && valido) {
    const usa = bottone('Usa', () => azione('scegli', { id: j.id, presa: k }));
    usa.className = 'autore-primario autore-usa-presa';
    usa.setAttribute('aria-label', `Usa presa ${k}`);
    r.append(usa);
  }
  return r;
}

export function disegnaLavori() {
  const firma = JSON.stringify([dati.revisione, dati.controllo, dati.lavori.map(j => ({ ...j, progresso: undefined }))]);
  if (firma === sigla) return false;
  sigla = firma;
  elenco.replaceChildren();
  const attuale = dati.lavori.find(j => j.tipo === 'modifica' && j.revisione === dati.revisione);
  const ripristinati = new Set(dati.lavori.map(j => j.ripristinaDi));
  const scelte = new Set(dati.lavori.filter(j => j.tipo === 'scegli' && !['errore', 'superato'].includes(j.stato)).map(j => j.gruppo));
  const voci = [];
  const inLavorazione = [];
  const storico = [];
  const segnalati = new Set();
  for (const j of dati.lavori) {
    if (j.tipo === 'bozza' && (j.id !== dati.bozza?.id || !j.blocchi.length)) continue;
    if (ripristinati.has(j.id) || j.ripristinaDi && !j.blocchi.length) continue;
    if (['rigenera', 'scegli'].includes(j.tipo) && j.stato === 'pronto') continue;
    // Prese di cui si è già usata una: la scelta ha la sua scheda, le prese non servono più.
    if (j.tipo === 'prese' && scelte.has(j.id)) continue;
    const valido = j.revisione === dati.revisione;
    const azionabile = j.tipo === 'bozza' || j === attuale;
    const testuale = ['bozza', 'modifica', 'stacco'].includes(j.tipo) && !j.errore;
    // Le modifiche già nel testo che aspettano l'audio stanno tutte in una riga sola, senza diff.
    if (testuale && ['in coda', 'in generazione'].includes(j.stato)) { inLavorazione.push(j); continue; }
    // Superate o già pubblicate: il diff è storia e l'audio è quello. Quando è fatto è fatto, anche se il
    // controllo della voce aveva segnalato qualcosa: quelle righe restano nei controlli del capitolo.
    if (testuale && (j.stato === 'superato' || j.stato === 'pronto')) { storico.push(j); continue; }
    if (testuale && j.prima) {
      voci.push({ ordine: ordineDiRiga(j.riga), creato: j.creato,
        nodo: () => cartaTesto(j, valido, [j.prima], [j.dopo], [j.riga], azionabile ? 0 : undefined, 0, 1,
          avvisiLavoro(j, segnalati)) });
      continue;
    }
    if (testuale && j.blocchi?.length) {
      let scarto = 0;
      for (const [i, b] of j.blocchi.entries()) {
        const primaBlocco = soloParagrafi(b.prima);
        const dopoBlocco = soloParagrafi(b.dopo);
        const righe = j.tipo === 'bozza' ? dopoBlocco.map(() => b.riga) : valido
          ? dati.passaggi.slice(b.ordine + scarto, b.ordine + scarto + dopoBlocco.length).map(p => p.riga) : [];
        // Un blocco può coprire più paragrafi: si mostra un diff per paragrafo, come nel testo.
        const gruppi = allineaParagrafi(primaBlocco.map(compatto), dopoBlocco.map(compatto)).filter(g => g.letto === undefined);
        const parti = gruppi.length ? gruppi : [{ da: 0, a: primaBlocco.length, inizio: 0, fine: dopoBlocco.length }];
        const posizione = b.ordine + scarto;
        for (const g of parti) {
          voci.push({ ordine: posizione + g.inizio, creato: j.creato,
            nodo: () => cartaTesto(j, valido, primaBlocco.slice(g.da, g.a), dopoBlocco.slice(g.inizio, g.fine),
              righe.slice(g.inizio, g.fine), azionabile ? i : undefined, g.inizio, parti.length,
              avvisiLavoro(j, segnalati)) });
        }
        scarto += dopoBlocco.length - primaBlocco.length;
      }
      continue;
    }
    voci.push({ ordine: j.riga !== undefined ? ordineDiRiga(j.riga) : Infinity, creato: j.creato, nodo: () => {
      const box = el('details');
      const sommario = el('summary', '', etichettaLavoro(j));
      sommario.dataset.lavoro = j.id;
      box.open = valido && (['bozza', 'modifica'].includes(j.tipo) || ['prese', 'proposta'].includes(j.tipo) && ['pronto', 'proposta'].includes(j.stato));
      box.append(sommario);
      if (j.prima) box.append(confrontoModifiche(j.prima, j.dopo, p => vaiAllaModifica(p, valido ? j.riga : undefined)));
      for (const b of j.blocchi || []) box.append(confrontoModifiche(unisci(b.prima), unisci(b.dopo), p => vaiAllaModifica(p, undefined)));
      if (j.tipo === 'stacco') box.append(el('p', 'autore-didascalia',
        `${j.stacco ? 'Stacco messo' : 'Stacco tolto'} prima di: ${(dati.passaggi.find(p => p.riga === j.riga)?.testo || '').slice(0, 60)}…`));
      if (j.frase) box.append(el('p', 'autore-didascalia', j.frase.replace(/\[[^\]]*\]/g, ' ')));
      if (j.errore) {
        box.append(el('p', 'autore-errore', j.errore));
        const comandi = el('div', 'autore-azioni-errore');
        if (valido) comandi.append(bottone('Riprova', () => azione('riprova', { id: j.id })));
        const aMano = testoDelLavoro(j);
        if (aMano) comandi.append(bottone('Applica a mano', () => {
          if (bozzaAperta()) return;
          setRiferimento(audioDelPassaggio(aMano.riga));
          scegliPassaggio(aMano.riga);
          modificaInLinea('', aMano.testo);
        }));
        comandi.append(bottone('Ignora', () => azione('ignora', { id: j.id })));
        box.append(comandi);
      }
      if (j.segnalazioni?.length) {
        const avvisi = el('ul');
        for (const p of j.segnalazioni) avvisi.append(el('li', '', `${p.tempo} · ${p.audio || p.testo}`));
        box.append(avvisi);
      }
      if (valido && j.tipo === 'proposta') box.append(bottone('Usa come bozza', () => {
        if (bozzaAperta()) return;
        setRiferimento(audioDelPassaggio(j.riga));
        scegliPassaggio(j.riga);
        modificaInLinea('', j.dopo);
      }));
      if (j.prese) {
        box.append(comandiPrese(j, valido));
        for (const k of j.prese) box.append(rigaPresa(j, k, valido));
      }
      if (j.tipo === 'prese' && !['in coda', 'in generazione'].includes(j.stato)) {
        const scarta = bottone('Scarta le prese', async () => {
          scarta.disabled = true;
          try { await api('scarta', { id: j.id }); await aggiorna(j.capitolo); stato.textContent = 'Prese scartate.'; }
          catch (e) { stato.textContent = e.message; scarta.disabled = false; }
        });
        scarta.className = 'autore-pulisci';
        box.append(scarta);
      }
      return box;
    } });
  }
  if (inLavorazione.length) voci.push({ ordine: -1, creato: inLavorazione[0].creato, nodo: () => {
    const carta = el('section', 'autore-voce autore-in-lavorazione');
    const blocchi = inLavorazione.reduce((n, j) => n + (j.blocchi?.length || 1), 0);
    carta.append(el('p', 'autore-didascalia', blocchi === 1
      ? 'Una modifica è già nel testo e aspetta l’audio: il diff si rivede quando la voce è pronta.'
      : `${blocchi} modifiche sono già nel testo e aspettano l’audio: i diff si rivedono quando la voce è pronta.`));
    return carta;
  } });
  voci.sort((a, b) => (a.ordine === b.ordine ? 0 : a.ordine - b.ordine) || Date.parse(a.creato) - Date.parse(b.creato));
  for (const v of voci) elenco.append(v.nodo());
  if (dati.controllo?.length) elenco.append(schedaControllo(dati.controllo));
  if (storico.length) {
    const box = el('details', 'autore-storico');
    box.append(el('summary', '', storico.length === 1 ? '1 modifica precedente' : `${storico.length} modifiche precedenti`));
    for (const j of storico.slice().reverse()) {
      const riga = el('p', 'autore-didascalia autore-riga-storico');
      // L'etichetta si riscrive a ogni lettura (aggiornaStatiLavori): il bottone sta fuori.
      const etichetta = el('span', '', etichettaLavoro(j));
      etichetta.dataset.lavoro = j.id;
      riga.append(etichetta);
      if (j.blocchi?.length || j.dopo !== undefined) {
        const seleziona = bottone('Seleziona', () => selezionaNelTesto(j));
        seleziona.className = 'autore-seleziona-storico';
        tooltipSu(seleziona, 'Seleziona nel testo di oggi il punto cambiato');
        riga.append(seleziona);
      }
      box.append(riga);
    }
    const pulisci = bottone('Pulisci lo storico', () => azione('pulisci', { capitolo: dati.capitolo }));
    pulisci.className = 'autore-pulisci';
    box.append(pulisci);
    elenco.append(box);
  }
  if (!elenco.childElementCount) elenco.append(el('p', 'autore-didascalia', 'Per iniziare, seleziona il testo nel capitolo e scegli Correggi dal menu del clic destro. Qui troverai i diff e le azioni disponibili.'));
  return true;
}

export function installaLavori() {
  document.querySelector('audio')?.addEventListener('error', riprendiAudio);
}
