#!/bin/bash
# Assembla Romanzo/romanzo.md dai capitoli, nell'ordine dei file.
cd "$(dirname "$0")/.." || exit 2
{
  printf '%s\n\n' '# Final Fantasy XII. Il romanzo'
  printf '%s\n\n' '*Opera di fan, privata e non commerciale. Trama, personaggi e mondo appartengono a Square Enix.*'
  for f in capitoli/*.md; do cat "$f"; printf '\n\n'; done
} > romanzo.md
