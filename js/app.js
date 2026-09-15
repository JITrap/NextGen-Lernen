/* =========================================================
   NextGen Lernen – App-Gerüst
   Registriert Ansichten, baut Navigation und Router.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});
  var U = NG.util;
  var el = U.el;

  var views = [];
  var byId = {};
  var currentId = null;
  var currentCtx = null;
  var rendering = false;
  var pendingRender = null;

  var GROUPS = [
    { id: "plan", label: "Planen" },
    { id: "grades", label: "Noten" },
    { id: "learn", label: "Lernen" },
    { id: "more", label: "Mehr" }
  ];

  /**
   * Eine Ansicht anmelden.
   * @param {{id:string, title:string, subtitle?:string, icon:string, group:string,
   *          order:number, tab?:boolean, live?:boolean, badge?:Function,
   *          actions?:Function, primaryAction?:Function, render:Function,
   *          onLeave?:Function}} view
   */
  function register(view) {
    if (byId[view.id]) return;
    views.push(view);
    byId[view.id] = view;
    views.sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
  }

  /* ---------- Navigation ----------------------------------- */

  function buildSidebar() {
    var nav = U.$("#nav");
    if (!nav) return;
    U.clear(nav);

    GROUPS.forEach(function (group) {
      var items = views.filter(function (v) { return v.group === group.id; });
      if (!items.length) return;
      nav.appendChild(el("div", { class: "nav__group", text: group.label }));
      items.forEach(function (v) {
        var badgeCount = v.badge ? v.badge() : 0;
        var btn = el("button", {
          class: "nav__item", type: "button", "data-view": v.id,
          onClick: function () { go(v.id); closeSidebar(); }
        }, [
          U.iconEl(v.icon),
          el("span", { text: v.title }),
          badgeCount ? el("span", { class: "nav__badge", text: badgeCount > 99 ? "99+" : String(badgeCount) }) : null
        ]);
        if (v.id === currentId) btn.setAttribute("aria-current", "page");
        nav.appendChild(btn);
      });
    });
  }

  function buildTabbar() {
    var bar = U.$("#tabbar");
    if (!bar) return;
    U.clear(bar);
    views.filter(function (v) { return v.tab; }).slice(0, 5).forEach(function (v) {
      var btn = el("button", {
        class: "tabbar__item", type: "button", "data-view": v.id,
        onClick: function () { go(v.id); }
      }, [U.iconEl(v.icon), el("span", { text: v.tabTitle || v.title })]);
      if (v.id === currentId) btn.setAttribute("aria-current", "page");
      bar.appendChild(btn);
    });
  }

  function markActive() {
    U.$$("[data-view]").forEach(function (n) {
      if (n.dataset.view === currentId) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    });
  }

  function openSidebar() {
    U.$(".sidebar").classList.add("is-open");
    U.$(".scrim").classList.add("is-open");
  }
  function closeSidebar() {
    var sb = U.$(".sidebar"), sc = U.$(".scrim");
    if (sb) sb.classList.remove("is-open");
    if (sc) sc.classList.remove("is-open");
  }

  /* ---------- Router --------------------------------------- */

  function parseHash() {
    var raw = (global.location.hash || "").replace(/^#\/?/, "");
    var parts = raw.split("/");
    return { id: parts[0] || null, params: parts.slice(1) };
  }

  function go(id, params) {
    var hash = "#/" + id + (params && params.length ? "/" + params.join("/") : "");
    if (global.location.hash === hash) render();
    else global.location.hash = hash;
  }

  function onHashChange() { render(); }

  /* ---------- Rendern -------------------------------------- */

  function render() {
    var route = parseHash();
    var id = route.id && byId[route.id] ? route.id
      : (byId[NG.store.getSetting("startView", "dashboard")] ? NG.store.getSetting("startView", "dashboard") : "dashboard");
    var view = byId[id] || views[0];
    if (!view) return;

    if (currentId && currentId !== view.id && byId[currentId] && byId[currentId].onLeave) {
      try { byId[currentId].onLeave(); } catch (e) { console.error(e); }
    }

    currentId = view.id;
    var host = U.$("#view");
    var titleNode = U.$("#topbar-title");
    var subNode = U.$("#topbar-sub");
    var actionHost = U.$("#topbar-actions");

    rendering = true;
    try {
      U.clear(host);
      U.clear(actionHost);

      titleNode.textContent = view.title;
      var sub = typeof view.subtitle === "function" ? view.subtitle() : view.subtitle;
      subNode.textContent = sub || "";
      subNode.classList.toggle("hidden", !sub);
      document.title = view.title + " · NextGen Lernen";

      var ctx = {
        params: route.params,
        go: go,
        rerender: function () { scheduleRender(); },
        host: host
      };
      currentCtx = ctx;

      var body = el("div", { class: "view" });
      host.appendChild(body);
      view.render(body, ctx);

      if (view.actions) {
        var actions = view.actions(ctx) || [];
        actions.forEach(function (a) { if (a) actionHost.appendChild(a); });
      }

      updateFab(view, ctx);
      markActive();
      buildSidebar();
      buildTabbar();
      markActive();
    } catch (err) {
      console.error("[NextGen Lernen] Fehler beim Anzeigen der Ansicht:", err);
      U.clear(host);
      host.appendChild(el("div", { class: "card" },
        el("div", { class: "card__body stack" }, [
          el("h3", { text: "Diese Ansicht konnte nicht geladen werden" }),
          el("p", { class: "muted", text: String(err && err.message || err) }),
          el("button", {
            class: "btn", type: "button", text: "Erneut versuchen",
            onClick: function () { scheduleRender(); }
          })
        ])));
    } finally {
      rendering = false;
    }

    var main = U.$(".main");
    if (main && main.scrollTo) main.scrollTo(0, 0);
    global.scrollTo(0, 0);
  }

  function scheduleRender() {
    if (pendingRender) return;
    pendingRender = global.requestAnimationFrame(function () {
      pendingRender = null;
      render();
    });
  }

  function updateFab(view, ctx) {
    var old = U.$(".fab");
    if (old) old.remove();
    if (!view.primaryAction) return;
    var action = view.primaryAction(ctx);
    if (!action) return;
    var fab = el("button", {
      class: "fab", type: "button", "aria-label": action.label,
      html: U.icon(action.icon || "plus"),
      onClick: action.onClick
    });
    document.body.appendChild(fab);
  }

  /* ---------- Farbschema ----------------------------------- */

  function applyTheme() {
    var theme = NG.store.getSetting("theme", "auto");
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    var meta = U.$('meta[name="theme-color"]');
    if (meta) {
      var dark = theme === "dark" ||
        (theme === "auto" && global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches);
      meta.setAttribute("content", dark ? "#0e1016" : "#f2f4f9");
    }
  }

  function cycleTheme() {
    var order = ["auto", "light", "dark"];
    var next = order[(order.indexOf(NG.store.getSetting("theme", "auto")) + 1) % 3];
    NG.store.setSetting("theme", next);
    applyTheme();
    NG.ui.toast("Design: " + ({ auto: "automatisch", light: "hell", dark: "dunkel" })[next]);
  }

  /* ---------- Tastenkürzel --------------------------------- */

  function bindKeys() {
    document.addEventListener("keydown", function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (U.$(".modal-backdrop")) return;
      var map = {
        "1": "dashboard", "2": "calendar", "3": "grades",
        "4": "tasks", "5": "assistant", "6": "flashcards"
      };
      if (map[e.key]) { e.preventDefault(); go(map[e.key]); }
      if (e.key === "?") { e.preventDefault(); showShortcuts(); }
    });
  }

  function showShortcuts() {
    NG.ui.modal({
      title: "Tastenkürzel",
      body: el("div", { class: "list" }, [
        ["1", "Übersicht"], ["2", "Termine"], ["3", "Noten"],
        ["4", "Aufgaben"], ["5", "KI-Assistent"], ["6", "Karteikarten"], ["?", "Diese Hilfe"]
      ].map(function (p) {
        return el("div", { class: "list__item", style: { paddingLeft: 0, paddingRight: 0 } }, [
          el("kbd", {
            text: p[0],
            style: {
              background: "var(--surface-3)", padding: "2px 8px", borderRadius: "6px",
              fontFamily: "var(--font-mono)", fontSize: ".8rem", minWidth: "26px", textAlign: "center"
            }
          }),
          el("span", { text: p[1] })
        ]);
      }))
    });
  }

  /* ---------- Offline-Betrieb ------------------------------- */

  /** Service Worker nur dort anmelden, wo er wirklich hilft. */
  function registerServiceWorker() {
    var httpLike = global.location.protocol === "http:" || global.location.protocol === "https:";
    var framed = global.top !== global.self;          // z. B. als Claude-Artifact eingebettet
    if (!httpLike || framed || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").catch(function () {
      // Offline-Betrieb ist ein Extra – ein Fehlschlag darf die App nicht stören.
    });
  }

  /* ---------- Start ---------------------------------------- */

  function boot() {
    NG.store.init();
    applyTheme();

    if (global.matchMedia) {
      var mq = global.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", applyTheme);
    }

    U.$("#menu-btn").addEventListener("click", openSidebar);
    U.$(".scrim").addEventListener("click", closeSidebar);
    U.$("#theme-btn").addEventListener("click", cycleTheme);

    global.addEventListener("hashchange", onHashChange);

    // Ansichten aktualisieren, wenn sich Daten ändern
    NG.store.on("change", function () {
      if (rendering) return;
      var v = byId[currentId];
      if (!v || v.live === false) { buildSidebar(); buildTabbar(); markActive(); return; }
      scheduleRender();
    });
    NG.store.on("reload", function () { applyTheme(); scheduleRender(); });
    NG.store.on("storage-error", function () {
      NG.ui.toast("Speicher voll – bitte alte Materialien löschen oder ein Backup anlegen.", "error", 8000);
    });

    bindKeys();

    // KI und Dateiablage im Hintergrund vorbereiten
    NG.files.init().then(function () { });
    NG.ai.init().then(function (st) {
      var chip = U.$("#ai-state");
      if (!chip) return;
      chip.textContent = st.ready ? "KI bereit" : "KI einrichten";
      chip.className = "badge " + (st.ready ? "badge--success" : "badge--warn");
    });
    if (NG.sync && NG.sync.init) NG.sync.init();

    // Rückkehr von der Microsoft-Anmeldung abfangen, bevor gerendert wird:
    // handleRedirect räumt die Adresszeile sofort auf, der Tausch läuft danach.
    if (NG.onenote && NG.onenote.available()) {
      NG.onenote.handleRedirect().then(function (done) {
        if (!done) return;
        NG.ui.toast("Mit Microsoft verbunden – deine Notizbücher stehen bereit.", "success", 5000);
        scheduleRender();
      }).catch(function (err) {
        NG.ui.toast("Microsoft-Anmeldung fehlgeschlagen: " + ((err && err.message) || err), "error", 10000);
        scheduleRender();
      });
    }

    render();
    registerServiceWorker();

    if (!NG.store.getSetting("onboarded", false) && NG.onboarding) {
      setTimeout(NG.onboarding.start, 350);
    }
  }

  NG.app = {
    register: register, go: go, render: render, scheduleRender: scheduleRender,
    views: views, byId: byId, boot: boot, applyTheme: applyTheme,
    cycleTheme: cycleTheme, showShortcuts: showShortcuts,
    current: function () { return byId[currentId]; },
    ctx: function () { return currentCtx; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
