/* Iron Sharpener service worker — v19 gentle/offline-safe update
   Keeps the existing cache name so already-cached Scripture/resources are preserved. */
const IRON_SHARPENER_CACHE = "iron-sharpener-offline-v15";
const IRON_SHARPENER_CACHE_PREFIX = "iron-sharpener-offline-";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(IRON_SHARPENER_CACHE).then((cache) => {
      return cache.addAll([
        "./",
        "./index.html",
        "./manifest.json",
        "./assets/iron-sharpener-logo.png"
      ]).catch(() => undefined);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith(IRON_SHARPENER_CACHE_PREFIX) && key !== IRON_SHARPENER_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function shouldHandle(request) {
  if (!request || request.method !== "GET") return false;

  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin;
  } catch (_) {
    return false;
  }
}

async function putIfGood(cache, request, response) {
  if (response && response.ok && response.type !== "opaque") {
    cache.put(request, response.clone()).catch(() => undefined);
  }
}

async function cacheFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const root = await caches.match("./");
  if (root) return root;

  const index = await caches.match("./index.html");
  if (index) return index;

  return null;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(IRON_SHARPENER_CACHE);
      await putIfGood(cache, request, response);
    }
    return response;
  } catch (error) {
    const fallback = await cacheFallback(request);
    if (fallback) return fallback;
    throw error;
  }
}

async function networkFirstResource(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  try {
    const response = await fetch(request);

    // v19: if GitHub Pages returns a throttle/error page, use the offline cache instead.
    if (!response || !response.ok) {
      const cached = await caches.match(request);
      if (cached) return cached;
      return response;
    }

    await putIfGood(cache, request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  try {
    const response = await fetch(request);

    // v19: never show a GitHub Pages throttling/error document if a good app shell is cached.
    if (!response || !response.ok) {
      const fallback = await cacheFallback(request);
      if (fallback) return fallback;
      return response;
    }

    await putIfGood(cache, request, response);
    return response;
  } catch (error) {
    const fallback = await cacheFallback(request);
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!shouldHandle(request)) return;

  const url = new URL(request.url);
  const isNavigation = request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  if (isNavigation) {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if (request.cache === "reload" || request.cache === "no-store") {
    event.respondWith(networkFirstResource(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
