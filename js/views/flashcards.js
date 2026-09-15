/* =========================================================
   NextGen Lernen – Karteikarten
   Stapel anlegen, Karten pflegen und mit dem Leitner-System
   lernen: Jede Karte wandert durch die Fächer 1 bis 5.
   Je weiter oben sie steht, desto später kommt sie wieder.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- Flüchtiger Zustand der Ansicht ---------------
     Lebt nur im Arbeitsspeicher und wird bewusst nicht gespeichert. */

  var mode = "overview";      // "overview" = Stapelübersicht, "study" = Lernmodus
  var session = null;         // laufende Lernsitzung, siehe startStudy()
  var ctxRef = null;          // Kontext der letzten Darstellung (für Neu-Aufbau)
  var keyHandler = null;      // Tastatur-Lauscher des Lernmodus
  var cardNode = null;        // Verweis auf die Karteikarte (zum Drehen ohne Neu-Aufbau)
  var controlsHost = null;    // Knopfleiste unter der Karte

  /** Tage bis zur nächsten Wiederholung – Fach 1 bis Fach 5. */
  var INTERVALS = [1, 2, 4, 8, 16];
  var MAX_BOX = 5;
  var AI_MAX_CARDS = 20;

  /* ---------- Kleine Helfer -------------------------------- */

  function plural(n, one, many) { return n === 1 ? one : many; }

  function rerender() { if (ctxRef && ctxRef.rerender) ctxRef.rerender(); }

  function textButton(icon, label, cls, onClick) {
    return el("button", { class: cls || "btn", type: "button", onClick: onClick }, [
      U.iconEl(icon),
      el("span", { text: label })
    ]);
  }

  function iconButton(icon, label, onClick) {
    return el("button", {
      class: "btn btn--icon btn--sm", type: "button",
      "aria-label": label, title: label, onClick: onClick
    }, U.iconEl(icon));
  }

  function progressBar(percent) {
    var p = U.clamp(Math.round(percent || 0), 0, 100);
    return el("div", {
      class: "progress", role: "progressbar",
      "aria-valuenow": String(p), "aria-valuemin": "0", "aria-valuemax": "100"
    }, el("div", { class: "progress__bar", style: { width: p + "%" } }));
  }

  function allDecks() {
    var list = NG.store.all("decks");
    return Array.isArray(list) ? list : [];
  }

  function sortedDecks() {
    return U.sortBy(allDecks(), function (d) { return deckName(d).toLowerCase(); }, "asc");
  }

  function deckName(deck) {
    var n = String(deck && deck.name ? deck.name : "").trim();
    return n || "Ohne Namen";
  }

  /** Alle Karten, deren Stapel es wirklich noch gibt. */
  function livingCards() {
    var known = {};
    allDecks().forEach(function (d) { known[d.id] = true; });
    var list = NG.store.all("cards");
    if (!Array.isArray(list)) return [];
    return list.filter(function (c) { return c && known[c.deckId]; });
  }

  function cardsOf(deckId) {
    var list = NG.store.all("cards");
    if (!Array.isArray(list)) return [];
    return list.filter(function (c) { return c && c.deckId === deckId; });
  }

  function boxOf(card) {
    return U.clamp(Math.round(U.num(card && card.box, 1)), 1, MAX_BOX);
  }

  function dueOf(card) {
    var raw = card && card.due ? String(card.due) : "";
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : U.todayISO();
  }

  function isDue(card, today) {
    return dueOf(card) <= (today || U.todayISO());
  }

  function dueCards(list, today) {
    var t = today || U.todayISO();
    return list.filter(function (c) { return isDue(c, t); });
  }

  /** Karten in Fach 4 oder 5 gelten als „sitzt“. */
  function mastered(list) {
    return list.filter(function (c) { return boxOf(c) >= 4; });
  }

  function masteredPercent(list) {
    if (!list.length) return 0;
    return (mastered(list).length / list.length) * 100;
  }

  function sideText(value, fallback) {
    var t = String(value === null || value === undefined ? "" : value).trim();
    return t || (fallback || "");
  }

  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function newCardRecord(deckId, front, back) {
    return {
      deckId: deckId,
      front: front,
      back: back,
      box: 1,
      due: U.todayISO(),
      lapses: 0,
      reps: 0
    };
  }

  /* =========================================================
     Stapel anlegen und bearbeiten
     ========================================================= */

  function openDeckDialog(deck) {
    var isNew = !deck;
    NG.ui.formModal({
      title: isNew ? "Neuer Stapel" : "Stapel bearbeiten",
      intro: isNew
        ? "Gib dem Stapel einen Namen – die Karten legst du gleich danach an."
        : null,
      submitText: isNew ? "Anlegen" : "Speichern",
      fields: [
        {
          name: "name", label: "Name des Stapels", required: true, full: true,
          placeholder: "z. B. Vokabeln Unit 4",
          validate: function (v) {
            return String(v || "").trim() ? "" : "Bitte gib dem Stapel einen Namen.";
          }
        },
        {
          name: "subjectId", label: "Fach", type: "select", nullable: true,
          options: NG.ui.subjectOptions({ allowNone: true, noneLabel: "— ohne Fach —" }),
          hint: "Freiwillig – hilft beim Sortieren."
        }
      ],
      values: {
        name: isNew ? "" : deckName(deck),
        subjectId: (deck && deck.subjectId) || ""
      },
      onDelete: isNew ? null : function () {
        // Ein Stapel ohne seine Karten ergibt keinen Sinn – beides fliegt zusammen raus.
        var id = deck.id;
        NG.store.removeWhere("cards", function (c) { return c.deckId === id; });
        NG.store.remove("decks", id);
        if (session && session.deckId === id) endStudy();
        NG.ui.toast("Stapel gelöscht", "success");
        rerender();
      },
      deleteMessage: "Der Stapel und alle seine Karten werden dauerhaft gelöscht."
    }).then(function (values) {
      if (!values) return;
      var data = {
        name: String(values.name || "").trim(),
        subjectId: values.subjectId || null
      };
      if (isNew) {
        var created = NG.store.add("decks", data);
        NG.ui.toast("Stapel „" + U.truncate(data.name, 40) + "“ angelegt", "success");
        rerender();
        openCardManager(created);
      } else {
        NG.store.update("decks", deck.id, data);
        NG.ui.toast("Gespeichert", "success");
        rerender();
      }
    });
  }

  /* =========================================================
     Kartenverwaltung (Dialog)
     ========================================================= */

  function openCardManager(deck) {
    if (!deck) return;

    var closed = false;
    var editingId = null;
    var ai = { open: false, busy: false, ctrl: null, preview: null, area: null, areaId: null };

    var quickBox = quickAddBox();
    var aiBox = el("div");
    var listBox = el("div");

    var body = el("div", { class: "stack" }, [quickBox, aiBox, listBox]);

    var dialog = NG.ui.modal({
      title: "Karten – " + deckName(deck),
      body: body,
      wide: true,
      actions: [{ label: "Fertig", variant: "primary", onClick: function () { dialog.close(); } }],
      onClose: function () {
        closed = true;
        if (ai.ctrl) { try { ai.ctrl.abort(); } catch (e) { /* war schon vorbei */ } }
        rerender();
      }
    });

    paintAi();
    paintList();

    /* ---- Schnelleingabe ---- */

    function quickAddBox() {
      var frontId = U.uid("fcq");
      var backId = U.uid("fcq");
      var front = el("input", {
        type: "text", id: frontId, placeholder: "Vorderseite – die Frage", "aria-label": "Vorderseite"
      });
      var back = el("input", {
        type: "text", id: backId, placeholder: "Rückseite – die Antwort", "aria-label": "Rückseite"
      });

      front.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        back.focus();
      });
      back.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        addQuick();
      });

      var btn = textButton("plus", "Karte anlegen", "btn btn--primary", function () { addQuick(); });

      function addQuick() {
        var f = String(front.value || "").trim();
        var b = String(back.value || "").trim();
        if (!f || !b) {
          NG.ui.toast("Bitte fülle Vorder- und Rückseite aus.", "warn");
          (f ? back : front).focus();
          return;
        }
        NG.store.add("cards", newCardRecord(deck.id, f, b));
        front.value = "";
        back.value = "";
        editingId = null;
        paintList();
        front.focus();
      }

      return NG.ui.card({
        title: "Neue Karte",
        body: el("div", { class: "stack stack--sm" }, [
          el("div", { class: "form-grid" }, [
            el("div", { class: "field" }, [el("label", { for: frontId, text: "Vorderseite" }), front]),
            el("div", { class: "field" }, [el("label", { for: backId, text: "Rückseite" }), back])
          ]),
          el("div", { class: "row row--tight" }, [
            btn,
            el("span", { class: "fs-xs faint", text: "Tipp: Mit der Eingabetaste springst du weiter und legst die Karte an." })
          ])
        ])
      });
    }

    /* ---- Karten aus Text erzeugen (KI) ---- */

    function paintAi() {
      U.clear(aiBox);
      if (!NG.ai.status().ready) return;   // ohne eingerichtete KI gar nicht erst anbieten

      if (!ai.open) {
        aiBox.appendChild(el("div", { class: "row row--tight" }, [
          textButton("sparkles", "Karten aus Text erzeugen", "btn btn--sm", function () {
            ai.open = true;
            paintAi();
            if (ai.area) ai.area.focus();
          })
        ]));
        return;
      }

      if (!ai.area) {
        ai.areaId = U.uid("fcai");
        ai.area = el("textarea", {
          rows: 6, id: ai.areaId,
          placeholder: "Füge hier deinen Text ein: Hefteintrag, Zusammenfassung, Vokabelliste …",
          "aria-label": "Text für die Karteikarten"
        });
      }

      var inner = el("div", { class: "stack stack--sm" });

      if (ai.busy) {
        inner.appendChild(el("div", { class: "row row--tight" }, [
          el("span", { class: "spinner" }),
          el("span", { class: "muted fs-sm", text: "Denkt nach – das dauert einen Moment …" }),
          el("button", {
            class: "btn btn--sm spacer", type: "button", text: "Abbrechen",
            onClick: function () { if (ai.ctrl) { try { ai.ctrl.abort(); } catch (e) { /* egal */ } } }
          })
        ]));
      } else if (ai.preview) {
        inner.appendChild(el("div", {
          class: "fs-sm muted",
          text: "Vorschlag: " + ai.preview.length + " " + plural(ai.preview.length, "Karte", "Karten") +
            ". Schau kurz drüber – erst dann landen sie im Stapel."
        }));
        inner.appendChild(el("div", { class: "list" }, ai.preview.map(function (c, i) {
          return el("div", { class: "list__item", style: { paddingLeft: "0", paddingRight: "0" } }, [
            el("span", { class: "badge", text: String(i + 1) }),
            el("div", { class: "list__main" }, [
              el("div", { class: "list__title", text: c.front }),
              el("div", { class: "list__meta" }, el("span", { text: c.back }))
            ])
          ]);
        })));
        inner.appendChild(el("div", { class: "row row--tight" }, [
          textButton("check", "Alle übernehmen", "btn btn--primary", function () { acceptPreview(); }),
          textButton("x", "Verwerfen", "btn btn--sm", function () {
            ai.preview = null;
            paintAi();
          })
        ]));
      } else {
        inner.appendChild(el("div", { class: "field" }, [
          el("label", { for: ai.areaId, text: "Dein Text" }),
          ai.area,
          el("div", {
            class: "field__hint",
            text: "Daraus werden höchstens " + AI_MAX_CARDS + " Karten – Frage vorn, Antwort hinten."
          })
        ]));
        inner.appendChild(el("div", { class: "row row--tight" }, [
          textButton("sparkles", "Karten vorschlagen", "btn btn--primary", function () { runAi(); }),
          el("button", {
            class: "btn btn--sm", type: "button", text: "Schließen",
            onClick: function () { ai.open = false; paintAi(); }
          })
        ]));
      }

      aiBox.appendChild(NG.ui.card({ title: "Karten aus Text erzeugen", body: inner }));
    }

    function runAi() {
      var text = String(ai.area && ai.area.value ? ai.area.value : "").trim();
      if (text.length < 20) {
        NG.ui.toast("Füge bitte etwas mehr Text ein – ein paar Sätze reichen schon.", "warn");
        if (ai.area) ai.area.focus();
        return;
      }

      ai.busy = true;
      ai.preview = null;
      ai.ctrl = global.AbortController ? new global.AbortController() : null;
      paintAi();

      var prompt = aiPrompt(text);

      NG.ai.run({
        system: NG.ai.systemPrompt(
          "Du erstellst Karteikarten für eine Schülerin/einen Schüler. " +
          "Antworte in dieser Aufgabe ausschliesslich mit gültigem JSON und ohne Erklärtext."),
        prompt: prompt,
        json: true,
        tier: "quick",
        maxTokens: 3000,
        signal: ai.ctrl ? ai.ctrl.signal : undefined
      }).then(function (res) {
        if (closed) return;
        ai.busy = false;
        ai.ctrl = null;
        var cards = normalizeCards(res && res.data);
        if (!cards.length) {
          NG.ui.toast("Aus diesem Text ließen sich keine Karten bauen. Versuch es mit mehr Inhalt.", "warn");
          paintAi();
          return;
        }
        ai.preview = cards;
        try {
          NG.ai.logRun({
            kind: "cards",
            title: "Karten für „" + deckName(deck) + "“",
            prompt: prompt,
            result: res && res.text ? res.text : "",
            subjectId: deck.subjectId || null
          });
        } catch (e) { /* der Verlauf ist nur ein Extra */ }
        paintAi();
      }).catch(function (err) {
        if (closed) return;
        ai.busy = false;
        ai.ctrl = null;
        NG.ui.toast(NG.ai.friendly(err), "error");
        paintAi();
      });
    }

    function aiPrompt(text) {
      return [
        "Erstelle Karteikarten für den Stapel „" + deckName(deck) + "“" +
        (deck.subjectId ? " im Fach " + NG.store.subjectName(deck.subjectId) : "") + ".",
        "",
        "Regeln:",
        "- Höchstens " + AI_MAX_CARDS + " Karten, lieber weniger und dafür richtig gute.",
        "- Vorderseite: eine kurze, klare Frage oder ein Begriff.",
        "- Rückseite: die knappe Antwort, ein bis zwei Sätze.",
        "- Keine Nummerierung, keine doppelten Karten.",
        "- Antworte NUR mit diesem JSON, ohne Text davor oder danach:",
        '{"cards":[{"front":"…","back":"…"}]}',
        "",
        "Lernstoff:",
        U.truncate(text, 8000)
      ].join("\n");
    }

    function normalizeCards(data) {
      var raw = null;
      if (data && Array.isArray(data.cards)) raw = data.cards;
      else if (Array.isArray(data)) raw = data;
      if (!raw) return [];

      var out = [];
      raw.forEach(function (c) {
        if (!c || typeof c !== "object") return;
        var f = sideText(c.front);
        var b = sideText(c.back);
        if (f && b) out.push({ front: U.truncate(f, 400), back: U.truncate(b, 800) });
      });
      return out.slice(0, AI_MAX_CARDS);
    }

    function acceptPreview() {
      if (!ai.preview || !ai.preview.length) return;
      var n = ai.preview.length;
      NG.store.addMany("cards", ai.preview.map(function (c) {
        return newCardRecord(deck.id, c.front, c.back);
      }));
      ai.preview = null;
      ai.open = false;
      if (ai.area) ai.area.value = "";
      NG.ui.toast(n + " " + plural(n, "Karte", "Karten") + " angelegt – alle im Fach 1", "success");
      paintAi();
      paintList();
    }

    /* ---- Liste aller Karten ---- */

    function paintList() {
      U.clear(listBox);
      var cards = U.sortBy(cardsOf(deck.id), function (c) { return String(c.createdAt || ""); }, "asc");

      if (!cards.length) {
        listBox.appendChild(NG.ui.card({
          title: "Karten im Stapel",
          body: el("p", {
            class: "muted fs-sm",
            text: "Noch keine Karte da. Leg oben deine erste an – Frage vorn, Antwort hinten."
          })
        }));
        return;
      }

      var list = el("div", { class: "list" });
      cards.forEach(function (card) {
        list.appendChild(editingId === card.id ? editRow(card) : viewRow(card));
      });

      listBox.appendChild(NG.ui.card({
        title: "Karten im Stapel",
        actions: [el("span", {
          class: "badge",
          text: cards.length + " " + plural(cards.length, "Karte", "Karten")
        })],
        body: list,
        flush: true
      }));
    }

    function boxBadgeClass(box) {
      if (box >= 4) return "badge badge--success";
      if (box >= 2) return "badge badge--info";
      return "badge";
    }

    function viewRow(card) {
      var box = boxOf(card);
      var due = dueOf(card);
      return el("div", { class: "list__item" }, [
        el("span", {
          class: boxBadgeClass(box), text: "Fach " + box,
          title: "Leitner-Fach " + box + " von " + MAX_BOX
        }),
        el("div", { class: "list__main" }, [
          el("div", { class: "list__title", text: U.truncate(sideText(card.front, "—"), 90) }),
          el("div", { class: "list__meta" }, [
            el("span", { text: U.truncate(sideText(card.back, "—"), 90) }),
            el("span", {
              class: isDue(card) ? "badge badge--warn" : "faint",
              text: isDue(card) ? "fällig" : "wieder " + U.relDays(due)
            })
          ])
        ]),
        el("div", { class: "list__actions" }, [
          iconButton("edit", "Karte bearbeiten", function () {
            editingId = card.id;
            paintList();
          }),
          iconButton("trash", "Karte löschen", function () { removeCard(card); })
        ])
      ]);
    }

    function editRow(card) {
      var frontId = U.uid("fce");
      var backId = U.uid("fce");
      var front = el("textarea", { rows: 2, id: frontId, "aria-label": "Vorderseite" });
      var back = el("textarea", { rows: 2, id: backId, "aria-label": "Rückseite" });
      front.value = sideText(card.front);
      back.value = sideText(card.back);

      function save() {
        var f = String(front.value || "").trim();
        var b = String(back.value || "").trim();
        if (!f || !b) {
          NG.ui.toast("Vorder- und Rückseite dürfen nicht leer sein.", "warn");
          return;
        }
        NG.store.update("cards", card.id, { front: f, back: b });
        editingId = null;
        paintList();
      }

      return el("div", { class: "list__item", style: { display: "block" } },
        el("div", { class: "stack stack--sm" }, [
          el("div", { class: "field" }, [el("label", { for: frontId, text: "Vorderseite" }), front]),
          el("div", { class: "field" }, [el("label", { for: backId, text: "Rückseite" }), back]),
          el("div", { class: "row row--tight" }, [
            textButton("save", "Speichern", "btn btn--sm btn--primary", save),
            el("button", {
              class: "btn btn--sm", type: "button", text: "Abbrechen",
              onClick: function () { editingId = null; paintList(); }
            }),
            el("span", { class: "spacer" }),
            el("span", {
              class: "fs-xs faint",
              text: "Fach " + boxOf(card) + " · " + (U.num(card.reps, 0) || 0) + "× gewusst · " +
                (U.num(card.lapses, 0) || 0) + "× nochmal"
            })
          ])
        ]));
    }

    function removeCard(card) {
      NG.ui.confirm({
        title: "Karte löschen?",
        message: "„" + U.truncate(sideText(card.front, "Diese Karte"), 80) + "“ wird dauerhaft entfernt.",
        confirmText: "Löschen",
        danger: true
      }).then(function (yes) {
        if (!yes || closed) return;
        NG.store.remove("cards", card.id);
        if (editingId === card.id) editingId = null;
        paintList();
      });
    }
  }

  /* =========================================================
     Übersicht
     ========================================================= */

  function statsGrid(decks, cards) {
    var today = U.todayISO();
    var due = dueCards(cards, today);
    var pct = masteredPercent(cards);

    return el("div", { class: "grid grid--4" }, [
      NG.ui.stat("Stapel", String(decks.length), "angelegt"),
      NG.ui.stat("Karten", String(cards.length),
        cards.length ? "in allen Stapeln" : "noch keine Karte"),
      NG.ui.stat("Heute fällig", String(due.length),
        due.length ? "warten auf dich" : "alles erledigt",
        due.length ? "var(--warn)" : "var(--success)"),
      NG.ui.stat("Sitzt", cards.length ? Math.round(pct) + " %" : "—",
        "Karten in Fach 4 und 5",
        cards.length && pct >= 60 ? "var(--success)" : null)
    ]);
  }

  function deckCard(deck) {
    var cards = cardsOf(deck.id);
    var due = dueCards(cards);
    var sits = mastered(cards).length;
    var pct = masteredPercent(cards);

    var meta = el("div", { class: "row row--tight" }, [
      NG.ui.subjectTag(deck.subjectId || null),
      el("span", { class: "badge", text: cards.length + " " + plural(cards.length, "Karte", "Karten") }),
      due.length ? el("span", { class: "badge badge--warn", text: due.length + " fällig" }) : null
    ]);

    var body = el("div", { class: "stack stack--sm" }, [
      meta,
      progressBar(pct),
      el("div", {
        class: "fs-xs faint",
        text: cards.length
          ? sits + " von " + cards.length + " " + plural(cards.length, "Karte", "Karten") + " " +
            plural(sits, "sitzt", "sitzen") + " schon (Fach 4 und 5)"
          : "Noch keine Karten – leg gleich welche an."
      })
    ]);

    var learnBtn = textButton(
      due.length ? "play" : "refresh",
      due.length ? "Lernen" : "Alle wiederholen",
      "btn btn--primary" + (cards.length ? "" : " btn--sm"),
      function () { startStudy(deck, due.length > 0); }
    );
    if (!cards.length) {
      learnBtn.disabled = true;
      learnBtn.title = "Dieser Stapel hat noch keine Karten.";
    }

    return NG.ui.card({
      title: deckName(deck),
      actions: [iconButton("edit", "Stapel bearbeiten", function () { openDeckDialog(deck); })],
      body: body,
      foot: el("div", { class: "row row--tight" }, [
        learnBtn,
        textButton("layers", "Karten", "btn", function () { openCardManager(deck); })
      ])
    });
  }

  function renderOverview(root) {
    var decks = sortedDecks();
    var stack = el("div", { class: "stack" });

    if (!decks.length) {
      stack.appendChild(NG.ui.empty({
        icon: "layers",
        title: "Noch keine Karteikarten",
        text: "Leg einen Stapel an – zum Beispiel für Vokabeln oder Formeln. " +
          "Danach wandern deine Karten durch die Fächer 1 bis 5: Was sitzt, kommt seltener dran.",
        action: { label: "Neuer Stapel", onClick: function () { openDeckDialog(null); } }
      }));
      root.appendChild(stack);
      return;
    }

    var cards = livingCards();
    var due = dueCards(cards);

    stack.appendChild(statsGrid(decks, cards));
    stack.appendChild(el("div", {
      class: "fs-xs faint",
      text: due.length
        ? "Heute sind " + due.length + " " + plural(due.length, "Karte", "Karten") +
          " dran. Beim Lernen gilt: „Gewusst“ schiebt eine Karte ein Fach nach oben, „Nochmal“ zurück auf Fach 1."
        : "Heute ist keine Karte fällig – gut gemacht! Du kannst trotzdem jederzeit alles wiederholen."
    }));

    stack.appendChild(el("div", { class: "section-title", text: "Deine Stapel" }));

    var grid = el("div", { class: "grid grid--3" });
    decks.forEach(function (deck) { grid.appendChild(deckCard(deck)); });
    stack.appendChild(grid);

    root.appendChild(stack);
  }

  /* =========================================================
     Lernmodus
     ========================================================= */

  function startStudy(deck, onlyDue) {
    var pool = cardsOf(deck.id);
    if (onlyDue) pool = dueCards(pool);
    if (!pool.length) {
      NG.ui.toast(cardsOf(deck.id).length
        ? "In diesem Stapel ist gerade nichts fällig."
        : "Dieser Stapel hat noch keine Karten.", "warn");
      return;
    }
    session = {
      deckId: deck.id,
      ids: shuffle(pool).map(function (c) { return c.id; }),
      index: 0,
      flipped: false,
      known: 0,
      again: 0,
      done: false
    };
    mode = "study";
    rerender();
  }

  function endStudy() {
    mode = "overview";
    session = null;
    unbindKeys();
    rerender();
  }

  /** Aktuelle Karte – gelöschte Karten werden dabei übersprungen. */
  function currentCard() {
    if (!session) return null;
    while (session.index < session.ids.length) {
      var card = NG.store.find("cards", session.ids[session.index]);
      if (card) return card;
      session.index++;
    }
    session.done = true;
    return null;
  }

  function sessionValid() {
    if (!session) return false;
    if (!NG.store.find("decks", session.deckId)) return false;
    if (session.done) return true;
    return !!currentCard() || session.done;
  }

  function toggleFlip() {
    if (!session || session.done) return;
    session.flipped = !session.flipped;
    if (cardNode) cardNode.classList.toggle("is-flipped", session.flipped);
    paintControls();
  }

  /**
   * Karte bewerten.
   * Gewusst: ein Fach höher (höchstens 5), das neue Fach bestimmt den Abstand.
   * Nochmal: zurück auf Fach 1 und sofort wieder fällig.
   */
  function answer(known) {
    if (!session || session.done) return;
    var card = currentCard();
    if (!card) { rerender(); return; }

    var today = U.todayISO();
    if (known) {
      var box = U.clamp(boxOf(card) + 1, 1, MAX_BOX);
      NG.store.update("cards", card.id, {
        box: box,
        due: U.addDays(today, INTERVALS[box - 1]),
        reps: (U.num(card.reps, 0) || 0) + 1
      });
      session.known++;
    } else {
      NG.store.update("cards", card.id, {
        box: 1,
        due: today,
        lapses: (U.num(card.lapses, 0) || 0) + 1
      });
      session.again++;
    }

    session.index++;
    session.flipped = false;
    if (!currentCard()) session.done = true;
    rerender();
  }

  function paintControls() {
    if (!controlsHost || !session) return;
    U.clear(controlsHost);

    if (!session.flipped) {
      controlsHost.appendChild(textButton("eye", "Antwort zeigen", "btn btn--primary btn--lg",
        function () { toggleFlip(); }));
      return;
    }

    controlsHost.appendChild(textButton("refresh", "Nochmal", "btn btn--lg",
      function () { answer(false); }));
    controlsHost.appendChild(textButton("check", "Gewusst", "btn btn--primary btn--lg",
      function () { answer(true); }));
  }

  function doneCard(deck) {
    var total = session.known + session.again;
    return NG.ui.card({
      title: "Geschafft!",
      body: el("div", { class: "stack center" }, [
        el("div", {
          class: "row row--tight",
          style: { justifyContent: "center" }
        }, [
          el("span", { class: "badge badge--success", text: session.known + " gewusst" }),
          el("span", { class: "badge badge--warn", text: session.again + " nochmal" })
        ]),
        el("p", {
          text: "Du hast " + total + " " + plural(total, "Karte", "Karten") + " aus „" +
            (deck ? deckName(deck) : "dem Stapel") + "“ durchgearbeitet."
        }),
        el("p", {
          class: "muted fs-sm",
          text: session.again
            ? session.again + " " + plural(session.again, "Karte liegt", "Karten liegen") +
              " wieder in Fach 1 und " + plural(session.again, "ist", "sind") + " gleich wieder dran."
            : "Alles gewusst – diese Karten kommen erst später wieder."
        }),
        el("div", { class: "row row--tight", style: { justifyContent: "center" } }, [
          textButton("chevronLeft", "Zurück zur Übersicht", "btn btn--primary",
            function () { endStudy(); })
        ])
      ])
    });
  }

  function renderStudy(root) {
    var deck = NG.store.find("decks", session.deckId);
    var stack = el("div", { class: "stack" });

    if (session.done) {
      stack.appendChild(doneCard(deck));
      root.appendChild(stack);
      return;
    }

    var card = currentCard();
    var total = session.ids.length;
    var pos = Math.min(session.index + 1, total);

    stack.appendChild(el("div", { class: "row" }, [
      el("div", { style: { minWidth: "0" } }, [
        el("div", { class: "fw-6 truncate", text: deck ? deckName(deck) : "Stapel" }),
        el("div", {
          class: "fs-xs faint",
          text: "Karte " + pos + " von " + total + " · Fach " + boxOf(card) + " von " + MAX_BOX
        })
      ]),
      el("div", { class: "row row--tight spacer" }, [
        el("span", { class: "badge badge--success", text: session.known + " gewusst" }),
        el("span", { class: "badge", text: session.again + " nochmal" }),
        textButton("x", "Beenden", "btn btn--sm", function () { endStudy(); })
      ])
    ]));

    stack.appendChild(progressBar(total ? (session.index / total) * 100 : 0));

    cardNode = el("div", {
      class: "flashcard" + (session.flipped ? " is-flipped" : ""),
      role: "button", tabindex: "0",
      "aria-label": "Karte umdrehen",
      onClick: function () { toggleFlip(); },
      onKeydown: function (e) {
        if (e.key === "Enter") { e.preventDefault(); toggleFlip(); }
      }
    }, el("div", { class: "flashcard__inner" }, [
      el("div", { class: "flashcard__face" }, [
        el("span", { class: "flashcard__tag", text: "Frage" }),
        el("div", { text: sideText(card.front, "(leere Vorderseite)") })
      ]),
      el("div", { class: "flashcard__face flashcard__face--back" }, [
        el("span", { class: "flashcard__tag", text: "Antwort" }),
        el("div", { text: sideText(card.back, "(leere Rückseite)") })
      ])
    ]));

    controlsHost = el("div", { class: "row row--tight", style: { justifyContent: "center" } });
    paintControls();

    stack.appendChild(el("div", {
      class: "stack",
      style: { maxWidth: "640px", width: "100%", margin: "0 auto" }
    }, [
      cardNode,
      controlsHost,
      el("div", {
        class: "fs-xs faint center",
        text: "Leertaste dreht die Karte · 1 = Nochmal · 2 = Gewusst · Esc beendet"
      })
    ]));

    root.appendChild(stack);
  }

  /* ---------- Tastatur im Lernmodus ------------------------ */

  function onStudyKey(e) {
    if (mode !== "study" || !session) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && e.target.tagName && /input|textarea|select/i.test(e.target.tagName)) return;
    if (document.querySelector(".modal-backdrop")) return;   // Dialog hat Vorrang

    var key = e.key;
    var handled = true;

    if (key === "Escape") {
      endStudy();
    } else if (key === " " || key === "Spacebar") {
      if (!session.done) toggleFlip();
    } else if (key === "1") {
      if (!session.done && session.flipped) answer(false); else handled = !session.done;
    } else if (key === "2") {
      if (!session.done && session.flipped) answer(true); else handled = !session.done;
    } else {
      handled = false;
    }

    if (!handled) return;
    // Damit die App-Kürzel (1 … 6 wechseln die Ansicht) hier nicht dazwischenfunken.
    e.preventDefault();
    e.stopPropagation();
  }

  function bindKeys() {
    if (keyHandler) return;
    keyHandler = onStudyKey;
    document.addEventListener("keydown", keyHandler, true);
  }

  function unbindKeys() {
    if (!keyHandler) return;
    document.removeEventListener("keydown", keyHandler, true);
    keyHandler = null;
  }

  /* =========================================================
     Darstellung
     ========================================================= */

  function render(root, ctx) {
    ctxRef = ctx;
    cardNode = null;
    controlsHost = null;

    if (mode === "study" && !sessionValid()) {
      mode = "overview";
      session = null;
    }

    if (mode === "study") {
      bindKeys();
      renderStudy(root);
    } else {
      unbindKeys();
      renderOverview(root);
    }
  }

  /* ---------- Registrierung --------------------------------- */

  NG.app.register({
    id: "flashcards",
    title: "Karteikarten",
    subtitle: "Lernen mit dem Leitner-System – Fach 1 bis 5",
    icon: "layers",
    group: "learn",
    order: 9,
    live: false,               // Lernsitzung und Drehung leben nur hier drin
    render: render,

    badge: function () {
      return dueCards(livingCards()).length;
    },

    actions: function () {
      return [textButton("plus", "Neuer Stapel", "btn btn--sm btn--primary",
        function () { openDeckDialog(null); })];
    },

    primaryAction: function () {
      return {
        label: "Neuer Stapel",
        icon: "plus",
        onClick: function () { openDeckDialog(null); }
      };
    },

    onLeave: function () {
      unbindKeys();
      cardNode = null;
      controlsHost = null;
    }
  });
})(window);
