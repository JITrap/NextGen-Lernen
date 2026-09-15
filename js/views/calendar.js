/* =========================================================
   NextGen Lernen – Termine (Kalender & Liste)
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Flüchtiger Zustand -------------------------------------
     Bewusst nur im Modul und nicht im Store: Darstellung, gezeigter
     Monat und Filter sollen beim nächsten Start nicht nachwirken.      */

  var mode = "month";          // "month" | "list"
  var cursor = null;           // ISO-Datum des 1. Tages im gezeigten Monat
  var typeFilter = "all";      // "all" | "exam" | "test" | "presentation" | "rest"
  var subjectFilter = "all";   // "all" | "none" | Fach-Id
  var pastOpen = false;        // Abschnitt „Vergangen“ ausgeklappt?
  var repaint = null;          // neu zeichnen, ohne die ganze App zu rendern

  /* ---------- Termin-Arten -------------------------------- */

  var TYPE_OPTIONS = [
    { value: "exam", label: "Klassenarbeit" },
    { value: "test", label: "Test" },
    { value: "oral", label: "Mündliche Prüfung" },
    { value: "presentation", label: "Referat" },
    { value: "homework", label: "Hausaufgabe" },
    { value: "project", label: "Projekt" },
    { value: "other", label: "Sonstiges" }
  ];

  var TYPE_LABEL = {};
  TYPE_OPTIONS.forEach(function (o) { TYPE_LABEL[o.value] = o.label; });

  var TYPE_BADGE = {
    exam: "badge badge--danger",
    test: "badge badge--warn",
    oral: "badge badge--info",
    presentation: "badge badge--accent",
    homework: "badge",
    project: "badge badge--success",
    other: "badge"
  };

  /** Chips der Filterzeile. „rest“ fasst alles zusammen, was keinen eigenen Chip hat. */
  var FILTER_CHIPS = [
    { id: "all", label: "Alle" },
    { id: "exam", label: "Klassenarbeit" },
    { id: "test", label: "Test" },
    { id: "presentation", label: "Referat" },
    { id: "rest", label: "Sonstiges" }
  ];

  var REST_TYPES = { oral: true, homework: true, project: true, other: true };

  function typeLabel(t) { return TYPE_LABEL[t] || "Termin"; }
  function typeBadgeClass(t) { return TYPE_BADGE[t] || "badge"; }

  /* ---------- Daten holen & filtern ----------------------- */

  function allEvents() {
    return (NG.store.all("events") || []).filter(function (e) {
      return e && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(e.date);
    });
  }

  function matchesFilter(ev) {
    if (typeFilter !== "all") {
      if (typeFilter === "rest") { if (!REST_TYPES[ev.type || "other"]) return false; }
      else if ((ev.type || "other") !== typeFilter) return false;
    }
    if (subjectFilter === "none") return !ev.subjectId;
    if (subjectFilter !== "all") return ev.subjectId === subjectFilter;
    return true;
  }

  function filterActive() { return typeFilter !== "all" || subjectFilter !== "all"; }

  function visibleEvents() {
    return U.sortBy(allEvents().filter(matchesFilter), function (e) {
      return e.date + " " + (e.time || "99:99");
    });
  }

  /* ---------- Datums-Helfer ------------------------------- */

  function monthStartISO(iso) {
    var d = U.toDate(iso) || new Date();
    return U.toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function shiftMonth(iso, n) {
    var d = U.toDate(iso) || new Date();
    return U.toISO(new Date(d.getFullYear(), d.getMonth() + n, 1));
  }

  function daysBetween(isoA, isoB) {
    var a = U.toDate(isoA), b = U.toDate(isoB);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  }

  function currentMonth() {
    if (!cursor) cursor = monthStartISO(U.todayISO());
    return cursor;
  }

  /** Datum, mit dem ein neuer Termin vorbelegt wird. */
  function defaultNewDate() {
    var today = U.todayISO();
    if (mode === "month" && currentMonth() !== monthStartISO(today)) return currentMonth();
    return today;
  }

  function timeRange(ev) {
    var t = U.fmtTime(ev.time);
    if (!t) return "";
    var e = U.fmtTime(ev.endTime);
    return e ? t + "–" + e + " Uhr" : "ab " + t + " Uhr";
  }

  /* ---------- Termin-Dialog ------------------------------- */

  function eventFields() {
    return [
      {
        name: "title", label: "Titel", type: "text", required: true, full: true,
        placeholder: "z. B. Klassenarbeit Gleichungen"
      },
      { name: "type", label: "Art", type: "select", options: TYPE_OPTIONS },
      { name: "subjectId", label: "Fach", type: "select", options: NG.ui.subjectOptions(), nullable: true },
      { name: "date", label: "Datum", type: "date", required: true },
      { name: "time", label: "Beginn", type: "time" },
      {
        name: "endTime", label: "Ende", type: "time",
        validate: function (v, all) {
          if (v && all.time && v < all.time) return "Das Ende liegt vor dem Beginn.";
          return "";
        }
      },
      { name: "place", label: "Ort", type: "text", placeholder: "z. B. Raum 204" },
      {
        name: "note", label: "Notiz", type: "textarea", full: true, rows: 3,
        placeholder: "Was kommt dran? Was musst du mitbringen?"
      },
      { name: "done", label: "Ist schon erledigt", type: "checkbox" }
    ];
  }

  /**
   * Öffnet den Dialog zum Anlegen oder Bearbeiten.
   * @param {Object|null} ev  vorhandener Termin (null = neu)
   * @param {string} [dateISO] Vorbelegung beim Anlegen
   */
  function openEventDialog(ev, dateISO) {
    var isNew = !ev;
    var values = isNew
      ? { title: "", type: "exam", subjectId: null, date: dateISO || U.todayISO(), time: "", endTime: "", place: "", note: "", done: false }
      : {
        title: ev.title || "", type: ev.type || "other", subjectId: ev.subjectId || null,
        date: ev.date || U.todayISO(), time: ev.time || "", endTime: ev.endTime || "",
        place: ev.place || "", note: ev.note || "", done: !!ev.done
      };

    NG.ui.formModal({
      title: isNew ? "Neuer Termin" : "Termin bearbeiten",
      intro: isNew
        ? "Trage ein, was ansteht. Für Klassenarbeiten und Tests baut dir die KI danach einen Lernplan."
        : null,
      fields: eventFields(),
      values: values,
      submitText: isNew ? "Anlegen" : "Speichern",
      beforeSubmit: function (data) {
        if (!String(data.title || "").trim()) return "Gib dem Termin bitte einen Titel.";
        if (!data.date) return "Ohne Datum kann ich den Termin nicht einsortieren.";
        return "";
      },
      onDelete: isNew ? null : function () {
        NG.store.remove("events", ev.id);
        NG.ui.toast("Termin gelöscht", "success");
      },
      deleteMessage: isNew ? null : "„" + (ev.title || "Termin") + "“ wird dauerhaft entfernt."
    }).then(function (vals) {
      if (!vals) return;
      var patch = {
        title: String(vals.title || "").trim(),
        type: vals.type || "other",
        subjectId: vals.subjectId || null,
        date: vals.date,
        time: vals.time || "",
        endTime: vals.endTime || "",
        place: String(vals.place || "").trim(),
        note: vals.note || "",
        done: !!vals.done
      };
      if (isNew) {
        NG.store.add("events", patch);
        NG.ui.toast("Termin angelegt – " + U.relDays(patch.date) + ".", "success");
      } else {
        NG.store.update("events", ev.id, patch);
        NG.ui.toast("Termin gespeichert", "success");
      }
    });
  }

  function toggleDone(ev) {
    NG.store.update("events", ev.id, { done: !ev.done });
    NG.ui.toast(ev.done ? "Wieder als offen markiert" : "Als erledigt abgehakt", "success");
  }

  /* ---------- Einzelner Listeneintrag --------------------- */

  function canPlan(ev) {
    if (ev.done) return false;
    if (ev.type !== "exam" && ev.type !== "test") return false;
    return ev.date >= U.todayISO();
  }

  function iconButton(iconName, label, onClick) {
    return el("button", {
      class: "btn btn--icon", type: "button", "aria-label": label, title: label,
      html: U.icon(iconName), onClick: onClick
    });
  }

  function eventRow(ev) {
    var metaParts = [
      el("span", { class: typeBadgeClass(ev.type), text: typeLabel(ev.type) }),
      el("span", { class: "tnum", text: U.fmtDate(ev.date, { style: "medium" }) })
    ];
    var tr = timeRange(ev);
    if (tr) metaParts.push(el("span", { class: "tnum", text: tr }));
    if (ev.place) metaParts.push(el("span", { class: "faint", text: ev.place }));
    if (ev.subjectId) metaParts.push(el("span", { text: NG.store.subjectName(ev.subjectId) }));

    var actions = el("div", { class: "list__actions" }, [
      canPlan(ev) ? iconButton("sparkles", "Lernplan mit der KI erstellen", function () { openPlanDialog(ev); }) : null,
      iconButton("edit", "Termin bearbeiten", function () { openEventDialog(ev); }),
      el("button", {
        class: "btn btn--icon", type: "button",
        "aria-label": ev.done ? "Doch noch offen" : "Als erledigt abhaken",
        title: ev.done ? "Doch noch offen" : "Als erledigt abhaken",
        html: U.icon("check"),
        style: ev.done ? { color: "var(--success)" } : null,
        onClick: function () { toggleDone(ev); }
      })
    ]);

    return el("div", { class: "list__item" + (ev.done ? " is-done" : "") }, [
      el("span", {
        class: "subject-dot",
        style: { background: NG.store.subjectColor(ev.subjectId) },
        title: ev.subjectId ? NG.store.subjectName(ev.subjectId) : "Ohne Fach"
      }),
      el("div", { class: "list__main" }, [
        el("div", { class: "list__title", text: ev.title || "Ohne Titel" }),
        el("div", { class: "list__meta" }, metaParts),
        ev.note ? el("div", { class: "fs-xs faint", text: U.truncate(ev.note, 110) }) : null
      ]),
      NG.ui.countdownBadge(ev.date),
      actions
    ]);
  }

  function eventList(items) {
    return el("div", { class: "list" }, items.map(eventRow));
  }

  /* ---------- Filterzeile --------------------------------- */

  function buildFilters(host) {
    var chips = FILTER_CHIPS.map(function (c) {
      return el("button", {
        class: "chip", type: "button",
        "aria-pressed": typeFilter === c.id ? "true" : "false",
        text: c.label,
        title: c.id === "rest"
          ? "Mündliche Prüfung, Hausaufgabe, Projekt und Sonstiges"
          : "Nur „" + c.label + "“ zeigen",
        onClick: function () {
          typeFilter = c.id;
          if (repaint) repaint();
        }
      });
    });

    var row = el("div", { class: "row row--tight" }, chips);

    var subjects = U.sortBy(NG.store.all("subjects") || [], function (s) {
      return String(s.name || "").toLowerCase();
    });
    if (subjects.length) {
      var sel = el("select", {
        "aria-label": "Nach Fach filtern",
        style: { width: "auto", maxWidth: "190px" },
        onChange: function () { subjectFilter = sel.value; if (repaint) repaint(); }
      });
      var opts = [{ value: "all", label: "Alle Fächer" }]
        .concat(subjects.map(function (s) { return { value: s.id, label: s.name + (s.archived ? " (Archiv)" : "") }; }))
        .concat([{ value: "none", label: "Ohne Fach" }]);
      opts.forEach(function (o) {
        var opt = el("option", { value: o.value, text: o.label });
        if (o.value === subjectFilter) opt.selected = true;
        sel.appendChild(opt);
      });
      row.appendChild(el("div", { class: "spacer" }, sel));
    }

    host.appendChild(row);
  }

  /* ---------- Monatsansicht ------------------------------- */

  function eventChip(ev) {
    return el("span", {
      class: "cal__ev",
      text: U.truncate(ev.title || "Termin", 18),
      title: (ev.title || "Termin") + " – " + typeLabel(ev.type) +
        (ev.time ? ", " + timeRange(ev) : ""),
      style: {
        background: "var(--surface-3)",
        borderLeftColor: NG.store.subjectColor(ev.subjectId),
        opacity: ev.done ? ".55" : "1"
      },
      onClick: function (e) {
        e.stopPropagation();
        openEventDialog(ev);
      }
    });
  }

  function openDayDialog(iso, items) {
    var m = NG.ui.modal({
      title: U.fmtDate(iso, { style: "long" }),
      body: items.length
        ? el("div", { class: "card" }, el("div", { class: "card__body card__body--flush" }, eventList(items)))
        : el("p", { class: "muted", text: "An diesem Tag steht noch nichts an." }),
      actions: [
        { label: "Schließen", onClick: function () { m.close(); } },
        {
          label: "Termin hinzufügen", variant: "primary",
          onClick: function () { m.close(); openEventDialog(null, iso); }
        }
      ]
    });
  }

  function monthHeader() {
    var start = U.toDate(currentMonth());
    var label = U.MONTHS[start.getMonth()] + " " + start.getFullYear();

    function step(n) {
      cursor = shiftMonth(currentMonth(), n);
      if (repaint) repaint();
    }

    return el("div", { class: "row row--tight" }, [
      iconButton("chevronLeft", "Vorheriger Monat", function () { step(-1); }),
      el("div", {
        class: "fw-6", "aria-live": "polite",
        style: { minWidth: "9.5rem", textAlign: "center" },
        text: label
      }),
      iconButton("chevronRight", "Nächster Monat", function () { step(1); }),
      el("button", {
        class: "btn btn--sm spacer", type: "button", text: "Heute",
        onClick: function () {
          cursor = monthStartISO(U.todayISO());
          if (repaint) repaint();
        }
      })
    ]);
  }

  function monthGrid() {
    var start = U.toDate(currentMonth());
    var year = start.getFullYear(), month = start.getMonth();
    var lastDay = U.toISO(new Date(year, month + 1, 0));
    var gridStart = U.startOfWeek(currentMonth());
    var cellCount = daysBetween(gridStart, U.startOfWeek(lastDay)) + 7;
    var today = U.todayISO();

    // Termine nach Datum bündeln
    var byDate = {};
    visibleEvents().forEach(function (ev) {
      (byDate[ev.date] = byDate[ev.date] || []).push(ev);
    });

    var grid = el("div", { class: "cal" });
    ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach(function (d) {
      grid.appendChild(el("div", { class: "cal__dow", text: d }));
    });

    for (var i = 0; i < cellCount; i++) {
      var iso = U.addDays(gridStart, i);
      var d = U.toDate(iso);
      var items = byDate[iso] || [];
      var isOut = d.getMonth() !== month;
      var cls = "cal__day" + (isOut ? " is-out" : "") + (iso === today ? " is-today" : "");

      var cell = el("button", {
        class: cls, type: "button",
        "aria-label": U.fmtDate(iso, { style: "long" }) + ", " +
          (items.length === 0 ? "keine Termine" : items.length === 1 ? "1 Termin" : items.length + " Termine") +
          " – neuen Termin anlegen",
        onClick: (function (dayISO) {
          return function () { openEventDialog(null, dayISO); };
        })(iso)
      }, el("span", { class: "cal__num", text: String(d.getDate()) }));

      items.slice(0, 3).forEach(function (ev) { cell.appendChild(eventChip(ev)); });

      if (items.length > 3) {
        cell.appendChild(el("span", {
          class: "cal__ev",
          text: "+" + (items.length - 3) + " weitere",
          title: "Alle Termine dieses Tages zeigen",
          style: { background: "transparent", borderLeftColor: "transparent", color: "var(--text-muted)", paddingLeft: "3px" },
          onClick: (function (dayISO, list) {
            return function (e) { e.stopPropagation(); openDayDialog(dayISO, list); };
          })(iso, items)
        }));
      }

      grid.appendChild(cell);
    }

    return grid;
  }

  function monthSection() {
    var wrap = el("div", { class: "stack" }, [monthHeader(), monthGrid()]);

    if (!allEvents().length) {
      wrap.appendChild(el("div", { class: "card" },
        el("div", { class: "card__body" }, NG.ui.empty({
          icon: "calendar",
          title: "Noch keine Termine",
          text: "Trage deine nächste Klassenarbeit ein – dann siehst du hier sofort, wie viel Zeit dir noch bleibt.",
          action: { label: "Ersten Termin anlegen", onClick: function () { openEventDialog(null, defaultNewDate()); } }
        }))));
    } else if (filterActive() && !visibleEvents().length) {
      wrap.appendChild(el("p", { class: "muted fs-sm center", text: "Zu deinem Filter passt gerade kein Termin." }));
    } else {
      wrap.appendChild(el("p", {
        class: "faint fs-xs center",
        text: "Tipp: Tippe auf einen Tag, um dort einen Termin anzulegen. Ein Klick auf einen Eintrag öffnet ihn."
      }));
    }

    return wrap;
  }

  /* ---------- Listenansicht ------------------------------- */

  function groupCard(title, items, noteText) {
    return el("div", { class: "card" }, [
      el("div", { class: "card__head" }, [
        el("h3", { text: title }),
        el("span", { class: "badge", text: String(items.length) }),
        noteText ? el("span", { class: "fs-xs faint spacer", text: noteText }) : null
      ]),
      el("div", { class: "card__body card__body--flush" }, eventList(items))
    ]);
  }

  function pastCard(items) {
    var body = el("div", { class: "card__body card__body--flush" }, eventList(items));
    if (!pastOpen) body.classList.add("hidden");

    var chevron = el("span", {
      html: U.icon("chevronDown"),
      style: { display: "inline-flex", transform: pastOpen ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }
    });
    var label = el("span", { text: pastOpen ? "Ausblenden" : "Anzeigen" });

    var toggle = el("button", {
      class: "btn btn--ghost btn--sm", type: "button",
      "aria-expanded": pastOpen ? "true" : "false",
      onClick: function () {
        pastOpen = !pastOpen;
        body.classList.toggle("hidden", !pastOpen);
        toggle.setAttribute("aria-expanded", pastOpen ? "true" : "false");
        chevron.style.transform = pastOpen ? "rotate(180deg)" : "none";
        label.textContent = pastOpen ? "Ausblenden" : "Anzeigen";
      }
    }, [label, chevron]);

    return el("div", { class: "card" }, [
      el("div", { class: "card__head" }, [
        el("h3", { text: "Vergangen" }),
        el("span", { class: "badge", text: String(items.length) }),
        el("div", { class: "row row--tight spacer" }, toggle)
      ]),
      body
    ]);
  }

  function listSection() {
    var today = U.todayISO();
    var thisWeekEnd = U.addDays(U.startOfWeek(today), 6);
    var nextWeekEnd = U.addDays(thisWeekEnd, 7);

    var items = visibleEvents();
    var upcoming = items.filter(function (e) { return e.date >= today; });
    var past = items.filter(function (e) { return e.date < today; });

    var thisWeek = upcoming.filter(function (e) { return e.date <= thisWeekEnd; });
    var nextWeek = upcoming.filter(function (e) { return e.date > thisWeekEnd && e.date <= nextWeekEnd; });
    var later = upcoming.filter(function (e) { return e.date > nextWeekEnd; });

    past = U.sortBy(past, function (e) { return e.date + " " + (e.time || ""); }, "desc").slice(0, 20);

    var stack = el("div", { class: "stack" });

    if (!upcoming.length) {
      var hasAny = allEvents().length > 0;
      stack.appendChild(el("div", { class: "card" }, el("div", { class: "card__body" },
        hasAny && filterActive()
          ? NG.ui.empty({
            icon: "filter",
            title: "Kein Termin passt zum Filter",
            text: "Stelle den Filter auf „Alle“, um wieder alles zu sehen.",
            action: {
              label: "Filter zurücksetzen",
              onClick: function () { typeFilter = "all"; subjectFilter = "all"; if (repaint) repaint(); }
            }
          })
          : NG.ui.empty({
            icon: "calendar",
            title: hasAny ? "Nichts mehr geplant" : "Noch keine Termine",
            text: hasAny
              ? "Alle eingetragenen Termine liegen in der Vergangenheit. Zeit für den nächsten Eintrag!"
              : "Trage deine nächste Klassenarbeit ein – dann siehst du hier, wie viel Zeit dir noch bleibt.",
            action: { label: "Termin anlegen", onClick: function () { openEventDialog(null, defaultNewDate()); } }
          })
      )));
    } else {
      if (thisWeek.length) stack.appendChild(groupCard("Diese Woche", thisWeek, "bis " + U.fmtDate(thisWeekEnd, { style: "short" })));
      if (nextWeek.length) stack.appendChild(groupCard("Nächste Woche", nextWeek, "bis " + U.fmtDate(nextWeekEnd, { style: "short" })));
      if (later.length) stack.appendChild(groupCard("Später", later, null));
    }

    if (past.length) stack.appendChild(pastCard(past));

    return stack;
  }

  /* =========================================================
     KI: Lernplan zu einer Klassenarbeit
     ========================================================= */

  function openAiHint(st) {
    var m = NG.ui.modal({
      title: "Die KI ist noch nicht eingerichtet",
      body: el("div", { class: "stack" }, [
        el("p", { class: "muted", text: st.reason || "Dafür brauche ich einen Zugang zur KI." }),
        el("p", {
          class: "fs-sm faint",
          text: "Sobald das erledigt ist, baue ich dir hier aus den Themen der Arbeit einen Lernplan und lege die Schritte als Aufgaben an."
        })
      ]),
      actions: [
        { label: "Später", onClick: function () { m.close(); } },
        {
          label: "Zu den Einstellungen", variant: "primary",
          onClick: function () { m.close(); NG.app.go("settings"); }
        }
      ]
    });
  }

  function planPrompt(ev, topics, minutes) {
    var today = U.todayISO();
    var days = Math.max(0, daysBetween(today, ev.date));
    var lines = [
      "Baue mir einen Lernplan für diese Prüfung.",
      "",
      "Prüfung: " + (ev.title || "ohne Titel"),
      "Art: " + typeLabel(ev.type),
      "Fach: " + (ev.subjectId ? NG.store.subjectName(ev.subjectId) : "kein Fach angegeben"),
      "Datum der Prüfung: " + ev.date,
      "Heute ist der " + today + ".",
      days === 1 ? "Es bleibt noch 1 Tag." : "Es bleiben noch " + days + " Tage.",
      "Lernzeit pro Tag: etwa " + minutes + " Minuten.",
      "",
      "Themen der Arbeit:",
      String(topics || "").trim() || "(nicht angegeben – leite sinnvolle Themen aus Fach und Titel ab)",
      "",
      "Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau dieser Form:",
      '{"tasks":[{"title":"...","due":"YYYY-MM-DD","note":"..."}]}',
      "",
      "Regeln:",
      "- höchstens 8 Einträge",
      "- kein Datum vor " + today + " und kein Datum nach " + ev.date,
      "- verteile die Themen realistisch auf die verbleibenden Tage, pro Tag höchstens zwei Einträge",
      "- der letzte Eintrag ist eine Gesamtwiederholung kurz vor der Prüfung",
      "- \"title\": kurz und konkret, höchstens 60 Zeichen, ohne Datum",
      "- \"note\": ein Satz mit einem konkreten Tipp, wie du das übst",
      "- kein Text ausserhalb des JSON"
    ];
    return lines.join("\n");
  }

  function normalizePlan(data, ev) {
    var raw = data && Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data) ? data : []);
    var today = U.todayISO();
    var last = ev.date >= today ? ev.date : today;
    var out = [];

    raw.forEach(function (t) {
      if (!t) return;
      var title = String((typeof t === "string" ? t : t.title) || "").trim();
      if (!title) return;
      var due = String((typeof t === "object" && t.due) || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) due = last;
      if (due < today) due = today;
      if (due > last) due = last;
      out.push({
        title: U.truncate(title, 70),
        due: due,
        note: String((typeof t === "object" && t.note) || "").trim()
      });
    });

    return U.sortBy(out, function (x) { return x.due; }).slice(0, 8);
  }

  function openPlanDialog(ev) {
    var st = NG.ai.status();
    if (!st.ready) { openAiHint(st); return; }

    var job = null;              // laufende Anfrage: { ctrl, dead }
    var closed = false;
    var body = el("div", { class: "stack" });

    function stopJob() {
      if (!job) return;
      job.dead = true;
      if (job.ctrl) { try { job.ctrl.abort(); } catch (e) { /* schon beendet */ } }
      job = null;
    }

    var m = NG.ui.modal({
      title: "Lernplan für „" + U.truncate(ev.title || "Prüfung", 38) + "“",
      body: body,
      actions: [{ label: "Schließen", onClick: function () { m.close(); } }],
      onClose: function () { closed = true; stopJob(); }
    });

    function setFoot(nodes) {
      if (!m.foot) return;
      U.clear(m.foot);
      nodes.forEach(function (n) { if (n) m.foot.appendChild(n); });
    }

    function button(label, variant, onClick, iconName) {
      return el("button", {
        type: "button",
        class: "btn" + (variant ? " btn--" + variant : ""),
        html: (iconName ? U.icon(iconName) : "") + "<span>" + U.escapeHtml(label) + "</span>",
        onClick: onClick
      });
    }

    /* Schritt 1: Themen eintragen */
    function showForm(topicsValue, minutesValue) {
      U.clear(body);

      var topicsId = U.uid("topics");
      var minutesId = U.uid("min");

      var topics = el("textarea", {
        id: topicsId, rows: 5,
        placeholder: "z. B. Lineare Gleichungen, Textaufgaben, Bruchrechnen …"
      });
      topics.value = topicsValue !== undefined && topicsValue !== null ? topicsValue : (ev.note || "");

      var minutes = el("select", { id: minutesId });
      [["20", "20 Minuten"], ["30", "30 Minuten"], ["45", "45 Minuten"], ["60", "1 Stunde"], ["90", "1,5 Stunden"]]
        .forEach(function (p) {
          var opt = el("option", { value: p[0], text: p[1] });
          if (p[0] === String(minutesValue || "30")) opt.selected = true;
          minutes.appendChild(opt);
        });

      U.append(body, [
        el("p", { class: "muted fs-sm" }, [
          el("span", { text: "Die Prüfung ist am " + U.fmtDate(ev.date, { style: "long" }) + " – " }),
          el("span", { class: "fw-6", text: U.relDays(ev.date) + "." }),
          el("span", { text: " Sag mir, was drankommt, dann verteile ich den Stoff auf die Tage." })
        ]),
        el("div", { class: "field" }, [
          el("label", { for: topicsId, text: "Themen der Arbeit" }),
          topics,
          el("div", { class: "field__hint", text: "Eins pro Zeile reicht. Je genauer, desto besser der Plan." })
        ]),
        el("div", { class: "field" }, [
          el("label", { for: minutesId, text: "So viel Zeit habe ich pro Tag" }),
          minutes
        ])
      ]);

      setFoot([
        button("Abbrechen", null, function () { m.close(); }),
        button("Plan erstellen", "primary", function () { runPlan(topics.value, minutes.value); }, "sparkles")
      ]);
    }

    /* Schritt 2: KI läuft */
    function runPlan(topicsValue, minutesValue) {
      var current = { ctrl: typeof AbortController === "function" ? new AbortController() : null, dead: false };
      job = current;

      U.clear(body);
      U.append(body, el("div", { class: "row" }, [
        el("span", { class: "spinner" }),
        el("span", { class: "muted", text: "Denkt nach – dein Lernplan entsteht gerade …" })
      ]));

      setFoot([button("Abbrechen", null, function () {
        stopJob();
        showForm(topicsValue, minutesValue);
      })]);

      var prompt = planPrompt(ev, topicsValue, minutesValue);

      NG.ai.run({
        system: NG.ai.systemPrompt("Du planst Lernzeiten für Schülerinnen und Schüler. " +
          "Antworte in dieser Aufgabe ausschliesslich mit gültigem JSON und ohne Erklärtext."),
        prompt: prompt,
        json: true,
        tier: "default",
        maxTokens: 2000,
        signal: current.ctrl ? current.ctrl.signal : undefined
      }).then(function (res) {
        if (current.dead || closed) return;   // abgebrochen oder Dialog zu
        job = null;
        var tasks = normalizePlan(res && res.data, ev);
        try {
          NG.ai.logRun({
            kind: "plan",
            title: "Lernplan: " + (ev.title || "Prüfung"),
            prompt: prompt,
            result: res && res.text ? res.text : "",
            subjectId: ev.subjectId || null
          });
        } catch (e) { /* Verlauf ist nur ein Extra */ }

        if (!tasks.length) {
          showError("Die Antwort enthielt keinen brauchbaren Plan. Versuch es noch einmal – am besten mit ein paar Stichworten zu den Themen.",
            topicsValue, minutesValue);
          return;
        }
        showResult(tasks, topicsValue, minutesValue);
      }).catch(function (err) {
        if (current.dead || closed) return;   // Abbruch ist kein Fehler
        job = null;
        showError(NG.ai.friendly(err), topicsValue, minutesValue);
      });
    }

    /* Schritt 3a: Fehler */
    function showError(message, topicsValue, minutesValue) {
      U.clear(body);
      U.append(body, el("div", { class: "stack" }, [
        el("div", { class: "row row--tight" }, [
          el("span", { html: U.icon("alert"), style: { color: "var(--danger)", display: "inline-flex" } }),
          el("span", { class: "fw-6", text: "Das hat nicht geklappt" })
        ]),
        el("p", { class: "muted fs-sm", text: message })
      ]));
      setFoot([
        button("Schließen", null, function () { m.close(); }),
        button("Nochmal versuchen", "primary", function () { showForm(topicsValue, minutesValue); })
      ]);
    }

    /* Schritt 3b: Vorschau */
    function showResult(tasks, topicsValue, minutesValue) {
      U.clear(body);

      var picks = [];
      var list = el("div", { class: "list" });

      tasks.forEach(function (t) {
        var box = el("input", { type: "checkbox" });
        box.checked = true;
        picks.push({ box: box, task: t });

        list.appendChild(el("label", { class: "list__item", style: { cursor: "pointer" } }, [
          box,
          el("div", { class: "list__main" }, [
            el("div", { class: "list__title", text: t.title }),
            el("div", { class: "list__meta" }, [
              el("span", { class: "tnum", text: U.fmtDate(t.due, { style: "medium" }) }),
              t.note ? el("span", { class: "faint", text: U.truncate(t.note, 90) }) : null
            ])
          ]),
          NG.ui.countdownBadge(t.due)
        ]));
      });

      U.append(body, [
        el("p", {
          class: "muted fs-sm",
          text: "Das schlägt die KI vor. Hake ab, was du übernehmen willst – die Punkte landen dann in deinen Aufgaben."
        }),
        el("div", { class: "card" }, el("div", { class: "card__body card__body--flush" }, list)),
        el("p", { class: "fs-xs faint", text: "Prüfe die Vorschläge kurz: Die KI kennt deinen Unterricht nicht im Detail." })
      ]);

      setFoot([
        button("Neu erstellen", null, function () { showForm(topicsValue, minutesValue); }),
        button("Abbrechen", null, function () { m.close(); }),
        button("Übernehmen", "primary", function () { applyPlan(picks); })
      ]);
    }

    function applyPlan(picks) {
      var chosen = picks.filter(function (p) { return p.box.checked; });
      if (!chosen.length) {
        NG.ui.toast("Hake mindestens einen Punkt an.", "warn");
        return;
      }
      var suffix = "Lernplan für „" + (ev.title || "Prüfung") + "“ am " + U.fmtDate(ev.date, { style: "numeric" });
      NG.store.addMany("tasks", chosen.map(function (p) {
        return {
          subjectId: ev.subjectId || null,
          title: "Lernen: " + p.task.title,
          due: p.task.due,
          done: false,
          doneAt: null,
          priority: 2,
          note: (p.task.note ? p.task.note + "\n\n" : "") + suffix
        };
      }));
      m.close();
      NG.ui.toast(chosen.length === 1
        ? "1 Aufgabe zu deinem Lernplan hinzugefügt."
        : chosen.length + " Aufgaben zu deinem Lernplan hinzugefügt.", "success");
    }

    showForm(null, "30");
  }

  /* =========================================================
     Ansicht
     ========================================================= */

  function render(root, ctx) {
    void ctx;
    var filterHost = el("div");
    var bodyHost = el("div");

    root.appendChild(el("div", { class: "stack" }, [filterHost, bodyHost]));

    repaint = function () {
      U.clear(filterHost);
      U.clear(bodyHost);
      buildFilters(filterHost);
      bodyHost.appendChild(mode === "month" ? monthSection() : listSection());
    };

    repaint();
  }

  function actions() {
    var monthBtn = el("button", {
      type: "button", text: "Monat",
      "aria-pressed": mode === "month" ? "true" : "false"
    });
    var listBtn = el("button", {
      type: "button", text: "Liste",
      "aria-pressed": mode === "list" ? "true" : "false"
    });

    function setMode(next) {
      if (mode === next) return;
      mode = next;
      monthBtn.setAttribute("aria-pressed", mode === "month" ? "true" : "false");
      listBtn.setAttribute("aria-pressed", mode === "list" ? "true" : "false");
      if (repaint) repaint();
      else NG.app.scheduleRender();
    }

    monthBtn.addEventListener("click", function () { setMode("month"); });
    listBtn.addEventListener("click", function () { setMode("list"); });

    return [
      el("div", { class: "btn-group", role: "group", "aria-label": "Darstellung wählen" }, [monthBtn, listBtn]),
      el("button", {
        class: "btn btn--primary btn--sm", type: "button",
        html: U.icon("plus") + "<span>Neuer Termin</span>",
        onClick: function () { openEventDialog(null, defaultNewDate()); }
      })
    ];
  }

  function badge() {
    var today = U.todayISO();
    var limit = U.addDays(today, 7);
    return allEvents().filter(function (e) {
      return !e.done && e.date >= today && e.date <= limit;
    }).length;
  }

  NG.app.register({
    id: "calendar",
    title: "Termine",
    icon: "calendar",
    group: "plan",
    order: 2,
    tab: true,
    subtitle: "Klassenarbeiten, Tests und alles andere im Blick",
    render: render,
    actions: actions,
    badge: badge,
    primaryAction: function () {
      return {
        label: "Neuer Termin", icon: "plus",
        onClick: function () { openEventDialog(null, defaultNewDate()); }
      };
    },
    onLeave: function () { repaint = null; }
  });
})(window);
