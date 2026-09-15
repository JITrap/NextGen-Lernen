/* =========================================================
   NextGen Lernen – Einstellungen
   Profil, Noten, KI-Anbindung, Datensicherung.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG, U = NG.util, el = U.el;

  /* ---------- kleine Helfer -------------------------------- */

  function row(label, hint, control) {
    return el("div", {
      class: "row",
      style: { alignItems: "flex-start", padding: "var(--sp-3) 0", borderBottom: "1px solid var(--border)" }
    }, [
      el("div", { style: { flex: "1 1 220px", minWidth: "180px" } }, [
        el("div", { class: "fw-6", text: label }),
        hint ? el("div", { class: "fs-xs faint", text: hint }) : null
      ]),
      el("div", { style: { flex: "1 1 260px", minWidth: "200px" } }, control)
    ]);
  }

  function textInput(path, opts) {
    opts = opts || {};
    var input = el("input", {
      type: opts.type || "text",
      placeholder: opts.placeholder || "",
      value: NG.store.getSetting(path, "") || "",
      autocomplete: opts.autocomplete || "off"
    });
    input.addEventListener("change", function () {
      var v = opts.type === "number" ? U.num(input.value, opts.fallback || 0) : input.value;
      NG.store.setSetting(path, v);
      if (opts.onSet) opts.onSet(v);
      NG.ui.toast("Gespeichert", "success", 1400);
    });
    return input;
  }

  function selectInput(path, options, onSet) {
    var sel = el("select");
    options.forEach(function (o) {
      var opt = el("option", { value: o.value, text: o.label });
      if (String(NG.store.getSetting(path, "")) === String(o.value)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      NG.store.setSetting(path, sel.value);
      if (onSet) onSet(sel.value);
    });
    return sel;
  }

  function toggle(path, label, onSet) {
    var input = el("input", { type: "checkbox" });
    input.checked = !!NG.store.getSetting(path, false);
    input.addEventListener("change", function () {
      NG.store.setSetting(path, input.checked);
      if (onSet) onSet(input.checked);
    });
    return el("label", { class: "check" }, [input, el("span", { text: label })]);
  }

  /* ---------- Abschnitte ----------------------------------- */

  function profileCard() {
    return NG.ui.card({
      title: "Profil",
      body: el("div", {}, [
        row("Name", "Wird in der Begrüßung und in KI-Anfragen genutzt.", textInput("name", { placeholder: "Dein Name" })),
        row("Klasse / Stufe", "z. B. 9b oder Q1", textInput("klasse", { placeholder: "z. B. 9b" })),
        row("Schuljahr", "z. B. 2025/26", textInput("schoolYear", { placeholder: "2025/26" }))
      ])
    });
  }

  function appearanceCard(ctx) {
    var themeGroup = el("div", { class: "btn-group" });
    [["auto", "Automatisch"], ["light", "Hell"], ["dark", "Dunkel"]].forEach(function (t) {
      var b = el("button", {
        type: "button", text: t[1],
        "aria-pressed": NG.store.getSetting("theme", "auto") === t[0] ? "true" : "false",
        onClick: function () {
          NG.store.setSetting("theme", t[0]);
          NG.app.applyTheme();
          U.$$("button", themeGroup).forEach(function (n) { n.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true");
        }
      });
      themeGroup.appendChild(b);
    });

    var startOptions = NG.app.views
      .filter(function (v) { return v.id !== "settings"; })
      .map(function (v) { return { value: v.id, label: v.title }; });

    return NG.ui.card({
      title: "Darstellung",
      body: el("div", {}, [
        row("Farbschema", "Automatisch folgt der Einstellung deines Geräts.", themeGroup),
        row("Startansicht", "Diese Seite wird beim Öffnen angezeigt.", selectInput("startView", startOptions)),
        row("Tastenkürzel", "Mit den Zahlen 1–6 springst du direkt zu einer Ansicht.",
          el("button", {
            class: "btn btn--sm", type: "button", text: "Übersicht anzeigen",
            onClick: function () { NG.app.showShortcuts(); }
          }))
      ])
    });
    void ctx;
  }

  function gradesCard(ctx) {
    var scaleSel = selectInput("gradeScale", [
      { value: "de6", label: "Noten 1–6 (Sekundarstufe I)" },
      { value: "points15", label: "Punkte 0–15 (Oberstufe)" }
    ], function () {
      NG.ui.toast("Notensystem umgestellt. Bereits eingetragene Werte werden nicht umgerechnet.", "warn", 6000);
      ctx.rerender();
    });

    var dw = NG.store.getSetting("defaultWeights", { written: 50, oral: 50 });
    var wIn = el("input", { type: "number", min: "0", max: "100", value: String(dw.written) });
    var oIn = el("input", { type: "number", min: "0", max: "100", value: String(dw.oral) });
    var meter = el("div", { class: "meter" }, [
      el("span", { style: { width: dw.written + "%", background: "var(--accent)" } }),
      el("span", { style: { width: dw.oral + "%", background: "var(--info)" } })
    ]);

    function sync(source) {
      var w = U.clamp(U.num(wIn.value, 50) || 0, 0, 100);
      var o = U.clamp(U.num(oIn.value, 50) || 0, 0, 100);
      if (source === "written") o = 100 - w;
      else w = 100 - o;
      wIn.value = String(w);
      oIn.value = String(o);
      meter.children[0].style.width = w + "%";
      meter.children[1].style.width = o + "%";
      NG.store.setSetting("defaultWeights", { written: w, oral: o });
    }
    wIn.addEventListener("input", function () { sync("written"); });
    oIn.addEventListener("input", function () { sync("oral"); });

    var weightBlock = el("div", { class: "stack stack--sm" }, [
      el("div", { class: "row row--tight" }, [
        el("div", { class: "field", style: { flex: "1" } }, [el("label", { text: "Schriftlich %" }), wIn]),
        el("div", { class: "field", style: { flex: "1" } }, [el("label", { text: "Mündlich %" }), oIn])
      ]),
      meter,
      el("div", { class: "row row--tight" }, [50, 60, 40, 70].map(function (v) {
        return el("button", {
          class: "chip", type: "button", text: v + " / " + (100 - v),
          onClick: function () { wIn.value = String(v); sync("written"); }
        });
      }))
    ]);

    return NG.ui.card({
      title: "Noten",
      body: el("div", {}, [
        row("Notensystem", "Bestimmt, wie Noten eingegeben und angezeigt werden.", scaleSel),
        row("Standard-Gewichtung", "Gilt für neu angelegte Fächer. Je Fach kannst du davon abweichen.", weightBlock),
        row("Fächer verwalten", "Gewichtung, Farbe und Wertigkeit je Fach.",
          el("button", {
            class: "btn btn--sm", type: "button", text: "Zu den Fächern",
            onClick: function () { ctx.go("subjects"); }
          }))
      ])
    });
  }

  function timetableCard() {
    return NG.ui.card({
      title: "Stundenplan",
      body: el("div", {}, [
        row("Beginn der 1. Stunde", "Daraus werden alle weiteren Uhrzeiten berechnet.",
          textInput("firstHourStart", { type: "time" })),
        row("Länge einer Stunde", "In Minuten, üblich sind 45.",
          textInput("lessonMinutes", { type: "number", fallback: 45 }))
      ])
    });
  }

  function aiCard(ctx) {
    var st = NG.ai.status();
    var inArtifact = !!(global.claude && typeof global.claude.use === "function");

    var providerSel = selectInput("ai.provider", [
      { value: "auto", label: "Automatisch (empfohlen)" },
      { value: "claude", label: "Claude über diese Seite" },
      { value: "anthropic", label: "Eigener API-Schlüssel" },
      { value: "proxy", label: "Eigener Server (Proxy)" }
    ], function () { ctx.rerender(); });

    var keyInput = el("input", {
      type: "password",
      placeholder: "sk-ant-…",
      value: NG.store.getSetting("ai.apiKey", "") || "",
      autocomplete: "off", spellcheck: "false"
    });
    var showKey = el("button", {
      class: "btn btn--sm btn--icon", type: "button", "aria-label": "Schlüssel anzeigen",
      html: U.icon("eye"),
      onClick: function () { keyInput.type = keyInput.type === "password" ? "text" : "password"; }
    });
    keyInput.addEventListener("change", function () {
      NG.store.setSetting("ai.apiKey", keyInput.value.trim());
      NG.ui.toast("Schlüssel gespeichert", "success");
      ctx.rerender();
    });

    var testOut = el("div", { class: "fs-sm muted" });
    var testBtn = el("button", {
      class: "btn btn--sm", type: "button",
      html: U.icon("zap") + "<span>Verbindung testen</span>",
      onClick: function () {
        testBtn.disabled = true;
        U.clear(testOut);
        testOut.appendChild(el("span", { class: "row row--tight" }, [
          el("span", { class: "spinner" }), el("span", { text: "Teste …" })
        ]));
        NG.ai.run({
          prompt: "Antworte mit genau einem Wort: Bereit",
          tier: "quick",
          maxTokens: 64
        }).then(function (res) {
          U.clear(testOut);
          testOut.appendChild(el("span", { class: "badge badge--success", text: "Antwort: " + U.truncate(res.text.trim(), 40) }));
        }).catch(function (e) {
          U.clear(testOut);
          testOut.appendChild(el("span", { class: "badge badge--danger", text: NG.ai.friendly(e) }));
        }).then(function () { testBtn.disabled = false; });
      }
    });

    var rows = [
      row("Status", "", el("div", { class: "stack stack--sm" }, [
        el("span", { class: "badge " + (st.ready ? "badge--success" : "badge--warn"), text: st.label }),
        st.ready ? null : el("div", { class: "fs-xs faint", text: st.reason })
      ])),
      row("Zugang", "Wie die KI erreicht wird.", providerSel)
    ];

    if (!inArtifact) {
      rows.push(el("div", {
        class: "card", style: {
          background: "var(--info-soft)", borderColor: "transparent",
          margin: "var(--sp-3) 0", boxShadow: "none"
        }
      }, el("div", { class: "card__body fs-sm" }, [
        el("div", { class: "fw-6 mb-2", text: "Zwei Wege zur KI" }),
        el("p", {
          text: "1. Ohne Schlüssel: Öffne diese Seite als veröffentlichtes Claude-Artifact – dann läuft " +
            "die KI über dein Claude-Konto."
        }),
        el("p", {
          class: "mt-0",
          text: "2. Mit eigenem Schlüssel: Trage unten einen Anthropic-API-Schlüssel ein. Er wird nur in " +
            "diesem Browser gespeichert und direkt an api.anthropic.com gesendet."
        })
      ])));
    }

    rows.push(row("API-Schlüssel", "Wird lokal in diesem Browser gespeichert – teile das Gerät also nicht ungesichert.",
      el("div", { class: "input-group" }, [keyInput, showKey])));

    rows.push(row("Modell", "Opus ist am stärksten, Haiku am schnellsten.",
      selectInput("ai.model", NG.ai.MODELS.map(function (m) { return { value: m.id, label: m.label }; }))));

    rows.push(row("Eigener Server (Proxy)",
      "Optional: eigene Adresse, die die Anfrage an Anthropic weiterreicht. So bleibt der Schlüssel geheim.",
      textInput("ai.proxyUrl", { type: "url", placeholder: "https://…/api/claude" })));

    rows.push(row("Antwortstil", "Im Lernmodus wird jeder Schritt erklärt.",
      selectInput("ai.mode", [
        { value: "explain", label: "Lernmodus – Schritt für Schritt erklären" },
        { value: "solve", label: "Kurzmodus – nur das Ergebnis" }
      ])));

    rows.push(row("Test", "Prüft, ob die Verbindung funktioniert.",
      el("div", { class: "stack stack--sm" }, [testBtn, testOut])));

    return NG.ui.card({ title: "KI-Assistent", body: el("div", {}, rows) });
  }

  function onenoteCard(ctx) {
    var ON = global.NG.onenote;
    if (!ON) return null;

    var verfuegbar = ON.available();
    var eingerichtet = ON.isConfigured();
    var angemeldet = ON.isSignedIn();
    var konto = ON.account();

    var badge;
    if (!verfuegbar) badge = el("span", { class: "badge", text: "Hier nicht möglich" });
    else if (angemeldet) badge = el("span", {
      class: "badge badge--success",
      text: "Verbunden" + (konto && konto.name ? " als " + konto.name : "")
    });
    else if (eingerichtet) badge = el("span", { class: "badge badge--warn", text: "Eingerichtet, nicht angemeldet" });
    else badge = el("span", { class: "badge badge--warn", text: "Noch nicht eingerichtet" });

    var rows = [
      row("Status", "", el("div", { class: "stack stack--sm" }, [
        badge,
        verfuegbar ? null : el("div", { class: "fs-xs faint", text: ON.unavailableReason() })
      ]))
    ];

    if (verfuegbar) {
      var idInput = el("input", {
        type: "text",
        placeholder: "00000000-0000-0000-0000-000000000000",
        value: NG.store.getSetting("onenote.clientId", "") || "",
        autocomplete: "off", spellcheck: "false"
      });
      idInput.addEventListener("change", function () {
        var wert = idInput.value.trim();
        if (wert && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wert)) {
          NG.ui.toast("Das sieht nicht nach einer Anwendungs-ID aus. Sie besteht aus 32 Zeichen mit Bindestrichen.", "error", 6000);
          return;
        }
        NG.store.setSetting("onenote.clientId", wert);
        NG.ui.toast(wert ? "Anwendungs-ID gespeichert" : "Anwendungs-ID entfernt", "success");
        ctx.rerender();
      });

      rows.push(row("Anwendungs-ID (Client)",
        "Aus deiner Microsoft-App-Registrierung. Die Schritt-für-Schritt-Anleitung steht unter „Importieren“.",
        idInput));

      rows.push(row("Umleitungs-Adresse",
        "Genau diese Adresse muss in Azure als Typ „Single-Page-Application (SPA)“ eingetragen sein.",
        el("div", { class: "input-group" }, [
          el("code", {
            text: ON.redirectUri(),
            style: {
              background: "var(--surface-3)", padding: "7px 10px", borderRadius: "var(--radius-sm)",
              fontSize: ".78rem", flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
            }
          }),
          el("button", {
            class: "btn btn--sm", type: "button",
            html: U.icon("copy") + "<span>Kopieren</span>",
            onClick: function () { NG.ui.copyText(ON.redirectUri()); }
          })
        ])));

      var aktionen = [el("button", {
        class: "btn btn--sm", type: "button",
        html: U.icon("download") + "<span>Zum Import</span>",
        onClick: function () { ctx.go("import"); }
      })];

      if (angemeldet) {
        aktionen.push(el("button", {
          class: "btn btn--sm btn--danger", type: "button", text: "Von Microsoft abmelden",
          onClick: function () {
            NG.ui.confirm({
              title: "Abmelden?",
              message: "Die Verbindung zu OneNote wird getrennt. Bereits importierte Materialien bleiben erhalten.",
              confirmText: "Abmelden"
            }).then(function (ja) {
              if (!ja) return;
              ON.signOut().then(function () {
                NG.ui.toast("Von Microsoft abgemeldet");
                ctx.rerender();
              });
            });
          }
        }));
      }

      rows.push(row("Notizbücher holen", "Notizbücher durchsuchen und Seiten übernehmen.",
        el("div", { class: "row row--tight" }, aktionen)));
    } else {
      rows.push(row("Alternative", "Der Datei-Import funktioniert überall – auch hier.",
        el("button", {
          class: "btn btn--sm", type: "button",
          html: U.icon("upload") + "<span>Dateien importieren</span>",
          onClick: function () { ctx.go("import"); }
        })));
    }

    return NG.ui.card({ title: "OneNote", body: el("div", {}, rows) });
  }

  function dataCard(ctx) {
    var counts = NG.store.COLLECTIONS.map(function (c) {
      return { name: c, n: NG.store.all(c).length };
    }).filter(function (c) { return c.n; });

    var LABELS = {
      subjects: "Fächer", grades: "Noten", events: "Termine", tasks: "Aufgaben",
      timetable: "Stundenplan-Einträge", materials: "Materialien", aiRuns: "KI-Antworten",
      decks: "Kartenstapel", cards: "Karteikarten", sessions: "Lernsitzungen"
    };

    var importInput = el("input", { type: "file", accept: "application/json,.json", class: "hidden" });
    importInput.addEventListener("change", function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      U.readAsText(file).then(function (text) {
        var preview;
        try {
          var parsed = JSON.parse(text);
          var data = parsed && parsed.data ? parsed.data : parsed;
          preview = (data.subjects || []).length + " Fächer, " + (data.grades || []).length +
            " Noten, " + (data.events || []).length + " Termine";
        } catch (err) {
          NG.ui.toast("Das ist keine gültige Sicherungsdatei.", "error");
          return;
        }

        function apply(mode) {
          try {
            NG.store.importJSON(text, mode);
            NG.ui.toast("Sicherung eingespielt", "success");
          } catch (err) {
            NG.ui.toast("Einspielen fehlgeschlagen: " + (err.message || err), "error");
          }
        }

        var m = NG.ui.modal({
          title: "Sicherung einspielen",
          body: el("div", { class: "stack stack--sm" }, [
            el("p", { text: "Die Datei enthält: " + preview + "." }),
            el("p", { class: "fs-sm muted", text: "„Ersetzen“ verwirft die aktuellen Daten. „Hinzufügen“ ergänzt nur neue Einträge." })
          ]),
          actions: [
            { label: "Abbrechen", onClick: function () { m.close(); } },
            { label: "Hinzufügen", onClick: function () { m.close(); apply("merge"); } },
            { label: "Ersetzen", variant: "primary", onClick: function () { m.close(); apply("replace"); } }
          ]
        });
      }).catch(function (e) {
        NG.ui.toast("Datei konnte nicht gelesen werden: " + (e.message || e), "error");
      });
      importInput.value = "";
    });

    var storageInfo = {
      artifact: "Sicher im Artifact-Speicher",
      indexeddb: "Im Browser dieses Geräts (IndexedDB)",
      memory: "Nur im Arbeitsspeicher – Dateien gehen beim Schließen verloren!"
    };
    var kind = NG.files.storageKind();

    var syncRow = null;
    if (NG.sync && NG.sync.available()) {
      var syncBadge = el("span", { class: "badge", text: NG.sync.status().message });
      NG.sync.onStatus(function (s) {
        if (!syncBadge.isConnected) return;
        syncBadge.textContent = s.message;
        syncBadge.className = "badge " + (s.state === "ok" ? "badge--success" : s.state === "error" ? "badge--danger" : "");
      });
      syncRow = row("Cloud-Sicherung", "Sichert deine Daten zusätzlich geräteübergreifend.",
        el("div", { class: "stack stack--sm" }, [
          toggle("cloudSync", "Cloud-Sicherung nutzen", function (on) {
            if (on) NG.sync.init(); else NG.sync.disable();
          }),
          syncBadge
        ]));
    }

    return NG.ui.card({
      title: "Daten & Sicherung",
      body: el("div", {}, [
        row("Gespeicherte Einträge", "Alles liegt lokal in diesem Browser.",
          el("div", { class: "row row--tight" },
            counts.length
              ? counts.map(function (c) {
                return el("span", { class: "badge", text: (LABELS[c.name] || c.name) + ": " + c.n });
              })
              : [el("span", { class: "muted fs-sm", text: "Noch keine Daten" })])),
        row("Dateien", "Hochgeladene Bilder und Dokumente.",
          el("span", {
            class: "badge " + (kind === "memory" ? "badge--danger" : "badge--info"),
            text: storageInfo[kind] || kind
          })),
        syncRow,
        row("Sicherung erstellen", "Lädt alle Daten als JSON-Datei herunter.",
          el("button", {
            class: "btn btn--sm", type: "button",
            html: U.icon("download") + "<span>Herunterladen</span>",
            onClick: function () {
              var blob = new Blob([NG.store.exportJSON()], { type: "application/json" });
              U.downloadBlob(blob, "nextgen-lernen-" + U.todayISO() + ".json");
              NG.ui.toast("Sicherung erstellt", "success");
            }
          })),
        row("Sicherung einspielen", "Aus einer zuvor heruntergeladenen Datei.",
          el("div", {}, [
            el("button", {
              class: "btn btn--sm", type: "button",
              html: U.icon("upload") + "<span>Datei wählen</span>",
              onClick: function () { importInput.click(); }
            }),
            importInput
          ])),
        row("Aufräumen", "Entfernt Dateien, die zu keinem Material mehr gehören.",
          el("button", {
            class: "btn btn--sm", type: "button", text: "Speicher aufräumen",
            onClick: function () {
              NG.files.prune().then(function (n) {
                NG.ui.toast(n ? n + " verwaiste Datei(en) entfernt" : "Nichts zum Aufräumen", "success");
              });
            }
          })),
        row("Einrichtung erneut starten", "Führt dich wieder durch die ersten Schritte.",
          el("button", {
            class: "btn btn--sm", type: "button", text: "Assistent starten",
            onClick: function () {
              if (NG.onboarding) NG.onboarding.start();
              else NG.ui.toast("Assistent nicht verfügbar", "error");
            }
          })),
        row("Alles löschen", "Entfernt sämtliche Daten unwiderruflich.",
          el("button", {
            class: "btn btn--sm btn--danger", type: "button",
            html: U.icon("trash") + "<span>Alle Daten löschen</span>",
            onClick: function () {
              NG.ui.confirm({
                title: "Wirklich alles löschen?",
                message: "Fächer, Noten, Termine, Aufgaben und Materialien werden gelöscht. " +
                  "Lege vorher am besten eine Sicherung an.",
                confirmText: "Endgültig löschen",
                danger: true
              }).then(function (yes) {
                if (!yes) return;
                NG.store.reset();
                NG.ui.toast("Alle Daten gelöscht");
                ctx.go("dashboard");
              });
            }
          }))
      ])
    });
  }

  function aboutCard() {
    return NG.ui.card({
      title: "Über NextGen Lernen",
      body: el("div", { class: "stack stack--sm fs-sm muted" }, [
        el("p", {
          text: "Eine Lern- und Organisations-App für die Schule: Klassenarbeiten und Termine, Noten mit " +
            "eigener Gewichtung, Materialien, Karteikarten, Lernzeit – und ein KI-Assistent, der " +
            "hochgeladene Aufgaben liest und erklärt."
        }),
        el("p", {
          class: "mt-0",
          text: "Die App läuft vollständig im Browser. Deine Daten verlassen das Gerät nur, wenn du eine " +
            "KI-Anfrage stellst oder die Cloud-Sicherung einschaltest."
        }),
        el("div", { class: "row row--tight mt-2" }, [
          el("span", { class: "badge", text: "Version 1.0" }),
          el("span", { class: "badge", text: "Offline nutzbar" })
        ])
      ])
    });
  }

  /* ---------- Ansicht -------------------------------------- */

  function render(root, ctx) {
    U.append(root, el("div", { class: "stack" }, [
      profileCard(),
      aiCard(ctx),
      onenoteCard(ctx),
      gradesCard(ctx),
      appearanceCard(ctx),
      timetableCard(),
      dataCard(ctx),
      aboutCard()
    ]));
  }

  NG.app.register({
    id: "settings",
    title: "Einstellungen",
    icon: "settings",
    group: "more",
    order: 11,
    live: false,
    render: render
  });
})(window);
