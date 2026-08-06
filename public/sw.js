/*
 * KlipCode service worker.
 *
 * Snippet data is persisted separately in IndexedDB, so this worker only makes
 * the app shell available offline — it never caches API or Convex requests.
 *
 * Strategy:
 *  - Only same-origin GET requests are handled; everything else (POST, the
 *    Convex cross-origin traffic) falls through to the network.
 *  - Immutable build assets (/_next/static/*) and icons: cache-first.
 *  - Page navigations: network-first, falling back to the cached page and then
 *    to the cached /app shell when offline.
 *
 * Bump CACHE_VERSION to invalidate previously cached responses.
 */
const CACHE_VERSION = "v1";
const CACHE_NAME = `klipcode-${CACHE_VERSION}`;
const APP_SHELL = "/app";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(APP_SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("klipcode-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/favicon.svg" ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = (await cache.match(request)) || (await cache.match(APP_SHELL));
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
