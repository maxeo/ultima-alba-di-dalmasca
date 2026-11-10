#!/bin/bash
# Rigenera solo alcune frasi di un capitolo già generato, poi ricompone mp3 e vtt e pubblica.
# Uso: bash Audiolibro/rifai.sh N frase [frase...]      (N = numero del capitolo, frase = indice da 0)
#      bash Audiolibro/rifai.sh N --testo                (dopo aver corretto il capitolo o pronuncia.tsv: rifà solo le frasi cambiate)
#      bash Audiolibro/rifai.sh N --elenca               (mostra le frasi con il loro indice)
#      bash Audiolibro/rifai.sh N --prove i [quante]     (prese di prova della frase i, 4 se non indicato, senza toccare il capitolo:
#                                                         audio/prove/NNN-i-K.mp3; la presa 0 è quella attuale)
#      bash Audiolibro/rifai.sh N --scegli i K           (mette la presa K al posto della frase i e rimonta il capitolo)
#      bash Audiolibro/rifai.sh N --monta                (rimonta il capitolo con le frasi che ci sono)
# Con MONTA=no genera solo le frasi, senza montare né pubblicare: si raccolgono più correzioni e si monta una volta con --monta.
# Le frasi sono quelle in cui ebook2audiobook ha diviso il testo (spezzate anche alle virgole).
# Serve la cartella di sessione in tmp/ della generazione precedente.
cd "$(dirname "$0")" || exit 2
A="$(pwd -W)"
id=$(printf '%03d' "$1"); shift
f=$(basename "$(ls ../Romanzo/capitoli/$id-*.md)" .md)
J=$(ls -t tmp/proc-*/*/__current_$f.json 2>/dev/null | head -1)
[ -n "$J" ] || { echo "Nessuna sessione in tmp/ per $f: va rigenerato tutto con genera.sh"; exit 2; }
P=$(dirname "$J"); S=$(basename "$(dirname "$P")"); S=${S#proc-}
if [ "$1" = "--testo" ]; then
  node prepara.js "${id#00}" >/dev/null || exit 2
  R=$(node aggiorna.js "$P" "$f") || exit 3; set -- $R
  [ $# -gt 0 ] || { echo "$f: nessuna frase cambiata"; exit 0; }
  echo "$f: frasi cambiate $*"
fi
if [ "$1" = "--elenca" ]; then
  node -e "require('./$J').blocks[0].sentences.forEach((s,i)=>console.log(i+'\t'+s))"; exit 0
fi
B=$(node -e "console.log(require('./$J').blocks[0].id)")
D="$P/chapters/sentences/$B"
args=(--script_mode full_docker --headless --session "$S" --ebook "/app/testo/$f.txt" --language ita --tts_engine xtts --device CUDA --output_format mp3 --output_dir /app/audiobooks)
# Fa credere al programma che il blocco sia già finito: così controlla le frasi mancanti e rifà solo quelle.
ripresa() { node -e "const fs=require('fs'),p='$J',j=JSON.parse(fs.readFileSync(p));j.block_resume=j.blocks.length;j.sentence_resume=0;fs.writeFileSync(p,JSON.stringify(j,null,4))"; }
# Solo le frasi mancanti, senza montaggio: il capitolo pubblicato resta com'è.
solo_frasi() { ripresa; SOLO_FRASI=1 TTS_OPERAZIONE="cap. ${id#00}: $1" bash tts.sh "audio/rifai-$id.txt" "${args[@]}"; }
# Rimonta il capitolo dalle frasi (rifacendo quelle mancanti), poi controllo e pubblicazione.
# Le frasi rifatte con MONTA=no si segnano in audio/da-montare-NNN.txt: al montaggio Whisper riascolta anche quelle.
monta() {
  local frasi="$2"
  if [ -f "audio/da-montare-$id.txt" ]; then frasi=$(echo $frasi $(cat "audio/da-montare-$id.txt") | tr ' ' '
' | sort -nu | tr '
' ' '); fi
  set -- "$1" "${frasi% }"
  ripresa
  # Il vtt di prima serve al controllo Whisper per riascoltare solo le frasi rifatte.
  if [ -n "$2" ] && [ -f "audiobooks/$f.vtt" ]; then cp "audiobooks/$f.vtt" "controlli/$f.vtt-prima"; else rm -f "controlli/$f.vtt-prima"; fi
  rm -f "$P/chapters/$B.flac" "$P/$f.flac" "audiobooks/$f.mp3" "audiobooks/$f.vtt"
  S0=$(date +%s)
  TTS_OPERAZIONE="cap. ${id#00}: $1, rimontaggio" bash tts.sh "audio/rifai-$id.txt" "${args[@]}"
  if [ -s "audiobooks/$f.mp3" ]; then
    echo "$(date '+%F %T') $f $1 in $(( $(date +%s)-S0 ))s" | tee -a audio/stato.txt
    rm -f "audio/da-montare-$id.txt"
    bash dopo.sh "$f" "$2"
  else
    echo "ERRORE: vedi Audiolibro/audio/rifai-$id.txt"; exit 1
  fi
}
case "$1" in
  --prove)
    i=$2; n=${3:-4}; [[ "$i" =~ ^[0-9]+$ ]] && [ -f "$D/$i.flac" ] || { echo "Frase $i non trovata"; exit 2; }
    [[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -ge 1 ] && [ "$n" -le 10 ] || { echo "Numero di prese non valido: $n (da 1 a 10)"; exit 2; }
    mkdir -p audio/prove
    [ -f "audio/prove/$id-$i-0.flac" ] || cp "$D/$i.flac" "audio/prove/$id-$i-0.flac"
    for k in $(seq "$n"); do
      rm -f "$D/$i.flac"; S0=$(date +%s)
      solo_frasi "prova $k di $n della frase $i" || { cp "audio/prove/$id-$i-0.flac" "$D/$i.flac"; echo "ERRORE: vedi Audiolibro/audio/rifai-$id.txt"; exit 1; }
      cp "$D/$i.flac" "audio/prove/$id-$i-$k.flac"; echo "presa $k pronta in $(( $(date +%s)-S0 ))s"
    done
    cp "audio/prove/$id-$i-0.flac" "$D/$i.flac"
    for x in audio/prove/$id-$i-*.flac; do
      MSYS_NO_PATHCONV=1 docker exec audiolibro-tts ffmpeg -v error -y -i "/app/registri/prove/$(basename "$x")" -b:a 96k "/app/registri/prove/$(basename "$x" .flac).mp3"
    done
    ls audio/prove/$id-$i-*.mp3; echo "Per usarne una: bash rifai.sh ${id#00} --scegli $i K"; exit 0 ;;
  --scegli)
    [ -f "audio/prove/$id-$2-$3.flac" ] || { echo "Presa audio/prove/$id-$2-$3.flac non trovata"; exit 2; }
    cp "audio/prove/$id-$2-$3.flac" "$D/$2.flac"
    monta "SCELTA presa $3 della frase $2" "$2"; exit ;;
  --monta)
    monta "RIMONTATO" ""; exit ;;
esac
[ $# -gt 0 ] || { echo "Indica almeno una frase"; exit 2; }
for j in "$@"; do rm -f "$D/$j.flac"; done
if [ "$MONTA" = "no" ]; then
  solo_frasi "frasi $* senza montaggio" || { echo "ERRORE: vedi Audiolibro/audio/rifai-$id.txt"; exit 1; }
  echo "$*" >> "audio/da-montare-$id.txt"
  echo "$(date '+%F %T') $f frasi $* pronte, da rimontare (rifai.sh ${id#00} --monta)" | tee -a audio/stato.txt; exit 0
fi
monta "RIFATTE frasi $*" "$*"
