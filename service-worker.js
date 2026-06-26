/* Iron Sharpener service worker — v26 public offline/UI lock
   Goal: keep the app shell/index.html network-first while preserving stable
   cache-first behavior for same-origin Scripture/resource JSON and assets.
   This prevents older cached UI from being served offline after an update. */
const IRON_SHARPENER_CACHE = "iron-sharpener-offline-v26-public-lock-20260626";
const IRON_SHARPENER_OLD_CACHES = ["iron-sharpener-offline-v15"];
const IRON_SHARPENER_CACHE_PREFIX = "iron-sharpener-offline-";
const CORE_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./assets/iron-sharpener-logo.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheFreshCoreShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Keep older resource caches available as a fallback so already-cached
    // Scripture/study JSON remains usable. Navigation fallback below never uses
    // old index.html, so old UI cannot win offline.
    await self.clients.claim();
  })());
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

function isHtmlLikeRequest(request) {
  try {
    const url = new URL(request.url);
    return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html") || request.mode === "navigate";
  } catch (_) {
    return false;
  }
}

async function putIfGood(cache, request, response) {
  if (!response || !response.ok || response.type === "opaque") return false;

  try {
    const url = new URL(request.url || String(request), self.location.href);
    const contentType = response.headers.get("content-type") || "";

    if (url.pathname.endsWith(".json") && contentType && !contentType.includes("json")) return false;
    if ((url.pathname.endsWith(".html") || url.pathname.endsWith("/")) && contentType && !contentType.includes("html")) return false;
  } catch (_) {}

  try {
    await cache.put(request, response.clone());
    return true;
  } catch (_) {
    return false;
  }
}

async function cacheHtmlResponse(cache, response, request) {
  if (!response || !response.ok) return;
  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.includes("html")) return;

  await putIfGood(cache, request, response);
  await putIfGood(cache, "./index.html", response);
  await putIfGood(cache, "index.html", response);
  await putIfGood(cache, "./", response);
}

async function cacheFreshCoreShell() {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  try {
    const htmlResponse = await fetch(new Request("./index.html", { cache: "reload" }));
    if (htmlResponse && htmlResponse.ok) {
      await cacheHtmlResponse(cache, htmlResponse, "./index.html");
    }
  } catch (_) {}

  for (const asset of CORE_ASSETS.filter(item => !item.endsWith("index.html"))) {
    try {
      const response = await fetch(new Request(asset, { cache: "reload" }));
      if (response && response.ok) {
        await putIfGood(cache, asset, response);
        await putIfGood(cache, asset.replace(/^\.\//, ""), response);
      }
    } catch (_) {}
  }
}

async function navigationFallback() {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  return (
    await cache.match("./index.html") ||
    await cache.match("index.html") ||
    await cache.match("./") ||
    new Response("Iron Sharpener is unavailable offline.", { status: 503 })
  );
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  try {
    const response = await fetch(new Request(request, { cache: "reload" }));
    if (response && response.ok) {
      await cacheHtmlResponse(cache, response, request);
      return response;
    }

    const fallback = await navigationFallback();
    return fallback || response || new Response("Iron Sharpener is unavailable offline.", { status: 503 });
  } catch (_) {
    return await navigationFallback();
  }
}

async function matchOldResourceCache(request) {
  // Never return old cached HTML for navigation/app-shell requests.
  if (isHtmlLikeRequest(request)) return null;

  for (const name of IRON_SHARPENER_OLD_CACHES) {
    try {
      const cache = await caches.open(name);
      const cached = await cache.match(request) || await cache.match(urlWithoutDot(request));
      if (cached) return cached;
    } catch (_) {}
  }

  try {
    const cached = await caches.match(request);
    if (cached && !isHtmlLikeRequest(request)) return cached;
  } catch (_) {}

  return null;
}

function urlWithoutDot(request) {
  try {
    const url = new URL(request.url);
    return url.pathname.replace(/^\//, "");
  } catch (_) {
    return request;
  }
}

async function resourceCacheFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  const cached = await cache.match(request) || await cache.match(urlWithoutDot(request));
  if (cached) return cached;

  const oldCached = await matchOldResourceCache(request);
  if (oldCached) {
    // Promote old resource cache hits into the current cache as they are used.
    await putIfGood(cache, request, oldCached);
    return oldCached;
  }

  try {
    const response = await fetch(request);

    if (isJsonRequest(request)) {
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (!response || !response.ok || (type && !type.includes("json"))) {
        return new Response("JSON resource unavailable or invalid.", {
          status: response ? response.status : 503,
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

  // Stability rule: same-origin JSON/assets remain cache-first so offline study
  // resources stay stable and protected from temporary host errors.
  event.respondWith(resourceCacheFirst(request));
});
