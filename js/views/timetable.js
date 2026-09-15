/* =========================================================
   NextGen Lernen – Stundenplan
   Deine Woche von Montag bis Freitag: Stunden eintragen,
   ändern und auf einen Blick sehen, was heute dran ist.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Feste Werte ---------------------------------- */

  var DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

  var DEFAULT_SLOTS = 9;
  var MIN_SLOTS = 1;
  var MAX_SLOTS = 12;          // im Datenmodell sind die Stunden 1–12 vorgesehen
  var DEFAULT_START = "08:00";
  var DEFAULT_LENGTH = 45;

  /* Modulvariable: so viele Stunden zeigt das Raster gerade.
     Der Wert wird in den Einstellungen unter „ttSlots“ gemerkt. */
  var slots = DEFAULT_SLOTS;

  /* ---------- Stunden-Anzahl -------------------------------- */

  /** Liest die gemerkte Stundenzahl und hält die Modulvariable aktuell. */
  function readSlots() {
    var n = U.num(NG.store.getSetting("ttSlots", DEFAULT_SLOTS), DEFAULT_SLOTS);
    if (n === null || !isFinite(n)) n = DEFAULT_SLOTS;
    slots = U.clamp(Math.round(n), MIN_SLOTS, MAX_SLOTS);
    return slots;
  }

  /** Merkt eine neue Stundenzahl dauerhaft. */
  function writeSlots(n) {
    var v = U.num(n, DEFAULT_SLOTS);
    if (v === null || !isFinite(v)) v = DEFAULT_SLOTS;
    slots = U.clamp(Math.round(v), MIN_SLOTS, MAX_SLOTS);
    NG.store.setSetting("ttSlots", slots);
    return slots;
  }

  /* ---------- Uhrzeiten ------------------------------------- */

  /** „08:00“ → Minuten seit Mitternacht. Bei Murks kommt der Ersatzwert zurück. */
  function parseClock(value, fallbackMinutes) {
    var raw = value === null || value === undefined ? "" : String(value);
    var m = raw.match(/^\s*(\d{1,2}):(\d{2})/);
    if (!m) return fallbackMinutes;
    var h = parseInt(m[1], 10);
    var mi = parseInt(m[2], 10);
    if (!isFinite(h) || !isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return fallbackMinutes;
    return h * 60 + mi;
  }

  /** Minuten seit Mitternacht → „08:45“ (dreht bei Mitternacht sauber um). */
  function fmtClock(minutes) {
    var total = Math.round(U.num(minutes, 0) || 0);
    if (!isFinite(total)) total = 0;
    total = ((total % 1440) + 1440) % 1440;
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" +
      String(total % 60).padStart(2, "0");
  }

  /** Startzeit und Stundenlänge aus den Einstellungen. */
  function timing() {
    var start = parseClock(NG.store.getSetting("firstHourStart", DEFAULT_START), 8 * 60);
    var len = U.num(NG.store.getSetting("lessonMinutes", DEFAULT_LENGTH), DEFAULT_LENGTH);
    if (len === null || !isFinite(len) || len <= 0) len = DEFAULT_LENGTH;
    return { start: start, len: U.clamp(Math.round(len), 5, 180) };
  }

  function slotStart(t, slot) { return t.start + (slot - 1) * t.len; }
  function slotEnd(t, slot) { return slotStart(t, slot) + t.len; }

  /** „08:00 – 08:45“ */
  function slotRange(t, slot) {
    return fmtClock(slotStart(t, slot)) + " – " + fmtClock(slotEnd(t, slot));
  }

  /* ---------- Einträge -------------------------------------- */

  function allEntries() {
    var list = NG.store.all("timetable");
    if (!Array.isArray(list)) return [];
    return list.filter(function (e) { return e && typeof e === "object"; });
  }

  function dayOf(entry) {
    var d = U.num(entry.day, null);
    return d === null ? null : Math.round(d);
  }

  function slotOf(entry) {
    var s = U.num(entry.slot, null);
    return s === null ? null : Math.round(s);
  }

  /** Nachschlagewerk „tag:stunde“ → Eintrag (der erste gewinnt). */
  function buildIndex() {
    var map = {};
    allEntries().forEach(function (e) {
      var d = dayOf(e);
      var s = slotOf(e);
      if (d === null || s === null) return;
      if (d < 0 || d > 4 || s < 1) return;
      var key = d + ":" + s;
      if (!map[key]) map[key] = e;
    });
    return map;
  }

  /** Alle (auch doppelte) Einträge einer Zelle. */
  function entriesAt(day, slot) {
    return allEntries().filter(function (e) {
      return dayOf(e) === day && slotOf(e) === slot;
    });
  }

  /** Höchste belegte Stundennummer – für den Hinweis auf verborgene Stunden. */
  function maxUsedSlot() {
    var max = 0;
    allEntries().forEach(function (e) {
      var s = slotOf(e);
      var d = dayOf(e);
      if (s === null || d === null || d < 0 || d > 4) return;
      if (s > max) max = s;
    });
    return max;
  }

  /* ---------- Fächer ---------------------------------------- */

  function subjectOf(entry) {
    return entry && entry.subjectId ? NG.store.subject(entry.subjectId) : null;
  }

  /** Kürzel, sonst Name – passend für die schmale Zelle. */
  function cellLabel(entry) {
    var sub = subjectOf(entry);
    if (!sub) return "Fach fehlt";
    var short = String(sub.short || "").trim();
    if (short) return short;
    return U.truncate(String(sub.name || "Fach").trim() || "Fach", 12);
  }

  function fullName(entry) {
    var sub = subjectOf(entry);
    if (sub) return String(sub.name || sub.short || "Fach");
    return "Gelöschtes Fach";
  }

  function colorOf(entry) {
    var sub = subjectOf(entry);
    return sub && sub.color ? sub.color : "var(--text-faint)";
  }

  function roomOf(entry) { return String((entry && entry.room) || "").trim(); }
  function teacherOf(entry) { return String((entry && entry.teacher) || "").trim(); }

  /** Auswahlliste fürs Formular – „— frei —“ zuerst. */
  function subjectChoices(currentId) {
    var list = NG.ui.subjectOptions({ allowNone: true, noneLabel: "— frei —" });
    var known = false;
    list.forEach(function (o) { if (currentId && o.value === currentId) known = true; });
    if (currentId && !known) {
      var sub = NG.store.subject(currentId);
      if (sub) list.push({ value: sub.id, label: (sub.name || "Fach") + " (archiviert)" });
    }
    return list;
  }

  /* ---------- Heute ----------------------------------------- */

  /** Welcher Wochentag wird gezeigt und wie spät ist es? */
  function todayInfo() {
    var now = new Date();
    var js = now.getDay();                     // 0 = Sonntag … 6 = Samstag
    var weekend = js === 0 || js === 6;
    return {
      weekend: weekend,
      day: weekend ? 0 : js - 1,               // am Wochenende zeigen wir den Montag
      minutes: now.getHours() * 60 + now.getMinutes()
    };
  }

  /**
   * Welche Stunde läuft gerade, welche kommt als Nächste?
   * @param {number[]} filled aufsteigende Liste der belegten Stundennummern
   */
  function markerFor(info, t, filled) {
    var out = { running: null, next: null };
    if (info.weekend) return out;
    filled.forEach(function (n) {
      var s = slotStart(t, n);
      var e = slotEnd(t, n);
      if (info.minutes >= s && info.minutes < e) out.running = n;
      else if (info.minutes < s && out.next === null) out.next = n;
    });
    return out;
  }

  /* ---------- Kleine Bausteine ------------------------------ */

  function textButton(iconName, label, cls, onClick, opts) {
    var btn = el("button", {
      class: cls || "btn btn--sm",
      type: "button",
      html: (iconName ? U.icon(iconName) : "") + "<span>" + U.escapeHtml(label) + "</span>",
      onClick: onClick
    });
    if (opts && opts.title) btn.title = opts.title;
    if (opts && opts.disabled) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    }
    return btn;
  }

  /* ---------- Zelle bearbeiten ------------------------------ */

  /** Dialog zum Setzen, Ändern oder Leeren einer Stunde. */
  function openCell(day, slot, ctx) {
    if (day < 0 || day > 4) return;
    var t = timing();
    var existing = entriesAt(day, slot);
    var entry = existing.length ? existing[0] : null;

    var fields = [
      {
        name: "subjectId", label: "Fach", type: "select", full: true, nullable: true,
        options: subjectChoices(entry ? entry.subjectId : null),
        hint: "Wähle „— frei —“, wenn die Stunde ausfallen oder leer bleiben soll."
      },
      {
        name: "room", label: "Raum", type: "text", placeholder: "z. B. A 204",
        hint: "Leer lassen – dann nehmen wir den Raum aus dem Fach."
      },
      {
        name: "teacher", label: "Lehrkraft", type: "text", placeholder: "z. B. Frau Meier",
        hint: "Leer lassen – dann nehmen wir die Lehrkraft aus dem Fach."
      }
    ];

    var values = {
      subjectId: entry && entry.subjectId ? entry.subjectId : "",
      room: entry ? roomOf(entry) : "",
      teacher: entry ? teacherOf(entry) : ""
    };

    NG.ui.formModal({
      title: DAYS[day] + ", " + slot + ". Stunde",
      intro: slotRange(t, slot) + (entry ? " · " + fullName(entry) : " · noch frei"),
      fields: fields,
      values: values,
      submitText: "Übernehmen",
      onDelete: entry ? function () {
        entriesAt(day, slot).forEach(function (e) { NG.store.remove("timetable", e.id); });
        NG.ui.toast("Stunde geleert", "success");
        if (ctx && ctx.rerender) ctx.rerender();
      } : null,
      deleteMessage: "Diese Stunde wird aus deinem Plan entfernt."
    }).then(function (result) {
      if (!result) return;                     // abgebrochen oder gelöscht
      saveCell(day, slot, result);
      if (ctx && ctx.rerender) ctx.rerender();
    });
  }

  /** Schreibt die Werte aus dem Dialog in den Speicher. */
  function saveCell(day, slot, values) {
    var list = entriesAt(day, slot);
    var subjectId = values.subjectId || null;

    if (!subjectId) {
      if (!list.length) return;
      list.forEach(function (e) { NG.store.remove("timetable", e.id); });
      NG.ui.toast("Stunde geleert", "success");
      return;
    }

    var room = String(values.room || "").trim();
    var teacher = String(values.teacher || "").trim();
    var sub = NG.store.subject(subjectId);
    if (sub) {
      if (!room && sub.room) room = String(sub.room).trim();
      if (!teacher && sub.teacher) teacher = String(sub.teacher).trim();
    }

    var patch = {
      day: day, slot: slot, subjectId: subjectId,
      room: room, teacher: teacher
    };

    if (list.length) {
      NG.store.update("timetable", list[0].id, patch);
      // Doppelte Einträge derselben Zelle aufräumen
      list.slice(1).forEach(function (e) { NG.store.remove("timetable", e.id); });
    } else {
      NG.store.add("timetable", patch);
    }
    NG.ui.toast(NG.store.subjectName(subjectId) + " eingetragen", "success");
  }

  /* ---------- Raster ---------------------------------------- */

  function headRow(grid, info) {
    // leere Ecke über der Zeitspalte
    grid.appendChild(el("div", { class: "tt__head", "aria-hidden": "true" }));

    DAYS.forEach(function (name, day) {
      var isToday = !info.weekend && info.day === day;
      grid.appendChild(el("div", {
        class: "tt__head",
        style: isToday ? { color: "var(--accent-text)" } : null,
        title: isToday ? "Heute" : null,
        text: name
      }));
    });
  }

  function timeCell(t, slot, isNow) {
    return el("div", { class: "tt__time" }, [
      el("div", {
        class: "fw-6",
        style: { color: isNow ? "var(--accent-text)" : "var(--text-muted)" },
        text: slot + "."
      }),
      el("div", { text: fmtClock(slotStart(t, slot)) }),
      el("div", { style: { fontSize: ".92em", opacity: ".72" }, text: fmtClock(slotEnd(t, slot)) })
    ]);
  }

  function cellButton(day, slot, entry, t, ctx) {
    var range = slotRange(t, slot);
    var btn;

    if (entry) {
      var color = colorOf(entry);
      var room = roomOf(entry);
      var teacher = teacherOf(entry);
      var label = DAYS[day] + ", " + slot + ". Stunde, " + range + ": " + fullName(entry) +
        (room ? ", Raum " + room : "") + (teacher ? ", " + teacher : "") + ". Zum Ändern antippen.";

      btn = el("button", {
        class: "tt__cell is-filled",
        type: "button",
        "aria-label": label,
        title: fullName(entry) + (room ? " · Raum " + room : "") + (teacher ? " · " + teacher : "") +
          "\n" + range,
        style: { background: color, color: "#fff", borderColor: color },
        onClick: function () { openCell(day, slot, ctx); }
      }, [
        el("span", { text: cellLabel(entry) }),
        room ? el("span", { class: "tt__room", text: room }) : null
      ]);
    } else {
      btn = el("button", {
        class: "tt__cell",
        type: "button",
        "aria-label": DAYS[day] + ", " + slot + ". Stunde, " + range + ": frei. Zum Eintragen antippen.",
        title: range + " · frei",
        onClick: function () { openCell(day, slot, ctx); }
      }, el("span", { "aria-hidden": "true", text: "+" }));
    }

    return btn;
  }

  /** Das komplette Wochenraster als Karte. */
  function gridCard(ctx) {
    var t = timing();
    var info = todayInfo();
    var index = buildIndex();

    var grid = el("div", { class: "tt", role: "group", "aria-label": "Stundenplan von Montag bis Freitag" });
    headRow(grid, info);

    for (var n = 1; n <= slots; n++) {
      var running = !info.weekend &&
        info.minutes >= slotStart(t, n) && info.minutes < slotEnd(t, n);
      grid.appendChild(timeCell(t, n, running));
      for (var day = 0; day < 5; day++) {
        grid.appendChild(cellButton(day, n, index[day + ":" + n] || null, t, ctx));
      }
    }

    var wrap = el("div", { class: "tt-wrap" }, grid);

    var maxUsed = maxUsedSlot();
    var foot = el("div", { class: "row row--tight" }, [
      el("span", {
        class: "fs-sm muted",
        text: "Jede Stunde dauert " + t.len + " Minuten, die erste beginnt um " +
          fmtClock(t.start) + "."
      }),
      textButton("settings", "Zeiten ändern", "btn btn--sm btn--ghost spacer", function () {
        ctx.go("settings");
      }, { title: "Startzeit und Stundenlänge in den Einstellungen anpassen" })
    ]);

    var body = [wrap];
    if (maxUsed > slots) {
      body.push(el("div", { class: "row row--tight mt-3" }, [
        el("span", {
          class: "fs-sm muted",
          text: "Hinter der " + slots + ". Stunde stehen noch Einträge bis zur " +
            maxUsed + ". Stunde."
        }),
        textButton(null, "Alle Stunden zeigen", "btn btn--sm", function () {
          writeSlots(maxUsed);
          ctx.rerender();
        })
      ]));
    }

    return NG.ui.card({ title: "Deine Woche", body: body, foot: foot });
  }

  /* ---------- Karte „Heute“ --------------------------------- */

  function todayRow(row, t, mark, ctx) {
    var entry = row.entry;
    var isRunning = mark.running === row.slot;
    var isNext = !isRunning && mark.next === row.slot;
    var room = roomOf(entry);
    var teacher = teacherOf(entry);

    var meta = [
      el("span", { class: "tnum", text: slotRange(t, row.slot) })
    ];
    if (room) meta.push(el("span", { text: "Raum " + room }));
    if (teacher) meta.push(el("span", { text: teacher }));

    var badge = null;
    if (isRunning) badge = el("span", { class: "badge badge--accent", text: "läuft gerade" });
    else if (isNext) badge = el("span", { class: "badge badge--info", text: "als Nächstes" });

    return el("button", {
      class: "list__item list__item--btn",
      type: "button",
      style: (isRunning || isNext) ? { background: "var(--accent-soft)" } : null,
      onClick: function () { openCell(row.day, row.slot, ctx); }
    }, [
      el("span", {
        class: "fw-6 tnum faint",
        style: { minWidth: "1.8em", textAlign: "right" },
        text: row.slot + "."
      }),
      el("span", { class: "subject-dot", style: { background: colorOf(entry) } }),
      el("span", { class: "list__main" }, [
        el("span", { class: "list__title", text: fullName(entry) }),
        el("span", { class: "list__meta" }, meta)
      ]),
      badge
    ]);
  }

  function todayCard(ctx) {
    var t = timing();
    var info = todayInfo();
    var index = buildIndex();

    var rows = [];
    for (var n = 1; n <= slots; n++) {
      var entry = index[info.day + ":" + n];
      if (entry) rows.push({ slot: n, day: info.day, entry: entry });
    }

    var filled = rows.map(function (r) { return r.slot; });
    var mark = markerFor(info, t, filled);

    var body = [];

    if (info.weekend) {
      body.push(el("div", {
        class: "fs-sm muted",
        style: { padding: "var(--sp-4) var(--sp-5) var(--sp-2)" },
        text: "Wochenende – das ist dein Montag."
      }));
    }

    if (!rows.length) {
      body.push(NG.ui.empty({
        icon: "clock",
        title: "Für " + DAYS[info.day] + " ist nichts eingetragen",
        text: "Tippe oben im Raster auf eine Stunde – oder trag sie gleich hier ein.",
        action: {
          label: "Stunde eintragen",
          onClick: function () { openCell(info.day, firstFreeSlot(info.day), ctx); }
        }
      }));
    } else {
      var list = el("div", { class: "list" });
      rows.forEach(function (r) { list.appendChild(todayRow(r, t, mark, ctx)); });
      body.push(list);
    }

    var footText;
    if (info.weekend) {
      footText = rows.length
        ? "Am Montag geht es um " + fmtClock(slotStart(t, rows[0].slot)) + " los."
        : "Genieß dein Wochenende.";
    } else if (mark.running !== null) {
      footText = "Gerade läuft die " + mark.running + ". Stunde – bis " +
        fmtClock(slotEnd(t, mark.running)) + ".";
    } else if (mark.next !== null) {
      footText = "Als Nächstes: " + mark.next + ". Stunde um " +
        fmtClock(slotStart(t, mark.next)) + ".";
    } else if (rows.length) {
      footText = "Für heute ist dein Stundenplan durch.";
    } else {
      footText = null;
    }

    var actions = rows.length
      ? [el("span", {
          class: "badge",
          text: rows.length === 1 ? "1 Stunde" : rows.length + " Stunden"
        })]
      : null;

    return NG.ui.card({
      title: "Heute – " + (info.weekend ? "Wochenende" : DAYS[info.day]),
      actions: actions,
      body: body,
      flush: true,
      foot: footText ? el("span", { class: "fs-sm muted", text: footText }) : null
    });
  }

  /* ---------- Leerzustand ------------------------------------ */

  function emptyState(ctx) {
    return NG.ui.empty({
      icon: "grid",
      title: "Noch keine Fächer da",
      text: "Lege zuerst deine Fächer an – danach trägst du sie hier mit einem Tipp in den Wochenplan ein.",
      action: {
        label: "Fächer anlegen",
        onClick: function () { ctx.go("subjects"); }
      }
    });
  }

  /* ---------- Aktionen in der Kopfzeile ---------------------- */

  function addSlot(ctx) {
    if (slots >= MAX_SLOTS) {
      NG.ui.toast("Mehr als " + MAX_SLOTS + " Stunden pro Tag gehen nicht.", "warn");
      return;
    }
    writeSlots(slots + 1);
    ctx.rerender();
  }

  function removeSlot(ctx) {
    if (slots <= MIN_SLOTS) {
      NG.ui.toast("Weniger als eine Stunde geht nicht.", "warn");
      return;
    }
    var last = slots;
    var used = allEntries().filter(function (e) { return slotOf(e) === last; }).length;

    if (!used) {
      writeSlots(last - 1);
      ctx.rerender();
      return;
    }

    NG.ui.confirm({
      title: "Letzte Stunde ausblenden?",
      message: "In der " + last + ". Stunde " + (used === 1 ? "steht noch 1 Eintrag" : "stehen noch " + used + " Einträge") +
        ". Die Einträge bleiben gespeichert und sind wieder da, sobald du die Stunde zurückholst.",
      confirmText: "Ausblenden"
    }).then(function (yes) {
      if (!yes) return;
      writeSlots(last - 1);
      ctx.rerender();
    });
  }

  function clearPlan(ctx) {
    var count = allEntries().length;
    if (!count) {
      NG.ui.toast("Dein Plan ist schon leer.");
      return;
    }
    NG.ui.confirm({
      title: "Ganzen Plan leeren?",
      message: "Alle " + count + " Einträge im Stundenplan werden gelöscht. " +
        "Deine Fächer, Noten und Aufgaben bleiben unberührt.",
      confirmText: "Ja, Plan leeren",
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      NG.store.removeWhere("timetable", function () { return true; });
      NG.ui.toast("Stundenplan geleert", "success");
      ctx.rerender();
    });
  }

  /** Erste freie Stunde des heute gezeigten Tages – für den runden Knopf. */
  function firstFreeSlot(day) {
    var index = buildIndex();
    for (var n = 1; n <= slots; n++) {
      if (!index[day + ":" + n]) return n;
    }
    return 1;
  }

  /* ---------- Ansicht ---------------------------------------- */

  function render(root, ctx) {
    readSlots();

    var subjects = NG.store.activeSubjects();
    var entries = allEntries();

    if (!subjects.length && !entries.length) {
      root.appendChild(emptyState(ctx));
      return;
    }

    var stack = el("div", { class: "stack" }, [
      gridCard(ctx),
      todayCard(ctx)
    ]);
    root.appendChild(stack);
  }

  /* ---------- Registrierung ---------------------------------- */

  NG.app.register({
    id: "timetable",
    title: "Stundenplan",
    subtitle: "Deine Woche von Montag bis Freitag",
    icon: "grid",
    group: "plan",
    order: 4,
    tab: false,
    render: render,

    actions: function (ctx) {
      readSlots();
      var out = [];

      out.push(textButton(null, "− Stunde", "btn btn--sm",
        function () { removeSlot(ctx); },
        { title: "Eine Stunde weniger anzeigen", disabled: slots <= MIN_SLOTS }));

      out.push(textButton(null, "+ Stunde", "btn btn--sm",
        function () { addSlot(ctx); },
        { title: "Eine Stunde mehr anzeigen", disabled: slots >= MAX_SLOTS }));

      if (allEntries().length) {
        out.push(textButton("trash", "Plan leeren", "btn btn--sm btn--danger",
          function () { clearPlan(ctx); },
          { title: "Alle Einträge im Stundenplan löschen" }));
      }

      return out;
    },

    primaryAction: function (ctx) {
      if (!NG.store.activeSubjects().length) return null;
      var info = todayInfo();
      return {
        label: "Stunde eintragen",
        icon: "plus",
        onClick: function () {
          readSlots();
          openCell(info.day, firstFreeSlot(info.day), ctx);
        }
      };
    }
  });
})(window);
