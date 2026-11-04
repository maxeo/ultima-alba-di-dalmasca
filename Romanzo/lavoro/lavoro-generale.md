# Lavoro generale di stesura

Più sessioni scrivono blocchi diversi nello stesso momento. Il regista integra i branch su `main` e rilegge. L'autore non è disponibile fino alla fine del lavoro: non fare domande, decidi e annota.

## Blocchi

| Sessione | Capitoli | Parti |
|---|---|---|
| pilota-romanzo | 1-6, 21 | I, pilota |
| blocco-a | 7-20, 22-27 | II, III |
| blocco-b | 28-50 | IV, V |
| blocco-c | 51-73 | VI, VII, VIII |
| blocco-d | 74-90 | IX, X, XI |
| blocco-e | 91-113 | XII, XIII, Epilogo, Appendice |

## Procedura

1. **Attendi il via libera.** Il file `Romanzo/lavoro/VIA-LIBERA.md` compare su `origin/main` quando il regista ha approvato la voce dei pilota. Controlla con `git fetch -q origin main && git cat-file -e origin/main:Romanzo/lavoro/VIA-LIBERA.md`. Se manca, aspetta con `sleep` e ricontrolla ogni 2 minuti, senza fare altro.
2. **Prima di iniziare**, fai `git merge origin/main`, poi leggi `regia.md`, `VIA-LIBERA.md`, `bibbia.md`, questo file, le righe di scaletta del tuo blocco e i capitoli pilota in `Romanzo/capitoli/`, che sono il modello di voce.
3. **Prima di ogni capitolo**: `git fetch origin main && git merge origin/main`. Leggi le correzioni in `Romanzo/lavoro/revisioni/`, se ci sono. Valgono subito, anche per i capitoli già scritti del tuo blocco.
4. **Per ogni capitolo**: leggi per intero le sezioni di origine e le voci di `Original/fix-e-mancanze.md` che le riguardano. Leggi i capitoli precedenti esistenti, almeno gli ultimi due. Scrivi. Rileggi cercando formule vietate e voci piatte. Fai commit e push sul branch di questa sessione dopo ogni capitolo.
5. **Alla fine di ogni Parte**: rileggi la Parte intera e correggi ripetizioni, tic e scene deboli. Il file delle note `Romanzo/lavoro/note-parte-NN.md` deve finire con la riga `FINE PARTE`.
6. **A fine blocco**: fermati. Non aprire PR.

## File che puoi toccare

- `Romanzo/capitoli/NNN-*.md` del tuo blocco.
- `Romanzo/lavoro/agganci-parte-NN.md`, con la stessa tabella di `agganci.md`.
- `Romanzo/lavoro/note-parte-NN.md`, per dubbi e scelte, al massimo dieci righe per capitolo.

Non toccare altro: i file condivisi sono del regista. Un'idea nuova che tocca altri capitoli va nelle note. Non modificare mai `Original/`.

## Lunghezze

Media di circa 3.000 parole a capitolo. Capitoli marcati "Espanso": da 4.000 a 6.000. Compressi e di passaggio: da 1.500 a 2.500. Nessun riempitivo.

## Scontri e tagli

- Uno scontro resta solo se cambia la trama, rivela un personaggio o fa davvero ridere. Gli altri stanno in poche righe. Mai sequenze di mostri.
- Una sezione che la scaletta segna come tagliata non si scrive. Il suo materiale salvato va dove indica la scaletta.
- Nessuno spiegone. La politica passa da scene e conflitti.

## Fili da mantenere

| Filo | Dove |
|---|---|
| "Il protagonista", gag di Balthier smontata da Fran | Nasce al cap. 14, ricorre con misura, paga al cap. 110 e nell'Appendice |
| Fede di Ashe | Cap. 1, 3, 41; a Balthier al cap. 52; cap. 77; torna al cap. 112 |
| Pietra di Larsa | Dono al cap. 38; ripresa al cap. 62; decisiva al cap. 106 |
| Congegno della voce | Cap. 41; Vaan al cap. 103; Basch al cap. 109 |
| Voci uguali dei gemelli | Da seminare in ogni scena con Gabranth e Basch |
| Balthier e i protocolli imperiali | Tracce nei cap. 21, 30, 35-39; rivelazione al cap. 77; "Ffamran" al cap. 81 |
| Nabudis e il Giudice scomparso | Voci ai cap. 2, 57, 64, 75; rivelazione al cap. 96 |
| Ricordi di Reks: gigli di Galbana | Cap. 4, 8, 19, e un richiamo nella Parte XIII |
| Vaan ha visto Rasler | Cap. 47; detto al cap. 54 |
| "Scegliere dove andare" | Frase di Vaan al cap. 112; ritrovata dallo studioso al cap. 113 |
| Il dubbio sulla storia scritta dai prescelti | Cap. 88-89; ripreso al cap. 113 |
| La gente comune | Kytes, Migelo, Dalan, Nono, Tomaj e almeno due volti inventati a Rabanastre; tornano ai cap. 101-103 |

## Elementi inediti approvati

- **Memorie di Ondore**: aprono le Parti I, III, V, VIII, X, XIII.
- **Narratore studioso**: solo accenni alle fonti. Si svela al cap. 113.
- **Rete del Clan**: nasce al cap. 8 con Montblanc. Porta notizie utili ai cap. 35-36, 57 e 79. Mai come meccanica, sempre come favori e pettegolezzi che si pagano.
- **Debito con gli Urutan-Yensa**: nasce al cap. 44. Si salda al cap. 101-103: gli Urutan portano i profughi di Rabanastre oltre il mare di sabbia.
- **Gilgamesh**: primo incontro al cap. 41. Duellante vanitoso e collezionista di spade, cerca di prendere la spada di Basch e lascia dietro di sé qualcosa di rubato che serve più avanti. Secondo incontro al cap. 78-79: ha venduto spade rubate a Jules, e ciò apre alla compagnia una porta verso Archades. Cenno finale al cap. 104, in piena battaglia, con una battuta sul "protagonista".
- **Ba'Gamnan**: ultima caccia nella Parte IX, dentro il cap. 79 o 80. **Rikken**: gara con Balthier al cap. 84. **Relj**: al massimo un cenno al cap. 69.
- **Tappa verso il Bur-Omisace**: cap. 64, secondo la scaletta.
- **Morte di Gabranth**: scena nuova al cap. 108, dopo la promessa a Basch. Ironia assente.

## Controllo prima di ogni push

Nel capitolo non devono esserci `http`, `utm_source`, `Gambit`, `il gioco`, `hai fotografato`, `ci fermiamo`, `Fu allora che`, `Non era soltanto`, `E così`, `nessuno poteva ancora sapere`.

## Commit

Messaggio in italiano, prima riga al passato di massimo 60 caratteri, poi trattini. Nessuna riga `Co-Authored-By` e nessuna riga "Generated with".
