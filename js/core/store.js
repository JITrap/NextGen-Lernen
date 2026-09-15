/* =========================================================
   NextGen Lernen – Datenspeicher
   Hält den gesamten App-Zustand, speichert ihn lokal und
   benachrichtigt Ansichten über Änderungen.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});
  var U = NG.util;

  var STORAGE_KEY = "nextgen-lernen.state.v1";
  var SCHEMA_VERSION = 1;

  /** Auswahlfarben für Fächer. */
  var PALETTE = [
    "#4b5bd4", "#0f9d58", "#d23a44", "#c7700a", "#8b3ec7",
    "#0a7ea4", "#c2185b", "#00897b", "#5d4037", "#455a64",
    "#e5533d", "#7cb342"
  ];

  /** Alle Sammlungen (Arrays) im Zustand. */
  var COLLECTIONS = [
    "subjects", "grades", "events", "tasks", "timetable",
    "materials", "aiRuns", "decks", "cards", "sessions"
  ];

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      settings: {
        name: "",
        klasse: "",
        schoolYear: "",
        theme: "auto",                 // auto | light | dark
        gradeScale: "de6",             // de6 (1–6) | points15 (0–15 Punkte)
        defaultWeights: { written: 50, oral: 50 },
        targetGrade: null,
        startView: "dashboard",
        firstHourStart: "08:00",
        lessonMinutes: 45,
        ai: {
          provider: "auto",            // auto | claude | anthropic | proxy
          apiKey: "",
          model: "claude-opus-5",
          proxyUrl: "",
          language: "de",
          mode: "explain"              // explain (Lernmodus) | solve (nur Lösung)
        },
        cloudSync: true,
        onboarded: false
      },
      subjects: [],
      grades: [],
      events: [],
      tasks: [],
      timetable: [],
      materials: [],
      aiRuns: [],
      decks: [],
      cards: [],
      sessions: [],
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
  }

  /* ---------- Zustands-Reparatur -------------------------- */

  /** Sorgt dafür, dass ein geladener Zustand alle erwarteten Felder hat. */
  function normalize(raw) {
    var base = defaultState();
    if (!raw || typeof raw !== "object") return base;

    var s = Object.assign({}, base, raw);
    s.version = SCHEMA_VERSION;

    s.settings = Object.assign({}, base.settings, raw.settings || {});
    s.settings.defaultWeights = Object.assign({}, base.settings.defaultWeights,
      (raw.settings && raw.settings.defaultWeights) || {});
    s.settings.ai = Object.assign({}, base.settings.ai, (raw.settings && raw.settings.ai) || {});

    COLLECTIONS.forEach(function (key) {
      s[key] = Array.isArray(raw[key]) ? raw[key].filter(function (r) { return r && typeof r === "object"; }) : [];
      s[key].forEach(function (rec) { if (!rec.id) rec.id = U.uid(key.slice(0, 3)); });
    });

    s.meta = Object.assign({}, base.meta, raw.meta || {});

    // Fächer: Gewichtungen und Farben absichern
    s.subjects.forEach(function (sub) {
      sub.weights = Object.assign({ written: 50, oral: 50 }, sub.weights || {});
      if (typeof sub.weights.written !== "number" || !isFinite(sub.weights.written)) sub.weights.written = 50;
      if (typeof sub.weights.oral !== "number" || !isFinite(sub.weights.oral)) sub.weights.oral = 50;
      if (!sub.color) sub.color = PALETTE[0];
      if (!sub.short) sub.short = String(sub.name || "?").slice(0, 2).toUpperCase();
    });

    // Noten: Typ und Gewicht absichern
    s.grades.forEach(function (g) {
      if (g.type !== "written" && g.type !== "oral") g.type = "written";
      g.value = U.num(g.value, null);
      g.weight = U.num(g.weight, 1);
      if (!(g.weight > 0)) g.weight = 1;
    });

    // Karteikarten: Leitner-Fach absichern
    s.cards.forEach(function (c) {
      c.box = U.clamp(parseInt(c.box, 10) || 1, 1, 5);
      if (!c.due) c.due = U.todayISO();
    });

    return s;
  }

  /* ---------- Speicher ------------------------------------ */

  var state = defaultState();
  var listeners = {};
  var saveTimer = null;
  var storageOk = true;

  function readStorage() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      storageOk = false;
      console.warn("[NextGen Lernen] Lokaler Speicher nicht lesbar:", e);
      return null;
    }
  }

  function writeStorage() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
      return true;
    } catch (e) {
      storageOk = false;
      console.warn("[NextGen Lernen] Speichern fehlgeschlagen:", e);
      emit("storage-error", e);
      return false;
    }
  }

  /* ---------- Ereignisse ---------------------------------- */

  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return function () { off(evt, fn); };
  }

  function off(evt, fn) {
    if (!listeners[evt]) return;
    listeners[evt] = listeners[evt].filter(function (f) { return f !== fn; });
  }

  function emit(evt, payload) {
    (listeners[evt] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { console.error("[NextGen Lernen] Listener-Fehler:", e); }
    });
  }

  /** Markiert den Zustand als verändert, speichert verzögert und meldet es. */
  function touch(collection) {
    state.meta.updatedAt = new Date().toISOString();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      writeStorage();
      if (NG.sync && NG.sync.push) NG.sync.push(state);
    }, 220);
    if (collection) emit("change:" + collection, state[collection]);
    emit("change", collection || null);
  }

  /** Erzwingt sofortiges Speichern (z. B. vor dem Schließen des Tabs). */
  function flush() {
    clearTimeout(saveTimer);
    writeStorage();
    if (NG.sync && NG.sync.push) NG.sync.push(state);
  }

  /* ---------- CRUD ---------------------------------------- */

  function all(collection) {
    return state[collection] || [];
  }

  function find(collection, id) {
    if (!id) return null;
    var list = all(collection);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function add(collection, data) {
    var rec = Object.assign({}, data);
    if (!rec.id) rec.id = U.uid(collection.slice(0, 3));
    if (!rec.createdAt) rec.createdAt = new Date().toISOString();
    all(collection).push(rec);
    touch(collection);
    return rec;
  }

  function addMany(collection, items) {
    var out = items.map(function (data) {
      var rec = Object.assign({}, data);
      if (!rec.id) rec.id = U.uid(collection.slice(0, 3));
      if (!rec.createdAt) rec.createdAt = new Date().toISOString();
      return rec;
    });
    Array.prototype.push.apply(all(collection), out);
    touch(collection);
    return out;
  }

  function update(collection, id, patch) {
    var rec = find(collection, id);
    if (!rec) return null;
    Object.assign(rec, patch);
    rec.updatedAt = new Date().toISOString();
    touch(collection);
    return rec;
  }

  function remove(collection, id) {
    var list = all(collection);
    var idx = list.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return false;
    list.splice(idx, 1);
    touch(collection);
    return true;
  }

  function removeWhere(collection, predicate) {
    var list = all(collection);
    var keep = list.filter(function (r) { return !predicate(r); });
    var removed = list.length - keep.length;
    if (removed) { state[collection] = keep; touch(collection); }
    return removed;
  }

  /** Löscht ein Fach samt aller daran hängenden Einträge. */
  function removeSubject(id) {
    removeWhere("grades", function (g) { return g.subjectId === id; });
    removeWhere("timetable", function (t) { return t.subjectId === id; });
    all("events").forEach(function (e) { if (e.subjectId === id) e.subjectId = null; });
    all("tasks").forEach(function (t) { if (t.subjectId === id) t.subjectId = null; });
    all("materials").forEach(function (m) { if (m.subjectId === id) m.subjectId = null; });
    all("decks").forEach(function (d) { if (d.subjectId === id) d.subjectId = null; });
    return remove("subjects", id);
  }

  /* ---------- Einstellungen -------------------------------- */

  function settings() { return state.settings; }

  function setSetting(path, value) {
    var parts = String(path).split(".");
    var node = state.settings;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== "object" || node[parts[i]] === null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    touch("settings");
    emit("settings", state.settings);
    return value;
  }

  function getSetting(path, fallback) {
    var parts = String(path).split(".");
    var node = state.settings;
    for (var i = 0; i < parts.length; i++) {
      if (node === null || node === undefined) return fallback;
      node = node[parts[i]];
    }
    return node === undefined ? fallback : node;
  }

  /* ---------- Nachschlagen --------------------------------- */

  function subject(id) { return find("subjects", id); }

  function subjectName(id) {
    var s = subject(id);
    return s ? s.name : "Ohne Fach";
  }

  function subjectColor(id) {
    var s = subject(id);
    return s ? s.color : "var(--text-faint)";
  }

  function activeSubjects() {
    return U.sortBy(all("subjects").filter(function (s) { return !s.archived; }),
      function (s) { return (s.name || "").toLowerCase(); });
  }

  function nextColor() {
    var used = all("subjects").map(function (s) { return s.color; });
    for (var i = 0; i < PALETTE.length; i++) {
      if (used.indexOf(PALETTE[i]) < 0) return PALETTE[i];
    }
    return PALETTE[used.length % PALETTE.length];
  }

  /* ---------- Import / Export ------------------------------ */

  function exportJSON() {
    return JSON.stringify({
      app: "NextGen Lernen",
      exportedAt: new Date().toISOString(),
      data: state
    }, null, 2);
  }

  function importJSON(text, mode) {
    var parsed = JSON.parse(text);
    var incoming = parsed && parsed.data ? parsed.data : parsed;
    if (!incoming || typeof incoming !== "object") throw new Error("Datei enthält keine gültigen Daten.");

    if (mode === "merge") {
      var merged = normalize(incoming);
      COLLECTIONS.forEach(function (key) {
        var existing = {};
        state[key].forEach(function (r) { existing[r.id] = true; });
        merged[key].forEach(function (r) {
          if (!existing[r.id]) state[key].push(r);
        });
      });
    } else {
      state = normalize(incoming);
    }
    flush();
    emit("reload", state);
    emit("change", null);
    return state;
  }

  function replaceState(next) {
    state = normalize(next);
    NG.store.state = state;
    emit("reload", state);
    emit("change", null);
  }

  function reset() {
    state = defaultState();
    NG.store.state = state;
    flush();
    emit("reload", state);
    emit("change", null);
  }

  /* ---------- Start ---------------------------------------- */

  function init() {
    state = normalize(readStorage());
    NG.store.state = state;
    global.addEventListener("beforeunload", function () { flush(); });
    // Änderungen aus einem zweiten Tab übernehmen
    global.addEventListener("storage", function (e) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        var incoming = JSON.parse(e.newValue);
        if (incoming && incoming.meta && incoming.meta.updatedAt > state.meta.updatedAt) {
          state = normalize(incoming);
          NG.store.state = state;
          emit("reload", state);
          emit("change", null);
        }
      } catch (err) { /* ignorieren */ }
    });
    return state;
  }

  NG.store = {
    STORAGE_KEY: STORAGE_KEY,
    PALETTE: PALETTE,
    COLLECTIONS: COLLECTIONS,
    state: state,
    init: init,
    all: all, find: find, add: add, addMany: addMany,
    update: update, remove: remove, removeWhere: removeWhere, removeSubject: removeSubject,
    settings: settings, setSetting: setSetting, getSetting: getSetting,
    subject: subject, subjectName: subjectName, subjectColor: subjectColor,
    activeSubjects: activeSubjects, nextColor: nextColor,
    on: on, off: off, emit: emit, touch: touch, flush: flush,
    exportJSON: exportJSON, importJSON: importJSON, replaceState: replaceState, reset: reset,
    defaultState: defaultState, normalize: normalize,
    storageOk: function () { return storageOk; }
  };
})(window);
