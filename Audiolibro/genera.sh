#!/bin/bash
# Genera l'audio un capitolo alla volta. Salta i capitoli gia' fatti, quindi basta rilanciarlo per riprendere.
# Uso: bash Audiolibro/genera.sh [primo] [ultimo]
cd "$(dirname "$0")" || exit 2
A="$(pwd -W)"
PRIMO=${1:-1}; ULTIMO=${2:-113}; ERRORI=0
for n in $(seq "$PRIMO" "$ULTIMO"); do
  id=$(printf '%03d' "$n")
  f=$(basename "$(ls ../Romanzo/capitoli/$id-*.md)" .md)
  [ -s "audiobooks/$f.mp3" ] && continue
  node prepara.js "$n" >/dev/null || exit 2
  for tentativo in 1 2; do
    S=$(date +%s)
    MSYS_NO_PATHCONV=1 docker run --rm --gpus all -e USER=root -v "$A/testo:/app/testo" -v "$A/audiobooks:/app/audiobooks" -v "$A/models:/app/models" -v "$A/tmp:/app/tmp" e2a-locale:cu126 --script_mode full_docker --headless --ebook "/app/testo/$f.txt" --language ita --tts_engine xtts --device CUDA --output_format mp3 --output_dir /app/audiobooks > "audio/log-$id.txt" 2>&1 </dev/null
    e=$?
    if [ $e -eq 0 ] && [ -s "audiobooks/$f.mp3" ]; then
      echo "$(date '+%F %T') $f OK $(( $(date +%s)-S ))s" >> audio/stato.txt; ERRORI=0
      # Un errore di pubblicazione non deve fermare la generazione.
      node pubblica.js --push >> audio/pubblica.log 2>&1
      break
    fi
    echo "$(date '+%F %T') $f ERRORE exit=$e tentativo=$tentativo" >> audio/stato.txt
  done
  if [ ! -s "audiobooks/$f.mp3" ]; then
    ERRORI=$((ERRORI+1))
    if [ $ERRORI -ge 3 ]; then echo "FERMO: tre capitoli di fila falliti, ultimo $f"; exit 3; fi
  fi
done
echo "FINITO: $(ls audiobooks/[0-9]*.mp3 | grep -vc 000-campione) mp3"; grep -c ERRORE audio/stato.txt
