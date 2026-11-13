#!/bin/bash
# Controlla con Whisper l'audio di uno o più capitoli. Uso: bash Audiolibro/controlla.sh 001-le-nozze [002-...]
# Senza argomenti controlla tutti gli mp3 in audiobooks/. Con FRASI="21 22" riascolta solo quelle frasi (vedi controlla.py). Il risultato va in controlli/NNN-nome.json.
cd "$(dirname "$0")" || exit 2
A="$(pwd -W)"
[ $# -eq 0 ] && set -- $(ls audiobooks/[0-9]*.mp3 | xargs -n1 basename | sed 's/\.mp3$//')
for f in "$@"; do
  MSYS_NO_PATHCONV=1 docker run --rm --gpus all -v "$A/testo:/app/testo" -v "$A/audiobooks:/app/audiobooks" -v "$A/models:/app/models" -v "$A/controlli:/app/controlli" -v "$A/controlla.py:/app/controlla.py" -v "$A/whisper-sente.tsv:/app/whisper-sente.tsv" e2a-whisper "$f" ${FRASI:+--frasi "${FRASI// /,}"} </dev/null
done
