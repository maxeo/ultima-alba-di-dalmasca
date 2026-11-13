# Controlla un audio generato: lo trascrive con Whisper e lo confronta con il testo dato alla voce.
# Segnala i punti in cui la voce ha detto parole che nel testo non ci sono, o ne ha saltate.
# Uso (dentro l'immagine e2a-whisper): python /app/controlla.py NNN-nome [--frasi i,j,...]
# Con --rivaluta non riascolta niente: rifà il confronto dalle parole già trascritte (controlli/NNN-nome.parole.json),
# per esempio dopo aver aggiunto righe a whisper-sente.tsv. Non serve la GPU: gira anche fuori dal contenitore.
# Con --frasi riascolta solo quelle frasi (indici di rifai.sh, uguali ai blocchi del vtt) e aggiorna i risultati
# del controllo precedente: serve il vtt di prima in /app/controlli/NNN-nome.vtt-prima, lasciato da rifai.sh.
import sys, os, re, json, unicodedata, difflib

BASE = os.path.dirname(os.path.abspath(__file__))
nome = sys.argv[1]
frasi = sorted({int(x) for x in sys.argv[sys.argv.index("--frasi") + 1].split(",") if x}) if "--frasi" in sys.argv else []
rivaluta = "--rivaluta" in sys.argv
modello = "large-v3-turbo"
# I tag per la voce ([pause:2]) non si dicono: non vanno nel testo atteso.
testo = re.sub(r"\[[^\]]*\]", " ", open(f"{BASE}/testo/{nome}.txt", encoding="utf-8").read())


def norm(p):
    p = unicodedata.normalize("NFD", p.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", p)


def parole(s):
    return [w for w in (norm(x) for x in re.split(r"[\s'’\-]+", s)) if w]


atteso = parole(testo)

# Whisper scrive i numeri in cifre («50 000», «19»), il testo li ha in lettere: le cifre si riscrivono in lettere.
UNITA = "zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove".split()
DECINE = "_ _ venti trenta quaranta cinquanta sessanta settanta ottanta novanta".split()


def in_lettere(n):
    if n < 20:
        return UNITA[n]
    if n < 100:
        d, u = divmod(n, 10)
        t = DECINE[d]
        if u == 0:
            return t
        return (t[:-1] if u in (1, 8) else t) + UNITA[u]
    if n < 1000:
        c, r = divmod(n, 100)
        testa = "cento" if c == 1 else UNITA[c] + "cento"
        if r == 0:
            return testa
        coda = in_lettere(r)
        return (testa[:-1] if coda.startswith("o") else testa) + coda
    if n < 1000000:
        m, r = divmod(n, 1000)
        testa = "mille" if m == 1 else in_lettere(m) + "mila"
        return testa + (in_lettere(r) if r else "")
    m, r = divmod(n, 1000000)
    testa = "unmilione" if m == 1 else in_lettere(m) + "milioni"
    return testa + (in_lettere(r) if r else "")


def lettere(t):
    t = re.sub(r"(?<!\d)(\d{1,3})(?:[ .](\d{3}))+(?!\d)", lambda m: m.group(0).replace(" ", "").replace(".", ""), t)
    return re.sub(r"\d+", lambda m: in_lettere(int(m.group(0))) if len(m.group(0)) < 10 else m.group(0), t)


# Parole che Whisper sente sempre male (soprattutto i nomi): whisper-sente.tsv, «sentito<TAB>scritto».
# Valgono solo dentro un punto già diverso dal testo, per decidere se è un falso allarme.
SENTE = []
f_sente = os.path.join(BASE, "whisper-sente.tsv")
if os.path.exists(f_sente):
    for r in open(f_sente, encoding="utf-8"):
        if r.strip() and not r.startswith("#") and "\t" in r:
            a, b = r.rstrip("\r\n").split("\t")[:2]
            if parole(a):
                SENTE.append((parole(a), parole(b)))
    SENTE.sort(key=lambda x: -len(x[0]))


def corretto(sentito):
    fuori, i = [], 0
    while i < len(sentito):
        for a, b in SENTE:
            if sentito[i:i + len(a)] == a:
                fuori += b
                i += len(a)
                break
        else:
            fuori.append(sentito[i])
            i += 1
    return fuori


def falso_allarme(a, b):
    # Dopo le correzioni note, quello che resta diverso è al più una parola qua e là, o la stessa cosa scritta attaccata.
    b = corretto(parole(lettere(" ".join(b))))
    if "".join(a) == "".join(b):
        return True
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return all(max(a2 - a1, b2 - b1) < 2 for op, a1, a2, b1, b2 in sm.get_opcodes() if op != "equal")



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
        if falso_allarme(atteso[a1:a2], sentito[b1:b2]):
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
    pcm = subprocess.run(["ffmpeg", "-v", "error", *taglio, "-i", f"{BASE}/audiobooks/{nome}.mp3", "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
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


f_json, f_parole = f"{BASE}/controlli/{nome}.json", f"{BASE}/controlli/{nome}.parole.json"
f_prima = f"{BASE}/controlli/{nome}.vtt-prima"
parziale = bool(frasi) and all(os.path.exists(x) for x in (f_json, f_parole, f_prima))
if parziale:
    nuovi, vecchi = leggi_vtt(f"{BASE}/audiobooks/{nome}.vtt"), leggi_vtt(f_prima)
    parziale = len(nuovi) == len(vecchi) and max(frasi) < len(nuovi)

if rivaluta:
    parziale = False
    elenco = json.load(open(f_parole, encoding="utf-8"))
    sentito, tempi, crude = [], [], []
    for a, _, w in elenco:
        for x in parole(lettere(w)):
            sentito.append(x); tempi.append(a); crude.append(w)
    problemi, somiglianza = confronta(atteso, sentito, tempi, crude)
else:
    from faster_whisper import WhisperModel
    m = WhisperModel(modello, device="cuda", compute_type="int8", download_root=f"{BASE}/models/whisper")
if rivaluta:
    pass
elif parziale:
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
        elenco += [x for x in el if a <= x[0] < b]  # le parole delle frasi vicine restano quelle di prima
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
