// Da che capitolo e da che paragrafo si sta guardando il testo del lettore.
import { articolo } from './base.mjs';
import { dati } from './dati.mjs';
import { mappaVisiva } from './proiezione.mjs';
import { inLinea } from './editor.mjs';

export const cap = () => typeof corrente === 'number' ? corrente : Number(/^#(\d+)$/.exec(location.hash)?.[1]);
export const paragrafi = () => [...articolo.querySelectorAll(':scope > p:not(.h, .autore-sostituito, .autore-solo-diff, [hidden])')];
export const paragrafiAudio = () => [...articolo.querySelectorAll(':scope > p:not(.h, .autore-proiezione)')];
export const ornamentiDiff = '.autore-rimozione, .autore-controlli-paragrafo, .autore-controllo-diff, .autore-paragrafo-rimosso';
export function testoSenzaRimozioni(nodo) {
  if (nodo.matches?.(ornamentiDiff)) return '';
  if (!nodo.querySelector?.(ornamentiDiff)) return nodo.textContent;
  const copia = nodo.cloneNode(true);
  copia.querySelectorAll(ornamentiDiff).forEach(n => n.remove());
  return copia.textContent;
}
export const testoLetto = p => [...p.childNodes].filter(n => n !== inLinea && !n.matches?.('.autore-versione, .autore-confronto')).map(testoSenzaRimozioni).join('');
export const passaggioDi = p => mappaVisiva.get(p) || dati?.passaggi[paragrafiAudio().indexOf(p)];
