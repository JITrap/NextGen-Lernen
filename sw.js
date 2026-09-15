/* =========================================================
   NextGen Lernen – Service Worker
   Strategie: erst Netz, dann Zwischenspeicher.
   So ist immer die neueste Fassung da – und offline trotzdem alles nutzbar.
   ========================================================= */
var CACHE = "nextgen-lernen-v1";

var SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/tokens.css", "./css/base.css", "./css/components.css",
  "./js/core/util.js", "./js/core/store.js", "./js/core/grades.js",
  "./js/core/files.js", "./js/core/ai.js", "./js/core/ui.js", "./js/core/sync.js",
  "./js/app.js",
  "./js/views/dashboard.js", "./js/views/calendar.js", "./js/views/tasks.js",
  "./js/views/timetable.js", "./js/views/subjects.js", "./js/views/grades.js",
  "./js/views/assistant.js", "./js/views/materials.js", "./js/views/flashcards.js",
  "./js/views/focus.js", "./js/views/settings.js", "./js/views/onboarding.js",
  "./assets/icon.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .catch(function () { /* einzelne fehlende Datei soll nichts blockieren */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // KI-Anfragen nie abfangen

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match("./index.html");
      });
    })
  );
});
