/* Iron Sharpener service worker — v21 stability
   Main change: same-origin JSON/assets are cache-first, not network-first, even
   when the page asks for no-store/reload. This avoids repeated GitHub Pages
   hits, prevents HTML protection pages from being returned as JSON, and keeps
   the app stable when resources are already cached. */
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
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(IRON_SHARPENER_CACHE_PREFIX) && key !== IRON_SHARPENER_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function sameOriginGet(request) {
  if (!request || request.method !== "GET") return false;
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin;
  } catch (_) {
    return false;
  }
}

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  try {
    const url = new URL(request.url);
    return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
  } catch (_) {
    return false;
  }
}

function isJsonRequest(request) {
  try {
    return new URL(request.url).pathname.endsWith(".json");
  } catch (_) {
    return false;
  }
}

async function putIfGood(cache, request, response) {
  if (!response || !response.ok || response.type === "opaque") return;

  try {
    const url = new URL(request.url);
    const contentType = response.headers.get("content-type") || "";
    if (url.pathname.endsWith(".json") && contentType && !contentType.includes("json")) return;
  } catch (_) {}

  cache.put(request, response.clone()).catch(() => undefined);
}

async function navigationFallback() {
  return (
    await caches.match("./index.html") ||
    await caches.match("index.html") ||
    await caches.match("./") ||
    null
  );
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await putIfGood(cache, request, response);
      return response;
    }

    const fallback = await navigationFallback();
    if (fallback) return fallback;
    return response || new Response("Iron Sharpener is unavailable offline.", { status: 503 });
  } catch (_) {
    const fallback = await navigationFallback();
    if (fallback) return fallback;
    return new Response("Iron Sharpener is unavailable offline.", { status: 503 });
  }
}

async function resourceCacheFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (isJsonRequest(request)) {
      const type = response?.headers?.get("content-type") || "";
      if (!response || !response.ok || (type && !type.includes("json"))) {
        return new Response("JSON resource unavailable or invalid.", {
          status: response?.status || 503,
          statusText: "JSON resource unavailable or invalid"
        });
      }
    }

    if (response && response.ok) await putIfGood(cache, request, response);
    return response;
  } catch (_) {
    return new Response("Offline resource not cached.", {
      status: 504,
      statusText: "Offline resource not cached"
    });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!sameOriginGet(request)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  // Stability rule: resources are cache-first even if the page uses no-store.
  // This prevents repeated thousands-file GitHub hits and protects already-cached
  // Scripture/resource JSON from temporary GitHub protection screens.
  event.respondWith(resourceCacheFirst(request));
});
