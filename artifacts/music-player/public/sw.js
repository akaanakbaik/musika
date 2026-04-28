const CACHE_VERSION = "musika-v5";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/manifest.json"
];

const NEVER_CACHE = [
  "/api/",
  "supabase.co",
  "api-junzz.web.id",
  "kelvdra.my.id",
  "nexray.web.id",
  "cuki.biz.id",
  "zenzxz.my.id"
];

function shouldSkipCache(url) {
  return NEVER_CACHE.some(pattern => url.includes(pattern));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== "GET") return;
  if (shouldSkipCache(url)) return;
  if (url.startsWith("chrome-extension:") || url.startsWith("data:")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
        return res;
      }).catch(async () => {
        const cached = await caches.match("/") || await caches.match("/index.html");
        return cached || new Response(
          "<!DOCTYPE html><html><head><title>Musika - Offline</title></head><body style='background:#121212;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;'><div><h1>Musika</h1><p>You are offline. Please check your connection.</p></div></body></html>",
          { headers: { "Content-Type": "text/html" } }
        );
      })
    );
    return;
  }

  if (url.includes("/manifest.webmanifest") || url.includes("/manifest.json")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  if (url.includes("/assets/") || url.endsWith(".woff2") || url.endsWith(".woff") || url.endsWith(".ttf")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            caches.open(STATIC_CACHE).then(cache => cache.put(request, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) caches.open(DYNAMIC_CACHE).then(c => c.put(request, res.clone()));
          return res;
        }).catch(() => cached || new Response("", { status: 408 }));
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CACHE_URLS") {
    const urls = event.data.urls || [];
    caches.open(DYNAMIC_CACHE).then(cache => cache.addAll(urls).catch(() => {}));
  }
});
