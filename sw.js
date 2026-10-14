// Offline support: the app shell is cached so Abide opens even when the local
// server isn't running. Pages are served from cache and refreshed in the
// background (stale-while-revalidate), so updates show on the next open.
// Your notebook data is never touched here; it lives in IndexedDB.
const CACHE = "abide-v3";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "css/base.css", "css/components.css", "css/views.css",
  "js/app.js", "js/store.js", "js/model.js", "js/dates.js", "js/motion.js", "js/ui.js",
  "js/icons.js", "js/objectives.js", "js/scripture.js", "js/sync.js", "js/verses.js",
  "js/config.js", "js/auth.js",
  "js/views/home.js", "js/views/day.js", "js/views/week.js", "js/views/month.js", "js/views/all.js",
  "js/views/journal.js", "js/views/prayer.js", "js/views/scripture.js", "js/views/progress.js",
  "js/views/settings.js", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // fonts and the pinned supabase-js module are cached so the app opens offline;
  // Supabase API calls (supabase.co) are never cached
  const cdn = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"].includes(url.hostname);
  if (!sameOrigin && !cdn) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const fresh = fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
