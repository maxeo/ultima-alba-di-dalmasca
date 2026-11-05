// Tiene il lettore disponibile senza rete e serve l'audio salvato con le richieste a intervalli.
const SHELL = 'alba-shell-v1';
const AUDIO = 'alba-audio-v1';
const FILE = ['./', 'index.html', 'manifest.webmanifest', 'icona.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== SHELL && n !== AUDIO).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

async function intervallo(req, res) {
  const dati = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  const tot = dati.byteLength;
  if (!m) {
    return new Response(dati, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': tot, 'Accept-Ranges': 'bytes' } });
  }
  const ini = m[1] ? +m[1] : Math.max(0, tot - +m[2]);
  const fine = m[1] && m[2] ? Math.min(+m[2], tot - 1) : tot - 1;
  return new Response(dati.slice(ini, fine + 1), {
    status: 206,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': fine - ini + 1,
      'Content-Range': `bytes ${ini}-${fine}/${tot}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

// Rete prima, cosi' i capitoli nuovi compaiono subito. Senza rete, la copia salvata.
async function reteOCopia(req) {
  const c = await caches.open(SHELL);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const s = await c.match(req, { ignoreSearch: true });
    if (s) return s;
    if (req.mode === 'navigate') return c.match('index.html');
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('.mp3')) {
    e.respondWith(caches.open(AUDIO).then(c => c.match(u.href)).then(s => (s ? intervallo(e.request, s) : fetch(e.request))));
  } else if (u.pathname.includes('/testi/')) {
    e.respondWith(caches.open(AUDIO).then(c => c.match(u.href)).then(s => s || fetch(e.request)));
  } else {
    e.respondWith(reteOCopia(e.request));
  }
});
