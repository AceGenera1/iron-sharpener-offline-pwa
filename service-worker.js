/* Iron Sharpener service worker — v35 Disciple Journal foundation
   Safe app-shell recovery: never serve old cached HTML, but keep old JSON/resource
   caches available so offline Scripture and study resources are preserved. */
const IRON_SHARPENER_CACHE = "iron-sharpener-offline-v35-disciple-journal-20260627";
const IRON_SHARPENER_CACHE_PREFIX = "iron-sharpener-offline-";
const CORE_ASSETS = ["./index.html", "./personal-study.html", "./manifest.json", "./assets/iron-sharpener-logo.png", "./assets/disciple-journal-logo.png", "./assets/disciple-journal-icon-192.png", "./assets/disciple-journal-icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheFreshCoreShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await removeOldHtmlShellEntries();
    await self.clients.claim();
    // v34: keep activation gentle; fresh HTML is cached on install and normal navigation.
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
    return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
  } catch (_) { return false; }
}

function isJsonRequest(request) {
  try { return new URL(request.url).pathname.endsWith(".json"); }
  catch (_) { return false; }
}

function isHtmlRequestKey(key) {
  try {
    const url = typeof key === "string" ? new URL(key, self.location.href) : new URL(key.url);
    return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html") || url.pathname.endsWith(".html");
  } catch (_) {
    const text = String(key || "");
    return text === "./" || text === "/" || text.endsWith("index.html") || text.endsWith(".html");
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

function htmlCacheKeysForRequest(request) {
  const keys = [];
  try {
    const url = typeof request === "string" ? new URL(request, self.location.href) : new URL(request.url);
    let path = url.pathname.replace(/^\//, "") || "index.html";
    if (path.endsWith("/")) path += "index.html";
    keys.push(path, `./${path}`);
    if (path === "index.html") keys.push("./", "/");
  } catch (_) {
    const text = String(request || "");
    if (text) keys.push(text, text.replace(/^\.\//, ""), `./${text.replace(/^\.\//, "")}`);
  }
  return [...new Set(keys.filter(Boolean))];
}

async function cacheHtmlResponse(cache, response, request) {
  if (!response || !response.ok) return false;
  const type = response.headers.get("content-type") || "";
  if (type && !type.includes("html")) return false;
  for (const key of htmlCacheKeysForRequest(request)) {
    await putIfGood(cache, key, response);
  }
  return true;
}

async function cacheFreshCoreShell() {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  try {
    const html = await fetch(new Request("./index.html", { cache: "reload" }));
    if (html && html.ok) await cacheHtmlResponse(cache, html, "./index.html");
  } catch (_) {}
  for (const asset of CORE_ASSETS.filter((item) => !item.endsWith("index.html"))) {
    try {
      const response = await fetch(new Request(asset, { cache: "reload" }));
      if (response && response.ok) {
        if (asset.endsWith(".html")) await cacheHtmlResponse(cache, response, asset);
        else {
          await putIfGood(cache, asset, response);
          await putIfGood(cache, asset.replace(/^\.\//, ""), response);
        }
      }
    } catch (_) {}
  }
}

async function removeOldHtmlShellEntries() {
  const keys = await caches.keys();
  for (const name of keys) {
    if (!name.startsWith(IRON_SHARPENER_CACHE_PREFIX)) continue;
    try {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      await Promise.all(requests.filter(isHtmlRequestKey).map((request) => cache.delete(request)));
      await cache.delete("./");
      await cache.delete("/");
      await cache.delete("./index.html");
      await cache.delete("index.html");
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
    const cached = await cache.match(key);
    if (cached) return cached;
  }
  return (await cache.match("./index.html")) || (await cache.match("index.html")) || new Response("Iron Sharpener is unavailable offline until the app shell is refreshed online.", { status: 503, headers: { "content-type": "text/plain" } });
}

function urlWithoutLeadingSlash(request) {
  try { return new URL(request.url).pathname.replace(/^\//, ""); }
  catch (_) { return request; }
}

async function matchAnyResourceCache(request) {
  const keys = await caches.keys();
  for (const name of keys) {
    try {
      const cache = await caches.open(name);
      const cached = await cache.match(request) || await cache.match(urlWithoutLeadingSlash(request));
      if (cached) return cached;
    } catch (_) {}
  }
  return null;
}

async function resourceCacheFirst(request) {
  const cache = await caches.open(IRON_SHARPENER_CACHE);
  const cached = await cache.match(request) || await cache.match(urlWithoutLeadingSlash(request)) || await matchAnyResourceCache(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isJsonRequest(request)) {
      const type = response && response.headers ? (response.headers.get("content-type") || "") : "";
      if (!response || !response.ok || (type && !type.includes("json"))) {
        return new Response("JSON resource unavailable or invalid.", { status: response ? response.status : 503 });
      }
    }
    if (response && response.ok) await putIfGood(cache, request, response);
    return response;
  } catch (_) {
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
