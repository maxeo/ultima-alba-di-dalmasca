#!/bin/bash
# Assembla Romanzo/romanzo.md dai capitoli, nell'ordine dei file.
cd "$(dirname "$0")/.." || exit 2
{
  printf '%s\n\n' "# L'ultima alba di Dalmasca"
  printf '%s\n\n' '*Romanzo di fan tratto da Final Fantasy XII. Opera non ufficiale e non commerciale. Trama, personaggi e mondo appartengono a Square Enix.*'
  for f in capitoli/*.md; do cat "$f"; printf '\n\n'; done
} > romanzo.md
