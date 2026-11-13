// Tiene il lettore disponibile senza rete e serve i capitoli salvati con le richieste a intervalli.
// I libri dello scaffale hanno ognuno la sua cache "<chiave del libro>-audio-v1", anche su un altro dominio.
const SHELL = 'alba-shell-v6';
const FILE = ['./', 'index.html', 'manifest.webmanifest', 'icona.svg', 'caratteri/italianno-latin.woff2'];
const diLibro = n => n.endsWith('-audio-v1');

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== SHELL && !diLibro(n)).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Cerca un file fra le cache dei libri: quale libro sia non si sa dall'indirizzo.
async function salvato(href) {
  for (const n of await caches.keys()) {
    if (!diLibro(n)) continue;
    const c = await caches.open(n);
    const s = await c.match(href);
    if (s) return { c, s };
  }
  return null;
}

// Se il capitolo era stato salvato, aggiorna anche la copia sul dispositivo.
async function audio(req, url) {
  const copia = await salvato(url.href);
  if (copia) return intervallo(req, copia.s);
  if (!/^[a-f0-9]{64}$/.test(url.searchParams.get('v') || '')) return fetch(req);
  url.searchParams.delete('v');
  for (const nome of await caches.keys()) {
    if (!diLibro(nome)) continue;
    const cache = await caches.open(nome);
    const precedenti = (await cache.keys()).filter(chiave => {
      const vecchia = new URL(chiave.url);
      vecchia.searchParams.delete('v');
      return vecchia.href === url.href;
    });
    if (!precedenti.length) continue;
    const risposta = await fetch(req.url, { cache: 'no-cache' });
    if (risposta.status !== 200) return risposta;
    const bytes = await crypto.subtle.digest('SHA-256', await risposta.clone().arrayBuffer());
    const impronta = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    if (impronta !== new URL(req.url).searchParams.get('v')) return intervallo(req, risposta);
    await cache.put(req.url, risposta.clone());
    await Promise.all(precedenti.filter(chiave => chiave.url !== req.url).map(chiave => cache.delete(chiave)));
    return intervallo(req, risposta);
  }
  return fetch(req);
}

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

// Il testo e gli indici si aggiornano quando c'e' rete, anche nei capitoli salvati.
// Senza rete, o con rete bloccata, resta la copia salvata.
async function aggiorna(href) {
  const t = await salvato(href);
  try {
    const r = await fetch(href, { cache: 'no-cache', signal: t ? AbortSignal.timeout(4000) : undefined });
    if (!t) return r;
    if (!r.ok) return t.s;
    await t.c.put(href, r.clone());
    return r;
  } catch (err) {
    if (t) return t.s;
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const mio = u.origin === location.origin;
  if (u.pathname.endsWith('.mp3')) {
    e.respondWith(audio(e.request, u));
  } else if (u.pathname.includes('/testi/') || u.pathname.endsWith('/capitoli.json')) {
    e.respondWith(aggiorna(u.href));
  } else if (mio) {
    e.respondWith(reteOCopia(e.request));
  }
});
