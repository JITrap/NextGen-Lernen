/* =========================================================
   NextGen Lernen – Optionale Cloud-Sicherung
   Läuft die Seite als Claude-Artifact, wird der Zustand
   zusätzlich serverseitig gesichert (geräteübergreifend).
   Ohne diese Umgebung passiert hier nichts.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});

  var DOC_PATH = "app/state";
  var MAX_BYTES = 230 * 1024;      // Dokumentgrenze liegt bei 256 KiB

  var db = null;
  var docRef = null;
  var pushTimer = null;
  var lastPushed = "";
  var statusValue = { active: false, state: "off", message: "Nur lokal gespeichert" };
  var listeners = [];

  function setStatus(state, message) {
    statusValue = { active: !!docRef, state: state, message: message };
    listeners.forEach(function (fn) { try { fn(statusValue); } catch (e) { } });
  }

  function onStatus(fn) { listeners.push(fn); fn(statusValue); }

  function init() {
    if (!global.claude || typeof global.claude.use !== "function") return Promise.resolve(false);
    if (!NG.store.getSetting("cloudSync", true)) {
      setStatus("off", "Cloud-Sicherung ist ausgeschaltet");
      return Promise.resolve(false);
    }
    setStatus("connecting", "Verbinde …");
    return global.claude.use("db").then(function (ns) {
      if (!ns) { setStatus("off", "Nur lokal gespeichert"); return false; }
      db = ns;
      try { docRef = db.doc(DOC_PATH); }
      catch (e) { setStatus("error", "Pfad ungültig"); return false; }
      return pull();
    }).catch(function () {
      setStatus("error", "Cloud-Sicherung nicht erreichbar");
      return false;
    });
  }

  /** Beim Start: die neuere der beiden Fassungen gewinnt. */
  function pull() {
    if (!docRef) return Promise.resolve(false);
    return docRef.get().then(function (snap) {
      if (!snap.exists) {
        setStatus("ok", "Gesichert (noch nichts in der Cloud)");
        push(NG.store.state, true);
        return true;
      }
      var remote = snap.data();
      var payload = remote && remote.json ? safeParse(remote.json) : null;
      var localAt = (NG.store.state.meta && NG.store.state.meta.updatedAt) || "";
      var remoteAt = (payload && payload.meta && payload.meta.updatedAt) || "";

      if (payload && remoteAt > localAt) {
        NG.store.replaceState(payload);
        setStatus("ok", "Aus der Cloud geladen");
        NG.ui && NG.ui.toast("Daten aus der Cloud-Sicherung geladen", "success");
      } else {
        setStatus("ok", "Aktuell gesichert");
        if (localAt > remoteAt) push(NG.store.state, true);
      }
      return true;
    }).catch(function (e) {
      setStatus("error", "Laden fehlgeschlagen: " + (e && e.code ? e.code : "unbekannt"));
      return false;
    });
  }

  function safeParse(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  /** Zustand sichern (gebündelt, nicht bei jedem Tastendruck). */
  function push(state, immediate) {
    if (!docRef) return;
    clearTimeout(pushTimer);
    var run = function () {
      var json;
      try { json = JSON.stringify(state); } catch (e) { return; }
      if (json === lastPushed) return;
      if (json.length > MAX_BYTES) {
        setStatus("warn", "Zu viele Daten für die Cloud-Sicherung – lokal bleibt alles erhalten");
        return;
      }
      setStatus("saving", "Sichere …");
      docRef.set({ json: json, updatedAt: new Date().toISOString() }).then(function () {
        lastPushed = json;
        setStatus("ok", "Gesichert");
      }).catch(function (e) {
        setStatus("error", "Sichern fehlgeschlagen" + (e && e.code ? " (" + e.code + ")" : ""));
      });
    };
    if (immediate) run();
    else pushTimer = setTimeout(run, 1600);
  }

  function disable() {
    clearTimeout(pushTimer);
    docRef = null;
    db = null;
    setStatus("off", "Cloud-Sicherung ist ausgeschaltet");
  }

  NG.sync = {
    init: init, push: push, pull: pull, disable: disable,
    onStatus: onStatus,
    status: function () { return statusValue; },
    available: function () { return !!(global.claude && typeof global.claude.use === "function"); }
  };
})(window);
