/* =========================================================
   NextGen Lernen – Lernzeit
   Pomodoro-Timer und Lernstatistik.
   Der Timer lebt bewusst auf Modulebene: So läuft er weiter,
   auch wenn du zwischendurch in eine andere Ansicht wechselst.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Feste Werte ---------------------------------- */

  var DEFAULT_WORK = 25;        // Minuten Lernphase
  var DEFAULT_BREAK = 5;        // Minuten Pause
  var MIN_MINUTES = 1;
  var MAX_MINUTES = 180;
  var MIN_SAVE_SECONDS = 60;    // kürzere Einheiten zählen wir nicht mit
  var RECENT_LIMIT = 12;        // so viele Sitzungen zeigt die Liste
  var BAR_MAX_PX = 92;          // höchste Säule im Wochendiagramm

  /* ---------- Flüchtiger Zustand (Modulebene) --------------
     `timer` und `ticker` überleben einen Ansichtswechsel.
     `dom` zeigt auf die gerade sichtbaren Knoten – ist die
     Ansicht verlassen, steht hier null und es wird nur noch
     gerechnet, aber nichts mehr gezeichnet. */

  var timer = {
    phase: "work",              // "work" = Lernphase, "break" = Pause
    running: false,
    remaining: DEFAULT_WORK * 60,
    total: DEFAULT_WORK * 60,
    elapsed: 0,                 // Sekunden, die in dieser Lernphase gelaufen sind
    subjectId: "",
    startedAt: null             // Zeitstempel des Phasenbeginns
  };

  var ticker = null;            // Rückgabewert von setInterval
  var dom = null;               // Verweise auf die sichtbaren Knoten

  /* ---------- Kleine Helfer -------------------------------- */

  function clampMinutes(value, fallback) {
    var n = U.num(value, null);
    if (n === null) n = fallback;
    return U.clamp(Math.round(n), MIN_MINUTES, MAX_MINUTES);
  }

  function workMinutes() {
    return clampMinutes(NG.store.getSetting("focusWork", DEFAULT_WORK), DEFAULT_WORK);
  }

  function breakMinutes() {
    return clampMinutes(NG.store.getSetting("focusBreak", DEFAULT_BREAK), DEFAULT_BREAK);
  }

  function phaseMinutes(phase) {
    return phase === "break" ? breakMinutes() : workMinutes();
  }

  function phaseLabel(phase) {
    return phase === "break" ? "Pause" : "Lernphase";
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function mmss(seconds) {
    var s = Math.max(0, Math.round(seconds || 0));
    return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
  }

  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  function iconButton(icon, label, onClick) {
    return el("button", {
      class: "btn btn--icon btn--sm", type: "button",
      "aria-label": label, title: label, onClick: onClick
    }, U.iconEl(icon));
  }

  /** Beschriftung eines Knopfes (Symbol + Text) austauschen. */
  function setButton(btn, icon, label) {
    if (!btn) return;
    U.clear(btn);
    btn.appendChild(U.iconEl(icon));
    btn.appendChild(el("span", { text: label }));
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }

  function progressBar(percent, color) {
    var p = U.clamp(Math.round(percent || 0), 0, 100);
    return el("div", {
      class: "progress", role: "progressbar",
      "aria-valuenow": String(p), "aria-valuemin": "0", "aria-valuemax": "100"
    }, el("div", {
      class: "progress__bar",
      style: color ? { width: p + "%", background: color } : { width: p + "%" }
    }));
  }

  /* ---------- Sitzungen lesen ------------------------------ */

  /** Alle gespeicherten Lerneinheiten (Pausen zählen nicht mit). */
  function allSessions() {
    var list = NG.store.all("sessions");
    if (!Array.isArray(list)) return [];
    return list.filter(function (s) { return s && s.kind !== "break"; });
  }

  function minutesOf(session) {
    var n = U.num(session && session.minutes, 0);
    return n && n > 0 ? n : 0;
  }

  /** Tag einer Sitzung als YYYY-MM-DD – in Ortszeit, nicht in UTC. */
  function dayOf(session) {
    var raw = session && session.startedAt ? String(session.startedAt) : "";
    if (!raw) return "";
    if (raw.indexOf("T") < 0) return raw.slice(0, 10);
    var d = new Date(raw);
    if (isNaN(d.getTime())) return raw.slice(0, 10);
    return U.toISO(d);
  }

  /** Uhrzeit einer Sitzung, sofern im Zeitstempel enthalten. */
  function clockOf(session) {
    var raw = session && session.startedAt ? String(session.startedAt) : "";
    if (!raw || raw.indexOf("T") < 0) return "";
    var d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  /** Minuten je Tag als Nachschlagewerk {"2026-09-15": 50, …}. */
  function minutesByDay(sessions) {
    var map = {};
    sessions.forEach(function (s) {
      var day = dayOf(s);
      if (!day) return;
      map[day] = (map[day] || 0) + minutesOf(s);
    });
    return map;
  }

  function sumMinutes(sessions) {
    return sessions.reduce(function (sum, s) { return sum + minutesOf(s); }, 0);
  }

  /** Längste Reihe aufeinanderfolgender Tage mit mindestens einer Sitzung. */
  function longestStreak(days) {
    var sorted = days.slice().sort();
    var best = 0, run = 0, prev = null;
    sorted.forEach(function (day) {
      if (prev && U.addDays(prev, 1) === day) run += 1;
      else run = 1;
      if (run > best) best = run;
      prev = day;
    });
    return best;
  }

  /** Serie, die bis heute (oder gestern) reicht. */
  function currentStreak(days) {
    var known = {};
    days.forEach(function (d) { known[d] = true; });
    var today = U.todayISO();
    var cursor = known[today] ? today : (known[U.addDays(today, -1)] ? U.addDays(today, -1) : null);
    if (!cursor) return 0;
    var n = 0;
    while (known[cursor]) { n += 1; cursor = U.addDays(cursor, -1); }
    return n;
  }

  /* ---------- Fenstertitel --------------------------------- */

  function updateDocTitle() {
    if (!timer.running) return;
    document.title = mmss(timer.remaining) + " · " + phaseLabel(timer.phase) + " · NextGen Lernen";
  }

  function resetDocTitle() {
    var view = NG.app && NG.app.current ? NG.app.current() : null;
    document.title = (view && view.title ? view.title + " · " : "") + "NextGen Lernen";
  }

  /* ---------- Timer-Steuerung ------------------------------ */

  function stopTicker() {
    if (ticker) { global.clearInterval(ticker); ticker = null; }
  }

  /** Eine Phase frisch aufsetzen (Dauer kommt aus den Einstellungen). */
  function resetPhase(phase) {
    var secs = phaseMinutes(phase) * 60;
    timer.phase = phase;
    timer.running = false;
    timer.total = secs;
    timer.remaining = secs;
    timer.elapsed = 0;
    timer.startedAt = null;
  }

  /** Eine noch unangetastete Phase übernimmt geänderte Dauern. */
  function syncIdleDuration() {
    if (timer.running || timer.remaining !== timer.total) return;
    var secs = phaseMinutes(timer.phase) * 60;
    timer.total = secs;
    timer.remaining = secs;
  }

  function startTimer() {
    if (timer.running) return;
    if (timer.remaining <= 0) resetPhase(timer.phase);
    if (!timer.startedAt) timer.startedAt = new Date().toISOString();
    timer.running = true;
    if (!ticker) ticker = global.setInterval(tick, 1000);
    updateDocTitle();
    paint();
  }

  function pauseTimer() {
    if (!timer.running) return;
    timer.running = false;
    stopTicker();
    resetDocTitle();
    paint();
  }

  function toggleTimer() {
    if (timer.running) pauseTimer();
    else startTimer();
  }

  /** Sekundentakt – läuft auch dann weiter, wenn die Ansicht weg ist. */
  function tick() {
    if (!timer.running) { stopTicker(); return; }
    timer.remaining -= 1;
    if (timer.phase === "work") timer.elapsed += 1;

    if (timer.remaining <= 0) {
      timer.remaining = 0;
      completePhase();
      return;
    }
    updateDocTitle();
    paint();
  }

  /** Phase ist abgelaufen: speichern, melden, umschalten. */
  function completePhase() {
    timer.running = false;
    stopTicker();

    if (timer.phase === "work") {
      var minutes = Math.max(1, Math.round(timer.total / 60));
      saveSession(minutes, timer.startedAt);
      NG.ui.toast("Geschafft! " + U.fmtMinutes(minutes) + " gelernt – jetzt hast du eine Pause verdient.", "success");
      resetPhase("break");
      refreshStats();
    } else {
      NG.ui.toast("Pause vorbei. Bereit für die nächste Lernphase?");
      resetPhase("work");
    }

    resetDocTitle();
    paint();
  }

  /** Von Hand beendet: angefangene Zeit trotzdem gutschreiben. */
  function stopTimer() {
    var wasWork = timer.phase === "work";
    var seconds = timer.elapsed;
    var saved = 0;

    if (wasWork && seconds >= MIN_SAVE_SECONDS) {
      saved = Math.max(1, Math.round(seconds / 60));
      saveSession(saved, timer.startedAt);
    }

    stopTicker();
    resetPhase("work");
    resetDocTitle();
    paint();

    if (saved) {
      NG.ui.toast(U.fmtMinutes(saved) + " gespeichert. Jede Minute zählt!", "success");
      refreshStats();
    } else if (wasWork && seconds > 0) {
      NG.ui.toast("Abgebrochen – unter einer Minute zählen wir nicht mit.");
    }
  }

  function saveSession(minutes, startedAt) {
    NG.store.add("sessions", {
      subjectId: timer.subjectId || null,
      startedAt: startedAt || new Date().toISOString(),
      minutes: minutes,
      kind: "focus"
    });
  }

  /* ---------- Timer zeichnen ------------------------------- */

  function startLabel() {
    if (timer.running) return "Pause";
    if (timer.remaining < timer.total) return "Weiter";
    return timer.phase === "break" ? "Pause starten" : "Lernphase starten";
  }

  function hintText() {
    if (timer.running) {
      return timer.phase === "break"
        ? "Die Pause läuft – kurz aufstehen, etwas trinken, Augen ausruhen."
        : "Die Lernphase läuft – leg das Handy weg und bleib dran. Du schaffst das!";
    }
    if (timer.phase === "break") return "Zeit für eine Pause. Starte sie, wenn du so weit bist.";
    if (timer.remaining < timer.total) return "Der Timer ist angehalten. Mit „Weiter“ machst du dort weiter, wo du aufgehört hast.";
    return "Wähle ein Fach, stelle die Dauer ein und starte deine Lernphase.";
  }

  /** Alle veränderlichen Stellen der Timer-Karte auffrischen. */
  function paint() {
    if (!dom || !dom.time) return;

    dom.time.textContent = mmss(timer.remaining);
    dom.time.style.color = timer.phase === "break" ? "var(--success)" : "var(--text)";
    dom.phase.textContent = phaseLabel(timer.phase);

    var pct = timer.total > 0
      ? U.clamp(((timer.total - timer.remaining) / timer.total) * 100, 0, 100)
      : 0;
    dom.bar.style.width = pct.toFixed(1) + "%";
    dom.bar.style.background = timer.phase === "break" ? "var(--success)" : "var(--accent)";
    dom.track.setAttribute("aria-valuenow", String(Math.round(pct)));
    dom.track.setAttribute("aria-label", phaseLabel(timer.phase) + ", " + mmss(timer.remaining) + " übrig");

    setButton(dom.startBtn, timer.running ? "pause" : "play", startLabel());
    dom.startBtn.className = "btn btn--lg" + (timer.running ? "" : " btn--primary");
    dom.stopBtn.disabled = !timer.running && timer.phase === "work" && timer.remaining === timer.total;
    dom.hint.textContent = hintText();
  }

  function subjectField() {
    var id = U.uid("focus-subject");
    var select = el("select", { id: id });

    NG.ui.subjectOptions({ allowNone: true, noneLabel: "— ohne Fach —" }).forEach(function (o) {
      var value = o.value === null || o.value === undefined ? "" : String(o.value);
      var opt = el("option", { value: value, text: o.label });
      if (value === String(timer.subjectId || "")) opt.selected = true;
      select.appendChild(opt);
    });

    // Gelöschtes Fach? Dann steht die Auswahl jetzt auf „ohne Fach“.
    timer.subjectId = select.value;
    select.addEventListener("change", function () { timer.subjectId = select.value; });

    return el("div", { class: "field" }, [
      el("label", { class: "label", for: id, text: "Fach" }),
      select,
      el("div", { class: "field__hint", text: "So siehst du später, wofür du deine Zeit genutzt hast." })
    ]);
  }

  function durationField(kind) {
    var isBreak = kind === "break";
    var id = U.uid("focus-" + kind);
    var input = el("input", {
      type: "number", id: id,
      min: String(MIN_MINUTES), max: String(MAX_MINUTES), step: "1", inputmode: "numeric"
    });
    input.value = String(isBreak ? breakMinutes() : workMinutes());

    input.addEventListener("change", function () {
      var n = clampMinutes(input.value, isBreak ? DEFAULT_BREAK : DEFAULT_WORK);
      input.value = String(n);
      NG.store.setSetting(isBreak ? "focusBreak" : "focusWork", n);
      syncIdleDuration();
      paint();
    });

    return el("div", { class: "field" }, [
      el("label", { class: "label", for: id, text: isBreak ? "Pausendauer (Minuten)" : "Lerndauer (Minuten)" }),
      input,
      el("div", {
        class: "field__hint",
        text: isBreak ? "Klassisch sind 5 Minuten." : "Klassisch sind 25 Minuten am Stück."
      })
    ]);
  }

  function timerCard(ctx) {
    var time = el("div", {
      class: "tnum", text: mmss(timer.remaining),
      style: { fontSize: "3.2rem", fontWeight: "740", letterSpacing: "-.03em", lineHeight: "1.05" }
    });
    var phase = el("div", { class: "fw-6 muted", text: phaseLabel(timer.phase) });

    var bar = el("div", { class: "progress__bar", style: { width: "0%" } });
    var track = el("div", {
      class: "progress", role: "progressbar",
      "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0"
    }, bar);

    var startBtn = el("button", { class: "btn btn--lg btn--primary", type: "button", onClick: toggleTimer });
    var stopBtn = el("button", { class: "btn btn--lg", type: "button", onClick: stopTimer });
    setButton(startBtn, "play", startLabel());
    setButton(stopBtn, "stop", "Stopp");

    var hint = el("p", { class: "fs-sm muted center", "aria-live": "polite", text: hintText() });

    dom.time = time;
    dom.phase = phase;
    dom.bar = bar;
    dom.track = track;
    dom.startBtn = startBtn;
    dom.stopBtn = stopBtn;
    dom.hint = hint;

    var noSubjects = !NG.store.activeSubjects().length;

    return el("div", { class: "card" }, el("div", { class: "card__body stack" }, [
      el("div", { class: "center stack stack--sm" }, [time, phase]),
      track,
      el("div", { class: "row", style: { justifyContent: "center" } }, [startBtn, stopBtn]),
      hint,
      el("div", { class: "form-grid" }, [subjectField(), durationField("work"), durationField("break")]),
      noSubjects ? el("div", { class: "row row--tight" }, [
        el("span", { class: "fs-sm muted", text: "Du hast noch keine Fächer angelegt." }),
        el("button", {
          class: "btn btn--sm btn--ghost", type: "button",
          onClick: function () { if (ctx && ctx.go) ctx.go("subjects"); }
        }, [U.iconEl("book"), el("span", { text: "Fächer anlegen" })])
      ]) : null
    ]));
  }

  /* ---------- Statistik ------------------------------------ */

  function statTiles(sessions, byDay, days) {
    var today = U.todayISO();
    var weekStart = U.startOfWeek(today);
    var weekEnd = U.addDays(weekStart, 6);

    var todayMin = byDay[today] || 0;
    var weekMin = 0;
    Object.keys(byDay).forEach(function (day) {
      if (day >= weekStart && day <= weekEnd) weekMin += byDay[day];
    });
    var totalMin = sumMinutes(sessions);

    var todayCount = sessions.filter(function (s) { return dayOf(s) === today; }).length;
    var best = longestStreak(days);
    var now = currentStreak(days);

    return el("div", { class: "grid grid--4" }, [
      NG.ui.stat("Heute", U.fmtMinutes(todayMin),
        todayCount
          ? todayCount + " " + plural(todayCount, "Einheit", "Einheiten")
          : "Noch nichts – leg los!",
        todayMin > 0 ? "var(--accent)" : null),
      NG.ui.stat("Diese Woche", U.fmtMinutes(weekMin), "Kalenderwoche " + U.isoWeek(today)),
      NG.ui.stat("Insgesamt", U.fmtMinutes(totalMin),
        sessions.length + " " + plural(sessions.length, "Einheit", "Einheiten")),
      NG.ui.stat("Längste Serie", best + " " + plural(best, "Tag", "Tage"),
        now ? "aktuell " + now + " " + plural(now, "Tag", "Tage") + " am Stück" : "Starte heute eine neue Serie")
    ]);
  }

  function weekChartCard(byDay) {
    var today = U.todayISO();
    var start = U.startOfWeek(today);
    var days = [];
    var i;
    for (i = 0; i < 7; i++) days.push(U.addDays(start, i));

    var values = days.map(function (d) { return byDay[d] || 0; });
    var max = values.reduce(function (a, b) { return Math.max(a, b); }, 0);
    var total = values.reduce(function (a, b) { return a + b; }, 0);

    var columns = days.map(function (day, idx) {
      var value = values[idx];
      var isToday = day === today;
      var date = U.toDate(day);
      var height = max > 0 ? Math.round((value / max) * BAR_MAX_PX) : 0;

      var style = {
        height: Math.max(3, height) + "px",
        background: isToday ? "var(--accent)" : "var(--border-strong)"
      };

      return el("div", {
        class: "bar-chart__col",
        title: U.fmtDate(day, { style: "medium" }) + ": " + U.fmtMinutes(value)
      }, [
        el("div", {
          class: "bar-chart__lbl tnum",
          text: value > 0 ? String(Math.round(value)) : ""
        }),
        el("div", { class: "bar-chart__bar", style: style }),
        el("div", {
          class: "bar-chart__lbl",
          style: isToday ? { color: "var(--accent-text)", fontWeight: "700" } : null,
          text: date ? U.WEEKDAYS_SHORT[date.getDay()] : ""
        })
      ]);
    });

    return NG.ui.card({
      title: "Diese Woche",
      body: el("div", { class: "stack stack--sm" }, [
        el("div", { class: "bar-chart" }, columns),
        el("div", {
          class: "fs-xs faint center",
          text: total > 0
            ? "Zahlen über den Säulen sind Minuten."
            : "Diese Woche ist noch nichts dabei – eine Lernphase genügt für den ersten Balken."
        })
      ])
    });
  }

  function subjectCard(sessions) {
    var today = U.todayISO();
    var weekStart = U.startOfWeek(today);
    var weekEnd = U.addDays(weekStart, 6);

    var totals = {};
    sessions.forEach(function (s) {
      var day = dayOf(s);
      if (!day || day < weekStart || day > weekEnd) return;
      var key = s.subjectId || "";
      totals[key] = (totals[key] || 0) + minutesOf(s);
    });

    var rows = Object.keys(totals).map(function (key) {
      return { subjectId: key || null, minutes: totals[key] };
    }).filter(function (r) { return r.minutes > 0; });

    rows = U.sortBy(rows, function (r) { return r.minutes; }, "desc");

    var body;
    if (!rows.length) {
      body = el("p", {
        class: "fs-sm muted",
        text: "Diese Woche hast du noch keine Lernzeit aufgezeichnet. Schon eine Einheit von 25 Minuten taucht hier auf."
      });
    } else {
      var max = rows[0].minutes || 1;
      body = el("div", { class: "stack" }, rows.map(function (r) {
        var color = r.subjectId ? NG.store.subjectColor(r.subjectId) : "var(--text-faint)";
        return el("div", { class: "stack stack--sm" }, [
          el("div", { class: "row row--tight" }, [
            NG.ui.subjectTag(r.subjectId),
            el("span", { class: "spacer fs-sm muted tnum", text: U.fmtMinutes(r.minutes) })
          ]),
          progressBar((r.minutes / max) * 100, color)
        ]);
      }));
    }

    return NG.ui.card({ title: "Zeit je Fach (diese Woche)", body: body });
  }

  function recentCard(sessions) {
    var recent = U.sortBy(sessions, function (s) { return String(s.startedAt || ""); }, "desc")
      .slice(0, RECENT_LIMIT);

    var list = el("div", { class: "list" }, recent.map(function (s) {
      var day = dayOf(s);
      var clock = clockOf(s);
      var meta = [el("span", { text: day ? U.fmtDate(day, { style: "medium" }) : "ohne Datum" })];
      if (clock) meta.push(el("span", { text: clock + " Uhr" }));
      meta.push(el("span", { class: "tnum fw-6", text: U.fmtMinutes(minutesOf(s)) }));

      return el("div", { class: "list__item" }, [
        el("span", {
          class: "subject-dot",
          style: { background: s.subjectId ? NG.store.subjectColor(s.subjectId) : "var(--text-faint)" }
        }),
        el("div", { class: "list__main" }, [
          el("div", { class: "list__title", text: NG.store.subjectName(s.subjectId) }),
          el("div", { class: "list__meta" }, meta)
        ]),
        el("div", { class: "list__actions" }, iconButton("trash", "Sitzung löschen", function () {
          removeSession(s);
        }))
      ]);
    }));

    return NG.ui.card({
      title: "Letzte Sitzungen",
      body: list,
      flush: true,
      foot: sessions.length > recent.length
        ? "Es werden die letzten " + RECENT_LIMIT + " von " + sessions.length + " Einheiten gezeigt."
        : null
    });
  }

  function removeSession(session) {
    NG.ui.confirm({
      title: "Sitzung löschen?",
      message: "Diese Lerneinheit (" + U.fmtMinutes(minutesOf(session)) + ") verschwindet aus deiner Statistik.",
      confirmText: "Löschen",
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      NG.store.remove("sessions", session.id);
      NG.ui.toast("Sitzung gelöscht");
      refreshStats();
    });
  }

  /** Baut den Statistik-Teil neu – nach jeder Änderung an den Sitzungen. */
  function statsContent() {
    var sessions = allSessions();

    if (!sessions.length) {
      return el("div", { class: "card" }, el("div", { class: "card__body" }, NG.ui.empty({
        icon: "timer",
        title: "Noch keine Lernzeit aufgezeichnet",
        text: "Starte oben deine erste Lernphase. Danach siehst du hier, wie viel du geschafft hast: "
          + "Tages- und Wochenzeiten, ein Wochendiagramm, die Zeit je Fach und deine längste Serie.",
        action: {
          label: "Lernphase starten",
          onClick: function () { startTimer(); }
        }
      })));
    }

    var byDay = minutesByDay(sessions);
    var days = Object.keys(byDay).filter(function (d) { return d && byDay[d] > 0; });

    return el("div", { class: "stack" }, [
      statTiles(sessions, byDay, days),
      el("div", { class: "grid grid--2" }, [
        weekChartCard(byDay),
        subjectCard(sessions)
      ]),
      recentCard(sessions)
    ]);
  }

  function refreshStats() {
    if (!dom || !dom.stats) return;
    U.clear(dom.stats);
    dom.stats.appendChild(statsContent());
  }

  /* ---------- Ansicht -------------------------------------- */

  function render(root, ctx) {
    dom = {};
    syncIdleDuration();

    var stats = el("div", { class: "stack" });
    dom.stats = stats;

    U.append(root, el("div", { class: "stack" }, [
      timerCard(ctx),
      el("div", { class: "section-title", text: "Deine Lernstatistik" }),
      stats
    ]));

    refreshStats();
    paint();
  }

  /* ---------- Registrierung -------------------------------- */

  NG.app.register({
    id: "focus",
    title: "Lernzeit",
    subtitle: "Konzentriert lernen mit Timer und Pausen",
    icon: "timer",
    group: "learn",
    order: 10,
    live: false,                 // Timer läuft im Modul weiter, kein Neuaufbau
    render: render,

    onLeave: function () {
      // Wichtig: nur das Zeichnen endet hier. Der Timer selbst läuft weiter.
      dom = null;
    }
  });
})(window);
