# Fix e mancanze rispetto alla trama di Final Fantasy XII

Elenco di errori, scene mancanti, incoerenze e semine trovati in `file01`-`file38`. I racconti non sono stati modificati: le correzioni si applicano solo nel romanzo, in `Romanzo/`.

## Come leggere questo elenco

- **Tipi**: ERRORE, MANCA, INVENZIONE, INCOERENZA, SEMINA.
- **Importanza**: alta, media, bassa.
- **Fonte**: web, memoria, testo (confronto interno tra file).
- I riferimenti hanno la forma `fileNN:riga`.

## Affidabilità

- GameFAQs, Neoseeker e Final Fantasy Wiki hanno rifiutato l'accesso.
- Le verifiche usano trascrizioni di fan (ffnerdery, Google Docs segnalato da ffnerdery), LP Archive, Jegged, Wikipedia, blog e memoria.
- Il confronto non copre ogni riga dei file.
- `file01`-`file34`: letti per intero e confrontati con le fonti indicate.
- `file35`: non confrontato. È materiale da selezionare e reinterpretare.
- `file36`-`file38`: letti per intero e controllati solo sul testo e a memoria, senza fonti web.

---

## 1. Struttura

| Dove | Tipo | Problema | Proposta | Imp. | Fonte |
|---|---|---|---|---|---|
| `file32:1682-1692`, `file33:422-424, 632-636`, `file34:238-264, 490-506` | INCOERENZA | Dopo l'annuncio della guerra, con Bahamut verso Rabanastre, la compagnia fa Sotterranei, Nabudis e medaglioni, e passeggia in città tranquille | Tagliare o spostare: l'urgenza crolla | alta | web |
| `file33`-`file34` (interi) | INVENZIONE | Sotterranei, Fenice, Shadowseer, Re Bomba, Nabreus, medaglioni, Humbaba, Fury e Chaos scorrono come tappe della trama, ma sono tutti facoltativi. Obbligatori sono Mateus, Shemhazai, Hashmal, Famfrit | Terre Morte collocabili nel viaggio verso Archades (`file27`), dove Basch ha una battuta su Nabudis | alta | web, memoria per Chaos, Humbaba, Fury, Re Bomba |
| `file35` (intero) | INCOERENZA | Tutte le ultime missioni secondarie sono concentrate prima della battaglia finale | Taglio come scelta predefinita. Spostare o reinterpretare solo ciò che ha un ruolo | alta | testo |
| `file16:683-1036`, `file17:1-76`, `file18:1-440` | INCOERENZA | Mattino a Jahara raccontato tre volte; Ozmone e giudici due volte. In `file16:940` il giudice è anonimo, in `file18:228` è Bergan. Il dono di Supinelu è solo in `file18` | Tenere `file16` sez. VIII-IX e `file18`. Eliminare `file17` e `file16` sez. X-XII, salvando il materiale utile | alta | web |
| `file24:684`, `file25:36` | INCOERENZA | Navi dirette verso il monte, poi navi che se ne allontanano | Scegliere una versione | bassa | testo |
| `file35`, `file36` | INCOERENZA | Entrambi Libro XXVIII | Numerazione rifatta nel romanzo | bassa | testo |
| `file07`, `file13` | INCOERENZA | Entrambi Libro VII | Numerazione rifatta nel romanzo | bassa | testo |
| `file14`, `file21` | INCOERENZA | Stesso titolo, "Il prezzo della libertà" | Titoli nuovi nel romanzo | bassa | testo |
| `file36:30` | INCOERENZA | Ashe cita la visita a Nabudis, che dipende dalla scelta sui contenuti facoltativi | Riscrivere dopo la scelta | media | testo |

## 2. Errori

| Dove | Il testo dice | Nel gioco o correzione | Imp. | Fonte |
|---|---|---|---|---|
| `file14:24-42` | Ghis affronta Ashe e Vossler sembra tradire all'uscita dalla tomba, nella Valle dei Morti | La Valle è solo l'accerchiamento senza dialoghi. Negoziato, spada al collo di Balthier e consegna del Frammento avvengono sul ponte del Leviatano. Aggiungere cattura e trasferimento a bordo | alta | web |
| `file22:336-340` | Vayne si sporca le mani perché restino pulite quelle del padre | Gramis dice "to keep his clean" senza nominare nessuno; di solito si intende Larsa (interpretazione a memoria). Correggere o lasciare ambiguo | alta | web, memoria |
| `file13:370-372, 382` | Vaan vede Ashe turbata "da qualcosa che gli altri non comprendevano"; la mano "non lo raggiunge" | Rasler lo vedono solo Ashe e Vaan, che alza lo sguardo. La mano di Ashe gli passa attraverso. Senza questo `file16:548-554` non regge | alta | web |
| `file21:170, 378` | La furia di Fran avviene "a bordo/sul Leviatano" | Avviene sullo Shiva, come in `file14:288` | alta | web |
| `file29:840-848` | Reddas nomina già Ridorana e il Faro | Dice solo che seguirà "un'altra pista". Le parole emergono dopo Giruvegan | alta | web |
| `file30:1044-1060, 1288-1298` | Nessuno sa dove sia la "torre sulla costa lontana" | Incoerenza con `file29`: si risolve correggendo `file29` | alta | web |
| `file32:622, 750, 772` | Cid porta e solleva "alcune pietre" generiche | Cid alza il Frammento del Crepuscolo. Venat lo solleva e i tre frammenti si fondono nel vortice di Mystes | alta | web |
| `file32:832-842` | La narrazione spiega già Bahamut come fortezza celeste | Cid dice solo che Bahamut "berrà" il Mystes; Al-Cid resta vago. Da verificare, capitolo non disponibile | media | web |
| `file32:1522` | Al-Cid senza "scherzi o galanterie" | Corteggia Ashe anche in questa scena | media | web (blog) |
| `file24:518` | Rasler "chiude lentamente gli occhi" | Annuisce con approvazione quando Ashe manca il frammento: indizio sulla sua natura | media | web |
| `file24:632` | Giudice anonimo sulla plancia | Si vede Zargabaath; la battuta sui debiti è attribuita a Bergan | media | web |
| `file30:144` | Shemhazai "il Traditore" | "The Whisperer", figura femminile | media | web |
| `file30:1468-1476` | "Reddas non era un uomo comune" | Elza dice che Reddas non è di Balfonheim: primo indizio del suo passato | media | web |
| `file16:112` | "Capo anziano Zayar", "bastone di Jaya" | High-chief Zayalu e java stick; è Vaan a consegnarlo a Supinelu | media | web |
| `file11:1262` | "Frammento di Mezzanotte" | L'originale è Midlight Shard, che non significa mezzanotte. Nome ufficiale italiano da verificare | media | web |
| `file29:1516` | Tyrant gigante demoniaco su piattaforma fissa | Grande aevis; il sentiero sparisce dietro di lui | bassa | web |
| `file29:1358-1370` | Daedalus guerriero mostruoso generico | Statua di gigante senza testa con spada enorme | bassa | web |
| `file04:58-62` | Un servitore Bangaa spiega come distrarre le guardie | È una serva Seeq (Palace Servant) | bassa | web |

## 3. Scene e informazioni mancanti

| Dove | Cosa manca | Imp. | Fonte |
|---|---|---|---|
| `file32:~458` | Ashe lascia cadere il Frammento d'Aurora, ormai inutile, che rotola ai piedi di Gabranth: gesto chiave del rifiuto | alta | web |
| `file10:932-942` | Motivo dell'odio di Gabranth: dopo Landis Basch fuggì, il gemello restò con la madre malata, andò con lei in Archadia e prese il cognome materno. Spiega `file05:986` | alta | web |
| `file37:1556, 1690, 2153` | Morte di Gabranth mai mostrata: prima è vivo, poi è già tra i caduti. Serve la scena, luogo esatto da verificare | alta | testo |
| `file32:372` | Prima di colpire Rasler, Ashe scambia uno sguardo con Vaan, che raccoglie una spada di Reddas | media | web |
| `file10:842-866` | Drace, Bergan e Zargabaath non compaiono. Introdurli a corte (`file08` sez. IX-X, `file10` sez. VII): Drace difende Larsa, Bergan difende Zecht e Vayne, Zargabaath ricorda la sentenza di Gramis | media | web |
| `file23:276, 332` | Causa della morte di Gramis mai detta. Versione ufficiale: avvelenamento da parte del presidente Gregoroth, poi suicida. È ciò che Drace contesta | media | web |
| `file14:468, 516`, `file15` | Vossler resta "inginocchiato" e `file15` non ne parla. Aggiungere la reazione di Ashe e Basch nella scena dei quattro giorni dopo. Morte da verificare | media | web, memoria |
| `file16:500-514` | L'offerta di Larsa di farsi ostaggio è riassunta. Nel gioco è un dialogo: Ashe rifiuta di fidarsi, Larsa si scusa e si offre | media | web |
| `file16:164-176` | "Il Patriarca" è senza nome: great-chief Uball-ka | media | web |
| `file19:396-402`, `file20:40` | Mjrn "comprenderà la ragione", mai detta. Fran spiega che serve l'aiuto di Mjrn per passare le barriere del Bosco: è il motivo della deviazione | media | web |
| `file29:686-712` | Sommario sulle flotte. Mancano la scena di Ondore sull'ammiraglia Garland, il dialogo Ashe-Reddas su "uomini senza patria" e il flashback Reddas-Ondore | media | web |
| `file02:136`, `file06:1148` | Famiglia di Penelo generica: due fratelli maggiori le insegnarono a combattere. Spiega la tenuta di `file10:1334` | media | web |
| `file25:610` | Solo pioggia all'uscita. Mancano accoliti e Kiltias a lutto sui gradini della Sala della Luce | bassa | web |
| `file06:1462` | "Alcuni moguri dell'equipaggio" senza nome: il meccanico della Strahl è Nono | bassa | memoria |
| `file21:318` | Mjrn parte per l'arrivo dei soldati. Una guardia del Bosco dice che gli estranei attraversano Golmore da anni: tensione più lunga | bassa | web |
| `file21:420`, `file23:896` | Penelo non ha un motivo proprio per seguire Ashe. Sviluppare anche il legame con Larsa | bassa | memoria |

## 4. Semine

| Dove | Cosa inserire | Imp. | Fonte |
|---|---|---|---|
| `file10:1002`, `file07:1012`, `file10:992` | Vayne uccise due fratelli maggiori e Gramis giudicò il caso chiuso. Precisare "maggiore tra i vivi" | alta | web |
| `file01:42`, `file10:564`, `file27:~394` | Ashe porta la fede nuziale nei due anni di lutto: nozze, funerale, dubbi. Poi l'anello resta a Balthier (`file15:259`) fino a `file37:2319` | alta | web, testo |
| `file01:104-108`, `file08:1094`, `file10:858` | Nabudis sembra una conquista, ma la perdita resta inspiegata: nessun sopravvissuto attendibile, voci strane, Zecht scomparso | alta | web, memoria |
| `file13:80-98`, `file14:264` | Indizio su Vossler prima della Tomba: un'assenza, una domanda sul valore della pietra | alta | memoria, da verificare |
| `file37:1816`, `file38:1438, 1492` | "Il protagonista": la battuta di Balthier ricorre dal primo incontro con Vaan, con Fran che la smonta | alta | testo |
| `file38:1542` | "Scegliere dove andare": Vaan la dice davvero nel finale | media | testo |
| `file21:426`, `file28:360`, `file37:882` | Pietra artificiale di Penelo a Larsa (vedi anche `file14:54`): dire chi la tiene in ogni tappa. Torna contro le Sephira | media | web, testo |
| `file21:276, 372` | Fissare aspetto e testimoni della presenza in Mjrn ("shadowy visage", "loathsome shadow"), coerenti tra i file | media | web |
| `file23:430-438` | Bergan ha forza "non umana": aggiungere un dettaglio fisico, un bagliore o una pietra in mano | media | web, da verificare |
| `file16:934`, `file18:260`, `file29:654-660` | Zecht: tratto riconoscibile nel ricordo di Drace e Bergan; voce su un giudice sparito dopo Nabudis | media | memoria, web |
| `file14:680`, `file23:332` | Nominare Gregoroth tra i senatori al Senato | media | web, memoria |
| `file22:216-224` | Togliere la spiegazione del narratore sulla frase di Balthier e lasciare un'incrinatura nel tono | media | web |
| `file05:732-736`, `file07:518-532` | Balthier conosce protocolli e gradi imperiali, ha modi di corte, evita il passato | media | web, memoria |
| `file04:600-606` | Fran nota che il guasto coincide con la vicinanza della Magilite, che sembra sottrarre energia. Da verificare | media | memoria |
| `file08:1056`, `file10:964-976` | Breve scena di fiducia tra Gabranth e Larsa: Gabranth lo tratta come persona | media | memoria |
| `file11:114-118` | Voci di flotte rozarriane e guerra vicina | media | web |
| `file22:436`, `file23:52` | Profughi di Nabradia, Dalmasca e Landis, con reazione di Basch; credenza sulle isole sospese che sottraggono portanza alle aeronavi | media | web |
| `file24:632` | Nominare Zargabaath con un gesto di misura. Torna in `file37:1732` | media | web, testo |
| `file31:220` | Breve scena di Vaan ai comandi della Strahl, necessaria per `file37:1436` | media | web, testo |
| `file32:680, 1366` | Al decollo Basch cerca Gabranth tra le macerie e non trova il corpo. Prepara `file37:158` | media | web, proposta |
| `file32:554` | Voce e corporatura dei gemelli indistinguibili. Serve per `file37:1620` | media | memoria, testo |
| `file29:768` | Reddas nomina il Frammento del Midlight parlando con Ondore | media | web |
| `file10:600-616`, `file36:696`, `file37:1620` | Congegno della voce: presentarlo presto e dargli peso. Scena di Basch già forte | media | testo |
| `file38:672` | Le pagine mostrano solo ciò che gli Occuria si aspettano: preparare il tema a Giruvegan | bassa | testo |

## 5. Invenzioni da rivalutare

Ammesse se servono alla storia e non contraddicono il gioco, ma non vanno trattate come canone.

| Dove | Invenzione | Nota | Imp. | Fonte |
|---|---|---|---|---|
| `file32:1612-1614` | Il sacrificio di Reddas ferma l'esplosione, ma Bahamut ha già assorbito energia | Il Mystes che nutre Bahamut viene dal rito di Cid; nesso non confermato | media | web |
| `file32:1430-1508` | Lungo discorso di Elza su Reddas che cercava la morte | Da verificare | media | non verificato |
| `file10:858-862` | Gabranth riferisce a Gramis la scomparsa di Zecht | Nella scena consultata non c'è; "Gone without a trace since Nabudis" è di Drace altrove. Innocua | bassa | web |
| `file01:754-762` | L'autorità imperiale spiega autonomia negata e nome maledetto | Nel gioco le battute sono brevi. Spiega troppo | bassa | web |
| `file21:550` | Barriere "erette dalle viere" | Nel gioco "the jungle denies us", coerente con `file19:136` | bassa | web, da verificare |
| `file23:726, 854` | Il Tempio è "verso sud" | Anastasis dice solo "across the Paramina Rift" | bassa | web |

## 6. Incoerenze interne minori

| Dove | Problema | Correzione |
|---|---|---|
| `file10:512`, `file11:1272-1276` | Il Frammento d'Aurora è prima "reliquia della propria dinastia", poi non affidato ad alcuna dinastia | Vale la seconda versione |
| `file08:944, 776-816`, `file07:178-180` | Ghis "di stanza a Bhujerba" ma arriva con la flotta; accesso limitato ma pattuglie ovunque | Togliere "di stanza"; pattuglie per la ricerca di Larsa |
| `file05:140` | Vaan cita "quella cena che avevano previsto" | Toglierla o seminarla in `file03` sez. VII |
| `file17:10` | Vaan "ha inseguito la vendetta per fuggire dal dolore" | In `file16:604-628` pensava alla vendetta senza agire; la fuga è il sogno del pirata |
| `file28:1058`, `file24:84`, `file30:52` | "magilite" per Negalite; "d'Aurora" e "dell'Aurora" | Uniformare nel glossario |
| `file36:604` | "anelli di glossaria" | Verificare la resa ufficiale |
| `file37:112` | "Dub itava" | Refuso |

## 7. Epilogo apocrifo (`file38`)

| Dove | Problema | Correzione |
|---|---|---|
| `file38:964` | Ashe vede "la propria morte", che le pagine descritte prima non citano | Aggiungerla alle pagine o toglierla |
| `file38:970` | Ashe ricorda di aver spezzato la pietra | In `file32` è Reddas a distruggere la Crisalide |
| `file38:134, 582` | Magilite, Negalite, Frammento del Mezzogiorno | Allineare al glossario |
| `file38:690` | La morte datata di Larsa sparisce senza conseguenze | Reazione di Larsa o Basch |
| `file38:1588` | Nota su speculazioni e fonti | Togliere dal romanzo |

## 8. Controllati senza errori di sostanza

- **Prologo**: Rasler ucciso da una freccia al petto; Reks pugnalato da "Basch"; Reks ha 17 anni e un fratello di due anni più giovane.
- **Canali e arresto**: Amalia catturata con Vayne presente, dopo il Firemane; Penelo riceve il fazzoletto di Balthier.
- **Leviatano**: "Majesty" e schiaffo; pietra che brilla; "no executions"; falsa erede; magia di Ghis assorbita dalla pietra di Larsa; Vossler e l'Atomos.
- **Frammenti**: Midlight a Nabradia, Dusk a Dalmasca, Dawn nella Tomba.
- **Tomba e oltre**: Belias; Mjrn e Henne; viere, "50 anni", "pleasant lie", Lacrima di Lente; Drace e Bergan; Paramina, a parte `file22:336`; Al-Cid e flotte.
- **Miriam e Bur-Omisace**: prova della spada su Vaan, Balthier e Fran; battute di Bergan; dialogo con Al-Cid.
- **Da Costa Phon a Ridorana**: Venat e il ricordo di Rasler; Draklor; Occuria; scena Vayne-Larsa-Gabranth; skystone; iscrizione di Raithwall; rivelazione di Zecht; morte di Cid con Famfrit; sacrificio di Reddas.

## 9. Non verificati

- Gabbia di Nalbina (Gabranth nomina Amalia?), racconto del gemello a Barheim, offerta della Magilite a Balthier.
- Vossler nei canali (`file03:812-862`), Mimic Queen e crollo (`file06:534-556`), Migelo che accusa Balthier, dispositivo della voce (`file10:600-616`).
- "Ottava Flotta" (`file09:46`), passaggi di mano dell'anello.
- Piano di Larsa (`file16:378-478`), controllato solo in parte.
- Bergan che sopraffà Drace (`file25:88`), quasi tutta la catena dei medaglioni, geografia di `file26`, dialoghi di Jules a Tsenoble (`file28`).
- Finale (`file36`-`file37`): nessun confronto web.
