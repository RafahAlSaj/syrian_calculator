const CACHE_NAME = "syrian-calculator-v27";

const ASSETS = [
    "./",
    "./index.html",
    "./assets/style.css",
    "./assets/app.js",
    "./manifest.webmanifest",
    "./assets/icons/icon.svg",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    // Network-First Strategy: try network first, fallback to cache
    event.respondWith(
        fetch(req)
            .then((res) => {
                const isHttp = req.url.startsWith("http://") || req.url.startsWith("https://");
                const sameOrigin = isHttp && new URL(req.url).origin === self.location.origin;
                const cacheable = sameOrigin && res && res.ok && res.type === "basic";
                if (cacheable) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                }
                return res;
            })
            .catch(() => {
                return caches.match(req).then((cached) => {
                    if (cached) return cached;
                    if (req.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                });
            })
    );
});
