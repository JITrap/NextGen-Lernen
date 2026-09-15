/* =========================================================
   NextGen Lernen – Übersicht
   Die Startseite: was steht an, wie steht es um die Noten?
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  function greeting() {
    var h = new Date().getHours();
    var name = NG.store.getSetting("name", "");
    var base = h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
    return base + (name ? ", " + name : "") + "!";
  }

  /* ---------- Kennzahlen ---------------------------------- */

  function upcomingExams(limit) {
    var today = U.todayISO();
    return NG.store.all("events")
      .filter(function (e) { return !e.done && e.date >= today && (e.type === "exam" || e.type === "test" || e.type === "oral"); })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .slice(0, limit || 5);
  }

  function upcomingEvents(limit) {
    var today = U.todayISO();
    return NG.store.all("events")
      .filter(function (e) { return !e.done && e.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .slice(0, limit || 6);
  }

  function openTasks() {
    return NG.store.all("tasks").filter(function (t) { return !t.done; });
  }

  function dueTasks() {
    var today = U.todayISO();
    return openTasks().filter(function (t) { return t.due && t.due <= today; });
  }

  function dueCards() {
    var today = U.todayISO();
    return NG.store.all("cards").filter(function (c) { return (c.due || today) <= today; });
  }

  function weekMinutes() {
    var from = U.startOfWeek(U.todayISO());
    return NG.store.all("sessions")
      .filter(function (s) { return s.kind !== "break" && (s.startedAt || "").slice(0, 10) >= from; })
      .reduce(function (sum, s) { return sum + (U.num(s.minutes, 0) || 0); }, 0);
  }

  /* ---------- Bausteine ------------------------------------ */

  function statTiles() {
    var overall = NG.grades.overallAverage();
    var exams = upcomingExams(1);
    var open = openTasks().length;
    var due = dueTasks().length;
    var mins = weekMinutes();

    var avgTile = el("div", { class: "stat" }, [
      el("div", { class: "stat__label", text: "Gesamtschnitt" }),
      overall.value === null
        ? el("div", { class: "stat__value faint", text: "—" })
        : el("div", { class: "row row--tight", style: { marginTop: "2px" } }, [
          NG.ui.gradePill(overall.value, "lg"),
          el("span", { class: "fs-sm muted", text: NG.grades.verdict(overall.value) })
        ]),
      el("div", {
        class: "stat__note",
        text: overall.count ? "aus " + overall.count + " Fächern" : "Noch keine Noten eingetragen"
      })
    ]);

    var nextExam = exams[0];
    var examTile = el("div", { class: "stat" }, [
      el("div", { class: "stat__label", text: "Nächste Arbeit" }),
      el("div", {
        class: "stat__value",
        text: nextExam ? (U.daysUntil(nextExam.date) === 0 ? "heute" : U.daysUntil(nextExam.date) + " Tage") : "—",
        style: nextExam && U.daysUntil(nextExam.date) <= 3 ? { color: "var(--danger)" } : null
      }),
      el("div", {
        class: "stat__note",
        text: nextExam
          ? (nextExam.subjectId ? NG.store.subjectName(nextExam.subjectId) + " · " : "") + U.truncate(nextExam.title, 28)
          : "Kein Termin eingetragen"
      })
    ]);

    var taskTile = el("div", { class: "stat" }, [
      el("div", { class: "stat__label", text: "Offene Aufgaben" }),
      el("div", { class: "stat__value", text: String(open), style: due ? { color: "var(--warn)" } : null }),
      el("div", { class: "stat__note", text: due ? due + " davon fällig" : "nichts überfällig" })
    ]);

    var timeTile = el("div", { class: "stat" }, [
      el("div", { class: "stat__label", text: "Lernzeit (Woche)" }),
      el("div", { class: "stat__value", text: mins ? U.fmtMinutes(mins) : "0 min" }),
      el("div", { class: "stat__note", text: "KW " + U.isoWeek(U.todayISO()) })
    ]);

    return el("div", { class: "grid grid--4" }, [avgTile, examTile, taskTile, timeTile]);
  }

  function examCard(ctx) {
    var list = upcomingExams(5);
    var body;

    if (!list.length) {
      body = el("div", { class: "empty", style: { padding: "var(--sp-6) var(--sp-4)" } }, [
        el("div", { class: "empty__icon", html: U.icon("calendar") }),
        el("p", { text: "Keine Klassenarbeiten eingetragen. Trage deine Termine ein, dann siehst du hier den Countdown." }),
        el("button", {
          class: "btn btn--primary", type: "button",
          html: U.icon("plus") + "<span>Termin anlegen</span>",
          onClick: function () { ctx.go("calendar"); }
        })
      ]);
    } else {
      body = el("div", { class: "list" }, list.map(function (e) {
        var days = U.daysUntil(e.date);
        var color = NG.store.subjectColor(e.subjectId);
        return el("button", {
          class: "list__item list__item--btn", type: "button",
          onClick: function () { ctx.go("calendar"); }
        }, [
          el("span", { class: "subject-dot", style: { background: color, width: "12px", height: "26px", borderRadius: "4px" } }),
          el("div", { class: "list__main" }, [
            el("div", { class: "list__title", text: e.title }),
            el("div", { class: "list__meta" }, [
              el("span", { text: e.subjectId ? NG.store.subjectName(e.subjectId) : "Ohne Fach" }),
              el("span", { text: "·" }),
              el("span", { text: U.fmtDate(e.date) }),
              e.time ? el("span", { text: "· " + U.fmtTime(e.time) }) : null
            ])
          ]),
          el("span", {
            class: "countdown" + (days <= 2 ? " countdown--soon" : days <= 7 ? " countdown--near" : ""),
            text: U.relDays(e.date)
          })
        ]);
      }));
    }

    return NG.ui.card({
      title: "Nächste Klassenarbeiten",
      actions: [el("button", {
        class: "btn btn--sm btn--ghost", type: "button", text: "Alle Termine",
        onClick: function () { ctx.go("calendar"); }
      })],
      body: body,
      flush: !!list.length
    });
  }

  function todayCard(ctx) {
    var today = new Date();
    var weekday = (today.getDay() + 6) % 7;   // 0 = Montag
    var isWeekend = weekday > 4;
    var lessons = isWeekend ? [] : U.sortBy(
      NG.store.all("timetable").filter(function (t) { return t.day === weekday && t.subjectId; }),
      function (t) { return U.num(t.slot, 0); });

    var due = U.sortBy(dueTasks(), function (t) { return t.due || ""; }).slice(0, 6);
    var todaysEvents = NG.store.all("events").filter(function (e) { return e.date === U.todayISO() && !e.done; });

    var rows = [];

    if (todaysEvents.length) {
      rows.push(el("div", { class: "section-title", style: { marginTop: 0 }, text: "Heute anstehend" }));
      todaysEvents.forEach(function (e) {
        rows.push(el("div", { class: "row row--tight" }, [
          el("span", { class: "subject-dot", style: { background: NG.store.subjectColor(e.subjectId) } }),
          el("span", { class: "fw-6", text: e.title }),
          e.time ? el("span", { class: "fs-xs faint", text: U.fmtTime(e.time) }) : null
        ]));
      });
    }

    if (lessons.length) {
      rows.push(el("div", { class: "section-title", text: "Stundenplan" }));
      rows.push(el("div", { class: "scroll-x" }, lessons.map(function (t) {
        var sub = NG.store.subject(t.subjectId);
        return el("div", {
          class: "chip",
          style: { background: "var(--surface-3)", borderLeft: "3px solid " + (sub ? sub.color : "var(--border)"), cursor: "default" }
        }, [
          el("span", { class: "fw-6", text: (t.slot || "?") + ". " }),
          el("span", { text: sub ? (sub.short || sub.name) : "?" }),
          t.room ? el("span", { class: "faint", text: t.room }) : null
        ]);
      })));
    }

    if (due.length) {
      rows.push(el("div", { class: "section-title", text: "Fällige Aufgaben" }));
      due.forEach(function (t) {
        rows.push(el("label", { class: "check" }, [
          el("input", {
            type: "checkbox",
            onChange: function () {
              NG.store.update("tasks", t.id, { done: true, doneAt: new Date().toISOString() });
              NG.ui.toast("Erledigt: " + U.truncate(t.title, 30), "success");
            }
          }),
          el("span", { text: t.title }),
          t.subjectId ? el("span", { class: "fs-xs faint", text: "· " + NG.store.subjectName(t.subjectId) }) : null
        ]));
      });
    }

    if (!rows.length) {
      rows.push(el("p", {
        class: "muted",
        text: isWeekend
          ? "Wochenende – nichts zu tun. Genieß die freie Zeit!"
          : "Für heute steht nichts an. Gute Gelegenheit, schon mal vorzuarbeiten."
      }));
      rows.push(el("button", {
        class: "btn btn--sm", type: "button", text: "Aufgabe anlegen",
        onClick: function () { ctx.go("tasks"); }
      }));
    }

    return NG.ui.card({
      title: U.fmtDate(U.todayISO(), { style: "long" }),
      body: el("div", { class: "stack stack--sm" }, rows)
    });
  }

  function subjectsCard(ctx) {
    var subs = NG.store.activeSubjects();
    if (!subs.length) {
      return NG.ui.card({
        title: "Deine Fächer",
        body: NG.ui.empty({
          icon: "book",
          title: "Noch keine Fächer",
          text: "Lege deine Fächer an und stelle ein, wie stark schriftliche und mündliche Noten zählen.",
          action: { label: "Fächer anlegen", onClick: function () { ctx.go("subjects"); } }
        })
      });
    }

    var rows = subs.map(function (sub) {
      var avg = NG.grades.subjectAverage(sub.id);
      return el("button", {
        class: "list__item list__item--btn", type: "button",
        onClick: function () { ctx.go("grades"); }
      }, [
        el("span", { class: "subject-dot", style: { background: sub.color, width: "12px", height: "12px" } }),
        el("div", { class: "list__main" }, [
          el("div", { class: "list__title", text: sub.name }),
          el("div", {
            class: "list__meta",
            text: avg.counts.total
              ? avg.counts.written + " schriftlich · " + avg.counts.oral + " mündlich"
              : "noch keine Note"
          })
        ]),
        avg.total === null ? el("span", { class: "faint fs-sm", text: "—" }) : NG.ui.gradePill(avg.total)
      ]);
    });

    return NG.ui.card({
      title: "Deine Fächer",
      actions: [el("button", {
        class: "btn btn--sm btn--ghost", type: "button", text: "Verwalten",
        onClick: function () { ctx.go("subjects"); }
      })],
      body: el("div", { class: "list" }, rows),
      flush: true
    });
  }

  function aiCard(ctx) {
    var st = NG.ai.status();
    return el("div", {
      class: "card",
      style: {
        borderColor: "color-mix(in srgb, var(--accent) 35%, var(--border))",
        background: "linear-gradient(135deg, var(--accent-soft), var(--surface) 65%)"
      }
    }, el("div", { class: "card__body stack stack--sm" }, [
      el("div", { class: "row row--tight" }, [
        el("span", { class: "icon-badge", html: U.icon("sparkles") }),
        el("h3", { text: "Aufgaben von der KI bearbeiten lassen" })
      ]),
      el("p", {
        class: "muted fs-sm",
        text: "Lade einen Screenshot oder ein Foto deiner Aufgaben hoch. Die KI liest sie, löst sie und " +
          "erklärt dir den Weg Schritt für Schritt."
      }),
      el("div", { class: "row row--tight" }, [
        el("button", {
          class: "btn btn--primary", type: "button",
          html: U.icon("upload") + "<span>Aufgaben hochladen</span>",
          onClick: function () { ctx.go("assistant"); }
        }),
        el("button", {
          class: "btn", type: "button", text: "Karteikarten erstellen",
          onClick: function () { ctx.go("assistant"); }
        }),
        el("span", { class: "badge " + (st.ready ? "badge--success" : "badge--warn"), text: st.label })
      ])
    ]));
  }

  function cardsCard(ctx) {
    var due = dueCards();
    if (!NG.store.all("cards").length) return null;
    return NG.ui.card({
      title: "Karteikarten",
      body: el("div", { class: "stack stack--sm" }, [
        el("div", { class: "row" }, [
          el("div", { class: "stat__value", text: String(due.length), style: { fontSize: "2rem" } }),
          el("div", { class: "muted fs-sm", text: due.length === 1 ? "Karte ist heute dran" : "Karten sind heute dran" })
        ]),
        el("button", {
          class: "btn btn--primary btn--block", type: "button",
          html: U.icon("layers") + "<span>" + (due.length ? "Jetzt lernen" : "Stapel ansehen") + "</span>",
          onClick: function () { ctx.go("flashcards"); }
        })
      ])
    });
  }

  function agendaCard(ctx) {
    var list = upcomingEvents(6).filter(function (e) {
      return !(e.type === "exam" || e.type === "test" || e.type === "oral");
    }).slice(0, 5);
    if (!list.length) return null;

    return NG.ui.card({
      title: "Weitere Termine",
      body: el("div", { class: "list" }, list.map(function (e) {
        return el("button", {
          class: "list__item list__item--btn", type: "button",
          onClick: function () { ctx.go("calendar"); }
        }, [
          el("div", { class: "list__main" }, [
            el("div", { class: "list__title", text: e.title }),
            el("div", {
              class: "list__meta",
              text: (NG.ai.EVENT_LABEL[e.type] || "Termin") +
                (e.subjectId ? " · " + NG.store.subjectName(e.subjectId) : "")
            })
          ]),
          NG.ui.countdownBadge(e.date)
        ]);
      })),
      flush: true
    });
  }

  function welcomeCard(ctx) {
    return el("div", { class: "card" }, el("div", { class: "card__body stack" }, [
      el("h2", { text: "Willkommen bei NextGen Lernen" }),
      el("p", {
        class: "muted",
        text: "In drei Schritten bist du startklar. Alles wird direkt auf diesem Gerät gespeichert."
      }),
      el("div", { class: "grid grid--3" }, [
        ["1. Fächer anlegen", "Mit eigener Gewichtung von schriftlich und mündlich.", "subjects", "book"],
        ["2. Termine eintragen", "Klassenarbeiten, Tests und alles Weitere.", "calendar", "calendar"],
        ["3. Aufgaben hochladen", "Die KI löst und erklärt sie dir.", "assistant", "sparkles"]
      ].map(function (s) {
        return el("button", {
          class: "card", type: "button",
          style: { textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" },
          onClick: function () { ctx.go(s[2]); }
        }, el("div", { class: "card__body stack stack--sm" }, [
          el("span", { class: "icon-badge", html: U.icon(s[3]) }),
          el("div", { class: "fw-6", text: s[0] }),
          el("div", { class: "fs-sm muted", text: s[1] })
        ]));
      })),
      el("div", { class: "row row--tight" }, [
        el("button", {
          class: "btn btn--primary", type: "button", text: "Einrichtung starten",
          onClick: function () { if (NG.onboarding) NG.onboarding.start(); else ctx.go("subjects"); }
        })
      ])
    ]));
  }

  /* ---------- Ansicht -------------------------------------- */

  function render(root, ctx) {
    var isEmpty = !NG.store.all("subjects").length && !NG.store.all("events").length &&
      !NG.store.all("tasks").length && !NG.store.all("grades").length;

    if (isEmpty) {
      U.append(root, el("div", { class: "stack" }, [welcomeCard(ctx), aiCard(ctx)]));
      return;
    }

    U.append(root, el("div", { class: "stack" }, [
      statTiles(),
      el("div", { class: "grid grid--2" }, [
        el("div", { class: "stack" }, [examCard(ctx), agendaCard(ctx)]),
        el("div", { class: "stack" }, [todayCard(ctx), cardsCard(ctx)])
      ]),
      aiCard(ctx),
      subjectsCard(ctx)
    ]));
  }

  NG.app.register({
    id: "dashboard",
    title: "Übersicht",
    icon: "home",
    group: "plan",
    order: 1,
    tab: true,
    subtitle: greeting,
    render: render
  });
})(window);
