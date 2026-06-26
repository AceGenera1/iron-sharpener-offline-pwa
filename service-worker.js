/* Iron Sharpener service worker — v26 public stability rescue v29
   App shell/index.html is network-first and cached only in the current cache.
   Scripture/resources stay cache-first, with old caches used only as resource fallbacks.
   This avoids old UI shells and avoids broad CacheStorage scans that can stall the browser. */
const IRON_SHARPENER_CACHE = "iron-sharpener-offline-v26-public-stability-v29-20260626";
const IRON_SHARPENER_RESOURCE_FALLBACK_CACHES = [
  "iron-sharpener-offline-v26-public-lock-20260626-darkonly",
  "iron-sharpener-offline-v26-public-lock-20260626",
  "iron-sharpener-offline-v15"
];

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
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function sameOriginGet(request) {
  if (!request || request.method !== "GET") return false;
  try { return new URL(request.url).origin === self.location.origin; }
  catch (_) { return false; }
}

function isNavigationRequest(request) {
  return request && request.mode === "navigate";
}

function pathnameFor(requestOrUrl) {
  try {
    const raw = typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url;
    return new URL(raw, self.location.href).pathname;
  } catch (_) {
    return "";
  }
}

function isJsonRequest(request) {
  return pathnameFor(request).endsWith(".json");
}

function noDotKey(request) {
  const path = pathnameFor(request).replace(/^\//, "");
  return path || request;
}

async function putIfGood(cache, request, response) {
  if (!response || !response.ok || response.type === "opaque") return false;

  try {
    const path = pathnameFor(request);
    const type = response.headers.get("content-type") || "";
    if (path.endsWith(".json") && type && !type.includes("json")) return false;
    if ((path.endsWith(".html") || path.endsWith("/")) && type && !type.includes("html")) return false;
    await cache.put(request, response.clone());
    return true;
  } catch (_) {
    return false;
  }
}

async function cacheHtmlResponse(cache, response, request) {
  if (!response || !response.ok) return;
  const type = response.headers.get("content-type") || "";
  if (type && !type.includes("html")) return;

  await putIfGood(cache, request, response);
  await putIfGood(cache, "./index.html", response);
  await putIfGood(cache, "index.html", response);
  await putIfGood(cache, "./", response);
}

async function cacheFreshCoreShell() {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  try {
    const response = await fetch(new Request("./index.html", { cache: "reload" }));
    if (response && response.ok) await cacheHtmlResponse(cache, response, "./index.html");
  } catch (_) {}

  for (const asset of CORE_ASSETS.filter((item) => !item.endsWith("index.html"))) {
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
    return response || await navigationFallback();
  } catch (_) {
    return await navigationFallback();
  }
}

async function matchInNamedCaches(request, cacheNames) {
  for (const name of cacheNames) {
    try {
      const cache = await caches.open(name);
      const cached = await cache.match(request) || await cache.match(noDotKey(request));
      if (cached) return cached;
    } catch (_) {}
  }
  return null;
}

async function resourceCacheFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  const cached = await cache.match(request) || await cache.match(noDotKey(request));
  if (cached) return cached;

  const oldCached = await matchInNamedCaches(request, IRON_SHARPENER_RESOURCE_FALLBACK_CACHES);
  if (oldCached) {
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

  event.respondWith(resourceCacheFirst(request));
});
