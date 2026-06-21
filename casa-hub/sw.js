// Service worker — cache della "shell" per apertura veloce e offline.
// I dati (file caricati) restano online su Supabase.
const CACHE = "casa-hub-v2";
const SHELL = [
  "./",
  "./index.html",
  "./share.html",
  "./styles.css",
  "./app.js",
  "./supabase.js",
  "./config.js",
  "./manifest.webmanifest",
  "./assets/icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Non intercettare le chiamate a Supabase / CDN: vanno sempre in rete.
  if (url.origin !== self.location.origin) return;
  // Network-first: prende sempre l'ultima versione, cache come fallback offline.
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
