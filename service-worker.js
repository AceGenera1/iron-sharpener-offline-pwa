/* Iron Sharpener service worker — v71 Fresh Desktop Shell + Offline Safe Launch
   Purpose: keep IndexedDB as the primary Bible database, keep fast page switching, and make Home Screen/iPad launches avoid slow splash-screen waits from broad launch-asset cache scans.

   v55 changes:
   - Install activates immediately without waiting on network pre-cache downloads.
   - Navigation uses current shell cache first, then exact old-shell fallback, then network.
   - Manifest/icons/logos use a fast launch-asset path instead of scanning old complete/offline caches.
   - Bible JSON remains online-direct + IndexedDB/cache friendly.
   - Study/resource JSON keeps the cache-first behavior needed for offline use.

   Notes:
   - Does not change app data or Journal entries.
   - Keeps current HTML shells fast.
   - Does not scan every old cache for every verse file.
*/

const IRON_SHARPENER_CACHE = "iron-sharpener-offline-v71-fresh-desktop-shell-20260704";
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
  // v55: Do not hold iPad/Home Screen launch behind network pre-cache work.
  // Open the cache quickly, activate, then refresh the shell in the background.
  event.waitUntil(caches.open(IRON_SHARPENER_CACHE).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    try { await cacheFreshCoreShell(); } catch (_) {}
    try {
      const current = await caches.open(IRON_SHARPENER_CACHE);
      const hasFreshTeaching = await current.match("./index.html") || await current.match("index.html") || await current.match("./");
      if (hasFreshTeaching) await removeOldHtmlShellEntriesOnly();
    } catch (_) {}
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

function isLaunchAssetRequest(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, "");
    return path === "manifest.json" ||
      path === "manifest-maker.json" ||
      path === "manifest-journal.json" ||
      /^assets\/(iron-sharpener-logo|disciple-journal-logo)\.(png|jpg|jpeg|webp|svg)$/i.test(path);
  } catch (_) { return false; }
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

async function currentCacheHtmlForNavigationOnly(request) {
  // v55: first app paint must not wait on broad old-cache scans. Check current shell cache only.
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  for (const key of htmlCacheKeysForRequest(request)) {
    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) return cached;
  }
  return null;
}

async function exactKnownShellFallback(request) {
  // v55: small exact fallback only. This preserves fast launch after a SW update
  // when the new current cache has not refreshed yet. No broad cache scans.
  const wantsJournal = (() => {
    try { return new URL(request.url).pathname.endsWith("/personal-study.html"); } catch (_) { return false; }
  })();
  const exactKeys = wantsJournal
    ? ["./personal-study.html", "personal-study.html"]
    : ["./index.html", "index.html", "./", "/"];
  const existing = await caches.keys();
  const ordered = [IRON_SHARPENER_CACHE, ...KNOWN_RESOURCE_CACHES]
    .filter((name, index, arr) => name && arr.indexOf(name) === index && existing.includes(name));
  for (const name of ordered) {
    try {
      const cache = await caches.open(name);
      for (const key of exactKeys) {
        const cached = await cache.match(key, { ignoreSearch: true });
        if (cached) return cached;
      }
    } catch (_) {}
  }
  return null;
}

async function navigationFreshOnline(request, event) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  if (looksOnline()) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
    try {
      const freshRequest = new Request(request, {
        cache: "reload",
        signal: controller ? controller.signal : undefined
      });
      const response = await fetch(freshRequest);
      if (response && response.ok) {
        if (timer) clearTimeout(timer);
        await cacheHtmlResponse(cache, response, request);
        return response;
      }
    } catch (_) {
      // Fall through to the proven offline shell.
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const cached = await currentCacheHtmlForNavigationOnly(request);
  if (cached) return cached;

  const exactShell = await exactKnownShellFallback(request);
  if (exactShell) return exactShell;

  let wantsJournal = false;
  try { wantsJournal = new URL(request.url).pathname.endsWith("/personal-study.html"); } catch (_) {}
  if (wantsJournal) {
    return (await cache.match("./personal-study.html")) ||
      (await cache.match("personal-study.html")) ||
      new Response("Iron Sharpener Journal is unavailable offline until the app is opened once online.", { status: 503, headers: { "content-type": "text/plain" } });
  }
  return (await cache.match("./index.html")) ||
    (await cache.match("index.html")) ||
    (await cache.match("./")) ||
    new Response("Iron Sharpener is unavailable offline until the app is opened once online.", { status: 503, headers: { "content-type": "text/plain" } });
}

async function navigationFastCached(request, event) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  const cached = await currentCacheHtmlForNavigationOnly(request);
  if (cached) {
    try {
      if (event && event.waitUntil && looksOnline()) event.waitUntil(refreshNavigationInBackground(request));
    } catch (_) {}
    return cached;
  }

  const exactShell = await exactKnownShellFallback(request);
  if (exactShell) {
    try {
      if (event && event.waitUntil && looksOnline()) event.waitUntil(refreshNavigationInBackground(request));
    } catch (_) {}
    return exactShell;
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

  // Last resort only: exact known shell names, no broad cache scan during launch.
  let wantsJournal = false;
  try { wantsJournal = new URL(request.url).pathname.endsWith("/personal-study.html"); } catch (_) {}
  if (wantsJournal) {
    return (await cache.match("./personal-study.html")) ||
      (await cache.match("personal-study.html")) ||
      new Response("Iron Sharpener Journal is unavailable offline until the app is opened once online.", { status: 503, headers: { "content-type": "text/plain" } });
  }
  return (await cache.match("./index.html")) ||
    (await cache.match("index.html")) ||
    (await cache.match("./")) ||
    new Response("Iron Sharpener is unavailable offline until the app is opened once online.", { status: 503, headers: { "content-type": "text/plain" } });
}


async function bibleJsonOnlineFastPath(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  if (looksOnline()) {
    // Online should behave like a normal website: ask the live/static file path first.
    // Do not scan offline caches before this, because that is what created the recent online pause.
    try {
      const response = await fetch(new Request(request.url, { cache: "force-cache" }));
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (response && response.ok && (!type || type.includes("json"))) {
        // Save in the background only. Do not hold Scripture rendering hostage to cache writes.
        eventlessCopy(cache, request, response.clone());
        return response;
      }
    } catch (_) {}

    try {
      const response = await fetch(request);
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (response && response.ok && (!type || type.includes("json"))) {
        eventlessCopy(cache, request, response.clone());
        return response;
      }
    } catch (_) {}
  }

  // Offline fallback: exact local Bible keys only, no broad cache scan.
  const exactLocal = await fastBibleMatchInCacheName(IRON_SHARPENER_CACHE, request) || await fastKnownBibleBackupMatch(request);
  if (exactLocal) {
    try { eventlessCopy(cache, request, exactLocal.clone()); } catch (_) {}
    return exactLocal;
  }

  return new Response("Offline Bible chapter not found.", {
    status: 504,
    headers: { "content-type": "application/json" }
  });
}

async function launchAssetFastPath(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);

  // Fast exact current-cache check first. Do not scan big offline caches for startup icons/manifests.
  for (const key of resourceKeyVariants(request)) {
    try {
      const cached = await cache.match(key, { ignoreSearch: true });
      if (cached) return cached;
    } catch (_) {}
  }

  if (looksOnline()) {
    try {
      const response = await fetch(new Request(request.url, { cache: "force-cache" }));
      if (response && response.ok) {
        eventlessCopy(cache, request, response.clone());
        return response;
      }
    } catch (_) {}
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        eventlessCopy(cache, request, response.clone());
        return response;
      }
    } catch (_) {}
  }

  // Offline fallback: exact known launch-asset caches only. Still no broad scan.
  const existing = await caches.keys();
  const ordered = [IRON_SHARPENER_CACHE, ...KNOWN_RESOURCE_CACHES]
    .filter((name, index, arr) => name && arr.indexOf(name) === index && existing.includes(name));
  for (const name of ordered) {
    try {
      const namedCache = await caches.open(name);
      for (const key of resourceKeyVariants(request)) {
        const cached = await namedCache.match(key, { ignoreSearch: true });
        if (cached) return cached;
      }
    } catch (_) {}
  }

  return new Response("Launch asset unavailable.", { status: 504, headers: { "content-type": "text/plain" } });
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
    event.respondWith(navigationFreshOnline(request, event));
    return;
  }

  if (isBibleJsonRequest(request)) {
    event.respondWith(bibleJsonOnlineFastPath(request));
    return;
  }

  if (isLaunchAssetRequest(request)) {
    event.respondWith(launchAssetFastPath(request));
    return;
  }

  event.respondWith(resourceCacheFirst(request));
});
