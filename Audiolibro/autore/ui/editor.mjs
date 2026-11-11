// L'editor in linea: scelta del passaggio, blocco di paragrafi, bozza locale.
import { api, apiBase, articolo, bottone, el } from './base.mjs';
import { compatto, conStacchi, differenze, normalizza, testoVisibile, unisci } from './testo.mjs';
import { cap, paragrafi, passaggioDi, testoLetto, testoSenzaRimozioni } from './stato.mjs';
import { aggiorna, dati } from './dati.mjs';
import { mappaVisiva, mostraModifiche } from './proiezione.mjs';
import { aggiornaComandi, aggiornaContatori, stato } from './pannello.mjs';
import { bloccoDelPassaggio } from './pendenti.mjs';
import { colora, confrontoModifiche } from './diff-testo.mjs';

export const area = el('textarea');
area.rows = 1;
area.setAttribute('aria-label', 'Testo del passaggio');
export const inLinea = el('span', 'autore-in-linea');
const griglia = el('span', 'autore-griglia');
const specchio = el('span', 'autore-specchio');
specchio.setAttribute('aria-hidden', 'true');
griglia.append(specchio, area);
export const salva = bottone('Salva bozza locale', salvaInLinea);
salva.className = 'autore-primario';
export const annulla = bottone('Annulla', () => chiudiEditor(true));
export const riscontro = el('span', 'autore-riscontro');
riscontro.setAttribute('role', 'status');
// Il ripristino si chiede e si conferma qui dentro: chi corregge non deve andarlo a cercare nel pannello.
export const ripristina = bottone('Ripristina', () => {
  if (ripristina.hidden || ripristina.disabled) return;
  const blocco = bloccoDelPassaggio(dati, riga);
  if (!blocco) return;
  domandaRipristino.textContent = area.value.trim() !== originale
    ? 'Ripristinare il testo di prima? Quello che hai scritto qui va perso.'
    : blocco.lavoro.tipo === 'bozza' ? 'Togliere questo blocco dalla bozza?' : 'Ripristinare il testo di prima?';
  confermaRipristino.disabled = annullaRipristino.disabled = false;
  richiestaRipristino.hidden = false;
  annullaRipristino.focus();
});
const richiestaRipristino = el('span', 'autore-ripristino autore-conferma-ripristino');
richiestaRipristino.hidden = true;
const domandaRipristino = el('span');
domandaRipristino.setAttribute('role', 'status');
const confermaRipristino = bottone('Conferma', eseguiRipristino);
const annullaRipristino = bottone('Annulla', () => { richiestaRipristino.hidden = true; ripristina.focus(); });
richiestaRipristino.append(domandaRipristino, confermaRipristino, annullaRipristino);
const azioniInLinea = el('span', 'autore-azioni');
azioniInLinea.append(salva, annulla, ripristina, riscontro, richiestaRipristino);
inLinea.append(griglia, azioniInLinea);

export let revisioneEditor, riga, originale, riferimento, capitoloEditor, salvando = false;
export let bloccoEditor;
let nodiEditor = [];
export const setRiferimento = v => { riferimento = v; };
const tabSelezione = crypto.randomUUID();
let sequenzaSelezione = 0, timerSelezione;

export function aggiornaSelezione() {
  clearTimeout(timerSelezione);
  timerSelezione = setTimeout(() => {
    if (!inLinea.isConnected || capitoloEditor !== cap() || !bloccoEditor) return;
    const dati = { capitolo: capitoloEditor, revisione: revisioneEditor, riga, fine: bloccoEditor.fine,
      testo: area.value, da: area.selectionStart, a: area.selectionEnd, riferimento };
    api('selezione', { tab: tabSelezione, seq: ++sequenzaSelezione, dati }).catch(() => {});
  }, 50);
}

export function liberaSelezione() {
  clearTimeout(timerSelezione);
  if (capitoloEditor === undefined) return;
  const corpo = JSON.stringify({ tab: tabSelezione, seq: ++sequenzaSelezione, dati: null });
  navigator.sendBeacon(apiBase + 'selezione', new Blob([corpo], { type: 'application/json' }));
}
export function scegliPassaggio(n) {
  chiudiEditor();
  const p = dati?.passaggi.find(x => x.riga === n);
  riga = p?.riga;
  originale = p?.testo || '';
  area.value = originale;
  area.disabled = !p;
  revisioneEditor = dati?.revisione;
  aggiornaComandi();
}

export function chiudiEditor(focus = false) {
  liberaSelezione();
  for (const p of nodiEditor) p.classList.remove('autore-in-modifica', 'autore-blocco-seguente');
  nodiEditor = [];
  inLinea.remove();
  capitoloEditor = undefined;
  bloccoEditor = undefined;
  if (focus) mostraModifiche();
  aggiornaContatori();
  if (focus) articolo.focus({ preventScroll: true });
}

export function paragrafoDi(n) {
  if (mappaVisiva.size) return paragrafi().find(p => passaggioDi(p)?.riga === n);
  const i = dati?.passaggi.findIndex(x => x.riga === n);
  const p = paragrafi()[i];
  if (!p) return;
  const letto = normalizza(testoLetto(p));
  if (letto === normalizza(dati.passaggi[i].testo) || dati.lavori.some(j => j.tipo === 'modifica' && j.riga === n && [j.prima, j.dopo].some(t => normalizza(t) === letto))) return p;
}

export function aggiornaBozza() {
  const { aggiunte, rimosse } = differenze(originale, area.value);
  colora(specchio, area.value + '\u200b', aggiunte);
  inLinea.querySelector(':scope > .autore-confronto')?.remove();
  if (rimosse.length) inLinea.append(confrontoModifiche(originale, area.value));
  aggiornaComandi();
  aggiornaContatori();
}

export function attaccaEditor(paragrafi) {
  nodiEditor = paragrafi;
  const [primo, ...seguito] = paragrafi;
  primo.classList.add('autore-in-modifica');
  seguito.forEach(p => p.classList.add('autore-blocco-seguente'));
  primo.append(inLinea);
}

export function posizioneNelTesto(testo, prefisso, avanza) {
  let restanti = compatto(prefisso).length;
  let i = 0;
  for (; i < testo.length && restanti > 0; i++) if (compatto(testo[i])) restanti--;
  if (avanza) while (i < testo.length && /\s/.test(testo[i])) i++;
  return i;
}

export function modificaInLinea(evidenziata = '', bozza, selezione) {
  const tutti = paragrafi();
  const indice = tutti.indexOf(paragrafoDi(riga));
  const da = selezione?.da ?? indice;
  const a = selezione?.a ?? indice;
  const primo = passaggioDi(tutti[da]), ultimo = passaggioDi(tutti[a]);
  if (!primo || !ultimo) { stato.textContent = 'Apri il testo e seleziona il paragrafo da correggere.'; return; }
  let inizio = da, fine = a;
  while (inizio > 0 && passaggioDi(tutti[inizio - 1])?.riga === primo.riga) inizio--;
  while (fine + 1 < tutti.length && passaggioDi(tutti[fine + 1])?.riga === ultimo.riga) fine++;
  const nodi = tutti.slice(inizio, fine + 1);
  const voci = nodi.map(passaggioDi);
  if (voci.some(p => !p)) return;
  const ultimaRiga = ultimo.fine ?? ultimo.riga;
  riga = primo.riga;
  const base = dati.passaggi.filter(p => p.riga >= riga && p.riga <= ultimaRiga);
  bloccoEditor = { inizio, lunghezza: nodi.length, fine: ultimaRiga, righe: base.map(p => p.riga),
    prima: unisci(conStacchi(base).map(testoVisibile)), bozza: dati.bozza?.id ?? null };
  originale = unisci(conStacchi(voci));
  capitoloEditor = cap();
  area.value = bozza ?? originale;
  area.disabled = false;
  riscontro.textContent = '';
  attaccaEditor(nodi);
  aggiornaBozza();
  const valore = area.value;
  const trovato = evidenziata ? valore.indexOf(evidenziata) : -1;
  // Nel testo dell'editor ogni stacco di scena occupa una riga in più.
  const offset = i => voci.slice(0, i - inizio).reduce((n, p, k) => n + p.testo.length + 2 + (k && p.stacco ? 5 : 0), 0)
    + ((i - inizio) && voci[i - inizio]?.stacco ? 5 : 0);
  const haSelezione = selezione?.inizio !== undefined;
  const sinistra = haSelezione ? offset(da) + posizioneNelTesto(primo.testo, selezione.inizio, true) : trovato;
  const destra = haSelezione ? offset(a) + posizioneNelTesto(ultimo.testo, selezione.fine, false) : trovato + evidenziata.length;
  area.focus({ preventScroll: true });
  area.setSelectionRange(sinistra < 0 ? valore.length : sinistra, sinistra < 0 ? valore.length : Math.max(sinistra, destra));
  aggiornaSelezione();
  inLinea.scrollIntoView({ block: 'nearest' });
}

// Si può ripristinare solo dove c'è qualcosa da disfare, e mai mentre si sta salvando.
export function aggiornaRipristino() {
  const blocco = inLinea.isConnected ? bloccoDelPassaggio(dati, riga) : undefined;
  ripristina.hidden = !blocco;
  ripristina.disabled = salvando;
  if (!blocco) richiestaRipristino.hidden = true;
}

export async function eseguiRipristino() {
  const blocco = bloccoDelPassaggio(dati, riga);
  const capitolo = capitoloEditor;
  if (!blocco || confermaRipristino.disabled) return;
  const locale = blocco.lavoro.tipo === 'bozza';
  confermaRipristino.disabled = annullaRipristino.disabled = true;
  try {
    await api('ripristina', { id: blocco.lavoro.id, indice: blocco.indice });
    if (cap() !== capitolo) return;
    richiestaRipristino.hidden = true;
    chiudiEditor(true);
    await aggiorna(capitolo);
    stato.textContent = locale ? 'Blocco rimosso dalla bozza.' : 'Testo del blocco ripristinato.';
  } catch (e) {
    riscontro.textContent = e.message;
    confermaRipristino.disabled = annullaRipristino.disabled = false;
  }
}

export function bozzaAperta() {
  if (capitoloEditor !== cap() || !salvando && area.value.trim() === originale) return false;
  riscontro.textContent = 'Salva o annulla la modifica aperta.';
  area.focus({ preventScroll: true });
  return true;
}

export async function salvaInLinea() {
  if (salva.disabled || capitoloEditor !== cap()) return;
  if (!Object.hasOwn(dati || {}, 'bozza')) {
    riscontro.textContent = 'Aggiorna il lettore locale per salvare una bozza.';
    return;
  }
  const capitolo = capitoloEditor;
  const n = riga;
  const testo = area.value.trim();
  const { fine, bozza } = bloccoEditor;
  salvando = true;
  area.readOnly = true;
  aggiornaComandi();
  try {
    await api('bozza', { capitolo, revisione: revisioneEditor, riga: n, fine, testo, bozza });
    if (cap() !== capitolo) return;
    chiudiEditor(true);
    riferimento = undefined;
    await aggiorna(capitolo);
    scegliPassaggio(n);
    const esito = 'Bozza salvata su questo PC.';
    stato.textContent = esito;
    if (typeof annuncia === 'function') annuncia(esito);
  } catch (e) { riscontro.textContent = e.message; stato.textContent = e.message; }
  finally { salvando = false; area.readOnly = false; aggiornaComandi(); }
}
export function riferimentoDelCue(c) {
  return c && { tempo: c.t, testoLetto: c.testo };
}

export function audioDelPassaggio(n) {
  const p = paragrafoDi(n);
  if (!p || typeof cue === 'undefined') return undefined;
  return riferimentoDelCue(cue[Number(p.querySelector('[data-i]')?.dataset.i)]);
}

export function contestoPassaggio(frase, selezione = getSelection()) {
  const p = frase?.closest('p');
  const intervallo = selezione?.rangeCount && selezione.getRangeAt(0);
  const evidenziata = intervallo && p?.contains(intervallo.startContainer) && p.contains(intervallo.endContainer)
    ? testoSenzaRimozioni(intervallo.cloneContents()).trim() : '';
  let blocco;
  if (p && intervallo && !intervallo.collapsed && intervallo.intersectsNode(p)) {
    const paragrafo = nodo => (nodo.nodeType === Node.ELEMENT_NODE ? nodo : nodo.parentElement)?.closest('p');
    const primo = paragrafo(intervallo.startContainer), ultimo = paragrafo(intervallo.endContainer);
    const tutti = paragrafi();
    const da = tutti.indexOf(primo), a = tutti.indexOf(ultimo);
    if (da >= 0 && a >= da) {
      const prefisso = (paragrafo, nodo, offset) => {
        const radice = paragrafo.querySelector(':scope > .autore-versione') || paragrafo;
        if (!radice.contains(nodo)) return nodo === paragrafo && offset > 0 ? (passaggioDi(paragrafo)?.testo || '') : '';
        const r = document.createRange();
        r.selectNodeContents(radice);
        r.setEnd(nodo, offset);
        return testoSenzaRimozioni(r.cloneContents());
      };
      blocco = { da, a, inizio: prefisso(primo, intervallo.startContainer, intervallo.startOffset),
        fine: prefisso(ultimo, intervallo.endContainer, intervallo.endOffset) };
    }
  }
  return {
    letto: p ? normalizza(testoSenzaRimozioni(p.querySelector(':scope > .autore-versione') || p)) : '',
    ordine: paragrafi().indexOf(p),
    riferimento: frase && typeof cue !== 'undefined' ? riferimentoDelCue(cue[Number(frase.dataset.i)]) : undefined,
    evidenziata,
    blocco,
  };
}
export async function apriPassaggio(contesto) {
  if (bozzaAperta()) return;
  const n = cap();
  if (!n) return;
  const { letto, ordine, evidenziata, blocco } = contesto;
  riferimento = contesto.riferimento;
  try {
    await aggiorna(n);
    if (cap() !== n) return;
    const trovati = dati.passaggi.filter(x => normalizza(x.testo) === letto);
    const visibile = passaggioDi(paragrafi()[ordine]);
    const corrispondente = dati.passaggi.find(p => p.riga === visibile?.riga);
    const precedente = dati.lavori.some(x => x.riga === corrispondente?.riga && x.prima && normalizza(x.prima) === letto);
    const coincide = visibile && normalizza(visibile.testo) === letto;
    const scelto = coincide || precedente ? corrispondente : trovati.length === 1 ? trovati[0] : undefined;
    stato.textContent = `Capitolo ${n}`;
    scegliPassaggio(scelto?.riga);
    if (riga !== undefined || blocco) modificaInLinea(evidenziata, undefined, blocco);
    return true;
  } catch (e) { stato.textContent = e.message; }
}

export function installaEditor() {
  area.addEventListener('input', () => { aggiornaBozza(); aggiornaSelezione(); });
  for (const tipo of ['select', 'click', 'keyup']) area.addEventListener(tipo, aggiornaSelezione);
  addEventListener('pagehide', liberaSelezione);
  area.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape' && !salvando) chiudiEditor(true);
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvaInLinea(); }
  });
}
