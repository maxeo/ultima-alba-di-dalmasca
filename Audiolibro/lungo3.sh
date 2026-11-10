#!/bin/bash
# Ripresa dopo il passaggio al server (docker compose): frasi con Migelo nei capitoli già fatti, poi 108-113, poi 5-22 da zero.
cd "$(dirname "$0")" || exit 2
rifai_da_zero() {
  local id=$(printf '%03d' "$1"); local f=$(basename "$(ls ../Romanzo/capitoli/$id-*.md)" .md)
  for J in tmp/proc-*/*/__current_$f.json; do [ -f "$J" ] && rm -rf "$(dirname "$J")"; done
  rm -f "audiobooks/$f.mp3" "audiobooks/$f.vtt"
  bash genera.sh "$1" "$1"
}
bash rifai.sh 25 48 51 67
bash rifai.sh 26 57 81 84 88 89 126 163
bash rifai.sh 27 2 5 8 10 14 17 28 34 36 39 44 46 88
bash rifai.sh 28 28 47 60 98
bash rifai.sh 29 106
bash rifai.sh 30 42 46 48 58
bash rifai.sh 33 4 30 79 88
bash rifai.sh 35 91 160
bash rifai.sh 41 102 157
bash rifai.sh 43 66
bash rifai.sh 1 149
bash genera.sh 108 113
for n in $(seq 5 22); do rifai_da_zero $n; done
echo "LUNGO FINITO $(date '+%F %T')"
