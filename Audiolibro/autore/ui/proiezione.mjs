// Il testo del lettore mostrato com’è e come diventerà: diff, proiezione della bozza e conteggi.
import { articolo, bottone, el } from './base.mjs';
import { allineaParagrafi, compatto, diffConRimozioni, eStacco, fettaDiff, normalizza, riepilogoParole,
  soloParagrafi, testoVisibile, unisci } from './testo.mjs';
import { cap, ornamentiDiff, paragrafi, paragrafiAudio, passaggioDi, testoLetto } from './stato.mjs';
import { dati } from './dati.mjs';
import { inserisciRimozioni, nodiTesto, rendiDiff } from './diff-testo.mjs';
import { apriPassaggio, contestoPassaggio, inLinea } from './editor.mjs';
import { aggiornaContatori } from './pannello.mjs';

export let mappaVisiva = new Map();
export let conteggiSalvati = new Map();

let evidenzeLettura = [];
const diffAperti = new Set();
let capitoloDiff;
export function aggiornaEvidenze() {
  if (typeof Highlight !== 'function' || !CSS.highlights) return;
  const aperte = evidenzeLettura.filter(r => r.startContainer.parentElement?.closest('p.autore-diff-aperto'));
  CSS.highlights.set('autore-modifiche', new Highlight(...aperte));
}

export function marcaParagrafo(p, chiave, haDiff) {
  p.classList.add('autore-paragrafo-modificato');
  const controlli = el('span', 'autore-controlli-paragrafo');
  if (haDiff) {
    const aggiorna = aperto => {
      p.classList.toggle('autore-diff-aperto', aperto);
      controllo.textContent = aperto ? 'Nascondi diff inline' : 'Mostra diff inline';
      controllo.setAttribute('aria-expanded', String(aperto));
    };
    const controllo = bottone('', () => {
      const apri = !diffAperti.has(chiave);
      if (apri) diffAperti.add(chiave);
      else diffAperti.delete(chiave);
      aggiorna(apri);
      aggiornaEvidenze();
    });
    controllo.className = 'autore-controllo-diff';
    controlli.append(controllo);
    aggiorna(diffAperti.has(chiave));
  }
  // Il paragrafo rimosso non esiste piu' nel testo: non c'e' niente da correggere.
  if (!p.classList.contains('autore-solo-diff')) {
    const modifica = bottone('Modifica', () => apriPassaggio(contestoPassaggio(p.querySelector('[data-i]') || p, null)));
    modifica.className = 'autore-controllo-diff';
    modifica.title = 'Correggi il passaggio';
    controlli.append(modifica);
  }
  if (controlli.childElementCount) p.append(controlli);
}
export function mostraModifiche() {
  if (inLinea.isConnected) return;
  if (capitoloDiff !== cap()) {
    diffAperti.clear();
    capitoloDiff = cap();
  }
  const evidenze = [];
  evidenzeLettura = evidenze;
  conteggiSalvati = new Map();
  mappaVisiva = new Map();
  articolo.querySelectorAll(':scope > .autore-proiezione').forEach(p => p.remove());
  const elencoParagrafi = paragrafiAudio();
  elencoParagrafi.forEach(p => {
    p.classList.remove('autore-sostituito', 'autore-senza-stacco', 'autore-con-stacco', 'autore-paragrafo-modificato', 'autore-diff-aperto', 'autore-audio-in-corso');
    p.querySelectorAll(ornamentiDiff).forEach(n => { if (!n.closest('.autore-versione')) n.remove(); });
  });
  if (dati?.capitolo === cap() && articolo.querySelector('[data-i]')) {
    if (dati.bozza?.blocchi.length || dati.lavori.some(j => j.tipo === 'modifica' && j.blocchi?.length)) {
      mostraProiezione(elencoParagrafi, evidenze);
      segnaLavorazione();
      aggiornaEvidenze();
      aggiornaContatori();
      return;
    }
    const perRiga = new Map();
    for (const j of dati.lavori) {
      // Con l'audio già rifatto non c'è più niente da confrontare: la modifica è storia.
      if (j.tipo !== 'modifica' || ['pronto', 'superato'].includes(j.stato)) continue;
      const primo = perRiga.get(j.riga);
      if (!primo) perRiga.set(j.riga, { dopo: j.dopo, prima: j.prima, versioni: new Set([j.prima]) });
      else if (j.dopo === primo.prima) { primo.prima = j.prima; primo.versioni.add(j.prima); }
    }
    elencoParagrafi.forEach((p, i) => {
      const passaggio = dati.passaggi[i];
      const lavoro = perRiga.get(passaggio?.riga);
      const esistente = p.querySelector(':scope > .autore-versione');
      const letto = testoLetto(p);
      const sincronizzato = lavoro && testoVisibile(lavoro.dopo).replace(/\s/g, '') === letto.replace(/\s/g, '');
      const primaLetta = lavoro && [...lavoro.versioni].some(v => normalizza(v) === normalizza(letto));
      if (!lavoro || lavoro.dopo !== passaggio?.testo || !(sincronizzato || primaLetta)) {
        esistente?.remove();
        p.classList.remove('autore-anteprima');
        return;
      }
      if (sincronizzato) {
        esistente?.remove();
        p.classList.remove('autore-anteprima');
        evidenziaDiff(p, diffConRimozioni(testoVisibile(lavoro.prima), letto), evidenze, `letto-${i}`);
      } else {
        conteggiSalvati.set(passaggio.riga, riepilogoParole(letto, testoVisibile(lavoro.dopo)));
        const anteprima = esistente || el('span', 'autore-versione');
        if (anteprima.dataset.testo !== lavoro.dopo || anteprima.dataset.prima !== lavoro.prima) {
          anteprima.dataset.testo = lavoro.dopo;
          anteprima.dataset.prima = lavoro.prima;
          const dopo = testoVisibile(lavoro.dopo);
          rendiDiff(anteprima, dopo, diffConRimozioni(testoVisibile(lavoro.prima), dopo));
        }
        if (!esistente) p.append(anteprima);
        p.classList.add('autore-anteprima');
        marcaParagrafo(p, `letto-${i}`, !!anteprima.querySelector('mark, .autore-rimozione'));
      }
    });
  }
  segnaLavorazione();
  aggiornaEvidenze();
  aggiornaContatori();
}

// I paragrafi la cui voce si sta rifacendo si distinguono da quelli ancora da accodare.
export function righeInLavorazione() {
  const righe = new Set();
  for (const j of dati?.lavori || []) {
    if (!['bozza', 'modifica'].includes(j.tipo) || j.revisione !== dati.revisione) continue;
    if (!['in coda', 'in generazione'].includes(j.stato)) continue;
    if (j.riga !== undefined) { righe.add(j.riga); continue; }
    let scarto = 0;
    for (const b of j.blocchi || []) {
      const quanti = soloParagrafi(b.dopo).length;
      for (const p of dati.passaggi.slice(b.ordine + scarto, b.ordine + scarto + quanti)) righe.add(p.riga);
      scarto += quanti - soloParagrafi(b.prima).length;
    }
  }
  return righe;
}

export function segnaLavorazione() {
  const righe = righeInLavorazione();
  for (const p of paragrafi()) {
    const r = passaggioDi(p)?.riga;
    p.classList.toggle('autore-audio-in-corso', r !== undefined && righe.has(r));
  }
}

export function mostraProiezione(letti, evidenze) {
  if (!letti.length || letti.length === 1 && dati.passaggi.length > 2) return;
  const fonte = [...dati.passaggi];
  for (const b of [...(dati.bozza?.blocchi || [])].reverse()) {
    const stacco = fonte[b.ordine]?.stacco;
    const nuovi = [];
    let seguente = stacco;
    for (const t of b.dopo) {
      if (eStacco(t)) { seguente = true; continue; }
      nuovi.push({ testo: t, riga: b.riga, fine: b.fine, stacco: seguente });
      seguente = false;
    }
    fonte.splice(b.ordine, soloParagrafi(b.prima).length, ...nuovi);
  }
  const prima = letti.map(testoLetto);
  const dopo = fonte.map(p => testoVisibile(p.testo));
  const gruppi = allineaParagrafi(prima.map(compatto), dopo.map(compatto));
  const corrispondenze = new Map(gruppi.filter(g => g.letto !== undefined && fonte[g.fonte].fine === undefined)
    .map(g => [fonte[g.fonte].riga, prima[g.letto]]));
  const storico = new Map();
  const applicata = dati.lavori.find(j => j.tipo === 'modifica' && j.revisione === dati.revisione && j.blocchi?.length
    && !['pronto', 'superato'].includes(j.stato));
  let scarto = 0;
  for (const b of applicata?.blocchi || []) {
    const dopoBlocco = soloParagrafi(b.dopo);
    const primaBlocco = soloParagrafi(b.prima);
    const passaggi = dati.passaggi.slice(b.ordine + scarto, b.ordine + scarto + dopoBlocco.length);
    const testi = passaggi.map(p => corrispondenze.get(p.riga));
    if (testi.length === dopoBlocco.length && testi.every((t, i) => t !== undefined && compatto(t) === compatto(dopoBlocco[i]))) {
      const diff = diffConRimozioni(unisci(primaBlocco.map(testoVisibile)), unisci(testi));
      let offset = 0;
      for (const [i, p] of passaggi.entries()) {
        storico.set(p.riga, fettaDiff(diff, offset, offset + testi[i].length));
        offset += testi[i].length + 2;
      }
    }
    scarto += dopoBlocco.length - primaBlocco.length;
  }
  for (const g of gruppi) {
    if (g.letto !== undefined) {
      const p = letti[g.letto];
      mappaVisiva.set(p, fonte[g.fonte]);
      const stacco = !!fonte[g.fonte].stacco;
      if (stacco !== p.classList.contains('st')) p.classList.add(stacco ? 'autore-con-stacco' : 'autore-senza-stacco');
      if (storico.has(fonte[g.fonte].riga)) evidenziaDiff(p, storico.get(fonte[g.fonte].riga), evidenze, `letto-${g.letto}`);
      continue;
    }
    const vecchio = unisci(prima.slice(g.da, g.a));
    const nuovo = unisci(dopo.slice(g.inizio, g.fine));
    const diff = diffConRimozioni(vecchio, nuovo);
    for (const p of letti.slice(g.da, g.a)) p.classList.add('autore-sostituito');
    const chiave = fonte[g.inizio]?.riga ?? `fine-${g.da}`;
    const conteggio = riepilogoParole(vecchio, nuovo);
    const cumulato = conteggiSalvati.get(chiave);
    conteggiSalvati.set(chiave, cumulato ? { piu: cumulato.piu + conteggio.piu, meno: cumulato.meno + conteggio.meno, audio: cumulato.audio + conteggio.audio } : conteggio);
    let offset = 0;
    for (let i = g.inizio; i < g.fine; i++) {
      const p = el('p', `autore-proiezione${fonte[i].stacco ? ' st' : ''}`);
      const t = dopo[i];
      const versione = el('span', 'autore-versione');
      const porzione = fettaDiff(diff, offset, offset + t.length);
      rendiDiff(versione, t, porzione);
      p.append(versione);
      marcaParagrafo(p, `fonte-${i}`, !!(porzione.aggiunte.length || porzione.rimozioni.length));
      offset += t.length + 2;
      mappaVisiva.set(p, fonte[i]);
      articolo.insertBefore(p, letti[g.da] || null);
    }
    if (g.inizio === g.fine) {
      const rimosso = el('p', 'autore-proiezione autore-solo-diff');
      inserisciRimozioni(rimosso, diff.rimozioni);
      rimosso.append(el('span', 'autore-paragrafo-rimosso', 'Paragrafo rimosso'));
      marcaParagrafo(rimosso, `rimosso-${g.da}`, !!diff.rimozioni.length);
      articolo.insertBefore(rimosso, letti[g.da] || null);
    }
  }
}
export function evidenziaDiff(p, { aggiunte, rimozioni }, evidenze, chiave) {
  if (p.contains(inLinea) || !(aggiunte.length || rimozioni.length)) return;
  inserisciRimozioni(p, rimozioni);
  marcaParagrafo(p, chiave, true);
  if (!aggiunte.length || typeof Highlight !== 'function') return;
  const giro = nodiTesto(p);
  let offset = 0;
  for (let nodo = giro.nextNode(); nodo; nodo = giro.nextNode()) {
    const fine = offset + nodo.length;
    for (const [a, b] of aggiunte) {
      if (a >= fine || b <= offset) continue;
      const r = document.createRange();
      r.setStart(nodo, Math.max(0, a - offset));
      r.setEnd(nodo, Math.min(fine, b) - offset);
      evidenze.push(r);
    }
    offset = fine;
  }
}
