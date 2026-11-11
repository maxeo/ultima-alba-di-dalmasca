// Mattoni comuni: nodi, bottoni, tooltip e chiamate all'API dell'autore.
export const apiBase = '/__autore/';
export const articolo = document.getElementById('articolo');
export const pagina = document.getElementById('pagina');
export const voce = document.getElementById('a');

export const el = (tag, classe, testo) => {
  const nodo = document.createElement(tag);
  if (classe) nodo.className = classe;
  if (testo) nodo.textContent = testo;
  return nodo;
};
export const bottone = (testo, f) => {
  const b = el('button', '', testo);
  b.type = 'button';
  b.addEventListener('click', f);
  return b;
};
export const bottoneIcona = (etichetta, disegno, clic, mostraEtichetta = false, descrizione = etichetta) => {
  const b = bottone('', clic);
  b.className = 'autore-icona-azione';
  tooltipSu(b, descrizione);
  b.setAttribute('aria-label', etichetta);
  disegno.setAttribute('aria-hidden', 'true');
  b.append(disegno);
  if (mostraEtichetta) b.append(el('span', 'autore-etichetta', etichetta));
  return b;
};
// La matita non sta fra le icone del lettore: la disegniamo qui, una nuova a ogni bottone.
export function matita() {
  const svg = 'http://www.w3.org/2000/svg';
  const disegno = document.createElementNS(svg, 'svg');
  disegno.setAttribute('class', 'ic');
  disegno.setAttribute('viewBox', '0 0 24 24');
  const tratto = document.createElementNS(svg, 'path');
  tratto.setAttribute('d', 'm3 17.25 11.9-11.9 3.75 3.75L6.75 21H3zM16.3 3.95l1.4-1.4a1 1 0 0 1 1.4 0l2.35 2.35a1 1 0 0 1 0 1.4l-1.4 1.4z');
  disegno.append(tratto);
  return disegno;
}

const tooltip = el('div', 'autore-tooltip');
tooltip.id = 'autore-tooltip';
tooltip.setAttribute('role', 'tooltip');
tooltip.hidden = true;
let bersaglioTooltip;
export function nascondiTooltip(b = bersaglioTooltip) {
  if (!b || b !== bersaglioTooltip) return;
  b.removeAttribute('aria-describedby');
  bersaglioTooltip = undefined;
  tooltip.hidden = true;
}
export function tooltipSu(b, descrizione) {
  const mostra = () => {
    const testo = typeof descrizione === 'function' ? descrizione() : descrizione;
    if (!testo) return;
    nascondiTooltip();
    bersaglioTooltip = b;
    tooltip.textContent = testo;
    tooltip.hidden = false;
    b.setAttribute('aria-describedby', tooltip.id);
    const { top, bottom, left, width } = b.getBoundingClientRect();
    const { offsetWidth, offsetHeight } = tooltip;
    tooltip.style.left = Math.max(8, Math.min(innerWidth - offsetWidth - 8, left + (width - offsetWidth) / 2)) + 'px';
    tooltip.style.top = (top >= offsetHeight + 16 ? top - offsetHeight - 8 : bottom + 8) + 'px';
  };
  b.addEventListener('pointerenter', mostra);
  b.addEventListener('pointerleave', () => nascondiTooltip(b));
  b.addEventListener('focus', () => { if (b.matches(':focus-visible')) mostra(); });
  b.addEventListener('blur', () => nascondiTooltip(b));
  b.addEventListener('pointerdown', () => nascondiTooltip(b));
  b.addEventListener('keydown', e => { if (e.key === 'Escape') nascondiTooltip(b); });
}

export async function api(route, dati) {
  const r = await fetch(apiBase + route, dati ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati),
  } : { cache: 'no-store' });
  const risultato = await r.json();
  if (!r.ok) throw new Error(risultato.errore || 'Operazione non riuscita.');
  return risultato;
}

export function installaBase() {
  const css = el('link');
  css.rel = 'stylesheet';
  css.href = apiBase + 'ui.css';
  document.head.append(css);
  document.body.append(tooltip);
  window.addEventListener('scroll', () => nascondiTooltip(), true);
  window.addEventListener('resize', () => nascondiTooltip());
}
