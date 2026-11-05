# L'ultima alba di Dalmasca

Romanzo di fan in italiano tratto da *Final Fantasy XII*, con audiolibro.

Il regno di Dalmasca è caduto, il suo re è morto durante la firma della pace e l'uomo accusato di averlo ucciso marcisce in una segreta. A Rabanastre, intanto, un ragazzo di nome Vaan ruba agli occupanti imperiali e sogna di volare. Il romanzo racconta come queste storie finiscono per incrociarsi, con una voce narrante ironica che conosce tutti i personaggi e non sempre ne ha una grande opinione.

La trama principale e i suoi finali seguono il gioco. Scene, dialoghi e collegamenti tra gli episodi sono scritti da zero, e le missioni secondarie sono state spostate, fuse o tagliate perché servissero alla storia.

## Leggere

Il testo completo è in [`Romanzo/romanzo.md`](Romanzo/romanzo.md): circa 320.000 parole in 113 capitoli. I singoli capitoli sono in [`Romanzo/capitoli/`](Romanzo/capitoli).

| Parte | Titolo | Capitoli |
|---|---|---|
| Prologo | Il crepuscolo di Dalmasca | 1-6 |
| I | Il ladro di Rabanastre | 7-17 |
| II | Le segrete e il traditore | 18-27 |
| III | La città celeste e il Leviatano | 28-39 |
| IV | Il sepolcro del Re Dinasta | 40-50 |
| V | La spada di una regina | 51-57 |
| VI | Le figlie del Bosco | 58-63 |
| VII | Il santuario fra le nuvole | 64-73 |
| VIII | La strada per Archades | 74-81 |
| IX | Draklor e Balfonheim | 82-84 |
| X | Il Grande Cristallo | 85-90 |
| XI | Il Faro di Ridorana | 91-100 |
| XII | L'ultima alba di Dalmasca | 101-110 |
| | Epilogo | 111-112 |
| | Appendice apocrifa | 113 |

## Ascoltare

**[Apri il lettore](https://maxeo.github.io/ultima-alba-di-dalmasca/)**

L'audiolibro è in lavorazione, un file per capitolo: il lettore mostra i capitoli pronti e quelli in arrivo. Ricorda dove sei arrivato, segue il testo mentre la voce legge, gestisce i segnalibri e salva i capitoli sul dispositivo per ascoltarli senza rete.

L'audio è generato in locale con [ebook2audiobook](https://github.com/DrewThomasson/ebook2audiobook) e il modello XTTS. È una voce sintetica: qualche pronuncia può risultare imprecisa.

## Com'è fatto

Il romanzo è stato scritto con modelli di intelligenza artificiale sotto la direzione dell'autore, partendo da una cronaca della storia del gioco. Il lavoro è passato da più giri di revisione su voce, continuità e fili narrativi.

| Cartella | Contenuto |
|---|---|
| `Original/` | La cronaca di partenza, lasciata intatta, e l'elenco di correzioni e mancanze |
| `Romanzo/capitoli/` | I capitoli, uno per file |
| `Romanzo/lavoro/` | Materiali di lavoro: scaletta, personaggi, agganci e note di revisione. Contengono anticipazioni |
| `Audiolibro/` | Script per generare e pubblicare l'audio, dizionario di pronuncia dei nomi |
| `docs/` | Il lettore web pubblicato su GitHub Pages, con audio compresso e testi sincronizzati |

Per rigenerare il testo unico:

```bash
bash Romanzo/lavoro/assembla.sh
```

Per generare l'audio servono Docker e una GPU NVIDIA. I capitoli già pronti vengono saltati, quindi lo stesso comando riprende anche dopo un'interruzione:

```bash
docker build -t e2a-locale:cu126 Audiolibro
bash Audiolibro/genera.sh 1 113
```

## Avviso e licenza

Opera di fan, non ufficiale e non commerciale, senza legami con Square Enix. *Final Fantasy XII*, la sua trama, i suoi personaggi e il suo mondo appartengono a Square Enix.

È un'opera di fantasia, gratuita e senza scopo di lucro. Romanzo e audiolibro sono distribuiti con licenza CC BY-NC-SA 4.0: puoi condividerli e modificarli citando la fonte, senza scopi commerciali e con la stessa licenza. L'audio segue anche le condizioni non commerciali del modello vocale, e il codice è distribuito con licenza MIT. Le licenze non coprono gli elementi di proprietà di Square Enix. I dettagli, in italiano e in inglese, sono in [LICENSE](LICENSE).
