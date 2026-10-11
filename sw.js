/* Lighto offline shell */
const CACHE = "lighto-v18";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=18",
  "./app.js?v=18",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function putCache(req, res) {
  if (res && res.ok && req.url.startsWith(self.registration.scope)) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isNav =
    req.mode === "navigate" ||
    (url.origin === self.location.origin &&
      (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/sw.js")));

  if (isNav) {
    // Network-first for the page shell so new versions show up immediately
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => putCache(req, res))
        .catch(() =>
          caches.match(req)
            .then((c) => c || caches.match("./index.html"))
            .then((c) => c || caches.match("./"))
        )
    );
    return;
  }

  // Versioned assets (?v=N): cache-first, refresh in background
  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => putCache(req, res)).catch(() => cached);
      return cached || net;
    })
  );
});
