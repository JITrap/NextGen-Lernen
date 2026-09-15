/* =========================================================
   NextGen Lernen – Aufgaben
   Hausaufgaben und To-dos: schnell eintragen, abhaken,
   nach Fälligkeit sortiert wiederfinden.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Flüchtiger Zustand der Ansicht --------------
     Lebt nur im Arbeitsspeicher, wird bewusst nicht gespeichert. */

  var filter = { subjectId: "all", onlyOpen: false };
  var quick = { text: "", subjectId: "", due: null };
  var doneOpen = false;      // Gruppe „Erledigt“ aufgeklappt?
  var wantFocus = false;     // nach dem Rendern zurück ins Schnelleingabefeld
  var quickInput = null;     // Verweis auf das Feld der Schnelleingabe

  var DONE_LIMIT = 30;       // so viele erledigte Aufgaben zeigen wir höchstens

  var PRIORITIES = [
    { value: 1, label: "Hoch", badge: "badge badge--danger" },
    { value: 2, label: "Mittel", badge: "badge badge--warn" },
    { value: 3, label: "Niedrig", badge: "badge" }
  ];

  /* ---------- Kleine Helfer -------------------------------- */

  function allTasks() {
    var list = NG.store.all("tasks");
    return Array.isArray(list) ? list : [];
  }

  function titleOf(task) {
    var t = String(task && task.title ? task.title : "").trim();
    return t || "Ohne Titel";
  }

  /** Fälligkeitsdatum als reines YYYY-MM-DD oder "" (auch bei Murks im Speicher). */
  function dueOf(task) {
    var raw = task && task.due ? String(task.due) : "";
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
  }

  /** Tag, an dem die Aufgabe abgehakt wurde, als YYYY-MM-DD oder "". */
  function doneDayOf(task) {
    var raw = task && task.doneAt ? String(task.doneAt) : "";
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
  }

  function prioOf(task) {
    var p = U.num(task && task.priority, 3);
    if (p === null) p = 3;
    return U.clamp(Math.round(p), 1, 3);
  }

  function prioInfo(task) {
    return PRIORITIES[prioOf(task) - 1] || PRIORITIES[2];
  }

  function subjectIdOf(task) {
    return task && task.subjectId ? task.subjectId : null;
  }

  function openTasks(list) {
    return list.filter(function (t) { return !t.done; });
  }

  /** Aufgaben nach dem gewählten Fach-Filter aussieben. */
  function applySubjectFilter(list) {
    if (filter.subjectId === "all") return list;
    if (filter.subjectId === "none") {
      return list.filter(function (t) { return !subjectIdOf(t); });
    }
    return list.filter(function (t) { return subjectIdOf(t) === filter.subjectId; });
  }

  /** In welche Gruppe gehört die Aufgabe? */
  function bucketOf(task, today, weekEnd) {
    var d = dueOf(task);
    if (!d) return "none";
    if (d < today) return "overdue";
    if (d === today) return "today";
    if (d <= weekEnd) return "week";
    return "later";
  }

  function sortOpen(list) {
    return U.sortBy(list, function (t) {
      return (dueOf(t) || "9999-99-99") + "#" + prioOf(t) + "#" + titleOf(t).toLowerCase();
    }, "asc");
  }

  function sortUndated(list) {
    return U.sortBy(list, function (t) {
      return prioOf(t) + "#" + String(t.createdAt || "") + "#" + titleOf(t).toLowerCase();
    }, "asc");
  }

  /* ---------- Aktionen ------------------------------------- */

  function addQuick(ctx) {
    var text = String(quick.text || "").trim();
    if (!text) {
      NG.ui.toast("Schreib zuerst kurz auf, was zu tun ist.", "warn");
      wantFocus = true;
      ctx.rerender();
      return;
    }
    NG.store.add("tasks", {
      title: text,
      subjectId: quick.subjectId || null,
      due: quick.due || "",
      done: false,
      doneAt: null,
      priority: 3,
      note: ""
    });
    quick.text = "";
    wantFocus = true;                 // Fokus bleibt nach dem Neu-Rendern im Textfeld
    NG.ui.toast("Aufgabe hinzugefügt", "success");
    ctx.rerender();
  }

  function toggleDone(task, checked, ctx) {
    NG.store.update("tasks", task.id, {
      done: !!checked,
      doneAt: checked ? new Date().toISOString() : null
    });
    if (checked) NG.ui.toast("Erledigt – stark!", "success");
    ctx.rerender();
  }

  function removeTask(task, ctx) {
    NG.ui.confirm({
      title: "Aufgabe löschen?",
      message: "„" + titleOf(task) + "“ wird dauerhaft entfernt.",
      confirmText: "Löschen",
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      NG.store.remove("tasks", task.id);
      NG.ui.toast("Aufgabe gelöscht");
      ctx.rerender();
    });
  }

  function clearDone(ctx) {
    var count = allTasks().filter(function (t) { return t.done; }).length;
    if (!count) return;
    NG.ui.confirm({
      title: "Erledigte Aufgaben löschen?",
      message: count === 1
        ? "Die eine erledigte Aufgabe wird dauerhaft entfernt."
        : "Alle " + count + " erledigten Aufgaben werden dauerhaft entfernt.",
      confirmText: "Löschen",
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      NG.store.removeWhere("tasks", function (t) { return !!t.done; });
      NG.ui.toast("Aufgeräumt – erledigte Aufgaben sind weg.", "success");
      ctx.rerender();
    });
  }

  /* ---------- Dialog --------------------------------------- */

  function openDialog(task, ctx) {
    var isNew = !task;
    var values = isNew
      ? {
        title: "",
        subjectId: quick.subjectId || null,
        due: quick.due || U.todayISO(),
        priority: 3,
        note: "",
        done: false
      }
      : {
        title: String(task.title || ""),
        subjectId: subjectIdOf(task),
        due: dueOf(task),
        priority: prioOf(task),
        note: String(task.note || ""),
        done: !!task.done
      };

    NG.ui.formModal({
      title: isNew ? "Neue Aufgabe" : "Aufgabe bearbeiten",
      submitText: isNew ? "Anlegen" : "Speichern",
      intro: isNew
        ? "Trag ein, was du erledigen willst. Fach und Datum helfen dir später beim Sortieren."
        : null,
      values: values,
      fields: [
        {
          name: "title", label: "Was ist zu tun?", type: "text", required: true, full: true,
          placeholder: "z. B. Mathe Buch S. 42, Nr. 1–5"
        },
        {
          name: "subjectId", label: "Fach", type: "select", nullable: true,
          options: NG.ui.subjectOptions({ allowNone: true, noneLabel: "— ohne Fach —" })
        },
        { name: "due", label: "Fällig am", type: "date", hint: "Leer lassen, wenn es kein Datum gibt." },
        {
          name: "priority", label: "Wichtigkeit", type: "select",
          options: PRIORITIES.map(function (p) { return { value: p.value, label: p.label }; })
        },
        {
          name: "note", label: "Notiz", type: "textarea", full: true, rows: 3,
          placeholder: "Platz für Details, Seitenzahlen oder Ideen"
        },
        { name: "done", label: "Ist schon erledigt", type: "checkbox" }
      ],
      onDelete: isNew ? null : function () {
        NG.store.remove("tasks", task.id);
        NG.ui.toast("Aufgabe gelöscht");
        ctx.rerender();
      },
      deleteMessage: isNew ? null : "„" + titleOf(task) + "“ wird dauerhaft entfernt."
    }).then(function (data) {
      if (!data) return;                    // abgebrochen oder gelöscht

      var p = U.num(data.priority, 3);
      var patch = {
        title: String(data.title || "").trim() || "Ohne Titel",
        subjectId: data.subjectId || null,
        due: /^\d{4}-\d{2}-\d{2}$/.test(String(data.due || "")) ? String(data.due) : "",
        priority: U.clamp(Math.round(p === null ? 3 : p), 1, 3),
        note: String(data.note || ""),
        done: !!data.done
      };

      if (isNew) {
        patch.doneAt = patch.done ? new Date().toISOString() : null;
        NG.store.add("tasks", patch);
        NG.ui.toast("Aufgabe angelegt", "success");
      } else {
        if (patch.done && !task.done) patch.doneAt = new Date().toISOString();
        if (!patch.done) patch.doneAt = null;
        NG.store.update("tasks", task.id, patch);
        NG.ui.toast("Änderungen gespeichert", "success");
      }
      ctx.rerender();
    });
  }

  /* ---------- Bausteine ------------------------------------ */

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

  /** Fälligkeit als kurzer Text: „heute“, „in 3 Tagen“, „vor 2 Tagen“ + Datum. */
  function dueNode(task) {
    var d = dueOf(task);
    if (!d) return el("span", { class: "faint", text: "ohne Datum" });
    var n = U.daysUntil(d);
    var cls = "countdown";
    if (n !== null && n < 0) cls += " countdown--soon";        // überfällig: rot
    else if (n !== null && n <= 2) cls += " countdown--near";  // bald: orange
    return el("span", { class: cls, text: U.relDays(d) + " · " + U.fmtDate(d, { style: "short" }) });
  }

  function doneNode(task) {
    var d = doneDayOf(task);
    if (!d) return el("span", { class: "faint", text: "erledigt" });
    return el("span", { class: "faint", text: "erledigt " + U.relDays(d) });
  }

  /** Ein Listeneintrag mit Checkbox, Titel, Meta-Zeile und Knöpfen. */
  function taskItem(task, ctx) {
    var box = el("input", {
      type: "checkbox",
      "aria-label": task.done
        ? "„" + titleOf(task) + "“ wieder als offen markieren"
        : "„" + titleOf(task) + "“ als erledigt markieren"
    });
    box.checked = !!task.done;
    box.addEventListener("change", function () { toggleDone(task, box.checked, ctx); });

    var meta = el("div", { class: "list__meta" });
    if (subjectIdOf(task)) meta.appendChild(NG.ui.subjectTag(subjectIdOf(task), { short: false }));
    meta.appendChild(task.done ? doneNode(task) : dueNode(task));

    var p = prioInfo(task);
    if (p.value === 1 || p.value === 2) {
      meta.appendChild(el("span", { class: p.badge, text: p.label }));
    }

    var note = String(task.note || "").trim();
    if (note) {
      meta.appendChild(el("span", {
        class: "faint truncate",
        style: { maxWidth: "24ch" },
        title: note,
        text: U.truncate(note.replace(/\s+/g, " "), 70)
      }));
    }

    return el("div", { class: "list__item" + (task.done ? " is-done" : "") }, [
      box,
      el("div", { class: "list__main" }, [
        el("div", { class: "list__title", text: titleOf(task) }),
        meta
      ]),
      el("div", { class: "list__actions" }, [
        iconButton("edit", "Aufgabe bearbeiten", function () { openDialog(task, ctx); }),
        iconButton("trash", "Aufgabe löschen", function () { removeTask(task, ctx); })
      ])
    ]);
  }

  /** Eine Gruppe als Karte. Leere Gruppen ruft niemand auf. */
  function groupCard(opts, items, ctx) {
    var head = el("div", { class: "card__head" }, [
      el("h3", { text: opts.title, style: opts.danger ? { color: "var(--danger)" } : null }),
      el("span", {
        class: "badge" + (opts.danger ? " badge--danger" : ""),
        text: String(opts.count === undefined ? items.length : opts.count)
      }),
      opts.actions ? el("div", { class: "row row--tight spacer" }, opts.actions) : null
    ]);

    var body = null;
    if (!opts.collapsed) {
      body = el("div", { class: "card__body card__body--flush" },
        el("div", { class: "list" }, items.map(function (t) { return taskItem(t, ctx); })));
    }

    return el("div", { class: "card" }, [head, body, opts.foot ? el("div", { class: "card__foot", text: opts.foot }) : null]);
  }

  /* ---------- Schnelleingabe -------------------------------- */

  function quickCard(ctx) {
    var input = el("input", {
      type: "text",
      placeholder: "Was ist zu tun?",
      "aria-label": "Neue Aufgabe",
      maxlength: "200",
      style: { flex: "1 1 240px", minWidth: "0" },
      onInput: function (e) { quick.text = e.target.value; },
      onKeydown: function (e) {
        if (e.key === "Enter") { e.preventDefault(); addQuick(ctx); }
      }
    });
    input.value = quick.text || "";
    quickInput = input;

    var subjectSel = el("select", {
      "aria-label": "Fach der neuen Aufgabe",
      style: { flex: "0 1 170px", minWidth: "0" },
      onChange: function (e) { quick.subjectId = e.target.value || ""; }
    }, NG.ui.subjectOptions({ allowNone: true, noneLabel: "— ohne Fach —" }).map(function (o) {
      return el("option", { value: o.value === null ? "" : o.value, text: o.label });
    }));
    subjectSel.value = quick.subjectId || "";
    if (subjectSel.value !== (quick.subjectId || "")) {
      // Fach gibt es nicht mehr – zurück auf „ohne Fach“
      quick.subjectId = "";
      subjectSel.value = "";
    }

    var dateInput = el("input", {
      type: "date",
      "aria-label": "Fällig am",
      style: { flex: "0 1 165px", minWidth: "0" },
      onChange: function (e) { quick.due = e.target.value || ""; }
    });
    if (quick.due === null) quick.due = U.todayISO();   // Vorbelegung: heute
    dateInput.value = quick.due;

    var addBtn = textButton("plus", "Hinzufügen", "btn btn--primary", function () { addQuick(ctx); });

    return el("div", { class: "card" }, [
      el("div", { class: "card__body" }, [
        el("div", { class: "row" }, [input, subjectSel, dateInput, addBtn]),
        el("div", { class: "field__hint mt-2", text: "Tipp: Einfach tippen und die Eingabetaste drücken." })
      ])
    ]);
  }

  /* ---------- Fortschritt ----------------------------------- */

  function progressCard(list) {
    var today = U.todayISO();
    var weekStart = U.startOfWeek(today);
    var weekEnd = U.addDays(weekStart, 6);

    var open = openTasks(list);
    var overdue = open.filter(function (t) { var d = dueOf(t); return d && d < today; });
    var dueToday = open.filter(function (t) { return dueOf(t) === today; });

    var doneWeek = list.filter(function (t) {
      var d = doneDayOf(t);
      return t.done && d && d >= weekStart && d <= weekEnd;
    });
    var openWeek = open.filter(function (t) {
      var d = dueOf(t);
      return d && d <= weekEnd;
    });

    var total = doneWeek.length + openWeek.length;
    var pct = total > 0 ? Math.round((doneWeek.length / total) * 100) : 0;

    var barNote = total > 0
      ? doneWeek.length + " von " + total + " geschafft (" + pct + " %)"
      : "Diese Woche steht gerade nichts an.";

    return el("div", { class: "card" }, [
      el("div", { class: "card__body stack" }, [
        el("div", { class: "grid grid--3" }, [
          NG.ui.stat("Offen", String(open.length),
            open.length === 0 ? "Alles abgehakt" : "noch zu erledigen"),
          NG.ui.stat("Heute fällig", String(dueToday.length),
            dueToday.length === 0 ? "heute nichts fällig" : "für heute eingeplant",
            dueToday.length ? "var(--warn)" : null),
          NG.ui.stat("Überfällig", String(overdue.length),
            overdue.length === 0 ? "nichts liegen geblieben" : "schnapp dir das zuerst",
            overdue.length ? "var(--danger)" : null)
        ]),
        el("div", { class: "stack stack--sm" }, [
          el("div", { class: "row row--tight" }, [
            el("span", { class: "fw-6 fs-sm", text: "Erledigt diese Woche" }),
            el("span", { class: "fs-sm muted tnum spacer", text: barNote })
          ]),
          el("div", { class: "progress" },
            el("div", {
              class: "progress__bar",
              style: {
                width: pct + "%",
                background: pct >= 100 ? "var(--success)" : "var(--accent)"
              }
            }))
        ])
      ])
    ]);
  }

  /* ---------- Filter ---------------------------------------- */

  function chip(label, active, onClick, color) {
    return el("button", {
      class: "chip", type: "button", "aria-pressed": active ? "true" : "false",
      onClick: onClick
    }, [
      color ? el("span", { class: "subject-dot", style: { background: color } }) : null,
      el("span", { text: label })
    ]);
  }

  function filterRow(list, ctx) {
    var chips = [];

    chips.push(chip("Alle Fächer", filter.subjectId === "all", function () {
      filter.subjectId = "all";
      ctx.rerender();
    }));

    NG.store.activeSubjects().forEach(function (sub) {
      chips.push(chip(sub.name, filter.subjectId === sub.id, function () {
        filter.subjectId = sub.id;
        ctx.rerender();
      }, sub.color));
    });

    var withoutSubject = list.filter(function (t) { return !subjectIdOf(t); }).length;
    if (withoutSubject) {
      chips.push(chip("Ohne Fach", filter.subjectId === "none", function () {
        filter.subjectId = "none";
        ctx.rerender();
      }));
    }

    var toggle = el("div", { class: "btn-group spacer", role: "group", "aria-label": "Welche Aufgaben anzeigen?" }, [
      el("button", {
        type: "button", text: "Nur offene", "aria-pressed": filter.onlyOpen ? "true" : "false",
        onClick: function () { if (!filter.onlyOpen) { filter.onlyOpen = true; ctx.rerender(); } }
      }),
      el("button", {
        type: "button", text: "Alle", "aria-pressed": filter.onlyOpen ? "false" : "true",
        onClick: function () { if (filter.onlyOpen) { filter.onlyOpen = false; ctx.rerender(); } }
      })
    ]);

    return el("div", { class: "row row--tight" }, [chips, toggle]);
  }

  /* ---------- Ansicht --------------------------------------- */

  function render(root, ctx) {
    quickInput = null;

    var list = allTasks();
    var visible = applySubjectFilter(list);

    var today = U.todayISO();
    var weekEnd = U.addDays(today, 7);

    var stack = el("div", { class: "stack" });
    stack.appendChild(quickCard(ctx));
    if (list.length) stack.appendChild(filterRow(list, ctx));
    stack.appendChild(progressCard(visible));

    if (!list.length) {
      // Ganz leerer Speicher: freundlicher Einstieg statt leerer Gruppen
      stack.appendChild(el("div", { class: "card" },
        el("div", { class: "card__body" }, NG.ui.empty({
          icon: "checkSquare",
          title: "Noch keine Aufgaben",
          text: "Trag oben ein, was du erledigen willst – oder leg gleich eine Aufgabe mit Fach, Datum und Notiz an.",
          action: { label: "Neue Aufgabe", onClick: function () { openDialog(null, ctx); } }
        }))));
      root.appendChild(stack);
      restoreFocus();
      return;
    }

    var buckets = { overdue: [], today: [], week: [], later: [], none: [] };
    var done = [];

    visible.forEach(function (t) {
      if (t.done) { done.push(t); return; }
      buckets[bucketOf(t, today, weekEnd)].push(t);
    });

    var groups = [
      { key: "overdue", title: "Überfällig", danger: true },
      { key: "today", title: "Heute" },
      { key: "week", title: "Diese Woche" },
      { key: "later", title: "Später" },
      { key: "none", title: "Ohne Datum" }
    ];

    var shown = 0;
    groups.forEach(function (g) {
      var items = buckets[g.key];
      if (!items.length) return;                   // leere Gruppen weglassen
      shown++;
      items = g.key === "none" ? sortUndated(items) : sortOpen(items);
      stack.appendChild(groupCard({ title: g.title, danger: g.danger }, items, ctx));
    });

    if (!shown) {
      stack.appendChild(el("div", { class: "card" },
        el("div", { class: "card__body" }, NG.ui.empty({
          icon: "check",
          title: filter.subjectId === "all" ? "Alles erledigt!" : "Hier ist gerade nichts offen",
          text: filter.subjectId === "all"
            ? "Du hast keine offenen Aufgaben. Genieß die freie Zeit – oder plane schon mal die nächste."
            : "Für dieses Fach ist nichts offen. Schau dir die anderen Fächer an oder leg etwas Neues an.",
          action: { label: "Neue Aufgabe", onClick: function () { openDialog(null, ctx); } }
        }))));
    }

    // „Erledigt“ kommt zuletzt, eingeklappt, und zeigt nur die letzten 30.
    if (!filter.onlyOpen && done.length) {
      var recent = U.sortBy(done, function (t) { return doneDayOf(t) + String(t.doneAt || ""); }, "desc")
        .slice(0, DONE_LIMIT);
      var toggle = el("button", {
        class: "btn btn--sm btn--ghost", type: "button",
        "aria-expanded": doneOpen ? "true" : "false",
        onClick: function () { doneOpen = !doneOpen; ctx.rerender(); }
      }, [
        U.iconEl("chevronDown"),
        el("span", { text: doneOpen ? "Verbergen" : "Anzeigen" })
      ]);

      stack.appendChild(groupCard({
        title: "Erledigt",
        count: done.length,
        collapsed: !doneOpen,
        actions: [toggle],
        foot: doneOpen && done.length > DONE_LIMIT
          ? "Es werden nur die letzten " + DONE_LIMIT + " erledigten Aufgaben gezeigt."
          : null
      }, recent, ctx));
    }

    root.appendChild(stack);
    restoreFocus();
  }

  /** Nach dem Neu-Rendern zurück in die Schnelleingabe springen. */
  function restoreFocus() {
    if (!wantFocus || !quickInput) return;
    wantFocus = false;
    var input = quickInput;
    try { input.focus({ preventScroll: true }); }
    catch (e) { try { input.focus(); } catch (e2) { /* Fokus ist nicht lebenswichtig */ } }
  }

  /* ---------- Registrierung --------------------------------- */

  NG.app.register({
    id: "tasks",
    title: "Aufgaben",
    subtitle: "Hausaufgaben und To-dos an einem Ort",
    icon: "checkSquare",
    group: "plan",
    order: 3,
    tab: true,
    live: false,               // wir rendern selbst neu, damit der Fokus bleibt
    render: render,

    badge: function () {
      var today = U.todayISO();
      return allTasks().filter(function (t) {
        if (t.done) return false;
        var d = dueOf(t);
        return !!d && d <= today;
      }).length;
    },

    actions: function (ctx) {
      var out = [];
      var doneCount = allTasks().filter(function (t) { return t.done; }).length;
      if (doneCount) {
        out.push(textButton("trash", "Erledigte löschen", "btn btn--sm",
          function () { clearDone(ctx); }));
      }
      out.push(textButton("plus", "Neue Aufgabe", "btn btn--sm btn--primary",
        function () { openDialog(null, ctx); }));
      return out;
    },

    primaryAction: function (ctx) {
      return {
        label: "Neue Aufgabe",
        icon: "plus",
        onClick: function () { openDialog(null, ctx); }
      };
    },

    onLeave: function () {
      wantFocus = false;
      quickInput = null;
    }
  });
})(window);
