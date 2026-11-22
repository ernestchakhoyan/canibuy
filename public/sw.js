// canibuy service worker: makes the app installable and shows a short offline page instead of the browser's
// error when a page can't load. Nothing is cached: the budget lives in the user's Google Sheet and localStorage,
// so pages always come fresh from the network.
// ponytail: no offline caching; add a cache-first strategy for /_next/static if offline use is ever wanted.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>canibuy</title><body style="font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">
<div><p style="font-size:2rem;margin:0">📡</p><p>You're offline. canibuy will load when you're back online.</p>
<button onclick="location.reload()" style="font:inherit;padding:.6rem 1.2rem;border-radius:.75rem;border:1px solid #ccc">Retry</button></div>`;

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // everything else goes straight to the network
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
  );
});
