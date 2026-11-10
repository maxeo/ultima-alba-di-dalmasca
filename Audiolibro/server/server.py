# Server per l'audiolibro: tiene caricato XTTS e converte un capitolo per richiesta,
# con lo stesso codice di ebook2audiobook (stesse opzioni della riga di comando, stessa voce, stesse sessioni).
#   POST /converti  {"args": ["--headless", "--ebook", ...], "log": "/app/audiobooks/../audio/log-004.txt", "solo_frasi": false}
#        -> {"exit": 0}   (risponde a lavoro finito; un lavoro alla volta; con solo_frasi si ferma prima del montaggio)
#   GET  /stato     -> {"occupato": bool, "lavoro": [...], "dal": "..."}
import builtins, contextlib, json, os, re, sys, threading, time, traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.chdir('/app')
sys.path.insert(0, '/app')
import app
import lib.core as c

# Il modello resta in memoria fra un capitolo e l'altro (ebook2audiobook lo scaricherebbe a fine lavoro).
c.cleanup_models_cache = lambda: None
# Le domande a terminale ("Resume? [s]kip / [y]es") hanno sempre risposta sì, come faceva rifai.sh.
builtins.input = lambda *a, **k: 'y'


# La voce italiana ricavata da quella inglese incorporata e i "latents" della voce si calcolano una volta sola
# per server, invece che a ogni lavoro: risparmiano circa 15 secondi a ogni rifai.sh.
from lib.classes.tts_engines.common.utils import TTSUtils
from lib.classes.tts_engines.xtts import XTTSv2

_voci = {}
_originale_voce = TTSUtils._check_xtts_builtin_speakers


def _voce_memo(self, current_voice, speaker):
    chiave = (current_voice, speaker, self.session['language'])
    fatta = _voci.get(chiave)
    if isinstance(fatta, str) and os.path.exists(fatta):
        return fatta
    fatta = _originale_voce(self, current_voice, speaker)
    _voci[chiave] = fatta
    return fatta


TTSUtils._check_xtts_builtin_speakers = _voce_memo
_latents = {}
_originale_init = XTTSv2.__init__


def _init_latents(self, *a, **k):
    _originale_init(self, *a, **k)
    self.params['latent_embedding'] = _latents


XTTSv2.__init__ = _init_latents


# Prova: con "solo_frasi" il lavoro si ferma appena le frasi mancanti sono generate, prima del montaggio.
class SoloFrasi(BaseException):
    pass


_solo_frasi = type("Stato", (), {"attivo": False})()  # un lavoro alla volta: basta un valore globale
_originale_monta = c.combine_audio_sentences


def _monta(*a, **k):
    if getattr(_solo_frasi, 'attivo', False):
        raise SoloFrasi()
    return _originale_monta(*a, **k)


c.combine_audio_sentences = _monta

blocco = threading.Lock()
stato = {'occupato': False, 'lavoro': None, 'dal': None}

# Nome dell'audiolibro mostrato in testa a ogni riga. Il client può indicarlo con il
# campo "libro"; per i capitoli del romanzo (file NNN-nome.txt) si usa il titolo.
ROMANZO = "L'ultima alba di Dalmàsca"
PROGRAMMA = 'audiolibro'


def ora():
    adesso = time.time()
    return time.strftime('%F %T', time.localtime(adesso)) + '.%03d' % int(adesso % 1 * 1000)


def registra(componente, messaggio, livello='INFO', uscita=None, libro=PROGRAMMA):
    (uscita or sys.__stdout__).write('%s - %s [%s] [%s] %s\n' % (libro, ora(), livello, componente, messaggio))
    (uscita or sys.__stdout__).flush()


def nome_libro(dati):
    if dati.get('libro'):
        return dati['libro']
    for i, a in enumerate(dati.get('args', [])):
        if a == '--ebook' and i + 1 < len(dati['args']):
            base = re.sub(r'\.[a-z0-9]+$', '', os.path.basename(dati['args'][i + 1]))
            return ROMANZO if re.match(r'^\d{3}-', base) else base
    return PROGRAMMA


class Console:
    """Console del container: una riga per messaggio, nel formato del log di BankMonitor.

    L'avanzamento di ebook2audiobook arriva a pezzi separati da ritorno carrello:
    qui diventa una riga per ogni frase generata davvero. Le frasi già pronte (che il
    programma scorre in pochi millisecondi) non si scrivono una per una: si contano.
    I messaggi tecnici ripetuti a ogni lavoro si tolgono, gli altri si traducono.
    """

    AVANZAMENTO = re.compile(r'^\d+(?:\.\d+)?%:\s*:\s*(\d+)/(\d+)\b(.*)$', re.S)
    ORNAMENTO = re.compile(r'^[\s*\-=_#]+$')
    # Sotto questo tempo la frase non è stata generata: c'era già.
    SALTATA = 0.4
    # (espressione, testo da scrivere; None = non scrivere). Vale il primo che combacia.
    MESSAGGI = [
        (r'^v\d+\.\d+\.\d+ .*mode$', None),
        (r'^---> Hardware detected', None),
        (r'^vram_dict:', None),
        (r'^Using CUDA$', None),
        (r'^Free Memory available', None),
        (r'^Processing eBook file', None),
        (r'^Warning! Some sentences are already converted', None),
        (r'^Get sentences', None),
        (r'^Block \d+ — sentences already split', None),
        (r'^Loading TTS .* please be patient', None),
        (r'^TTS .* Loaded!$', None),
        (r'^A total of \d+ blocks? and (\d+) sentences', r'capitolo di \1 frasi'),
        (r'^\d{3}-[\w-]+$', None),
        (r'Block \d+ has \d+ missing audio files, reconverting only those: \[(.*)\]', r'frasi da generare: \1'),
        (r'^Block \d+ chapter audio missing', 'manca il blocco montato: si rifà tutto il capitolo'),
        (r'^Chapter \d+ \(block \d+\) containing', None),
        (r'^Chapter \d+ \(block \d+\) — has all sentences', 'tutte le frasi sono già pronte'),
        (r'^Converting builtin eng voice to (\w+)', r'preparo la voce (\1)'),
        (r'^Normalize completed', None),
        (r'^Computing speaker latents', 'calcolo i parametri della voce'),
        (r'^End of Chapter', None),
        (r'^Combining chapter \d+ \(block \d+\) to audio', 'monto le frasi del capitolo'),
        (r'^Combining sentences and chapters', "monto l'audio finale"),
        (r'^Assemble - ', None),
        (r'^Assemble completed', None),
        (r'^Completed →', None),
        (r'^\*+ Combined block audio file saved', None),
        (r'^Export - ', 'esporto mp3 e sottotitoli'),
        (r'^Frasi pronte: montaggio saltato', 'frasi pronte, montaggio saltato (prova)'),
    ]

    def __init__(self, componente, uscita, livello='INFO', libro=PROGRAMMA):
        self.componente = componente
        self.uscita = uscita
        self.livello = livello
        self.libro = libro
        self.resto = ''
        # L'avanzamento della stessa frase arriva in più pezzi: il testo della frase
        # sta nell'ultimo. Si tiene da parte e si scrive quando cambia la frase.
        self.sospeso = None
        self.ultimo = time.time()
        self.saltate = 0
        self.una_volta = set()

    def write(self, testo):
        self.resto += testo
        pezzi = re.split(r'[\r\n]+', self.resto)
        self.resto = pezzi.pop()
        for pezzo in pezzi:
            self.riga(pezzo.strip())
        return len(testo)

    def riga(self, testo):
        if not testo or self.ORNAMENTO.match(testo) or 'files/s' in testo:
            return
        adesso, prima = time.time(), self.ultimo
        self.ultimo = adesso
        avanzamento = self.AVANZAMENTO.match(testo)
        if avanzamento:
            fatte, totali, coda = avanzamento.group(1), avanzamento.group(2), avanzamento.group(3)
            frase = coda.split(' : ')[-1].strip().replace('\n', ' ')
            frase = re.sub(r'\[[a-z0-9]+\]', '', frase).strip()[:90]
            if self.sospeso and self.sospeso[0] == fatte:
                if frase and not self.sospeso[2]:
                    self.sospeso = (fatte, totali, frase, self.sospeso[3])
                return
            self.scrivi_sospeso()
            # Il programma scrive l'avanzamento di una frase dopo averla generata:
            # il tempo dalla riga precedente è quanto ci ha messo.
            self.sospeso = (fatte, totali, frase, adesso - prima)
            return
        if testo.startswith(':') and self.sospeso:
            # Il testo della frase arriva su stdout, su una riga che comincia con ':'.
            coda = re.sub(r'\[[a-z0-9]+\]', '', re.sub(r'^:\s*', '', testo)).strip()[:90]
            if coda:
                if not self.sospeso[2]:
                    self.sospeso = (self.sospeso[0], self.sospeso[1], coda, self.sospeso[3])
                return
        self.scrivi_sospeso()
        livello = self.livello
        if re.search(r'\b(error|exception|traceback|failed)\b', testo, re.I):
            livello = 'ERROR'
        elif re.search(r'\b(warning|warn)\b', testo, re.I):
            livello = 'WARN'
        if livello == self.livello or testo.startswith('Warning! Some sentences'):
            for espressione, sostituto in self.MESSAGGI:
                m = re.search(espressione, testo)
                if not m:
                    continue
                if sostituto is None:
                    return
                # Messaggi che arrivano a ripetizione (l'esportazione): una volta sola.
                if espressione.startswith('^Export'):
                    if espressione in self.una_volta:
                        return
                    self.una_volta.add(espressione)
                testo, livello = m.expand(sostituto), self.livello
                break
        self.scrivi_saltate()
        registra(self.componente, testo, livello, self.uscita, self.libro)

    def scrivi_saltate(self):
        if self.saltate:
            registra(self.componente, ('1 frase già pronta, saltata' if self.saltate == 1 else '%d frasi già pronte, saltate' % self.saltate), self.livello, self.uscita, self.libro)
            self.saltate = 0

    def scrivi_sospeso(self):
        if not self.sospeso:
            return
        fatte, totali, frase, durata = self.sospeso
        self.sospeso = None
        if durata < self.SALTATA:
            self.saltate += 1
            return
        self.scrivi_saltate()
        registra(self.componente, 'frase %s di %s generata in %.1f s' % (fatte, totali, durata) + ('  ' + frase if frase else ''),
                 self.livello, self.uscita, self.libro)

    def chiudi(self):
        self.scrivi_sospeso()
        self.scrivi_saltate()

    def flush(self):
        # Il sospeso non si scrive qui: app.main() chiama flush() di continuo e
        # la frase perderebbe il suo testo, che arriva subito dopo.
        self.uscita.flush()


class Doppio:
    """Il log del capitolo resta grezzo; sulla console va la versione in righe."""

    def __init__(self, file_log, console):
        self.file_log = file_log
        self.console = console

    def write(self, testo):
        self.file_log.write(testo)
        self.file_log.flush()
        self.console.write(testo)
        return len(testo)

    def flush(self):
        self.file_log.flush()
        self.console.flush()


def converti(argv, log, libro=PROGRAMMA, solo_frasi=False, operazione=''):
    componente = re.sub(r'^log-|\.txt$', '', os.path.basename(log))
    _solo_frasi.attivo = solo_frasi
    inizio = time.time()
    registra(componente, 'avviato: ' + (operazione or 'conversione'), uscita=sys.__stdout__, libro=libro)
    # Una sola Console per i due flussi: l'avanzamento esce su stderr (tqdm) e il
    # testo della frase su stdout, quindi solo così restano appaiati e in ordine.
    console = Console(componente, sys.__stdout__, 'INFO', libro)
    with open(log, 'w', encoding='utf-8', buffering=1) as f, \
            contextlib.redirect_stdout(Doppio(f, console)), \
            contextlib.redirect_stderr(Doppio(f, console)):
        sys.argv = ['app.py'] + argv
        try:
            codice = 0
            app.main()
        except SoloFrasi:
            print('Frasi pronte: montaggio saltato (prova)')
            codice = 0
        except SystemExit as e:
            codice = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
        except BaseException:
            traceback.print_exc()
            codice = 1
    console.chiudi()
    registra(componente, 'conversione finita: uscita=%d durata=%ds' % (codice, time.time() - inizio),
             'INFO' if codice == 0 else 'ERROR', libro=libro)
    return codice


class Gestore(BaseHTTPRequestHandler):
    def _rispondi(self, codice, dati):
        corpo = json.dumps(dati).encode()
        self.send_response(codice)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        if self.path == '/stato':
            return self._rispondi(200, stato)
        self._rispondi(404, {'errore': 'percorso sconosciuto'})

    def do_POST(self):
        if self.path != '/converti':
            return self._rispondi(404, {'errore': 'percorso sconosciuto'})
        dati = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        if not blocco.acquire(blocking=False):
            registra('server', 'richiesta rifiutata: server occupato', 'WARN', libro=nome_libro(dati))
            return self._rispondi(409, {'errore': 'occupato', **stato})
        try:
            stato.update(occupato=True, lavoro=dati['args'], dal=time.strftime('%F %T'))
            codice = converti(dati['args'], dati.get('log', '/app/audiobooks/ultimo-log.txt'), nome_libro(dati),
                              bool(dati.get('solo_frasi')), dati.get('operazione', ''))
        finally:
            stato.update(occupato=False)
            blocco.release()
        self._rispondi(200, {'exit': codice})

    def log_message(self, *a):
        pass


# Con l'avvio 'spawn' i processi figli rileggono questo file: il server parte solo nel processo principale.
if __name__ == '__main__':
    app.init_multiprocessing()
    registra('server', 'pronto sulla porta 8770')
    ThreadingHTTPServer(('0.0.0.0', 8770), Gestore).serve_forever()
