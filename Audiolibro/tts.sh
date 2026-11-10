#!/bin/bash
# Manda un lavoro al server dell'audiolibro (docker compose) e ne restituisce il codice di uscita.
# Porta del server in TTS_PORTA (8770 = servizio tts, 8771 = tts2). Se il server è occupato aspetta che si liberi.
# TTS_OPERAZIONE descrive il lavoro nel log del server (es. "cap. 3: prova 2 di 4 della frase 73").
# Con SOLO_FRASI=1 il server genera le frasi mancanti e si ferma prima del montaggio (prove di una frase).
# Uso: bash tts.sh <file di log in audio/> <argomenti di ebook2audiobook...>
cd "$(dirname "$0")" || exit 2
# Git Bash convertirebbe /app/... in C:/Program Files/Git/app/... passando gli argomenti a node.
export MSYS_NO_PATHCONV=1
P=${TTS_PORTA:-8770}
LOG="$1"; shift
curl -sf localhost:$P/stato >/dev/null || { docker compose up -d >/dev/null 2>&1; for i in $(seq 60); do sleep 3; curl -sf localhost:$P/stato >/dev/null && break; done; }
CORPO=$(LOG="$LOG" SOLO_FRASI="$SOLO_FRASI" OPERAZIONE="$TTS_OPERAZIONE" node -e 'console.log(JSON.stringify({args: process.argv.slice(1), log: "/app/registri/" + require("path").basename(process.env.LOG), solo_frasi: process.env.SOLO_FRASI === "1", operazione: process.env.OPERAZIONE || ""}))' -- "$@")
while :; do
  R=$(curl -s --max-time 0 -X POST localhost:$P/converti -H 'Content-Type: application/json' -d "$CORPO")
  case "$R" in *'"errore": "occupato"'*) sleep 30 ;; *) break ;; esac
done
E=$(node -e 'try{console.log(JSON.parse(process.argv[1]).exit)}catch{console.log(99)}' "$R")
[ "$E" = "0" ] || echo "tts.sh: risposta del server: $R" >> "$LOG"
exit "$E"
