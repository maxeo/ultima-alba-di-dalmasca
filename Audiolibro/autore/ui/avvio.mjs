// Accende la modalità autore: monta le parti e tiene il pannello al passo con il lettore.
import { articolo, installaBase, pagina, voce } from './base.mjs';
import { cap, paragrafi, passaggioDi } from './stato.mjs';
import { caricaRiepilogo, dati } from './dati.mjs';
import { mostraModifiche } from './proiezione.mjs';
import { aggiornaContatori, chiudiConferma, installaPannello, pannello } from './pannello.mjs';
import { area, attaccaEditor, bloccoEditor, capitoloEditor, chiudiEditor, inLinea, installaEditor,
  riga } from './editor.mjs';
import { installaLavori } from './lavori.mjs';
import { chiudiMenu, installaMenu } from './menu.mjs';

function avvia() {
  installaBase();
  installaPannello();
  installaEditor();
  installaLavori();
  installaMenu();
  if (pagina) new MutationObserver(() => {
    aggiornaContatori();
    if (!pagina.classList.contains('nascosto') && cap() !== dati?.capitolo) caricaRiepilogo()?.catch(() => {});
  }).observe(pagina, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(eventi => {
    if (!eventi.some(e => [...e.addedNodes, ...e.removedNodes].some(p => !p.matches?.('.autore-proiezione')))) return;
    mostraModifiche();
    if (cap() !== dati?.capitolo) caricaRiepilogo()?.catch(() => {});
    if (capitoloEditor === cap() && !inLinea.isConnected) {
      const { inizio, lunghezza } = bloccoEditor;
      const nodi = paragrafi().slice(inizio, inizio + lunghezza);
      if (nodi.length === lunghezza && passaggioDi(nodi[0])?.riga === riga) { attaccaEditor(nodi); area.focus({ preventScroll: true }); }
    }
  }).observe(articolo, { childList: true });
  addEventListener('hashchange', () => {
    chiudiMenu();
    chiudiConferma();
    if (capitoloEditor !== cap()) chiudiEditor();
    caricaRiepilogo()?.catch(() => {});
  });
  setInterval(() => {
    const n = cap();
    if (n && !document.hidden && (!pannello.hidden || !pagina?.classList.contains('nascosto'))) caricaRiepilogo(n)?.catch(() => {});
  }, 2000);
  caricaRiepilogo()?.catch(() => {});
}

if (articolo && voce) avvia();
