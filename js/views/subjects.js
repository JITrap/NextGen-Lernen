/* =========================================================
   NextGen Lernen – Fächer
   Hier verwaltest du deine Fächer. Das Herzstück ist die
   Gewichtung: Wie stark zählen schriftliche Noten, wie stark
   mündliche und sonstige Leistungen?
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Flüchtiger Zustand der Ansicht --------------
     Lebt nur im Arbeitsspeicher und wird bewusst nicht gespeichert. */

  var archivedOpen = false;          // Abschnitt „Archiviert“ aufgeklappt?

  /** Schnellwahl für die Gewichtung: [schriftlich, mündlich]. */
  var PRESET_WEIGHTS = [
    [50, 50], [60, 40], [40, 60], [70, 30], [100, 0], [0, 100]
  ];

  /** Vorschläge für „Typische Fächer hinzufügen“. */
  var PRESET_SUBJECTS = [
    { name: "Deutsch", short: "DE" },
    { name: "Mathematik", short: "MA" },
    { name: "Englisch", short: "EN" },
    { name: "Biologie", short: "BIO" },
    { name: "Chemie", short: "CH" },
    { name: "Physik", short: "PH" },
    { name: "Geschichte", short: "GE" },
    { name: "Erdkunde", short: "EK" },
    { name: "Sport", short: "SP" }
  ];

  /* ---------- Kleine Helfer -------------------------------- */

  function allSubjects() {
    var list = NG.store.all("subjects");
    return Array.isArray(list) ? list : [];
  }

  function nameOf(sub) {
    var n = String(sub && sub.name ? sub.name : "").trim();
    return n || "Ohne Namen";
  }

  function shortOf(sub) {
    var s = String(sub && sub.short ? sub.short : "").trim();
    if (s) return s;
    return nameOf(sub).slice(0, 2).toUpperCase();
  }

  function colorOf(sub) {
    return (sub && sub.color) || "var(--text-faint)";
  }

  /** Gewichtung auf zwei ganze Zahlen bringen, die zusammen 100 ergeben. */
  function normWeights(raw) {
    var w = U.num(raw && raw.written, 50);
    var o = U.num(raw && raw.oral, 50);
    if (w === null) w = 50;
    if (o === null) o = 50;
    w = Math.max(0, w);
    o = Math.max(0, o);
    var sum = w + o;
    if (!(sum > 0)) return { written: 0, oral: 0 };
    var pw = U.clamp(Math.round((w / sum) * 100), 0, 100);
    return { written: pw, oral: 100 - pw };
  }

  /** Wertigkeit (credit) sauber lesen. */
  function creditOf(sub) {
    var c = U.num(sub && sub.credit, 1);
    if (c === null || !(c > 0)) c = 1;
    return U.clamp(c, 0.5, 3);
  }

  /** Zielnote lesen – oder null, wenn keine gesetzt ist. */
  function targetOf(sub) {
    var t = U.num(sub && sub.targetGrade, null);
    return t === null ? null : t;
  }

  function countLabel(n) {
    return n === 1 ? "1 Note" : n + " Noten";
  }

  function textButton(icon, label, cls, onClick) {
    return el("button", { class: cls || "btn", type: "button", onClick: onClick }, [
      U.iconEl(icon),
      el("span", { text: label })
    ]);
  }

  /** Farbe aus der Palette, die noch nicht vergeben ist. */
  function pickColor(palette, used) {
    if (!palette.length) return "#4b5bd4";
    for (var i = 0; i < palette.length; i++) {
      if (used.indexOf(palette[i]) < 0) return palette[i];
    }
    return palette[used.length % palette.length];
  }

  /** In Worte fassen, was die eingestellte Gewichtung bedeutet. */
  function describeWeights(w) {
    if (w.written + w.oral <= 0) return "Ohne Gewichtung kann kein Schnitt berechnet werden.";
    if (w.written >= 100) return "Nur schriftliche Noten zählen – mündliche fließen nicht ein.";
    if (w.oral >= 100) return "Nur mündliche und sonstige Noten zählen – Arbeiten fließen nicht ein.";
    if (w.written === w.oral) return "Schriftlich und mündlich zählen gleich viel.";
    if (w.written > w.oral) return "Schriftliche Noten zählen stärker als mündliche.";
    return "Mündliche und sonstige Noten zählen stärker als schriftliche.";
  }

  /* ---------- Fortschritt zur Zielnote --------------------- */

  /**
   * Wie weit bist du auf dem Weg von „schlechtestmöglich“ bis zur Zielnote?
   * Funktioniert für Noten 1–6 genauso wie für Punkte 0–15.
   */
  function targetProgress(current, target) {
    var s = NG.grades.scale();
    if (current === null || target === null) return null;
    var denom = target - s.worst;
    if (denom === 0) return 100;
    var pct = ((current - s.worst) / denom) * 100;
    return U.clamp(Math.round(pct), 0, 100);
  }

  function targetReached(current, target) {
    if (current === null || target === null) return false;
    if (Math.abs(current - target) < 0.005) return true;
    return NG.grades.isBetter(current, target);
  }

  /* =========================================================
     Karte für ein Fach
     ========================================================= */

  function subjectCard(sub, ctx) {
    var avg = NG.grades.subjectAverage(sub.id);
    var weights = normWeights(avg.weights);
    var hasAny = avg.counts.total > 0;

    /* --- Kopf: Farbe, Name, Kürzel, Bearbeiten --- */
    var head = el("div", { class: "card__head" }, [
      el("span", {
        class: "subject-dot",
        style: { width: "14px", height: "14px", borderRadius: "4px", background: colorOf(sub) }
      }),
      el("div", { style: { minWidth: "0" } },
        el("h3", { class: "truncate", text: nameOf(sub) })),
      el("span", { class: "badge", style: { flexShrink: "0" }, text: shortOf(sub) }),
      el("button", {
        class: "btn btn--icon spacer", type: "button",
        "aria-label": "Fach „" + nameOf(sub) + "“ bearbeiten",
        title: "Bearbeiten",
        html: U.icon("edit"),
        onClick: function () { openDialog(sub, ctx); }
      })
    ]);

    /* --- Schnitt groß + verbale Einordnung --- */
    var verdict = NG.grades.verdict(avg.total);
    var summary = el("div", { class: "row", style: { gap: "var(--sp-3)" } }, [
      NG.ui.gradePill(avg.total, "lg"),
      el("div", { style: { minWidth: "0" } }, [
        el("div", { class: "fw-6", text: hasAny ? (verdict || "Schnitt") : "Noch keine Noten" }),
        el("div", {
          class: "fs-xs faint",
          text: hasAny
            ? "Fachschnitt aus " + countLabel(avg.counts.total)
            : "Trag deine erste Note ein, dann rechnen wir hier mit."
        })
      ]),
      creditOf(sub) !== 1
        ? el("span", {
          class: "badge badge--accent spacer", style: { flexShrink: "0" },
          text: "×" + U.fmtNum(creditOf(sub), 1) + " im Gesamtschnitt"
        })
        : null
    ]);

    /* --- Zeile je Notenart --- */
    function partRow(label, value, count, pct, color) {
      return el("div", { class: "row row--tight" }, [
        el("span", { class: "dot", style: { background: color } }),
        el("span", { class: "fs-sm fw-6", text: label }),
        el("span", { class: "spacer row row--tight" }, [
          count > 0
            ? NG.ui.gradePill(value, "sm")
            : el("span", { class: "fs-xs faint", text: "keine Noten" }),
          el("span", {
            class: "fs-xs faint tnum nowrap",
            text: countLabel(count) + " · " + pct + " %"
          })
        ])
      ]);
    }

    /* --- Gewichtungsbalken + Legende --- */
    var meter = el("div", { class: "meter" }, [
      el("span", { style: { width: weights.written + "%", background: "var(--accent)" } }),
      el("span", { style: { width: weights.oral + "%", background: "var(--info)" } })
    ]);

    function legendItem(color, text) {
      return el("span", { class: "row row--tight" }, [
        el("span", { class: "dot", style: { width: "7px", height: "7px", background: color } }),
        el("span", { text: text })
      ]);
    }

    var legend = el("div", { class: "row row--tight fs-xs faint" }, [
      legendItem("var(--accent)", "Schriftlich " + weights.written + " %"),
      legendItem("var(--info)", "Mündlich " + weights.oral + " %")
    ]);

    /* Hinweis, wenn eine Seite zwar Gewicht hat, aber (noch) keine Noten. */
    var missing = null;
    if (weights.written + weights.oral <= 0) {
      missing = "Für dieses Fach ist keine Gewichtung eingestellt – bitte im Bearbeiten-Dialog nachholen.";
    } else if (hasAny && weights.written > 0 && avg.counts.written === 0) {
      missing = "Schriftliche Noten fehlen noch, deshalb zählt gerade nur der mündliche Teil.";
    } else if (hasAny && weights.oral > 0 && avg.counts.oral === 0) {
      missing = "Mündliche Noten fehlen noch, deshalb zählt gerade nur der schriftliche Teil.";
    }

    var body = el("div", { class: "card__body stack" }, [
      summary,
      el("div", { class: "stack stack--sm" }, [
        partRow("Schriftlich", avg.written, avg.counts.written, weights.written, "var(--accent)"),
        partRow("Mündlich/Sonstige", avg.oral, avg.counts.oral, weights.oral, "var(--info)")
      ]),
      el("div", { class: "stack stack--sm" }, [
        meter,
        legend,
        missing ? el("div", { class: "fs-xs faint", text: missing }) : null
      ])
    ]);

    /* --- Fuß: Lehrkraft, Raum, Zielnote --- */
    var footParts = [];
    if (String(sub.teacher || "").trim()) footParts.push(String(sub.teacher).trim());
    if (String(sub.room || "").trim()) footParts.push("Raum " + String(sub.room).trim());

    var footRows = [
      el("div", { class: "row row--tight" }, [
        U.iconEl("users"),
        el("span", {
          class: "truncate",
          text: footParts.length ? footParts.join(" · ") : "Lehrkraft und Raum noch nicht eingetragen"
        })
      ])
    ];

    var target = targetOf(sub);
    if (target !== null) {
      var reached = targetReached(avg.total, target);
      var pct = targetProgress(avg.total, target);
      footRows.push(el("div", { class: "stack stack--sm", style: { marginTop: "var(--sp-2)" } }, [
        el("div", { class: "row row--tight" }, [
          U.iconEl("target"),
          el("span", { text: "Ziel: " + NG.grades.format(target) }),
          el("span", {
            class: "spacer fs-xs tnum nowrap",
            style: reached ? { color: "var(--success)" } : null,
            text: pct === null ? "noch keine Noten" : (reached ? "erreicht" : pct + " % geschafft")
          })
        ]),
        pct === null ? null : el("div", { class: "progress" },
          el("div", {
            class: "progress__bar",
            style: { width: pct + "%", background: reached ? "var(--success)" : "var(--accent)" }
          }))
      ]));
    }

    return el("div", { class: "card" }, [
      head,
      body,
      el("div", { class: "card__foot" }, footRows)
    ]);
  }

  /* =========================================================
     Baustein: Gewichtung (wird als `extra` an formModal gehängt)
     ========================================================= */

  function buildWeightBlock(initial) {
    var current = normWeights(initial);
    if (current.written + current.oral <= 0) current = { written: 50, oral: 50 };

    function readPct(input) {
      var raw = input.value === "" ? 0 : U.num(input.value, 0);
      if (raw === null) raw = 0;
      return U.clamp(Math.round(raw), 0, 100);
    }

    var wId = U.uid("wgt_w");
    var oId = U.uid("wgt_o");
    var wIn = el("input", {
      type: "number", id: wId, min: "0", max: "100", step: "5",
      inputmode: "numeric", "aria-label": "Anteil schriftlich in Prozent"
    });
    var oIn = el("input", {
      type: "number", id: oId, min: "0", max: "100", step: "5",
      inputmode: "numeric", "aria-label": "Anteil mündlich in Prozent"
    });

    var barW = el("span", { style: { background: "var(--accent)" } });
    var barO = el("span", { style: { background: "var(--info)" } });
    var meter = el("div", { class: "meter" }, [barW, barO]);

    var legW = el("span", {});
    var legO = el("span", {});
    var hint = el("div", { class: "fs-xs faint" });

    var chips = PRESET_WEIGHTS.map(function (pair) {
      var btn = el("button", {
        class: "chip", type: "button",
        text: pair[0] + " / " + pair[1],
        onClick: function () {
          current = { written: pair[0], oral: pair[1] };
          paint(true);
        }
      });
      btn._pair = pair;
      return btn;
    });

    function paint(writeInputs) {
      if (writeInputs) {
        wIn.value = String(current.written);
        oIn.value = String(current.oral);
      }
      barW.style.width = current.written + "%";
      barO.style.width = current.oral + "%";
      legW.textContent = "Schriftlich " + current.written + " %";
      legO.textContent = "Mündlich & Sonstige " + current.oral + " %";
      hint.textContent = describeWeights(current);
      chips.forEach(function (c) {
        var on = c._pair[0] === current.written && c._pair[1] === current.oral;
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    wIn.addEventListener("input", function () {
      var a = readPct(wIn);
      current = { written: a, oral: 100 - a };
      oIn.value = String(current.oral);
      paint(false);
    });
    oIn.addEventListener("input", function () {
      var b = readPct(oIn);
      current = { written: 100 - b, oral: b };
      wIn.value = String(current.written);
      paint(false);
    });
    // Beim Verlassen des Feldes krumme Eingaben glattziehen
    wIn.addEventListener("change", function () { paint(true); });
    oIn.addEventListener("change", function () { paint(true); });

    function legendItem(color, node) {
      return el("span", { class: "row row--tight" }, [
        el("span", { class: "dot", style: { width: "7px", height: "7px", background: color } }),
        node
      ]);
    }

    var node = el("div", { class: "stack stack--sm" }, [
      el("div", { class: "section-title", text: "Gewichtung der Noten" }),
      el("p", {
        class: "muted fs-sm",
        text: "Lege fest, wie stark die beiden Notenarten in den Fachschnitt einfließen. " +
          "Beide Werte ergänzen sich automatisch zu 100 %."
      }),
      el("div", { class: "row row--tight" }, [
        el("div", { class: "field", style: { flex: "1 1 120px" } }, [
          el("label", { for: wId, text: "Schriftlich %" }), wIn
        ]),
        el("div", { class: "field", style: { flex: "1 1 120px" } }, [
          el("label", { for: oId, text: "Mündlich/Sonstige %" }), oIn
        ])
      ]),
      meter,
      el("div", { class: "row row--tight fs-xs faint" }, [
        legendItem("var(--accent)", legW),
        legendItem("var(--info)", legO)
      ]),
      hint,
      el("div", { class: "row row--tight" }, chips)
    ]);

    paint(true);

    return {
      el: node,
      get: function () { return { written: current.written, oral: current.oral }; }
    };
  }

  /* =========================================================
     Baustein: Farbe (ebenfalls im extra-Block)
     ========================================================= */

  function buildColorBlock(initialColor) {
    var palette = (NG.store.PALETTE || []).slice();
    if (!palette.length) palette = ["#4b5bd4"];
    var current = initialColor || palette[0];
    if (palette.indexOf(current) < 0) palette.unshift(current);

    var buttons = [];
    var row = el("div", { class: "row row--tight" });

    palette.forEach(function (color, i) {
      var btn = el("button", {
        type: "button", class: "dot",
        "aria-label": "Farbe " + (i + 1) + " auswählen",
        style: {
          width: "26px", height: "26px", borderRadius: "50%",
          background: color, border: "0", padding: "0", cursor: "pointer"
        },
        onClick: function () { current = color; paint(); }
      });
      btn._color = color;
      buttons.push(btn);
      row.appendChild(btn);
    });

    function paint() {
      buttons.forEach(function (b) {
        var on = b._color === current;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.style.boxShadow = on
          ? "0 0 0 2px var(--surface), 0 0 0 4px var(--text)"
          : "none";
      });
    }
    paint();

    var node = el("div", { class: "stack stack--sm" }, [
      el("div", { class: "section-title", text: "Farbe" }),
      el("p", {
        class: "muted fs-sm",
        text: "An dieser Farbe erkennst du das Fach im Stundenplan, im Kalender und in den Noten."
      }),
      row
    ]);

    return { el: node, get: function () { return current; } };
  }

  /* =========================================================
     Dialog: Fach anlegen / bearbeiten
     ========================================================= */

  function openDialog(sub, ctx) {
    var isNew = !sub;
    var scale = NG.grades.scale();
    var defaults = NG.store.getSetting("defaultWeights", { written: 50, oral: 50 });

    var weightBlock = buildWeightBlock(sub && sub.weights ? sub.weights : defaults);
    var colorBlock = buildColorBlock(sub ? sub.color : NG.store.nextColor());
    var extra = el("div", { class: "stack" }, [weightBlock.el, colorBlock.el]);

    var fields = [
      { name: "name", label: "Fachname", type: "text", required: true, full: true, placeholder: "z. B. Mathematik" },
      { name: "short", label: "Kürzel", type: "text", hint: "z.B. MA", placeholder: "MA" },
      { name: "teacher", label: "Lehrkraft", type: "text", placeholder: "z. B. Frau Meier" },
      { name: "room", label: "Raum", type: "text", placeholder: "z. B. B203" },
      {
        name: "credit", label: "Wertigkeit im Gesamtschnitt", type: "number",
        min: 0.5, max: 3, step: 0.5, hint: "2 = zählt doppelt"
      },
      {
        name: "targetGrade", label: "Zielnote", type: "number",
        min: scale.min, max: scale.max, step: scale.step,
        hint: "Optional – leer lassen, wenn du kein Ziel setzen willst."
      },
      {
        name: "archived", label: "Fach archivieren", type: "checkbox", full: true,
        hint: "Archivierte Fächer bleiben erhalten, zählen aber nicht mehr im Gesamtschnitt mit."
      }
    ];

    var values = {
      name: sub ? sub.name || "" : "",
      short: sub ? sub.short || "" : "",
      teacher: sub ? sub.teacher || "" : "",
      room: sub ? sub.room || "" : "",
      credit: sub ? creditOf(sub) : 1,
      targetGrade: sub ? targetOf(sub) : null,
      archived: sub ? !!sub.archived : false
    };

    NG.ui.formModal({
      title: isNew ? "Neues Fach" : "Fach bearbeiten",
      intro: isNew
        ? "Name und Gewichtung reichen für den Anfang – alles andere kannst du später ergänzen."
        : "Ändere hier vor allem die Gewichtung, wenn schriftliche und mündliche Noten unterschiedlich zählen.",
      fields: fields,
      values: values,
      submitText: isNew ? "Fach anlegen" : "Speichern",
      extra: extra,
      onDelete: sub ? function () {
        NG.store.removeSubject(sub.id);
        NG.ui.toast("Fach „" + nameOf(sub) + "“ gelöscht.", "success");
        ctx.rerender();
      } : null,
      deleteMessage: sub
        ? ("Damit verschwinden auch alle Noten von „" + nameOf(sub) + "“ und alle Einträge dieses Fachs " +
          "im Stundenplan. Termine, Aufgaben und Materialien bleiben erhalten, verlieren aber die " +
          "Zuordnung zum Fach. Rückgängig machen geht nicht.")
        : "",
      beforeSubmit: function (data) {
        if (!String(data.name || "").trim()) return "Bitte gib dem Fach einen Namen.";
        var w = weightBlock.get();
        if (w.written + w.oral <= 0) return "Die Gewichtung darf nicht 0 % sein.";
        return null;
      }
    }).then(function (data) {
      if (!data) return;   // Abbruch oder Löschen – beides schon erledigt
      saveSubject(sub, data, weightBlock.get(), colorBlock.get());
      NG.ui.toast(isNew ? "Fach angelegt." : "Änderungen gespeichert.", "success");
      ctx.rerender();
    });
  }

  /** Werte aus Formular, Gewichtungs- und Farbblock zusammenführen und speichern. */
  function saveSubject(sub, data, weights, color) {
    var name = String(data.name || "").trim();
    var short = String(data.short || "").trim();
    if (!short) short = name.slice(0, 2).toUpperCase();

    var credit = U.num(data.credit, 1);
    if (credit === null || !(credit > 0)) credit = 1;
    credit = U.clamp(credit, 0.5, 3);

    var target = U.num(data.targetGrade, null);
    if (target !== null && !NG.grades.isValid(target)) target = null;

    var patch = {
      name: name,
      short: short.slice(0, 5),
      teacher: String(data.teacher || "").trim(),
      room: String(data.room || "").trim(),
      credit: credit,
      targetGrade: target,
      archived: !!data.archived,
      color: color,
      weights: { written: weights.written, oral: weights.oral }
    };

    if (sub) NG.store.update("subjects", sub.id, patch);
    else NG.store.add("subjects", patch);
  }

  /* =========================================================
     Typische Fächer in einem Rutsch anlegen
     ========================================================= */

  function addPresetSubjects(ctx) {
    var existing = allSubjects().map(function (s) { return nameOf(s).toLowerCase(); });
    var usedColors = allSubjects().map(function (s) { return s.color; });
    var palette = (NG.store.PALETTE || []).slice();
    var weights = normWeights(NG.store.getSetting("defaultWeights", { written: 50, oral: 50 }));
    if (weights.written + weights.oral <= 0) weights = { written: 50, oral: 50 };

    var fresh = [];
    PRESET_SUBJECTS.forEach(function (p) {
      if (existing.indexOf(p.name.toLowerCase()) >= 0) return;
      var color = pickColor(palette, usedColors);
      usedColors.push(color);
      fresh.push({
        name: p.name,
        short: p.short,
        color: color,
        teacher: "",
        room: "",
        credit: 1,
        weights: { written: weights.written, oral: weights.oral },
        targetGrade: null,
        archived: false
      });
    });

    if (!fresh.length) {
      NG.ui.toast("Diese Fächer hast du schon alle.", "warn");
      return;
    }

    NG.store.addMany("subjects", fresh);
    NG.ui.toast(fresh.length + " Fächer angelegt – Gewichtung und Farbe kannst du jederzeit ändern.", "success");
    ctx.rerender();
  }

  /* =========================================================
     Leerzustand
     ========================================================= */

  function emptyState(ctx) {
    var node = NG.ui.empty({
      icon: "book",
      title: "Noch keine Fächer",
      text: "Lege deine Fächer an. Danach stellst du je Fach ein, wie stark schriftliche " +
        "und mündliche Noten in den Schnitt einfließen.",
      action: {
        label: "Fach anlegen",
        onClick: function () { openDialog(null, ctx); }
      }
    });

    node.appendChild(el("button", {
      class: "btn", type: "button",
      style: { marginLeft: "var(--sp-2)" },
      onClick: function () { addPresetSubjects(ctx); }
    }, [
      U.iconEl("sparkles"),
      el("span", { text: "Typische Fächer hinzufügen" })
    ]));

    return node;
  }

  /* =========================================================
     Abschnitt: archivierte Fächer
     ========================================================= */

  function archivedSection(list, ctx) {
    var toggle = el("button", {
      class: "btn btn--sm btn--ghost spacer", type: "button",
      "aria-expanded": archivedOpen ? "true" : "false",
      onClick: function () { archivedOpen = !archivedOpen; ctx.rerender(); }
    }, [
      U.iconEl("chevronDown"),
      el("span", { text: archivedOpen ? "Verbergen" : "Anzeigen" })
    ]);

    var head = el("div", { class: "card__head" }, [
      el("h3", { text: "Archiviert" }),
      el("span", { class: "badge", text: String(list.length) }),
      toggle
    ]);

    var children = [head];

    if (archivedOpen) {
      var rows = el("div", { class: "list" });
      list.forEach(function (sub) {
        var avg = NG.grades.subjectAverage(sub.id);
        rows.appendChild(el("div", { class: "list__item" }, [
          el("span", {
            class: "subject-dot",
            style: { width: "12px", height: "12px", background: colorOf(sub) }
          }),
          el("div", { class: "list__main" }, [
            el("div", { class: "list__title", text: nameOf(sub) }),
            el("div", { class: "list__meta" }, [
              el("span", { text: shortOf(sub) }),
              el("span", {
                text: avg.counts.total > 0
                  ? countLabel(avg.counts.total) + " · Schnitt " + NG.grades.format(avg.total)
                  : "keine Noten"
              })
            ])
          ]),
          el("div", { class: "list__actions" }, [
            textButton("refresh", "Zurückholen", "btn btn--sm", function () {
              NG.store.update("subjects", sub.id, { archived: false });
              NG.ui.toast("„" + nameOf(sub) + "“ ist wieder aktiv.", "success");
              ctx.rerender();
            }),
            el("button", {
              class: "btn btn--icon", type: "button",
              "aria-label": "„" + nameOf(sub) + "“ bearbeiten",
              html: U.icon("edit"),
              onClick: function () { openDialog(sub, ctx); }
            })
          ])
        ]));
      });
      children.push(el("div", { class: "card__body card__body--flush" }, rows));
      children.push(el("div", { class: "card__foot" },
        el("span", { text: "Archivierte Fächer zählen nicht im Gesamtschnitt mit, ihre Noten bleiben aber gespeichert." })));
    }

    return el("div", { class: "card" }, children);
  }

  /* =========================================================
     Ansicht
     ========================================================= */

  function render(root, ctx) {
    var list = allSubjects();
    var active = U.sortBy(
      list.filter(function (s) { return !s.archived; }),
      function (s) { return nameOf(s).toLowerCase(); }, "asc");
    var archived = U.sortBy(
      list.filter(function (s) { return !!s.archived; }),
      function (s) { return nameOf(s).toLowerCase(); }, "asc");

    var stack = el("div", { class: "stack" });

    if (list.length) {
      stack.appendChild(el("div", {
        class: "row row--tight muted fs-sm",
        style: { alignItems: "flex-start" }
      }, [
        el("span", { style: { flexShrink: "0", marginTop: "1px" }, html: U.icon("info") }),
        el("span", {
          style: { flex: "1 1 240px" },
          text: "Die Gewichtung bestimmt, wie stark schriftliche und mündliche Noten in deinen " +
            "Fachschnitt einfließen. Über „Bearbeiten“ änderst du sie für ein einzelnes Fach."
        })
      ]));
    }

    if (!active.length) {
      stack.appendChild(emptyState(ctx));
    } else {
      var grid = el("div", { class: "grid grid--2" });
      active.forEach(function (sub) { grid.appendChild(subjectCard(sub, ctx)); });
      stack.appendChild(grid);
    }

    if (archived.length) {
      stack.appendChild(el("div", { class: "section-title", text: "Archiv" }));
      stack.appendChild(archivedSection(archived, ctx));
    }

    root.appendChild(stack);
  }

  /* ---------- Registrierung --------------------------------- */

  NG.app.register({
    id: "subjects",
    title: "Fächer",
    subtitle: "Gewichtung, Farbe und Wertigkeit je Fach",
    icon: "book",
    group: "grades",
    order: 5,
    tab: false,
    render: render,

    actions: function (ctx) {
      return [
        textButton("plus", "Neues Fach", "btn btn--sm btn--primary",
          function () { openDialog(null, ctx); })
      ];
    },

    primaryAction: function (ctx) {
      return {
        label: "Neues Fach",
        icon: "plus",
        onClick: function () { openDialog(null, ctx); }
      };
    }
  });
})(window);
