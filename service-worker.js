/* Iron Sharpener service worker — v52 Browser Scripture Local-First Polish
   Purpose: keep IndexedDB as the primary Bible database, keep fast page switching, and make browser Scripture loads prefer already-saved local Bible JSON before touching the network.

   Notes:
   - Does not change app data or Journal entries.
   - Keeps current HTML shells fast.
   - Does not scan every old cache for every verse file.
*/

const IRON_SHARPENER_CACHE = "iron-sharpener-offline-v52-browser-scripture-local-first-20260702";
const IRON_SHARPENER_CACHE_PREFIX = "iron-sharpener-offline-";

// Caches created by the working offline-preparation engines.
const KNOWN_RESOURCE_CACHES = [
  "iron-sharpener-offline-v36-complete-tool-20260630",
  "iron-sharpener-offline-v105-public-ready-cache",
  "iron-sharpener-offline-v34-final-offline-sync-20260627",
  "iron-sharpener-offline-v26-public-lock-20260626"
];

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
  "assets/disciple-journal-logo.png"
];

let priorityCacheNamesPromise = null;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheFreshCoreShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await removeOldHtmlShellEntriesOnly();
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

function isBibleJsonRequest(request) {
  try { return /\/bible\/web\//.test(new URL(request.url).pathname) && new URL(request.url).pathname.endsWith(".json"); }
  catch (_) { return /bible\/web\/.+\.json$/.test(String(request || "")); }
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch (_) { return value; }
}

function cleanPath(value) {
  return String(value || "")
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "")
    .replace(/^\.\.\//, "")
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

function canonicalResourcePath(requestOrPath) {
  const path = noDot(typeof requestOrPath === "string" ? requestOrPath : requestPath(requestOrPath));
  const decoded = safeDecode(path);
  // If something was requested as ../bible/web/..., normalize to bible/web/...
  const bibleIndex = decoded.indexOf("bible/web/");
  if (bibleIndex >= 0) return decoded.slice(bibleIndex);
  return decoded;
}

function resourceKeyVariants(requestOrPath) {
  const original = requestOrPath;
  const path = canonicalResourcePath(requestOrPath);
  const decoded = safeDecode(path);
  const encoded = encodeSpaces(path);
  const keys = [
    original,
    path,
    `/${path}`,
    withDot(path),
    decoded,
    `/${decoded}`,
    withDot(decoded),
    encoded,
    `/${encoded}`,
    withDot(encoded)
  ];
  if (!path || path === "index.html") keys.push("./", "/", "index.html", "./index.html");
  return [...new Set(keys.filter(Boolean))];
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

function isHtmlRequestKey(key) {
  try {
    const url = typeof key === "string" ? new URL(key, self.location.href) : new URL(key.url);
    return url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  } catch (_) {
    const text = String(key || "");
    return text === "./" || text === "/" || text.endsWith(".html");
  }
}

function looksOnline() {
  try { return !!(self.navigator && self.navigator.onLine); }
  catch (_) { return true; }
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
    if (typeof variant !== "string" && !(variant instanceof Request)) continue;
    saved = (await putIfGood(cache, variant, response)) || saved;
  }
  return saved;
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

async function removeOldHtmlShellEntriesOnly() {
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

async function getPriorityCacheNames() {
  if (!priorityCacheNamesPromise) {
    priorityCacheNamesPromise = (async () => {
      const existing = await caches.keys();
      const names = [];
      const add = (name) => {
        if (name && existing.includes(name) && !names.includes(name)) names.push(name);
      };
      add(IRON_SHARPENER_CACHE);
      KNOWN_RESOURCE_CACHES.forEach(add);
      // In case the exact complete-cache name changes later, prefer complete-tool caches.
      existing
        .filter((name) => name.startsWith(IRON_SHARPENER_CACHE_PREFIX) && /complete|public-ready|final-offline-sync/i.test(name))
        .forEach(add);
      return names;
    })();
  }
  return priorityCacheNamesPromise;
}

async function matchInCacheName(cacheName, requestOrPath) {
  try {
    const cache = await caches.open(cacheName);
    const variants = resourceKeyVariants(requestOrPath);
    for (const key of variants) {
      const cached = await cache.match(key, { ignoreSearch: true });
      if (cached) return cached;
    }
  } catch (_) {}
  return null;
}


function fastBibleKeyVariants(requestOrPath) {
  const path = canonicalResourcePath(requestOrPath);
  const decoded = safeDecode(path);
  const encoded = encodeSpaces(decoded);
  const keys = [
    decoded,
    `/${decoded}`,
    `./${decoded}`,
    encoded,
    `/${encoded}`,
    `./${encoded}`
  ];
  return [...new Set(keys.filter(Boolean))];
}

async function fastBibleMatchInCacheName(cacheName, requestOrPath) {
  try {
    const cache = await caches.open(cacheName);
    for (const key of fastBibleKeyVariants(requestOrPath)) {
      const cached = await cache.match(key, { ignoreSearch: true });
      if (cached) return cached;
    }
  } catch (_) {}
  return null;
}

async function fastKnownBibleBackupMatch(requestOrPath) {
  // Keep this intentionally small and exact. The older broad cache scan caused delays.
  const existing = await caches.keys();
  const ordered = [IRON_SHARPENER_CACHE, ...KNOWN_RESOURCE_CACHES]
    .filter((name, index, arr) => name && arr.indexOf(name) === index && existing.includes(name));
  for (const name of ordered) {
    const cached = await fastBibleMatchInCacheName(name, requestOrPath);
    if (cached) return cached;
  }
  return null;
}

async function tightResourceMatch(requestOrPath) {
  const cacheNames = await getPriorityCacheNames();
  for (const name of cacheNames) {
    const cached = await matchInCacheName(name, requestOrPath);
    if (cached) return cached;
  }
  return null;
}

async function cachedHtmlForNavigation(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  for (const key of htmlCacheKeysForRequest(request)) {
    const cached = await cache.match(key, { ignoreSearch: true }) || await tightResourceMatch(key);
    if (cached) return cached;
  }
  return null;
}

async function refreshNavigationInBackground(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  try {
    const response = await fetch(new Request(request, { cache: "reload" }));
    if (response && response.ok) await cacheHtmlResponse(cache, response, request);
  } catch (_) {}
}

async function navigationFastCached(request, event) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  const cached = await cachedHtmlForNavigation(request);
  if (cached) {
    try {
      if (event && event.waitUntil && looksOnline()) event.waitUntil(refreshNavigationInBackground(request));
    } catch (_) {}
    return cached;
  }

  if (looksOnline()) {
    try {
      const response = await fetch(new Request(request, { cache: "reload" }));
      if (response && response.ok) {
        await cacheHtmlResponse(cache, response, request);
        return response;
      }
    } catch (_) {}
  }

  let wantsJournal = false;
  try { wantsJournal = new URL(request.url).pathname.endsWith("/personal-study.html"); } catch (_) {}
  if (wantsJournal) {
    return (await cache.match("./personal-study.html")) ||
      (await cache.match("personal-study.html")) ||
      new Response("Iron Sharpener Journal is unavailable offline until the app is opened once online.", { status: 503, headers: { "content-type": "text/plain" } });
  }
  return (await cache.match("./index.html")) ||
    (await cache.match("index.html")) ||
    new Response("Iron Sharpener is unavailable offline until the app is opened once online.", { status: 503, headers: { "content-type": "text/plain" } });
}


async function bibleJsonOnlineFastPath(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  // The page-level IndexedDB loader answers first when the chapter is already in the Bible DB.
  // If the page does reach the service worker, prefer exact local Bible cache keys before network.
  // This avoids the browser version pausing on chapters that are already saved locally.
  const exactLocal = await fastBibleMatchInCacheName(IRON_SHARPENER_CACHE, request) || await fastKnownBibleBackupMatch(request);
  if (exactLocal) {
    try { eventlessCopy(cache, request, exactLocal.clone()); } catch (_) {}
    return exactLocal;
  }

  if (looksOnline()) {
    try {
      // Use the browser HTTP cache when possible. If this chapter is not present yet,
      // the browser will fetch it once and the page will save it into IndexedDB.
      const response = await fetch(new Request(request.url, { cache: "force-cache" }));
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (response && response.ok && (!type || type.includes("json"))) {
        await putAllVariants(cache, request, response);
        return response;
      }
    } catch (_) {}

    // Final online fallback: normal fetch, then save.
    try {
      const response = await fetch(request);
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (response && response.ok && (!type || type.includes("json"))) {
        await putAllVariants(cache, request, response);
        return response;
      }
    } catch (_) {}
  }

  return new Response("Offline Bible chapter not found.", {
    status: 504,
    headers: { "content-type": "application/json" }
  });
}

async function resourceCacheFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  const cached = await tightResourceMatch(request);
  if (cached) {
    try { eventlessCopy(cache, request, cached.clone()); } catch (_) {}
    return cached;
  }

  // Offline: do not hang trying to fetch missing JSON. Return quickly so the app can show a real error.
  if (!looksOnline()) {
    return new Response("Offline resource not cached.", {
      status: 504,
      headers: { "content-type": isJsonRequest(request) ? "application/json" : "text/plain" }
    });
  }

  try {
    const response = await fetch(request);
    if (isJsonRequest(request)) {
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (!response || !response.ok || (type && !type.includes("json"))) {
        return new Response("JSON resource unavailable or invalid.", { status: response ? response.status : 503, headers: { "content-type": "application/json" } });
      }
    }
    if (response && response.ok) await putAllVariants(cache, request, response);
    return response;
  } catch (_) {
    const fallback = await tightResourceMatch(request);
    if (fallback) return fallback;
    return new Response("Offline resource not cached.", { status: 504, headers: { "content-type": isJsonRequest(request) ? "application/json" : "text/plain" } });
  }
}

function eventlessCopy(cache, request, response) {
  // Fire-and-forget copy into the current fast cache.
  putAllVariants(cache, request, response).catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!sameOriginGet(request)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(navigationFastCached(request, event));
    return;
  }

  if (isBibleJsonRequest(request)) {
    event.respondWith(bibleJsonOnlineFastPath(request));
    return;
  }

  event.respondWith(resourceCacheFirst(request));
});
