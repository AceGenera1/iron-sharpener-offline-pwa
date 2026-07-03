/* Iron Sharpener service worker — v59 iPad Offline-Ready Launch Shield
   Purpose: keep the Home Screen app opening directly into the app surface even after Offline Ready has prepared the full cache.

   v58 changes:
   - Restores a tiny launch-shell warm during install, but never scans the full offline cache on launch.
   - Keeps the v57 separation between launch shell and complete Offline Ready cache.
   - Accepts both v57 and v58 launch-warm messages.

   v57 foundation:
   - Uses one tiny launch-shell cache for index.html, personal-study.html, manifest, and icons.
   - Navigation never scans the full Offline Ready cache before showing the app.
   - If the tiny shell is present, it is returned immediately and refreshed in the background.
   - Supports a page message to warm the launch shell after first paint.
   - Keeps Bible JSON and study-resource offline behavior intact.
*/

const IRON_SHARPENER_CACHE = "iron-sharpener-launch-v59-offline-ready-direct-shell-20260703";
const IRON_SHARPENER_CACHE_PREFIX = "iron-sharpener-offline-";
const IRON_SHARPENER_LAUNCH_CACHE_PREFIX = "iron-sharpener-launch-";

// Caches created by the working offline-preparation engines.
const KNOWN_RESOURCE_CACHES = [
  "iron-sharpener-launch-v59-offline-ready-direct-shell-20260703",
  "iron-sharpener-launch-v58-direct-app-shell-20260703",
  "iron-sharpener-launch-v57-shell-20260703",
  "iron-sharpener-offline-v56-tiny-shell-fast-offline-ready-launch-20260703",
  "iron-sharpener-offline-v54-instant-shell-online-direct-bible-json-20260702",
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
  // v59: do not let slow network or large offline caches hold the iPad native
  // launch screen. Copy an existing tiny shell quickly, then warm fresh shell.
  event.waitUntil(withTimeout((async () => {
    await copyExistingCoreShellIntoLaunchCache();
    await cacheFreshCoreShell();
  })(), 650, null));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      if (self.registration && self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
    } catch (_) {}
    await self.clients.claim();
    // Warm the launch shell after activation, but never block activation.
    cacheFreshCoreShell().catch(() => {});
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && (event.data.type === "WARM_LAUNCH_CACHE_V59" || event.data.type === "WARM_LAUNCH_CACHE_V58" || event.data.type === "WARM_LAUNCH_CACHE_V57")) {
    cacheFreshCoreShell().catch(() => {});
  }
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

async function copyExistingCoreShellIntoLaunchCache() {
  const current = await caches.open(IRON_SHARPENER_CACHE);
  const existing = await caches.keys();
  const preferred = [
    "iron-sharpener-launch-v58-direct-app-shell-20260703",
    "iron-sharpener-launch-v57-shell-20260703",
    "iron-sharpener-offline-v56-tiny-shell-fast-offline-ready-launch-20260703",
    "iron-sharpener-offline-v54-instant-shell-online-direct-bible-json-20260702",
    "iron-sharpener-offline-v36-complete-tool-20260630",
    "iron-sharpener-offline-v105-public-ready-cache",
    "iron-sharpener-offline-v34-final-offline-sync-20260627",
    "iron-sharpener-offline-v26-public-lock-20260626"
  ];
  const launchCaches = existing.filter((name) => name && name.startsWith(IRON_SHARPENER_LAUNCH_CACHE_PREFIX));
  const sources = [...preferred, ...launchCaches]
    .filter((name, index, arr) => name && name !== IRON_SHARPENER_CACHE && arr.indexOf(name) === index && existing.includes(name));
  const targets = ["./index.html", "index.html", "./", "./personal-study.html", "personal-study.html", "./manifest.json", "manifest.json", "./assets/iron-sharpener-logo.png", "assets/iron-sharpener-logo.png", "./assets/disciple-journal-logo.png", "assets/disciple-journal-logo.png"];
  for (const target of targets) {
    let saved = false;
    for (const sourceName of sources) {
      if (saved) break;
      try {
        const source = await caches.open(sourceName);
        for (const key of resourceKeyVariants(target)) {
          const cached = await source.match(key, { ignoreSearch: true });
          if (cached) {
            await putAllVariants(current, target, cached.clone());
            saved = true;
            break;
          }
        }
      } catch (_) {}
    }
  }
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

async function refreshNavigationInBackground(request, preloadResponsePromise) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  try {
    let response = preloadResponsePromise ? await preloadResponsePromise.catch(() => null) : null;
    if (!response || !response.ok) response = await fetch(new Request(request, { cache: "reload" }));
    if (response && response.ok) await cacheHtmlResponse(cache, response, request);
  } catch (_) {}
}

async function currentCacheHtmlForNavigationOnly(request) {
  // v58: first app paint must not wait on broad old-cache scans. Check launch shell cache only.
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  for (const key of htmlCacheKeysForRequest(request)) {
    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) return cached;
  }
  return null;
}

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    Promise.resolve(promise).then((value) => {
      if (!done) { done = true; clearTimeout(timer); resolve(value); }
    }).catch(() => {
      if (!done) { done = true; clearTimeout(timer); resolve(fallback); }
    });
  });
}

async function exactKnownShellFallback(request) {
  // v58: exact fallback only, bounded. Large Offline Ready caches must never
  // hold the native splash screen hostage.
  const wantsJournal = (() => {
    try { return new URL(request.url).pathname.endsWith("/personal-study.html"); } catch (_) { return false; }
  })();
  const exactKeys = wantsJournal
    ? ["./personal-study.html", "personal-study.html"]
    : ["./index.html", "index.html", "./", "/"];
  const existing = await caches.keys();
  const launchCaches = existing.filter((name) => name === IRON_SHARPENER_CACHE || name.startsWith(IRON_SHARPENER_LAUNCH_CACHE_PREFIX));
  const shellCaches = [IRON_SHARPENER_CACHE, ...launchCaches, ...KNOWN_RESOURCE_CACHES]
    .filter((name, index, arr) => name && arr.indexOf(name) === index && existing.includes(name));
  for (const name of shellCaches) {
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

async function navigationFastCached(request, event) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  const preloadPromise = event && event.preloadResponse ? event.preloadResponse : null;

  // v59 fastest path: show the tiny launch shell immediately.
  const cached = await currentCacheHtmlForNavigationOnly(request);
  if (cached) {
    try {
      if (event && event.waitUntil && looksOnline()) event.waitUntil(refreshNavigationInBackground(request, preloadPromise));
    } catch (_) {}
    return cached;
  }

  // v59 key change: after Offline Ready, network/navigation preload can be slow
  // inside iPad Home Screen apps. Use an exact cached shell before touching network.
  const exactShell = await withTimeout(exactKnownShellFallback(request), 220, null);
  if (exactShell) {
    try {
      if (event && event.waitUntil && looksOnline()) event.waitUntil(refreshNavigationInBackground(request, preloadPromise));
    } catch (_) {}
    return exactShell;
  }

  // Navigation preload/network are only used when no usable shell is already saved.
  if (looksOnline() && preloadPromise) {
    try {
      const preload = await withTimeout(preloadPromise, 650, null);
      if (preload && preload.ok) {
        try { event.waitUntil(cacheHtmlResponse(cache, preload.clone(), request)); } catch (_) {}
        return preload;
      }
    } catch (_) {}
  }

  if (looksOnline()) {
    try {
      const response = await withTimeout(fetch(new Request(request, { cache: "reload" })), 900, null);
      if (response && response.ok) {
        try { event && event.waitUntil && event.waitUntil(cacheHtmlResponse(cache, response.clone(), request)); } catch (_) {}
        return response;
      }
    } catch (_) {}
  }

  let wantsJournal = false;
  try { wantsJournal = new URL(request.url).pathname.endsWith("/personal-study.html"); } catch (_) {}
  if (wantsJournal) {
    return (await cache.match("./personal-study.html")) ||
      (await cache.match("personal-study.html")) ||
      new Response("Iron Sharpener Journal is unavailable offline until the app is opened once online after this update.", { status: 503, headers: { "content-type": "text/plain" } });
  }
  return (await cache.match("./index.html")) ||
    (await cache.match("index.html")) ||
    (await cache.match("./")) ||
    new Response("Iron Sharpener is unavailable offline until the app is opened once online after this update.", { status: 503, headers: { "content-type": "text/plain" } });
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
        return response;
      }
    } catch (_) {}

    try {
      const response = await fetch(request);
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (response && response.ok && (!type || type.includes("json"))) {
        return response;
      }
    } catch (_) {}
  }

  // Offline fallback: exact local Bible keys only, no broad cache scan.
  const exactLocal = await fastBibleMatchInCacheName(IRON_SHARPENER_CACHE, request) || await fastKnownBibleBackupMatch(request);
  if (exactLocal) return exactLocal;

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

  // v59: after Offline Ready, saved launch assets are safer than waiting on network.
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

  if (looksOnline()) {
    try {
      const response = await withTimeout(fetch(new Request(request.url, { cache: "force-cache" })), 650, null);
      if (response && response.ok) return response;
    } catch (_) {}
    try {
      const response = await withTimeout(fetch(request), 650, null);
      if (response && response.ok) return response;
    } catch (_) {}
  }

  return new Response("Launch asset unavailable.", { status: 504, headers: { "content-type": "text/plain" } });
}


async function resourceCacheFirst(request) {
  // v58: keep the launch shell cache tiny. During Offline Ready preparation,
  // this function may see thousands of resource fetches. Do not mirror those
  // files into the service worker's current launch cache.

  if (looksOnline()) {
    try {
      const response = await fetch(request);
      if (isJsonRequest(request)) {
        const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
        if (response && response.ok && (!type || type.includes("json"))) return response;
      } else if (response && response.ok) {
        return response;
      }
    } catch (_) {}
  }

  // Offline, or online network failed: use the complete offline/resource caches.
  const cached = await tightResourceMatch(request);
  if (cached) return cached;

  if (!looksOnline()) {
    return new Response("Offline resource not cached.", {
      status: 504,
      headers: { "content-type": isJsonRequest(request) ? "application/json" : "text/plain" }
    });
  }

  return new Response("Resource unavailable.", {
    status: 503,
    headers: { "content-type": isJsonRequest(request) ? "application/json" : "text/plain" }
  });
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

  if (isLaunchAssetRequest(request)) {
    event.respondWith(launchAssetFastPath(request));
    return;
  }

  event.respondWith(resourceCacheFirst(request));
});
