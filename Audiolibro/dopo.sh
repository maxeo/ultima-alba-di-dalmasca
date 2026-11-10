#!/bin/bash
# Dopo un capitolo: controllo con Whisper e pubblicazione. Con due generazioni in parallelo li fa uno alla volta.
# Uso: bash dopo.sh <nome capitolo> ["frasi rifatte"]   (con le frasi, Whisper riascolta solo quelle)
cd "$(dirname "$0")" || exit 2
until mkdir audio/.dopo.lock 2>/dev/null; do sleep 10; done
trap 'rmdir audio/.dopo.lock' EXIT
FRASI="$2" bash controlla.sh "$1" >> audio/controlli.log 2>&1
# Con il file audio/.niente-push le pubblicazioni restano in locale (docs/ aggiornato, niente commit né push).
if [ "$PUBBLICA" = "no" ]; then :
elif [ -f audio/.niente-push ]; then node pubblica.js >> audio/pubblica.log 2>&1
else node pubblica.js --push >> audio/pubblica.log 2>&1; fi
