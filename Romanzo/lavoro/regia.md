# Istruzioni di regia per la prima stesura

Questo file vale per chiunque scriva la prima stesura. Il regista rilegge tutto e può chiedere di riscrivere.

## Da leggere prima di scrivere

1. `Romanzo/lavoro/bibbia.md`: voce, stile, personaggi, chi sa cosa, oggetti, glossario, cronologia.
2. `Romanzo/lavoro/scaletta.md`: la riga del capitolo, e quelle prima e dopo.
3. Le sezioni di origine in `Original/`, per intero.
4. `Original/fix-e-mancanze.md`: cerca il file di origine. Le correzioni battono il testo originale.
5. `Romanzo/lavoro/agganci.md` e `Romanzo/lavoro/idee-inedite.md`.
6. I capitoli già scritti in `Romanzo/capitoli/`, almeno i due precedenti.

## Regole assolute

- `Original/` non si modifica mai.
- Non si riassume e non si riformula il testo originale frase per frase. La fonte dà i fatti. La scena si scrive da zero.
- Non si trascrivono dialoghi dal gioco. Ogni battuta è nuova e riconoscibile per voce.
- Nessun colpo di scena prima del momento segnato nella tabella "Chi sa cosa".
- Nessun fatto nuovo che contraddica la trama. Un'invenzione deve cambiare un'informazione, una relazione o una risorsa, e collegarsi ad altri fatti.
- Ogni invenzione rilevante va in `agganci.md`, con capitolo di nascita e capitolo di ritorno previsto. Una proposta nuova che tocca altri capitoli va prima in `idee-inedite.md`, stato "proposta", e non entra nel testo.

## La voce

Il narratore è un uomo di studi che conosce la fine della storia e si diverte a raccontarla. Sta dalla parte delle persone e diffida delle versioni ufficiali. È ironico verso potenti, cerimonie ed eroi, mai verso il dolore.

- **Ironia con misura.** Una o due punte per scena, nate da un fatto preciso. Mai una battuta dopo l'altra, mai ammiccamenti al lettore moderno.
- **Silenzio nel lutto.** Quando muore qualcuno, o quando un personaggio tocca il suo dolore, il narratore smette di scherzare e si fa piccolo.
- **Fonti.** Al massimo una volta ogni tre o quattro capitoli può accennare alle fonti ("le cronache di palazzo giurano che...", "su questo punto i testimoni litigano"). Non spiega mai chi è lui.
- **Anticipazioni.** Può stuzzicare, con un fatto concreto e senza rivelare. "Ma nessuno poteva ancora sapere" e simili sono vietate.
- **Concretezza.** Odori, oggetti, mestieri, prezzi, caldo, fatica. Ivalice è abitata. Un dettaglio esatto vale più di tre aggettivi.

## La prosa

- Paragrafi veri, di norma da tre a otto frasi, con ritmo vario. La frase isolata è un effetto raro.
- Nessuna frase monca in serie e nessuna anafora solenne.
- Vietate: "Non X. Non Y. Ma Z", "Non era soltanto X", "Fu allora che", "E così", "Eppure, nonostante tutto", "in quel momento", "sembrava quasi", "qualcosa in lui si spezzò", "il silenzio calò", domande retoriche a catena.
- Evitare em dash come tic e il ritmo a tre elementi come abitudine. Usare il punto e la virgola quando serve.
- Italiano corrente, vivo, corretto. Tempi: passato remoto e imperfetto.
- Dialoghi con `«»`. Il dialogo è il motore della scena: i personaggi si contraddicono, si interrompono, evitano le domande, non si spiegano ciò che sanno già. Attribuzioni semplici; "disse" va benissimo. Niente avverbi di commento quando la battuta basta.
- Nessun lessico di gioco e nessuna traccia di chat o link.

## Fine capitolo

Nessun riepilogo e nessuna morale. Chiudere su un fatto, un gesto o una battuta che spinge avanti.

## Lunghezza

Quanto serve alla scena, senza riempitivi. La lunghezza per capitolo è indicata nel lavoro assegnato.

## Formato

File: `Romanzo/capitoli/NNN-titolo-breve.md`, con `NNN` su tre cifre.

```markdown
# Parte I. Il crepuscolo di Dalmasca      (solo nel primo capitolo della Parte)

## 1. Titolo del capitolo

Testo.
```

## Decisioni di regia già prese

1. **Midlight Shard**: Frammento di Mezzaluce.
2. **Narratore studioso**: sì, a basso dosaggio. Solo accenni alle fonti. L'identità si svela nell'Appendice. Il romanzo deve reggersi anche senza questa rivelazione.
3. **Memorie di Ondore**: sì, circa in metà delle Parti, in corsivo prima del primo capitolo della Parte, da 80 a 200 parole. Danno la versione ufficiale, che la Parte smentisce o complica. Ondore è cauto e colto; il suo tono è diverso da quello del narratore.
4. **Gilgamesh**: ridotto. Due incontri nel corpo del romanzo, ciascuno con una conseguenza concreta, e un cenno finale. Collocazione da fissare in scaletta prima della Parte IV. Il personaggio non compare prima di allora.
5. **Montblanc e il maestro**: sottotrama tagliata. Montblanc resta come capo del Clan e della rete di informatori.
6. **Nabudis nella Parte IX**: resta come tappa di trama. Nessuna menzione aperta di Zecht in quel punto, solo tracce che tornano in `file32`.

## Lavoro assegnato: capitoli pilota

Sono la prova della voce. Valgono più di qualsiasi altro capitolo: se suonano come la fonte, si butta tutto.

### Capitolo 1. Le nozze dell'ultima primavera

- **Fonte**: `file01` sez. I, più il contesto di sez. II.
- **File**: `Romanzo/capitoli/001-le-nozze.md`. Da 3.000 a 4.500 parole. Apre la Parte I, con un breve estratto delle memorie di Ondore.
- **Obiettivo**: far innamorare il lettore di Ashe e Rasler, così la morte di Rasler nel capitolo 2 fa male. La festa è allegra sul serio.
- **Cosa deve esserci**: Ashe e Rasler in una scena privata con dialogo vivo, prima o dopo la cerimonia: lei imperiosa e pungente, lui capace di farla ridere. L'amore è vero anche se il matrimonio è politico. Corteo su carrozza trainata da chocobo. Cattedrale, formula con "Faram". La fede nuziale, descritta bene, perché tornerà (`bibbia.md`, oggetti). Re Raminas, con la sua dignità stanca. Basch fra le guardie, appena un tratto.
- **Ombra di Archadia**: passa per fatti concreti: un dispaccio, un'aeronave, un ambasciatore cortese, una frase di Raminas. Niente lezione di politica. I due imperi si capiscono dalla paura di chi li nomina.
- **Facoltativo**: Vaan quindicenne e Reks in un dettaglio di folla. Se entra, va in `agganci.md`.
- **Chiusura**: su un'immagine di gioia con una crepa precisa, senza dire che finirà male.
- Ashe ha diciassette anni in questa scena. Il testo non descrive il suo corpo in modo sensuale e non include alcuna scena di intimità fisica oltre al bacio rituale e a gesti di tenerezza.

### Capitolo 21. L'uomo che il mondo credeva morto

- **Fonte**: `file05` sez. IX-X. Leggere anche sez. VII-VIII per il contesto e l'inizio di sez. XI.
- **File**: `Romanzo/capitoli/021-l-uomo-che-il-mondo-credeva-morto.md`. Da 3.000 a 4.500 parole.
- **Obiettivo**: la scena più tesa della Parte III. Vaan si trova davanti l'uomo che odia, e il lettore intuisce che i conti non tornano.
- **Prima parte**: Vaan, Balthier e Fran spiano il colloquio fra Giudice e prigioniero. Dialogo diretto, breve e carico. Il Giudice si toglie l'elmo, ma Vaan lo vede solo di spalle: il volto non viene descritto. Il lettore deve poter notare che le due voci si somigliano; Vaan ne ha solo un fastidio che non sa nominare. Il gemello si rivela più tardi (`file06` sez. IV). Temi del colloquio: perché Vayne lo tiene in vita, Ondore da far tacere, la cattura di Amalia, l'accusa finale di aver abbandonato la patria.
- **Seconda parte**: Balthier sfoggia l'eleganza davanti a un morto che parla, con un dettaglio che tradisce la sua conoscenza di gradi e protocolli imperiali, senza spiegazione. Fran dà risposte di poche parole e sente il Mystes nella voragine.
- **Terza parte**: lo sfogo di Vaan su Reks. Qui l'ironia sparisce del tutto. Parte dalla patria e arriva a un letto e a un fratello che muore. Vaan dice cose ingiuste e sbagliate come le dice un ragazzo. Basch non si difende, perché ciò che ha da dire non servirebbe. Quel silenzio deve pesare più delle grida.
- **Chiusura**: Fran fa cadere la gabbia. Taglio netto. Il capitolo 22 parte dalla caduta.
- **Vietato**: Basch che spiega il gemello; Vaan che comincia a credergli.

## Consegna

- Aggiornare `Romanzo/lavoro/agganci.md`.
- Annotare in fondo a questo file, sezione "Note di stesura", dubbi e scelte che il regista deve controllare, in non più di dieci righe.
- Non modificare scaletta, bibbia o decisioni: le proposte vanno nelle note.
- Prima della consegna, rileggere cercando le formule vietate e riscrivere dove compaiono.
- Verificare gli originali: da `Original/`, `sha256sum -c ../Romanzo/lavoro/originali.sha256 --quiet`.
- Fare commit e push. Messaggio in italiano, prima riga al passato di massimo 60 caratteri, poi trattini. Nessuna riga `Co-Authored-By` e nessuna riga "Generated with".

## Note di stesura

- Modello usato per la stesura dei pilota: Claude Opus 5.5.
- Cap. 1: circa 4.400 parole più 170 di Ondore. La scena privata è in carrozza, sotto gli occhi della folla, a labbra quasi ferme: controllare che regga come "privata".
- Cap. 1: l'anello è largo perché misurato su un guanto e non viene mai stretto ("fra una settimana"). Propongo di farlo tornare largo al funerale e fino al cap. 112: decidere.
- Cap. 1: inventati il chocobo Pancia e il venditore di datteri (unico accenno alle fonti), l'ambasciatore archadiano con i calici, la lettera del re di Nabradia assente. Tutto in `agganci.md`.
- Cap. 1: Raminas ha "sessant'anni" e regna da trenta; Ashe è "unica erede". Età e anni di regno da verificare.
- Cap. 21: circa 3.400 parole. Le voci simili sono affidate al fastidio di Vaan e all'eco del pozzo; Gabranth dice "a tutto quello che ci avevi lasciato dentro", allusione alla madre: controllare che non anticipi troppo.
- Cap. 21: Basch nega solo il regicidio; nessuna spiegazione. Il dettaglio di Balthier è il divieto per i Giudici di togliersi l'elmo davanti a un prigioniero, con un "Ufficio di Corte" inventato.
- Cap. 21: Vaan è sul ponte di assi, aggrappato alla gabbia, quando Fran tira la leva. Il cap. 22 deve partire da lì.
- Cap. 21: Vaan ricorda il corteo del cap. 1 ("quello che guarda i tetti"): richiamo fra i due pilota, da tenere nel cap. 4.
