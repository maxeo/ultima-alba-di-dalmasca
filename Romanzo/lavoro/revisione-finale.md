# Revisione finale

Tutti i 113 capitoli esistono. Ora ogni sessione rilegge per intero il proprio blocco e lo corregge. L'autore non è disponibile: decidi e annota.

## Blocchi

| Sessione | Capitoli da rivedere | Note |
|---|---|---|
| pilota-romanzo | 1-6, 21 | Non cambiare la voce dei pilota: solo correzioni |
| blocco-a | 7-20, 22-27 | 23-27 scritti da altro modello |
| blocco-b | 28-50 | 42-50 scritti da altro modello |
| blocco-c | 51-73 | 73 scritto da altro modello |
| blocco-d | 74-90 | |
| blocco-e | 91-113 | 110-113 scritti da altro modello |

## Procedura

Fai `git fetch origin main && git merge origin/main`. Rileggi `VIA-LIBERA.md` e tutto `revisioni/`. Poi leggi ogni capitolo del blocco, in ordine, più l'ultimo capitolo del blocco precedente e il primo del successivo.

## Cosa correggere

1. **Voce.** I capitoli di altro modello devono suonare come i pilota. Riscrivili senza esitare, anche per intero, se sono piatti, riassuntivi o solenni. Conserva i fatti e gli agganci.
2. **Aspetto.** `revisioni/aspetto.md` è vincolante. Correggi ogni descrizione difforme: Migelo Bangaa blu, Reddas rasato con barba bianca, Penelo bionda, Larsa bruno, e così via.
3. **Continuità con i blocchi vicini**, scritti in parallelo. Controlla oggetti, ferite, chi sa cosa, nomi inventati, luoghi e tempi. Se due blocchi si contraddicono, vince il capitolo precedente nella storia, e correggi solo il tuo blocco.
4. **Fili.** Controlla la tabella in `lavoro-generale.md`. Ogni filo del tuo blocco deve esserci e deve tornare dove previsto. Controlla anche `Original/fix-e-mancanze.md` per le sezioni del blocco.
5. **Deserto.** Mai "Estersand". Varia: "Deserto Orientale" come nome geografico, "deserto a est di Dalmasca", "deserto orientale", "a oriente".
6. **Lingua.** Niente plurali che cancellano la donna ("i principi" per una coppia). Un personaggio parla di sé in prima persona: controlla i dialoghi dei personaggi solenni, come Anastasis, Gerun e Reddas. Correggi refusi, ripetizioni, tempi verbali e soggetti ambigui.
7. **Tic.** Riduci paragoni "come si/come chi", catene di "e", chiusure a commento, gag ripetute, gesti ricorrenti come chiudere gli occhi o sistemarsi i polsini.
8. **Riepiloghi.** Elimina spiegazioni di ciò che il lettore già sa, soprattutto quando ripete eventi di capitoli precedenti.

## Consegna

Fai commit e push dopo ogni capitolo modificato, sul branch di questa sessione. Scrivi `Romanzo/lavoro/note-revisione-<sessione>.md`: al massimo venti righe con correzioni e problemi che non hai potuto risolvere. L'ultima riga deve essere `FINE REVISIONE`. Tocca solo i capitoli del tuo blocco e il tuo file di note. Non aprire PR. Non modificare `Original/`.
