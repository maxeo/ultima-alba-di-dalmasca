# L'ultima alba di Dalmasca

Romanzo di fan tratto da Final Fantasy XII, con audiolibro generato (XTTS in Docker) e lettore web (Leggio) in
`docs/`. Si risponde in italiano; le regole di lavoro stanno in `BEST-PRACTICES.md`, lo stato in `HANDOFF.md`.

Qui sotto c'è come è fatta la filiera, già verificato: non serve ricontrollarlo ogni volta, ma se si cambia uno
di questi meccanismi si aggiorna anche questo file.

## Dal capitolo all'audio

- Il testo sta in `Romanzo/capitoli/NNN-slug.md`, prima riga `## N. Titolo` (o `# Parte …` / `# Epilogo` /
  `# Appendice apocrifa`, con il `## N.` più sotto). Lo slug non è il titolo: `005-il-capitano-che-uccise-il-re.md`
  si intitola «L'uomo che uccise il re».
- `Audiolibro/prepara.js N` → `Audiolibro/testo/NNN-slug.txt`. Il titolo **si legge ad alta voce**
  («Capitolo quinto: …», `ordinale()` regge fino a 114 e oltre): cambiare numero a un capitolo vuol dire rifare
  quella frase dell'audio.
- XTTS → `Audiolibro/audiobooks/NNN-slug.mp3` e `.vtt` (i master). `controlla.sh` → `Audiolibro/controlli/
  NNN-slug.json` e `.parole.json`. `pubblica.js` → `docs/audio/NNN.mp3` (48 kbps, riconverte solo se il master è
  più recente), `docs/testi/NNN.json`, `docs/capitoli.json`. La durata in
  `capitoli.json` si conta dai frame dell'mp3 pubblicato (coincide con ffprobe), non dai sottotitoli.
- Altri file legati al numero: `Audiolibro/audio/log-NNN.txt`, `rifai-NNN.txt`, `da-montare-NNN.txt`,
  `audio/prove/NNN-i-K.*`, e i lavori in `Audiolibro/audio/autore/lavori.json` (`capitolo`, `nome`, `riga`).

## Sessioni di ebook2audiobook (`Audiolibro/tmp/`, ~21 GB)

- Ogni capitolo generato ha una sessione `tmp/proc-<uuid>/<hash>/`, con
  `hash = md5("/app/audiobooks/" + "NNN-slug")` (`lib/core.py` nel contenitore). Dentro: `__current_`,
  `__saved_`, `__NNN-slug.json`, `NNN-slug.*`, `chapters/sentences/<blocco>/<i>.flac`; il vecchio nome compare
  anche in `concat_list_*.txt` e `metadata.txt`.
- `rifai.sh` trova la sessione con `ls -t tmp/proc-*/*/__current_NNN-slug.json`. Se si rinomina un capitolo
  senza spostare la sessione (cartella con il nuovo hash, file rinominati), ogni correzione futura richiede di
  rigenerare il capitolo intero. Qualche cartella ha un hash diverso dal nome (prove fatte a parte, con
  `index.flac`): `rifai.sh` non la raggiunge e si lascia dov'è.
- Per dividere un capitolo si copia la sua sessione sotto il nome nuovo (cartella `proc-` nuova, hash del nome
  nuovo): `aggiorna.js` toglie le frasi che non ci sono più e rifà solo il titolo e le frasi di confine.
- `rifai.sh N --testo` lancia `prepara.js` e `aggiorna.js`, che confronta parola per parola il testo nuovo con
  le frasi della sessione e rifà solo quelle cambiate. `--monta` rimonta e basta: **non** rilegge il capitolo.
- XTTS può inventare parole su una frase rifatta: dopo ogni rifacimento si guarda il controllo Whisper.

## Server dell'autore (`Audiolibro/autore/`, porta 8765)

- Tiene `lavori.json` **in memoria** e lo riscrive a ogni salvataggio: chi modifica quel file deve farlo a
  server fermo e a coda vuota, altrimenti viene sovrascritto.
- Trova il capitolo in `Romanzo/romanzo.md` con la riga `## N. `: se i numeri lì non coincidono con i file, la
  correzione dal pannello si ferma con 409 («Passaggio divergente»). Lo stesso succede se un paragrafo non
  coincide con il capitolo. `romanzo.md` non si corregge a mano: dopo una correzione fatta direttamente nel file
  del capitolo si rigenera con `bash Romanzo/lavoro/assembla.sh`, prima di accodare lavori dal pannello.
- Il prologo e i capitoli che aprono una Parte cominciano prima del loro `## N.` (titolo della Parte, epigrafe):
  `sezione()` in `archivio.js` li fa partire dalla prima riga del file del capitolo.
- La coda appartiene al pannello: i rifacimenti audio passano da lì (un lavoro `modifica` in coda fa
  `rifai.sh --testo`, controllo Whisper e pubblicazione del capitolo), non da `rifai.sh` lanciato a mano mentre
  l'autore lavora.
- `pubblica.js` completo, per un capitolo con un lavoro ancora aperto, riusa la voce di `docs/capitoli.json`
  **con lo stesso numero**: se i numeri cambiano, quel file va rinumerato prima di accodare i lavori.

## Sito

- Sul sito pubblico l'audio c'è solo per il prologo (capitoli 1-7, `ULTIMO_PUBBLICO` in `pubblica.js`); gli altri
  capitoli si leggono soltanto (`docs/solotesto/NNN.json`, voce con `parole` e `testo` e senza `durata`). Gli audio
  8-18 restano in `docs/audio` ma li elenca solo `Audiolibro/capitoli-autore.json`, che il server dell'autore dà al
  posto di `capitoli.json` quando c'è il cookie `autore=1` (messo aprendo `?write=true`, tolto aprendo la pagina
  senza). Dal 19 in poi non c'è audio: niente mp3 né master, e la coda non li rifà.
- Leggio regge capitoli solo testo dentro un libro con l'audio (`modoCap()` in `lettore/index.html`).
- `docs/index.html` è generato da Leggio (`../leggio/strumenti/crea-sito.js docs`) e non contiene l'elenco dei
  capitoli: lo legge da `capitoli.json`. `docs/sw.js` tiene gli audio scaricati in cache per indirizzo
  (`audio/NNN.mp3`).
- Gli mp3 vecchi non si tengono: quando un audio è rigenerato si tolgono anche dalla storia git. Il force push lo
  lancia l'autore.
