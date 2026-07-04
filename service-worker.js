/* Iron Sharpener service worker — v65 Reference-Range Navigation Shell Refresh
   Launch architecture:
   - Cache Storage contains only the tiny app launch shell and icons.
   - The large offline study-resource library remains in IndexedDB, not Cache Storage.
   - Bible chapters remain in the dedicated Bible IndexedDB.
   - Navigation opens one tiny cache and one exact key; it never opens either IndexedDB.
   - Legacy iron-sharpener-offline-* caches remain excluded from the launch path.
*/

const SW_VERSION = "v65-reference-range-navigation";
const SHELL_TOKEN = "v65-reference-range-navigation";
const LAUNCH_CACHE = "iron-sharpener-launch-v65-reference-range-navigation-20260704";
const LAUNCH_CACHE_PREFIX = "iron-sharpener-launch-";
const RESOURCE_DB = "iron-sharpener-offline-resource-indexeddb-v1";
const RESOURCE_DB_VERSION = 1;
const RESOURCE_STORE = "resources";
const BIBLE_DB = "iron-sharpener-bible-indexeddb-v1";
const BIBLE_DB_VERSION = 1;
const BIBLE_STORE = "chapters";
const CORE_ASSETS = [
  "index.html", "personal-study.html", "manifest.json",
  "assets/iron-sharpener-logo.png", "assets/disciple-journal-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await seedFreshLaunchCache();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(LAUNCH_CACHE);
    const maker = await cache.match(canonicalUrl("index.html"), { ignoreSearch: true });
    const journal = await cache.match(canonicalUrl("personal-study.html"), { ignoreSearch: true });
    if (!validResponse("index.html", maker) || !validResponse("personal-study.html", journal)) throw new Error("Fresh v65 app shells were not verified.");

    // Preserve the v63 launch architecture: remove old launch/offline caches so
    // iPad launch never opens beside thousands of Cache Storage entries.
    try {
      const names = await caches.keys();
      for (const name of names) {
        if ((name.startsWith(LAUNCH_CACHE_PREFIX) && name !== LAUNCH_CACHE) || /^iron-sharpener-offline-/i.test(name)) {
          try { await caches.delete(name); } catch (_) {}
        }
      }
    } catch (_) {}

    await self.clients.claim();
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clients.map(async (client) => {
        try {
          const url = new URL(client.url);
          if (url.origin !== self.location.origin || url.searchParams.get("rdm_shell_cutover") === SHELL_TOKEN) return;
          url.searchParams.set("rdm_shell_cutover", SHELL_TOKEN);
          await client.navigate(url.href);
        } catch (_) {}
      }));
    } catch (_) {}
  })());
});

self.addEventListener("message", (event) => {
  const data = event && event.data;
  if (data && data.type === "SKIP_WAITING") self.skipWaiting();
  if (data && data.type === "GET_IRON_SW_VERSION" && event.ports && event.ports[0]) {
    try { event.ports[0].postMessage({ version: SW_VERSION, launchCache: LAUNCH_CACHE, resourceDb: RESOURCE_DB }); } catch (_) {}
  }
  if (data && /^WARM_LAUNCH_CACHE_/.test(String(data.type || ""))) seedFreshLaunchCache().catch(() => {});
});

function scopePath(){
  try { return new URL(self.registration.scope).pathname.replace(/^\/+|\/+$/g, ""); } catch (_) { return ""; }
}
function canonicalPath(value){
  let raw = "";
  try { raw = typeof value === "string" ? new URL(value, self.registration.scope).pathname : new URL(value.url).pathname; }
  catch (_) { raw = String(value || ""); }
  try { raw = decodeURIComponent(raw); } catch (_) {}
  raw = raw.replace(/^\/+/, "").replace(/^\.\//, "").replace(/^(?:\.\.\/)+/, "").replace(/\/+/g, "/");
  const scope = scopePath();
  if (scope && raw.startsWith(scope + "/")) raw = raw.slice(scope.length + 1);
  return raw;
}
function canonicalUrl(value){ return new URL(canonicalPath(value) || "index.html", self.registration.scope).href; }
function sameOriginGet(request){
  if (!request || request.method !== "GET") return false;
  try { return new URL(request.url).origin === self.location.origin; } catch (_) { return false; }
}
function isNavigation(request){
  if (request.mode === "navigate") return true;
  try { const p = new URL(request.url).pathname; return p.endsWith("/") || p.endsWith(".html"); } catch (_) { return false; }
}
function isBible(request){
  try { return /^bible\/web\/.+\/\d{2,3}\.json$/i.test(canonicalPath(request)); } catch (_) { return false; }
}
function isLaunchAsset(request){
  const path = canonicalPath(request);
  return path === "manifest.json" || path === "manifest-maker.json" || path === "manifest-journal.json" ||
    /^assets\/(iron-sharpener-logo|disciple-journal-logo)(?:-\d+)?\.(png|jpg|jpeg|webp|svg)$/i.test(path);
}
function validResponse(path, response){
  if (!response || !response.ok || response.type === "opaque") return false;
  const type = response.headers ? (response.headers.get("content-type") || "") : "";
  if (/\.json$/i.test(path) && type && !/json/i.test(type)) return false;
  if (/\.html$/i.test(path) && type && !/html/i.test(type)) return false;
  return true;
}
function navigationTarget(request){ return canonicalPath(request).endsWith("personal-study.html") ? "personal-study.html" : "index.html"; }
function freshUrl(path){ const url = new URL(canonicalUrl(path)); url.searchParams.set("rdm_shell", SHELL_TOKEN); return url.href; }
async function putLaunch(cache, path, response){
  if (!validResponse(path, response)) return false;
  await cache.put(canonicalUrl(path), response.clone());
  return true;
}
async function seedFreshLaunchCache(){
  const stagingName = LAUNCH_CACHE + "-staging";
  try { await caches.delete(stagingName); } catch (_) {}
  const staging = await caches.open(stagingName);
  for (const path of CORE_ASSETS) {
    try {
      const response = await fetch(new Request(freshUrl(path), { cache: "no-store" }));
      if (!validResponse(path, response)) throw new Error("Invalid launch asset: " + path);
      await putLaunch(staging, path, response);
    } catch (error) {
      if (path === "index.html" || path === "personal-study.html") { try { await caches.delete(stagingName); } catch (_) {} throw error; }
    }
  }
  const maker = await staging.match(canonicalUrl("index.html"), { ignoreSearch: true });
  const journal = await staging.match(canonicalUrl("personal-study.html"), { ignoreSearch: true });
  if (!validResponse("index.html", maker) || !validResponse("personal-study.html", journal)) throw new Error("Both fresh app shells are required.");
  const active = await caches.open(LAUNCH_CACHE);
  for (const path of CORE_ASSETS) {
    const response = await staging.match(canonicalUrl(path), { ignoreSearch: true });
    if (response) await putLaunch(active, path, response);
  }
  try { await caches.delete(stagingName); } catch (_) {}
}
async function navigationImmediate(request, event){
  const target = navigationTarget(request);
  const cache = await caches.open(LAUNCH_CACHE);
  const cached = await cache.match(canonicalUrl(target), { ignoreSearch: true });
  if (cached) return cached;
  try {
    const preload = event && event.preloadResponse ? await event.preloadResponse : null;
    if (validResponse(target, preload)) { try { event.waitUntil(putLaunch(cache, target, preload)); } catch (_) {} return preload; }
  } catch (_) {}
  try {
    const response = await fetch(new Request(freshUrl(target), { cache: "no-store" }));
    if (validResponse(target, response)) { try { event && event.waitUntil && event.waitUntil(putLaunch(cache, target, response)); } catch (_) {} return response; }
  } catch (_) {}
  return new Response(target === "personal-study.html" ? "Iron Sharpener Journal is unavailable offline until opened once online." : "Iron Sharpener is unavailable offline until opened once online.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
}

let resourceDbPromise = null;
function openResourceDb(){
  if (resourceDbPromise) return resourceDbPromise;
  resourceDbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(RESOURCE_DB, RESOURCE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RESOURCE_STORE)) db.createObjectStore(RESOURCE_STORE, { keyPath: "key" });
        if (!db.objectStoreNames.contains("staging")) db.createObjectStore("staging", { keyPath: "key" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Resource database failed."));
    } catch (error) { reject(error); }
  });
  return resourceDbPromise;
}
async function getResource(path){
  try {
    const db = await openResourceDb();
    return await new Promise((resolve) => {
      try {
        const request = db.transaction(RESOURCE_STORE, "readonly").objectStore(RESOURCE_STORE).get(path);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  } catch (_) { return null; }
}
function responseFromResource(record){
  const headers = new Headers({ "content-type": record.contentType || "application/octet-stream", "x-iron-sharpener-source": "indexeddb-resource" });
  return new Response(record.body, { status: Number(record.status || 200), statusText: record.statusText || "OK", headers });
}

let bibleDbPromise = null;
function openBibleDb(){
  if (bibleDbPromise) return bibleDbPromise;
  bibleDbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(BIBLE_DB, BIBLE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BIBLE_STORE)) db.createObjectStore(BIBLE_STORE, { keyPath: "key" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Bible database failed."));
    } catch (error) { reject(error); }
  });
  return bibleDbPromise;
}
function bibleInfo(request){
  const match = canonicalPath(request).match(/^bible\/web\/(.+)\/(\d{2,3})\.json$/i);
  if (!match) return null;
  return { book: match[1], chapter: String(parseInt(match[2], 10) || 1), key: match[1] + ":" + String(parseInt(match[2], 10) || 1) };
}
async function getBible(info){
  if (!info) return null;
  try {
    const db = await openBibleDb();
    return await new Promise((resolve) => {
      try {
        const request = db.transaction(BIBLE_STORE, "readonly").objectStore(BIBLE_STORE).get(info.key);
        request.onsuccess = () => resolve(request.result && request.result.data ? request.result.data : null);
        request.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  } catch (_) { return null; }
}
async function bibleRequest(request){
  const local = await getBible(bibleInfo(request));
  if (local && local.verses) return new Response(JSON.stringify(local), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "x-iron-sharpener-source": "indexeddb-bible" } });
  try { const response = await fetch(request); if (validResponse(canonicalPath(request), response)) return response; } catch (_) {}
  return new Response("Offline Bible chapter not found.", { status: 504, headers: { "content-type": "application/json; charset=utf-8" } });
}
async function launchAssetRequest(request){
  const path = canonicalPath(request);
  const cache = await caches.open(LAUNCH_CACHE);
  const cached = await cache.match(canonicalUrl(path), { ignoreSearch: true });
  if (cached) return cached;
  try { const response = await fetch(request); if (response && response.ok) { putLaunch(cache, path, response).catch(() => {}); return response; } } catch (_) {}
  return new Response("Launch asset unavailable.", { status: 504, headers: { "content-type": "text/plain; charset=utf-8" } });
}
async function resourceRequest(request){
  const path = canonicalPath(request);
  const local = await getResource(path);
  if (local && local.body) return responseFromResource(local);
  try { const response = await fetch(request); if (validResponse(path, response)) return response; } catch (_) {}
  return new Response("Offline resource not stored.", { status: 504, headers: { "content-type": /\.json$/i.test(path) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!sameOriginGet(request)) return;
  if (isNavigation(request)) { event.respondWith(navigationImmediate(request, event)); return; }
  if (isBible(request)) { event.respondWith(bibleRequest(request)); return; }
  if (isLaunchAsset(request)) { event.respondWith(launchAssetRequest(request)); return; }
  event.respondWith(resourceRequest(request));
});
