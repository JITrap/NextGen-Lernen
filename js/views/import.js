/* =========================================================
   NextGen Lernen – Importieren
   Holt Schulstoff auf zwei Wegen in die App:
     1. direkt aus OneNote (Microsoft Graph, nur in der
        selbst betriebenen Fassung erreichbar)
     2. aus hochgeladenen Dateien (Word, HTML, Text, Bilder)
   Auf Wunsch bereitet die KI daraus Themen, Karteikarten,
   Termine und Aufgaben auf.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Feste Werte ---------------------------------- */

  var MAX_AI_CHARS = 12000;        // so viel Text bekommt die KI höchstens
  var MAX_AI_IMAGES = 4;           // so viele Bilder gehen mit
  var MAX_PAGE_IMAGES = 3;         // Bilder je OneNote-Seite
  var MAX_THEMEN = 12, MAX_KARTEN = 30, MAX_TERMINE = 10, MAX_AUFGABEN = 10;
  var SHRINK_PX = 1600;

  var FALLBACK_ACCEPT =
    "image/*,text/plain,text/html,.txt,.md,.htm,.html,.docx,.doc,.mht,.mhtml";

  var EVENT_TYPES = { exam: "Klassenarbeit", test: "Test", other: "Termin" };

  /* ---------- Flüchtiger Zustand ----------------------------
     Lebt nur im Arbeitsspeicher. Die Ansicht ist mit
     `live: false` angemeldet und baut sich selbst neu auf. */

  var mode = "onenote";            // onenote | files
  var ctxRef = null;
  var paneHost = null;
  var switchHost = null;
  var modeHint = null;

  /* OneNote */
  var nbState = { status: "idle", items: [], error: null };
  var secState = {};               // notizbuchId -> {status, items, error}
  var pageState = {};              // abschnittId -> {status, items, error}
  var openNb = {};                 // notizbuchId -> true
  var openSec = {};                // abschnittId -> true
  var selected = new Set();        // ausgewählte Seiten-Ids
  var pageMeta = {};               // seitenId -> {title, sectionId, sectionName}
  var secSubject = {};             // abschnittId -> Fach-Id ("" = ohne Fach)
  var secNames = {};               // abschnittId -> Abschnittsname
  var offChange = null;            // Abmelder für NG.onenote.onChange
  var treeHost = null;
  var barCountNode = null;
  var barBtn = null;
  var secChecks = [];              // [{sectionId, node}]

  /* Dateien */
  var fileItems = [];
  var fileSubject = "";
  var fileInput = null;
  var fileListHost = null;
  var fileSaveBtn = null;
  var fileAiBtn = null;
  var fileCountNode = null;
  var savingFiles = false;

  /* KI */
  var aiController = null;

  /* =========================================================
     Kleine Helfer
     ========================================================= */

  function goTo(id) {
    if (ctxRef && ctxRef.go) ctxRef.go(id);
    else if (NG.app && NG.app.go) NG.app.go(id);
  }

  function rerender() {
    if (ctxRef && ctxRef.rerender) ctxRef.rerender();
    else if (NG.app && NG.app.scheduleRender) NG.app.scheduleRender();
  }

  function msgOf(err) {
    if (!err) return "Unbekannter Fehler";
    return String(err.message || err.code || err.name || err);
  }

  function btn(label, cls, onClick, icon) {
    return el("button", {
      type: "button",
      class: cls || "btn",
      html: (icon ? U.icon(icon) : "") + "<span>" + U.escapeHtml(label) + "</span>",
      onClick: onClick
    });
  }

  function iconNode(name, px) {
    var node = U.iconEl(name);
    if (node && node.style && px) { node.style.width = px + "px"; node.style.height = px + "px"; }
    return node;
  }

  function noteRow(icon, text, color) {
    return el("div", { class: "row row--tight fs-sm", style: { color: color || "var(--text-muted)", alignItems: "flex-start" } }, [
      iconNode(icon, 16),
      el("span", { text: text, style: { flex: "1 1 200px", minWidth: "0" } })
    ]);
  }

  function baseName(name) {
    return String(name || "Datei").replace(/\.[a-z0-9]{1,6}$/i, "").trim() || "Datei";
  }

  /** Vergleichsform eines Namens: klein, ohne Sonderzeichen. */
  function normName(str) {
    return String(str || "").toLowerCase()
      .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "s")
      .replace(/[^a-z0-9]+/g, "");
  }

  function findSubjectByName(name) {
    var n = normName(name);
    if (!n) return null;
    var hit = null;
    NG.store.all("subjects").forEach(function (s) {
      if (hit) return;
      if (normName(s.name) === n) hit = s.id;
    });
    if (hit) return hit;
    NG.store.all("subjects").forEach(function (s) {
      if (hit) return;
      var sn = normName(s.name);
      if (sn.length >= 3 && (n.indexOf(sn) >= 0 || sn.indexOf(n) >= 0)) hit = s.id;
    });
    return hit;
  }

  /** Fach raten, dessen Name dem Abschnittsnamen ähnelt. */
  function guessSubject(name) {
    return findSubjectByName(name) || "";
  }

  function shortOf(name) {
    var clean = String(name || "").trim();
    return (clean.slice(0, 2) || "??").toUpperCase();
  }

  function subjectSelect(value, onPick, label) {
    var sel = el("select", { "aria-label": label || "Fach wählen" });
    NG.ui.subjectOptions({ allowNone: true, noneLabel: "— ohne Fach —" }).forEach(function (o) {
      var opt = el("option", { value: o.value === null ? "" : o.value, text: o.label });
      if (String(o.value === null ? "" : o.value) === String(value || "")) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () { onPick(sel.value); });
    return sel;
  }

  /** Bild verkleinern und ablegen. Gibt die Dateireferenz zurück. */
  function storeBlob(blob, name) {
    if (!blob) return Promise.resolve(null);
    var isImage = /^image\//i.test(String(blob.type || ""));
    var prep = (isImage && typeof U.shrinkImage === "function")
      ? U.shrinkImage(blob, SHRINK_PX)
      : Promise.resolve(blob);
    return prep.then(function (b) {
      return NG.files.put(b || blob, { name: U.truncate(String(name || "Datei"), 80) });
    });
  }

  /* =========================================================
     Brücke zu NG.onenote – darf jederzeit fehlen
     ========================================================= */

  var ONE_ERRORS = {
    not_configured: "OneNote ist noch nicht eingerichtet. Trag zuerst die Anwendungs-ID ein.",
    not_signed_in: "Du bist nicht mehr bei Microsoft angemeldet. Melde dich bitte noch einmal an.",
    unavailable: "Die OneNote-Verbindung funktioniert an dieser Stelle nicht.",
    cancelled: "Abgebrochen.",
    http_400: "Microsoft konnte mit der Anfrage nichts anfangen.",
    http_401: "Die Anmeldung ist abgelaufen. Melde dich bitte noch einmal an.",
    http_403: "Microsoft hat den Zugriff abgelehnt. Oft sperrt die Schul-IT die Freigabe – dann hilft nur der Datei-Import.",
    http_404: "Das habe ich bei Microsoft nicht gefunden. Vielleicht wurde es verschoben oder gelöscht.",
    http_429: "Microsoft bremst gerade. Warte einen Moment und versuche es noch einmal."
  };

  function oneApi() {
    var api = global.NG && global.NG.onenote;
    return (api && typeof api === "object") ? api : null;
  }

  function oneErr(err) {
    if (!err) return "Unbekannter Fehler.";
    var code = err.code ? String(err.code) : "";
    if (ONE_ERRORS[code]) return ONE_ERRORS[code];
    if (/^http_5/.test(code)) return "Microsoft ist gerade nicht erreichbar. Versuch es später noch einmal.";
    return msgOf(err);
  }

  /** Ein boolesches Feld der Schnittstelle abfragen, ohne je zu stürzen. */
  function oneFlag(method, fallback) {
    var api = oneApi();
    if (!api || typeof api[method] !== "function") return fallback;
    try { return !!api[method](); } catch (e) { return fallback; }
  }

  function oneAvailable() { return oneFlag("available", false); }
  function oneConfigured() { return oneAvailable() && oneFlag("isConfigured", false); }
  function oneSignedIn() { return oneConfigured() && oneFlag("isSignedIn", false); }

  function oneReason() {
    var api = oneApi();
    if (!api) {
      return "Die OneNote-Verbindung ist auf dieser Seite nicht geladen.";
    }
    if (typeof api.unavailableReason !== "function") {
      return "Die OneNote-Verbindung ist hier nicht verfügbar.";
    }
    try {
      return String(api.unavailableReason() || "Die OneNote-Verbindung ist hier nicht verfügbar.");
    } catch (e) {
      return "Die OneNote-Verbindung ist hier nicht verfügbar.";
    }
  }

  function oneRedirectUri() {
    var api = oneApi();
    if (!api || typeof api.redirectUri !== "function") return String(global.location.href).split("#")[0];
    try { return String(api.redirectUri() || ""); } catch (e) { return String(global.location.href).split("#")[0]; }
  }

  function oneAccount() {
    var api = oneApi();
    if (!api || typeof api.account !== "function") return null;
    try {
      var acc = api.account();
      return (acc && typeof acc === "object") ? acc : null;
    } catch (e) { return null; }
  }

  /** Jede Methode der Schnittstelle als Promise aufrufen. */
  function oneCall(method) {
    var api = oneApi();
    var args = Array.prototype.slice.call(arguments, 1);
    if (!api || typeof api[method] !== "function") {
      return Promise.reject({ code: "unavailable", message: "Die OneNote-Verbindung ist hier nicht verfügbar." });
    }
    try {
      var res = api[method].apply(api, args);
      return (res && typeof res.then === "function") ? res : Promise.resolve(res);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /* =========================================================
     Brücke zu NG.importers – darf ebenfalls fehlen
     ========================================================= */

  function importApi() {
    var api = global.NG && global.NG.importers;
    return (api && typeof api === "object") ? api : null;
  }

  function acceptAttr() {
    var api = importApi();
    var acc = api && api.ACCEPT;
    return (typeof acc === "string" && acc) ? acc : FALLBACK_ACCEPT;
  }

  function describeFile(file) {
    var api = importApi();
    if (!api || typeof api.describe !== "function") {
      return {
        kind: "other", label: "Datei", supported: false,
        hint: "Der Datei-Import ist gerade nicht geladen. Lade die Seite neu."
      };
    }
    var out = null;
    try { out = api.describe(file); } catch (e) { out = null; }
    if (!out || typeof out !== "object") {
      return { kind: "other", label: "Datei", supported: false, hint: "Diese Datei kann ich nicht lesen." };
    }
    return {
      kind: String(out.kind || "other"),
      label: String(out.label || "Datei"),
      supported: out.supported !== false,
      hint: String(out.hint || "")
    };
  }

  function extractFile(file) {
    var api = importApi();
    if (!api || typeof api.extract !== "function") {
      return Promise.reject({ message: "Der Datei-Import ist gerade nicht geladen." });
    }
    try {
      var res = api.extract(file);
      return (res && typeof res.then === "function") ? res : Promise.resolve(res);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /** HTML in Text und Bildverweise zerlegen – mit einfachem Rückfall. */
  function htmlToBlocks(html) {
    var api = importApi();
    if (api && typeof api.htmlToBlocks === "function") {
      try {
        var r = api.htmlToBlocks(html);
        if (r && typeof r === "object") {
          return {
            text: String(r.text || ""),
            images: Array.isArray(r.images) ? r.images : []
          };
        }
      } catch (e) { /* unten weiter */ }
    }
    if (api && typeof api.htmlToText === "function") {
      try { return { text: String(api.htmlToText(html) || ""), images: [] }; } catch (e) { /* unten weiter */ }
    }
    return {
      text: String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      images: []
    };
  }

  /* =========================================================
     Umschalter oben
     ========================================================= */

  function modeHintText() {
    return mode === "files" ? "Dateien von deinem Gerät" : "Direkt aus deinem Notizbuch";
  }

  function setMode(next) {
    if (mode === next) return;
    mode = next;
    if (switchHost) {
      U.$$("button", switchHost).forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.mode === mode ? "true" : "false");
      });
    }
    if (modeHint) modeHint.textContent = modeHintText();
    paintPane();
  }

  function switcher() {
    function tab(id, label, icon) {
      var node = el("button", {
        type: "button",
        dataset: { mode: id },
        "aria-pressed": mode === id ? "true" : "false",
        onClick: function () { setMode(id); }
      }, [iconNode(icon, 15), el("span", { text: label })]);
      return node;
    }
    switchHost = el("div", { class: "btn-group", role: "group", "aria-label": "Weg zum Import wählen" }, [
      tab("onenote", "Aus OneNote", "cloud"),
      tab("files", "Aus Dateien", "upload")
    ]);
    return switchHost;
  }

  function paintPane() {
    if (!paneHost) return;
    U.clear(paneHost);
    treeHost = null;
    barCountNode = null;
    barBtn = null;
    secChecks = [];
    fileListHost = null;
    fileSaveBtn = null;
    fileAiBtn = null;
    fileCountNode = null;
    paneHost.appendChild(mode === "files" ? filesPane() : onenotePane());
  }

  /* =========================================================
     TEIL 1 – Aus OneNote
     ========================================================= */

  function onenotePane() {
    if (!oneAvailable()) return onenoteUnavailable();
    if (!oneConfigured()) return onenoteSetup();
    if (!oneSignedIn()) return onenoteSignIn();
    return onenoteBrowser();
  }

  /* ---------- Fall A: geht hier nicht ---------------------- */

  function onenoteUnavailable() {
    return el("div", { class: "stack" }, [
      NG.ui.card({
        title: "OneNote geht hier leider nicht",
        body: el("div", { class: "stack stack--sm" }, [
          noteRow("alert", oneReason(), "var(--warn)"),
          el("p", {
            class: "fs-sm muted",
            text: "Die Verbindung zu OneNote braucht einen direkten Draht zu Microsoft. "
              + "Den gibt es nur in der selbst betriebenen Fassung dieser App: bei dir auf dem Rechner "
              + "mit „npm start“ oder unter einer eigenen Internet-Adresse. "
              + "In der eingebetteten Claude-Fassung ist dieser Weg gesperrt."
          }),
          el("p", {
            class: "fs-sm muted",
            text: "Das ist kein Beinbruch: Über den Datei-Import bekommst du denselben Stoff in die App. "
              + "Exportiere den Abschnitt in OneNote als Word-Datei und zieh sie hier herein."
          })
        ]),
        foot: el("div", { class: "row row--tight" }, [
          btn("Zum Datei-Import", "btn btn--primary btn--sm", function () { setMode("files"); }, "upload")
        ])
      }),
      NG.ui.card({
        title: "Was du trotzdem tun kannst",
        body: el("div", { class: "stack stack--sm" }, [
          noteRow("info", "Am Rechner: OneNote öffnen, dann Datei > Exportieren > Abschnitt oder Notizbuch > Word-Dokument."),
          noteRow("info", "Am Tablet oder Handy: Seite teilen und als Datei sichern – oder einfach Screenshots machen."),
          noteRow("info", "Die fertigen Dateien ziehst du hier in den Datei-Import. Die KI macht daraus Themen, Karteikarten, Termine und Aufgaben.")
        ])
      })
    ]);
  }

  /* ---------- Fall B: einmalig einrichten ------------------ */

  function setupStep(text, extra) {
    return el("li", { style: { marginBottom: "var(--sp-2)" } }, [
      el("span", { text: text }),
      extra ? el("div", { style: { marginTop: "var(--sp-2)" } }, extra) : null
    ]);
  }

  function onenoteSetup() {
    var uri = oneRedirectUri();

    var uriBox = el("div", { class: "input-group" }, [
      el("code", {
        text: uri,
        style: {
          flex: "1 1 200px", minWidth: "0", overflowWrap: "anywhere",
          background: "var(--surface-3)", padding: "7px 10px",
          borderRadius: "var(--radius-sm)", fontSize: ".78rem"
        }
      }),
      btn("Kopieren", "btn btn--sm", function () { NG.ui.copyText(uri); }, "copy")
    ]);

    var input = el("input", {
      type: "text",
      placeholder: "z. B. 11111111-2222-3333-4444-555555555555",
      "aria-label": "Anwendungs-ID (Client)",
      autocomplete: "off", spellcheck: "false",
      style: { flex: "1 1 220px", minWidth: "0" }
    });
    var errorNode = el("div", { class: "field__error hidden" });

    function save() {
      var value = String(input.value || "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        errorNode.textContent = value
          ? "Das sieht noch nicht nach einer Anwendungs-ID aus. Sie besteht aus Zahlen und Buchstaben mit vier Bindestrichen."
          : "Bitte trag zuerst die Anwendungs-ID ein.";
        errorNode.classList.remove("hidden");
        input.style.borderColor = "var(--danger)";
        input.focus();
        return;
      }
      errorNode.classList.add("hidden");
      input.style.borderColor = "";
      NG.store.setSetting("onenote.clientId", value.toLowerCase());
      NG.ui.toast("Gespeichert – jetzt kannst du dich bei Microsoft anmelden.", "success");
      rerender();
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); save(); }
    });

    var steps = el("ol", {
      style: { margin: "0", paddingLeft: "1.3em", fontSize: ".88rem", lineHeight: "1.55" }
    }, [
      setupStep("Melde dich auf entra.microsoft.com an und lege unter „App-Registrierungen“ eine neue Registrierung an. Der Name ist frei wählbar, zum Beispiel „NextGen Lernen“.",
        el("code", {
          text: "https://entra.microsoft.com",
          style: { background: "var(--surface-3)", padding: "3px 7px", borderRadius: "var(--radius-sm)", fontSize: ".78rem" }
        })),
      setupStep("Wähle bei den Kontotypen: „Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten“."),
      setupStep("Füge die Plattform „Single-Page-Application (SPA)“ hinzu und trage als Umleitungs-URI genau diese Adresse ein:", uriBox),
      setupStep("Füge unter „API-Berechtigungen“ für Microsoft Graph die delegierte Berechtigung „Notes.Read“ hinzu."),
      setupStep("Kopiere zum Schluss die „Anwendungs-ID (Client)“ und füge sie hier unten ein.")
    ]);

    return el("div", { class: "stack" }, [
      NG.ui.card({
        title: "OneNote einmalig einrichten",
        body: el("div", { class: "stack stack--sm" }, [
          el("p", {
            class: "fs-sm muted",
            text: "Microsoft muss dieser App einmal erlauben, deine Notizbücher zu lesen. "
              + "Das dauert ein paar Minuten und ist danach für immer erledigt."
          }),
          steps,
          el("div", { class: "field" }, [
            el("label", { class: "label", text: "Anwendungs-ID (Client)" }),
            el("div", { class: "input-group" }, [input, btn("Speichern", "btn btn--primary btn--sm", save, "save")]),
            el("div", { class: "field__hint", text: "Die ID wird nur auf diesem Gerät gespeichert. Ein Passwort brauchst du dafür nicht." }),
            errorNode
          ])
        ]),
        foot: noteRow("alert",
          "Ehrlich gesagt: An Schulkonten kann die IT diese Freigabe blockieren. "
          + "Wenn die Anmeldung mit einer Fehlermeldung endet, nimm den Datei-Import – der geht immer.",
          "var(--warn)")
      }),
      el("div", { class: "row row--tight" }, [
        btn("Lieber Dateien hochladen", "btn btn--sm", function () { setMode("files"); }, "upload")
      ])
    ]);
  }

  /* ---------- Fall C: anmelden ----------------------------- */

  function forgetSetup() {
    NG.ui.confirm({
      title: "Einrichtung löschen?",
      message: "Die Anwendungs-ID wird von diesem Gerät entfernt. Du kannst sie jederzeit neu eintragen.",
      confirmText: "Löschen",
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      NG.store.setSetting("onenote.clientId", "");
      resetTree();
      NG.ui.toast("Einrichtung gelöscht", "success");
      rerender();
    });
  }

  function onenoteSignIn() {
    var errorHost = el("div", { class: "stack stack--sm" });

    var signInBtn = btn("Mit Microsoft anmelden", "btn btn--primary", function () {
      U.clear(errorHost);
      signInBtn.disabled = true;
      var spin = el("div", { class: "row row--tight fs-sm muted" }, [
        el("span", { class: "spinner" }),
        el("span", { text: "Du wirst zu Microsoft weitergeleitet …" })
      ]);
      errorHost.appendChild(spin);

      oneCall("signIn").then(function () {
        signInBtn.disabled = false;
        U.clear(errorHost);
        resetTree();
        rerender();
      }, function (err) {
        signInBtn.disabled = false;
        U.clear(errorHost);
        errorHost.appendChild(noteRow("alert", "Die Anmeldung hat nicht geklappt: " + oneErr(err), "var(--danger)"));
        errorHost.appendChild(el("div", { class: "row row--tight" }, [
          btn("Zum Datei-Import", "btn btn--sm", function () { setMode("files"); }, "upload")
        ]));
      });
    }, "cloud");

    return el("div", { class: "stack" }, [
      NG.ui.card({
        title: "Bei Microsoft anmelden",
        body: el("div", { class: "stack stack--sm" }, [
          el("p", {
            class: "fs-sm muted",
            text: "OneNote ist eingerichtet. Melde dich jetzt mit deinem Microsoft-Konto an, "
              + "dann kann ich deine Notizbücher lesen. Die App darf dabei nur lesen – nichts ändern und nichts löschen."
          }),
          el("div", { class: "row row--tight" }, [signInBtn]),
          errorHost
        ]),
        foot: el("div", { class: "row row--tight" }, [
          el("span", { class: "fs-xs faint", text: "Falsche Anwendungs-ID eingetragen?" }),
          btn("Einrichtung ändern", "btn btn--sm btn--ghost", forgetSetup, "settings")
        ])
      })
    ]);
  }

  /* ---------- Fall D: angemeldet – Notizbücher -------------- */

  function resetTree() {
    nbState = { status: "idle", items: [], error: null };
    secState = {};
    pageState = {};
    openNb = {};
    openSec = {};
    selected = new Set();
    pageMeta = {};
    secChecks = [];
  }

  function signOut() {
    NG.ui.confirm({
      title: "Von Microsoft abmelden?",
      message: "Deine schon importierten Materialien bleiben natürlich erhalten.",
      confirmText: "Abmelden"
    }).then(function (yes) {
      if (!yes) return;
      oneCall("signOut").then(function () {
        resetTree();
        NG.ui.toast("Abgemeldet", "success");
        rerender();
      }, function (err) {
        NG.ui.toast("Abmelden ging nicht: " + oneErr(err), "error");
      });
    });
  }

  function onenoteBrowser() {
    var acc = oneAccount();

    var head = NG.ui.card({
      body: el("div", { class: "row row--tight" }, [
        el("span", { class: "icon-badge" }, iconNode("cloud", 20)),
        el("div", { style: { flex: "1 1 160px", minWidth: "0" } }, [
          el("div", { class: "fw-6 truncate", text: (acc && acc.name) ? String(acc.name) : "Bei Microsoft angemeldet" }),
          el("div", { class: "fs-xs faint truncate", text: (acc && acc.username) ? String(acc.username) : "OneNote ist verbunden" })
        ]),
        el("span", { class: "spacer" }),
        btn("Neu laden", "btn btn--sm", function () { loadNotebooks(true); }, "refresh"),
        btn("Abmelden", "btn btn--sm", signOut, "x")
      ])
    });

    treeHost = el("div", { class: "stack" });

    var pane = el("div", { class: "stack" }, [
      head,
      el("p", {
        class: "fs-sm muted",
        text: "Klapp ein Notizbuch auf, wähle die Seiten aus, die du brauchst, und leg für jeden Abschnitt fest, "
          + "zu welchem Fach er gehört. Danach hole ich die Seiten als Materialien in die App."
      }),
      treeHost,
      selectionBar()
    ]);

    paintTree();
    loadNotebooks(false);
    return pane;
  }

  function selectionBar() {
    barCountNode = el("span", { class: "fw-6", text: "0 Seiten ausgewählt" });
    barBtn = btn("Auswahl importieren", "btn btn--primary", startOneNoteImport, "download");
    barBtn.disabled = true;

    var clearBtn = btn("Auswahl leeren", "btn btn--sm btn--ghost", function () {
      selected = new Set();
      paintTree();
    }, "x");

    var bar = el("div", {
      class: "row row--tight",
      style: {
        position: "sticky", bottom: "0", zIndex: "3",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: "var(--sp-3) var(--sp-4)",
        boxShadow: "var(--shadow-sm)"
      }
    }, [
      barCountNode,
      el("span", { class: "spacer" }),
      clearBtn,
      barBtn
    ]);
    return bar;
  }

  function paintBar() {
    if (!barCountNode) return;
    var n = selected.size;
    barCountNode.textContent = n === 1 ? "1 Seite ausgewählt" : n + " Seiten ausgewählt";
    if (barBtn) barBtn.disabled = !n;
  }

  /* ---------- Laden ---------------------------------------- */

  function loadNotebooks(force) {
    if (nbState.status === "loading") return;
    if (nbState.status === "ready" && !force) { paintTree(); return; }
    nbState = { status: "loading", items: [], error: null };
    paintTree();
    oneCall("notebooks").then(function (list) {
      nbState = { status: "ready", items: Array.isArray(list) ? list : [], error: null };
      paintTree();
    }, function (err) {
      nbState = { status: "error", items: [], error: err };
      paintTree();
    });
  }

  function loadSections(nbId, after) {
    var st = secState[nbId];
    if (st && st.status === "loading") return;
    if (st && st.status === "ready") { if (after) after(); return; }
    secState[nbId] = { status: "loading", items: [], error: null };
    paintTree();
    oneCall("sections", nbId).then(function (list) {
      secState[nbId] = { status: "ready", items: Array.isArray(list) ? list : [], error: null };
      secState[nbId].items.forEach(function (sec) {
        if (sec && sec.id) secNames[sec.id] = String(sec.displayName || "Abschnitt");
      });
      paintTree();
      if (after) after();
    }, function (err) {
      secState[nbId] = { status: "error", items: [], error: err };
      paintTree();
    });
  }

  function loadPages(secId, after) {
    var st = pageState[secId];
    if (st && st.status === "loading") {
      // Es läuft schon – den Wunsch einfach anhängen.
      if (after) st.waiting.push(after);
      return;
    }
    if (st && st.status === "ready") { if (after) after(); return; }
    var next = { status: "loading", items: [], error: null, waiting: after ? [after] : [] };
    pageState[secId] = next;
    paintTree();
    oneCall("pages", secId).then(function (list) {
      // Älteste zuerst – so stehen die Seiten in derselben Reihenfolge wie im Notizbuch.
      var items = U.sortBy(Array.isArray(list) ? list : [], function (p) {
        return String((p && (p.createdDateTime || p.lastModifiedDateTime)) || "");
      }, "asc");
      pageState[secId] = { status: "ready", items: items, error: null };
      items.forEach(function (p) { rememberPage(p, secId); });
      paintTree();
      next.waiting.forEach(function (fn) { try { fn(); } catch (e) { /* weiter */ } });
    }, function (err) {
      pageState[secId] = { status: "error", items: [], error: err };
      next.waiting.length = 0;
      paintTree();
    });
  }

  function rememberPage(page, secId) {
    if (!page || !page.id) return;
    pageMeta[page.id] = {
      title: String(page.title || "Seite ohne Titel"),
      sectionId: secId,
      sectionName: secNames[secId] || "Abschnitt"
    };
  }

  /* ---------- Baum zeichnen -------------------------------- */

  function loadingRow(text) {
    return el("div", { class: "row row--tight fs-sm muted", style: { padding: "var(--sp-3) var(--sp-5)" } }, [
      el("span", { class: "spinner" }),
      el("span", { text: text })
    ]);
  }

  function errorRow(err, retry) {
    return el("div", { class: "stack stack--sm", style: { padding: "var(--sp-3) var(--sp-5)" } }, [
      noteRow("alert", oneErr(err), "var(--danger)"),
      el("div", { class: "row row--tight" }, [
        btn("Erneut versuchen", "btn btn--sm", retry, "refresh")
      ])
    ]);
  }

  function skeletonRows(n) {
    var wrap = el("div", { class: "stack stack--sm", style: { padding: "var(--sp-4) var(--sp-5)" } });
    for (var i = 0; i < n; i++) {
      wrap.appendChild(el("div", { class: "skeleton", style: { height: "14px", width: (60 + (i % 3) * 12) + "%" } }));
    }
    return wrap;
  }

  function toggleButton(label, open, onClick, icon) {
    return el("button", {
      type: "button",
      class: "btn btn--ghost btn--sm",
      "aria-expanded": open ? "true" : "false",
      style: { flex: "1 1 auto", minWidth: "0", justifyContent: "flex-start", textAlign: "left" },
      html: U.icon(open ? "chevronDown" : "chevronRight") + (icon ? U.icon(icon) : "")
        + "<span class=\"truncate\">" + U.escapeHtml(label) + "</span>",
      onClick: onClick
    });
  }

  function paintTree() {
    if (!treeHost) return;
    U.clear(treeHost);
    secChecks = [];

    if (nbState.status === "loading" || nbState.status === "idle") {
      treeHost.appendChild(NG.ui.card({ body: skeletonRows(3), flush: true }));
      paintBar();
      return;
    }

    if (nbState.status === "error") {
      treeHost.appendChild(NG.ui.card({
        body: errorRow(nbState.error, function () { loadNotebooks(true); }),
        flush: true
      }));
      paintBar();
      return;
    }

    if (!nbState.items.length) {
      treeHost.appendChild(NG.ui.empty({
        icon: "cloud",
        title: "Keine Notizbücher gefunden",
        text: "In diesem Microsoft-Konto liegt kein OneNote-Notizbuch – oder es gehört zu einem anderen Konto.",
        action: { label: "Neu laden", onClick: function () { loadNotebooks(true); } }
      }));
      paintBar();
      return;
    }

    nbState.items.forEach(function (nb) {
      if (nb && nb.id) treeHost.appendChild(notebookCard(nb));
    });
    paintBar();
  }

  function notebookCard(nb) {
    var open = !!openNb[nb.id];
    var name = String(nb.displayName || "Notizbuch");

    var head = el("div", { class: "card__head" }, [
      toggleButton(name, open, function () {
        openNb[nb.id] = !open;
        if (!open) loadSections(nb.id);
        else paintTree();
      }, "book"),
      nb.lastModifiedDateTime
        ? el("span", { class: "fs-xs faint nowrap spacer", text: "geändert " + U.fmtDate(String(nb.lastModifiedDateTime).slice(0, 10), { style: "numeric" }) })
        : null
    ]);

    var body = null;
    if (open) {
      var st = secState[nb.id];
      if (!st || st.status === "loading" || st.status === "idle") {
        body = skeletonRows(2);
      } else if (st.status === "error") {
        body = errorRow(st.error, function () { secState[nb.id] = null; loadSections(nb.id); });
      } else if (!st.items.length) {
        body = el("div", { class: "fs-sm muted", style: { padding: "var(--sp-4) var(--sp-5)" } },
          el("span", { text: "In diesem Notizbuch gibt es keine Abschnitte." }));
      } else {
        body = el("div");
        st.items.forEach(function (sec) {
          if (sec && sec.id) body.appendChild(sectionBlock(sec));
        });
      }
    }

    return el("div", { class: "card" }, [
      head,
      body ? el("div", { class: "card__body card__body--flush" }, body) : null
    ]);
  }

  function sectionBlock(sec) {
    var open = !!openSec[sec.id];
    var name = String(sec.displayName || "Abschnitt");
    secNames[sec.id] = name;
    if (secSubject[sec.id] === undefined) secSubject[sec.id] = guessSubject(name);

    // Das Häkchen für den ganzen Abschnitt gibt es erst, wenn der Abschnitt offen ist:
    // Sonst würde man Seiten auswählen, die man noch gar nicht gesehen hat.
    var check = null;
    if (open) {
      check = el("input", { type: "checkbox", "aria-label": "Alle Seiten im Abschnitt „" + name + "“ auswählen" });
      check.addEventListener("change", function () {
        var want = check.checked;
        var st = pageState[sec.id];
        if (!st || st.status !== "ready") {
          loadPages(sec.id, function () { applySectionSelection(sec.id, want); });
          return;
        }
        applySectionSelection(sec.id, want);
      });
      secChecks.push({ sectionId: sec.id, node: check });
    }

    var row = el("div", {
      class: "row row--tight",
      style: { padding: "var(--sp-3) var(--sp-5)", borderTop: "1px solid var(--border)" }
    }, [
      check
        ? el("label", { class: "check", title: "Alle Seiten in diesem Abschnitt auswählen" }, [check])
        : el("span", { style: { width: "13px", flexShrink: "0" }, "aria-hidden": "true" }),
      toggleButton(name, open, function () {
        openSec[sec.id] = !open;
        if (!open) loadPages(sec.id);
        else paintTree();
      }, "layers"),
      el("span", { class: "spacer" }),
      el("span", { class: "fs-xs faint nowrap", text: "Fach:" }),
      subjectSelect(secSubject[sec.id], function (value) { secSubject[sec.id] = value; },
        "Fach für den Abschnitt " + name)
    ]);

    var pages = null;
    if (open) {
      var st = pageState[sec.id];
      if (!st || st.status === "loading" || st.status === "idle") {
        pages = loadingRow("Seiten werden geladen …");
      } else if (st.status === "error") {
        pages = errorRow(st.error, function () { pageState[sec.id] = null; loadPages(sec.id); });
      } else if (!st.items.length) {
        pages = el("div", { class: "fs-sm muted", style: { padding: "var(--sp-2) var(--sp-5) var(--sp-3)" } },
          el("span", { text: "Dieser Abschnitt hat noch keine Seiten." }));
      } else {
        pages = el("div", { class: "stack stack--sm", style: { padding: "0 var(--sp-5) var(--sp-3) calc(var(--sp-5) + 22px)" } });
        st.items.forEach(function (page) {
          if (page && page.id) pages.appendChild(pageRow(page, sec.id));
        });
      }
    }

    if (check) updateSectionCheck(sec.id, check);
    return el("div", {}, [row, pages]);
  }

  function pageRow(page, secId) {
    rememberPage(page, secId);
    var box = el("input", {
      type: "checkbox",
      "aria-label": "Seite „" + String(page.title || "Ohne Titel") + "“ auswählen"
    });
    box.checked = selected.has(page.id);
    box.addEventListener("change", function () {
      if (box.checked) selected.add(page.id);
      else selected.delete(page.id);
      updateSectionCheck(secId);
      paintBar();
    });

    var when = page.lastModifiedDateTime || page.createdDateTime;
    return el("label", { class: "check" }, [
      box,
      el("span", { class: "truncate", text: String(page.title || "Seite ohne Titel") }),
      when ? el("span", { class: "fs-xs faint nowrap", text: U.fmtDate(String(when).slice(0, 10), { style: "short" }) }) : null
    ]);
  }

  function applySectionSelection(secId, want) {
    var st = pageState[secId];
    var items = (st && st.items) || [];
    items.forEach(function (p) {
      if (!p || !p.id) return;
      rememberPage(p, secId);
      if (want) selected.add(p.id);
      else selected.delete(p.id);
    });
    paintTree();
  }

  function updateSectionCheck(secId, node) {
    if (!node) {
      secChecks.forEach(function (ref) { if (ref.sectionId === secId) node = ref.node; });
    }
    if (!node) return;
    var st = pageState[secId];
    var items = (st && st.items) || [];
    var total = items.length;
    var picked = 0;
    items.forEach(function (p) { if (p && p.id && selected.has(p.id)) picked++; });
    node.checked = total > 0 && picked === total;
    node.indeterminate = picked > 0 && picked < total;
  }

  /* =========================================================
     Import-Ablauf für OneNote
     ========================================================= */

  function selectedPages() {
    var out = [];
    selected.forEach(function (id) {
      var meta = pageMeta[id];
      if (meta) out.push({
        id: id,
        title: meta.title,
        sectionId: meta.sectionId,
        sectionName: meta.sectionName
      });
    });
    return out;
  }

  function startOneNoteImport() {
    var items = selectedPages();
    if (!items.length) {
      NG.ui.toast("Wähle zuerst mindestens eine Seite aus.", "warn");
      return;
    }

    var cancelled = false;
    var done = 0, skipped = 0;
    var collected = [];          // Texte für die spätere KI-Aufbereitung
    var aiImages = [];

    var bar = el("div", { class: "progress__bar", style: { width: "0%" } });
    var statusText = el("span", { text: "Es geht los …" });
    var statusRow = el("div", { class: "row row--tight fs-sm" }, [
      el("span", { class: "spinner" }),
      statusText
    ]);
    var logHost = el("div", { class: "list" });
    var logWrap = el("div", { style: { maxHeight: "38vh", overflowY: "auto" } }, logHost);
    var summaryHost = el("div", { class: "stack stack--sm" });

    var body = el("div", { class: "stack" }, [
      statusRow,
      el("div", { class: "progress" }, bar),
      NG.ui.card({ body: logWrap, flush: true }),
      summaryHost
    ]);

    var api = NG.ui.modal({
      title: "Seiten aus OneNote holen",
      wide: true,
      dismissable: false,
      body: body,
      actions: [{
        label: "Abbrechen",
        onClick: function () {
          cancelled = true;
          statusText.textContent = "Wird abgebrochen – die schon geholten Seiten bleiben erhalten.";
        }
      }],
      onClose: function () { cancelled = true; }
    });

    function log(title, ok, reason) {
      logHost.appendChild(el("div", { class: "list__item" }, [
        el("span", {
          style: { color: ok ? "var(--success)" : "var(--warn)", display: "flex", flexShrink: "0" }
        }, iconNode(ok ? "check" : "alert", 17)),
        el("div", { class: "list__main" }, [
          el("div", { class: "list__title", text: U.truncate(title || "Seite", 70) }),
          el("div", { class: "list__meta" }, [
            el("span", { text: ok ? "übernommen" : ("übersprungen" + (reason ? " (" + U.truncate(reason, 90) + ")" : "")) })
          ])
        ])
      ]));
      logWrap.scrollTop = logWrap.scrollHeight;
    }

    /** Bilder einer Seite holen und ablegen – Fehlschläge werden übersprungen. */
    function fetchImages(imgs, title) {
      var refs = [];
      var chain = Promise.resolve();
      imgs.forEach(function (img, idx) {
        chain = chain.then(function () {
          if (cancelled || !img || !img.src) return null;
          return oneCall("resourceBlob", img.src).then(function (blob) {
            if (!blob) return null;
            if (aiImages.length < MAX_AI_IMAGES && /^image\//i.test(String(blob.type || "image/"))) {
              aiImages.push(blob);
            }
            return storeBlob(blob, title + (idx ? " (Bild " + (idx + 1) + ")" : "")).then(function (ref) {
              if (ref) refs.push(ref);
            });
          }).catch(function () { return null; });   // ein fehlendes Bild bricht nichts ab
        });
      });
      return chain.then(function () { return refs; });
    }

    function handlePage(item, html) {
      var blocks = htmlToBlocks(html);
      var text = String(blocks.text || "").trim();
      var imgs = (blocks.images || []).slice(0, MAX_PAGE_IMAGES);

      if (!text && !imgs.length) {
        skipped++;
        log(item.title, false, "kein Inhalt");
        return Promise.resolve();
      }

      return fetchImages(imgs, item.title).then(function (refs) {
        var subjectId = secSubject[item.sectionId] || null;
        var name = U.truncate(item.title || "OneNote-Seite", 110);
        var base = {
          subjectId: subjectId,
          note: "Aus OneNote – " + item.sectionName,
          tags: ["OneNote", item.sectionName].filter(Boolean),
          createdAt: new Date().toISOString()
        };

        NG.store.add("materials", Object.assign({}, base, {
          name: name,
          text: text,
          file: refs[0] || null
        }));

        refs.slice(1).forEach(function (ref, i) {
          NG.store.add("materials", Object.assign({}, base, {
            name: U.truncate(name, 95) + " (Bild " + (i + 2) + ")",
            text: "",
            file: ref
          }));
        });

        if (text) {
          collected.push({
            title: item.title,
            text: text,
            subjectName: subjectId ? NG.store.subjectName(subjectId) : ""
          });
        }
        done++;
        log(item.title, true);
      });
    }

    function step(i) {
      if (cancelled || i >= items.length) return Promise.resolve();
      var item = items[i];
      statusText.textContent = "Seite " + (i + 1) + " von " + items.length + ": " + U.truncate(item.title, 45);
      bar.style.width = Math.round((i / items.length) * 100) + "%";

      return oneCall("pageHtml", item.id)
        .then(function (html) { return handlePage(item, html); })
        .catch(function (err) {
          skipped++;
          log(item.title, false, oneErr(err));
        })
        .then(function () { return step(i + 1); });
    }

    step(0).then(function () {
      bar.style.width = "100%";
      U.clear(statusRow);
      statusRow.appendChild(el("span", {
        class: "fw-6",
        text: cancelled ? "Abgebrochen." : "Fertig."
      }));

      U.clear(summaryHost);
      summaryHost.appendChild(el("p", {
        class: "fw-6",
        text: done + (done === 1 ? " Seite übernommen, " : " Seiten übernommen, ") +
          skipped + (skipped === 1 ? " übersprungen." : " übersprungen.")
      }));
      if (done) {
        summaryHost.appendChild(el("p", {
          class: "fs-sm muted",
          text: "Du findest alles unter „Materialien“. Möchtest du daraus noch Themen, Karteikarten, "
            + "Termine und Aufgaben machen lassen?"
        }));
      }
      if (!done && !skipped) {
        summaryHost.appendChild(el("p", { class: "fs-sm muted", text: "Es wurde nichts geholt." }));
      }

      selected = new Set();
      paintTree();

      if (api.foot) {
        U.clear(api.foot);
        if (done) {
          api.foot.appendChild(btn("Zu den Materialien", "btn btn--primary", function () {
            api.close();
            goTo("materials");
          }, "folder"));
        }
        if (collected.length) {
          var aiBtn = btn("Mit KI aufbereiten", "btn", function () {
            api.close();
            prepareWithAi(collected, aiImages, null);
          }, "sparkles");
          if (!NG.ai.status().ready) {
            aiBtn.disabled = true;
            aiBtn.title = "Die KI ist noch nicht eingerichtet.";
          }
          api.foot.appendChild(aiBtn);
        }
        api.foot.appendChild(el("span", { class: "spacer" }));
        api.foot.appendChild(btn("Schließen", "btn", function () { api.close(); }));
      }
    }, function (err) {
      U.clear(statusRow);
      statusRow.appendChild(el("span", { class: "fw-6", text: "Da ist etwas schiefgegangen." }));
      U.clear(summaryHost);
      summaryHost.appendChild(noteRow("alert", oneErr(err), "var(--danger)"));
      if (api.foot) {
        U.clear(api.foot);
        api.foot.appendChild(btn("Schließen", "btn", function () { api.close(); }));
      }
    });
  }

  /* =========================================================
     KI-Aufbereitung (gilt für beide Wege)
     ========================================================= */

  var AI_SCHEMA =
    '{"themen":[{"titel":"…","fach":"…","zusammenfassung":"…","stichpunkte":["…"]}],' +
    '"karteikarten":[{"front":"…","back":"…","thema":"…"}],' +
    '"termine":[{"titel":"…","datum":"YYYY-MM-DD","art":"exam"}],' +
    '"aufgaben":[{"titel":"…","faellig":"YYYY-MM-DD"}]}';

  /** Texte zusammenfassen und dabei auf MAX_AI_CHARS begrenzen. */
  function buildAiText(sources) {
    var clean = (sources || []).filter(function (s) {
      return s && String(s.text || "").trim();
    });
    if (!clean.length) return { text: "", shortened: false, count: 0 };

    var total = 0;
    clean.forEach(function (s) { total += String(s.text).trim().length; });

    var shortened = total > MAX_AI_CHARS;
    var perSource = Math.max(300, Math.floor(MAX_AI_CHARS / clean.length));

    var parts = clean.map(function (s) {
      var t = String(s.text).trim();
      if (shortened && t.length > perSource) t = t.slice(0, perSource) + " …";
      var head = "### " + U.truncate(String(s.title || "Ohne Titel"), 90);
      if (s.subjectName) head += " (Fach: " + s.subjectName + ")";
      return head + "\n" + t;
    });

    var body = parts.join("\n\n");
    if (body.length > MAX_AI_CHARS) {
      body = body.slice(0, MAX_AI_CHARS) + " …";
      shortened = true;
    }
    return { text: body, shortened: shortened, count: clean.length };
  }

  function buildAiPrompt(prep, images) {
    var lines = [];
    lines.push("Hier ist Schulstoff aus " + prep.count + (prep.count === 1 ? " Quelle." : " Quellen."));
    if (images && images.length) {
      lines.push("Dazu kommen " + images.length + (images.length === 1 ? " Bild" : " Bilder") + " aus demselben Stoff.");
    }
    if (prep.shortened) {
      lines.push("Achtung: Der Text war zu lang und wurde gekürzt. Es fehlen also Teile – erfinde nichts dazu.");
    }
    lines.push("");
    lines.push("Bereite den Stoff zum Lernen auf und antworte AUSSCHLIESSLICH mit gültigem JSON in genau dieser Form:");
    lines.push(AI_SCHEMA);
    lines.push("");
    lines.push("Regeln:");
    lines.push("- Höchstens " + MAX_THEMEN + " Themen, " + MAX_KARTEN + " Karteikarten, "
      + MAX_TERMINE + " Termine und " + MAX_AUFGABEN + " Aufgaben.");
    lines.push("- „fach“ ist der Name des Schulfachs, so wie er im Text vorkommt. Weißt du ihn nicht, schreibe einen leeren Text.");
    lines.push("- „zusammenfassung“ sind zwei bis vier Sätze in einfacher Sprache, „stichpunkte“ sind kurze Merksätze.");
    lines.push("- Karteikarten: vorne eine kurze Frage, hinten eine knappe Antwort, immer nur eine Sache je Karte.");
    lines.push("- „art“ bei Terminen ist genau eines von: exam, test, other.");
    lines.push("- Termine und Aufgaben NUR dann, wenn im Text wirklich ein Datum steht. Erfinde niemals ein Datum.");
    lines.push("- Datumsangaben immer als YYYY-MM-DD. Heute ist der " + U.todayISO() + ".");
    lines.push("- Keine Erklärungen, kein Fließtext um das JSON herum.");
    lines.push("");
    lines.push("--- Anfang des Stoffs ---");
    lines.push(prep.text);
    lines.push("--- Ende des Stoffs ---");
    return lines.join("\n");
  }

  /* ---------- Antwort prüfen ------------------------------- */

  function asArray(v) { return Array.isArray(v) ? v : []; }
  function asText(v) { return String(v === null || v === undefined ? "" : v).trim(); }
  function isDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); }

  function normalizeResult(data) {
    data = (data && typeof data === "object") ? data : {};

    var themen = asArray(data.themen).map(function (t) {
      t = t || {};
      return {
        titel: U.truncate(asText(t.titel), 110),
        fach: asText(t.fach),
        zusammenfassung: asText(t.zusammenfassung),
        stichpunkte: asArray(t.stichpunkte).map(asText).filter(Boolean).slice(0, 12)
      };
    }).filter(function (t) {
      return t.titel && (t.zusammenfassung || t.stichpunkte.length);
    }).slice(0, MAX_THEMEN);

    var karten = asArray(data.karteikarten).map(function (c) {
      c = c || {};
      return { front: asText(c.front), back: asText(c.back), thema: asText(c.thema) };
    }).filter(function (c) { return c.front && c.back; }).slice(0, MAX_KARTEN);

    var termine = asArray(data.termine).map(function (e) {
      e = e || {};
      var art = asText(e.art).toLowerCase();
      if (art !== "exam" && art !== "test") art = "other";
      return { titel: U.truncate(asText(e.titel), 110), datum: asText(e.datum), art: art };
    }).filter(function (e) { return e.titel && isDate(e.datum); }).slice(0, MAX_TERMINE);

    var aufgaben = asArray(data.aufgaben).map(function (a) {
      a = a || {};
      return { titel: U.truncate(asText(a.titel), 110), faellig: asText(a.faellig) };
    }).filter(function (a) { return a.titel; }).map(function (a) {
      if (!isDate(a.faellig)) a.faellig = "";
      return a;
    }).slice(0, MAX_AUFGABEN);

    return { themen: themen, karteikarten: karten, termine: termine, aufgaben: aufgaben };
  }

  function resultCount(res) {
    return res.themen.length + res.karteikarten.length + res.termine.length + res.aufgaben.length;
  }

  function cancelAi() {
    if (!aiController) return;
    try { aiController.abort(); } catch (e) { /* lief schon nicht mehr */ }
    aiController = null;
  }

  /* ---------- Hinweis, wenn die KI fehlt ------------------- */

  function aiMissingCard() {
    return NG.ui.card({
      title: "Die KI ist noch nicht eingerichtet",
      body: el("div", { class: "stack stack--sm" }, [
        el("p", {
          class: "fs-sm muted",
          text: "Ohne eingerichtete KI kann ich aus dem Stoff keine Themen, Karteikarten oder Termine machen. "
            + "Das Ablegen als Material geht trotzdem."
        }),
        el("div", { class: "row row--tight" }, [
          btn("Zu den Einstellungen", "btn btn--sm btn--primary", function () { goTo("settings"); }, "settings")
        ])
      ])
    });
  }

  /* ---------- Hauptablauf ---------------------------------- */

  function prepareWithAi(sources, images, defaultSubjectId) {
    var st = NG.ai.status();
    if (!st.ready) {
      NG.ui.modal({
        title: "Mit KI aufbereiten",
        body: aiMissingCard(),
        actions: [{ label: "Schließen", variant: "primary", onClick: function (e, m) { m.close(); } }]
      });
      return;
    }

    var prep = buildAiText(sources);
    if (!prep.text) {
      NG.ui.toast("In den ausgewählten Quellen steckt kein Text, den ich lesen kann.", "warn");
      return;
    }

    var imgs = (images || []).filter(Boolean).slice(0, MAX_AI_IMAGES);
    var prompt = buildAiPrompt(prep, imgs);

    var body = el("div", { class: "stack" });
    var api = NG.ui.modal({
      title: "Mit KI aufbereiten",
      wide: true,
      dismissable: false,
      body: body,
      actions: [{ label: "Abbrechen", onClick: function () { cancelAi(); api.close(); } }],
      onClose: function () { cancelAi(); }
    });

    function paintBusy() {
      U.clear(body);
      body.appendChild(el("div", { class: "stack stack--sm center", style: { padding: "var(--sp-6) var(--sp-4)" } }, [
        el("div", { class: "spinner spinner--lg", style: { margin: "0 auto", color: "var(--accent)" } }),
        el("div", { class: "fw-6", text: "Denkt nach – das kann eine Minute dauern" }),
        el("div", {
          class: "fs-sm muted",
          text: prep.count === 1
            ? "Eine Quelle wird durchgearbeitet." + (imgs.length ? " Dazu " + imgs.length + " Bild(er)." : "")
            : prep.count + " Quellen werden durchgearbeitet." + (imgs.length ? " Dazu " + imgs.length + " Bild(er)." : "")
        }),
        prep.shortened
          ? el("div", { class: "fs-xs faint", text: "Der Text war sehr lang und wurde gleichmäßig gekürzt." })
          : null
      ]));
    }

    function paintError(err) {
      var aborted = !!err && (err.name === "AbortError" || err.code === "cancelled");
      U.clear(body);
      body.appendChild(el("div", { class: "stack stack--sm" }, [
        noteRow("alert", aborted ? "Abgebrochen." : NG.ai.friendly(err), aborted ? "var(--text-muted)" : "var(--danger)"),
        el("div", { class: "row row--tight" }, [
          btn("Noch einmal versuchen", "btn btn--sm btn--primary", start, "refresh")
        ])
      ]));
      if (api.foot) {
        U.clear(api.foot);
        api.foot.appendChild(el("span", { class: "spacer" }));
        api.foot.appendChild(btn("Schließen", "btn", function () { api.close(); }));
      }
    }

    function start() {
      paintBusy();
      if (api.foot) {
        U.clear(api.foot);
        api.foot.appendChild(btn("Abbrechen", "btn", function () { cancelAi(); api.close(); }));
      }

      cancelAi();
      var controller = new AbortController();
      aiController = controller;

      var opts = {
        system: NG.ai.systemPrompt(
          "Du bereitest importierten Schulstoff für eine Schülerin/einen Schüler auf. "
          + "In dieser Aufgabe antwortest du ausschließlich mit gültigem JSON, ohne Erklärtext."),
        prompt: prompt,
        json: true,
        tier: "complex",
        maxTokens: 8000,
        signal: controller.signal
      };
      if (imgs.length) opts.images = imgs;

      NG.ai.run(opts).then(function (res) {
        if (aiController !== controller) return;
        aiController = null;
        var data = normalizeResult(res && res.data ? res.data : null);
        try {
          NG.ai.logRun({
            kind: "import-ai",
            title: "Import aufbereitet (" + prep.count + " Quellen)",
            prompt: prompt,
            result: res && res.text ? res.text : "",
            subjectId: defaultSubjectId || null
          });
        } catch (e) { /* der Verlauf ist nur ein Extra */ }
        paintPreview(data);
      }, function (err) {
        if (aiController !== controller) return;
        aiController = null;
        paintError(err);
      });
    }

    /* ----- Vorschau mit Haken ----- */

    function paintPreview(data) {
      if (!resultCount(data)) {
        U.clear(body);
        body.appendChild(el("div", { class: "stack stack--sm" }, [
          noteRow("info", "Aus diesem Stoff konnte die KI nichts Brauchbares bauen. "
            + "Versuche es mit mehr Text oder mit einer anderen Auswahl."),
          el("div", { class: "row row--tight" }, [
            btn("Noch einmal versuchen", "btn btn--sm", start, "refresh")
          ])
        ]));
        if (api.foot) {
          U.clear(api.foot);
          api.foot.appendChild(el("span", { class: "spacer" }));
          api.foot.appendChild(btn("Schließen", "btn", function () { api.close(); }));
        }
        return;
      }

      var picked = {
        themen: data.themen.map(function () { return true; }),
        karteikarten: data.karteikarten.map(function () { return true; }),
        termine: data.termine.map(function () { return true; }),
        aufgaben: data.aufgaben.map(function () { return true; })
      };

      var missingSubjects = [];
      data.themen.forEach(function (t) {
        if (!t.fach) return;
        if (findSubjectByName(t.fach)) return;
        if (missingSubjects.indexOf(t.fach) < 0) missingSubjects.push(t.fach);
      });

      var createBox = el("input", { type: "checkbox" });
      createBox.checked = true;

      U.clear(body);
      var groups = el("div", { class: "stack" });

      groups.appendChild(groupCard("themen", "Themen", "book", data.themen, picked, function (t) {
        return {
          title: t.titel,
          meta: [t.fach ? "Fach: " + t.fach : "ohne Fachangabe",
            t.stichpunkte.length
              ? t.stichpunkte.length + (t.stichpunkte.length === 1 ? " Stichpunkt" : " Stichpunkte")
              : ""].filter(Boolean).join(" · "),
          text: U.truncate(t.zusammenfassung, 140)
        };
      }));

      groups.appendChild(groupCard("karteikarten", "Karteikarten", "layers", data.karteikarten, picked, function (c) {
        return { title: c.front, meta: c.thema || "", text: U.truncate(c.back, 140) };
      }));

      groups.appendChild(groupCard("termine", "Termine", "calendar", data.termine, picked, function (e) {
        return {
          title: e.titel,
          meta: U.fmtDate(e.datum, { style: "numeric" }) + " · " + (EVENT_TYPES[e.art] || "Termin"),
          text: ""
        };
      }));

      groups.appendChild(groupCard("aufgaben", "Aufgaben", "checkSquare", data.aufgaben, picked, function (a) {
        return {
          title: a.titel,
          meta: a.faellig ? "bis " + U.fmtDate(a.faellig, { style: "numeric" }) : "ohne Datum",
          text: ""
        };
      }));

      body.appendChild(el("div", { class: "stack" }, [
        el("p", {
          class: "fs-sm muted",
          text: "Schau dir an, was die KI gefunden hat. Nimm die Haken weg bei allem, was du nicht brauchst. "
            + "Gespeichert wird erst, wenn du auf „Übernehmen“ klickst."
        }),
        groups,
        missingSubjects.length
          ? NG.ui.card({
            body: el("div", { class: "stack stack--sm" }, [
              el("label", { class: "check" }, [
                createBox,
                el("span", { text: "Fehlende Fächer anlegen (" + missingSubjects.map(function (s) { return U.truncate(s, 20); }).join(", ") + ")" })
              ]),
              el("div", {
                class: "fs-xs faint",
                text: "Ohne Haken landen diese Themen ohne Fach in den Materialien."
              })
            ])
          })
          : null
      ]));

      if (api.foot) {
        U.clear(api.foot);
        api.foot.appendChild(btn("Verwerfen", "btn", function () { api.close(); }));
        api.foot.appendChild(el("span", { class: "spacer" }));
        api.foot.appendChild(btn("Übernehmen", "btn btn--primary", function () {
          var chosen = {
            themen: data.themen.filter(function (_, i) { return picked.themen[i]; }),
            karteikarten: data.karteikarten.filter(function (_, i) { return picked.karteikarten[i]; }),
            termine: data.termine.filter(function (_, i) { return picked.termine[i]; }),
            aufgaben: data.aufgaben.filter(function (_, i) { return picked.aufgaben[i]; })
          };
          if (!resultCount(chosen)) {
            NG.ui.toast("Es ist gerade nichts ausgewählt.", "warn");
            return;
          }
          var counts = applyResult(chosen, createBox.checked, defaultSubjectId);
          paintDone(counts);
        }, "check"));
      }
    }

    function groupCard(key, title, icon, items, picked, describe) {
      var headBox = el("input", { type: "checkbox", "aria-label": "Alle " + title + " auswählen" });
      headBox.checked = items.length > 0;
      headBox.disabled = !items.length;

      var listHost = el("div", { class: "list" });
      var boxes = [];

      items.forEach(function (item, i) {
        var info = describe(item);
        var box = el("input", { type: "checkbox" });
        box.checked = true;
        box.addEventListener("change", function () {
          picked[key][i] = box.checked;
          syncHead();
        });
        boxes.push(box);

        listHost.appendChild(el("div", { class: "list__item" }, [
          el("label", { class: "check", style: { alignItems: "flex-start", flex: "1 1 auto", minWidth: "0" } }, [
            box,
            el("span", { style: { minWidth: "0" } }, [
              el("div", { class: "list__title", text: info.title }),
              info.meta ? el("div", { class: "list__meta" }, el("span", { text: info.meta })) : null,
              info.text ? el("div", { class: "fs-xs faint", text: info.text }) : null
            ])
          ])
        ]));
      });

      function syncHead() {
        var on = 0;
        picked[key].forEach(function (v) { if (v) on++; });
        headBox.checked = items.length > 0 && on === items.length;
        headBox.indeterminate = on > 0 && on < items.length;
      }

      headBox.addEventListener("change", function () {
        var want = headBox.checked;
        boxes.forEach(function (b, i) { b.checked = want; picked[key][i] = want; });
        headBox.indeterminate = false;
      });

      return NG.ui.card({
        title: null,
        body: el("div", { class: "stack stack--sm" }, [
          el("div", { class: "row row--tight" }, [
            el("label", { class: "check" }, [headBox, el("span", { class: "fw-6", text: title })]),
            el("span", { class: "badge", text: String(items.length) })
          ]),
          items.length
            ? listHost
            : el("div", { class: "fs-sm faint", text: "Dazu hat die KI nichts gefunden." })
        ])
      });
    }

    /* ----- Übernehmen ----- */

    function paintDone(counts) {
      U.clear(body);
      var lines = [];
      if (counts.themen) lines.push(counts.themen + (counts.themen === 1 ? " Thema" : " Themen") + " als Material");
      if (counts.karten) lines.push(counts.karten + (counts.karten === 1 ? " Karteikarte" : " Karteikarten"));
      if (counts.termine) lines.push(counts.termine + (counts.termine === 1 ? " Termin" : " Termine"));
      if (counts.aufgaben) lines.push(counts.aufgaben + (counts.aufgaben === 1 ? " Aufgabe" : " Aufgaben"));
      if (counts.faecher) lines.push(counts.faecher + (counts.faecher === 1 ? " neues Fach" : " neue Fächer"));

      body.appendChild(el("div", { class: "stack stack--sm" }, [
        el("div", { class: "row row--tight" }, [
          el("span", { style: { color: "var(--success)", display: "flex" } }, iconNode("check", 22)),
          el("span", { class: "fw-6", text: "Alles übernommen" })
        ]),
        el("p", { class: "fs-sm muted", text: lines.length ? lines.join(", ") + "." : "Es wurde nichts gespeichert." }),
        counts.deckName
          ? el("p", { class: "fs-xs faint", text: "Die Karten liegen im Stapel „" + counts.deckName + "“." })
          : null
      ]));

      if (api.foot) {
        U.clear(api.foot);
        if (counts.themen) api.foot.appendChild(btn("Materialien", "btn", function () { api.close(); goTo("materials"); }, "folder"));
        if (counts.karten) api.foot.appendChild(btn("Karteikarten", "btn", function () { api.close(); goTo("flashcards"); }, "layers"));
        if (counts.termine) api.foot.appendChild(btn("Termine", "btn", function () { api.close(); goTo("calendar"); }, "calendar"));
        api.foot.appendChild(el("span", { class: "spacer" }));
        api.foot.appendChild(btn("Schließen", "btn btn--primary", function () { api.close(); }));
      }

      NG.ui.toast("Übernommen", "success");
    }

    start();
  }

  /** Schreibt die ausgewählten Teile in den Speicher. */
  function applyResult(chosen, createMissing, defaultSubjectId) {
    var counts = { themen: 0, karten: 0, termine: 0, aufgaben: 0, faecher: 0, deckName: "" };
    var cache = {};

    function resolveSubject(name) {
      var key = normName(name);
      if (!key) return defaultSubjectId || null;
      if (cache[key] !== undefined) return cache[key];
      var found = findSubjectByName(name);
      if (!found && createMissing) {
        var created = NG.store.add("subjects", {
          name: U.truncate(String(name).trim(), 40),
          short: shortOf(name),
          color: NG.store.nextColor(),
          teacher: "",
          room: "",
          weights: { written: 50, oral: 50 },
          archived: false
        });
        counts.faecher++;
        found = created.id;
      }
      cache[key] = found || defaultSubjectId || null;
      return cache[key];
    }

    chosen.themen.forEach(function (t) {
      var text = t.zusammenfassung || "";
      if (t.stichpunkte.length) {
        text += (text ? "\n\n" : "") + t.stichpunkte.map(function (p) { return "- " + p; }).join("\n");
      }
      NG.store.add("materials", {
        name: t.titel,
        subjectId: resolveSubject(t.fach),
        note: "Von der KI aus dem Import erstellt",
        tags: ["Import", "KI"],
        text: text,
        file: null,
        createdAt: new Date().toISOString()
      });
      counts.themen++;
    });

    if (chosen.karteikarten.length) {
      var deckName = "Import " + U.fmtDate(U.todayISO(), { style: "numeric" });
      var deck = NG.store.add("decks", {
        name: deckName,
        subjectId: defaultSubjectId || null
      });
      var today = U.todayISO();
      NG.store.addMany("cards", chosen.karteikarten.map(function (c) {
        return {
          deckId: deck.id,
          front: c.front,
          back: c.back,
          box: 1,
          due: today,
          lapses: 0,
          reps: 0
        };
      }));
      counts.karten = chosen.karteikarten.length;
      counts.deckName = deckName;
    }

    if (chosen.termine.length) {
      NG.store.addMany("events", chosen.termine.map(function (e) {
        return {
          subjectId: defaultSubjectId || null,
          title: e.titel,
          type: e.art,
          date: e.datum,
          time: "",
          endTime: "",
          place: "",
          note: "Aus dem Import übernommen",
          done: false
        };
      }));
      counts.termine = chosen.termine.length;
    }

    if (chosen.aufgaben.length) {
      NG.store.addMany("tasks", chosen.aufgaben.map(function (a) {
        return {
          subjectId: defaultSubjectId || null,
          title: a.titel,
          due: a.faellig || "",
          done: false,
          doneAt: null,
          priority: 2,
          note: "Aus dem Import übernommen"
        };
      }));
      counts.aufgaben = chosen.aufgaben.length;
    }

    return counts;
  }

  /* =========================================================
     TEIL 2 – Aus Dateien
     ========================================================= */

  function openPicker() {
    if (mode !== "files") setMode("files");
    global.setTimeout(function () {
      if (fileInput) fileInput.click();
      else NG.ui.toast("Wechsle kurz auf „Aus Dateien“, dann klappt die Auswahl.", "warn");
    }, 40);
  }

  function filesPane() {
    fileInput = el("input", {
      type: "file", class: "hidden", accept: acceptAttr(), multiple: true,
      "aria-hidden": "true", tabindex: "-1"
    });
    fileInput.addEventListener("change", function () {
      var picked = fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
      fileInput.value = "";
      addFiles(picked);
    });

    var zone = NG.ui.dropzone({
      accept: acceptAttr(),
      multiple: true,
      icon: "upload",
      title: "Dateien hierher ziehen oder auswählen",
      hint: "Word, HTML, Text, Bilder – z. B. ein OneNote-Export über Datei > Exportieren",
      onFiles: addFiles
    });

    var guide = NG.ui.card({
      title: "So kommst du aus OneNote heraus",
      body: el("div", { class: "stack stack--sm" }, [
        noteRow("info", "Am Rechner: In OneNote auf Datei > Exportieren > Abschnitt oder Notizbuch > Word-Dokument."),
        noteRow("info", "Am Tablet: Seite teilen und als Datei sichern – oder Screenshots machen."),
        noteRow("info", "Danach ziehst du die Dateien hier herein. Mehrere auf einmal sind kein Problem.")
      ])
    });

    fileListHost = el("div");
    fileCountNode = el("span", { class: "fs-xs faint" });

    var pane = el("div", { class: "stack" }, [
      zone,
      fileInput,
      guide,
      fileListHost,
      fileActions()
    ]);

    paintFileList();
    return pane;
  }

  function fileActions() {
    var subjectPicker = subjectSelect(fileSubject, function (value) { fileSubject = value; }, "Fach für alle Dateien");

    fileSaveBtn = btn("Als Materialien ablegen", "btn btn--primary", saveFilesAsMaterials, "folder");
    fileAiBtn = btn("Mit KI aufbereiten", "btn", function () {
      var ready = readyFiles();
      if (!ready.length) { NG.ui.toast("Es ist noch keine Datei bereit.", "warn"); return; }
      var sources = ready.filter(function (i) { return String(i.text || "").trim(); }).map(function (i) {
        return { title: baseName(i.name), text: i.text, subjectName: fileSubject ? NG.store.subjectName(fileSubject) : "" };
      });
      var images = ready.filter(function (i) {
        return i.blob && /^image\//i.test(String(i.blob.type || ""));
      }).map(function (i) { return i.blob; }).slice(0, MAX_AI_IMAGES);

      if (!sources.length && !images.length) {
        NG.ui.toast("In diesen Dateien steckt kein Text, den ich lesen kann.", "warn");
        return;
      }
      if (!sources.length) {
        sources = [{ title: "Bilder aus dem Import", text: "(Der Inhalt steckt nur in den Bildern.)", subjectName: "" }];
      }
      prepareWithAi(sources, images, fileSubject || null);
    }, "sparkles");

    var aiReady = NG.ai.status().ready;
    if (!aiReady) fileAiBtn.disabled = true;

    return el("div", {
      class: "stack stack--sm",
      style: {
        position: "sticky", bottom: "0", zIndex: "3",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: "var(--sp-3) var(--sp-4)",
        boxShadow: "var(--shadow-sm)"
      }
    }, [
      el("div", { class: "row row--tight" }, [
        el("span", { class: "fs-xs faint nowrap", text: "Fach für alle:" }),
        subjectPicker,
        fileCountNode,
        el("span", { class: "spacer" }),
        fileSaveBtn,
        fileAiBtn
      ]),
      aiReady ? null : el("div", { class: "row row--tight fs-xs", style: { color: "var(--warn)" } }, [
        iconNode("info", 14),
        el("span", { text: "Für die KI-Aufbereitung fehlt noch die Einrichtung.", style: { flex: "1 1 160px" } }),
        btn("Einstellungen", "btn btn--sm btn--ghost", function () { goTo("settings"); }, "settings")
      ])
    ]);
  }

  function readyFiles() {
    return fileItems.filter(function (i) { return i.status === "ready"; });
  }

  function syncFileBar() {
    var ready = readyFiles().length;
    if (fileCountNode) {
      fileCountNode.textContent = fileItems.length
        ? (ready === 1 ? "1 Datei bereit" : ready + " Dateien bereit")
        : "";
    }
    if (fileSaveBtn) fileSaveBtn.disabled = !ready || savingFiles;
    if (fileAiBtn) fileAiBtn.disabled = !ready || savingFiles || !NG.ai.status().ready;
  }

  function addFiles(files) {
    files = (files || []).filter(Boolean);
    if (!files.length) return;

    files.forEach(function (file) {
      var d = describeFile(file);
      var item = {
        id: U.uid("imp"),
        file: file,
        name: String(file.name || "Datei"),
        size: Number(file.size) || 0,
        kind: d.kind,
        label: d.label,
        supported: d.supported,
        hint: d.hint,
        status: d.supported ? "loading" : "unsupported",
        text: "",
        blob: null,
        warning: "",
        error: ""
      };
      fileItems.push(item);
      if (d.supported) runExtract(item);
    });
    paintFileList();
  }

  function runExtract(item) {
    extractFile(item.file).then(function (res) {
      if (fileItems.indexOf(item) < 0) return;      // schon wieder entfernt
      res = (res && typeof res === "object") ? res : {};
      item.text = String(res.text || "");
      item.blob = res.blob || null;
      item.warning = String(res.warning || "");
      if (res.kind) item.kind = String(res.kind);
      if (res.kind === "unsupported") {
        // Der Leser hat höflich abgelehnt und den Grund mitgeschickt.
        item.status = "unsupported";
        item.hint = item.warning || item.hint;
        item.warning = "";
      } else {
        item.status = (item.text.trim() || item.blob) ? "ready" : "empty";
      }
      paintFileList();
    }, function (err) {
      if (fileItems.indexOf(item) < 0) return;
      item.status = "error";
      item.error = msgOf(err);
      paintFileList();
    });
  }

  function removeFile(item) {
    fileItems = fileItems.filter(function (i) { return i !== item; });
    paintFileList();
  }

  function fileKindIcon(item) {
    if (/^image\//i.test(String(item.file && item.file.type)) || item.kind === "image") return "image";
    if (item.kind === "html") return "link";
    if (item.kind === "text" || item.kind === "markdown") return "message";
    return "file";
  }

  function fileStatusNode(item) {
    if (item.status === "loading") {
      return el("span", { class: "row row--tight" }, [
        el("span", { class: "spinner", style: { width: "13px", height: "13px" } }),
        el("span", { text: "wird gelesen …" })
      ]);
    }
    if (item.status === "unsupported") {
      return el("span", {
        style: { color: "var(--warn)" },
        text: item.hint || "Diese Art von Datei kann ich nicht lesen."
      });
    }
    if (item.status === "error") {
      return el("span", { style: { color: "var(--danger)" }, text: "Fehler: " + U.truncate(item.error, 80) });
    }
    if (item.status === "empty") {
      return el("span", { style: { color: "var(--warn)" }, text: "Kein Text gefunden – die Datei ist wohl leer." });
    }
    var parts = [];
    if (item.text.trim()) parts.push(item.text.trim().length + " Zeichen Text");
    if (item.blob) parts.push("mit Bild");
    return el("span", { style: { color: "var(--success)" }, text: "bereit" + (parts.length ? " · " + parts.join(", ") : "") });
  }

  function fileRow(item) {
    return el("div", { class: "list__item" }, [
      el("span", { class: "icon-badge" }, iconNode(fileKindIcon(item), 20)),
      el("div", { class: "list__main" }, [
        el("div", { class: "list__title", text: item.name }),
        el("div", { class: "list__meta" }, [
          el("span", { text: item.label }),
          item.size ? el("span", { text: U.fmtBytes(item.size) }) : null,
          fileStatusNode(item)
        ]),
        item.warning
          ? el("div", { class: "fs-xs", style: { color: "var(--warn)" }, text: item.warning })
          : null
      ]),
      el("div", { class: "list__actions" }, [
        el("button", {
          type: "button", class: "btn btn--icon",
          "aria-label": "Datei „" + item.name + "“ entfernen", title: "Entfernen",
          html: U.icon("x"),
          onClick: function () { removeFile(item); }
        })
      ])
    ]);
  }

  function paintFileList() {
    if (!fileListHost) return;
    U.clear(fileListHost);

    if (!fileItems.length) {
      fileListHost.appendChild(NG.ui.empty({
        icon: "folder",
        title: "Noch keine Dateien",
        text: "Zieh Word-Dateien, HTML-Seiten, Texte oder Bilder hier herein. "
          + "Ich lese den Inhalt heraus und lege ihn als Material ab.",
        action: { label: "Dateien auswählen", onClick: openPicker }
      }));
      syncFileBar();
      return;
    }

    var list = el("div", { class: "list" });
    fileItems.forEach(function (item) { list.appendChild(fileRow(item)); });
    fileListHost.appendChild(NG.ui.card({ body: list, flush: true }));
    syncFileBar();
  }

  function saveFilesAsMaterials() {
    var ready = readyFiles();
    if (!ready.length) {
      NG.ui.toast("Es ist noch keine Datei bereit.", "warn");
      return;
    }
    if (savingFiles) return;
    savingFiles = true;
    syncFileBar();

    var subjectId = fileSubject || null;
    var done = 0, failed = 0;
    var chain = Promise.resolve();

    ready.forEach(function (item) {
      chain = chain.then(function () {
        return (item.blob ? storeBlob(item.blob, item.name) : Promise.resolve(null))
          .then(function (ref) {
            NG.store.add("materials", {
              name: U.truncate(baseName(item.name), 120),
              subjectId: subjectId,
              note: "Aus Datei-Import",
              tags: ["Import"],
              text: item.text,
              file: ref || null,
              createdAt: new Date().toISOString()
            });
            done++;
          })
          .catch(function (err) {
            failed++;
            NG.ui.toast("„" + U.truncate(item.name, 30) + "“ ging nicht: " + msgOf(err), "error");
          });
      });
    });

    chain.then(function () {
      savingFiles = false;
      if (done) {
        fileItems = fileItems.filter(function (i) { return ready.indexOf(i) < 0; });
        NG.ui.toast(done === 1 ? "1 Material angelegt" : done + " Materialien angelegt", "success");
      } else if (failed) {
        NG.ui.toast("Es konnte leider nichts abgelegt werden.", "error");
      }
      paintFileList();
    }, function (err) {
      savingFiles = false;
      paintFileList();
      NG.ui.toast("Beim Ablegen ist etwas schiefgegangen: " + msgOf(err), "error");
    });
  }

  /* =========================================================
     Ansicht aufbauen
     ========================================================= */

  function subscribeOneNote() {
    if (offChange) { try { offChange(); } catch (e) { /* war schon weg */ } offChange = null; }
    var api = oneApi();
    if (!api || typeof api.onChange !== "function") return;
    try {
      var off = api.onChange(function () {
        if (!paneHost) return;
        resetTree();
        paintPane();
      });
      if (typeof off === "function") offChange = off;
    } catch (e) { /* ohne Benachrichtigung geht es auch */ }
  }

  function render(root, ctx) {
    ctxRef = ctx;

    // Weg aus der Adresse übernehmen: #/import/files
    var param = ctx && ctx.params && ctx.params[0];
    if (param === "files" || param === "dateien") mode = "files";
    else if (param === "onenote") mode = "onenote";

    paneHost = el("div");
    modeHint = el("span", { class: "fs-xs faint nowrap", text: modeHintText() });

    root.appendChild(el("div", { class: "stack" }, [
      el("div", { class: "row row--tight" }, [
        switcher(),
        el("span", { class: "spacer" }),
        modeHint
      ]),
      paneHost
    ]));

    paintPane();
    subscribeOneNote();
  }

  /* ---------- Anmeldung ------------------------------------ */

  NG.app.register({
    id: "import",
    title: "Importieren",
    subtitle: "Schulstoff aus OneNote oder aus Dateien holen",
    icon: "download",
    group: "learn",
    order: 7.5,
    live: false,                 // eigener Zustand (Auswahl, Dateien): wir bauen selbst neu auf
    render: render,

    actions: function () {
      var connected = oneSignedIn();
      return [
        el("span", {
          class: "badge " + (connected ? "badge--success" : "badge--warn"),
          text: connected ? "OneNote verbunden" : "OneNote nicht eingerichtet"
        }),
        btn("Einstellungen", "btn btn--sm", function () { goTo("settings"); }, "settings")
      ];
    },

    primaryAction: function () {
      return { label: "Dateien auswählen", icon: "upload", onClick: openPicker };
    },

    onLeave: function () {
      // Laufende Anfragen stoppen und Verweise lösen, damit nichts in altes DOM schreibt.
      cancelAi();
      if (offChange) { try { offChange(); } catch (e) { /* war schon weg */ } offChange = null; }
      ctxRef = null;
      paneHost = null;
      switchHost = null;
      modeHint = null;
      treeHost = null;
      barCountNode = null;
      barBtn = null;
      secChecks = [];
      fileInput = null;
      fileListHost = null;
      fileSaveBtn = null;
      fileAiBtn = null;
      fileCountNode = null;
    }
  });
})(window);
