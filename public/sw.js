/**
 * Minimal service worker for Yonderia.
 *
 * Caches the app shell (HTML, key assets) for faster re-opens on mobile.
 * Does NOT implement full offline-first caching — the app relies on the
 * server for data. This just prevents a blank white screen on re-launch.
 */

const CACHE_NAME = "yonderia-v1";
const SHELL_URLS = ["/yonderia_logo.jpg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only cache GET requests for same-origin resources
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first strategy: try network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (
          response.ok &&
          (url.pathname.startsWith("/_next/static/") ||
            url.pathname.match(/\.(jpg|jpeg|png|svg|webp|ico|css|js)$/))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
