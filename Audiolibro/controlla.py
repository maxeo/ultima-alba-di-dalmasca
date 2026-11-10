# Controlla un audio generato: lo trascrive con Whisper e lo confronta con il testo dato alla voce.
# Segnala i punti in cui la voce ha detto parole che nel testo non ci sono, o ne ha saltate.
# Uso (dentro l'immagine e2a-whisper): python /app/controlla.py NNN-nome [--frasi i,j,...]
# Con --frasi riascolta solo quelle frasi (indici di rifai.sh, uguali ai blocchi del vtt) e aggiorna i risultati
# del controllo precedente: serve il vtt di prima in /app/controlli/NNN-nome.vtt-prima, lasciato da rifai.sh.
import sys, os, re, json, unicodedata, difflib
from faster_whisper import WhisperModel

nome = sys.argv[1]
frasi = sorted({int(x) for x in sys.argv[sys.argv.index("--frasi") + 1].split(",") if x}) if "--frasi" in sys.argv else []
modello = "large-v3-turbo"
testo = open(f"/app/testo/{nome}.txt", encoding="utf-8").read()


def norm(p):
    p = unicodedata.normalize("NFD", p.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", p)


def parole(s):
    return [w for w in (norm(x) for x in re.split(r"[\s'’\-]+", s)) if w]


atteso = parole(testo)



def ora(t):
    return f"{int(t // 60)}:{int(t % 60):02d}"


def confronta(atteso, sentito, tempi, crude):
    problemi = []
    sm = difflib.SequenceMatcher(None, atteso, sentito, autojunk=False)
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == "equal":
            continue
        na, nb = a2 - a1, b2 - b1
        # Una parola diversa qua e là è quasi sempre un nome proprio trascritto male: si ignora.
        if max(na, nb) < 3:
            continue
        if op == "replace" and difflib.SequenceMatcher(None, "".join(atteso[a1:a2]), "".join(sentito[b1:b2])).ratio() > 0.75:
            continue
        t = tempi[min(b1, len(tempi) - 1)] if tempi else 0
        problemi.append({
            "tempo": ora(t), "secondi": round(t, 1), "tipo": {"replace": "diverso", "delete": "saltato", "insert": "in più"}[op],
            "testo": " ".join(atteso[max(0, a1 - 3):a2 + 3]),
            "audio": " ".join(crude[max(0, b1 - 3):b2 + 3]),
        })
    return problemi, sm.ratio()


def leggi_vtt(f):
    righe = open(f, encoding="utf-8").read().split(chr(10))
    cue = []
    sec = lambda x: sum(float(v) * m for v, m in zip(reversed(x.split(":")), (1, 60, 3600)))
    for i, r in enumerate(righe):
        if "-->" in r:
            a, b = (sec(x.strip()) for x in r.split("-->"))
            cue.append([a, b, righe[i + 1] if i + 1 < len(righe) else ""])
    return cue


def trascrivi(m, da=None, a=None):
    # L'audio si decodifica con ffmpeg: la libreria av dell'immagine è troppo vecchia per faster-whisper.
    import subprocess, numpy as np
    taglio = ["-ss", f"{da:.3f}", "-to", f"{a:.3f}"] if da is not None else []
    pcm = subprocess.run(["ffmpeg", "-v", "error", *taglio, "-i", f"/app/audiobooks/{nome}.mp3", "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    segmenti, _ = m.transcribe(audio, language="it", word_timestamps=True,
                               beam_size=5, vad_filter=da is None, condition_on_previous_text=False)
    base = da or 0
    sentito, tempi, crude, elenco = [], [], [], []
    for s in segmenti:
        for w in s.words:
            elenco.append([round(base + w.start, 2), round(base + w.end, 2), w.word.strip()])
            for x in parole(w.word):
                sentito.append(x); tempi.append(base + w.start); crude.append(w.word.strip())
    return sentito, tempi, crude, elenco


f_json, f_parole = f"/app/controlli/{nome}.json", f"/app/controlli/{nome}.parole.json"
f_prima = f"/app/controlli/{nome}.vtt-prima"
parziale = bool(frasi) and all(os.path.exists(x) for x in (f_json, f_parole, f_prima))
if parziale:
    nuovi, vecchi = leggi_vtt(f"/app/audiobooks/{nome}.vtt"), leggi_vtt(f_prima)
    parziale = len(nuovi) == len(vecchi) and max(frasi) < len(nuovi)

m = WhisperModel(modello, device="cuda", compute_type="int8", download_root="/app/models/whisper")
if parziale:
    # Il resto del capitolo non è cambiato: si spostano i tempi del controllo precedente
    # e si riascoltano solo le frasi rifatte.
    def dove(t):
        for i, (a, b, _) in enumerate(vecchi):
            if a <= t < b:
                return i
        return len(vecchi) - 1
    def sposta(t):
        i = dove(t)
        return None if i in frasi else round(t + nuovi[i][0] - vecchi[i][0], 2)
    elenco = [[sposta(a), round(b + nuovi[dove(a)][0] - vecchi[dove(a)][0], 2), w] for a, b, w in json.load(open(f_parole, encoding="utf-8"))]
    elenco = [x for x in elenco if x[0] is not None]
    prec = json.load(open(f_json, encoding="utf-8"))
    problemi = []
    for p in prec["problemi"]:
        t = sposta(p["secondi"])
        if t is not None:
            problemi.append({**p, "secondi": round(t, 1), "tempo": ora(t)})
    for i in frasi:
        a, b, testo_frase = nuovi[i]
        sentito, tempi, crude, el = trascrivi(m, max(0, a - 0.2), b + 0.2)
        elenco += el
        nuovi_p, _ = confronta(parole(testo_frase), sentito, tempi, crude)
        problemi += nuovi_p
    elenco.sort(key=lambda x: x[0]); problemi.sort(key=lambda p: p["secondi"])
    somiglianza = prec["somiglianza"]
else:
    atteso = parole(testo)
    sentito, tempi, crude, elenco = trascrivi(m)
    problemi, somiglianza = confronta(atteso, sentito, tempi, crude)
# I tempi di ogni parola servono al lettore web per evidenziare le frasi al momento giusto (pubblica.js).
with open(f_parole, "w", encoding="utf-8") as f:
    json.dump(elenco, f, ensure_ascii=False)
with open(f_json, "w", encoding="utf-8") as f:
    json.dump({"capitolo": nome, "somiglianza": round(somiglianza, 4), "problemi": problemi}, f, ensure_ascii=False, indent=1)
if os.path.exists(f_prima):
    os.remove(f_prima)
quali = f" (solo frasi {', '.join(map(str, frasi))})" if parziale else ""
print(f"{nome}: somiglianza {somiglianza:.3f}, punti da ascoltare {len(problemi)}{quali}")
for p in problemi:
    print(f"  {p['tempo']} [{p['tipo']}] testo: «{p['testo']}» | audio: «{p['audio']}»")
