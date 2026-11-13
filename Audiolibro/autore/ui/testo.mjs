// Conti su testo e diff: niente DOM, così si provano anche da node.
export function differenze(prima, dopo, rimozioni) {
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

export function diffConRimozioni(prima, dopo) {
  const rimozioni = [];
  const { aggiunte } = differenze(prima, dopo, rimozioni);
  return { aggiunte, rimozioni };
}

export function finestreDiff(testo, { aggiunte, rimozioni }) {
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

export function fettaDiff(diff, da, a) {
  return {
    aggiunte: diff.aggiunte.filter(([x, y]) => x < a && y > da).map(([x, y]) => [Math.max(0, x - da), Math.min(a, y) - da]),
    rimozioni: diff.rimozioni.filter(r => r.posizione >= da && r.posizione <= a).map(r => ({ ...r, posizione: r.posizione - da })),
  };
}

export function anteprimaDiff(testo, diff, [da, a], limite = 105) {
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

export function puntoDiff(testo, diff, da, a) {
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

export function riepilogoParole(prima, dopo) {
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

export function allineaParagrafi(prima, dopo) {
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

export function statoCaricamentoAutore(capitolo, capitoloCaricato, testo, capitoloInErrore) {
  if (!capitolo) return 'nessun-capitolo';
  if (testo === 'errore' || capitolo === capitoloInErrore && capitolo !== capitoloCaricato) return 'errore';
  return capitolo === capitoloCaricato && testo === 'pronto' ? 'pronto' : 'caricamento';
}

export const testoVisibile = t => t.replace(/^>[ \t]+/gm, '').replace(/[*_]/g, '');
export const compatto = t => testoVisibile(t).replace(/\s/g, '');
export const unisci = v => v.join('\n\n');
// Dentro un blocco lo stacco di scena è una voce '---' fra i paragrafi.
export const eStacco = t => /^\s*(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(t || '');
export const soloParagrafi = v => v.filter(t => !eStacco(t));
export const conStacchi = v => v.flatMap((p, i) => i && p.stacco ? ['---', p.testo] : [p.testo]);
export const normalizza = t => t.normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
export const minuti = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export const dataBreve = iso => {
  const d = new Date(iso || '');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
