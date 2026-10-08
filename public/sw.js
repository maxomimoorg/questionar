// QuestionAR service worker: offline shell + runtime caching of stable static assets.
const CACHE = "questionar-v4";
const PRECACHE = ["/", "/rubrica", "/manifest.json", "/favicon.png", "/__l5e/assets-v1/b313fdb2-5b49-4086-bb24-272e2f621274/questionar-logo.png", "/__l5e/assets-v1/734ab10b-6c78-47b4-9649-13c65407974b/icon-192.png", "/__l5e/assets-v1/67c17213-2005-4353-9282-8331cfa7a700/icon-512.png", "/__l5e/assets-v1/e47c1219-f272-4798-9573-6a5269d256a5/apple-touch-icon.png"];

const isDevAsset = (url) =>
  url.pathname.startsWith("/src/") ||
  url.pathname.startsWith("/@") ||
  url.pathname.startsWith("/node_modules/") ||
  url.search.includes("tsr-split") ||
  url.search.includes("t=");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isDevAsset(url)) {
    event.respondWith(fetch(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
