# Best practice — L'ultima alba di Dalmasca

Questo file dice **come si lavora** qui dentro. `README.md` dice **cos'è** l'opera e come si usa, `HANDOFF.md`
dice **a che punto siamo**: i tre si leggono insieme.

Le regole qui sotto sono quelle date dall'autore e poi confermate dal codice. Quando una scelta è stata presa una
volta, si segue: se non va più bene si cambia la regola qui, non la si aggira nel singolo file.

---

## 1. Il testo comanda, il resto è generato

È il principio da cui discende tutto il resto.

- Le correzioni si fanno in `Romanzo/capitoli/NNN-*.md`. `Romanzo/romanzo.md` e le copie nei worktree vengono
  dopo, e le riallinea lo strumento dell'autore: a mano non si toccano.
- `docs/` è un prodotto. Audio, testi sincronizzati e `index.html` escono da `Audiolibro/pubblica.js` e da Leggio,
  che sta fuori dal progetto: quello che si corregge lì si perde alla pubblicazione successiva.
- Una pronuncia sbagliata non si aggiusta storpiando il romanzo: si aggiunge una riga a `Audiolibro/pronuncia.tsv`.
- Le parole sono dell'autore. Si cambia il minimo indispensabile, le proposte si mostrano in chat prima di
  scriverle, e la prosa non prende i tic da IA: niente similitudini a effetto, elenchi di tre, anafore o finali a
  sentenza.

## 2. Taglio dei file

È la regola che conta di più: un file lungo nasconde quello che fa, e nessuno lo rilegge mai tutto.

- **Nessun file oltre ~500 righe.** Vale per il codice che è nostro. Alla soglia non si accorciano i nomi né si
  stringono le righe: si estrae un modulo coeso, con un compito che si dice in una frase.
- **Un modulo, un compito**, e il nome lo dice: `base.mjs` i mattoni, `stato.mjs` cosa c'è nella pagina,
  `dati.mjs` il dialogo col server, `testo.mjs` e `pendenti.mjs` i conti, e poi `pannello.mjs`, `editor.mjs`,
  `lavori.mjs`, `proiezione.mjs`, `menu.mjs` per le parti dell'interfaccia.
- Quando un modulo cresce, il pezzo che se ne va per primo è il ragionamento puro: è quello che si prova da solo
  e che non ha bisogno del resto.
- Al 11 novembre 2026 il file più lungo che scriviamo è `autore.test.js` con 467 righe, poi `server.js` con 418:
  sono i due da guardare alla prossima aggiunta. `docs/index.html` ne ha 2345 ma è generato da Leggio e non si
  conta.

## 3. Vista nei moduli dell'interfaccia, conti nei moduli puri

I moduli in `Audiolibro/autore/ui/` toccano il DOM, chiamano l'API e mostrano. Tutto quello che si può decidere
guardando solo i dati sta invece in un modulo **puro**:

- `ui/testo.mjs` — testo, diff, allineamento dei paragrafi.
- `ui/pendenti.mjs` — il lavoro che l'audio non ha ancora: quanto pesa e quale blocco tiene un dato paragrafo.

Un modulo puro non conosce il DOM, non chiama la rete e non legge lo stato della pagina: prende i dati del
capitolo e restituisce un valore. Sono le uniche parti che si provano senza browser, e infatti sono quelle coperte
dai test: quando una funzione di vista contiene un ragionamento che vale la pena provare, il ragionamento si
sposta in un modulo puro e ci si scrive il test.

Le dipendenze puntano verso i moduli puri, mai il contrario. Fra i moduli di vista qualche anello c'è ancora ed è
un debito noto: quando si sposta del codice lo si sposta in quella direzione.

## 4. Il server dell'autore e la coda audio

- `server.js`, `audio.js` e `archivio.js` vivono nel processo: per vederne una modifica bisogna riavviare.
  `ui.js`, `ui.css` e `ui/*.mjs` si rileggono dal disco a ogni richiesta, quindi lì basta ricaricare la pagina.
- **Non si riavvia il server mentre un lavoro è «in generazione»**: torna «in coda» e la voce si rifà da capo,
  un'ora di TTS buttata. Prima si guarda `Audiolibro/audio/autore/lavori.json`.
- Un'operazione interrotta a metà non deve lasciare dati monchi: i file di stato si scrivono su un temporaneo e
  poi si rinominano (`archivio.js`), e su Windows la sostituzione dell'mp3 si ritenta finché il lettore lo molla.
- I server di prova restano accesi anche dopo una pubblicazione: 8765 per il lettore del romanzo, 8780-8782 per
  Leggio.

## 5. CSS

- Le classi dell'autore sono prefissate `autore-`: il resto della pagina è di Leggio, che qui si usa come
  strumento e non si modifica.
- I colori sono le custom properties del tema (`var(--testo)`, `var(--accento)`, `var(--pannello)`), mai valori
  scritti a mano: il lettore ha tema chiaro, scuro e luce notturna.
- La specificità deve bastare a battere quello che c'è già. In particolare **`hidden` deve vincere**: una classe
  con `display: flex` ha la stessa specificità di `[hidden]` e, venendo dopo, lo annulla senza dire niente. Per
  questo c'è una regola sola che lo garantisce in tutta l'interfaccia dell'autore, invece di un `:not([hidden])`
  appiccicato a ogni classe.
- Ogni animazione ha il suo blocco `@media (prefers-reduced-motion: reduce)`.

## 6. Interfaccia

- I testi per chi legge sono in italiano, con gli apostrofi e le virgolette del romanzo (’ « »).
- Le conferme stanno dove si agisce: la domanda compare in linea accanto al pulsante che l'ha fatta nascere, mai
  in una finestra sopra il testo. Dove l'azione si disfa da sola la conferma non ci va proprio.
- Un comando che avvia del lavoro si disabilita finché non ha risposto: senza una conferma di mezzo, il doppio
  clic lo farebbe partire due volte.
- L'autore legge e corregge anche dal telefono: i comandi devono essere toccabili e visibili senza passare il
  mouse sopra.

## 7. Verificare prima di dire fatto

Non si consegna una funzione perché il file si salva.

1. `node --test Audiolibro/autore/autore.test.js` (14 test, tutti verdi).
2. Il lettore di prova su `http://localhost:8765/?write=true#4`, ricaricato: i moduli dell'interfaccia si
   rileggono dal disco, quindi quello che si vede è il codice nuovo.
3. La funzione provata davvero nel browser, con i clic che farebbe l'autore, non solo riletta nel codice.
4. Console senza errori.
5. Se il cambiamento tocca il server: controllare che non ci siano lavori in generazione, poi riavviare.
6. Se tocca l'audio già pubblicato: ascoltare il punto. I tempi delle parole si rompono in silenzio.

## 8. Git

- Si committa solo quando l'autore lo chiede. Messaggio in italiano, prima riga al passato e lunga al massimo 60
  caratteri, riga vuota, poi i trattini. Mai `Co-Authored-By`, mai righe sugli strumenti usati.
- I file si mettono in stage per percorso, non con `git add .`: `.claude/` resta fuori.
- Mai force-push: si scrive il comando e lo lancia l'autore.

## 9. Documentazione scritta insieme al codice

- `README.md` — per chi legge e ascolta, più le istruzioni per rigenerare testo e audio.
- `HANDOFF.md` — a fine sessione: obiettivo, stato, cosa ha funzionato, cosa no, prossimi passi. Deve bastare a
  chi riparte da zero.
- `BEST-PRACTICES.md` — questo file: si aggiorna quando cambia una regola, non quando cambia una funzione.

Nel codice i commenti spiegano **perché**, non cosa: il cosa si legge dalle righe sotto. In italiano, con gli
accenti veri, che i file sono UTF-8.
