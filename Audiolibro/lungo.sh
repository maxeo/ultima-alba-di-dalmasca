#!/bin/bash
# Rigenera da zero (nuova divisione in frasi) i capitoli indicati: toglie mp3, vtt e sessione vecchi e rilancia genera.sh.
# Ordine scelto: 4 (testo nuovo), poi 23-113 (mai generati), poi 5-22 (vecchia divisione).
cd "$(dirname "$0")" || exit 2
rifai_da_zero() {
  local id=$(printf '%03d' "$1"); local f=$(basename "$(ls ../Romanzo/capitoli/$id-*.md)" .md)
  for J in tmp/proc-*/*/__current_$f.json; do [ -f "$J" ] && rm -rf "$(dirname "$J")"; done
  rm -f "audiobooks/$f.mp3" "audiobooks/$f.vtt"
  bash genera.sh "$1" "$1"
}
rifai_da_zero 4
bash genera.sh 23 113
for n in $(seq 5 22); do rifai_da_zero $n; done
echo "LUNGO FINITO $(date '+%F %T')"
