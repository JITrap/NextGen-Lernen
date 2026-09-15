/* =========================================================
   NextGen Lernen – Dateiablage
   Hochgeladene Bilder/PDFs liegen in IndexedDB (lokal) oder,
   wenn die Seite als Claude-Artifact läuft, im Artifact-Speicher.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});
  var U = NG.util;

  var DB_NAME = "nextgen-lernen";
  var DB_VERSION = 1;
  var STORE = "blobs";

  var dbPromise = null;
  var memory = new Map();       // Rückfallebene, wenn IndexedDB blockiert ist
  var idbWorks = null;          // null = noch unbekannt
  var assets = null;            // Artifact-Assets, falls verfügbar
  var urlCache = new Map();

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var req;
      try {
        req = global.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        idbWorks = false;
        return resolve(null);
      }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      };
      req.onsuccess = function () { idbWorks = true; resolve(req.result); };
      req.onerror = function () { idbWorks = false; resolve(null); };
      req.onblocked = function () { idbWorks = false; resolve(null); };
      setTimeout(function () { if (idbWorks === null) { idbWorks = false; resolve(null); } }, 3000);
    });
    return dbPromise;
  }

  function tx(mode) {
    return openDB().then(function (db) {
      if (!db) return null;
      try { return db.transaction(STORE, mode).objectStore(STORE); }
      catch (e) { return null; }
    });
  }

  function idbPut(key, blob, meta) {
    return tx("readwrite").then(function (store) {
      if (!store) { memory.set(key, blob); return key; }
      return new Promise(function (resolve) {
        var req = store.put({ key: key, blob: blob, meta: meta || {}, savedAt: Date.now() });
        req.onsuccess = function () { resolve(key); };
        req.onerror = function () { memory.set(key, blob); resolve(key); };
      });
    });
  }

  function idbGet(key) {
    if (memory.has(key)) return Promise.resolve(memory.get(key));
    return tx("readonly").then(function (store) {
      if (!store) return null;
      return new Promise(function (resolve) {
        var req = store.get(key);
        req.onsuccess = function () { resolve(req.result ? req.result.blob : null); };
        req.onerror = function () { resolve(null); };
      });
    });
  }

  function idbDel(key) {
    memory.delete(key);
    return tx("readwrite").then(function (store) {
      if (!store) return;
      return new Promise(function (resolve) {
        var req = store.delete(key);
        req.onsuccess = req.onerror = function () { resolve(); };
      });
    });
  }

  function idbKeys() {
    return tx("readonly").then(function (store) {
      if (!store) return Array.from(memory.keys());
      return new Promise(function (resolve) {
        var req = store.getAllKeys();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    });
  }

  /* ---------- Öffentliche Schnittstelle -------------------- */

  /** Artifact-Assets anbinden, falls die Seite in Claude läuft. */
  function init() {
    if (!global.claude || typeof global.claude.use !== "function") return Promise.resolve(false);
    return global.claude.use("assets").then(function (ns) {
      assets = ns || null;
      return !!assets;
    }).catch(function () { return false; });
  }

  /**
   * Datei ablegen.
   * @returns {Promise<{kind:string,key:string,url?:string,name:string,type:string,size:number}>}
   */
  function put(blob, meta) {
    meta = meta || {};
    var descriptor = {
      name: meta.name || blob.name || "Datei",
      type: blob.type || meta.type || "application/octet-stream",
      size: blob.size || 0
    };
    if (assets) {
      return assets.upload(blob).then(function (res) {
        return Object.assign(descriptor, { kind: "asset", key: res.id, url: res.url });
      }).catch(function () {
        return idbFallback(blob, descriptor);
      });
    }
    return idbFallback(blob, descriptor);
  }

  function idbFallback(blob, descriptor) {
    var key = U.uid("blob");
    return idbPut(key, blob, descriptor).then(function () {
      return Object.assign(descriptor, { kind: "idb", key: key });
    });
  }

  /** Blob zu einer Referenz holen (für erneutes Senden an die KI). */
  function get(ref) {
    if (!ref || !ref.key) return Promise.resolve(null);
    if (ref.kind === "asset") {
      return fetch(ref.url || ("/_blob/" + ref.key))
        .then(function (r) { return r.ok ? r.blob() : null; })
        .catch(function () { return null; });
    }
    return idbGet(ref.key);
  }

  /** Anzeige-URL erzeugen (wird zwischengespeichert). */
  function url(ref) {
    if (!ref || !ref.key) return Promise.resolve(null);
    if (ref.kind === "asset") return Promise.resolve(ref.url || ("/_blob/" + ref.key));
    if (urlCache.has(ref.key)) return Promise.resolve(urlCache.get(ref.key));
    return idbGet(ref.key).then(function (blob) {
      if (!blob) return null;
      var u = URL.createObjectURL(blob);
      urlCache.set(ref.key, u);
      return u;
    });
  }

  function del(ref) {
    if (!ref || !ref.key) return Promise.resolve();
    if (urlCache.has(ref.key)) { URL.revokeObjectURL(urlCache.get(ref.key)); urlCache.delete(ref.key); }
    if (ref.kind === "asset" && assets) {
      return assets.delete(ref.key).catch(function () { });
    }
    return idbDel(ref.key);
  }

  /** Verwaiste Blobs entfernen, auf die kein Material mehr zeigt. */
  function prune() {
    var used = {};
    NG.store.all("materials").forEach(function (m) {
      if (m.file && m.file.key) used[m.file.key] = true;
    });
    return idbKeys().then(function (keys) {
      var dead = keys.filter(function (k) { return !used[k]; });
      return Promise.all(dead.map(idbDel)).then(function () { return dead.length; });
    });
  }

  function storageKind() {
    if (assets) return "artifact";
    if (idbWorks === false) return "memory";
    return "indexeddb";
  }

  NG.files = {
    init: init, put: put, get: get, url: url, del: del, prune: prune,
    storageKind: storageKind,
    isPersistent: function () { return storageKind() !== "memory"; }
  };
})(window);
