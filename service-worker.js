/* Iron Sharpener service worker — v36 Complete Offline Tool
   App-shell recovery: keep HTML fresh when online, but serve every cached
   Scripture/resource/asset file offline across Disciple Maker + Disciple Journal. */
const IRON_SHARPENER_CACHE = "iron-sharpener-offline-v36-complete-tool-20260630";
const IRON_SHARPENER_CACHE_PREFIX = "iron-sharpener-offline-";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "index.html",
  "./personal-study.html",
  "personal-study.html",
  "./manifest.json",
  "manifest.json",
  "./assets/iron-sharpener-logo.png",
  "assets/iron-sharpener-logo.png",
  "./assets/disciple-journal-logo.png",
  "assets/disciple-journal-logo.png",
  "./assets/disciple-journal-icon-192.png",
  "assets/disciple-journal-icon-192.png",
  "./assets/disciple-journal-icon-512.png",
  "assets/disciple-journal-icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheFreshCoreShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await removeOldHtmlShellEntries();
    await self.clients.claim();
  })());
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
  if (request.mode === "navigate") return true;
  try {
    const url = new URL(request.url);
    return url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  } catch (_) { return false; }
}

function isJsonRequest(request) {
  try { return new URL(request.url).pathname.endsWith(".json"); }
  catch (_) { return String(request || "").endsWith(".json"); }
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch (_) { return value; }
}

function cleanPath(value) {
  return String(value || "")
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function noDot(value) {
  return cleanPath(String(value || "").replace(/^\.\//, ""));
}

function withDot(value) {
  const path = noDot(value);
  return path ? `./${path}` : "./";
}

function encodeSpaces(value) {
  return String(value || "").replace(/ /g, "%20");
}

function requestPath(request) {
  try { return new URL(request.url).pathname.replace(/^\//, ""); }
  catch (_) { return noDot(request); }
}

function resourceKeyVariants(requestOrPath) {
  const raw = typeof requestOrPath === "string" ? requestOrPath : requestPath(requestOrPath);
  const path = noDot(raw);
  const decoded = safeDecode(path);
  const encoded = encodeSpaces(path);
  const keys = [requestOrPath, path, `/${path}`, withDot(path), decoded, `/${decoded}`, withDot(decoded), encoded, `/${encoded}`, withDot(encoded)];
  if (!path || path === "index.html") keys.push("./", "/", "index.html", "./index.html");
  return [...new Set(keys.filter(Boolean))];
}

function isHtmlRequestKey(key) {
  try {
    const url = typeof key === "string" ? new URL(key, self.location.href) : new URL(key.url);
    return url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  } catch (_) {
    const text = String(key || "");
    return text === "./" || text === "/" || text.endsWith(".html");
  }
}

async function putIfGood(cache, request, response) {
  if (!response || !response.ok || response.type === "opaque") return false;
  try {
    const url = new URL(typeof request === "string" ? request : request.url, self.location.href);
    const type = response.headers.get("content-type") || "";
    if (url.pathname.endsWith(".json") && type && !type.includes("json")) return false;
    if ((url.pathname.endsWith(".html") || url.pathname.endsWith("/")) && type && !type.includes("html")) return false;
  } catch (_) {}
  try { await cache.put(request, response.clone()); return true; }
  catch (_) { return false; }
}

async function putAllVariants(cache, key, response) {
  let saved = false;
  for (const variant of resourceKeyVariants(key)) {
    if (typeof variant !== "string") continue;
    saved = (await putIfGood(cache, variant, response)) || saved;
  }
  return saved;
}

function htmlCacheKeysForRequest(request) {
  const keys = [];
  try {
    const url = typeof request === "string" ? new URL(request, self.location.href) : new URL(request.url);
    let path = url.pathname.replace(/^\//, "") || "index.html";
    if (path.endsWith("/")) path += "index.html";
    keys.push(path, `./${path}`, safeDecode(path), `./${safeDecode(path)}`);
    if (path === "index.html") keys.push("./", "/");
  } catch (_) {
    keys.push(...resourceKeyVariants(request));
  }
  return [...new Set(keys.filter(Boolean))];
}

async function cacheHtmlResponse(cache, response, request) {
  if (!response || !response.ok) return false;
  const type = response.headers.get("content-type") || "";
  if (type && !type.includes("html")) return false;
  let saved = false;
  for (const key of htmlCacheKeysForRequest(request)) {
    saved = (await putIfGood(cache, key, response)) || saved;
  }
  return saved;
}

async function cacheFreshCoreShell() {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  for (const asset of CORE_ASSETS) {
    try {
      const response = await fetch(new Request(asset, { cache: "reload" }));
      if (response && response.ok) {
        if (asset.endsWith(".html") || asset === "./" || asset.endsWith("/")) {
          await cacheHtmlResponse(cache, response, asset);
        } else {
          await putAllVariants(cache, asset, response);
        }
      }
    } catch (_) {}
  }
}

async function removeOldHtmlShellEntries() {
  const keys = await caches.keys();
  for (const name of keys) {
    if (!name.startsWith(IRON_SHARPENER_CACHE_PREFIX)) continue;
    if (name === IRON_SHARPENER_CACHE) continue;
    try {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      await Promise.all(requests.filter(isHtmlRequestKey).map((request) => cache.delete(request)));
      await cache.delete("./");
      await cache.delete("/");
      await cache.delete("./index.html");
      await cache.delete("index.html");
      await cache.delete("./personal-study.html");
      await cache.delete("personal-study.html");
    } catch (_) {}
  }
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  try {
    const response = await fetch(new Request(request, { cache: "reload" }));
    if (response && response.ok) {
      await cacheHtmlResponse(cache, response, request);
      return response;
    }
  } catch (_) {}

  for (const key of htmlCacheKeysForRequest(request)) {
    const cached = await cache.match(key) || await matchAnyResourceCache(key);
    if (cached) return cached;
  }

  return (await cache.match("./index.html")) || (await cache.match("index.html")) || new Response("Iron Sharpener is unavailable offline until the app shell is refreshed online.", { status: 503, headers: { "content-type": "text/plain" } });
}

async function matchAnyResourceCache(requestOrPath) {
  const cacheNames = await caches.keys();
  const variants = resourceKeyVariants(requestOrPath);
  for (const name of cacheNames) {
    try {
      const cache = await caches.open(name);
      for (const key of variants) {
        const cached = await cache.match(key);
        if (cached) return cached;
      }
    } catch (_) {}
  }
  return null;
}

async function resourceCacheFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  const cached = await matchAnyResourceCache(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isJsonRequest(request)) {
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (!response || !response.ok || (type && !type.includes("json"))) {
        return new Response("JSON resource unavailable or invalid.", { status: response ? response.status : 503 });
      }
    }
    if (response && response.ok) await putAllVariants(cache, request, response);
    return response;
  } catch (_) {
    const fallback = await matchAnyResourceCache(request);
    if (fallback) return fallback;
    return new Response("Offline resource not cached.", { status: 504 });
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
