# Capitoli da rigenerare

Capitoli il cui testo è cambiato dopo la generazione dell'audio. Si rigenerano alla fine di `genera.sh 1 113`, poi si tolgono da qui.

| Capitolo | File | Modifica | Cosa dice ancora l'audio |
|---|---|---|---|
| 2 | `002-la-barriera-di-nalbina` | «sortita» sostituita da «carica» e «caricare» (righe 171 e 187) | «sortita», anche nel testo del lettore |
| 1 | `001-le-nozze` | molte correzioni di frasi e punteggiatura (2026-11-06); vecchio mp3 già cancellato | lanciare `bash Audiolibro/genera.sh 1 1` |
| 3 | `003-due-cerimonie` | riscritto il ritorno dell'orafo con la fede, fino alla fine della scena (riga 73, 2026-11-10) | «gliela porse con tutte e due le mani» fino a «la si sente ancora», anche nel testo del lettore |

## Come rigenerare

`genera.sh` salta i capitoli già fatti, quindi per ognuno vanno prima tolti i file vecchi. Esempio per il capitolo 2:

```bash
rm Audiolibro/audiobooks/002-la-barriera-di-nalbina.* docs/audio/002.mp3
bash Audiolibro/genera.sh 2 2
```

Controllare poi che `docs/testi/NNN.json` non contenga più il vecchio testo: `genera.sh` pubblica da solo il risultato su `main`.
