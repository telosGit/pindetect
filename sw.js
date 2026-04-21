// sw.js
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const faviconHits = new Map(); // clientId -> [timestamps]

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith('/favicon.svg')) return;

  event.respondWith((async () => {
    // Serve a tiny SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" fill="#4285f4"/></svg>`;

    // Notify all clients that a favicon request occurred
    const clients = await self.clients.matchAll({ type: 'window' });
    const payload = { type: 'favicon-hit', t: Date.now(),
                      dest: event.request.destination,
                      mode: event.request.mode };
    clients.forEach(c => c.postMessage(payload));

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        // CRITICAL: no-store forces Chrome to actually hit us on state change
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    });
  })());
});
