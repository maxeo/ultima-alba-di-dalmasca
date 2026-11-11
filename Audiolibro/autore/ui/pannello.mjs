// Il pannello dell’autore: barra, stato, contatore in testata e conferme.
import { articolo, bottone, bottoneIcona, el, pagina, tooltipSu } from './base.mjs';
import { compatto, riepilogoParole, statoCaricamentoAutore, testoVisibile } from './testo.mjs';
import { cap, paragrafiAudio, testoLetto } from './stato.mjs';
import { azione, caricaRiepilogo, dati, erroreCaricamento } from './dati.mjs';
import { annulla, area, bloccoEditor, bozzaAperta, inLinea, originale, riga, salva,
  salvando } from './editor.mjs';
import { conteggiSalvati } from './proiezione.mjs';
import { generazione } from './lavori.mjs';

let azioneDaConfermare;

export const pannello = el('aside', 'autore-pannello');
pannello.setAttribute('aria-label', 'Revisione del romanzo');
pannello.hidden = true;
const barra = el('div', 'autore-barra');
const titolo = el('h2', '', 'Modalità autore');
const chiudi = bottone('Chiudi', () => {
  chiudiConferma();
  pannello.hidden = true;
  document.body.classList.remove('autore-aperto');
  apri.setAttribute('aria-expanded', 'false');
  pendenti.setAttribute('aria-expanded', 'false');
  (apri.hidden ? pendenti : apri).focus();
});
barra.append(titolo, chiudi);
export const stato = el('p', 'autore-stato');
stato.setAttribute('role', 'status');
export const lavorazione = el('p', 'autore-lavorazione');
lavorazione.setAttribute('role', 'status');
lavorazione.hidden = true;
export const avvisoCarico = el('p', 'autore-didascalia');
avvisoCarico.setAttribute('role', 'status');
export const aggiornaAudio = bottoneIcona('Aggiorna audio del capitolo', icona('i-cuffie'), () => {
  const j = lavoroAudio();
  if (j && !aggiornaAudio.hidden) chiediConferma(aggiornaAudio, 'aggiorna-audio', j.id, 'Accodare l’aggiornamento audio del capitolo?');
}, true);
export const applicaBozza = bottoneIcona('Applica bozza al testo', icona('i-casella-ok'), () => {
  if (dati?.bozza?.blocchi.length && !bozzaAperta()) chiediConferma(applicaBozza, 'applica-bozza', dati.bozza.id, 'Applicare la bozza al testo del romanzo?');
}, true);
for (const b of [applicaBozza, aggiornaAudio]) {
  b.hidden = true;
  b.setAttribute('aria-expanded', 'false');
}
const richiestaConferma = el('div', 'autore-richiesta-conferma');
richiestaConferma.hidden = true;
const testoConferma = el('span');
testoConferma.setAttribute('role', 'status');
export const accettaConferma = bottone('Conferma', eseguiConferma);
const annullaConferma = bottone('Annulla', () => chiudiConferma(true));
richiestaConferma.append(testoConferma, accettaConferma, annullaConferma);
export const conferma = el('footer', 'autore-azioni autore-conferma');
conferma.append(applicaBozza, aggiornaAudio, richiestaConferma);
export const elenco = el('div', 'autore-lavori');
pannello.append(barra, stato, lavorazione, avvisoCarico, elenco, conferma);
export const apri = bottone('Autore', apriRiepilogo);
apri.className = 'autore-apri';
apri.setAttribute('aria-expanded', 'false');
apri.addEventListener('mousedown', e => e.preventDefault());
export const pendenti = bottone('', apriRiepilogo);
pendenti.className = 'autore-pendenti';
pendenti.hidden = true;
pendenti.setAttribute('aria-expanded', 'false');
const piu = el('span', 'autore-piu');
const meno = el('span', 'autore-meno');
const stimaAudio = el('span', 'autore-stima-audio');
const carico = el('span', 'autore-caricamento');
const avanzamento = el('span', 'autore-avanzamento');
pendenti.append(carico, avanzamento, piu, meno, stimaAudio);
const titoloContatore = 'Parole aggiunte e rimosse rispetto all’audio in uso. La stima audio conta le parole nelle frasi interessate.';

export function aggiornaContatori() {
  const primaRiga = articolo.firstElementChild?.textContent;
  const testoInErrore = primaRiga?.startsWith('Testo non disponibile') && articolo.childElementCount === 1;
  const testo = testoInErrore ? 'errore' : articolo.querySelector('[data-i]') ? 'pronto' : 'caricamento';
  const fase = statoCaricamentoAutore(cap(), dati?.capitolo, testo, erroreCaricamento?.capitolo);
  const pronto = fase === 'pronto';
  stato.hidden = elenco.hidden = conferma.hidden = !pronto;
  avvisoCarico.hidden = pronto;
  const avviso = {
    'nessun-capitolo': 'Apri un capitolo per vedere modifiche e azioni.',
    caricamento: 'Caricamento delle modifiche…',
    errore: testoInErrore ? 'Il testo del capitolo non è disponibile.' : 'Caricamento delle modifiche non riuscito. Riprova tra poco.',
  }[fase];
  if (!pronto && avvisoCarico.textContent !== avviso) avvisoCarico.textContent = avviso;
  pannello.setAttribute('aria-busy', String(fase === 'caricamento'));
  pendenti.setAttribute('aria-busy', String(fase === 'caricamento'));
  carico.hidden = pronto || fase === 'nessun-capitolo';
  piu.hidden = meno.hidden = stimaAudio.hidden = !pronto;
  const g = pronto ? generazione() : null;
  lavorazione.hidden = avanzamento.hidden = !g;
  if (g) lavorazione.textContent = avanzamento.textContent = g.testo;
  if (!pronto) {
    const etichetta = fase === 'caricamento' ? 'Caricamento modifiche…' : 'Modifiche non disponibili';
    if (carico.textContent !== etichetta) carico.textContent = etichetta;
    pendenti.hidden = carico.hidden;
    pendenti.dataset.tooltip = avviso || '';
    pendenti.setAttribute('aria-label', etichetta);
    apri.hidden = !pendenti.hidden && !pagina?.classList.contains('nascosto');
    return;
  }
  pendenti.dataset.tooltip = g ? `${g.testo}. ${titoloContatore}` : titoloContatore;
  const conteggi = new Map(conteggiSalvati);
  if (inLinea.isConnected && area.value.trim() !== originale) {
    for (const n of bloccoEditor.righe) conteggi.delete(n);
    conteggi.set(riga, riepilogoParole(bloccoEditor.prima, testoVisibile(area.value.trim())));
  }
  piu.hidden = meno.hidden = stimaAudio.hidden = conteggi.size === 0;
  pendenti.hidden = conteggi.size === 0 && !g;
  apri.hidden = !pendenti.hidden && !pagina?.classList.contains('nascosto');
  if (conteggi.size === 0) return;
  const totale = { piu: 0, meno: 0, audio: 0 };
  for (const c of conteggi.values()) for (const chiave of Object.keys(totale)) totale[chiave] += c[chiave];
  piu.textContent = `+${totale.piu}`;
  meno.textContent = `−${totale.meno}`;
  stimaAudio.textContent = `≈ ${totale.audio} parole audio`;
  pendenti.setAttribute('aria-label', `Modifiche pendenti, ${totale.piu} parole aggiunte, ${totale.meno} rimosse, circa ${totale.audio} parole di audio da aggiornare`);
}
export function lavoroAudio() {
  return dati?.lavori.find(x => ['modifica', 'stacco', 'rigenera', 'scegli'].includes(x.tipo));
}

export function chiediConferma(origine, comando, id, domanda) {
  if (accettaConferma.disabled) return;
  azioneDaConfermare?.origine.setAttribute('aria-expanded', 'false');
  azioneDaConfermare = { origine, comando, id };
  origine.setAttribute('aria-expanded', 'true');
  testoConferma.textContent = domanda;
  richiestaConferma.hidden = false;
  annullaConferma.focus();
}

export function chiudiConferma(focus = false) {
  const origine = azioneDaConfermare?.origine;
  azioneDaConfermare = undefined;
  origine?.setAttribute('aria-expanded', 'false');
  richiestaConferma.hidden = true;
  if (focus && !origine?.hidden) origine?.focus();
}

export async function eseguiConferma() {
  const richiesta = azioneDaConfermare;
  if (!richiesta || richiesta.comando === 'applica-bozza' && bozzaAperta()) return;
  accettaConferma.disabled = annullaConferma.disabled = true;
  try {
    const eseguita = await azione(richiesta.comando, { id: richiesta.id });
    if (azioneDaConfermare !== richiesta) return;
    if (eseguita) chiudiConferma(true);
    else testoConferma.textContent = stato.textContent;
  } finally {
    accettaConferma.disabled = annullaConferma.disabled = false;
  }
}
export function aggiornaComandi() {
  const j = lavoroAudio();
  salva.disabled = salvando || !area.value.trim() || area.value.trim() === originale;
  annulla.disabled = salvando;
  applicaBozza.hidden = !dati?.bozza?.blocchi.length;
  const letti = j?.ripristinaDi ? paragrafiAudio() : [];
  const audioGiaCoerente = !!letti.length && letti.length === dati.passaggi.length &&
    letti.every((p, i) => compatto(testoLetto(p)) === compatto(dati.passaggi[i].testo));
  aggiornaAudio.hidden = j?.stato !== 'audio da aggiornare' || j.revisione !== dati.revisione || audioGiaCoerente;
  if (azioneDaConfermare) {
    const id = azioneDaConfermare.origine === applicaBozza ? dati?.bozza?.id : j?.id;
    if (azioneDaConfermare.origine.hidden || azioneDaConfermare.id !== id) chiudiConferma();
  }
}
export async function apriRiepilogo() {
  pannello.hidden = false;
  document.body.classList.add('autore-aperto');
  apri.setAttribute('aria-expanded', 'true');
  pendenti.setAttribute('aria-expanded', 'true');
  const n = cap();
  try { await caricaRiepilogo(n); return n && cap() === n; }
  catch { return false; }
}

export function installaPannello() {
  document.body.classList.add('autore-disponibile');
  document.body.append(apri, pannello);
  tooltipSu(pendenti, () => pendenti.dataset.tooltip);
  pagina?.querySelector('header')?.append(pendenti);
}
