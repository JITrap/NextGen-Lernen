/* =========================================================
   NextGen Lernen – Materialien
   Ablage für Arbeitsblätter, Fotos vom Tafelbild und PDFs.
   Mit Vorschau, Suche, Fach-Filter und KI-Auswertung.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  var ACCEPT = "image/*,application/pdf,text/plain";
  var MAX_PX = 1600;                 // Bilder werden vor dem Speichern verkleinert
  var MAX_BYTES = 25 * 1024 * 1024;  // größere Dateien nehmen wir nicht an
  var NO_SUBJECT = "__none";

  /* ---------- Flüchtiger Zustand der Ansicht ----------------
     Lebt nur im Arbeitsspeicher. Die Ansicht ist mit
     `live: false` angemeldet und baut sich selbst neu auf. */

  var query = "";
  var filterSubject = "";        // "" = alle | Fach-Id | NO_SUBJECT
  var viewMode = "grid";         // grid | list
  var uploading = false;
  var pruned = false;            // verwaiste Dateien nur einmal je Sitzung aufräumen

  /* ---------- Verweise auf Teile des DOM -------------------- */

  var ctxRef = null;
  var fileInput = null;
  var searchNode = null;
  var chipHost = null;
  var chipNodes = [];
  var resultHost = null;
  var countNode = null;
  var storageNode = null;
  var progressNode = null;
  var paintToken = 0;            // verhindert, dass alte Ladevorgänge ins neue DOM schreiben

  var aiController = null;       // läuft gerade eine KI-Anfrage?

  /* =========================================================
     Kleine Helfer
     ========================================================= */

  function materials() {
    var list = NG.store.all("materials");
    return Array.isArray(list) ? list : [];
  }

  function nameOf(m) {
    return String((m && m.name) || "").trim() || "Ohne Namen";
  }

  function tagsOf(m) {
    return Array.isArray(m && m.tags) ? m.tags.filter(Boolean).map(String) : [];
  }

  /** Erkennt Bilder am MIME-Typ – und ersatzweise an der Dateiendung. */
  function isImage(m) {
    var f = m && m.file;
    if (!f) return false;
    if (/^image\//i.test(String(f.type || ""))) return true;
    return /\.(jpe?g|png|gif|webp|bmp|heic|avif)$/i.test(String(f.name || m.name || ""));
  }

  function isPdf(m) {
    var f = m && m.file;
    if (!f) return false;
    if (/pdf/i.test(String(f.type || ""))) return true;
    return /\.pdf$/i.test(String(f.name || m.name || ""));
  }

  function kindLabel(m) {
    if (!m || !m.file) return "Nur Text";
    if (isImage(m)) return "Bild";
    if (isPdf(m)) return "PDF";
    if (/^text\//i.test(String(m.file.type || ""))) return "Textdatei";
    return "Datei";
  }

  function kindIcon(m) {
    if (!m || !m.file) return "message";
    if (isImage(m)) return "image";
    return "file";
  }

  function sizeLabel(m) {
    if (!m || !m.file || !m.file.size) return "";
    return U.fmtBytes(m.file.size);
  }

  function msgOf(err) {
    if (!err) return "Unbekannter Fehler";
    return String(err.message || err.name || err);
  }

  function parseTags(text) {
    var seen = {};
    return String(text || "")
      .split(",")
      .map(function (t) { return t.trim(); })
      .filter(function (t) {
        if (!t) return false;
        var key = t.toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .map(function (t) { return U.truncate(t, 30); })
      .slice(0, 12);
  }

  /** Dateiname für den Download – mit passender Endung. */
  function downloadName(m) {
    var base = nameOf(m).replace(/[\\/:*?"<>|]+/g, "-");
    var orig = String((m.file && m.file.name) || "");
    var ext = (orig.match(/\.[a-z0-9]{1,6}$/i) || [""])[0];
    if (!ext) {
      var type = String((m.file && m.file.type) || "");
      if (/jpe?g/i.test(type)) ext = ".jpg";
      else if (/png/i.test(type)) ext = ".png";
      else if (/webp/i.test(type)) ext = ".webp";
      else if (/gif/i.test(type)) ext = ".gif";
      else if (/pdf/i.test(type)) ext = ".pdf";
      else if (/^text\//i.test(type)) ext = ".txt";
    }
    if (ext && base.toLowerCase().slice(-ext.length) === ext.toLowerCase()) ext = "";
    return base + ext;
  }

  function iconNode(name, px) {
    var node = U.iconEl(name);
    if (node && node.style && px) { node.style.width = px + "px"; node.style.height = px + "px"; }
    return node;
  }

  function textButton(icon, label, cls, onClick) {
    return el("button", {
      type: "button",
      class: cls || "btn btn--sm",
      html: U.icon(icon) + "<span>" + U.escapeHtml(label) + "</span>",
      onClick: onClick
    });
  }

  /* =========================================================
     Suchen & Filtern
     ========================================================= */

  function matchesQuery(m, q) {
    if (!q) return true;
    var haystack = [
      nameOf(m),
      String(m.note || ""),
      tagsOf(m).join(" ")
    ].join(" ").toLowerCase();
    return haystack.indexOf(q) >= 0;
  }

  function matchesSubject(m) {
    if (!filterSubject) return true;
    if (filterSubject === NO_SUBJECT) return !m.subjectId;
    return m.subjectId === filterSubject;
  }

  function filtered() {
    var q = String(query || "").trim().toLowerCase();
    var list = materials().filter(function (m) {
      return m && matchesSubject(m) && matchesQuery(m, q);
    });
    return U.sortBy(list, function (m) { return String(m.createdAt || ""); }, "desc");
  }

  /* =========================================================
     Hochladen
     ========================================================= */

  function openPicker() {
    if (fileInput) { fileInput.click(); return; }
    NG.ui.toast("Wechsle kurz zu den Materialien, dann klappt das Hochladen.", "warn");
  }

  function setProgress(text) {
    if (!progressNode) return;
    progressNode.textContent = text || "";
    progressNode.classList.toggle("hidden", !text);
  }

  /** Eine einzelne Datei verkleinern, ablegen und als Material speichern. */
  function saveOne(file, subjectId) {
    var prepare = /^image\//i.test(String(file.type || ""))
      ? U.shrinkImage(file, MAX_PX)
      : Promise.resolve(file);

    return prepare.then(function (blob) {
      return NG.files.put(blob || file, { name: file.name || "Datei" });
    }).then(function (ref) {
      if (!ref) throw new Error("Die Datei konnte nicht abgelegt werden.");
      NG.store.add("materials", {
        name: U.truncate(String(file.name || "Datei").replace(/\.[a-z0-9]{1,6}$/i, ""), 70) || "Datei",
        subjectId: subjectId || null,          // aktueller Fach-Filter, sonst ohne Fach
        file: ref,
        tags: [],
        note: "",
        text: "",
        createdAt: new Date().toISOString()
      });
      return true;
    });
  }

  function handleFiles(files) {
    files = (files || []).filter(Boolean);
    if (!files.length) return;

    if (uploading) {
      NG.ui.toast("Ich speichere gerade noch – einen kleinen Moment bitte.", "warn");
      return;
    }

    var tooBig = files.filter(function (f) { return f.size > MAX_BYTES; });
    files = files.filter(function (f) { return f.size <= MAX_BYTES; });
    if (tooBig.length) {
      NG.ui.toast(tooBig.length === 1
        ? "„" + U.truncate(tooBig[0].name || "Datei", 30) + "“ ist zu groß (über " + U.fmtBytes(MAX_BYTES) + ")."
        : tooBig.length + " Dateien sind zu groß (über " + U.fmtBytes(MAX_BYTES) + ").", "error");
    }
    if (!files.length) return;

    uploading = true;
    var target = (filterSubject && filterSubject !== NO_SUBJECT) ? filterSubject : null;
    var total = files.length;
    var done = 0, failed = 0;

    NG.ui.toast(total === 1
      ? "„" + U.truncate(files[0].name || "Datei", 40) + "“ wird gespeichert …"
      : total + " Dateien werden gespeichert …");
    setProgress("Datei 1 von " + total + " wird gespeichert …");

    var chain = Promise.resolve();
    files.forEach(function (file, i) {
      chain = chain.then(function () {
        setProgress("Datei " + (i + 1) + " von " + total + " wird gespeichert …");
        return saveOne(file, target).then(function () {
          done++;
        }, function (err) {
          failed++;
          NG.ui.toast("„" + U.truncate(file.name || "Datei", 30) + "“ ging nicht: " + msgOf(err), "error");
        });
      });
    });

    chain.then(function () {
      uploading = false;
      setProgress("");
      refresh();
      if (done) {
        NG.ui.toast(done === 1 ? "Material gespeichert" : done + " Materialien gespeichert", "success");
      } else if (failed) {
        NG.ui.toast("Es konnte leider nichts gespeichert werden.", "error");
      }
    }, function (err) {
      uploading = false;
      setProgress("");
      refresh();
      NG.ui.toast("Beim Hochladen ist etwas schiefgegangen: " + msgOf(err), "error");
    });
  }

  /* =========================================================
     Hinweis zum Speicherort
     ========================================================= */

  var STORAGE_INFO = {
    memory: {
      icon: "alert",
      color: "var(--danger)",
      text: "Achtung: Deine Dateien liegen gerade nur im Arbeitsspeicher und sind nach dem Schließen "
        + "der Seite weg. Öffne die Seite am besten über einen kleinen lokalen Server "
        + "(z. B. „python3 -m http.server“) statt per Doppelklick – dann bleiben sie erhalten."
    },
    indexeddb: {
      icon: "info",
      color: "var(--text-faint)",
      text: "Deine Dateien liegen nur in diesem Browser auf diesem Gerät. "
        + "Auf dem Handy oder in einem anderen Browser sind sie nicht zu sehen."
    },
    artifact: {
      icon: "check",
      color: "var(--success)",
      text: "Deine Dateien sind sicher gespeichert und bleiben dir erhalten."
    }
  };

  function paintStorageNote() {
    if (!storageNode) return;
    var kind = "indexeddb";
    try { kind = NG.files.storageKind() || "indexeddb"; } catch (e) { /* Standardtext genügt */ }
    var info = STORAGE_INFO[kind] || STORAGE_INFO.indexeddb;

    U.clear(storageNode);
    storageNode.style.color = info.color;
    storageNode.style.alignItems = "flex-start";
    storageNode.appendChild(iconNode(info.icon, 15));
    storageNode.appendChild(el("span", { text: info.text, style: { flex: "1 1 220px", minWidth: "0" } }));
  }

  /** Verwaiste Dateien aufräumen – nebenbei wird dabei die Speicherart klar. */
  function probeStorage() {
    if (pruned || uploading) { paintStorageNote(); return; }
    pruned = true;
    var check = null;
    try { check = NG.files.prune(); } catch (e) { check = null; }
    if (check && typeof check.then === "function") {
      check.then(function () { paintStorageNote(); }, function () { paintStorageNote(); });
    } else {
      paintStorageNote();
    }
  }

  /* =========================================================
     Kopfbereich: Dropzone + Werkzeugleiste
     ========================================================= */

  function uploadSection() {
    fileInput = el("input", {
      type: "file", class: "hidden", accept: ACCEPT, multiple: true,
      "aria-hidden": "true", tabindex: "-1"
    });
    fileInput.addEventListener("change", function () {
      var picked = fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
      fileInput.value = "";
      handleFiles(picked);
    });

    var zone = NG.ui.dropzone({
      accept: ACCEPT,
      multiple: true,
      icon: "upload",
      title: "Dateien hochladen oder hierher ziehen",
      hint: "Fotos vom Tafelbild, Arbeitsblätter, PDFs oder Textdateien – gern mehrere auf einmal.",
      onFiles: handleFiles
    });

    progressNode = el("div", { class: "fs-xs muted hidden" });
    storageNode = el("div", { class: "row row--tight fs-xs" });

    return el("div", { class: "stack stack--sm" }, [
      zone,
      fileInput,
      progressNode,
      storageNode
    ]);
  }

  function chip(label, value, color) {
    var node = el("button", {
      type: "button", class: "chip",
      "aria-pressed": filterSubject === value ? "true" : "false",
      onClick: function () {
        filterSubject = filterSubject === value ? "" : value;
        syncChips();
        paintResults();
      }
    }, [
      color ? el("span", { class: "subject-dot", style: { background: color } }) : null,
      el("span", { text: label })
    ]);
    chipNodes.push({ value: value, node: node });
    return node;
  }

  function syncChips() {
    chipNodes.forEach(function (c) {
      c.node.setAttribute("aria-pressed", filterSubject === c.value ? "true" : "false");
    });
  }

  function paintChips() {
    if (!chipHost) return;
    U.clear(chipHost);
    chipNodes = [];

    var list = materials();
    var subs = NG.store.activeSubjects();
    var used = {};
    var withoutSubject = false;
    list.forEach(function (m) {
      if (m.subjectId) used[m.subjectId] = true;
      else withoutSubject = true;
    });

    chipHost.appendChild(chip("Alle", ""));

    subs.forEach(function (s) {
      // Fächer ohne Material nur zeigen, wenn gerade danach gefiltert wird
      if (!used[s.id] && filterSubject !== s.id) return;
      chipHost.appendChild(chip(s.short || s.name, s.id, s.color));
    });

    // Fächer, die es nicht mehr gibt, aber noch Material haben
    Object.keys(used).forEach(function (id) {
      var known = subs.some(function (s) { return s.id === id; });
      if (known) return;
      var sub = NG.store.subject(id);
      if (sub) chipHost.appendChild(chip(sub.short || sub.name, id, sub.color));
    });

    if (withoutSubject || filterSubject === NO_SUBJECT) {
      chipHost.appendChild(chip("Ohne Fach", NO_SUBJECT));
    }
  }

  function modeButton(id, label, icon) {
    return el("button", {
      type: "button",
      "aria-pressed": viewMode === id ? "true" : "false",
      "aria-label": label,
      title: label,
      onClick: function (e) {
        viewMode = id;
        var group = e.currentTarget.parentNode;
        U.$$("button", group).forEach(function (b) {
          b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false");
        });
        paintResults();
      }
    }, [iconNode(icon, 15), el("span", { text: label })]);
  }

  function toolbar() {
    var search = el("input", {
      type: "search",
      placeholder: "Suchen …",
      "aria-label": "Materialien durchsuchen",
      style: { flex: "1 1 180px", minWidth: "140px", maxWidth: "320px" }
    });
    search.value = query;
    searchNode = search;
    var soon = U.debounce(function () { paintResults(); }, 170);
    search.addEventListener("input", function () {
      query = search.value;
      soon();
    });

    chipHost = el("div", {
      class: "row row--tight",
      style: { flex: "1 1 200px", minWidth: "0" },
      role: "group", "aria-label": "Nach Fach filtern"
    });

    countNode = el("span", { class: "fs-xs faint nowrap" });

    var group = el("div", { class: "btn-group", role: "group", "aria-label": "Ansicht wählen" }, [
      modeButton("grid", "Raster", "grid"),
      modeButton("list", "Liste", "list")
    ]);

    return el("div", { class: "row" }, [search, chipHost, countNode, el("span", { class: "spacer" }), group]);
  }

  /* =========================================================
     Raster-Ansicht
     ========================================================= */

  function fallbackTile(host, m) {
    U.clear(host);
    host.className = "";
    Object.assign(host.style, {
      width: "100%", height: "100%",
      background: "var(--surface-3)",
      color: "var(--text-faint)",
      display: "grid", placeItems: "center"
    });
    host.appendChild(iconNode(m && !m.file ? "message" : "file", 40));
  }

  function thumbFor(m) {
    var token = paintToken;
    var label = nameOf(m);

    var media = el("div", { style: { width: "100%", height: "100%" } });

    if (isImage(m)) {
      media.className = "skeleton";
      NG.files.url(m.file).then(function (src) {
        if (token !== paintToken) return;
        if (!src) { fallbackTile(media, m); return; }
        var img = el("img", { src: src, alt: "Vorschau von " + label, loading: "lazy" });
        img.addEventListener("error", function () { fallbackTile(media, m); });
        media.className = "";
        U.clear(media);
        media.appendChild(img);
      }, function () {
        if (token !== paintToken) return;
        fallbackTile(media, m);
      });
    } else {
      fallbackTile(media, m);
    }

    return el("button", {
      type: "button",
      class: "thumb",
      title: label,
      "aria-label": "Material öffnen: " + label,
      style: { padding: "0", cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left" },
      onClick: function () { openDetail(m.id); }
    }, [
      media,
      el("span", { class: "thumb__label", text: label })
    ]);
  }

  function gridView(list) {
    var grid = el("div", { class: "thumb-grid" });
    list.forEach(function (m) { grid.appendChild(thumbFor(m)); });
    return grid;
  }

  /* =========================================================
     Listen-Ansicht
     ========================================================= */

  function rowFor(m) {
    var label = nameOf(m);
    var meta = el("div", { class: "list__meta" }, [
      NG.ui.subjectTag(m.subjectId || null, { short: false }),
      el("span", { text: U.fmtDate(m.createdAt, { style: "numeric" }) }),
      el("span", { text: kindLabel(m) + (sizeLabel(m) ? " · " + sizeLabel(m) : "") }),
      m.text ? el("span", { class: "badge badge--accent", text: "KI-Auswertung" }) : null
    ]);

    tagsOf(m).slice(0, 3).forEach(function (t) {
      meta.appendChild(el("span", { class: "badge", text: t }));
    });

    var open = el("button", {
      type: "button",
      class: "list__main",
      style: {
        background: "none", border: "0", padding: "0", font: "inherit",
        color: "inherit", textAlign: "left", cursor: "pointer"
      },
      onClick: function () { openDetail(m.id); }
    }, [
      el("div", { class: "list__title", text: label }),
      meta
    ]);

    var actions = el("div", { class: "list__actions" }, [
      m.file ? el("button", {
        type: "button", class: "btn btn--icon", "aria-label": "Herunterladen", title: "Herunterladen",
        html: U.icon("download"),
        onClick: function () { downloadMaterial(m); }
      }) : null,
      el("button", {
        type: "button", class: "btn btn--icon", "aria-label": "Löschen", title: "Löschen",
        html: U.icon("trash"),
        onClick: function () { deleteMaterial(m); }
      })
    ]);

    return el("div", { class: "list__item" }, [
      el("span", { class: "icon-badge" }, iconNode(kindIcon(m), 20)),
      open,
      actions
    ]);
  }

  function listView(list) {
    var wrap = el("div", { class: "list" });
    list.forEach(function (m) { wrap.appendChild(rowFor(m)); });
    return NG.ui.card({ body: wrap, flush: true });
  }

  /* =========================================================
     Ergebnisbereich
     ========================================================= */

  function paintCount(shown, total) {
    if (!countNode) return;
    if (!total) { countNode.textContent = ""; return; }
    countNode.textContent = shown === total
      ? (total === 1 ? "1 Material" : total + " Materialien")
      : shown + " von " + total + " werden gezeigt";
  }

  function paintResults() {
    if (!resultHost) return;
    paintToken++;
    U.clear(resultHost);

    var total = materials().length;
    var list = filtered();
    paintCount(list.length, total);

    if (!total) {
      resultHost.appendChild(NG.ui.empty({
        icon: "folder",
        title: "Noch keine Materialien",
        text: "Lade Arbeitsblätter, Fotos vom Tafelbild oder PDFs hoch. "
          + "Danach kannst du sie durchsuchen – und die KI Aufgaben daraus lösen lassen.",
        action: { label: "Hochladen", onClick: openPicker }
      }));
      return;
    }

    if (!list.length) {
      resultHost.appendChild(NG.ui.empty({
        icon: "search",
        title: "Dazu finde ich nichts",
        text: "Zu deiner Suche oder dem gewählten Fach passt gerade kein Material.",
        action: {
          label: "Filter zurücksetzen",
          onClick: function () {
            query = "";
            filterSubject = "";
            if (searchNode) searchNode.value = "";
            refresh();
          }
        }
      }));
      return;
    }

    resultHost.appendChild(viewMode === "list" ? listView(list) : gridView(list));
  }

  function refresh() {
    paintChips();
    syncChips();
    paintResults();
    paintStorageNote();
  }

  /* =========================================================
     Herunterladen & Löschen
     ========================================================= */

  function downloadMaterial(m) {
    if (!m.file) {
      NG.ui.toast("Zu diesem Material gehört keine Datei.", "warn");
      return;
    }
    NG.files.get(m.file).then(function (blob) {
      if (!blob) {
        NG.ui.toast("Die Datei ist nicht mehr da. Vielleicht wurde der Browser-Speicher geleert.", "error");
        return;
      }
      U.downloadBlob(blob, downloadName(m));
    }, function (err) {
      NG.ui.toast("Herunterladen ging nicht: " + msgOf(err), "error");
    });
  }

  /** @returns {Promise<boolean>} true, wenn wirklich gelöscht wurde. */
  function deleteMaterial(m) {
    return NG.ui.confirm({
      title: "Material löschen?",
      message: "„" + nameOf(m) + "“ wird dauerhaft entfernt – die Datei dazu ebenfalls.",
      confirmText: "Löschen",
      danger: true
    }).then(function (yes) {
      if (!yes) return false;
      var ref = m.file;
      NG.store.remove("materials", m.id);
      if (ref) {
        try {
          var p = NG.files.del(ref);
          if (p && typeof p.catch === "function") p.catch(function () { /* Datei war schon weg */ });
        } catch (e) { /* Datei war schon weg */ }
      }
      refresh();
      NG.ui.toast("Material gelöscht", "success");
      return true;
    });
  }

  /* =========================================================
     KI-Aktionen
     ========================================================= */

  var AI_ACTIONS = [
    {
      id: "solve",
      label: "Aufgaben lösen",
      icon: "sparkles",
      tier: "complex",
      busy: "Ich schaue mir die Aufgaben an …",
      extra: "Die Schülerin/der Schüler hat ein Foto von Schulaufgaben hochgeladen und möchte sie verstehen.",
      prompt: "Auf dem Bild siehst du Schulaufgaben. Löse alle Aufgaben, die du erkennen kannst.\n\n"
        + "- Schreibe zu jeder Aufgabe die Nummer dazu.\n"
        + "- Erkläre den Lösungsweg Schritt für Schritt, so dass man ihn wirklich versteht.\n"
        + "- Hebe das Ergebnis jeder Aufgabe deutlich hervor.\n"
        + "- Wenn etwas unlesbar ist, sage das ehrlich, statt zu raten."
    },
    {
      id: "summary",
      label: "Zusammenfassen",
      icon: "file",
      tier: "default",
      busy: "Ich fasse zusammen …",
      extra: "Die Schülerin/der Schüler bereitet sich auf eine Arbeit vor und braucht eine kurze Zusammenfassung.",
      prompt: "Fasse den Inhalt des Bildes (Hefteintrag, Buchseite oder Arbeitsblatt) zum Lernen zusammen.\n\n"
        + "- Beginne mit einer Überschrift und zwei Sätzen, worum es überhaupt geht.\n"
        + "- Danach die wichtigsten Punkte als kurze Stichpunkte.\n"
        + "- Erkläre Fachbegriffe in einfachen Worten.\n"
        + "- Zum Schluss drei mögliche Prüfungsfragen mit kurzen Antworten."
    },
    {
      id: "cards",
      label: "Karteikarten erstellen",
      icon: "layers",
      tier: "quick",
      busy: "Ich baue Karteikarten …",
      extra: "Die Schülerin/der Schüler möchte den Inhalt mit Karteikarten lernen.",
      prompt: "Mache aus dem Inhalt des Bildes Karteikarten zum Lernen.\n\n"
        + "- Erstelle 8 bis 15 Karten.\n"
        + "- Schreibe jede Karte genau so:\n"
        + "  **Vorderseite:** kurze Frage\n"
        + "  **Rückseite:** knappe Antwort\n"
        + "- Immer nur eine Sache pro Karte, kurze Sätze.\n"
        + "- Keine Einleitung und kein Schlusswort, nur die Karten."
    }
  ];

  function buildPrompt(action, m) {
    var lines = [action.prompt, "", "Zusatzangaben zum Material:", "- Name: " + nameOf(m)];
    if (m.subjectId) lines.push("- Fach: " + NG.store.subjectName(m.subjectId));
    var tags = tagsOf(m);
    if (tags.length) lines.push("- Schlagwörter: " + tags.join(", "));
    var note = String(m.note || "").trim();
    if (note) lines.push("- Notiz dazu: " + U.truncate(note, 400));
    return lines.join("\n");
  }

  function cancelAi() {
    if (!aiController) return;
    try { aiController.abort(); } catch (e) { /* war schon beendet */ }
    aiController = null;
  }

  /* =========================================================
     Detail-Dialog
     ========================================================= */

  function openDetail(id) {
    var m = NG.store.find("materials", id);
    if (!m) {
      NG.ui.toast("Dieses Material gibt es nicht mehr.", "error");
      refresh();
      return;
    }

    var closed = false;
    var api = null;
    var alive = function () { return !closed; };

    /* ----- Vorschau ----- */
    var preview = el("div", {
      style: {
        borderRadius: "var(--radius)", border: "1px solid var(--border)",
        background: "var(--surface-2)", padding: "var(--sp-2)",
        display: "grid", placeItems: "center", minHeight: "120px"
      }
    });

    if (isImage(m)) {
      preview.appendChild(el("div", { class: "skeleton", style: { width: "100%", height: "220px" } }));
      NG.files.url(m.file).then(function (src) {
        if (!alive()) return;
        U.clear(preview);
        if (!src) { preview.appendChild(missingFileNote()); return; }
        var img = el("img", {
          src: src, alt: "Vorschau von " + nameOf(m),
          style: {
            maxWidth: "100%", maxHeight: "52vh", objectFit: "contain",
            display: "block", borderRadius: "var(--radius-sm)"
          }
        });
        img.addEventListener("error", function () {
          if (!alive()) return;
          U.clear(preview);
          preview.appendChild(missingFileNote());
        });
        preview.appendChild(img);
      }, function () {
        if (!alive()) return;
        U.clear(preview);
        preview.appendChild(missingFileNote());
      });
    } else {
      preview.appendChild(el("div", { class: "stack stack--sm center", style: { padding: "var(--sp-5)" } }, [
        el("div", { style: { color: "var(--text-faint)" } }, iconNode(kindIcon(m), 44)),
        el("div", { class: "fw-6", text: m.file ? kindLabel(m) : "Material ohne Datei" }),
        el("div", {
          class: "fs-sm muted",
          text: m.file
            ? "Diese Datei kann ich hier nicht anzeigen. Lade sie herunter, um sie anzusehen."
            : "Zu diesem Material gehört keine Datei – nur der Text weiter unten."
        })
      ]));
    }

    function missingFileNote() {
      return el("div", { class: "stack stack--sm center", style: { padding: "var(--sp-5)" } }, [
        el("div", { style: { color: "var(--text-faint)" } }, iconNode("alert", 36)),
        el("div", { class: "fs-sm muted", text: "Die Datei ist nicht mehr auffindbar. Vielleicht wurde der Browser-Speicher geleert." })
      ]);
    }

    /* ----- Kurzinfos ----- */
    var infoRow = el("div", { class: "row row--tight fs-xs faint" }, [
      el("span", { text: kindLabel(m) }),
      sizeLabel(m) ? el("span", { text: "· " + sizeLabel(m) }) : null,
      el("span", { text: "· hinzugefügt " + U.fmtDate(m.createdAt, { style: "numeric" }) })
    ]);

    /* ----- KI-Bereich ----- */
    var aiStatus = el("div", { class: "row row--tight fs-sm muted" });
    var aiMd = el("div", { class: "md" });
    var aiFoot = el("div", { class: "row row--tight hidden" });
    var aiOut = el("div", {
      class: "stack stack--sm hidden",
      style: {
        border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: "var(--sp-4)", background: "var(--surface-2)"
      }
    }, [aiStatus, aiMd, aiFoot]);

    var aiButtons = [];
    var cancelBtn = textButton("x", "Abbrechen", "btn btn--sm btn--danger hidden", function () { cancelAi(); });
    var aiSection = buildAiSection();

    /* ----- Bereits ausgewertet ----- */
    var doneSection = el("div", { class: "stack stack--sm" });
    if (String(m.text || "").trim()) {
      doneSection.appendChild(el("div", { class: "section-title", style: { margin: "0" }, text: "Bereits ausgewertet" }));
      doneSection.appendChild(NG.ui.mdBlock(String(m.text)));
    }

    /* ----- Formular ----- */
    var form = NG.ui.buildForm([
      { name: "name", label: "Name", required: true, full: true, placeholder: "z. B. Arbeitsblatt Bruchrechnen" },
      { name: "subjectId", label: "Fach", type: "select", nullable: true, options: NG.ui.subjectOptions({ allowNone: true }) },
      { name: "tags", label: "Schlagwörter", placeholder: "z. B. Kapitel 3, Vokabeln", hint: "Mehrere mit Komma trennen" },
      { name: "note", label: "Notiz", type: "textarea", rows: 3, full: true, placeholder: "Worum geht es hier? Was willst du dir merken?" }
    ], {
      name: nameOf(m),
      subjectId: m.subjectId || "",
      tags: tagsOf(m).join(", "),
      note: String(m.note || "")
    });

    var saveBtn = textButton("save", "Speichern", "btn btn--primary btn--sm", function () {
      if (!form.validate()) return;
      var v = form.read();
      var newName = String(v.name || "").trim() || nameOf(m);
      NG.store.update("materials", m.id, {
        name: U.truncate(newName, 120),
        subjectId: v.subjectId || null,
        tags: parseTags(v.tags),
        note: String(v.note || "").trim()
      });
      var head = api && api.el ? api.el.querySelector(".modal__head h2") : null;
      if (head) head.textContent = U.truncate(newName, 60);
      NG.ui.toast("Gespeichert", "success");
      refresh();
    });

    // Enter im Textfeld speichert – wie man es aus anderen Dialogen kennt.
    form.el.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.shiftKey) return;
      if (e.target && e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      saveBtn.click();
    });

    var editSection = el("div", { class: "stack stack--sm" }, [
      el("div", { class: "section-title", style: { margin: "0" }, text: "Angaben bearbeiten" }),
      form.el,
      el("div", { class: "row row--tight" }, [saveBtn])
    ]);

    var body = el("div", { class: "stack" }, [
      preview,
      infoRow,
      aiSection,
      aiOut,
      doneSection,
      editSection
    ]);

    var footActions = [
      m.file ? {
        label: "Herunterladen",
        onClick: function () { downloadMaterial(m); }
      } : null,
      {
        label: "Löschen", variant: "danger",
        onClick: function () {
          deleteMaterial(m).then(function (removed) {
            if (removed && api) api.close();
          });
        }
      },
      "spacer",
      { label: "Schließen", variant: "primary", onClick: function () { if (api) api.close(); } }
    ].filter(Boolean);

    api = NG.ui.modal({
      title: U.truncate(nameOf(m), 60),
      wide: true,
      body: body,
      actions: footActions,
      onClose: function () {
        closed = true;
        cancelAi();
      }
    });

    /* ----- Aufbau der KI-Knopfreihe ----- */
    function buildAiSection() {
      var st = NG.ai.status();

      if (!isImage(m)) {
        // KI-Aktionen brauchen ein Bild – bei PDFs und Textdateien geht das hier nicht.
        if (!m.file) return el("div", { class: "hidden" });
        return el("div", { class: "fs-xs faint", text: "KI-Aktionen gibt es nur für Bilder. Mache zur Not ein Foto von der Seite und lade es hoch." });
      }

      if (!st.ready) {
        return el("div", { class: "row row--tight fs-sm muted" }, [
          iconNode("info", 15),
          el("span", { text: "Die KI ist noch nicht eingerichtet – dann kann ich aus diesem Bild nichts lesen.", style: { flex: "1 1 200px" } }),
          textButton("settings", "Einstellungen", "btn btn--sm", function () {
            if (api) api.close();
            if (ctxRef && ctxRef.go) ctxRef.go("settings");
            else NG.app.go("settings");
          })
        ]);
      }

      var row = el("div", { class: "row row--tight" }, [
        el("span", { class: "fs-xs faint nowrap", text: "Mit KI:" })
      ]);
      AI_ACTIONS.forEach(function (action) {
        var btn = textButton(action.icon, action.label, "btn btn--sm", function () { startAi(action); });
        aiButtons.push(btn);
        row.appendChild(btn);
      });
      row.appendChild(cancelBtn);
      return row;
    }

    function setBusy(busy, label) {
      aiButtons.forEach(function (b) { b.disabled = busy; });
      cancelBtn.classList.toggle("hidden", !busy);
      U.clear(aiStatus);
      if (busy) {
        aiStatus.appendChild(el("span", { class: "spinner" }));
        aiStatus.appendChild(el("span", { text: label || "Denkt nach …" }));
      } else if (label) {
        aiStatus.appendChild(el("span", { text: label }));
      }
      aiStatus.classList.toggle("hidden", !busy && !label);
    }

    function startAi(action) {
      var st = NG.ai.status();
      if (!st.ready) {
        NG.ui.toast("Richte zuerst die KI in den Einstellungen ein.", "warn");
        return;
      }
      if (aiController) return;              // es läuft schon etwas
      if (!m.file) {
        NG.ui.toast("Zu diesem Material gehört keine Datei.", "warn");
        return;
      }
      if (!st.canImages) {
        NG.ui.toast("Bilder werden hier vielleicht nicht angenommen. Ich versuche es trotzdem.", "warn");
      }

      var controller = new AbortController();
      aiController = controller;

      doneSection.classList.add("hidden");   // die frische Antwort ersetzt die alte
      aiOut.classList.remove("hidden");
      aiFoot.classList.add("hidden");
      U.clear(aiFoot);
      aiMd.innerHTML = "";
      setBusy(true, action.busy);

      var prompt = buildPrompt(action, m);
      var answer = "";

      NG.files.get(m.file).then(function (blob) {
        if (!blob) throw new Error("Die Datei konnte nicht geladen werden.");
        if (controller.signal.aborted) throw { code: "cancelled" };
        return NG.ai.run({
          system: NG.ai.systemPrompt(action.extra),
          prompt: prompt,
          images: [blob],
          signal: controller.signal,
          tier: action.tier,
          onText: function (update) {
            if (!update || !alive() || aiController !== controller) return;
            answer = update.text || "";
            aiMd.innerHTML = U.md(answer);
          }
        });
      }).then(function (res) {
        aiController = null;
        var text = String((res && res.text) || answer || "").trim();
        if (!alive()) return;

        if (!text) {
          setBusy(false, "Es kam keine Antwort zurück. Versuche es bitte noch einmal.");
          return;
        }

        aiMd.innerHTML = U.md(text);
        setBusy(false, "");

        NG.store.update("materials", m.id, { text: text });
        NG.ai.logRun({
          kind: "material-" + action.id,
          title: action.label + ": " + nameOf(m),
          prompt: prompt,
          result: text,
          subjectId: m.subjectId || null
        });

        U.clear(aiFoot);
        aiFoot.appendChild(textButton("copy", "Kopieren", "btn btn--sm btn--ghost", function () {
          NG.ui.copyText(text);
        }));
        aiFoot.appendChild(el("span", { class: "fs-xs faint", text: "Beim Material gespeichert." }));
        aiFoot.classList.remove("hidden");

        NG.ui.toast("Fertig: " + action.label, "success");
        refresh();
      }, function (err) {
        aiController = null;
        if (!alive()) return;
        var aborted = !!err && (err.name === "AbortError" || err.code === "cancelled");
        var text = NG.ai.friendly(err);
        setBusy(false, aborted ? "Abgebrochen." : text);
        if (!aborted) NG.ui.toast(text, "error");
      });
    }
  }

  /* =========================================================
     Ansicht aufbauen
     ========================================================= */

  function render(root, ctx) {
    ctxRef = ctx;
    chipNodes = [];

    // Fach aus der Adresse übernehmen: #/materials/<fachId>
    var param = ctx && ctx.params && ctx.params[0];
    if (param) {
      if (param === NO_SUBJECT || NG.store.subject(param)) filterSubject = param;
    }
    if (filterSubject && filterSubject !== NO_SUBJECT && !NG.store.subject(filterSubject)) {
      filterSubject = "";
    }

    resultHost = el("div");

    root.appendChild(el("div", { class: "stack" }, [
      uploadSection(),
      toolbar(),
      resultHost
    ]));

    paintChips();
    paintResults();
    paintStorageNote();
    probeStorage();
  }

  /* ---------- Anmeldung ------------------------------------- */

  NG.app.register({
    id: "materials",
    title: "Materialien",
    subtitle: "Arbeitsblätter, Fotos und PDFs an einem Ort",
    icon: "folder",
    group: "learn",
    order: 8,
    live: false,                 // eigener Zustand (Suche, Filter): wir bauen selbst neu auf
    render: render,

    actions: function () {
      return [textButton("upload", "Hochladen", "btn btn--sm btn--primary", openPicker)];
    },

    primaryAction: function () {
      return { label: "Hochladen", icon: "upload", onClick: openPicker };
    },

    onLeave: function () {
      // Laufende Anfragen stoppen und Verweise lösen, damit nichts in altes DOM schreibt.
      cancelAi();
      paintToken++;
      ctxRef = null;
      fileInput = null;
      searchNode = null;
      chipHost = null;
      chipNodes = [];
      resultHost = null;
      countNode = null;
      storageNode = null;
      progressNode = null;
    }
  });
})(window);
