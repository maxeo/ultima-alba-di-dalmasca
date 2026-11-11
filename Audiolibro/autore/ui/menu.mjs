// Il menu del tasto destro sul testo: correggi, copia, incolla, stacchi di scena, rigenera.
import { articolo, bottone, el } from './base.mjs';
import { eStacco, minuti } from './testo.mjs';
import { cap, paragrafi, passaggioDi, testoSenzaRimozioni } from './stato.mjs';
import { azione, dati } from './dati.mjs';
import { apriPassaggio, area, contestoPassaggio } from './editor.mjs';
import { apriRiepilogo, stato } from './pannello.mjs';

// Incolla sulla selezione: il testo degli appunti prende il posto di quello scelto dentro l'editor,
// con la stessa sintassi del capitolo, cioe' un paragrafo per riga e una riga vuota fra un paragrafo e l'altro.
export async function incollaSulTesto(contesto) {
  // Se il browser non lascia leggere gli appunti si apre comunque l'editor sulla selezione: basta Ctrl+V.
  let appunti = '';
  try { appunti = await navigator.clipboard.readText(); } catch { appunti = ''; }
  const pezzi = appunti.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(t => t.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const testo = pezzi.map(t => eStacco(t) ? '---' : t).join('\n\n');
  if (!await apriPassaggio(contesto)) return;
  if (!testo) { stato.textContent = 'Premi Ctrl+V per incollare al posto della selezione.'; return; }
  area.setRangeText(testo, area.selectionStart, area.selectionEnd, 'end');
  area.dispatchEvent(new Event('input', { bubbles: true }));
  area.focus({ preventScroll: true });
}
// Spostare uno stacco di scena: prima si dice da dove, poi si sceglie il paragrafo davanti al quale rimetterlo.
let staccoDaSpostare;
export function armaStacco(riga) {
  staccoDaSpostare = riga;
  document.body.classList.toggle('autore-sposta-stacco', riga !== undefined);
  if (riga !== undefined) stato.textContent = 'Scegli il paragrafo davanti al quale mettere lo stacco.';
}
export async function spostaStacco(riga) {
  const da = staccoDaSpostare;
  armaStacco();
  if (da === undefined || riga === undefined || riga === da) return;
  if (await apriRiepilogo()) azione('stacco', { capitolo: dati.capitolo, revisione: dati.revisione, riga: da, a: riga });
}
const menu = el('div', 'autore-menu');
menu.hidden = true;
menu.setAttribute('role', 'menu');
menu.setAttribute('aria-label', 'Azioni autore');

export function chiudiMenu() { menu.hidden = true; }

export function installaMenu() {
  articolo.addEventListener('click', e => {
    if (staccoDaSpostare === undefined) return;
    const p = e.target.closest?.('p');
    if (!p || !paragrafi().includes(p)) return;
    e.preventDefault();
    e.stopPropagation();
    spostaStacco(passaggioDi(p)?.riga);
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && staccoDaSpostare !== undefined) armaStacco(); });
  document.body.append(menu);
  if (!articolo.hasAttribute('tabindex')) articolo.tabIndex = 0;
  articolo.addEventListener('contextmenu', e => {
    if (e.target.closest('.autore-in-linea, .autore-confronto, .autore-controllo-diff')) return;
    // Anche senza frasi sincronizzate il menu dell'autore deve uscire: si ripiega sul paragrafo.
    const frase = e.target.closest('[data-i], .autore-proiezione:not(.autore-solo-diff)') || e.target.closest('p')?.querySelector('[data-i]') ||
      e.target.closest('p:not(.h)') || (e.target === articolo && e.button === 0 ? articolo.querySelector('[data-i].ora-qui') : null);
    if (!frase || !cap()) return;
    e.preventDefault();
    const selezione = getSelection();
    const contesto = contestoPassaggio(frase, selezione);
    if (e.target.closest('.autore-versione')) contesto.riferimento = undefined;
    const fraseVisibile = testoSenzaRimozioni(frase.querySelector(':scope > .autore-versione') || frase).trim();
    const intervallo = selezione?.rangeCount && selezione.getRangeAt(0);
    let copia = fraseVisibile;
    if (intervallo && !intervallo.collapsed && intervallo.intersectsNode(frase.closest('p'))) {
      const frammento = intervallo.cloneContents();
      copia = [...frammento.childNodes].map(n => testoSenzaRimozioni(n) + (n.nodeName === 'P' ? '\n\n' : '')).join('').trim() || copia;
    }
    const passaggioMenu = passaggioDi(paragrafi()[contesto.ordine]);
    const stacco = { riga: passaggioMenu?.riga, haStacco: !!passaggioMenu?.stacco };
    const voceMenu = (etichetta, esegui, disabilitato = false) => {
      const b = bottone(etichetta, () => { chiudiMenu(); esegui(); });
      b.setAttribute('role', 'menuitem');
      b.disabled = disabilitato;
      return b;
    };
    const bloccato = stacco.riga === undefined || !!dati?.bozza?.blocchi.length;
    const vociStacco = staccoDaSpostare !== undefined ? [
      voceMenu('Metti qui lo stacco di scena', () => spostaStacco(stacco.riga), bloccato || stacco.riga === staccoDaSpostare),
      voceMenu('Lascia lo stacco dov’è', () => armaStacco()),
    ] : [
      voceMenu(stacco.haStacco ? 'Togli lo stacco di scena' : 'Stacco di scena prima di qui', async () => {
        if (!await apriRiepilogo()) return;
        azione('stacco', { capitolo: dati.capitolo, revisione: dati.revisione, riga: stacco.riga, stacco: !stacco.haStacco });
      }, bloccato),
      ...(stacco.haStacco ? [voceMenu('Sposta lo stacco di scena', () => armaStacco(stacco.riga), bloccato)] : []),
    ];
    const selezionato = !!(contesto.evidenziata || contesto.blocco);
    menu.replaceChildren(
      el('div', 'autore-menu-frase', contesto.riferimento ? `Frase a ${minuti(contesto.riferimento.tempo)} · ${fraseVisibile}` : 'Testo modificato · audio precedente'),
      voceMenu(contesto.blocco?.a > contesto.blocco?.da ? 'Correggi paragrafi selezionati' : 'Correggi passaggio', () => apriPassaggio(contesto), contesto.ordine < 0),
      voceMenu('Copia testo', async () => {
        try { await navigator.clipboard.writeText(copia); }
        catch { if (await apriRiepilogo()) stato.textContent = 'Copia non riuscita.'; }
      }),
      ...(selezionato ? [voceMenu('Incolla sulla selezione', () => incollaSulTesto(contesto), contesto.ordine < 0)] : []),
      ...vociStacco,
      voceMenu('Rigenera la frase', async () => {
        if (await apriRiepilogo()) azione('rigenera', { capitolo: dati.capitolo, revisione: dati.revisione, ...contesto.riferimento });
      }, !contesto.riferimento),
    );
    menu.hidden = false;
    const rettangolo = frase.getBoundingClientRect();
    const x = e.clientX || rettangolo.left;
    const y = e.clientY || rettangolo.bottom;
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  });
  
  menu.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      chiudiMenu();
      articolo.focus({ preventScroll: true });
    } else if (e.key === 'Tab') chiudiMenu();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const voci = [...menu.querySelectorAll('button:not(:disabled)')];
      const indice = voci.indexOf(document.activeElement);
      voci[(indice + voci.length + (e.key === 'ArrowDown' ? 1 : -1)) % voci.length]?.focus();
    }
  });
  document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) chiudiMenu(); });
  addEventListener('scroll', chiudiMenu, true);
  addEventListener('resize', chiudiMenu);
}
