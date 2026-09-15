/* =========================================================
   NextGen Lernen – Noten
   Alle Leistungen pro Fach, gewichtete Durchschnitte,
   ein Rechner für die nächste Arbeit und eine Gesamtliste.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Flüchtiger Zustand der Ansicht --------------
     Lebt nur im Arbeitsspeicher und übersteht ein Neu-Rendern,
     wird aber bewusst nicht gespeichert. */

  var tableSort = { key: "date", dir: "desc" };   // key: "date" | "value"
  var tableFilter = "all";                        // "all" | "none" | Fach-Id
  var calc = { subjectId: null, target: null, type: "written", weight: 1 };

  var CATEGORIES = [
    "Klassenarbeit", "Klausur", "Test", "Kurzkontrolle", "Referat",
    "Präsentation", "Mitarbeit", "Hausaufgabe", "Projekt", "Sonstiges"
  ];

  var WEIGHTS = [
    { value: 0.5, label: "halb (×0,5)" },
    { value: 1, label: "einfach (×1)" },
    { value: 2, label: "doppelt (×2)" },
    { value: 3, label: "dreifach (×3)" }
  ];

  /* ---------- Kleine Helfer -------------------------------- */

  function allGrades() {
    var list = NG.store.all("grades");
    return Array.isArray(list) ? list : [];
  }

  function valueOf(g) { return U.num(g && g.value, null); }

  function typeOf(g) { return (g && g.type) === "oral" ? "oral" : "written"; }

  function weightOf(g) {
    var w = U.num(g && g.weight, 1);
    return w !== null && w > 0 ? w : 1;
  }

  function dateOf(g) {
    var raw = g && g.date ? String(g.date) : "";
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
  }

  function titleOf(g) { return String((g && g.title) || "").trim(); }

  function categoryOf(g) { return String((g && g.category) || "").trim(); }

  /** Titel für die Anzeige – fällt auf die Kategorie zurück. */
  function labelOf(g) { return titleOf(g) || categoryOf(g) || "Ohne Titel"; }

  function typeLabel(type) {
    return type === "oral" ? "Mündlich & Sonstiges" : "Schriftlich";
  }

  function typeLabelShort(type) {
    return type === "oral" ? "Mündlich" : "Schriftlich";
  }

  function weightLabel(w) {
    return "×" + U.fmtNum(w, w % 1 === 0 ? 0 : 1);
  }

  function gradesOfSubject(subjectId) {
    return allGrades().filter(function (g) {
      return g.subjectId === subjectId && valueOf(g) !== null;
    });
  }

  /** Chronologisch, älteste zuerst; Noten ohne Datum ans Ende. */
  function byDateAsc(list) {
    return U.sortBy(list, function (g) { return dateOf(g); }, "asc");
  }

  function pct(n) {
    var v = U.num(n, 0);
    return Math.round(v === null ? 0 : v) + " %";
  }

  /** Vorschlag für die Zielnote eines Fachs (im aktuell eingestellten System). */
  function defaultTarget(sub) {
    var own = U.num(sub && sub.targetGrade, null);
    if (own !== null) return own;
    var fromSettings = U.num(NG.store.getSetting("targetGrade", null), null);
    if (fromSettings !== null) return fromSettings;
    // „2“ als freundliches Standardziel – im Punktesystem der passende Gegenwert
    return NG.grades.fromGrade(2);
  }

  /* ---------- Bausteine ------------------------------------ */

  function textButton(icon, label, cls, onClick) {
    return el("button", { class: cls || "btn", type: "button", onClick: onClick }, [
      icon ? U.iconEl(icon) : null,
      el("span", { text: label })
    ]);
  }

  /** Leichter Hover-Hinweis für Knöpfe, die keine .btn-Klasse tragen. */
  function hoverable(node) {
    function on() { node.style.background = "var(--surface-2)"; }
    function off() { node.style.background = "none"; }
    node.addEventListener("mouseenter", on);
    node.addEventListener("mouseleave", off);
    node.addEventListener("focus", on);
    node.addEventListener("blur", off);
    return node;
  }

  function fieldWrap(label, control, hint, full) {
    var node = el("div", { class: "field" }, [
      el("label", { class: "label", text: label }),
      control,
      hint ? el("div", { class: "field__hint", text: hint }) : null
    ]);
    if (full) node.style.gridColumn = "1 / -1";
    return node;
  }

  function selectEl(options, value, onChange, aria) {
    var sel = el("select", { "aria-label": aria || null, onChange: onChange },
      options.map(function (o) {
        return el("option", { value: o.value === null ? "" : String(o.value), text: o.label });
      }));
    sel.value = value === null || value === undefined ? "" : String(value);
    return sel;
  }

  /** Fach-Auswahl: aktive Fächer, bei Bedarf plus ein bestimmtes Altfach. */
  function subjectChoices(includeId) {
    var out = NG.store.activeSubjects().map(function (s) {
      return { value: s.id, label: s.name };
    });
    if (includeId && !out.some(function (o) { return o.value === includeId; })) {
      var sub = NG.store.subject(includeId);
      if (sub) out.unshift({ value: sub.id, label: sub.name + (sub.archived ? " (archiviert)" : "") });
    }
    return out;
  }

  /* ---------- Kopfbereich ---------------------------------- */

  function overallTile(overall) {
    var hasValue = overall.value !== null && overall.value !== undefined;
    return el("div", { class: "stat" }, [
      el("div", { class: "stat__label", text: "Gesamtschnitt" }),
      el("div", { class: "row row--tight", style: { marginTop: "2px" } }, [
        hasValue
          ? NG.ui.gradePill(overall.value, "lg")
          : el("div", { class: "stat__value", text: "—" }),
        el("span", {
          class: "fs-sm muted",
          text: hasValue ? NG.grades.verdict(overall.value) : "noch keine Noten"
        })
      ]),
      el("div", {
        class: "stat__note",
        text: hasValue
          ? "über " + overall.count + (overall.count === 1 ? " Fach" : " Fächer")
          : "Trag deine erste Note ein."
      })
    ]);
  }

  function subjectTile(label, entry, note) {
    if (!entry) return NG.ui.stat(label, "—", note || "Noch keine Noten");
    return el("div", { class: "stat" }, [
      el("div", { class: "stat__label", text: label }),
      el("div", { class: "row row--tight", style: { marginTop: "2px", minWidth: "0" } }, [
        NG.ui.gradePill(entry.avg.total),
        el("span", {
          class: "fw-6 truncate",
          style: { minWidth: "0", flex: "1 1 auto" },
          title: entry.subject.name,
          text: entry.subject.name
        })
      ]),
      el("div", { class: "stat__note", text: NG.grades.verdict(entry.avg.total) })
    ]);
  }

  function headerGrid(overall, counts) {
    var best = null, worst = null;
    overall.subjects.forEach(function (entry) {
      if (entry.avg.total === null) return;
      if (!best || NG.grades.isBetter(entry.avg.total, best.avg.total)) best = entry;
      if (!worst || NG.grades.isBetter(worst.avg.total, entry.avg.total)) worst = entry;
    });
    // Bei nur einem Fach mit Noten ist „bestes“ gleich „schwächstes“ – dann reicht eines.
    if (best && worst && best.subject.id === worst.subject.id) worst = null;

    return el("div", { class: "grid grid--4" }, [
      overallTile(overall),
      NG.ui.stat(
        "Noten insgesamt",
        String(counts.total),
        counts.total
          ? counts.written + " schriftlich · " + counts.oral + " mündlich"
          : "Noch nichts eingetragen"
      ),
      subjectTile("Bestes Fach", best, "Noch keine Noten"),
      subjectTile("Schwächstes Fach", worst, best ? "Nur ein Fach mit Noten" : "Noch keine Noten")
    ]);
  }

  function scaleRow(ctx) {
    var current = NG.grades.scaleId();

    function scaleButton(id, label) {
      return el("button", {
        type: "button",
        text: label,
        "aria-pressed": current === id ? "true" : "false",
        onClick: function () {
          if (NG.grades.scaleId() === id) return;
          NG.store.setSetting("gradeScale", id);
          NG.ui.toast("Notensystem umgestellt – eingetragene Werte bleiben unverändert.", "warn", 5000);
          ctx.rerender();
        }
      });
    }

    return el("div", { class: "row row--tight" }, [
      el("span", { class: "fs-sm fw-6", text: "Notensystem:" }),
      el("div", { class: "btn-group", role: "group", "aria-label": "Notensystem wählen" }, [
        scaleButton("de6", "Noten 1–6"),
        scaleButton("points15", "Punkte 0–15")
      ]),
      el("span", {
        class: "fs-xs faint",
        style: { flex: "1 1 220px", minWidth: "0" },
        text: "Achtung: Schon eingetragene Werte werden nicht umgerechnet – sie behalten ihre Zahl."
      })
    ]);
  }

  /* ---------- Eine Note als kleiner Knopf ------------------- */

  function gradeCell(g, ctx) {
    var date = dateOf(g);
    var sub = NG.store.subject(g.subjectId);
    var w = weightOf(g);

    var cell = el("button", {
      type: "button",
      title: labelOf(g) + " · " + NG.grades.format(valueOf(g)) +
        (date ? " · " + U.fmtDate(date, { style: "numeric" }) : ""),
      "aria-label": "Note bearbeiten: " + labelOf(g) + ", " + NG.grades.format(valueOf(g)) +
        (sub ? ", " + sub.name : ""),
      style: {
        display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
        background: "none", border: "0", borderRadius: "var(--radius-sm)",
        padding: "5px 6px", cursor: "pointer", font: "inherit", color: "inherit",
        width: "88px", minWidth: "0"
      },
      onClick: function () { openGradeDialog(g, ctx); }
    }, [
      el("span", {
        class: "grade-pill grade-pill--sm " + NG.grades.gradeClass(valueOf(g)),
        text: NG.grades.format(valueOf(g))
      }),
      el("span", {
        class: "fs-xs muted truncate",
        style: { display: "block", maxWidth: "84px" },
        text: labelOf(g)
      }),
      el("span", {
        class: "fs-xs faint truncate",
        style: { display: "block", maxWidth: "84px" },
        text: (date ? U.fmtDate(date, { style: "short" }) : "ohne Datum") +
          (w !== 1 ? " · " + weightLabel(w) : "")
      })
    ]);

    return hoverable(cell);
  }

  /* ---------- Eine Spalte (schriftlich / mündlich) ---------- */

  function typeColumn(sub, avg, type, ctx) {
    var share = type === "written" ? avg.weights.written : avg.weights.oral;
    var value = type === "written" ? avg.written : avg.oral;
    var count = type === "written" ? avg.counts.written : avg.counts.oral;

    var list = byDateAsc(gradesOfSubject(sub.id).filter(function (g) {
      return typeOf(g) === type;
    }));

    var head = el("div", { class: "row row--tight" }, [
      el("span", { class: "fs-sm fw-6", text: typeLabel(type) + " (" + pct(share) + ")" }),
      el("span", { class: "spacer" }),
      value === null
        ? el("span", { class: "fs-sm faint", text: "—" })
        : NG.ui.gradePill(value)
    ]);

    var body = list.length
      ? el("div", { class: "row row--tight", style: { alignItems: "flex-start" } },
        list.map(function (g) { return gradeCell(g, ctx); }))
      : el("p", {
        class: "fs-sm faint",
        text: type === "written"
          ? "Noch keine schriftliche Note."
          : "Noch keine mündliche Note."
      });

    return el("div", { class: "stack stack--sm", style: { minWidth: "0" } }, [
      head,
      el("div", {
        class: "fs-xs faint",
        text: count === 1 ? "1 Note zählt hier mit" : count + " Noten zählen hier mit"
      }),
      body
    ]);
  }

  /* ---------- Fach-Karte ------------------------------------ */

  function subjectCard(sub, ctx) {
    var avg = NG.grades.subjectAverage(sub.id);
    var count = avg.counts.total;
    var target = U.num(sub.targetGrade, null);

    var addBtn = textButton("plus", "Note hinzufügen", "btn btn--sm",
      function () { openGradeDialog(null, ctx, sub.id); });

    var head = el("div", { class: "card__head" }, [
      el("span", { class: "subject-dot", style: { background: sub.color || "var(--text-faint)" } }),
      el("h3", { text: sub.name }),
      target !== null
        ? el("span", { class: "badge", text: "Ziel " + NG.grades.format(target) })
        : null,
      el("div", { class: "row row--tight spacer" }, [
        avg.total === null
          ? el("span", { class: "fs-sm faint", text: "—" })
          : NG.ui.gradePill(avg.total),
        addBtn
      ])
    ]);

    if (!count) {
      // Fächer ohne Noten bleiben bewusst kompakt
      return el("div", { class: "card" }, [
        head,
        el("div", { class: "card__body" },
          el("p", {
            class: "fs-sm muted",
            text: "Noch keine Note in " + sub.name + ". Sobald du eine einträgst, rechnet dir die App " +
              "den Schnitt mit " + pct(avg.weights.written) + " schriftlich und " +
              pct(avg.weights.oral) + " mündlich aus."
          }))
      ]);
    }

    var footParts = ["Schnitt gewichtet: " + pct(avg.weights.written) + " schriftlich, " +
      pct(avg.weights.oral) + " mündlich"];
    if (avg.written === null || avg.oral === null) {
      footParts.push("Solange eine Spalte leer ist, zählt nur die andere.");
    }
    var trend = NG.grades.trend(sub.id, 60);
    if (trend && trend.direction === "up") footParts.push("Zuletzt ging es aufwärts – weiter so!");
    else if (trend && trend.direction === "down") footParts.push("Zuletzt ging es etwas bergab.");

    return el("div", { class: "card" }, [
      head,
      el("div", { class: "card__body" },
        el("div", { class: "grid grid--2" }, [
          typeColumn(sub, avg, "written", ctx),
          typeColumn(sub, avg, "oral", ctx)
        ])),
      el("div", { class: "card__foot", text: footParts.join(" · ") })
    ]);
  }

  /* ---------- Notenrechner ---------------------------------- */

  function calculatorCard(ctx) {
    var subjects = NG.store.activeSubjects();

    if (!subjects.some(function (s) { return s.id === calc.subjectId; })) {
      calc.subjectId = subjects[0].id;
      calc.target = null;
    }
    var sub = NG.store.subject(calc.subjectId);
    if (calc.target === null || calc.target === undefined) calc.target = defaultTarget(sub);

    var result = el("div", {
      style: {
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "var(--sp-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        flexWrap: "wrap",
        minHeight: "62px"
      },
      role: "status",
      "aria-live": "polite"
    });

    var targetInput = el("input", {
      type: "number",
      step: String(NG.grades.scale().step),
      min: String(NG.grades.scale().min),
      max: String(NG.grades.scale().max),
      inputmode: "decimal",
      "aria-label": "Zielnote",
      onInput: function (e) {
        calc.target = U.num(e.target.value, null);
        paint();
      }
    });
    targetInput.value = calc.target === null ? "" : String(calc.target);

    var subjectSel = selectEl(
      subjects.map(function (s) { return { value: s.id, label: s.name }; }),
      calc.subjectId,
      function (e) {
        calc.subjectId = e.target.value;
        calc.target = defaultTarget(NG.store.subject(calc.subjectId));
        targetInput.value = calc.target === null ? "" : String(calc.target);
        paint();
      },
      "Fach für den Rechner"
    );

    function typeButton(type, label) {
      return el("button", {
        type: "button",
        text: label,
        "aria-pressed": calc.type === type ? "true" : "false",
        style: { flex: "1 1 0", minWidth: "0" },
        onClick: function () {
          if (calc.type === type) return;
          calc.type = type;
          U.$$("[data-calc-type]", typeGroup).forEach(function (b) {
            b.setAttribute("aria-pressed", b.dataset.calcType === type ? "true" : "false");
          });
          paint();
        },
        dataset: { calcType: type }
      });
    }

    var typeGroup = el("div", {
      class: "btn-group", role: "group", "aria-label": "Art der nächsten Leistung",
      style: { width: "100%" }
    }, [
      typeButton("written", "Schriftlich"),
      typeButton("oral", "Mündlich")
    ]);

    var weightSel = selectEl(
      WEIGHTS.map(function (w) { return { value: w.value, label: w.label }; }),
      calc.weight,
      function (e) {
        var w = U.num(e.target.value, 1);
        calc.weight = w !== null && w > 0 ? w : 1;
        paint();
      },
      "Gewicht der nächsten Leistung"
    );

    function paint() {
      U.clear(result);
      var current = NG.store.subject(calc.subjectId);
      if (!current) {
        result.appendChild(el("span", { class: "fs-sm muted", text: "Wähle zuerst ein Fach aus." }));
        return;
      }
      var target = U.num(calc.target, null);
      if (target === null) {
        result.appendChild(el("span", { class: "fs-sm muted", text: "Trag ein Ziel ein, dann rechne ich für dich." }));
        return;
      }
      if (!NG.grades.isValid(target)) {
        var s = NG.grades.scale();
        result.appendChild(el("span", {
          class: "fs-sm muted",
          text: "Dein Ziel muss zwischen " + U.fmtNum(s.min, 0) + " und " + U.fmtNum(s.max, 0) + " liegen."
        }));
        return;
      }

      var r = NG.grades.neededFor(current.id, target, calc.type, calc.weight);
      if (r && r.reachable && r.value !== null) {
        result.appendChild(NG.ui.gradePill(r.value, "lg"));
        result.appendChild(el("div", { style: { flex: "1 1 220px", minWidth: "0" } }, [
          el("div", {
            class: "fw-6",
            text: "Du brauchst in der nächsten " +
              (calc.type === "written" ? "schriftlichen" : "mündlichen") +
              " Leistung mindestens " + NG.grades.format(r.value) + "."
          }),
          el("div", {
            class: "fs-sm muted",
            text: (NG.grades.scale().lowerIsBetter
              ? "Schlechter darf sie nicht ausfallen, sonst rutscht der Schnitt unter "
              : "Weniger darf es nicht sein, sonst rutscht der Schnitt unter ") +
              NG.grades.format(target) + " in " + current.name + "."
          })
        ]));
      } else {
        result.appendChild(U.iconEl("info"));
        result.appendChild(el("span", {
          class: "fs-sm muted",
          style: { flex: "1 1 220px", minWidth: "0" },
          text: (r && r.reason) || "Das lässt sich gerade nicht ausrechnen."
        }));
      }
    }

    paint();

    return NG.ui.card({
      title: "Was brauche ich noch?",
      body: el("div", { class: "stack" }, [
        el("p", {
          class: "fs-sm muted",
          text: "Sag mir dein Ziel – ich rechne dir aus, was in der nächsten Leistung mindestens drin sein muss."
        }),
        el("div", { class: "form-grid" }, [
          fieldWrap("Fach", subjectSel),
          fieldWrap("Zielnote", targetInput, "Vorbelegt mit dem Ziel aus deinem Fach."),
          fieldWrap("Art der Leistung", typeGroup),
          fieldWrap("Gewicht", weightSel, "Zählt die nächste Leistung doppelt?")
        ]),
        result
      ])
    });
  }

  /* ---------- Verteilung ------------------------------------ */

  function distributionCard() {
    var counts = NG.grades.distribution() || [];
    var max = 0, total = 0;
    counts.forEach(function (c) {
      var n = U.num(c, 0) || 0;
      total += n;
      if (n > max) max = n;
    });

    var body;
    if (!total) {
      body = el("p", {
        class: "fs-sm muted",
        text: "Sobald du Noten einträgst, siehst du hier auf einen Blick, wie oft du welche Note hattest."
      });
    } else {
      body = el("div", { class: "bar-chart" }, counts.map(function (c, i) {
        var n = U.num(c, 0) || 0;
        var height = max > 0 ? Math.round(6 + (n / max) * 74) : 6;
        return el("div", { class: "bar-chart__col" }, [
          el("span", { class: "fs-xs fw-6 tnum", text: String(n) }),
          el("div", {
            class: "bar-chart__bar",
            style: {
              height: height + "px",
              background: "var(--grade-" + (i + 1) + ")",
              opacity: n ? "1" : ".3"
            },
            "aria-hidden": "true"
          }),
          el("div", { class: "bar-chart__lbl", text: String(i + 1) })
        ]);
      }));
    }

    var foot = null;
    if (total) {
      foot = total + (total === 1 ? " Note insgesamt" : " Noten insgesamt") +
        " · auf ganze Noten gerundet" +
        (NG.grades.scaleId() === "points15" ? " · Punkte sind dafür in Noten umgerechnet" : "");
    }

    return NG.ui.card({ title: "Verteilung deiner Noten", body: body, foot: foot });
  }

  /* ---------- Tabelle aller Noten --------------------------- */

  function sortedRows(list) {
    if (tableSort.key === "value") {
      return U.sortBy(list, function (g) {
        var v = NG.grades.asGrade(valueOf(g));
        return v === null ? null : v;
      }, tableSort.dir);
    }
    return U.sortBy(list, function (g) { return dateOf(g); }, tableSort.dir);
  }

  function sortHead(label, key, hint, ctx) {
    var active = tableSort.key === key;
    var arrow = active ? (tableSort.dir === "asc" ? " ↑" : " ↓") : "";
    var btn = el("button", {
      type: "button",
      title: hint,
      "aria-label": "Nach " + label + " sortieren",
      style: {
        background: "none", border: "0", padding: "0", cursor: "pointer",
        font: "inherit", color: active ? "var(--accent-text)" : "inherit"
      },
      onClick: function () {
        if (tableSort.key === key) tableSort.dir = tableSort.dir === "asc" ? "desc" : "asc";
        else { tableSort.key = key; tableSort.dir = key === "value" ? "asc" : "desc"; }
        ctx.rerender();
      }
    }, el("span", { text: label + arrow }));
    return el("th", { scope: "col" }, btn);
  }

  function tableRow(g, ctx) {
    var date = dateOf(g);
    var w = weightOf(g);

    var tr = el("tr", {
      tabindex: "0",
      role: "button",
      title: "Zum Bearbeiten anklicken",
      "aria-label": "Note bearbeiten: " + labelOf(g) + ", " +
        NG.store.subjectName(g.subjectId) + ", " + NG.grades.format(valueOf(g)),
      style: { cursor: "pointer" },
      onClick: function () { openGradeDialog(g, ctx); },
      onKeydown: function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGradeDialog(g, ctx); }
      }
    }, [
      el("td", { class: "tnum", text: date ? U.fmtDate(date, { style: "numeric" }) : "—" }),
      el("td", {}, NG.ui.subjectTag(g.subjectId, { short: false })),
      el("td", { class: "wrap", text: labelOf(g) }),
      el("td", { text: typeLabelShort(typeOf(g)) }),
      el("td", { text: categoryOf(g) || "—" }),
      el("td", { class: "num", text: weightLabel(w) }),
      el("td", {}, NG.ui.gradePill(valueOf(g)))
    ]);

    return tr;
  }

  function tableCard(ctx) {
    var list = allGrades().filter(function (g) { return valueOf(g) !== null; });

    var orphans = list.filter(function (g) { return !NG.store.subject(g.subjectId); }).length;
    var options = [{ value: "all", label: "Alle Fächer" }];
    NG.store.activeSubjects().forEach(function (s) { options.push({ value: s.id, label: s.name }); });
    if (orphans) options.push({ value: "none", label: "Ohne Fach" });

    if (tableFilter !== "all" && !options.some(function (o) { return o.value === tableFilter; })) {
      tableFilter = "all";
    }

    var filterSel = selectEl(options, tableFilter, function (e) {
      tableFilter = e.target.value || "all";
      ctx.rerender();
    }, "Noten nach Fach filtern");
    filterSel.style.maxWidth = "200px";

    var visible = list.filter(function (g) {
      if (tableFilter === "all") return true;
      if (tableFilter === "none") return !NG.store.subject(g.subjectId);
      return g.subjectId === tableFilter;
    });

    if (!visible.length) {
      return NG.ui.card({
        title: "Alle Noten",
        actions: list.length ? [filterSel] : null,
        body: NG.ui.empty({
          icon: "award",
          title: list.length ? "Für dieses Fach ist noch nichts da" : "Noch keine Noten",
          text: list.length
            ? "Wähle ein anderes Fach aus – oder trag hier gleich die erste Note ein."
            : "Trag deine erste Note ein. Danach siehst du hier jede Leistung mit Datum, Art und Gewicht.",
          action: { label: "Note hinzufügen", onClick: function () { openGradeDialog(null, ctx); } }
        })
      });
    }

    var table = el("table", { class: "data" }, [
      el("thead", {}, el("tr", {}, [
        sortHead("Datum", "date", "Nach Datum sortieren", ctx),
        el("th", { scope: "col", text: "Fach" }),
        el("th", { scope: "col", text: "Titel" }),
        el("th", { scope: "col", text: "Art" }),
        el("th", { scope: "col", text: "Kategorie" }),
        el("th", { scope: "col", text: "Gewicht" }),
        sortHead("Note", "value", "Nach Note sortieren – aufsteigend heißt: beste zuerst", ctx)
      ])),
      el("tbody", {}, sortedRows(visible).map(function (g) { return tableRow(g, ctx); }))
    ]);

    return NG.ui.card({
      title: "Alle Noten",
      actions: [filterSel],
      flush: true,
      body: el("div", { class: "table-wrap" }, table),
      foot: visible.length + (visible.length === 1 ? " Eintrag" : " Einträge") +
        " · Klick auf eine Zeile, um sie zu bearbeiten"
    });
  }

  /* ---------- Dialog: Note anlegen / bearbeiten -------------- */

  function openGradeDialog(grade, ctx, presetSubjectId) {
    var subjects = NG.store.activeSubjects();
    if (!subjects.length) {
      NG.ui.toast("Leg zuerst ein Fach an – dann kannst du Noten eintragen.", "warn");
      ctx.go("subjects");
      return;
    }

    var isNew = !grade;
    var s = NG.grades.scale();

    var draft = {
      subjectId: isNew ? (presetSubjectId || subjects[0].id) : grade.subjectId,
      title: isNew ? "" : titleOf(grade),
      type: isNew ? "written" : typeOf(grade),
      category: isNew ? CATEGORIES[0] : (categoryOf(grade) || "Sonstiges"),
      value: isNew ? null : valueOf(grade),
      weight: isNew ? 1 : weightOf(grade),
      date: isNew ? U.todayISO() : (dateOf(grade) || U.todayISO()),
      note: isNew ? "" : String((grade && grade.note) || "")
    };

    /* Fach ------------------------------------------------- */
    var subjectSel = selectEl(subjectChoices(isNew ? null : draft.subjectId), draft.subjectId,
      function (e) { draft.subjectId = e.target.value; }, "Fach");

    /* Titel ------------------------------------------------ */
    var titleInput = el("input", {
      type: "text", maxlength: "120",
      placeholder: "z. B. 1. Klassenarbeit",
      "aria-label": "Titel der Note",
      onInput: function (e) { draft.title = e.target.value; }
    });
    titleInput.value = draft.title;

    /* Art -------------------------------------------------- */
    function typeButton(type, label, hint) {
      return el("button", {
        type: "button",
        "aria-pressed": draft.type === type ? "true" : "false",
        dataset: { gradeType: type },
        style: {
          flex: "1 1 0", minWidth: "0", padding: "10px 12px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "2px"
        },
        onClick: function () {
          draft.type = type;
          U.$$("[data-grade-type]", typeGroup).forEach(function (b) {
            b.setAttribute("aria-pressed", b.dataset.gradeType === type ? "true" : "false");
          });
        }
      }, [
        el("span", { class: "fw-6", text: label }),
        el("span", { class: "fs-xs faint", text: hint })
      ]);
    }

    var typeGroup = el("div", {
      class: "btn-group", role: "group", "aria-label": "Art der Note",
      style: { width: "100%" }
    }, [
      typeButton("written", "Schriftlich", "Arbeiten, Tests, Klausuren"),
      typeButton("oral", "Mündlich & Sonstiges", "Mitarbeit, Referate, Projekte")
    ]);

    /* Kategorie -------------------------------------------- */
    var catList = CATEGORIES.slice();
    if (draft.category && catList.indexOf(draft.category) < 0) catList.unshift(draft.category);
    var categorySel = selectEl(catList.map(function (c) { return { value: c, label: c }; }),
      draft.category, function (e) { draft.category = e.target.value; }, "Kategorie");

    /* Wert ------------------------------------------------- */
    var preview = el("span", { class: "grade-pill grade-pill--lg" });

    var valueInput = el("input", {
      type: "number",
      step: String(s.step), min: String(s.min), max: String(s.max),
      inputmode: "decimal",
      placeholder: "Zwischenwert",
      "aria-label": "Wert der Note",
      style: { maxWidth: "140px" },
      onInput: function (e) {
        draft.value = U.num(e.target.value, null);
        syncValue(false);
      }
    });
    valueInput.value = draft.value === null ? "" : String(draft.value);

    var chips = s.presets.map(function (v) {
      return el("button", {
        type: "button",
        class: "chip",
        "aria-pressed": "false",
        dataset: { preset: String(v) },
        "aria-label": "Wert " + s.presetLabel(v) + " wählen",
        onClick: function () {
          draft.value = v;
          valueInput.value = String(v);
          syncValue(false);
        }
      }, el("span", {
        class: "grade-pill grade-pill--sm " + NG.grades.gradeClass(v),
        text: s.presetLabel(v)
      }));
    });

    var chipRow = el("div", { class: "row row--tight" }, chips);

    function syncValue(updateInput) {
      var v = draft.value;
      chips.forEach(function (c) {
        var preset = U.num(c.dataset.preset, null);
        var hit = v !== null && preset !== null && Math.abs(v - preset) < 0.001;
        c.setAttribute("aria-pressed", hit ? "true" : "false");
      });
      preview.className = "grade-pill grade-pill--lg " + (v === null ? "" : NG.grades.gradeClass(v));
      preview.textContent = v === null ? "—" : NG.grades.format(v);
      if (updateInput) valueInput.value = v === null ? "" : String(v);
    }
    syncValue(false);

    /* Gewicht ---------------------------------------------- */
    var weightList = WEIGHTS.slice();
    if (!weightList.some(function (w) { return Math.abs(w.value - draft.weight) < 0.001; })) {
      weightList.unshift({ value: draft.weight, label: weightLabel(draft.weight) + " (eigener Wert)" });
    }
    var weightSel = selectEl(weightList.map(function (w) { return { value: w.value, label: w.label }; }),
      draft.weight, function (e) {
        var w = U.num(e.target.value, 1);
        draft.weight = w !== null && w > 0 ? w : 1;
      }, "Gewicht");

    /* Datum & Notiz ---------------------------------------- */
    var dateInput = el("input", {
      type: "date", "aria-label": "Datum",
      onChange: function (e) { draft.date = e.target.value || ""; }
    });
    dateInput.value = draft.date;

    var noteInput = el("textarea", {
      rows: 3, placeholder: "Was lief gut, was nicht? Worauf achtest du beim nächsten Mal?",
      "aria-label": "Notiz",
      onInput: function (e) { draft.note = e.target.value; }
    });
    noteInput.value = draft.note;

    /* Zusammenbau ------------------------------------------ */
    var body = el("div", { class: "stack" }, [
      el("div", { class: "form-grid" }, [
        fieldWrap("Fach", subjectSel),
        fieldWrap("Titel", titleInput, "Hilft dir später beim Wiederfinden.")
      ]),
      fieldWrap("Art", typeGroup, "Schriftlich und mündlich werden im Fach unterschiedlich gewichtet.", true),
      el("div", { class: "form-grid" }, [
        fieldWrap("Kategorie", categorySel),
        fieldWrap("Gewicht", weightSel, "Eine Klassenarbeit zählt oft doppelt.")
      ]),
      fieldWrap("Wert", el("div", { class: "stack stack--sm" }, [
        chipRow,
        el("div", { class: "row row--tight" }, [
          preview,
          valueInput,
          el("span", {
            class: "fs-xs faint",
            style: { flex: "1 1 160px", minWidth: "0" },
            text: "Tippe einen Wert zwischen " + U.fmtNum(s.min, 0) + " und " +
              U.fmtNum(s.max, 0) + " ein, wenn keiner der Knöpfe passt."
          })
        ])
      ]), null, true),
      el("div", { class: "form-grid" }, [
        fieldWrap("Datum", dateInput, "Standard ist heute.")
      ]),
      fieldWrap("Notiz", noteInput, null, true)
    ]);

    function save() {
      var subId = subjectSel.value;
      if (!subId) { NG.ui.toast("Bitte wähle ein Fach aus.", "error"); return; }
      if (draft.value === null || !NG.grades.isValid(draft.value)) {
        NG.ui.toast("Bitte wähle einen Wert zwischen " + U.fmtNum(s.min, 0) +
          " und " + U.fmtNum(s.max, 0) + ".", "error");
        try { valueInput.focus(); } catch (e) { /* Fokus ist nicht lebenswichtig */ }
        return;
      }

      var payload = {
        subjectId: subId,
        title: String(draft.title || "").trim(),
        type: draft.type === "oral" ? "oral" : "written",
        category: String(draft.category || "").trim() || "Sonstiges",
        value: draft.value,
        weight: draft.weight > 0 ? draft.weight : 1,
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(draft.date || "")) ? String(draft.date) : "",
        note: String(draft.note || "")
      };

      if (isNew) {
        NG.store.add("grades", payload);
        NG.ui.toast("Note eingetragen", "success");
      } else {
        NG.store.update("grades", grade.id, payload);
        NG.ui.toast("Änderungen gespeichert", "success");
      }
      m.close();
      ctx.rerender();
    }

    function removeGrade() {
      NG.ui.confirm({
        title: "Note löschen?",
        message: "„" + labelOf(grade) + "“ (" + NG.grades.format(valueOf(grade)) + ") wird dauerhaft entfernt.",
        confirmText: "Löschen",
        danger: true
      }).then(function (yes) {
        if (!yes) return;
        NG.store.remove("grades", grade.id);
        m.close();
        NG.ui.toast("Note gelöscht");
        ctx.rerender();
      });
    }

    var actions = [];
    if (!isNew) {
      actions.push({ label: "Löschen", variant: "danger", onClick: removeGrade });
      actions.push("spacer");
    }
    actions.push({ label: "Abbrechen", onClick: function () { m.close(); } });
    actions.push({ label: isNew ? "Eintragen" : "Speichern", variant: "primary", onClick: save });

    var m = NG.ui.modal({
      title: isNew ? "Neue Note" : "Note bearbeiten",
      wide: true,
      body: body,
      actions: actions
    });
  }

  /* ---------- Ansicht --------------------------------------- */

  function render(root, ctx) {
    var stack = el("div", { class: "stack" });
    var subjects = NG.store.activeSubjects();

    if (!subjects.length) {
      stack.appendChild(el("div", { class: "card" },
        el("div", { class: "card__body" }, NG.ui.empty({
          icon: "book",
          title: "Erst die Fächer, dann die Noten",
          text: "Damit deine Noten richtig gewichtet werden, brauchst du zuerst mindestens ein Fach " +
            "mit Namen und Gewichtung.",
          action: { label: "Fächer anlegen", onClick: function () { ctx.go("subjects"); } }
        }))));
      root.appendChild(stack);
      return;
    }

    var grades = allGrades().filter(function (g) { return valueOf(g) !== null; });
    var counts = {
      total: grades.length,
      written: grades.filter(function (g) { return typeOf(g) === "written"; }).length,
      oral: grades.filter(function (g) { return typeOf(g) === "oral"; }).length
    };

    stack.appendChild(headerGrid(NG.grades.overallAverage(), counts));
    stack.appendChild(scaleRow(ctx));

    stack.appendChild(el("div", { class: "section-title", text: "Deine Fächer" }));
    subjects.forEach(function (sub) { stack.appendChild(subjectCard(sub, ctx)); });

    stack.appendChild(el("div", { class: "section-title", text: "Planen & auswerten" }));
    stack.appendChild(calculatorCard(ctx));
    stack.appendChild(distributionCard());
    stack.appendChild(tableCard(ctx));

    root.appendChild(stack);
  }

  /* ---------- Registrierung --------------------------------- */

  NG.app.register({
    id: "grades",
    title: "Noten",
    subtitle: "Gewichtete Durchschnitte und was dir noch fehlt",
    icon: "award",
    group: "grades",
    order: 6,
    tab: true,
    render: render,

    actions: function (ctx) {
      return [textButton("plus", "Note hinzufügen", "btn btn--sm btn--primary",
        function () { openGradeDialog(null, ctx); })];
    },

    primaryAction: function (ctx) {
      return {
        label: "Note hinzufügen",
        icon: "plus",
        onClick: function () { openGradeDialog(null, ctx); }
      };
    }
  });
})(window);
