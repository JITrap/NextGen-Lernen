/* =========================================================
   NextGen Lernen – KI-Assistent
   Herzstück der App: fotografierte Aufgaben hochladen und
   von der KI lösen, erklären, zusammenfassen oder in
   Karteikarten verwandeln lassen.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Werkzeuge (Modi) -----------------------------
     `images: true`  → Bild-Auswahl wird angezeigt
     `needsText: true` → ohne Text im Feld geht es nicht los
     `json: true`    → Antwort kommt als JSON zurück           */

  var MODES = [
    {
      id: "solve",
      label: "Aufgaben lösen",
      icon: "sparkles",
      images: true,
      tier: "complex",
      cta: "Aufgaben lösen",
      dropTitle: "Fotos der Aufgaben auswählen oder hierher ziehen",
      dropHint: "JPG oder PNG – gern mehrere Seiten auf einmal",
      textLabel: "Zusatzangaben (freiwillig)",
      placeholder: "z. B. „nur Aufgabe 3 und 4“ oder „wir hatten gerade Bruchrechnen“",
      hint: "Lade ein Foto hoch – oder tippe die Aufgabe einfach ins Textfeld."
    },
    {
      id: "explain",
      label: "Thema erklären",
      icon: "brain",
      images: false,
      needsText: true,
      tier: "default",
      cta: "Thema erklären",
      textLabel: "Welches Thema soll ich erklären?",
      placeholder: "z. B. „Satz des Pythagoras“ oder „Warum gibt es Jahreszeiten?“",
      hint: "Je genauer du das Thema beschreibst, desto besser passt die Erklärung."
    },
    {
      id: "summary",
      label: "Zusammenfassen",
      icon: "file",
      images: true,
      tier: "quick",
      cta: "Zusammenfassen",
      dropTitle: "Buchseiten, Hefteinträge oder Arbeitsblätter auswählen",
      dropHint: "JPG oder PNG – gern mehrere Seiten auf einmal",
      textLabel: "Text oder Zusatzangaben (freiwillig)",
      placeholder: "Hier kannst du den Text auch direkt einfügen.",
      hint: "Du bekommst die Kernaussagen als Stichpunkte und drei mögliche Prüfungsfragen."
    },
    {
      id: "cards",
      label: "Karteikarten erstellen",
      icon: "layers",
      images: true,
      json: true,
      tier: "quick",
      cta: "Karteikarten erstellen",
      dropTitle: "Seiten oder Hefteinträge auswählen",
      dropHint: "JPG oder PNG – gern mehrere Seiten auf einmal",
      textLabel: "Thema oder Text (freiwillig)",
      placeholder: "z. B. „Vokabeln Unit 4“ – oder den Text direkt einfügen.",
      hint: "Du bekommst 8 bis 15 Karten und kannst sie danach als Stapel anlegen."
    },
    {
      id: "practice",
      label: "Übungsaufgaben",
      icon: "target",
      images: false,
      needsText: true,
      tier: "default",
      cta: "Übungsaufgaben erstellen",
      textLabel: "Wozu sollen die Übungsaufgaben sein?",
      placeholder: "z. B. „Gleichungen mit Klammern“ oder „unregelmäßige Verben“",
      hint: "5 Aufgaben, die immer schwieriger werden – die Lösungen stehen erst ganz am Ende."
    },
    {
      id: "check",
      label: "Meine Lösung prüfen",
      icon: "checkSquare",
      images: true,
      tier: "complex",
      cta: "Lösung prüfen",
      dropTitle: "Foto von Aufgabe und deiner Lösung auswählen",
      dropHint: "Am besten beides gut lesbar auf dem Bild",
      textLabel: "Deine Lösung oder Zusatzangaben (freiwillig)",
      placeholder: "Du kannst deine Lösung auch hier eintippen.",
      hint: "Du erfährst, wo Fehler stecken – und was das ungefähr für eine Note gäbe."
    },
    {
      id: "free",
      label: "Freie Frage",
      icon: "message",
      images: false,
      needsText: true,
      tier: "default",
      cta: "Frage stellen",
      textLabel: "Deine Frage",
      placeholder: "Frag einfach drauflos – zum Beispiel: „Wie lerne ich am besten Vokabeln?“",
      hint: "Alles rund um Schule, Lernen und Organisation."
    }
  ];

  var MAX_IMAGES = 8;
  var HISTORY_LIMIT = 15;

  /* ---------- Flüchtiger Zustand der Ansicht ---------------
     Lebt nur im Arbeitsspeicher. Die Ansicht ist mit
     `live: false` angemeldet und baut sich selbst neu auf. */

  var modeId = "solve";
  var pictures = [];            // {id, blob, url, name}
  var extraText = "";
  var subjectId = "";
  var controller = null;        // läuft gerade eine Anfrage?

  var run = emptyRun();

  /* Verweise auf Teile des DOM, die wir gezielt austauschen. */
  var ctxRef = null;
  var hintHost = null;
  var chipsHost = null;
  var inputBody = null;
  var thumbHost = null;
  var outHost = null;
  var mdNode = null;
  var startBtn = null;
  var statusBadge = null;
  var historyHost = null;

  function emptyRun() {
    return {
      status: "idle",        // idle | running | done | error
      text: "",
      title: "",
      kind: "",
      subjectId: null,
      error: "",
      deck: null,            // geprüftes Karteikarten-Ergebnis
      deckId: null,          // angelegter Stapel
      cancelled: false,
      json: false
    };
  }

  /* ---------- Kleine Helfer -------------------------------- */

  /** Hängt der Knoten noch im Dokument? (Antworten laufen asynchron ein.) */
  function alive(node) {
    if (!node) return false;
    if (typeof node.isConnected === "boolean") return node.isConnected;
    return document.body.contains(node);
  }

  function currentMode() {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === modeId) return MODES[i];
    return MODES[0];
  }

  function modeById(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return null;
  }

  function modeLabel(id) {
    var m = modeById(id);
    return m ? m.label : (id ? String(id) : "KI");
  }

  function iconButton(icon, label, onClick) {
    return el("button", {
      class: "btn btn--icon btn--sm", type: "button",
      "aria-label": label, title: label, onClick: onClick
    }, U.iconEl(icon));
  }

  function textButton(icon, label, cls, onClick) {
    return el("button", { class: cls || "btn", type: "button", onClick: onClick }, [
      U.iconEl(icon),
      el("span", { text: label })
    ]);
  }

  function subjectNameOrEmpty() {
    return subjectId ? NG.store.subjectName(subjectId) : "";
  }

  /** Zeitstempel eines Verlaufseintrags in lesbarer Form. */
  function stamp(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    return U.fmtDate(U.toISO(d), { style: "medium" }) + ", " + hh + ":" + mi;
  }

  /** Mehrzeiligen Text zu einer Zeile zusammenziehen (für Titel). */
  function oneLine(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  /* ---------- Hinweis: KI noch nicht eingerichtet ---------- */

  function renderHint() {
    if (!alive(hintHost)) return;
    U.clear(hintHost);

    var st = NG.ai.status();
    if (st.ready) return;

    hintHost.appendChild(el("div", {
      class: "card",
      style: { borderColor: "var(--warn)", background: "var(--warn-soft)" }
    }, el("div", { class: "card__body stack" }, [
      el("div", { class: "row row--tight" }, [
        el("span", { class: "icon-badge", html: U.icon("key") }),
        el("h3", { text: "Die KI ist noch nicht eingerichtet" })
      ]),
      el("p", {
        class: "fs-sm",
        text: "Damit ich dir Aufgaben lösen und Themen erklären kann, brauche ich einen Zugang. " +
          "Dafür gibt es zwei Wege:"
      }),
      el("ul", { class: "fs-sm", style: { margin: "0", paddingLeft: "1.2em" } }, [
        el("li", {
          text: "Öffne diese Seite als Claude-Artifact. Dann läuft die KI direkt mit – " +
            "du brauchst gar nichts einzutragen."
        }),
        el("li", {
          text: "Oder hinterlege in den Einstellungen deinen eigenen API-Schlüssel " +
            "(beziehungsweise die Adresse deines eigenen Servers)."
        })
      ]),
      el("div", { class: "row row--tight" }, [
        textButton("settings", "Jetzt einrichten", "btn btn--primary", function () {
          if (ctxRef) ctxRef.go("settings");
        }),
        el("span", { class: "fs-xs faint", text: "Alles andere kannst du schon anschauen." })
      ])
    ])));
  }

  function updateStatusBadge() {
    if (!alive(statusBadge)) return;
    var st = NG.ai.status();
    statusBadge.className = "badge " + (st.ready ? "badge--success" : "badge--warn");
    statusBadge.textContent = st.label;
  }

  /** Auslöser sperren, solange die KI fehlt oder eine Anfrage läuft. */
  function updateTriggers() {
    if (!alive(startBtn)) return;
    var st = NG.ai.status();
    var busy = !!controller;
    startBtn.disabled = !st.ready || busy;
    startBtn.title = st.ready ? "" : st.reason;
  }

  /* ---------- Werkzeug-Auswahl ----------------------------- */

  function renderChips() {
    if (!alive(chipsHost)) return;
    U.clear(chipsHost);

    MODES.forEach(function (m) {
      var btn = el("button", {
        class: "chip", type: "button",
        "aria-pressed": m.id === modeId ? "true" : "false",
        onClick: function () { selectMode(m.id); }
      }, [U.iconEl(m.icon), el("span", { text: m.label })]);
      chipsHost.appendChild(btn);
    });
  }

  function selectMode(id) {
    if (modeId === id) return;
    modeId = id;
    renderChips();
    renderInput();
  }

  /* ---------- Bilder --------------------------------------- */

  function addFiles(files) {
    var images = (files || []).filter(function (f) { return f && /^image\//.test(f.type || ""); });
    if (!images.length) {
      NG.ui.toast("Bitte wähle Bilder aus (JPG oder PNG).", "warn");
      return;
    }
    var free = MAX_IMAGES - pictures.length;
    if (free <= 0) {
      NG.ui.toast("Mehr als " + MAX_IMAGES + " Bilder auf einmal gehen leider nicht.", "warn");
      return;
    }
    if (images.length > free) {
      NG.ui.toast("Ich nehme die ersten " + free + " Bilder – mehr passen nicht auf einmal.", "warn");
      images = images.slice(0, free);
    }
    images.forEach(function (file) {
      pictures.push({
        id: U.uid("pic"),
        blob: file,
        url: URL.createObjectURL(file),
        name: file.name || "Bild"
      });
    });
    renderThumbs();
  }

  function removePicture(id) {
    pictures = pictures.filter(function (p) {
      if (p.id !== id) return true;
      try { URL.revokeObjectURL(p.url); } catch (e) { /* schon freigegeben */ }
      return false;
    });
    renderThumbs();
  }

  function clearPictures() {
    pictures.forEach(function (p) {
      try { URL.revokeObjectURL(p.url); } catch (e) { /* schon freigegeben */ }
    });
    pictures = [];
  }

  function renderThumbs() {
    if (!alive(thumbHost)) return;
    U.clear(thumbHost);
    if (!pictures.length) return;

    var grid = el("div", { class: "thumb-grid" }, pictures.map(function (p) {
      return el("div", { class: "thumb" }, [
        el("img", { src: p.url, alt: "Vorschau: " + p.name }),
        el("span", { class: "thumb__label", text: p.name }),
        el("button", {
          class: "thumb__x", type: "button",
          "aria-label": "Bild entfernen", title: "Bild entfernen",
          text: "✕",
          onClick: function () { removePicture(p.id); }
        })
      ]);
    }));

    thumbHost.appendChild(el("div", { class: "stack stack--sm" }, [
      grid,
      el("div", { class: "row row--tight" }, [
        el("span", {
          class: "fs-xs faint",
          text: pictures.length === 1 ? "1 Bild ausgewählt" : pictures.length + " Bilder ausgewählt"
        }),
        el("button", {
          class: "btn btn--sm btn--ghost", type: "button",
          text: "Alle Bilder entfernen",
          onClick: function () { clearPictures(); renderThumbs(); }
        })
      ])
    ]));
  }

  /* ---------- Eingabebereich -------------------------------- */

  function renderInput() {
    if (!alive(inputBody)) return;
    U.clear(inputBody);
    thumbHost = null;
    startBtn = null;

    var m = currentMode();

    if (m.images) {
      inputBody.appendChild(NG.ui.dropzone({
        accept: "image/*",
        multiple: true,
        icon: "image",
        title: m.dropTitle,
        hint: m.dropHint,
        onFiles: addFiles
      }));
      thumbHost = el("div");
      inputBody.appendChild(thumbHost);
      renderThumbs();
    }

    /* Textfeld */
    var textId = U.uid("as_text");
    var area = el("textarea", {
      id: textId, rows: m.images ? 3 : 5,
      placeholder: m.placeholder || "",
      onInput: function (e) { extraText = e.target.value; }
    });
    area.value = extraText;
    inputBody.appendChild(el("div", { class: "field" }, [
      el("label", { for: textId, text: m.textLabel + (m.needsText ? " *" : "") }),
      area,
      el("div", { class: "field__hint", text: m.hint || "" })
    ]));

    /* Fach und Antwortstil */
    var selectId = U.uid("as_subject");
    var select = el("select", {
      id: selectId,
      onChange: function (e) { subjectId = e.target.value || ""; }
    });
    NG.ui.subjectOptions({ allowNone: true, noneLabel: "— ohne Fach —" }).forEach(function (o) {
      var opt = el("option", { value: o.value === null ? "" : o.value, text: o.label });
      if (String(o.value === null ? "" : o.value) === String(subjectId)) opt.selected = true;
      select.appendChild(opt);
    });

    var styleGroup = el("div", { class: "btn-group", style: { alignSelf: "flex-start" } });
    [
      { value: "explain", label: "Schritt für Schritt" },
      { value: "solve", label: "Nur Ergebnis" }
    ].forEach(function (opt) {
      var btn = el("button", {
        type: "button", text: opt.label,
        "aria-pressed": NG.store.getSetting("ai.mode", "explain") === opt.value ? "true" : "false",
        onClick: function () {
          NG.store.setSetting("ai.mode", opt.value);
          U.$$("button", styleGroup).forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
        }
      });
      styleGroup.appendChild(btn);
    });

    inputBody.appendChild(el("div", { class: "grid grid--2" }, [
      el("div", { class: "field" }, [
        el("label", { for: selectId, text: "Fach" }),
        select,
        el("div", { class: "field__hint", text: "Hilft der KI, die richtige Sprache zu treffen." })
      ]),
      el("div", { class: "field" }, [
        el("span", { class: "label", text: "Antwortstil" }),
        styleGroup,
        el("div", {
          class: "field__hint",
          text: "„Schritt für Schritt“ erklärt den Weg, „Nur Ergebnis“ fasst sich kurz."
        })
      ])
    ]));

    /* Start */
    startBtn = el("button", {
      class: "btn btn--primary btn--lg", type: "button",
      onClick: function () { start(); }
    }, [U.iconEl("sparkles"), el("span", { text: m.cta })]);

    inputBody.appendChild(el("div", { class: "row" }, [
      startBtn,
      el("button", {
        class: "btn btn--ghost", type: "button",
        text: "Eingaben leeren",
        onClick: function () { resetInput(); }
      })
    ]));

    updateTriggers();
  }

  function resetInput() {
    clearPictures();
    extraText = "";
    renderInput();
    NG.ui.toast("Eingaben geleert");
  }

  /* ---------- Prompts je Modus ------------------------------ */

  function subjectLine(name) {
    return name ? "\n\nEs geht um das Fach " + name + "." : "";
  }

  function buildPrompt(m, text, subject, hasImages) {
    var p = "";

    if (m.id === "solve") {
      p = hasImages
        ? "Auf den Bildern sind Schulaufgaben. Lies jede Aufgabe genau vor, nummeriere sie und löse sie vollständig."
        : "Hier sind Schulaufgaben. Lies jede Aufgabe genau, nummeriere sie und löse sie vollständig.";
      p += "\n\nSo gehst du vor:\n" +
        "- Schreibe zu jeder Aufgabe zuerst kurz auf, was verlangt ist.\n" +
        "- Rechne beziehungsweise begründe danach Schritt für Schritt.\n" +
        "- Schreibe das Endergebnis jeder Aufgabe fett in eine eigene Zeile.";
      p += subjectLine(subject);
      p += "\n\nWenn eine Stelle unleserlich ist oder eine Angabe fehlt, sage genau, welche Stelle du " +
        "nicht entziffern kannst, und rate nicht.";
      if (text) p += "\n\nZusatzangaben von mir:\n" + text;
      return p;
    }

    if (m.id === "explain") {
      p = "Erkläre mir dieses Thema so, dass ich es wirklich verstehe:\n\n" + text;
      p += "\n\nBaue die Erklärung so auf:\n" +
        "1. Ein bis zwei Sätze, worum es überhaupt geht.\n" +
        "2. Die Erklärung in kleinen, aufeinander aufbauenden Schritten – altersgerecht und ohne " +
        "unnötige Fachwörter. Fachwörter, die du brauchst, erklärst du kurz.\n" +
        "3. Ein konkretes Beispiel zum Mitdenken oder Mitrechnen.\n" +
        "4. Zum Schluss ein kurzer Merksatz unter der Überschrift „Merksatz“.";
      p += subjectLine(subject);
      return p;
    }

    if (m.id === "summary") {
      p = hasImages
        ? "Fasse den Inhalt auf den Bildern zusammen."
        : "Fasse den folgenden Inhalt zusammen.";
      p += "\n\nGib zuerst die Kernaussagen als kurze Stichpunkte aus – pro Punkt ein Gedanke.\n" +
        "Schreibe danach unter der Überschrift „Mögliche Prüfungsfragen“ genau 3 Fragen, " +
        "die dazu in einer Klassenarbeit drankommen könnten.";
      p += subjectLine(subject);
      if (text) p += "\n\n" + (hasImages ? "Zusatzangaben von mir:\n" : "Inhalt:\n") + text;
      return p;
    }

    if (m.id === "check") {
      p = hasImages
        ? "Auf den Bildern siehst du eine Aufgabe und meine eigene Lösung."
        : "Hier siehst du eine Aufgabe und meine eigene Lösung.";
      p += "\n\nPrüfe meine Lösung gründlich:\n" +
        "- Schreibe zuerst kurz auf, was die Aufgabe verlangt.\n" +
        "- Gehe meine Lösung Schritt für Schritt durch und markiere jeden Fehler deutlich " +
        "(schreibe **Fehler:** davor).\n" +
        "- Erkläre bei jedem Fehler, warum er falsch ist und wie es richtig geht.\n" +
        "- Schätze am Ende, wie viele Punkte beziehungsweise welche Note das ungefähr geben würde " +
        "(Notensystem: " + NG.grades.scale().label + "). Sage dazu, dass es nur eine Schätzung ist.\n" +
        "- Nenne zum Schluss ein bis drei konkrete Tipps, wie ich es besser mache.\n" +
        "Wenn alles richtig ist, sage das genauso klar.";
      p += subjectLine(subject);
      if (text) p += "\n\n" + (hasImages ? "Zusatzangaben von mir:\n" : "Aufgabe und meine Lösung:\n") + text;
      return p;
    }

    if (m.id === "practice") {
      p = "Erstelle mir 5 Übungsaufgaben zu diesem Thema:\n\n" + text;
      p += "\n\nRegeln:\n" +
        "- Die Aufgaben werden von Aufgabe 1 bis Aufgabe 5 immer schwieriger.\n" +
        "- Nummeriere die Aufgaben und gib zuerst nur die Aufgaben aus, ohne Lösungen dazwischen.\n" +
        "- Erst ganz am Ende folgt die Überschrift „Lösungen“ und darunter die vollständigen " +
        "Lösungen mit Rechenweg beziehungsweise Begründung.";
      p += subjectLine(subject);
      return p;
    }

    if (m.id === "cards") {
      p = "Erstelle Karteikarten zum Lernen";
      if (hasImages) p += " aus dem Material auf den Bildern";
      if (text) p += (hasImages ? ". Thema beziehungsweise Zusatzangaben: " + text : " zu: " + text);
      p += ".";
      p += subjectLine(subject);
      p += "\n\nAntworte ausschließlich mit einem einzigen JSON-Objekt – ohne Text davor oder danach " +
        "und ohne Code-Zaun:\n" +
        '{"deck": "Name des Stapels", "cards": [{"front": "Frage", "back": "Antwort"}]}\n\n' +
        "Regeln:\n" +
        "- Erzeuge 8 bis 15 Karten.\n" +
        "- „front“ ist eine kurze, klare Frage oder ein Begriff.\n" +
        "- „back“ ist die knappe, richtige Antwort – höchstens zwei Sätze.\n" +
        "- Keine Nummerierung in den Karten und kein Markdown.\n" +
        "- Der Stapelname ist kurz und beschreibt das Thema.";
      return p;
    }

    /* Freie Frage */
    p = text;
    p += subjectLine(subject);
    return p;
  }

  /** Zusätzliche Rollenhinweise für den System-Prompt. */
  function buildSystemExtra(m, subject) {
    var parts = [];
    if (subject) parts.push("Die Frage gehört zum Fach " + subject + ".");

    var info = "";
    try { info = NG.ai.context({ events: false, tasks: false }); } catch (e) { info = ""; }
    if (info) parts.push("Das weißt du über die Schülerin/den Schüler:\n" + info);

    if (m.json) {
      parts.push("Für diese Anfrage antwortest du ausschließlich mit gültigem JSON: " +
        "keine Einleitung, keine Erklärung, kein Markdown.");
    }
    return parts.join("\n\n");
  }

  /** Kurzer Titel für Verlauf, Material und Aufgaben. */
  function buildTitle(m, text, subject) {
    var base = oneLine(text);
    if (base) return U.truncate(m.label + ": " + base, 70);
    if (subject) return m.label + " – " + subject;
    return m.label + " – " + U.fmtDate(U.todayISO(), { style: "numeric" });
  }

  /* ---------- Ausführung ------------------------------------ */

  function start() {
    var st = NG.ai.status();
    if (!st.ready) {
      NG.ui.toast("Richte zuerst die KI ein, dann lege ich los.", "warn");
      return;
    }
    if (controller) return;                    // läuft schon

    var m = currentMode();
    var text = String(extraText || "").trim();
    var hasImages = !!(m.images && pictures.length);

    if (m.needsText && !text) {
      NG.ui.toast("Schreib zuerst ins Textfeld, worum es geht.", "warn");
      return;
    }
    if (m.images && !hasImages && !text) {
      NG.ui.toast("Lade ein Foto hoch – oder beschreibe die Aufgabe im Textfeld.", "warn");
      return;
    }
    if (hasImages && !st.canImages) {
      NG.ui.toast("Bilder werden hier vielleicht nicht angenommen. Ich versuche es trotzdem.", "warn");
    }

    var subject = subjectNameOrEmpty();
    var prompt = buildPrompt(m, text, subject, hasImages);
    var title = buildTitle(m, text, subject);
    var blobs = hasImages ? pictures.map(function (p) { return p.blob; }) : [];

    controller = new AbortController();
    var signal = controller.signal;

    run = emptyRun();
    run.status = "running";
    run.title = title;
    run.kind = m.id;
    run.subjectId = subjectId || null;
    run.json = !!m.json;

    renderOutput();
    updateTriggers();

    Promise.all(blobs.map(function (b) { return U.shrinkImage(b, 1600); }))
      .then(function (small) {
        return NG.ai.run({
          system: NG.ai.systemPrompt(buildSystemExtra(m, subject)),
          prompt: prompt,
          images: small,
          onText: m.json ? null : onStream,
          signal: signal,
          tier: m.tier || "default",
          json: !!m.json
        });
      })
      .then(function (res) { finish(m, res, prompt, title); })
      .catch(function (err) { fail(err); });
  }

  /** Läuft während des Streams – schreibt direkt ins DOM, kein Neu-Rendern. */
  function onStream(update) {
    if (!update) return;
    run.text = update.text || "";
    if (alive(mdNode)) mdNode.innerHTML = U.md(run.text);
  }

  function cancel() {
    if (!controller) return;
    try { controller.abort(); } catch (e) { /* war schon beendet */ }
  }

  function finish(m, res, prompt, title) {
    controller = null;
    var text = (res && res.text) || "";

    if (m.json) {
      var deck = normalizeDeck(res && res.data, title);
      if (!deck) {
        run.status = "error";
        run.error = "Die Karteikarten kamen nicht im erwarteten Format zurück. Versuch es bitte noch einmal.";
        renderOutput();
        updateTriggers();
        return;
      }
      run.deck = deck;
      run.text = deckToMarkdown(deck);
    } else {
      run.text = text;
    }

    run.status = "done";

    if (!String(run.text).trim()) {
      run.status = "error";
      run.error = "Es kam keine Antwort zurück. Frage etwas kürzer oder konkreter.";
      renderOutput();
      updateTriggers();
      return;
    }

    try {
      NG.ai.logRun({
        kind: m.id,
        title: title,
        prompt: prompt,
        result: run.text,
        subjectId: run.subjectId
      });
    } catch (e) { /* Verlauf ist ein Extra – ein Fehlschlag darf nicht stören */ }

    renderOutput();
    renderHistory();
    updateTriggers();
  }

  function fail(err) {
    controller = null;
    var aborted = !!err && (err.name === "AbortError" || err.code === "cancelled");

    if (aborted) {
      run.cancelled = true;
      if (String(run.text).trim()) {
        run.status = "done";
      } else {
        run = emptyRun();
        NG.ui.toast("Abgebrochen");
      }
    } else {
      run.status = "error";
      run.error = NG.ai.friendly(err);
      if (err && err.text && !String(run.text).trim()) run.text = err.text;
    }

    renderOutput();
    updateTriggers();
  }

  /* ---------- Karteikarten ---------------------------------- */

  /** Prüft das JSON der KI und macht daraus einen sauberen Stapel. */
  function normalizeDeck(data, fallbackName) {
    if (!data || typeof data !== "object") return null;
    var raw = Array.isArray(data.cards) ? data.cards : (Array.isArray(data) ? data : null);
    if (!raw) return null;

    var cards = [];
    raw.forEach(function (c) {
      if (!c || typeof c !== "object") return;
      var front = String(c.front === undefined || c.front === null ? "" : c.front).trim();
      var back = String(c.back === undefined || c.back === null ? "" : c.back).trim();
      if (front && back) cards.push({ front: front, back: back });
    });
    if (!cards.length) return null;

    var name = String(data.deck || "").trim();
    if (!name) name = U.truncate(fallbackName || "Neuer Stapel", 60);

    return { name: name, cards: cards };
  }

  function deckToMarkdown(deck) {
    var lines = ["## " + deck.name, ""];
    deck.cards.forEach(function (c, i) {
      lines.push((i + 1) + ". **" + c.front + "** — " + c.back);
    });
    return lines.join("\n");
  }

  function saveDeck() {
    if (!run.deck || run.deckId) return;
    var deck = NG.store.add("decks", {
      name: run.deck.name,
      subjectId: run.subjectId || null
    });
    var today = U.todayISO();
    NG.store.addMany("cards", run.deck.cards.map(function (c) {
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
    run.deckId = deck.id;
    NG.ui.toast("Stapel „" + U.truncate(deck.name, 40) + "“ angelegt", "success");
    renderOutput();
  }

  function deckPreview() {
    var deck = run.deck;
    if (!deck) return null;

    var list = el("div", { class: "list" }, deck.cards.map(function (c, i) {
      return el("div", { class: "list__item", style: { paddingLeft: "0", paddingRight: "0" } }, [
        el("span", { class: "badge", text: String(i + 1) }),
        el("div", { class: "list__main" }, [
          el("div", { class: "list__title", text: c.front }),
          el("div", { class: "list__meta", text: c.back })
        ])
      ]);
    }));

    var foot = run.deckId
      ? el("div", { class: "row row--tight" }, [
        el("span", { class: "badge badge--success", text: "Stapel angelegt" }),
        textButton("layers", "Zu den Karteikarten", "btn btn--sm btn--primary", function () {
          if (ctxRef) ctxRef.go("flashcards");
        })
      ])
      : el("div", { class: "row row--tight" }, [
        textButton("plus", "Stapel anlegen", "btn btn--primary", function () { saveDeck(); }),
        el("span", {
          class: "fs-xs faint",
          text: deck.cards.length + " Karten landen im Fach 1 und sind sofort fällig."
        })
      ]);

    return el("div", { class: "stack stack--sm" }, [
      el("div", { class: "section-title", style: { margin: "0" }, text: "Vorschau: " + deck.name }),
      list,
      foot
    ]);
  }

  /* ---------- Was nach der Antwort möglich ist --------------- */

  function saveAsMaterial() {
    var text = String(run.text || "").trim();
    if (!text) return;
    NG.store.add("materials", {
      name: U.truncate(run.title || "KI-Antwort", 70),
      note: text,
      text: text,
      subjectId: run.subjectId || null,
      tags: ["KI", modeLabel(run.kind)],
      file: null
    });
    NG.ui.toast("Als Material gespeichert", "success");
  }

  function createTask() {
    var text = String(run.text || "").trim();
    if (!text) return;
    NG.store.add("tasks", {
      title: U.truncate(run.title || "Aufgabe aus dem KI-Assistenten", 70),
      subjectId: run.subjectId || null,
      due: "",
      done: false,
      doneAt: null,
      priority: 3,
      note: U.truncate(text, 500)
    });
    NG.ui.toast("Aufgabe angelegt", "success");
  }

  function answerActions() {
    return el("div", { class: "row row--tight" }, [
      textButton("copy", "Kopieren", "btn btn--sm", function () { NG.ui.copyText(run.text); }),
      textButton("folder", "Als Material speichern", "btn btn--sm", function () { saveAsMaterial(); }),
      textButton("checkSquare", "Aufgabe anlegen", "btn btn--sm", function () { createTask(); })
    ]);
  }

  /* ---------- Ausgabe ---------------------------------------- */

  function renderOutput() {
    if (!alive(outHost)) return;
    U.clear(outHost);
    mdNode = null;
    if (run.status === "idle") return;

    var running = run.status === "running";
    var parts = [];

    if (run.status === "error") {
      parts.push(el("div", {
        class: "card",
        style: { borderColor: "var(--danger)", background: "var(--danger-soft)" }
      }, el("div", { class: "card__body stack stack--sm" }, [
        el("div", { class: "row row--tight" }, [
          el("span", { class: "icon-badge", html: U.icon("alert"), style: { background: "transparent", color: "var(--danger)" } }),
          el("h3", { text: "Das hat nicht geklappt" })
        ]),
        el("p", { class: "fs-sm", text: run.error || "Unbekannter Fehler." }),
        el("div", { class: "row row--tight" }, [
          textButton("refresh", "Noch einmal versuchen", "btn btn--sm", function () { start(); }),
          textButton("settings", "Einstellungen", "btn btn--sm btn--ghost", function () {
            if (ctxRef) ctxRef.go("settings");
          })
        ])
      ])));
    }

    /* Antwortkarte – auch bei Fehlern, falls schon Text da ist. */
    var showAnswer = running || String(run.text).trim() || run.status === "done";
    if (showAnswer) {
      var head = el("div", { class: "card__head" }, [
        el("h3", { text: U.truncate(run.title || "Antwort", 60) }),
        el("div", { class: "row row--tight spacer" }, [
          running
            ? el("button", {
              class: "btn btn--sm", type: "button", text: "Abbrechen",
              onClick: function () { cancel(); }
            })
            : el("span", { class: "badge", text: modeLabel(run.kind) })
        ])
      ]);

      var body = el("div", { class: "card__body stack stack--sm" });

      if (running) {
        body.appendChild(el("div", { class: "row row--tight", style: { color: "var(--text-muted)" } }, [
          el("span", { class: "spinner" }),
          el("span", {
            class: "fs-sm",
            text: run.json ? "Baut die Karteikarten …" : "Denkt nach …"
          })
        ]));
      }

      if (run.cancelled) {
        body.appendChild(el("p", {
          class: "fs-sm muted",
          text: "Abgebrochen – das hier war schon fertig:"
        }));
      }

      // Bei Karteikarten zeigt die Vorschauliste dasselbe – dann sparen wir uns den Text.
      if (!run.deck) {
        mdNode = el("div", { class: "md", html: U.md(run.text || "") });
        body.appendChild(mdNode);
      }

      if (!running && run.deck) body.appendChild(deckPreview());
      if (!running && String(run.text).trim()) body.appendChild(answerActions());

      parts.push(el("div", { class: "card" }, [head, body]));
    }

    parts.forEach(function (p) { outHost.appendChild(p); });
  }

  /* ---------- Verlauf ----------------------------------------- */

  function recentRuns() {
    var list = NG.store.all("aiRuns");
    if (!Array.isArray(list)) return [];
    return U.sortBy(list, function (r) { return String((r && r.createdAt) || ""); }, "desc")
      .slice(0, HISTORY_LIMIT);
  }

  function showRun(rec) {
    var text = String((rec && rec.result) || "").trim();
    var m = NG.ui.modal({
      title: U.truncate((rec && rec.title) || "KI-Antwort", 70),
      wide: true,
      body: text
        ? NG.ui.mdBlock(text)
        : el("p", { class: "muted", text: "Zu diesem Eintrag ist kein Text gespeichert." }),
      actions: [
        {
          label: "Als Material speichern",
          onClick: function () {
            if (!text) return;
            NG.store.add("materials", {
              name: U.truncate((rec && rec.title) || "KI-Antwort", 70),
              note: text,
              text: text,
              subjectId: (rec && rec.subjectId) || null,
              tags: ["KI", modeLabel(rec && rec.kind)],
              file: null
            });
            NG.ui.toast("Als Material gespeichert", "success");
          }
        },
        "spacer",
        { label: "Schließen", variant: "primary", onClick: function () { m.close(); } }
      ]
    });
  }

  function deleteRun(rec) {
    NG.ui.confirm({
      title: "Eintrag löschen?",
      message: "„" + U.truncate((rec && rec.title) || "Eintrag", 60) + "“ wird aus dem Verlauf entfernt.",
      confirmText: "Löschen",
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      NG.store.remove("aiRuns", rec.id);
      renderHistory();
    });
  }

  function clearHistory() {
    NG.ui.confirm({
      title: "Verlauf leeren?",
      message: "Alle gespeicherten KI-Antworten werden gelöscht. Materialien und Aufgaben bleiben erhalten.",
      confirmText: "Verlauf leeren",
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      NG.store.removeWhere("aiRuns", function () { return true; });
      renderHistory();
      NG.ui.toast("Verlauf geleert");
    });
  }

  function historyRow(rec) {
    return el("div", { class: "list__item" }, [
      el("button", {
        class: "list__main", type: "button",
        style: {
          background: "none", border: "0", padding: "0", font: "inherit",
          color: "inherit", textAlign: "left", cursor: "pointer"
        },
        onClick: function () { showRun(rec); }
      }, [
        el("div", { class: "list__title", text: U.truncate(rec.title || "KI-Antwort", 70) }),
        el("div", { class: "list__meta" }, [
          el("span", { class: "badge", text: modeLabel(rec.kind) }),
          rec.subjectId ? el("span", { text: NG.store.subjectName(rec.subjectId) }) : null,
          el("span", { text: stamp(rec.createdAt) })
        ])
      ]),
      el("div", { class: "list__actions" }, [
        iconButton("trash", "Eintrag löschen", function () { deleteRun(rec); })
      ])
    ]);
  }

  function renderHistory() {
    if (!alive(historyHost)) return;
    U.clear(historyHost);

    var runs = recentRuns();

    if (!runs.length) {
      historyHost.appendChild(NG.ui.card({
        title: "Verlauf",
        body: NG.ui.empty({
          icon: "clock",
          title: "Noch kein Verlauf",
          text: "Sobald du etwas gefragt hast, findest du die Antwort hier wieder."
        })
      }));
      return;
    }

    historyHost.appendChild(NG.ui.card({
      title: "Verlauf",
      actions: [
        el("span", { class: "badge", text: String(runs.length) }),
        el("button", {
          class: "btn btn--sm btn--ghost", type: "button", text: "Verlauf leeren",
          onClick: function () { clearHistory(); }
        })
      ],
      flush: true,
      body: el("div", { class: "list" }, runs.map(historyRow))
    }));
  }

  /* ---------- Aufbau der Ansicht ------------------------------ */

  function render(root, ctx) {
    ctxRef = ctx;

    hintHost = el("div");
    chipsHost = el("div", { class: "row row--tight" });
    inputBody = el("div", { class: "card__body stack" });
    outHost = el("div", { class: "stack" });
    historyHost = el("div");

    var chooser = el("div", { class: "card" }, [
      el("div", { class: "card__head" }, [
        el("h3", { text: "Was soll ich für dich tun?" })
      ]),
      el("div", { class: "card__body" }, chipsHost)
    ]);

    root.appendChild(el("div", { class: "stack" }, [
      hintHost,
      chooser,
      el("div", { class: "card" }, inputBody),
      outHost,
      historyHost
    ]));

    renderHint();
    renderChips();
    renderInput();
    renderOutput();
    renderHistory();

    // Der KI-Zustand steht eventuell erst kurz nach dem Aufbau fest.
    NG.ai.onReady(function () {
      renderHint();
      updateTriggers();
      updateStatusBadge();
    });
  }

  /* ---------- Anmeldung ---------------------------------------- */

  NG.app.register({
    id: "assistant",
    title: "KI-Assistent",
    subtitle: "Aufgaben hochladen und Schritt für Schritt lösen lassen",
    icon: "sparkles",
    group: "learn",
    order: 7,
    tab: true,
    live: false,                 // eigener Zustand: wir bauen selbst neu auf
    render: render,

    actions: function (ctx) {
      var st = NG.ai.status();
      statusBadge = el("span", {
        class: "badge " + (st.ready ? "badge--success" : "badge--warn"),
        text: st.label
      });
      return [
        statusBadge,
        textButton("settings", "Einstellungen", "btn btn--sm", function () { ctx.go("settings"); })
      ];
    },

    onLeave: function () {
      // Verweise lösen, damit laufende Antworten nicht in altes DOM schreiben.
      hintHost = chipsHost = inputBody = thumbHost = null;
      outHost = mdNode = startBtn = statusBadge = historyHost = null;
    }
  });
})(window);
