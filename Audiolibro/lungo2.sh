#!/bin/bash
# Seconda parte della generazione lunga: prima i capitoli già fatti da aggiornare (pronuncia di Migelo, testo cambiato),
# poi il resto di 45-113 e infine 5-22 da zero con la nuova divisione in frasi.
cd "$(dirname "$0")" || exit 2
rifai_da_zero() {
  local id=$(printf '%03d' "$1"); local f=$(basename "$(ls ../Romanzo/capitoli/$id-*.md)" .md)
  for J in tmp/proc-*/*/__current_$f.json; do [ -f "$J" ] && rm -rf "$(dirname "$J")"; done
  rm -f "audiobooks/$f.mp3" "audiobooks/$f.vtt"
  bash genera.sh "$1" "$1"
}
for n in 4 23 25 26 27 28 29 30 33 35 41 43 1; do bash rifai.sh $n --testo; done
bash genera.sh 45 113
for n in $(seq 5 22); do rifai_da_zero $n; done
echo "LUNGO FINITO $(date '+%F %T')"
