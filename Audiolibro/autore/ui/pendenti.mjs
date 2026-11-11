// Il lavoro che l'audio non ha ancora: quanto pesa e quale blocco tiene un dato paragrafo.
// Qui non si tocca il documento: sono conti puri sui dati del capitolo, e per questo si provano con i test.
import { riepilogoParole, soloParagrafi, testoVisibile, unisci } from './testo.mjs';

// Le correzioni che l'audio non ha ancora: quelle già nel testo ma non rilette, più la bozza da applicare.
export const lavoriPendenti = dati => (dati?.lavori || []).filter(j => j.tipo === 'modifica' && !['pronto', 'superato'].includes(j.stato));
const testoDelBlocco = v => unisci(soloParagrafi(v).map(testoVisibile));

export function conteggiPendenti(dati) {
  const conteggi = new Map();
  const somma = (riga, c) => {
    const avuto = conteggi.get(riga);
    conteggi.set(riga, avuto ? { piu: avuto.piu + c.piu, meno: avuto.meno + c.meno, audio: avuto.audio + c.audio } : c);
  };
  const perRiga = new Map();
  for (const j of lavoriPendenti(dati)) {
    if (j.blocchi?.length) for (const b of j.blocchi) somma(b.riga, riepilogoParole(testoDelBlocco(b.prima), testoDelBlocco(b.dopo)));
    // Più correzioni sullo stesso paragrafo: la voce è ferma alla più vecchia, quindi conta quella.
    else if (j.riga !== undefined) {
      const primo = perRiga.get(j.riga);
      if (!primo) perRiga.set(j.riga, { prima: j.prima, dopo: j.dopo });
      else if (j.dopo === primo.prima) primo.prima = j.prima;
    }
  }
  for (const [riga, v] of perRiga) somma(riga, riepilogoParole(testoVisibile(v.prima), testoVisibile(v.dopo)));
  for (const b of dati?.bozza?.blocchi || []) somma(b.riga, riepilogoParole(testoDelBlocco(b.prima), testoDelBlocco(b.dopo)));
  return conteggi;
}

// Quanti paragrafi il lavoro in sospeso può spiegare: oltre questi l'audio in uso è di un'altra versione.
export function paragrafiPendenti(dati) {
  let quanti = 0;
  const conta = b => { quanti += Math.max(soloParagrafi(b.prima).length, soloParagrafi(b.dopo).length); };
  for (const j of lavoriPendenti(dati)) {
    if (j.blocchi?.length) j.blocchi.forEach(conta);
    else if (j.riga !== undefined) quanti += 1;
  }
  (dati?.bozza?.blocchi || []).forEach(conta);
  return quanti;
}

// Il blocco ancora in sospeso che tiene questo paragrafo, com'è numerato nelle schede del pannello.
export function bloccoDelPassaggio(dati, n) {
  if (n === undefined || !dati) return undefined;
  const ripristinati = new Set(dati.lavori.map(j => j.ripristinaDi));
  for (const j of dati.lavori) {
    const suo = j.tipo === 'bozza' ? j.id === dati.bozza?.id
      : j.tipo === 'modifica' && !['pronto', 'superato'].includes(j.stato);
    if (!suo || ripristinati.has(j.id) || j.revisione !== dati.revisione) continue;
    if (!j.blocchi?.length) {
      if (j.riga === n) return { lavoro: j, indice: 0 };
      continue;
    }
    let scarto = 0;
    for (const [i, b] of j.blocchi.entries()) {
      const dopoBlocco = soloParagrafi(b.dopo);
      const righe = j.tipo === 'bozza' ? dati.passaggi.filter(p => p.riga >= b.riga && p.riga <= (b.fine ?? b.riga)).map(p => p.riga)
        : dati.passaggi.slice(b.ordine + scarto, b.ordine + scarto + dopoBlocco.length).map(p => p.riga);
      if (righe.includes(n)) return { lavoro: j, indice: i };
      if (j.tipo !== 'bozza') scarto += dopoBlocco.length - soloParagrafi(b.prima).length;
    }
  }
  return undefined;
}
