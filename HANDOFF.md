# Passaggio di consegne – Romanzo FFXII e audiolibro

Aggiornato il 12 novembre 2026. Rispondi all'utente in italiano, in modo breve: spesso detta dal telefono e
manda screenshot del lettore. Leggi prima `CLAUDE.md` (come è fatta la filiera, già verificato) e
`BEST-PRACTICES.md` (le regole di lavoro): qui c'è solo lo stato.

## Obiettivo

Romanzo di fan «L'ultima alba di Dalmasca» (FFXII) con audiolibro XTTS e lettore Leggio in `docs/`, pubblicato su
https://maxeo.github.io/ultima-alba-di-dalmasca/. L'autore corregge dal pannello (`localhost:8765/?write=true`) e
la coda del pannello rifà l'audio.

## Regole che contano adesso

- Commit solo quando l'autore lo chiede, uno per argomento. Italiano, prima riga al passato e lunga al massimo
  60 caratteri, riga vuota, trattini. Mai `Co-Authored-By`, mai righe sugli strumenti. Stage per percorso.
- Mai force-push: si scrive il comando e lo lancia lui. Gli mp3 superati si tolgono anche dalla storia.
- Il testo si cambia solo nei capitoli; `romanzo.md` lo riallinea lo strumento.
- Non riavviare il server dell'autore con un lavoro `in generazione`. Non lanciare `rifai.sh` a mano mentre
  l'autore lavora: la coda è del pannello.

## Decisioni dell'autore (12 novembre)

- I capitoli corti non si uniscono.
- L'audio resta solo per la Parte 1 dell'autore, cioè i capitoli 1-18 (prologo e Parte I). Dal 19 in poi niente
  audio e niente rigenerazione: mp3, master e testi sincronizzati cancellati, lavori tolti dalla coda.
- Sito pubblico: audio solo per il prologo (1-7), dal capitolo 8 solo testo. Con `?write=true` audio 1-18 e
  testo dal 19. Come funziona: `CLAUDE.md`, sezione «Sito».

## Stato

- Capitolo 4 diviso (4 «Reks», 5 «La scala»), capitoli rinumerati fino a 114. Audio 4-18 rifatti dalla coda col
  titolo letto nel numero nuovo. Coda vuota, server acceso.
- Leggio (`C:\Users\matteo\Documents\leggio`): commit `e8f7c8f` per i capitoli solo testo, più due commit
  precedenti; tutto da pubblicare con un push normale.
- Storia di `main` riscritta per togliere gli mp3 superati (vedi sotto se è andata a buon fine). Il ramo
  `backup-prima-pulizia` tiene la storia di prima: si cancella dopo il force push.

## Da guardare

- Segnalazioni Whisper sui capitoli rifatti: 4, 5, 7, 8, 9, 10, 12, 14, 15, 16, 18. Quelle a 0:02 sui titoli
  sono falsi allarmi; quelle sui numeri in cifre anche. Il 7 ha ancora le parole inventate di XTTS (prima a
  9:13, 21:33, 23:28 col vecchio numero 6): da rifare dal pannello.
- I rami remoti `origin/claude/*` puntano alla storia vecchia: finché ci sono, GitHub tiene gli mp3 vecchi.
- Il pannello su un capitolo solo testo (dal 19) non è stato provato.
- Leggio, se l'autore lo chiede: «Restano» negativo e progressi legati al numero del capitolo (la rinumerazione
  sposta posizioni e «Ascoltato» di chi ha già ascoltato).
- `romanzo.md` ha un testo più vecchio nel capitolo 3 e nel primo paragrafo del 28: lì il pannello dà 409.

## Cosa non ha funzionato (non ripetere)

- Heredoc bash con codice JS: le `\s` delle espressioni regolari si perdono. Scrivere lo script con lo strumento
  di scrittura e controllare il risultato.
- `git filter-branch` rifiuta con modifiche non committate: committare prima.
- `rifai.sh N --monta` non rilegge il capitolo: dopo una correzione serve `--testo`.
- Chiudere il server non ferma la richiesta già mandata al contenitore TTS: la finisce comunque.
