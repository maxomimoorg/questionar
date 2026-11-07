// QuestionAR service worker: offline shell + fast repeat launches.
// - Pages: network first, but after NAV_TIMEOUT_MS the saved copy is shown; the network answer
//   still refreshes the cache in the background. Pages are never served stale while online and
//   fast, so they always point to scripts that exist on the server.
// - Hashed build files (/assets/…): cache first; their name changes whenever their content does.
// - Other local static files (icons, manifest, logo): stale-while-revalidate.
const CACHE = "questionar-v7";
const NAV_TIMEOUT_MS = 2500;
const PRECACHE = [
  "/",
  "/rubrica",
  "/manifest.json",
  "/favicon.png",
  "/logo.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png"
];

const isDevAsset = (url) =>
  url.pathname.startsWith("/src/") ||
  url.pathname.startsWith("/@") ||
  url.pathname.startsWith("/node_modules/") ||
  url.search.includes("tsr-split") ||
  url.search.includes("t=");

const isHashedAsset = (url) => url.pathname.startsWith("/assets/");

const putInCache = (req, res) => {
  if (!res || !res.ok || res.type === "opaque") return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
};

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
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("questionar-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function networkFirstWithTimeout(event) {
  const req = event.request;
  const network = fetch(req).then((res) => {
    putInCache(req, res);
    return res;
  });
  // Keep the worker alive until the background refresh has finished.
  event.waitUntil(network.catch(() => undefined));
  const cached = () => caches.match(req).then((hit) => hit || caches.match("/"));
  const timeout = new Promise((resolve) => {
    setTimeout(() => cached().then((hit) => hit && resolve(hit)), NAV_TIMEOUT_MS);
  });
  return Promise.race([network, timeout]).catch(() =>
    cached().then((hit) => hit || Response.error()),
  );
}

function cacheFirst(event) {
  const req = event.request;
  return caches.match(req).then(
    (hit) =>
      hit ||
      fetch(req).then((res) => {
        putInCache(req, res);
        return res;
      }),
  );
}

function staleWhileRevalidate(event) {
  const req = event.request;
  const network = fetch(req).then((res) => {
    putInCache(req, res);
    return res;
  });
  event.waitUntil(network.catch(() => undefined));
  return caches.match(req).then((hit) => hit || network);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/~oauth")) return;

  if (isDevAsset(url)) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirstWithTimeout(event));
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(cacheFirst(event));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});
