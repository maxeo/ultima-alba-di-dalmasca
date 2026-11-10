# Passaggio di consegne – Romanzo FFXII e audiolibro

Aggiornato il 9 novembre 2026, alle 17:30 circa. Rispondi all'utente in italiano, in modo breve. Spesso detta dal telefono tramite Remote Control e manda screenshot del lettore.

## Obiettivo

Si tratta del romanzo fan «L'ultima alba di Dalmasca», tratto da Final Fantasy XII.
- Testi: `Romanzo/capitoli/NNN-*.md` (113 capitoli) e `Romanzo/romanzo.md`.
- Audiolibro: XTTS tramite ebook2audiobook, nella cartella `Audiolibro/`.
- Lettore web: pubblicato da `docs/` su https://maxeo.github.io/ultima-alba-di-dalmasca/. La pagina del lettore e' Leggio, generata da `docs/libro.json`.

L'utente ascolta i capitoli, raccoglie le correzioni e le chiede. Le correzioni vanno nel testo e poi nell'audio.

**Il lettore e' Leggio:** sta in `C:\Users\matteo\Documents\leggio`, ha il suo passaggio di consegne in `C:\Users\matteo\Documents\leggio\HANDOFF.md`, e da qui si usa come strumento. `pubblica.js` scrive i dati in `docs/` e poi lancia `crea-sito.js` di Leggio, che rifa' `docs/index.html`, `sw.js`, `manifest.webmanifest` e `caratteri/` leggendo `docs/libro.json` (titolo, sottotitolo, avviso, traguardi e la chiave `alba`, che non va cambiata: da' il nome ai progressi salvati nei browser dei lettori). Lo cerca in `$LEGGIO`, in `node_modules/leggio` e in `../leggio`. Qui si usa `../leggio`. Alle 17:28 del 9 novembre il clone era allineato con GitHub, con ultimo commit «Uniti i traguardi quando il libro è uno solo». Il sito rigenerato era identico a quello online.

## Regole dell'utente (vincolanti)

- **Testo:**
  - Ogni modifica va fatta identica in quattro copie: `Romanzo/capitoli/NNN-*.md`, `Romanzo/romanzo.md`, `.claude/worktrees/revisione-ia/Romanzo/capitoli/NNN-*.md` e `.claude/worktrees/revisione-ia/Romanzo/romanzo.md`.
  - Cambiare il minimo indispensabile.
- **Proposte di testo:**
  - Mostrarle prima in chat come opzioni numerate e chiudere con «Io preferisco la X», senza lunghi giudizi.
  - Prosa semplice e grammaticale, senza tic da IA: niente similitudini a effetto, elenchi di tre, anafore o finali a sentenza. Vedi la memoria `prosa-senza-tic-ia`.
  - Rileggere i capitoli precedenti per non creare incongruenze.
- **Pronunce:** si correggono solo in `Audiolibro/pronuncia.tsv`.
- **Git:**
  - Commit solo se l'utente li chiede: messaggio in italiano, prima riga al passato e lunga al massimo 60 caratteri, mai `Co-Authored-By`.
  - Mai committare `.claude/`. Mai force-push.
  - I commit automatici di `pubblica.js` («Pubblicato l'audio del lettore: N») vanno bene.
- **Lettore:** il server locale `localhost:8765` («prova-lettore») resta acceso. `docs/index.html`, `docs/sw.js` e `docs/manifest.webmanifest` sono generati: non si modificano qui, si modifica Leggio e si rilancia `node ../leggio/strumenti/crea-sito.js docs`.

## Stato attuale

### Generazione audio in corso

- **Le code sono staccate dall'app:** sono state avviate con `Start-Process` di PowerShell (`bash -c 'bash coda.sh PORTA >> audio/coda-PORTA.out 2>&1'`, finestra nascosta). Un riavvio di Claude non le ferma; per fermarle bisogna chiudere i processi per nome, vedi «Cosa non ha funzionato». Il registro resta `Audiolibro/audio/coda.log`.
- **Già pronti alle 17:28:** 1-17 e 23-113 (1-17 rigenerati da zero oggi).
- **In corso:** cap. 18 e cap. 19 (lavori `033` e `034`). Alle 17:26 i due container sono stati fermati e riavviati (eventi docker `kill`/`stop`, uscita 137): `stato.txt` segna «ERRORE exit=99 tentativo=1» per entrambi e `genera.sh` li ha fatti ripartire da solo. Causa non chiarita; la stessa cosa era successa alle 14:30 dopo un riavvio del PC. Se si ripete, sfasare l'avvio delle due code di un paio di minuti.
- **In coda (`da-fare`, 65 lavori):**
  - `035`-`037`: `da-zero.sh 20`, `21`, `22`;
  - `038`: `rifai.sh 5 --testo`, per il ritocco «le usanze» arrivato dopo l'avvio del 5;
  - `039`-`099`: 61 correzioni di frasi segnalate da Whisper con `rifai.sh N i j …` (tra cui i cap. 4, 26, 34 e 36 elencati sotto).
- La coda sta in `Audiolibro/audio/coda/{da-fare,in-corso,fatti}`, con un file per lavoro.
- Fine prevista: tra le 19:00 e le 19:30 del 9 novembre.
- Per controllare:
  - stato dei capitoli: `audio/stato.txt`;
  - controllo Whisper: `audio/controlli.log`;
  - stato dei server: `curl localhost:8770/stato` e `curl localhost:8771/stato`.
- Dopo la generazione sono pronti tutti i capitoli 1-113. I capitoli 1-3 e 23-113 hanno già la nuova divisione in frasi. Le frasi con «Migelo» sono rifatte con la pronuncia «Mighèlo».

### Nuova architettura dell'audio (fatta oggi, non committata)

- **Server** (`Audiolibro/docker-compose.yml`): due servizi, `tts` sulla porta 8770 e `tts2` sulla 8771.
  - Immagine `e2a-frasi`. Codice in `Audiolibro/server/server.py`: un server HTTP che importa ebook2audiobook e tiene il modello caricato.
  - `POST /converti` accetta `{args, log}` con gli stessi argomenti della riga di comando e risponde solo quando il capitolo è finito. `GET /stato` dice se il server è occupato.
  - Un lavoro alla volta per server: se è occupato risponde 409.
- **Client** (`Audiolibro/tts.sh`): usa la porta in `TTS_PORTA` (predefinita 8770). Imposta `MSYS_NO_PATHCONV=1` e, se il server è occupato, riprova ogni 30 secondi.
- **Script che passano dal server:** `genera.sh` e `rifai.sh`, che non lanciano più `docker run`.
- **`dopo.sh`:** esegue il controllo Whisper (`controlla.sh`) e `pubblica.js --push` uno alla volta, con il lucchetto `audio/.dopo.lock`.
- **`da-zero.sh N`:** cancella sessione, mp3 e vtt del capitolo e poi chiama `genera.sh N N`.
- **`coda.sh PORTA`:** è il gestore della coda.
- **`patch-frasi.py`**, che viene applicato all'immagine `e2a-frasi` da `Dockerfile.frasi`:
  - rifà solo le frasi mancanti;
  - divide in frasi intere fino a 200 caratteri;
  - (novità di oggi) **lascia il modello XTTS sulla GPU**, mentre l'originale lo riportava in RAM dopo ogni frase.
- **`pubblica.js`:** se un capitolo è in rigenerazione, cioè manca l'mp3 in `audiobooks/` ma c'è `docs/audio/NNN.mp3`, tiene durata e byte della versione già pubblicata. Così il capitolo resta ascoltabile.
- **Risultato:**
  - un server da solo: GPU al 50-60%, circa 15 minuti a capitolo;
  - due server: GPU al 97-100% con 5,9 GB di VRAM su 8, due capitoli ogni 12-16 minuti;
  - le correzioni con `rifai.sh`: da 1 a 3 minuti.

### Testo, ultime decisioni

- **Cap. 5:** il titolo ora è «L'uomo che uccise il re». Il nome del file resta `005-il-capitano-che-uccise-il-re.md`, per non rompere la generazione dell'audio.
- **Pronuncia:** `Migelo	Mighèlo` in `pronuncia.tsv`.
- **Ritocchi sui dialetti decisi oggi**, fatti nelle quattro copie:
  - cap. 5-6, trattato: «le leggi» è diventato «le usanze», in tre punti;
  - cap. 11, vecchia nomade: «in una lingua» è diventato «in un dialetto».
  - Il cap. 6 e l'11 si generano già con il testo nuovo. Per il 5 c'è in coda `rifai.sh 5 --testo`.
- **Dialetti:** un agente ha fatto 47 modifiche in 25 capitoli. Tra le nazioni principali restano solo accenti e dialetti; le lingue antiche e quelle di bangaa, viera, garif ecc. sono rimaste.
- **Già fatti in precedenza:**
  - la fede di Ashe dal cap. 4 non è più larga;
  - «aviopirata» è il termine principale;
  - i genitori di Vaan muoiono di peste;
  - il cap. 4 è riscritto e centrato su Reks;
  - nel lettore le citazioni sono in corsivo, la firma è in corsivo calligrafico (Pinyon Script, salvato in locale) e i cambi di scena hanno il segno ⁂.

## Cosa ha funzionato

- Usare `rifai.sh N --testo` dopo una correzione del testo o di `pronuncia.tsv`: rifà solo le frasi cambiate. Va bene solo se la sessione in `tmp/` esiste ancora.
- Usare `rifai.sh N i j …` per rifare frasi precise, `rifai.sh N --elenca` per avere l'elenco con gli indici.
- Sistemare Docker Desktop quando si blocca all'avvio: rinominare `%LOCALAPPDATA%\Docker\run` in `run-vecchio-HHMMSS` e riavviarlo.
- Usare il browser integrato per Amazon ed eBay. Con WebFetch rispondono 503/403.

## Cosa non ha funzionato (non ripetere)

- **Fermare i lavori:** `TaskStop` su uno script bash ferma solo il padre e lascia vivi i figli (`rifai.sh`, `genera.sh`, i cicli). Bisogna chiuderli anche per nome di comando, per esempio in PowerShell con `Get-CimInstance Win32_Process` e un filtro su `CommandLine`. Oggi un ciclo rimasto vivo ha mandato lavori con percorsi sbagliati e ha cancellato diversi mp3. Li ho recuperati con `git checkout -- docs/audio/`.
- **Interrompere una generazione già avviata:** gli mp3 di `audiobooks/` e `docs/audio/NNN.mp3` vengono cancellati prima di generare, quindi il capitolo sparisce dal lettore. Dopo un'interruzione, recuperare `docs/audio` con git.
- **Attendere con `docker ps --filter since=<id>`:** quando il container di riferimento viene rimosso, il filtro non trova più niente. Per questo stanotte la precedenza ai capitoli già fatti non è scattata.
- **Server Python senza protezione `if __name__ == '__main__'`:** con l'avvio «spawn» i processi figli rieseguono lo script e il Manager fallisce con `EOFError`.
- **Git Bash che passa argomenti `/app/...` a `node.exe`:** senza `MSYS_NO_PATHCONV=1` diventano `C:/Program Files/Git/app/...`.
- **Ottimizzazioni sulla GTX 1070 Ti (Pascal):** non sono utilizzabili `torch.compile`/Triton, vLLM/Auralis, TensorRT 10 e la mezza precisione. Resta da provare solo DeepSpeed, in un'immagine separata, e non è detto che funzioni su Pascal.
- **Scrittura:** l'utente ha bocciato frasi contorte, parole ricercate e dettagli inventati che non si trovano nei capitoli precedenti.

## Prossimi passi

1. **Controllare la generazione.** Quando il registro `coda.log` dice «coda vuota» per entrambe le porte:
   - verificare che i capitoli 1-113 abbiano tutti un mp3 in `Audiolibro/audiobooks/`;
   - verificare che il lettore sia aggiornato;
   - controllare che `rifai.sh 5 --testo` sia andato a buon fine.
2. **Frasi segnalate da Whisper:** sono già in coda (lavori `039`-`099`). Quando sono finite, controllare in `controlli.log` che non restino segnalazioni, in particolare:
   - cap. 4: a 1:00 «dadi» si sente come «dè di», e verso la fine ripete «non so le cisterne»;
   - cap. 26: a 15:52 salta un pezzo, a 28:18 ripete «me lo ricordo»;
   - cap. 34: 5 punti; cap. 36: 4 punti.
   - Controllare anche i capitoli 18-22, rigenerati da zero dopo che le correzioni erano già state messe in coda.
   - Per rifare altre frasi: `rifai.sh N i j`. Per trovare l'indice partendo dal minuto, usare `--elenca`.
3. **Dopo un riavvio del PC:**
   - rimettere in `da-fare` i lavori rimasti in `in-corso`;
   - verificare che `docs/audio` sia intatto, con `git status docs/audio`;
   - rilanciare le code staccate, come descritto sopra.
4. **Facoltativo:** provare DeepSpeed in un'immagine separata e confrontare la voce. Solo se l'utente lo chiede.
5. **Scheda video:** l'utente sta valutando l'acquisto di una nuova scheda.
   - Opzioni proposte: una Gainward RTX 4070 Super usata su eBay a 619 €, oppure una RTX 5070 «Seconda mano» di Amazon a 832 €, con 2 anni di garanzia.
   - Con una scheda nuova: si può usare l'immagine cu128 originale e si sbloccano mezza precisione e `torch.compile`.
6. **Arretrati:**
   - aggiornare `Audiolibro/da-rigenerare.md`, che è vecchio;
   - togliere dalla storia git i vecchi mp3: lo fa l'utente con il force-push;
   - ramo `versioni-capitoli`;
   - rebase di `revisione-ia`;
   - revisione dei capitoli 7-113, in pausa.
7. **Commit:** non c'è niente di committato oltre alle pubblicazioni automatiche. Script nuovi o modificati: `docker-compose.yml`, `server/`, `tts.sh`, `coda.sh`, `dopo.sh`, `da-zero.sh`, `patch-frasi.py`, `genera.sh`, `rifai.sh`, `pubblica.js`, `pronuncia.tsv` e i testi. Committare solo su richiesta dell'utente.
