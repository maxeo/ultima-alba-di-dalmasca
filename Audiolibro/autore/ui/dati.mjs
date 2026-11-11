// Lettura del capitolo dal server dell’autore e comandi che ne cambiano lo stato.
import { api } from './base.mjs';
import { cap } from './stato.mjs';
import { aggiornaComandi, aggiornaContatori, stato } from './pannello.mjs';
import { aggiornaStatiLavori, disegnaLavori } from './lavori.mjs';
import { mostraModifiche } from './proiezione.mjs';

export let dati, erroreCaricamento;
let richiestaRiepilogo, lettura = 0, ultimaLettura = 0;

export async function aggiorna(n) {
  const numero = ++lettura;
  try {
    const nuovo = await api(`capitolo/${n}`);
    if (cap() !== n || numero < ultimaLettura) return;
    ultimaLettura = numero;
    if (dati?.capitolo !== n || erroreCaricamento?.capitolo === n) stato.textContent = `Capitolo ${n}`;
    erroreCaricamento = undefined;
    dati = nuovo;
    if (disegnaLavori()) mostraModifiche();
    aggiornaStatiLavori();
    aggiornaComandi();
    aggiornaContatori();
  } catch (e) {
    if (cap() === n && numero >= ultimaLettura) {
      ultimaLettura = numero;
      erroreCaricamento = { capitolo: n };
      stato.textContent = 'Aggiornamento delle modifiche non riuscito. Riprovo tra poco.';
      aggiornaContatori();
    }
    throw e;
  }
}
export function caricaRiepilogo(n = cap()) {
  aggiornaContatori();
  if (!n) return;
  if (richiestaRiepilogo?.capitolo === n) return richiestaRiepilogo.promessa;
  const richiesta = { capitolo: n };
  richiesta.promessa = aggiorna(n).finally(() => {
    if (richiestaRiepilogo === richiesta) richiestaRiepilogo = undefined;
  });
  richiestaRiepilogo = richiesta;
  return richiesta.promessa;
}
export async function azione(comando, corpo, dopo) {
  try {
    const risultato = await api(comando, corpo);
    await aggiorna(dati.capitolo);
    dopo?.();
    stato.textContent = comando === 'applica-bozza' ? 'Bozza applicata al testo. Audio precedente in uso.' : `Capitolo ${risultato.capitolo} · lavoro in coda`;
    return true;
  } catch (e) { stato.textContent = e.message; return false; }
}
