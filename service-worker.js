const CACHE_NAME = "iron-sharpener-offline-v5";

const CORE_ASSETS = [
  "/iron-sharpener-offline-pwa/",
  "/iron-sharpener-offline-pwa/index.html",
  "/iron-sharpener-offline-pwa/manifest.json",
  "/iron-sharpener-offline-pwa/service-worker.js",
  "/iron-sharpener-offline-pwa/assets/iron-sharpener-logo.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
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
          (await cache.match("./")) ||
          (await cache.match("./index.html"))
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
          event.request.url.includes("/iron-sharpener-offline-pwa/")
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
