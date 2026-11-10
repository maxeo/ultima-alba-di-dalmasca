#!/bin/bash
# Rigenera da zero un capitolo (nuova divisione in frasi): toglie mp3, vtt e sessione vecchi e lancia genera.sh.
# Uso: bash da-zero.sh N
cd "$(dirname "$0")" || exit 2
id=$(printf '%03d' "$1"); f=$(basename "$(ls ../Romanzo/capitoli/$id-*.md)" .md)
for J in tmp/proc-*/*/__current_$f.json; do [ -f "$J" ] && rm -rf "$(dirname "$J")"; done
rm -f "audiobooks/$f.mp3" "audiobooks/$f.vtt"
bash genera.sh "$1" "$1"
