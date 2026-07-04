/* Iron Sharpener service worker — v62 Clean Navigation Shell + Compact Offline Storage
   Purpose:
   - Return the teaching or Journal shell from one tiny launch cache immediately.
   - Never inspect large Offline Ready caches during navigation startup.
   - Read non-Bible offline resources from one compact canonical cache.
   - Let the page-level IndexedDB Bible loader own all 1,189 WEB chapters.
   - Never copy an older HTML shell into a new launch cache.
   - Preserve old resource-cache fallback only until compact migration succeeds.
*/

const SW_VERSION = "v62-clean-navigation-compact-storage";
const LAUNCH_CACHE = "iron-sharpener-launch-v62-clean-navigation-20260704";
const COMPACT_RESOURCE_CACHE = "iron-sharpener-offline-v61-compact-resources-20260703";
const LAUNCH_CACHE_PREFIX = "iron-sharpener-launch-";

const LEGACY_RESOURCE_CACHES = [
  "iron-sharpener-offline-v60-compact-resources-20260703",
  "iron-sharpener-offline-v56-tiny-shell-fast-offline-ready-launch-20260703",
  "iron-sharpener-offline-v54-instant-shell-online-direct-bible-json-20260702",
  "iron-sharpener-offline-v36-complete-tool-20260630",
  "iron-sharpener-offline-v105-public-ready-cache",
  "iron-sharpener-offline-v34-final-offline-sync-20260627",
  "iron-sharpener-offline-v26-public-lock-20260626"
];

const LEGACY_LAUNCH_CACHES = [
  "iron-sharpener-launch-v61-fresh-shell-cutover-20260703",
  "iron-sharpener-launch-v59-offline-ready-direct-shell-20260703",
  "iron-sharpener-launch-v58-direct-app-shell-20260703",
  "iron-sharpener-launch-v57-shell-20260703"
];

const SHELL_VERSION_TOKEN = "v62-clean-navigation";

const CORE_ASSETS = [
  "index.html",
  "personal-study.html",
  "manifest.json",
  "assets/iron-sharpener-logo.png",
  "assets/disciple-journal-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Never seed a new launch cache from an older cached HTML shell. The new
    // worker activates only after fresh network copies of both app pages exist.
    await seedFreshLaunchCache(true);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      if (self.registration && self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
    } catch (_) {}

    const cache = await caches.open(LAUNCH_CACHE);
    const maker = await cache.match(canonicalUrl("index.html"), { ignoreSearch: true });
    const journal = await cache.match(canonicalUrl("personal-study.html"), { ignoreSearch: true });
    if (!responseTypeIsValid("index.html", maker) || !responseTypeIsValid("personal-study.html", journal)) {
      throw new Error("Fresh v62 app shells were not verified.");
    }

    // Only after the fresh shells verify, remove obsolete tiny launch caches.
    try {
      const names = await caches.keys();
      await Promise.all(names
        .filter((name) => name.startsWith(LAUNCH_CACHE_PREFIX) && name !== LAUNCH_CACHE)
        .map((name) => caches.delete(name)));
    } catch (_) {}

    await self.clients.claim();

    // One-time cutover for any page that was opened under the previous worker.
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clients.map(async (client) => {
        try {
          const url = new URL(client.url);
          if (url.origin !== self.location.origin) return;
          if (url.searchParams.get("rdm_shell_cutover") === SHELL_VERSION_TOKEN) return;
          url.searchParams.set("rdm_shell_cutover", SHELL_VERSION_TOKEN);
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
    try { event.ports[0].postMessage({ version: SW_VERSION, launchCache: LAUNCH_CACHE, resourceCache: COMPACT_RESOURCE_CACHE }); } catch (_) {}
  }
  if (data && ["WARM_LAUNCH_CACHE_V62", "WARM_LAUNCH_CACHE_V61", "WARM_LAUNCH_CACHE_V60", "WARM_LAUNCH_CACHE_V59", "WARM_LAUNCH_CACHE_V58", "WARM_LAUNCH_CACHE_V57"].includes(data.type)) {
    seedFreshLaunchCache(false).catch(() => {});
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
    const path = new URL(request.url).pathname;
    return path.endsWith("/") || path.endsWith(".html");
  } catch (_) { return false; }
}

function isJsonRequest(request) {
  try { return new URL(request.url).pathname.endsWith(".json"); }
  catch (_) { return false; }
}

function isBibleJsonRequest(request) {
  try {
    const path = decodeURIComponent(new URL(request.url).pathname);
    return /\/bible\/web\/.+\/\d{2,3}\.json$/i.test(path);
  } catch (_) { return false; }
}

function isLaunchAssetRequest(request) {
  try {
    const path = canonicalPath(request.url);
    return path === "manifest.json" ||
      path === "manifest-maker.json" ||
      path === "manifest-journal.json" ||
      /^assets\/(iron-sharpener-logo|disciple-journal-logo)(?:-\d+)?\.(png|jpg|jpeg|webp|svg)$/i.test(path);
  } catch (_) { return false; }
}

function scopePath() {
  try { return new URL(self.registration.scope).pathname.replace(/^\/+|\/+$/g, ""); }
  catch (_) { return ""; }
}

function canonicalPath(value) {
  let raw = "";
  try {
    raw = typeof value === "string" ? new URL(value, self.registration.scope).pathname : new URL(value.url).pathname;
  } catch (_) {
    raw = String(value || "");
  }
  try { raw = decodeURIComponent(raw); } catch (_) {}
  raw = raw.replace(/^\/+/, "").replace(/^\.\//, "").replace(/^(?:\.\.\/)+/, "").replace(/\/+/g, "/");
  const scope = scopePath();
  if (scope && raw.startsWith(scope + "/")) raw = raw.slice(scope.length + 1);
  return raw;
}

function canonicalUrl(value) {
  const path = canonicalPath(value);
  return new URL(path || "index.html", self.registration.scope).href;
}

function legacyVariants(value) {
  const path = canonicalPath(value);
  const encoded = path.replace(/ /g, "%20");
  const items = [
    path,
    `./${path}`,
    `/${path}`,
    encoded,
    `./${encoded}`,
    `/${encoded}`
  ];
  if (!path || path === "index.html") items.push("./", "/", "index.html", "./index.html");
  return [...new Set(items.filter(Boolean))];
}

function navigationTarget(request) {
  try {
    const path = canonicalPath(request.url);
    return path.endsWith("personal-study.html") ? "personal-study.html" : "index.html";
  } catch (_) { return "index.html"; }
}

function responseTypeIsValid(path, response) {
  if (!response || !response.ok || response.type === "opaque") return false;
  const type = response.headers ? (response.headers.get("content-type") || "") : "";
  if (/\.json$/i.test(path) && type && !/json/i.test(type)) return false;
  if (/\.html$/i.test(path) && type && !/html/i.test(type)) return false;
  return true;
}

async function putCanonical(cache, path, response) {
  if (!responseTypeIsValid(path, response)) return false;
  try {
    await cache.put(canonicalUrl(path), response.clone());
    return true;
  } catch (_) { return false; }
}

function versionedShellUrl(path) {
  const url = new URL(canonicalUrl(path));
  url.searchParams.set("rdm_shell", SHELL_VERSION_TOKEN);
  return url.href;
}

async function fetchFreshShellAsset(path) {
  const response = await fetch(new Request(versionedShellUrl(path), { cache: "no-store" }));
  if (!responseTypeIsValid(path, response)) {
    throw new Error(`Fresh launch asset unavailable: ${path}`);
  }
  return response;
}

async function seedFreshLaunchCache(requireBothHtml) {
  const stagingName = `${LAUNCH_CACHE}-staging`;
  try { await caches.delete(stagingName); } catch (_) {}
  const staging = await caches.open(stagingName);
  const required = new Set(["index.html", "personal-study.html"]);

  for (const path of CORE_ASSETS) {
    try {
      const response = await fetchFreshShellAsset(path);
      if (!(await putCanonical(staging, path, response))) throw new Error(`Could not stage ${path}`);
    } catch (error) {
      if (requireBothHtml || required.has(path)) {
        try { await caches.delete(stagingName); } catch (_) {}
        throw error;
      }
    }
  }

  const stagedMaker = await staging.match(canonicalUrl("index.html"), { ignoreSearch: true });
  const stagedJournal = await staging.match(canonicalUrl("personal-study.html"), { ignoreSearch: true });
  if (!responseTypeIsValid("index.html", stagedMaker) || !responseTypeIsValid("personal-study.html", stagedJournal)) {
    try { await caches.delete(stagingName); } catch (_) {}
    throw new Error("Both fresh app shells are required before activation.");
  }

  const active = await caches.open(LAUNCH_CACHE);
  for (const path of CORE_ASSETS) {
    const staged = await staging.match(canonicalUrl(path), { ignoreSearch: true });
    if (staged) await putCanonical(active, path, staged);
  }
  try { await caches.delete(stagingName); } catch (_) {}
  return true;
}

async function refreshNavigationInBackground(request, preloadPromise) {
  const cache = await caches.open(LAUNCH_CACHE);
  const target = navigationTarget(request);
  try {
    let response = preloadPromise ? await preloadPromise.catch(() => null) : null;
    if (!responseTypeIsValid(target, response)) {
      response = await fetch(new Request(versionedShellUrl(target), { cache: "no-store" }));
    }
    if (responseTypeIsValid(target, response)) await putCanonical(cache, target, response);
  } catch (_) {}
}

async function navigationImmediate(request, event) {
  const cache = await caches.open(LAUNCH_CACHE);
  const target = navigationTarget(request);

  // Critical path: one cache, one exact canonical key. No caches.keys(), no
  // legacy resource cache, no variant scan, and no network wait before paint.
  const cached = await cache.match(canonicalUrl(target), { ignoreSearch: true });
  if (cached) {
    try {
      if (event && event.waitUntil) {
        event.waitUntil(refreshNavigationInBackground(request, event.preloadResponse || null));
      }
    } catch (_) {}
    return cached;
  }

  // First-ever install only: use navigation preload/network because no shell
  // exists yet. This path disappears once seedLaunchCache succeeds.
  try {
    const preload = event && event.preloadResponse ? await event.preloadResponse : null;
    if (responseTypeIsValid(target, preload)) {
      try { event.waitUntil(putCanonical(cache, target, preload)); } catch (_) {}
      return preload;
    }
  } catch (_) {}

  try {
    const response = await fetch(new Request(versionedShellUrl(target), { cache: "no-store" }));
    if (responseTypeIsValid(target, response)) {
      try { event && event.waitUntil && event.waitUntil(putCanonical(cache, target, response)); } catch (_) {}
      return response;
    }
  } catch (_) {}

  return new Response(
    target === "personal-study.html"
      ? "Iron Sharpener Journal is unavailable offline until it has been opened once online."
      : "Iron Sharpener is unavailable offline until it has been opened once online.",
    { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

async function compactResourceMatch(request) {
  try {
    const cache = await caches.open(COMPACT_RESOURCE_CACHE);
    return await cache.match(canonicalUrl(request), { ignoreSearch: true });
  } catch (_) { return null; }
}

async function legacyResourceMatch(request) {
  for (const cacheName of LEGACY_RESOURCE_CACHES) {
    try {
      if (!(await caches.has(cacheName))) continue;
      const cache = await caches.open(cacheName);
      for (const key of legacyVariants(request)) {
        const cached = await cache.match(key, { ignoreSearch: true });
        if (cached) return cached;
      }
    } catch (_) {}
  }
  return null;
}

async function bibleRequest(request) {
  // The page's IndexedDB fetch wrapper handles offline Bible chapters before a
  // request reaches this service worker. Online remains network-direct.
  try {
    const response = await fetch(request);
    if (responseTypeIsValid(canonicalPath(request), response)) return response;
  } catch (_) {}

  // Migration safety only. These caches are deleted after IndexedDB verification.
  const legacy = await legacyResourceMatch(request);
  if (legacy) return legacy;

  return new Response("Offline Bible chapter not found in IndexedDB.", {
    status: 504,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function launchAssetRequest(request) {
  const cache = await caches.open(LAUNCH_CACHE);
  const path = canonicalPath(request);
  const cached = await cache.match(canonicalUrl(path), { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      putCanonical(cache, path, response).catch(() => {});
      return response;
    }
  } catch (_) {}

  return new Response("Launch asset unavailable.", {
    status: 504,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

async function resourceRequest(request) {
  // Online behaves like the live website. Offline Ready writes resources into
  // COMPACT_RESOURCE_CACHE itself, so this handler never duplicates them.
  try {
    const response = await fetch(request);
    if (responseTypeIsValid(canonicalPath(request), response)) return response;
  } catch (_) {}

  const compact = await compactResourceMatch(request);
  if (compact) return compact;

  // Interrupted migration safety: old caches remain available until the compact
  // cache and IndexedDB Bible both pass verification.
  const legacy = await legacyResourceMatch(request);
  if (legacy) return legacy;

  return new Response("Offline resource not cached.", {
    status: 504,
    headers: { "content-type": isJsonRequest(request) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8" }
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!sameOriginGet(request)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(navigationImmediate(request, event));
    return;
  }
  if (isBibleJsonRequest(request)) {
    event.respondWith(bibleRequest(request));
    return;
  }
  if (isLaunchAssetRequest(request)) {
    event.respondWith(launchAssetRequest(request));
    return;
  }
  event.respondWith(resourceRequest(request));
});
