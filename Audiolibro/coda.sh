#!/bin/bash
# Esegue i lavori in audio/coda/da-fare (un comando per file, presi in ordine di nome) sul server della porta indicata.
# Più istanze con porte diverse lavorano in parallelo senza prendere lo stesso lavoro.
# Uso: bash coda.sh 8770
cd "$(dirname "$0")" || exit 2
export TTS_PORTA=${1:-8770}
Q=audio/coda; mkdir -p $Q/da-fare $Q/in-corso $Q/fatti
while :; do
  t=$(ls $Q/da-fare 2>/dev/null | sort | head -1)
  [ -n "$t" ] || break
  mv "$Q/da-fare/$t" "$Q/in-corso/$t" 2>/dev/null || continue
  echo "$(date '+%F %T') [$TTS_PORTA] inizio $t: $(cat "$Q/in-corso/$t")"
  bash -c "$(cat "$Q/in-corso/$t")"
  echo "$(date '+%F %T') [$TTS_PORTA] fine $t (uscita $?)"
  mv "$Q/in-corso/$t" "$Q/fatti/$t"
done
echo "$(date '+%F %T') [$TTS_PORTA] coda vuota"
