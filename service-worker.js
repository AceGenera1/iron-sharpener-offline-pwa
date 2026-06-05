const CACHE_NAME = "iron-sharpener-offline-v3";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/iron-sharpener-logo.png"
];

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const copy = response.clone();

        if (
          event.request.method === "GET" &&
          response.ok &&
          event.request.url.includes("/iron-sharpener-offline-pwa/")
        ) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }

        return response;
      });
    })
  );
});
