/* =========================================================
   NextGen Lernen – Einrichtungsassistent
   Führt beim allerersten Start in vier kurzen Schritten
   durch Name, Notensystem, Gewichtung und Fächer.
   Keine eigene Ansicht: exportiert NG.onboarding.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});
  var U = NG.util;
  // Ohne die Kernbausteine bleibt der Assistent still, statt die App zu stoppen.
  if (!U || !NG.ui || !NG.store) return;
  var el = U.el;

  /* ---------- Feste Texte und Vorgaben --------------------- */

  var TOTAL = 4;

  var TITLES = [
    "Willkommen bei NextGen Lernen",
    "Wie werden deine Noten gezählt?",
    "Schriftlich und mündlich",
    "Deine Fächer"
  ];

  var LABELS = ["Willkommen", "Notensystem", "Gewichtung", "Fächer"];

  var SUBJECT_SUGGESTIONS = [
    "Deutsch", "Mathematik", "Englisch", "Biologie", "Chemie", "Physik",
    "Geschichte", "Erdkunde", "Politik", "Kunst", "Musik", "Sport",
    "Informatik", "Französisch", "Latein", "Spanisch", "Religion", "Ethik"
  ];

  var SCALE_OPTIONS = [
    {
      id: "de6",
      title: "Noten 1 bis 6",
      sub: "Sekundarstufe I",
      example: "2,3",
      pill: "g2",
      text: "Die klassischen Schulnoten – auch mit Tendenz wie 2+ oder 3−. Die 1 ist die beste Note."
    },
    {
      id: "points15",
      title: "Punkte 0 bis 15",
      sub: "Oberstufe",
      example: "11 P",
      pill: "g2",
      text: "Das Punktesystem der Oberstufe. 15 Punkte sind am besten, 0 Punkte am schlechtesten."
    }
  ];

  // Schnellwahl für die Gewichtung: [schriftlich, mündlich]
  var WEIGHT_PRESETS = [[50, 50], [60, 40], [40, 60], [70, 30]];

  /* ---------- Zustand des Assistenten ---------------------- */

  var dialog = null;    // geöffneter Dialog (Rückgabewert von NG.ui.modal)
  var step = 1;
  var draft = null;     // gesammelte Eingaben, erst am Ende gespeichert
  var finished = false; // true, sobald bewusst beendet oder übersprungen wurde

  /* ---------- Kleine Helfer -------------------------------- */

  function palette() {
    var p = NG.store.PALETTE;
    return (p && p.length) ? p : ["#4b5bd4"];
  }

  /** Vorhandene Fachnamen als saubere Liste. */
  function subjectNames() {
    return (NG.store.all("subjects") || []).map(function (s) {
      return String(s && s.name ? s.name : "").trim();
    }).filter(function (n) { return !!n; });
  }

  /** Kürzel: die ersten zwei Buchstaben, groß geschrieben. */
  function shortOf(name) {
    var s = String(name || "").trim();
    return (s.slice(0, 2) || "?").toUpperCase();
  }

  /** Bringt eine Gewichtung auf saubere Werte, die zusammen 100 ergeben. */
  function normWeights(raw) {
    var w = (raw && typeof raw === "object") ? raw : {};
    var written = U.num(w.written, 50);
    var oral = U.num(w.oral, 50);
    if (!isFinite(written) || written < 0) written = 50;
    if (!isFinite(oral) || oral < 0) oral = 50;
    var sum = written + oral;
    if (!(sum > 0)) return { written: 50, oral: 50 };
    var pct = U.clamp(Math.round(written / sum * 100), 0, 100);
    return { written: pct, oral: 100 - pct };
  }

  /** Startwerte aus dem Speicher lesen – funktioniert auch bei ganz leerem Store. */
  function newDraft() {
    var d = {
      name: String(NG.store.getSetting("name", "") || ""),
      klasse: String(NG.store.getSetting("klasse", "") || ""),
      scale: NG.store.getSetting("gradeScale", "de6") === "points15" ? "points15" : "de6",
      weights: normWeights(NG.store.getSetting("defaultWeights", null)),
      extra: [],      // zusätzliche Fächer (eigene oder schon angelegte)
      selected: {}    // Schlüssel: Fachname in Kleinbuchstaben
    };

    var known = {};
    SUBJECT_SUGGESTIONS.forEach(function (n) { known[n.toLowerCase()] = true; });

    // Bereits angelegte Fächer sind vorausgewählt und tauchen als Chip auf.
    subjectNames().forEach(function (n) {
      var key = n.toLowerCase();
      d.selected[key] = true;
      if (!known[key]) { known[key] = true; d.extra.push(n); }
    });

    return d;
  }

  /** Alle ausgewählten Fachnamen in der Reihenfolge der Chips. */
  function selectedNames() {
    if (!draft) return [];
    var out = [];
    SUBJECT_SUGGESTIONS.concat(draft.extra).forEach(function (n) {
      if (draft.selected[n.toLowerCase()]) out.push(n);
    });
    return out;
  }

  /** Ein Merkmal der App als Zeile mit Symbol. */
  function feature(iconName, title, text) {
    return el("div", { class: "row row--tight", style: { alignItems: "flex-start" } }, [
      el("span", { class: "icon-badge", html: U.icon(iconName) }),
      el("div", { class: "list__main" }, [
        el("div", { class: "fw-6", text: title }),
        el("div", { class: "fs-sm muted", text: text })
      ])
    ]);
  }

  /* ---------- Dialog-Gerüst -------------------------------- */

  function setTitle(text) {
    if (!dialog || !dialog.el) return;
    var h = dialog.el.querySelector(".modal__head h2");
    if (h) h.textContent = text;
    dialog.el.setAttribute("aria-label", text);
  }

  /** Fortschrittsanzeige über jedem Schritt. */
  function progressHead() {
    var pct = Math.round(step / TOTAL * 100);
    return el("div", { class: "stack stack--sm" }, [
      el("div", { class: "row row--tight" }, [
        el("span", { class: "badge badge--accent", text: "Schritt " + step + " von " + TOTAL }),
        el("span", { class: "fs-xs faint", style: { marginLeft: "auto" }, text: LABELS[step - 1] })
      ]),
      el("div", {
        class: "progress", role: "progressbar",
        "aria-label": "Fortschritt der Einrichtung",
        "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct)
      }, el("div", { class: "progress__bar", style: { width: pct + "%" } }))
    ]);
  }

  /** Tauscht die Knöpfe im Fuß des Dialogs aus. */
  function setFoot(actions) {
    var foot = dialog && dialog.foot;
    if (!foot) return;
    U.clear(foot);
    (actions || []).forEach(function (a) {
      if (!a) return;
      if (a === "spacer") {
        // Eigener Abstandshalter: schiebt alles Folgende nach rechts.
        foot.appendChild(el("span", { style: { marginRight: "auto" } }));
        return;
      }
      foot.appendChild(el("button", {
        type: "button",
        class: "btn" + (a.variant ? " btn--" + a.variant : ""),
        text: a.label,
        onClick: a.onClick
      }));
    });
  }

  function skipAction() {
    return { label: "Überspringen", variant: "ghost", onClick: skip };
  }

  function backAction() {
    return { label: "Zurück", onClick: function () { show(step - 1); } };
  }

  /** Baut einen Schritt komplett neu in den offenen Dialog. */
  function show(n) {
    if (!dialog) return;
    step = U.clamp(n, 1, TOTAL);
    setTitle(TITLES[step - 1]);

    var builder = BUILDERS[step - 1];
    var built = builder();

    U.clear(dialog.body);
    U.append(dialog.body, el("div", { class: "stack" }, [progressHead(), built.content]));
    setFoot(built.actions);
    dialog.body.scrollTop = 0;
  }

  /* =========================================================
     Schritt 1 – Willkommen
     ========================================================= */

  function buildWelcome() {
    var form = NG.ui.buildForm([
      {
        name: "name", label: "Wie heißt du?", type: "text",
        placeholder: "Dein Vorname",
        hint: "Nur für die Begrüßung – alles bleibt auf deinem Gerät."
      },
      {
        name: "klasse", label: "Klasse oder Stufe", type: "text",
        placeholder: "z. B. 9b oder Q1"
      }
    ], { name: draft.name, klasse: draft.klasse });

    var content = el("div", { class: "stack" }, [
      el("p", {
        class: "muted",
        text: "Schön, dass du da bist! NextGen Lernen ist dein Platz für alles rund um die Schule. " +
          "In vier kurzen Schritten stellen wir die App auf dich ein – ändern kannst du später alles."
      }),
      el("div", { class: "stack stack--sm" }, [
        feature("calendar", "Klassenarbeiten und Termine",
          "Trag ein, was ansteht – du siehst sofort, wie viele Tage dir noch bleiben."),
        feature("award", "Noten mit eigener Gewichtung",
          "Schriftlich und mündlich zählen genau so viel, wie es an deiner Schule üblich ist."),
        feature("folder", "Materialien hochladen",
          "Arbeitsblätter, Fotos und Notizen liegen ordentlich beim passenden Fach."),
        feature("sparkles", "KI-Assistent",
          "Fotografiere eine Aufgabe ab – die KI löst sie und erklärt dir den Rechenweg."),
        feature("layers", "Karteikarten",
          "Vokabeln und Formeln abfragen, bis sie wirklich sitzen."),
        feature("timer", "Lernzeit",
          "Konzentriert lernen mit Pausen – und sehen, wie viel du geschafft hast.")
      ]),
      form.el
    ]);

    function saveAndGo() {
      var data = form.read() || {};
      draft.name = String(data.name || "").trim();
      draft.klasse = String(data.klasse || "").trim();
      NG.store.setSetting("name", draft.name);
      NG.store.setSetting("klasse", draft.klasse);
      show(2);
    }

    return {
      content: content,
      actions: [
        skipAction(),
        "spacer",
        { label: "Los geht's", variant: "primary", onClick: saveAndGo }
      ]
    };
  }

  /* =========================================================
     Schritt 2 – Notensystem
     ========================================================= */

  function buildScale() {
    var cards = {};

    function paint() {
      SCALE_OPTIONS.forEach(function (o) {
        var btn = cards[o.id];
        if (!btn) return;
        var on = draft.scale === o.id;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.style.borderColor = on ? "var(--accent)" : "var(--border)";
        btn.style.boxShadow = on ? "0 0 0 3px var(--accent-soft)" : "var(--shadow-sm)";
      });
    }

    var grid = el("div", { class: "grid grid--2" }, SCALE_OPTIONS.map(function (o) {
      var btn = el("button", {
        class: "card", type: "button", "aria-pressed": "false",
        style: {
          textAlign: "left", cursor: "pointer", font: "inherit",
          color: "inherit", padding: "0", width: "100%"
        },
        onClick: function () {
          draft.scale = o.id;
          NG.store.setSetting("gradeScale", o.id);
          paint();
        }
      }, el("div", { class: "card__body stack stack--sm" }, [
        el("div", { class: "row row--tight" }, [
          el("span", { class: "grade-pill grade-pill--lg " + o.pill, text: o.example }),
          el("div", { class: "list__main" }, [
            el("div", { class: "fw-6", text: o.title }),
            el("div", { class: "fs-xs faint", text: o.sub })
          ])
        ]),
        el("div", { class: "fs-sm muted", text: o.text })
      ]));
      cards[o.id] = btn;
      return btn;
    }));

    paint();

    var content = el("div", { class: "stack" }, [
      el("p", {
        class: "muted",
        text: "Wähle aus, wie an deiner Schule bewertet wird. Danach richten sich alle Noten, " +
          "Durchschnitte und Farben in der App."
      }),
      grid,
      el("p", {
        class: "fs-xs faint",
        text: "Du kannst später in den Einstellungen jederzeit wechseln."
      })
    ]);

    return {
      content: content,
      actions: [
        skipAction(),
        "spacer",
        backAction(),
        {
          label: "Weiter", variant: "primary",
          onClick: function () {
            NG.store.setSetting("gradeScale", draft.scale);
            show(3);
          }
        }
      ]
    };
  }

  /* =========================================================
     Schritt 3 – Gewichtung
     ========================================================= */

  function buildWeights() {
    var idW = "ng_ob_written";
    var idO = "ng_ob_oral";

    var inW = el("input", {
      type: "number", id: idW, name: "written",
      min: "0", max: "100", step: "5", inputmode: "numeric"
    });
    var inO = el("input", {
      type: "number", id: idO, name: "oral",
      min: "0", max: "100", step: "5", inputmode: "numeric"
    });

    var barW = el("span", { style: { background: "var(--accent)", width: "50%" } });
    var barO = el("span", { style: { background: "var(--info)", width: "50%" } });
    var lblW = el("span", { class: "tnum", text: "" });
    var lblO = el("span", { class: "tnum", text: "" });

    var chips = [];

    function paint() {
      var w = draft.weights.written;
      var o = draft.weights.oral;
      barW.style.width = w + "%";
      barO.style.width = o + "%";
      lblW.textContent = "Schriftlich " + w + " %";
      lblO.textContent = "Mündlich " + o + " %";
      chips.forEach(function (c) {
        c.setAttribute("aria-pressed", c._written === w ? "true" : "false");
      });
    }

    /**
     * Setzt den schriftlichen Anteil; der mündliche ergänzt sich auf 100.
     * `source` verhindert, dass das gerade getippte Feld überschrieben wird.
     */
    function apply(value, source) {
      var w = U.clamp(Math.round(U.num(value, 50)), 0, 100);
      draft.weights = { written: w, oral: 100 - w };
      if (source !== "written") inW.value = String(draft.weights.written);
      if (source !== "oral") inO.value = String(draft.weights.oral);
      paint();
    }

    inW.value = String(draft.weights.written);
    inO.value = String(draft.weights.oral);

    inW.addEventListener("input", function () { apply(inW.value, "written"); });
    inO.addEventListener("input", function () { apply(100 - U.num(inO.value, 50), "oral"); });
    inW.addEventListener("change", function () { apply(inW.value, null); });
    inO.addEventListener("change", function () { apply(100 - U.num(inO.value, 50), null); });

    var chipRow = el("div", { class: "row row--tight" }, WEIGHT_PRESETS.map(function (p) {
      var c = el("button", {
        class: "chip", type: "button", "aria-pressed": "false",
        text: p[0] + " / " + p[1],
        onClick: function () { apply(p[0], null); }
      });
      c._written = p[0];
      chips.push(c);
      return c;
    }));

    var fields = el("div", { class: "form-grid" }, [
      el("div", { class: "field" }, [
        el("label", { for: idW, text: "Schriftlich (%)" }),
        inW,
        el("div", { class: "field__hint", text: "Klassenarbeiten, Tests, Klausuren" })
      ]),
      el("div", { class: "field" }, [
        el("label", { for: idO, text: "Mündlich (%)" }),
        inO,
        el("div", { class: "field__hint", text: "Mitarbeit, Referate, Hausaufgaben" })
      ])
    ]);

    paint();

    var content = el("div", { class: "stack" }, [
      el("p", {
        class: "muted",
        text: "An vielen Schulen zählen schriftliche Arbeiten und mündliche Mitarbeit " +
          "unterschiedlich stark – hier stellst du ein, wie es bei dir ist."
      }),
      el("div", { class: "stack stack--sm" }, [
        el("div", { class: "label", text: "Schnellwahl (schriftlich / mündlich)" }),
        chipRow
      ]),
      fields,
      el("div", { class: "stack stack--sm" }, [
        el("div", { class: "meter" }, [barW, barO]),
        el("div", { class: "row row--tight fs-sm muted" }, [
          el("span", { class: "dot", style: { background: "var(--accent)" } }),
          lblW,
          el("span", { class: "dot", style: { background: "var(--info)", marginLeft: "var(--sp-3)" } }),
          lblO
        ])
      ]),
      el("p", {
        class: "fs-xs faint",
        text: "Beide Anteile ergänzen sich immer zu 100 %. Für einzelne Fächer kannst du die " +
          "Gewichtung später einzeln anpassen."
      })
    ]);

    return {
      content: content,
      actions: [
        skipAction(),
        "spacer",
        backAction(),
        {
          label: "Weiter", variant: "primary",
          onClick: function () {
            NG.store.setSetting("defaultWeights", {
              written: draft.weights.written,
              oral: draft.weights.oral
            });
            show(4);
          }
        }
      ]
    };
  }

  /* =========================================================
     Schritt 4 – Fächer
     ========================================================= */

  function buildSubjects() {
    var chipsHost = el("div", { class: "row row--tight" });
    var counter = el("div", { class: "fs-sm muted", text: "" });

    var input = el("input", {
      type: "text", name: "customSubject",
      placeholder: "Eigenes Fach, z. B. Wirtschaft",
      "aria-label": "Eigenes Fach hinzufügen"
    });

    function paintChips() {
      U.clear(chipsHost);
      SUBJECT_SUGGESTIONS.concat(draft.extra).forEach(function (name) {
        var key = name.toLowerCase();
        var on = !!draft.selected[key];
        chipsHost.appendChild(el("button", {
          class: "chip", type: "button",
          "aria-pressed": on ? "true" : "false",
          // Name wird escaped, das Symbol stammt aus der festen Icon-Liste.
          html: (on ? U.icon("check") : "") + "<span>" + U.escapeHtml(name) + "</span>",
          onClick: function () {
            if (draft.selected[key]) delete draft.selected[key];
            else draft.selected[key] = true;
            paintChips();
          }
        }));
      });

      var n = selectedNames().length;
      counter.textContent = n === 0
        ? "Noch kein Fach ausgewählt – das kannst du auch später nachholen."
        : (n === 1 ? "1 Fach ausgewählt" : n + " Fächer ausgewählt");
    }

    function addCustom() {
      var raw = String(input.value || "").trim().replace(/\s+/g, " ");
      if (!raw) return;
      if (raw.length > 40) raw = raw.slice(0, 40);
      var key = raw.toLowerCase();
      var known = SUBJECT_SUGGESTIONS.concat(draft.extra).some(function (n) {
        return n.toLowerCase() === key;
      });
      if (!known) draft.extra.push(raw);
      draft.selected[key] = true;
      input.value = "";
      paintChips();
      try { input.focus(); } catch (e) { /* Fokus ist nur Komfort */ }
      if (known) NG.ui.toast("„" + raw + "“ steht schon in der Liste.");
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addCustom(); }
    });

    paintChips();

    var hasExisting = subjectNames().length > 0;

    var content = el("div", { class: "stack" }, [
      el("p", {
        class: "muted",
        text: "Welche Fächer hast du? Tippe alles an, was passt – Kürzel, Farbe und die eben " +
          "gewählte Gewichtung legen wir automatisch dazu an."
      }),
      chipsHost,
      counter,
      el("div", { class: "field" }, [
        el("div", { class: "label", text: "Fehlt ein Fach?" }),
        el("div", { class: "input-group" }, [
          input,
          el("button", {
            class: "btn btn--sm", type: "button",
            html: U.icon("plus") + "<span>Hinzufügen</span>",
            onClick: addCustom
          })
        ]),
        el("div", { class: "field__hint", text: "Eintippen und Enter drücken." })
      ]),
      hasExisting ? el("p", {
        class: "fs-xs faint",
        text: "Fächer, die du schon angelegt hast, sind bereits ausgewählt und werden nicht doppelt erstellt."
      }) : null,
      el("p", {
        class: "fs-xs faint",
        text: "Lehrkraft, Raum und Wunschnote kannst du später bei jedem Fach ergänzen."
      })
    ]);

    return {
      content: content,
      actions: [
        skipAction(),
        "spacer",
        backAction(),
        { label: "Fertig", variant: "primary", onClick: finish }
      ]
    };
  }

  /* =========================================================
     Abschluss und Abbruch
     ========================================================= */

  function finish() {
    if (!draft) draft = newDraft();

    var weights = { written: draft.weights.written, oral: draft.weights.oral };

    // Schon vorhandene Fächer nicht doppelt anlegen.
    var seen = {};
    subjectNames().forEach(function (n) { seen[n.toLowerCase()] = true; });

    var colors = palette();
    var offset = (NG.store.all("subjects") || []).length;
    var fresh = [];

    selectedNames().forEach(function (name) {
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      fresh.push({
        name: name,
        short: shortOf(name),
        color: colors[(offset + fresh.length) % colors.length],
        teacher: "",
        room: "",
        credit: 1,
        weights: { written: weights.written, oral: weights.oral },
        targetGrade: null,
        archived: false
      });
    });

    if (fresh.length) NG.store.addMany("subjects", fresh);

    NG.store.setSetting("gradeScale", draft.scale);
    NG.store.setSetting("defaultWeights", weights);
    NG.store.setSetting("onboarded", true);

    finished = true;
    if (dialog) dialog.close();

    NG.ui.toast("Alles bereit!");
    if (NG.app && NG.app.render) NG.app.render();
  }

  function skip() {
    finished = true;
    NG.store.setSetting("onboarded", true);
    if (dialog) dialog.close();
  }

  /* =========================================================
     Start / Zurücksetzen
     ========================================================= */

  var BUILDERS = [buildWelcome, buildScale, buildWeights, buildSubjects];

  /** Öffnet den Assistenten. Auch aus den Einstellungen manuell aufrufbar. */
  function start() {
    if (dialog) return;   // läuft schon

    draft = newDraft();
    step = 1;
    finished = false;

    dialog = NG.ui.modal({
      title: TITLES[0],
      body: el("div"),
      // Platzhalter, damit der Fuß existiert – wird sofort ersetzt.
      actions: [{ label: "Weiter" }],
      onClose: function () {
        dialog = null;
        draft = null;
        // Wer den Dialog wegklickt, soll nicht bei jedem Start erneut gefragt werden.
        if (!finished) NG.store.setSetting("onboarded", true);
        finished = false;
      }
    });

    show(1);

    // NG.ui.modal setzt den Fokus selbst auf das erste Eingabefeld und scrollt
    // dabei die Fortschrittsanzeige aus dem Bild. Deshalb danach wieder nach
    // oben – der Fokus bleibt im Dialog.
    global.setTimeout(function () {
      if (!dialog || !dialog.el) return;
      var active = document.activeElement;
      if (active && dialog.body.contains(active)) {
        dialog.el.setAttribute("tabindex", "-1");
        dialog.el.style.outline = "none";   // Der Rahmen gehört den Knöpfen, nicht dem Dialog.
        try { dialog.el.focus(); } catch (e) { /* Fokus ist nur Komfort */ }
      }
      dialog.body.scrollTop = 0;
    }, 130);
  }

  /** Lässt den Assistenten beim nächsten Start wieder erscheinen. */
  function reset() {
    NG.store.setSetting("onboarded", false);
  }

  NG.onboarding = { start: start, reset: reset };
})(window);
