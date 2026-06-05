const CACHE_NAME = "iron-sharpener-offline-v6";

const CORE_ASSETS = [
  "/iron-sharpener-offline-pwa/",
  "/iron-sharpener-offline-pwa/index.html",
  "/iron-sharpener-offline-pwa/manifest.json",
  "/iron-sharpener-offline-pwa/assets/iron-sharpener-logo.png",
  "/iron-sharpener-offline-pwa/bible/web/files.json"
];

const BASE_PATH = "/iron-sharpener-offline-pwa/";

async function cacheCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
}

async function cacheBibleFiles() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(BASE_PATH + "bible/web/files.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Could not load bible/web/files.json");
  }

  const files = await response.json();

  for (const file of files) {
    const url = BASE_PATH + file;

    try {
      const cached = await cache.match(url);
      if (!cached) {
        await cache.add(url);
      }
    } catch (error) {
      console.warn("Could not cache:", url, error);
    }
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      await cacheCoreAssets();
      await cacheBibleFiles();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match(BASE_PATH)) ||
          (await cache.match(BASE_PATH + "index.html"))
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (
          event.request.method === "GET" &&
          response.ok &&
          event.request.url.includes(BASE_PATH)
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }

        return response;
      });
    })
  );
});
