function differenze(prima, dopo, rimozioni) {
  const token = t => [...t.matchAll(/[\p{L}\p{M}\p{N}]+|[^\s]/gu)];
  const A = token(prima), B = token(dopo);
  const aggiunte = [], rimosse = [], tagli = [];
  const segna = (intervalli, t, da, a) => {
    if (da < a) intervalli.push([t[da].index, t[a - 1].index + t[a - 1][0].length]);
  };
  let inizio = 0, fineA = A.length, fineB = B.length;
  while (inizio < fineA && inizio < fineB && A[inizio][0] === B[inizio][0]) inizio++;
  while (fineA > inizio && fineB > inizio && A[fineA - 1][0] === B[fineB - 1][0]) { fineA--; fineB--; }
  const na = fineA - inizio, nb = fineB - inizio;
  let daA = inizio, daB = inizio;
  const registra = (a, b) => {
    segna(rimosse, A, daA, a);
    segna(aggiunte, B, daB, b);
    if (a > daA && b === daB) tagli.push(B[b]?.index ?? dopo.length);
    if (rimozioni && a > daA) {
      const inizio = A[daA].index, fine = A[a - 1].index + A[a - 1][0].length;
      const primaTolto = A[daA - 1];
      const dopoTolto = A[a];
      const primaSpazio = !!primaTolto && inizio > primaTolto.index + primaTolto[0].length;
      const dopoSpazio = !!dopoTolto && dopoTolto.index > fine;
      const precedente = B[daB - 1];
      const prossima = B[daB]?.index ?? dopo.length;
      const posizione = daB !== b || primaSpazio ? prossima : precedente ? precedente.index + precedente[0].length : 0;
      const testo = prima.slice(inizio, fine);
      const paroleAdiacenti = /[\p{L}\p{N}]$/u.test(testo) && /^[\p{L}\p{N}]/u.test(dopo.slice(posizione));
      rimozioni.push({ posizione, testo,
        prima: primaSpazio && posizione > 0 && !/\s/.test(dopo[posizione - 1]) ? ' ' : '',
        dopo: (dopoSpazio || paroleAdiacenti) && posizione < dopo.length && !/\s/.test(dopo[posizione]) ? ' ' : '' });
    }
  };
  if (na && nb && na * nb <= 200000) {
    const L = Array.from({ length: na + 1 }, () => new Uint16Array(nb + 1));
    for (let a = na - 1; a >= 0; a--) for (let b = nb - 1; b >= 0; b--) {
      L[a][b] = A[inizio + a][0] === B[inizio + b][0] ? 1 + L[a + 1][b + 1] : Math.max(L[a + 1][b], L[a][b + 1]);
    }
    for (let a = 0, b = 0; a < na && b < nb;) {
      if (A[inizio + a][0] === B[inizio + b][0]) {
        registra(inizio + a, inizio + b);
        daA = inizio + ++a;
        daB = inizio + ++b;
      } else if (L[a + 1][b] >= L[a][b + 1]) a++;
      else b++;
    }
  }
  registra(fineA, fineB);
  return { aggiunte, rimosse, tagli };
}

function diffConRimozioni(prima, dopo) {
  const rimozioni = [];
  const { aggiunte } = differenze(prima, dopo, rimozioni);
  return { aggiunte, rimozioni };
}

function finestreDiff(testo, { aggiunte, rimozioni }) {
  const punti = [...aggiunte, ...rimozioni.map(r => [r.posizione, r.posizione])].sort((x, y) => x[0] - y[0]);
  if (!punti.length) punti.push([0, 0]);
  const finestre = [];
  for (const [da, a] of punti) {
    let inizio = Math.max(0, da - 38), fine = Math.min(testo.length, a + 38);
    while (inizio > 0 && !/\s/.test(testo[inizio - 1])) inizio--;
    while (fine < testo.length && !/\s/.test(testo[fine])) fine++;
    const ultima = finestre.at(-1);
    if (ultima && inizio <= ultima[1]) ultima[1] = Math.max(fine, ultima[1]);
    else finestre.push([inizio, fine]);
  }
  return finestre;
}

function fettaDiff(diff, da, a) {
  return {
    aggiunte: diff.aggiunte.filter(([x, y]) => x < a && y > da).map(([x, y]) => [Math.max(0, x - da), Math.min(a, y) - da]),
    rimozioni: diff.rimozioni.filter(r => r.posizione >= da && r.posizione <= a).map(r => ({ ...r, posizione: r.posizione - da })),
  };
}

function anteprimaDiff(testo, diff, [da, a], limite = 105) {
  const spazioRimozioni = diff.rimozioni.some(r => r.posizione >= da && r.posizione <= a) ? 20 : 0;
  const fino = Math.min(a, da + limite - spazioRimozioni);
  const spazio = testo.lastIndexOf(' ', fino);
  const fine = fino < a && spazio > da + limite / 2 ? spazio : fino;
  const fetta = fettaDiff(diff, da, fine);
  let budget = limite - (fine - da);
  let tagliata = fine < a;
  fetta.rimozioni = fetta.rimozioni.flatMap(r => {
    const lunghezza = r.prima.length + r.testo.length + r.dopo.length;
    if (lunghezza <= budget) { budget -= lunghezza; return [r]; }
    const caratteri = budget - r.prima.length - r.dopo.length - 1;
    budget = 0;
    tagliata = true;
    return caratteri > 0 ? [{ ...r, testo: r.testo.slice(0, caratteri).trimEnd() + '…' }] : [];
  });
  return { fine, diff: fetta, tagliata };
}

function puntoDiff(testo, diff, da, a) {
  const punti = [
    ...diff.aggiunte.filter(([x, y]) => x < a && y > da).map(([x]) => Math.max(x, da)),
    ...diff.rimozioni.map(r => r.posizione).filter(x => x >= da && x <= a),
  ];
  let offset = punti.length ? Math.min(...punti) : da;
  const paragrafi = testo.split('\n\n');
  for (let indice = 0; indice < paragrafi.length; indice++) {
    const p = paragrafi[indice];
    if (offset <= p.length || indice === paragrafi.length - 1) return { indice, testo: p, offset: Math.max(0, Math.min(offset, p.length)) };
    offset -= p.length + 2;
  }
}

function riepilogoParole(prima, dopo) {
  const { aggiunte, rimosse, tagli } = differenze(prima, dopo);
  const conta = t => (t.match(/[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu) || []).length;
  const paroleIn = (testo, parti) => parti.reduce((somma, [a, b]) => somma + conta(testo.slice(a, b)), 0);
  const segmentatore = new Intl.Segmenter('it', { granularity: 'sentence' });
  let audio = 0;
  for (const { segment, index } of segmentatore.segment(dopo)) {
    const fine = index + segment.length;
    if (aggiunte.some(([a, b]) => a < fine && b > index) || tagli.some(t => t >= index && (t < fine || t === dopo.length && t === fine))) audio += conta(segment);
  }
  if (!audio && (prima.match(/\n\s*\n/g)?.length || 0) !== (dopo.match(/\n\s*\n/g)?.length || 0)) audio = conta(dopo);
  return { piu: paroleIn(dopo, aggiunte), meno: paroleIn(prima, rimosse), audio };
}

function allineaParagrafi(prima, dopo) {
  const L = Array.from({ length: prima.length + 1 }, () => new Uint32Array(dopo.length + 1));
  for (let a = prima.length - 1; a >= 0; a--) for (let b = dopo.length - 1; b >= 0; b--) {
    L[a][b] = prima[a] === dopo[b] ? L[a + 1][b + 1] + 1 : Math.max(L[a + 1][b], L[a][b + 1]);
  }
  const gruppi = [];
  let da = 0, inizio = 0;
  const cambio = (a, fine) => { if (da !== a || inizio !== fine) gruppi.push({ da, a, inizio, fine }); };
  for (let a = 0, b = 0; a < prima.length && b < dopo.length;) {
    if (prima[a] === dopo[b]) {
      cambio(a, b);
      gruppi.push({ letto: a++, fonte: b++ });
      da = a;
      inizio = b;
    } else if (L[a + 1][b] >= L[a][b + 1]) a++;
    else b++;
  }
  cambio(prima.length, dopo.length);
  return gruppi;
}

function statoCaricamentoAutore(capitolo, capitoloCaricato, testo, capitoloInErrore) {
  if (!capitolo) return 'nessun-capitolo';
  if (testo === 'errore' || capitolo === capitoloInErrore && capitolo !== capitoloCaricato) return 'errore';
  return capitolo === capitoloCaricato && testo === 'pronto' ? 'pronto' : 'caricamento';
}

if (typeof module === 'object' && module.exports) module.exports = { differenze, riepilogoParole, diffConRimozioni, puntoDiff, statoCaricamentoAutore, anteprimaDiff };
else (() => {
  if (new URLSearchParams(location.search).get('write') !== 'true') return;
  const apiBase = '/__autore/';
  const articolo = document.getElementById('articolo');
  const pagina = document.getElementById('pagina');
  const voce = document.getElementById('a');
  if (!articolo || !voce) return;

  const el = (tag, classe, testo) => {
    const nodo = document.createElement(tag);
    if (classe) nodo.className = classe;
    if (testo) nodo.textContent = testo;
    return nodo;
  };
  const bottone = (testo, f) => {
    const b = el('button', '', testo);
    b.type = 'button';
    b.addEventListener('click', f);
    return b;
  };
  const css = el('link');
  css.rel = 'stylesheet';
  css.href = apiBase + 'ui.css';
  document.head.append(css);

  const tooltip = el('div', 'autore-tooltip');
  tooltip.id = 'autore-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  let bersaglioTooltip;
  function nascondiTooltip(b = bersaglioTooltip) {
    if (!b || b !== bersaglioTooltip) return;
    b.removeAttribute('aria-describedby');
    bersaglioTooltip = undefined;
    tooltip.hidden = true;
  }
  function tooltipSu(b, descrizione) {
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
  window.addEventListener('scroll', () => nascondiTooltip(), true);
  window.addEventListener('resize', () => nascondiTooltip());

  const pannello = el('aside', 'autore-pannello');
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
  const stato = el('p', 'autore-stato');
  stato.setAttribute('role', 'status');
  const avvisoCarico = el('p', 'autore-didascalia');
  avvisoCarico.setAttribute('role', 'status');
  const area = el('textarea');
  area.rows = 1;
  area.setAttribute('aria-label', 'Testo del passaggio');
  const inLinea = el('span', 'autore-in-linea');
  const griglia = el('span', 'autore-griglia');
  const specchio = el('span', 'autore-specchio');
  specchio.setAttribute('aria-hidden', 'true');
  griglia.append(specchio, area);
  const salva = bottone('Salva bozza locale', salvaInLinea);
  salva.className = 'autore-primario';
  const annulla = bottone('Annulla', () => chiudiEditor(true));
  const riscontro = el('span', 'autore-riscontro');
  riscontro.setAttribute('role', 'status');
  const azioniInLinea = el('span', 'autore-azioni');
  azioniInLinea.append(salva, annulla, riscontro);
  inLinea.append(griglia, azioniInLinea);
  const bottoneIcona = (etichetta, disegno, clic, mostraEtichetta = false) => {
    const b = bottone('', clic);
    b.className = 'autore-icona-azione';
    tooltipSu(b, etichetta);
    b.setAttribute('aria-label', etichetta);
    disegno.setAttribute('aria-hidden', 'true');
    b.append(disegno);
    if (mostraEtichetta) b.append(etichetta);
    return b;
  };
  const aggiornaAudio = bottoneIcona('Aggiorna audio del capitolo', icona('i-cuffie'), () => {
    const j = lavoroAudio();
    if (j && !aggiornaAudio.hidden) chiediConferma(aggiornaAudio, 'aggiorna-audio', j.id, 'Accodare l’aggiornamento audio del capitolo?');
  }, true);
  const applicaBozza = bottoneIcona('Applica bozza al testo', icona('i-casella-ok'), () => {
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
  const accettaConferma = bottone('Conferma', eseguiConferma);
  const annullaConferma = bottone('Annulla', () => chiudiConferma(true));
  richiestaConferma.append(testoConferma, accettaConferma, annullaConferma);
  const conferma = el('footer', 'autore-azioni autore-conferma');
  conferma.append(applicaBozza, aggiornaAudio, richiestaConferma);
  const elenco = el('div', 'autore-lavori');
  pannello.append(barra, stato, avvisoCarico, elenco, conferma);
  const apri = bottone('Autore', apriRiepilogo);
  apri.className = 'autore-apri';
  apri.setAttribute('aria-expanded', 'false');
  apri.addEventListener('mousedown', e => e.preventDefault());
  document.body.classList.add('autore-disponibile');
  document.body.append(apri, pannello);
  const pendenti = bottone('', apriRiepilogo);
  pendenti.className = 'autore-pendenti';
  pendenti.hidden = true;
  pendenti.setAttribute('aria-expanded', 'false');
  const piu = el('span', 'autore-piu');
  const meno = el('span', 'autore-meno');
  const stimaAudio = el('span', 'autore-stima-audio');
  const carico = el('span', 'autore-caricamento');
  pendenti.append(carico, piu, meno, stimaAudio);
  const titoloContatore = 'Parole aggiunte e rimosse rispetto all’audio in uso. La stima audio conta le parole nelle frasi interessate.';
  tooltipSu(pendenti, () => pendenti.dataset.tooltip);
  pagina?.querySelector('header')?.append(pendenti);

  let dati, revisioneEditor, riga, originale, riferimento, sigla, capitoloEditor, salvando = false;
  let conteggiSalvati = new Map();
  let mappaVisiva = new Map(), bloccoEditor, nodiEditor = [];
  const tabSelezione = crypto.randomUUID();
  let sequenzaSelezione = 0, timerSelezione;
  let azioneDaConfermare;
  let erroreCaricamento, richiestaRiepilogo, lettura = 0, ultimaLettura = 0;
  const normalizza = t => t.normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
  const cap = () => typeof corrente === 'number' ? corrente : Number(/^#(\d+)$/.exec(location.hash)?.[1]);
  const minuti = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const paragrafi = () => [...articolo.querySelectorAll(':scope > p:not(.h, .autore-sostituito, .autore-solo-diff)')];
  const paragrafiAudio = () => [...articolo.querySelectorAll(':scope > p:not(.h, .autore-proiezione)')];
  const ornamentiDiff = '.autore-rimozione, .autore-controllo-diff, .autore-paragrafo-rimosso';
  function testoSenzaRimozioni(nodo) {
    if (nodo.matches?.(ornamentiDiff)) return '';
    if (!nodo.querySelector?.(ornamentiDiff)) return nodo.textContent;
    const copia = nodo.cloneNode(true);
    copia.querySelectorAll(ornamentiDiff).forEach(n => n.remove());
    return copia.textContent;
  }
  const testoLetto = p => [...p.childNodes].filter(n => n !== inLinea && !n.matches?.('.autore-versione, .autore-confronto')).map(testoSenzaRimozioni).join('');
  const testoVisibile = t => t.replace(/[*_]/g, '');
  const compatto = t => testoVisibile(t).replace(/\s/g, '');
  const unisci = v => v.join('\n\n');
  const passaggioDi = p => mappaVisiva.get(p) || dati?.passaggi[paragrafiAudio().indexOf(p)];

  function colora(nodo, testo, intervalli) {
    const parti = [];
    let da = 0;
    for (const [a, b] of intervalli) {
      parti.push(testo.slice(da, a), el('mark', '', testo.slice(a, b)));
      da = b;
    }
    nodo.replaceChildren(...parti, testo.slice(da));
  }

  function nodiTesto(nodo) {
    return document.createTreeWalker(nodo, NodeFilter.SHOW_TEXT, {
      acceptNode: t => t.length && !t.parentElement.closest(ornamentiDiff) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
  }

  function inserisciRimozioni(nodo, rimozioni) {
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

  function rendiDiff(nodo, testo, diff) {
    colora(nodo, testo, diff.aggiunte);
    inserisciRimozioni(nodo, diff.rimozioni);
  }

  function confrontoModifiche(prima, dopo, vai) {
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
  function paragrafoDelDiff(testo, riga, indice = 0) {
    const tutti = paragrafi();
    const ancorati = riga === undefined ? [] : tutti.filter(p => passaggioDi(p)?.riga === riga);
    const testoDel = p => testoSenzaRimozioni(p.querySelector(':scope > .autore-versione') || p);
    const coincide = p => p && compatto(testoDel(p)) === compatto(testo);
    const corrispondenze = tutti.filter(coincide);
    let p = ancorati[indice];
    if (!coincide(p)) p = ancorati.find(coincide) || (corrispondenze.length === 1 ? corrispondenze[0] : p);
    return p;
  }

  function apriTesto() {
    if (pagina?.classList.contains('nascosto') && typeof apriPagina === 'function') apriPagina();
    if (typeof staccaSegui === 'function') staccaSegui();
  }

  function vaiAllaModifica(punto, riga, indice = 0) {
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

  let evidenzeLettura = [];
  const diffAperti = new Set();
  let capitoloDiff;
  function aggiornaEvidenze() {
    if (typeof Highlight !== 'function' || !CSS.highlights) return;
    const aperte = evidenzeLettura.filter(r => r.startContainer.parentElement?.closest('p.autore-diff-aperto'));
    CSS.highlights.set('autore-modifiche', new Highlight(...aperte));
  }

  function marcaParagrafo(p, chiave, haDiff) {
    p.classList.add('autore-paragrafo-modificato');
    if (!haDiff) return;
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
    p.append(controllo);
    aggiorna(diffAperti.has(chiave));
  }

  function mostraModifiche() {
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
      p.classList.remove('autore-sostituito', 'autore-senza-stacco', 'autore-con-stacco', 'autore-paragrafo-modificato', 'autore-diff-aperto');
      p.querySelectorAll(ornamentiDiff).forEach(n => { if (!n.closest('.autore-versione')) n.remove(); });
    });
    if (dati?.capitolo === cap() && articolo.querySelector('[data-i]')) {
      if (dati.bozza?.blocchi.length || dati.lavori.some(j => j.tipo === 'modifica' && j.blocchi?.length)) {
        mostraProiezione(elencoParagrafi, evidenze);
        aggiornaEvidenze();
        aggiornaContatori();
        return;
      }
      const perRiga = new Map();
      for (const j of dati.lavori) {
        if (j.tipo !== 'modifica') continue;
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
    aggiornaEvidenze();
    aggiornaContatori();
  }

  function mostraProiezione(letti, evidenze) {
    if (!letti.length || letti.length === 1 && dati.passaggi.length > 2) return;
    const fonte = [...dati.passaggi];
    for (const b of [...(dati.bozza?.blocchi || [])].reverse()) {
      const stacco = fonte[b.ordine]?.stacco;
      fonte.splice(b.ordine, b.prima.length, ...b.dopo.map((testo, i) => ({ testo, riga: b.riga, fine: b.fine, stacco: i === 0 && stacco })));
    }
    const prima = letti.map(testoLetto);
    const dopo = fonte.map(p => testoVisibile(p.testo));
    const gruppi = allineaParagrafi(prima.map(compatto), dopo.map(compatto));
    const corrispondenze = new Map(gruppi.filter(g => g.letto !== undefined && fonte[g.fonte].fine === undefined)
      .map(g => [fonte[g.fonte].riga, prima[g.letto]]));
    const storico = new Map();
    const applicata = dati.lavori.find(j => j.tipo === 'modifica' && j.revisione === dati.revisione && j.blocchi?.length);
    let scarto = 0;
    for (const b of applicata?.blocchi || []) {
      const passaggi = dati.passaggi.slice(b.ordine + scarto, b.ordine + scarto + b.dopo.length);
      const testi = passaggi.map(p => corrispondenze.get(p.riga));
      if (testi.length === b.dopo.length && testi.every((t, i) => t !== undefined && compatto(t) === compatto(b.dopo[i]))) {
        const diff = diffConRimozioni(unisci(b.prima.map(testoVisibile)), unisci(testi));
        let offset = 0;
        for (const [i, p] of passaggi.entries()) {
          storico.set(p.riga, fettaDiff(diff, offset, offset + testi[i].length));
          offset += testi[i].length + 2;
        }
      }
      scarto += b.dopo.length - b.prima.length;
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

  function aggiornaContatori() {
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
    if (!pronto) {
      const etichetta = fase === 'caricamento' ? 'Caricamento modifiche…' : 'Modifiche non disponibili';
      if (carico.textContent !== etichetta) carico.textContent = etichetta;
      pendenti.hidden = carico.hidden;
      pendenti.dataset.tooltip = avviso || '';
      pendenti.setAttribute('aria-label', etichetta);
      apri.hidden = !pendenti.hidden && !pagina?.classList.contains('nascosto');
      return;
    }
    pendenti.dataset.tooltip = titoloContatore;
    const conteggi = new Map(conteggiSalvati);
    if (inLinea.isConnected && area.value.trim() !== originale) {
      for (const n of bloccoEditor.righe) conteggi.delete(n);
      conteggi.set(riga, riepilogoParole(bloccoEditor.prima, testoVisibile(area.value.trim())));
    }
    pendenti.hidden = conteggi.size === 0;
    apri.hidden = !pendenti.hidden && !pagina?.classList.contains('nascosto');
    if (pendenti.hidden) return;
    const totale = { piu: 0, meno: 0, audio: 0 };
    for (const c of conteggi.values()) for (const chiave of Object.keys(totale)) totale[chiave] += c[chiave];
    piu.textContent = `+${totale.piu}`;
    meno.textContent = `−${totale.meno}`;
    stimaAudio.textContent = `≈ ${totale.audio} parole audio`;
    pendenti.setAttribute('aria-label', `Modifiche pendenti, ${totale.piu} parole aggiunte, ${totale.meno} rimosse, circa ${totale.audio} parole di audio da aggiornare`);
  }

  function evidenziaDiff(p, { aggiunte, rimozioni }, evidenze, chiave) {
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

  async function api(route, dati) {
    const r = await fetch(apiBase + route, dati ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati),
    } : { cache: 'no-store' });
    const risultato = await r.json();
    if (!r.ok) throw new Error(risultato.errore || 'Operazione non riuscita.');
    return risultato;
  }

  function aggiornaSelezione() {
    clearTimeout(timerSelezione);
    timerSelezione = setTimeout(() => {
      if (!inLinea.isConnected || capitoloEditor !== cap() || !bloccoEditor) return;
      const dati = { capitolo: capitoloEditor, revisione: revisioneEditor, riga, fine: bloccoEditor.fine,
        testo: area.value, da: area.selectionStart, a: area.selectionEnd, riferimento };
      api('selezione', { tab: tabSelezione, seq: ++sequenzaSelezione, dati }).catch(() => {});
    }, 50);
  }

  function liberaSelezione() {
    clearTimeout(timerSelezione);
    if (capitoloEditor === undefined) return;
    const corpo = JSON.stringify({ tab: tabSelezione, seq: ++sequenzaSelezione, dati: null });
    navigator.sendBeacon(apiBase + 'selezione', new Blob([corpo], { type: 'application/json' }));
  }

  function lavoroAudio() {
    return dati?.lavori.find(x => ['modifica', 'rigenera', 'scegli'].includes(x.tipo));
  }

  function chiediConferma(origine, comando, id, domanda) {
    if (accettaConferma.disabled) return;
    azioneDaConfermare?.origine.setAttribute('aria-expanded', 'false');
    azioneDaConfermare = { origine, comando, id };
    origine.setAttribute('aria-expanded', 'true');
    testoConferma.textContent = domanda;
    richiestaConferma.hidden = false;
    annullaConferma.focus();
  }

  function chiudiConferma(focus = false) {
    const origine = azioneDaConfermare?.origine;
    azioneDaConfermare = undefined;
    origine?.setAttribute('aria-expanded', 'false');
    richiestaConferma.hidden = true;
    if (focus && !origine?.hidden) origine?.focus();
  }

  async function eseguiConferma() {
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

  function aggiornaComandi() {
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

  function scegliPassaggio(n) {
    chiudiEditor();
    const p = dati?.passaggi.find(x => x.riga === n);
    riga = p?.riga;
    originale = p?.testo || '';
    area.value = originale;
    area.disabled = !p;
    revisioneEditor = dati?.revisione;
    aggiornaComandi();
  }

  function chiudiEditor(focus = false) {
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

  function paragrafoDi(n) {
    if (mappaVisiva.size) return paragrafi().find(p => passaggioDi(p)?.riga === n);
    const i = dati?.passaggi.findIndex(x => x.riga === n);
    const p = paragrafi()[i];
    if (!p) return;
    const letto = normalizza(testoLetto(p));
    if (letto === normalizza(dati.passaggi[i].testo) || dati.lavori.some(j => j.tipo === 'modifica' && j.riga === n && [j.prima, j.dopo].some(t => normalizza(t) === letto))) return p;
  }

  function aggiornaBozza() {
    const { aggiunte, rimosse } = differenze(originale, area.value);
    colora(specchio, area.value + '\u200b', aggiunte);
    inLinea.querySelector(':scope > .autore-confronto')?.remove();
    if (rimosse.length) inLinea.append(confrontoModifiche(originale, area.value));
    aggiornaComandi();
    aggiornaContatori();
  }

  function attaccaEditor(paragrafi) {
    nodiEditor = paragrafi;
    const [primo, ...seguito] = paragrafi;
    primo.classList.add('autore-in-modifica');
    seguito.forEach(p => p.classList.add('autore-blocco-seguente'));
    primo.append(inLinea);
  }

  function posizioneNelTesto(testo, prefisso, avanza) {
    let restanti = compatto(prefisso).length;
    let i = 0;
    for (; i < testo.length && restanti > 0; i++) if (compatto(testo[i])) restanti--;
    if (avanza) while (i < testo.length && /\s/.test(testo[i])) i++;
    return i;
  }

  function modificaInLinea(evidenziata = '', bozza, selezione) {
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
      prima: unisci(base.map(p => testoVisibile(p.testo))), bozza: dati.bozza?.id ?? null };
    originale = unisci(voci.map(p => p.testo));
    capitoloEditor = cap();
    area.value = bozza ?? originale;
    area.disabled = false;
    riscontro.textContent = '';
    attaccaEditor(nodi);
    aggiornaBozza();
    const valore = area.value;
    const trovato = evidenziata ? valore.indexOf(evidenziata) : -1;
    const offset = i => voci.slice(0, i - inizio).reduce((n, p) => n + p.testo.length + 2, 0);
    const haSelezione = selezione?.inizio !== undefined;
    const sinistra = haSelezione ? offset(da) + posizioneNelTesto(primo.testo, selezione.inizio, true) : trovato;
    const destra = haSelezione ? offset(a) + posizioneNelTesto(ultimo.testo, selezione.fine, false) : trovato + evidenziata.length;
    area.focus({ preventScroll: true });
    area.setSelectionRange(sinistra < 0 ? valore.length : sinistra, sinistra < 0 ? valore.length : Math.max(sinistra, destra));
    aggiornaSelezione();
    inLinea.scrollIntoView({ block: 'nearest' });
  }

  function bozzaAperta() {
    if (capitoloEditor !== cap() || !salvando && area.value.trim() === originale) return false;
    riscontro.textContent = 'Salva o annulla la modifica aperta.';
    area.focus({ preventScroll: true });
    return true;
  }

  async function salvaInLinea() {
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

  function riferimentoDelCue(c) {
    return c && { tempo: c.t, testoLetto: c.testo };
  }

  function audioDelPassaggio(n) {
    const p = paragrafoDi(n);
    if (!p || typeof cue === 'undefined') return undefined;
    return riferimentoDelCue(cue[Number(p.querySelector('[data-i]')?.dataset.i)]);
  }

  function bloccoConAzioni(anteprima, j, indice, dopo, righe) {
    const locale = j.tipo === 'bozza';
    const blocco = el('div', 'autore-blocco-diff');
    const comandi = el('div', 'autore-azioni-blocco');
    const richiesta = el('div', 'autore-ripristino');
    richiesta.hidden = true;
    const domanda = el('span', '', locale ? 'Scartare questo blocco della bozza?' : 'Ripristinare il testo precedente di questo blocco?');
    const svg = 'http://www.w3.org/2000/svg';
    const matita = document.createElementNS(svg, 'svg');
    matita.setAttribute('class', 'ic');
    matita.setAttribute('viewBox', '0 0 24 24');
    const tratto = document.createElementNS(svg, 'path');
    tratto.setAttribute('d', 'm3 17.25 11.9-11.9 3.75 3.75L6.75 21H3zM16.3 3.95l1.4-1.4a1 1 0 0 1 1.4 0l2.35 2.35a1 1 0 0 1 0 1.4l-1.4 1.4z');
    matita.append(tratto);
    const modifica = bottoneIcona('Modifica', matita, () => {
      if (bozzaAperta()) return;
      if (inLinea.isConnected) chiudiEditor();
      const tutti = paragrafi();
      const nodi = dopo.map((t, i) => paragrafoDelDiff(t, righe[i], locale ? i : 0));
      const da = tutti.indexOf(nodi[0]);
      const a = tutti.indexOf(nodi.at(-1));
      if (da < 0 || a < da || nodi.some(p => !p)) { stato.textContent = 'Il blocco non è disponibile nel testo corrente.'; return; }
      apriTesto();
      const riga = passaggioDi(tutti[da])?.riga;
      riferimento = audioDelPassaggio(riga);
      scegliPassaggio(riga);
      modificaInLinea('', undefined, { da, a });
    });
    const ripristina = bottoneIcona('Ripristina', icona('i-ripristina'), () => {
      if (bozzaAperta()) return;
      richiesta.hidden = false;
      comandi.hidden = true;
      annulla.focus();
    });
    const conferma = bottone('Conferma', async () => {
      conferma.disabled = annulla.disabled = true;
      try {
        await api('ripristina', { id: j.id, indice });
        if (cap() !== j.capitolo) return;
        await aggiorna(j.capitolo);
        stato.textContent = locale ? 'Blocco rimosso dalla bozza.' : 'Testo del blocco ripristinato.';
      } catch (e) {
        domanda.textContent = e.message;
        conferma.disabled = annulla.disabled = false;
      }
    });
    const annulla = bottone('Annulla', () => {
      richiesta.hidden = true;
      comandi.hidden = false;
      ripristina.focus();
    });
    conferma.className = 'autore-ripristina';
    richiesta.append(domanda, conferma, annulla);
    comandi.append(modifica, ripristina);
    blocco.append(anteprima, comandi, richiesta);
    return blocco;
  }

  function disegnaLavori() {
    const firma = JSON.stringify([dati.revisione, dati.lavori]);
    if (firma === sigla) return false;
    sigla = firma;
    elenco.replaceChildren();
    const attuale = dati.lavori.find(j => j.tipo === 'modifica' && j.revisione === dati.revisione);
    const ripristinati = new Set(dati.lavori.map(j => j.ripristinaDi));
    for (const j of dati.lavori) {
      if (j.tipo === 'bozza' && (j.id !== dati.bozza?.id || !j.blocchi.length)) continue;
      if (ripristinati.has(j.id) || j.ripristinaDi && !j.blocchi.length) continue;
      if (['rigenera', 'scegli'].includes(j.tipo) && j.stato === 'pronto' && !j.segnalazioni?.length) continue;
      const box = el('details');
      const nomi = { bozza: 'Testo', modifica: 'Testo', prese: 'Prese audio', rigenera: 'Nuova lettura', scegli: 'Presa scelta', proposta: 'Proposta di testo' };
      const valido = j.revisione === dati.revisione;
      const stato = !valido && ['prese', 'proposta'].includes(j.tipo) ? 'superato' : j.stato;
      box.open = j.tipo === 'bozza' || valido && (j.tipo === 'modifica' || ['prese', 'proposta'].includes(j.tipo) && ['pronto', 'proposta'].includes(j.stato));
      box.append(el('summary', '', `${nomi[j.tipo]} · ${stato}${j.segnalazioni?.length ? ' · da controllare' : ''}`));
      const azionabile = j.tipo === 'bozza' || j === attuale;
      if (j.prima) {
        const anteprima = confrontoModifiche(j.prima, j.dopo, p => vaiAllaModifica(p, valido ? j.riga : undefined));
        box.append(azionabile ? bloccoConAzioni(anteprima, j, 0, [j.dopo], [j.riga]) : anteprima);
      }
      let scarto = 0;
      for (const [i, b] of (j.blocchi || []).entries()) {
        const righe = j.tipo === 'bozza' ? b.dopo.map(() => b.riga) : valido
          ? dati.passaggi.slice(b.ordine + scarto, b.ordine + scarto + b.dopo.length).map(p => p.riga) : [];
        const anteprima = confrontoModifiche(unisci(b.prima), unisci(b.dopo), p => vaiAllaModifica(p, righe[p.indice], j.tipo === 'bozza' ? p.indice : 0));
        box.append(azionabile ? bloccoConAzioni(anteprima, j, i, b.dopo, righe) : anteprima);
        scarto += b.dopo.length - b.prima.length;
      }
      if (j.frase) box.append(el('p', 'autore-didascalia', j.frase.replace(/\[[^\]]*\]/g, ' ')));
      if (j.errore) {
        box.append(el('p', 'autore-errore', j.errore));
        if (valido) box.append(bottone('Riprova', () => azione('riprova', { id: j.id })));
      }
      if (j.segnalazioni?.length) {
        const avvisi = el('ul');
        for (const p of j.segnalazioni) avvisi.append(el('li', '', `${p.tempo} · ${p.audio || p.testo}`));
        box.append(avvisi);
      }
      if (valido && j.tipo === 'proposta') box.append(bottone('Usa come bozza', () => {
        if (bozzaAperta()) return;
        riferimento = audioDelPassaggio(j.riga);
        scegliPassaggio(j.riga);
        modificaInLinea('', j.dopo);
      }));
      if (j.prese) for (const k of j.prese) {
        const r = el('div', 'autore-presa');
        const etichetta = k === 0 ? 'Lettura attuale' : `Presa ${k}`;
        const sample = el('audio');
        sample.controls = true;
        sample.preload = 'none';
        sample.src = `${apiBase}prese/${j.id}/${k}.mp3`;
        sample.setAttribute('aria-label', etichetta);
        sample.addEventListener('play', () => {
          voce.pause();
          for (const altro of elenco.querySelectorAll('audio')) if (altro !== sample) altro.pause();
        });
        r.append(el('span', '', etichetta), sample);
        if (k && valido) r.append(bottone(`Usa presa ${k}`, () => azione('scegli', { id: j.id, presa: k })));
        box.append(r);
      }
      elenco.append(box);
    }
    if (!elenco.childElementCount) elenco.append(el('p', 'autore-didascalia', 'Per iniziare, seleziona il testo nel capitolo e scegli Correggi dal menu del clic destro. Qui troverai i diff e le azioni disponibili.'));
    return true;
  }

  async function aggiorna(n) {
    const numero = ++lettura;
    try {
      const nuovo = await api(`capitolo/${n}`);
      if (cap() !== n || numero < ultimaLettura) return;
      ultimaLettura = numero;
      if (dati?.capitolo !== n || erroreCaricamento?.capitolo === n) stato.textContent = `Capitolo ${n}`;
      erroreCaricamento = undefined;
      dati = nuovo;
      if (disegnaLavori()) mostraModifiche();
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

  function caricaRiepilogo(n = cap()) {
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

  function contestoPassaggio(frase, selezione = getSelection()) {
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

  async function apriRiepilogo() {
    pannello.hidden = false;
    document.body.classList.add('autore-aperto');
    apri.setAttribute('aria-expanded', 'true');
    pendenti.setAttribute('aria-expanded', 'true');
    const n = cap();
    try { await caricaRiepilogo(n); return n && cap() === n; }
    catch { return false; }
  }

  async function apriPassaggio(contesto) {
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

  async function azione(comando, corpo, dopo) {
    try {
      const risultato = await api(comando, corpo);
      await aggiorna(dati.capitolo);
      dopo?.();
      stato.textContent = comando === 'applica-bozza' ? 'Bozza applicata al testo. Audio precedente in uso.' : `Capitolo ${risultato.capitolo} · lavoro in coda`;
      return true;
    } catch (e) { stato.textContent = e.message; return false; }
  }

  const menu = el('div', 'autore-menu');
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Azioni autore');
  document.body.append(menu);
  if (!articolo.hasAttribute('tabindex')) articolo.tabIndex = 0;

  function chiudiMenu() { menu.hidden = true; }

  articolo.addEventListener('contextmenu', e => {
    if (e.target.closest('.autore-in-linea, .autore-confronto, .autore-controllo-diff')) return;
    const frase = e.target.closest('[data-i], .autore-proiezione:not(.autore-solo-diff)') || e.target.closest('p')?.querySelector('[data-i]') ||
      (e.target === articolo && e.button === 0 ? articolo.querySelector('[data-i].ora-qui') : null);
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
    const voceMenu = (etichetta, esegui, disabilitato = false) => {
      const b = bottone(etichetta, () => { chiudiMenu(); esegui(); });
      b.setAttribute('role', 'menuitem');
      b.disabled = disabilitato;
      return b;
    };
    menu.replaceChildren(
      el('div', 'autore-menu-frase', contesto.riferimento ? `Frase a ${minuti(contesto.riferimento.tempo)} · ${fraseVisibile}` : 'Testo modificato · audio precedente'),
      voceMenu(contesto.blocco?.a > contesto.blocco?.da ? 'Correggi paragrafi selezionati' : 'Correggi passaggio', () => apriPassaggio(contesto), contesto.ordine < 0),
      voceMenu('Rigenera la frase', async () => {
        if (await apriRiepilogo()) azione('rigenera', { capitolo: dati.capitolo, revisione: dati.revisione, ...contesto.riferimento });
      }, !contesto.riferimento),
      voceMenu('Copia testo', async () => {
        try { await navigator.clipboard.writeText(copia); }
        catch { if (await apriRiepilogo()) stato.textContent = 'Copia non riuscita.'; }
      }),
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

  area.addEventListener('input', () => { aggiornaBozza(); aggiornaSelezione(); });
  for (const tipo of ['select', 'click', 'keyup']) area.addEventListener(tipo, aggiornaSelezione);
  addEventListener('pagehide', liberaSelezione);
  if (pagina) new MutationObserver(() => {
    aggiornaContatori();
    if (!pagina.classList.contains('nascosto') && cap() !== dati?.capitolo) caricaRiepilogo()?.catch(() => {});
  }).observe(pagina, { attributes: true, attributeFilter: ['class'] });
  area.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape' && !salvando) chiudiEditor(true);
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvaInLinea(); }
  });
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
})();
