// Come si disegnano le differenze dentro i paragrafi del lettore e come ci si arriva.
import { el, bottone, pagina, tooltipSu } from './base.mjs';
import { anteprimaDiff, compatto, diffConRimozioni, fettaDiff, finestreDiff, puntoDiff } from './testo.mjs';
import { ornamentiDiff, paragrafi, passaggioDi, testoSenzaRimozioni } from './stato.mjs';
import { stato } from './pannello.mjs';
import { inLinea, posizioneNelTesto } from './editor.mjs';

export function colora(nodo, testo, intervalli) {
  const parti = [];
  let da = 0;
  for (const [a, b] of intervalli) {
    parti.push(testo.slice(da, a), el('mark', '', testo.slice(a, b)));
    da = b;
  }
  nodo.replaceChildren(...parti, testo.slice(da));
}

export function nodiTesto(nodo) {
  return document.createTreeWalker(nodo, NodeFilter.SHOW_TEXT, {
    acceptNode: t => t.length && !t.parentElement.closest(ornamentiDiff) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
}

export function inserisciRimozioni(nodo, rimozioni) {
  if (!rimozioni.length) return;
  const giro = nodiTesto(nodo), tratti = [];
  let offset = 0;
  for (let t = giro.nextNode(); t; t = giro.nextNode()) {
    tratti.push({ t, offset, fine: offset + t.length });
    offset += t.length;
  }
  for (const r of [...rimozioni].reverse()) {
    const segno = el('span', 'autore-rimozione');
    segno.append(r.prima, el('del', '', r.testo), r.dopo);
    const tratto = tratti.find(x => r.posizione < x.fine) || tratti.at(-1);
    if (!tratto) { nodo.append(segno); continue; }
    const { t, offset, fine } = tratto;
    const mark = t.parentElement.matches('mark') ? t.parentElement : null;
    if (mark && r.posizione === offset) mark.before(segno);
    else if (mark && r.posizione === fine) mark.after(segno);
    else t.splitText(r.posizione - offset).before(segno);
  }
}

export function rendiDiff(nodo, testo, diff) {
  colora(nodo, testo, diff.aggiunte);
  inserisciRimozioni(nodo, diff.rimozioni);
}

export function confrontoModifiche(prima, dopo, vai) {
  const diff = diffConRimozioni(prima, dopo);
  const box = el('span', 'autore-confronto');
  const finestre = finestreDiff(dopo, diff);
  function estrattoDi([da, a], breve) {
    const estratto = vai ? bottone('', () => vai(puntoDiff(dopo, diff, da, a))) : el('span');
    estratto.className = 'autore-estratto';
    if (vai) tooltipSu(estratto, 'Vai alla modifica nel testo');
    const fine = breve?.fine ?? a;
    rendiDiff(estratto, dopo.slice(da, fine), breve?.diff ?? fettaDiff(diff, da, a));
    if (da > 0) estratto.prepend('… ');
    if (fine < dopo.length) estratto.append(' …');
    return estratto;
  }
  if (!vai) {
    box.append(...finestre.map(finestra => estrattoDi(finestra)));
    return box;
  }
  const breve = anteprimaDiff(dopo, diff, finestre[0]);
  const primo = estrattoDi(finestre[0], breve);
  const scheda = el('span', 'autore-scheda-diff');
  scheda.append(primo);
  box.append(scheda);
  if (breve.tagliata || finestre.length > 1) {
    let dettagli;
    const altro = bottone('Mostra altro', () => {
      const espandi = !primo.hidden;
      if (!dettagli) {
        dettagli = estrattoDi([0, dopo.length]);
        primo.after(dettagli);
      }
      dettagli.hidden = !espandi;
      primo.hidden = espandi;
      altro.textContent = espandi ? 'Mostra meno' : 'Mostra altro';
      altro.setAttribute('aria-expanded', String(espandi));
    });
    altro.className = 'autore-altro-diff';
    altro.setAttribute('aria-expanded', 'false');
    scheda.append(altro);
  }
  return box;
}

let destinazione, timerDestinazione;
export function paragrafoDelDiff(testo, riga, indice = 0) {
  const tutti = paragrafi();
  const ancorati = riga === undefined ? [] : tutti.filter(p => passaggioDi(p)?.riga === riga);
  const testoDel = p => testoSenzaRimozioni(p.querySelector(':scope > .autore-versione') || p);
  const coincide = p => p && compatto(testoDel(p)) === compatto(testo);
  const corrispondenze = tutti.filter(coincide);
  let p = ancorati[indice];
  if (!coincide(p)) p = ancorati.find(coincide) || (corrispondenze.length === 1 ? corrispondenze[0] : p);
  return p;
}

export function apriTesto() {
  if (pagina?.classList.contains('nascosto') && typeof apriPagina === 'function') apriPagina();
  if (typeof staccaSegui === 'function') staccaSegui();
}

export function vaiAllaModifica(punto, riga, indice = 0) {
  let p = paragrafoDelDiff(punto.testo, riga, indice);
  if (!p) { stato.textContent = 'Il passaggio di questo diff non è più presente nel testo corrente.'; return; }
  if (p.classList.contains('autore-blocco-seguente')) p = inLinea.parentElement || p;
  apriTesto();
  const radice = p.querySelector(':scope > .autore-versione') || p;
  const testo = testoSenzaRimozioni(radice);
  const offset = posizioneNelTesto(testo, punto.testo.slice(0, punto.offset), true);
  let bersaglio = p;
  let distanza = Infinity;
  for (const segno of radice.querySelectorAll('mark, .autore-rimozione')) {
    if (!segno.getClientRects().length) continue;
    const r = document.createRange();
    r.selectNodeContents(radice);
    r.setEndBefore(segno);
    const d = Math.abs(testoSenzaRimozioni(r.cloneContents()).length - offset);
    if (d < distanza) { distanza = d; bersaglio = segno; }
  }
  if (bersaglio === p) {
    const giro = nodiTesto(radice);
    let pos = 0;
    for (let nodo = giro.nextNode(); nodo; nodo = giro.nextNode()) {
      pos += nodo.length;
      if (pos > offset) { bersaglio = nodo.parentElement.closest('[data-i]') || p; break; }
    }
  }
  clearTimeout(timerDestinazione);
  destinazione?.classList.remove('autore-destinazione');
  destinazione = bersaglio;
  bersaglio.classList.add('autore-destinazione');
  bersaglio.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  timerDestinazione = setTimeout(() => bersaglio.classList.remove('autore-destinazione'), 1800);
}
