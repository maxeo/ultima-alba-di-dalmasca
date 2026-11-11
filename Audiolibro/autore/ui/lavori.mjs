// Le schede dei lavori nel pannello: diff, ripristini, prese audio, stato della generazione.
import { api, apiBase, bottone, bottoneIcona, el, voce } from './base.mjs';
import { allineaParagrafi, compatto, dataBreve, soloParagrafi, unisci } from './testo.mjs';
import { cap, paragrafi, passaggioDi } from './stato.mjs';
import { aggiorna, azione, dati } from './dati.mjs';
import { elenco, stato } from './pannello.mjs';
import { audioDelPassaggio, bozzaAperta, chiudiEditor, inLinea, modificaInLinea, scegliPassaggio,
  setRiferimento } from './editor.mjs';
import { apriTesto, confrontoModifiche, paragrafoDelDiff, vaiAllaModifica } from './diff-testo.mjs';

let sigla;

export function bloccoConAzioni(anteprima, j, indice, dopo, righe, offset = 0, paragrafiBlocco = 1) {
  const locale = j.tipo === 'bozza';
  const blocco = el('div', 'autore-blocco-diff');
  const comandi = el('div', 'autore-azioni-blocco');
  const richiesta = el('div', 'autore-ripristino');
  richiesta.hidden = true;
  const insieme = paragrafiBlocco > 1 ? ' Riguarda tutti i paragrafi del blocco.' : '';
  const domanda = el('span', '', (locale ? 'Scartare questo blocco della bozza?' : 'Ripristinare il testo precedente di questo blocco?') + insieme);
  const svg = 'http://www.w3.org/2000/svg';
  const matita = document.createElementNS(svg, 'svg');
  matita.setAttribute('class', 'ic');
  matita.setAttribute('viewBox', '0 0 24 24');
  const tratto = document.createElementNS(svg, 'path');
  tratto.setAttribute('d', 'm3 17.25 11.9-11.9 3.75 3.75L6.75 21H3zM16.3 3.95l1.4-1.4a1 1 0 0 1 1.4 0l2.35 2.35a1 1 0 0 1 0 1.4l-1.4 1.4z');
  matita.append(tratto);
  const modifica = bottoneIcona('Modifica', matita, () => {
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
  return `${nomiLavoro[j.tipo]} · ${stato}${avanzamento}${j.segnalazioni?.length ? ' · da controllare' : ''}${data ? ' · ' + data : ''}`;
}

// Stato della generazione del capitolo aperto: serve al contatore in testata e al pannello.
// Windows non lascia sostituire l'MP3 finche' il lettore lo tiene aperto: mentre c'e' un lavoro sul capitolo,
// se l'audio e' fermo lo si stacca, e torna al suo posto appena il lavoro finisce o si rimette mano al lettore.
let audioFermo;
export function staccaAudio(inCorso) {
  const a = document.querySelector('audio');
  if (!a) return;
  if (!inCorso) return rimettiAudio();
  if (audioFermo || !a.paused || !a.getAttribute('src')) return;
  audioFermo = { src: a.getAttribute('src'), tempo: a.currentTime };
  a.removeAttribute('src');
  a.load();
}
export function rimettiAudio() {
  if (!audioFermo) return;
  const { src, tempo } = audioFermo;
  audioFermo = undefined;
  const a = document.querySelector('audio');
  if (!a || a.getAttribute('src')) return;
  if (tempo) a.addEventListener('loadedmetadata', () => { a.currentTime = tempo; }, { once: true });
  a.setAttribute('src', src);
  a.load();
}
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
  staccaAudio(!!g?.inCorso);
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

// Di un lavoro andato male si puo' riprendere il testo e rimetterlo a mano dove va,
// se il paragrafo di partenza e' ancora quello di prima.
export function testoDelLavoro(j) {
  const blocchi = j.blocchi?.length ? j.blocchi : j.prima && j.dopo ? [{ prima: [j.prima], dopo: [j.dopo] }] : [];
  for (const b of blocchi) {
    const p = dati?.passaggi.find(x => compatto(x.testo) === compatto(b.prima[0]));
    if (p) return { riga: p.riga, testo: unisci(b.dopo) };
  }
  return undefined;
}
export function disegnaLavori() {
  const firma = JSON.stringify([dati.revisione, dati.lavori.map(j => ({ ...j, progresso: undefined }))]);
  if (firma === sigla) return false;
  sigla = firma;
  elenco.replaceChildren();
  const attuale = dati.lavori.find(j => j.tipo === 'modifica' && j.revisione === dati.revisione);
  const ripristinati = new Set(dati.lavori.map(j => j.ripristinaDi));
  const voci = [];
  const inLavorazione = [];
  const storico = [];
  const segnalati = new Set();
  let avvisiPronto = false;
  for (const j of dati.lavori) {
    if (j.tipo === 'bozza' && (j.id !== dati.bozza?.id || !j.blocchi.length)) continue;
    if (ripristinati.has(j.id) || j.ripristinaDi && !j.blocchi.length) continue;
    if (['rigenera', 'scegli'].includes(j.tipo) && j.stato === 'pronto' && !j.segnalazioni?.length) continue;
    const valido = j.revisione === dati.revisione;
    const azionabile = j.tipo === 'bozza' || j === attuale;
    const testuale = ['bozza', 'modifica', 'stacco'].includes(j.tipo) && !j.errore;
    // Le modifiche già nel testo che aspettano l'audio stanno tutte in una riga sola, senza diff.
    if (testuale && ['in coda', 'in generazione'].includes(j.stato)) { inLavorazione.push(j); continue; }
    // Superate o già pubblicate: il diff è storia, l'audio è già quello. Restano le segnalazioni dell'ultimo controllo.
    if (testuale && (j.stato === 'superato' || j.stato === 'pronto')) {
      if (j.stato !== 'pronto' || !j.segnalazioni?.length || avvisiPronto) { storico.push(j); continue; }
      avvisiPronto = true;
      voci.push({ ordine: Infinity, creato: j.creato, nodo: () => {
        const carta = el('section', 'autore-voce');
        const intestazione = el('p', 'autore-riga-stato');
        intestazione.dataset.lavoro = j.id;
        intestazione.textContent = etichettaLavoro(j);
        carta.append(intestazione, avvisiLavoro(j, segnalati));
        return carta;
      } });
      continue;
    }
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
      if (j.prese) for (const k of j.prese) {
        const r = el('div', 'autore-presa');
        const etichetta = k === 0 ? 'Lettura attuale' : `Presa ${k}`;
        const sample = el('audio');
        sample.controls = true;
        sample.preload = 'none';
        sample.src = `${apiBase}prese/${j.id}/${k}.mp3`;
        sample.setAttribute('aria-label', etichetta);
        sample.addEventListener('play', () => {
          voce.pause();
          for (const altro of elenco.querySelectorAll('audio')) if (altro !== sample) altro.pause();
        });
        r.append(el('span', '', etichetta), sample);
        if (k && valido) r.append(bottone(`Usa presa ${k}`, () => azione('scegli', { id: j.id, presa: k })));
        box.append(r);
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
  if (storico.length) {
    const box = el('details', 'autore-storico');
    box.append(el('summary', '', storico.length === 1 ? '1 modifica precedente' : `${storico.length} modifiche precedenti`));
    for (const j of storico.slice().reverse()) {
      const riga = el('p', 'autore-didascalia');
      riga.dataset.lavoro = j.id;
      riga.textContent = etichettaLavoro(j);
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
  document.addEventListener('pointerdown', e => { if (e.target.closest?.('.barra')) rimettiAudio(); }, true);
  document.addEventListener('keydown', e => { if (e.key === ' ' || e.key.startsWith('Arrow')) rimettiAudio(); }, true);
}
