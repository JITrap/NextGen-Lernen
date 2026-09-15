/* =========================================================
   NextGen Lernen – UI-Bausteine
   Dialoge, Hinweise, Formulare und wiederkehrende Elemente.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});
  var U = NG.util;
  var el = U.el;

  /* ---------- Kurzhinweise (Toasts) ------------------------ */

  function toastHost() {
    var host = U.$(".toasts");
    if (!host) {
      host = el("div", { class: "toasts", role: "status", "aria-live": "polite" });
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, type, ms) {
    var node = el("div", { class: "toast" + (type ? " toast--" + type : "") }, [
      U.iconEl(type === "error" ? "alert" : type === "success" ? "check" : "info"),
      el("span", { text: message })
    ]);
    toastHost().appendChild(node);
    setTimeout(function () {
      node.classList.add("is-leaving");
      setTimeout(function () { node.remove(); }, 200);
    }, ms || (type === "error" ? 5200 : 3000));
    return node;
  }

  /* ---------- Dialoge -------------------------------------- */

  var openModals = [];

  /**
   * Öffnet einen Dialog.
   * @param {{title:string, body:Node|string, actions?:Array, wide?:boolean,
   *          onClose?:Function, dismissable?:boolean}} opts
   */
  function modal(opts) {
    opts = opts || {};
    var lastFocus = document.activeElement;

    var body = el("div", { class: "modal__body" });
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    else if (opts.body) U.append(body, opts.body);

    var closeBtn = el("button", {
      class: "btn btn--icon spacer", type: "button", "aria-label": "Schließen",
      html: U.icon("x"), onClick: function () { close(); }
    });

    var head = el("div", { class: "modal__head" }, [
      el("h2", { text: opts.title || "" }),
      closeBtn
    ]);

    var foot = null;
    if (opts.actions && opts.actions.length) {
      foot = el("div", { class: "modal__foot" });
      opts.actions.forEach(function (a) {
        if (a === "spacer") { foot.appendChild(el("span", { class: "spacer" })); return; }
        foot.appendChild(el("button", {
          type: "button",
          class: "btn " + (a.variant ? "btn--" + a.variant : ""),
          text: a.label,
          onClick: function (ev) { a.onClick && a.onClick(ev, api); }
        }));
      });
    }

    var box = el("div", {
      class: "modal" + (opts.wide ? " modal--wide" : ""),
      role: "dialog", "aria-modal": "true", "aria-label": opts.title || "Dialog"
    }, [head, body, foot]);

    var backdrop = el("div", {
      class: "modal-backdrop",
      onClick: function (e) { if (e.target === backdrop && opts.dismissable !== false) close(); }
    }, box);

    function onKey(e) {
      if (e.key === "Escape" && opts.dismissable !== false) { e.stopPropagation(); close(); }
      if (e.key === "Tab") trapFocus(e, box);
    }

    function close(result) {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      openModals = openModals.filter(function (m) { return m !== api; });
      if (!openModals.length) document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
      if (opts.onClose) opts.onClose(result);
    }

    var api = { el: box, body: body, foot: foot, close: close, backdrop: backdrop };

    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey, true);
    openModals.push(api);

    setTimeout(function () {
      var first = box.querySelector("input, select, textarea, button:not([aria-label='Schließen'])");
      if (first) { try { first.focus(); } catch (e) { } }
    }, 60);

    return api;
  }

  function trapFocus(e, root) {
    var items = U.$$("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])", root)
      .filter(function (n) { return n.offsetParent !== null; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /** Ja/Nein-Rückfrage. */
  function confirm(opts) {
    opts = typeof opts === "string" ? { message: opts } : (opts || {});
    return new Promise(function (resolve) {
      var done = false;
      var m = modal({
        title: opts.title || "Bist du sicher?",
        body: el("p", { class: "muted", text: opts.message || "" }),
        onClose: function () { if (!done) resolve(false); },
        actions: [
          { label: opts.cancelText || "Abbrechen", onClick: function () { done = true; m.close(); resolve(false); } },
          {
            label: opts.confirmText || "Ja, weiter",
            variant: opts.danger ? "primary" : "primary",
            onClick: function () { done = true; m.close(); resolve(true); }
          }
        ]
      });
      if (opts.danger) {
        var btn = m.foot.lastChild;
        btn.style.background = "var(--danger)";
        btn.style.borderColor = "var(--danger)";
        btn.style.color = "#fff";
      }
    });
  }

  /* ---------- Formularbau ---------------------------------- */

  /**
   * Baut ein Formular aus einer Feldbeschreibung.
   * Feld: {name, label, type, options, required, hint, placeholder,
   *        min, max, step, full, rows, value}
   */
  function buildForm(fields, values) {
    values = values || {};
    var wrap = el("div", { class: "form-grid" });
    var inputs = {};

    fields.forEach(function (f) {
      if (f.type === "separator") {
        wrap.appendChild(el("div", { class: "field--full", style: { gridColumn: "1 / -1" } },
          el("div", { class: "section-title", style: { margin: "0" }, text: f.label || "" })));
        return;
      }

      var id = "f_" + U.slug(f.name) + "_" + Math.random().toString(36).slice(2, 6);
      var current = values[f.name] !== undefined && values[f.name] !== null ? values[f.name] : (f.value !== undefined ? f.value : "");
      var input;

      if (f.type === "select") {
        input = el("select", { id: id, name: f.name });
        (f.options || []).forEach(function (o) {
          var opt = el("option", { value: o.value === null ? "" : o.value, text: o.label });
          if (String(o.value === null ? "" : o.value) === String(current)) opt.selected = true;
          input.appendChild(opt);
        });
      } else if (f.type === "textarea") {
        input = el("textarea", { id: id, name: f.name, rows: f.rows || 4, placeholder: f.placeholder || "" });
        input.value = current;
      } else if (f.type === "checkbox") {
        input = el("input", { type: "checkbox", id: id, name: f.name });
        input.checked = !!current;
      } else {
        input = el("input", {
          type: f.type || "text", id: id, name: f.name,
          placeholder: f.placeholder || "",
          min: f.min, max: f.max, step: f.step,
          inputmode: f.type === "number" ? "decimal" : null
        });
        input.value = current === null || current === undefined ? "" : current;
      }

      inputs[f.name] = input;

      var errorNode = el("div", { class: "field__error hidden" });
      var field;

      if (f.type === "checkbox") {
        field = el("div", { class: "field" + (f.full ? " field--full" : "") }, [
          el("label", { class: "check", for: id }, [input, el("span", { text: f.label })]),
          f.hint ? el("div", { class: "field__hint", text: f.hint }) : null,
          errorNode
        ]);
      } else {
        field = el("div", { class: "field" + (f.full ? " field--full" : "") }, [
          el("label", { for: id, text: f.label + (f.required ? " *" : "") }),
          input,
          f.hint ? el("div", { class: "field__hint", text: f.hint }) : null,
          errorNode
        ]);
      }

      if (f.full) field.style.gridColumn = "1 / -1";
      input._error = errorNode;
      if (f.after) U.append(field, f.after);
      wrap.appendChild(field);
    });

    function read() {
      var out = {};
      fields.forEach(function (f) {
        if (f.type === "separator") return;
        var input = inputs[f.name];
        if (!input) return;
        if (f.type === "checkbox") out[f.name] = input.checked;
        else if (f.type === "number") out[f.name] = input.value === "" ? null : U.num(input.value, null);
        else if (f.type === "select" && f.nullable && input.value === "") out[f.name] = null;
        else out[f.name] = input.value;
      });
      return out;
    }

    function validate() {
      var ok = true;
      fields.forEach(function (f) {
        if (f.type === "separator") return;
        var input = inputs[f.name];
        if (!input || !input._error) return;
        var msg = "";
        var val = f.type === "checkbox" ? input.checked : input.value;

        if (f.required && (val === "" || val === null || val === undefined)) msg = "Bitte ausfüllen.";
        else if (f.type === "number" && val !== "") {
          var n = U.num(val, null);
          if (n === null) msg = "Bitte eine Zahl eingeben.";
          else if (f.min !== undefined && n < f.min) msg = "Mindestens " + f.min + ".";
          else if (f.max !== undefined && n > f.max) msg = "Höchstens " + f.max + ".";
        }
        if (!msg && f.validate) msg = f.validate(val, read()) || "";

        if (msg) {
          ok = false;
          input._error.textContent = msg;
          input._error.classList.remove("hidden");
          input.style.borderColor = "var(--danger)";
        } else {
          input._error.classList.add("hidden");
          input.style.borderColor = "";
        }
      });
      return ok;
    }

    return { el: wrap, inputs: inputs, read: read, validate: validate };
  }

  /**
   * Dialog mit Formular. Löst mit den Werten auf – oder mit null bei Abbruch.
   * @returns {Promise<Object|null>}
   */
  function formModal(opts) {
    return new Promise(function (resolve) {
      var form = buildForm(opts.fields, opts.values);
      var settled = false;

      var content = el("div", { class: "stack" }, [
        opts.intro ? el("p", { class: "muted fs-sm", text: opts.intro }) : null,
        form.el,
        opts.extra || null
      ]);

      function submit() {
        if (!form.validate()) return;
        var data = form.read();
        if (opts.beforeSubmit) {
          var msg = opts.beforeSubmit(data, form);
          if (msg) { toast(msg, "error"); return; }
        }
        settled = true;
        m.close();
        resolve(data);
      }

      var actions = [];
      if (opts.onDelete) {
        actions.push({
          label: "Löschen", variant: "danger",
          onClick: function () {
            confirm({
              title: "Wirklich löschen?",
              message: opts.deleteMessage || "Dieser Eintrag wird dauerhaft entfernt.",
              confirmText: "Löschen", danger: true
            }).then(function (yes) {
              if (!yes) return;
              settled = true;
              m.close();
              opts.onDelete();
              resolve(null);
            });
          }
        });
        actions.push("spacer");
      }
      actions.push({ label: "Abbrechen", onClick: function () { m.close(); } });
      actions.push({ label: opts.submitText || "Speichern", variant: "primary", onClick: submit });

      var m = modal({
        title: opts.title,
        body: content,
        wide: opts.wide,
        actions: actions,
        onClose: function () { if (!settled) resolve(null); }
      });

      content.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      });
    });
  }

  /* ---------- Wiederkehrende Elemente ---------------------- */

  function empty(opts) {
    return el("div", { class: "empty" }, [
      el("div", { class: "empty__icon", html: U.icon(opts.icon || "info") }),
      el("h3", { text: opts.title || "Noch nichts da" }),
      opts.text ? el("p", { text: opts.text }) : null,
      opts.action ? el("button", {
        class: "btn btn--primary", type: "button",
        html: U.icon("plus") + "<span>" + U.escapeHtml(opts.action.label) + "</span>",
        onClick: opts.action.onClick
      }) : null
    ]);
  }

  function gradePill(value, size) {
    var cls = "grade-pill " + NG.grades.gradeClass(value) + (size ? " grade-pill--" + size : "");
    return el("span", { class: cls, text: NG.grades.format(value) });
  }

  function subjectTag(subjectId, opts) {
    opts = opts || {};
    var sub = NG.store.subject(subjectId);
    return el("span", { class: "subject-tag" }, [
      el("span", { class: "subject-dot", style: { background: sub ? sub.color : "var(--text-faint)" } }),
      el("span", { text: sub ? (opts.short ? (sub.short || sub.name) : sub.name) : "Ohne Fach" })
    ]);
  }

  function subjectOptions(opts) {
    opts = opts || {};
    var list = (opts.includeArchived ? NG.store.all("subjects") : NG.store.activeSubjects())
      .map(function (s) { return { value: s.id, label: s.name }; });
    if (opts.allowNone !== false) list.unshift({ value: "", label: opts.noneLabel || "— ohne Fach —" });
    return list;
  }

  function countdownBadge(iso) {
    var n = U.daysUntil(iso);
    if (n === null) return el("span");
    var cls = "countdown" + (n <= 2 ? " countdown--soon" : n <= 7 ? " countdown--near" : "");
    return el("span", { class: cls, text: U.relDays(iso) });
  }

  /** Markdown-Block mit Kopieren-Schaltfläche. */
  function mdBlock(text, opts) {
    opts = opts || {};
    var body = el("div", { class: "md", html: U.md(text || "") });
    if (opts.plain) return body;
    return el("div", { class: "stack stack--sm" }, [
      body,
      el("div", { class: "row row--tight" }, [
        el("button", {
          class: "btn btn--sm btn--ghost", type: "button",
          html: U.icon("copy") + "<span>Kopieren</span>",
          onClick: function () { copyText(text); }
        }),
        opts.actions || null
      ])
    ]);
  }

  function copyText(text) {
    var done = function () { toast("In die Zwischenablage kopiert", "success"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();

    function fallback() {
      var ta = el("textarea", { style: { position: "fixed", opacity: "0" } });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { toast("Kopieren nicht möglich", "error"); }
      ta.remove();
    }
  }

  /** Kopfzeile innerhalb einer Ansicht. */
  function sectionHead(title, actions) {
    return el("div", { class: "row", style: { marginBottom: "var(--sp-3)" } }, [
      el("h2", { text: title }),
      actions ? el("div", { class: "row row--tight spacer" }, actions) : null
    ]);
  }

  function card(opts) {
    return el("div", { class: "card" }, [
      opts.title ? el("div", { class: "card__head" }, [
        el("h3", { text: opts.title }),
        opts.actions ? el("div", { class: "row row--tight spacer" }, opts.actions) : null
      ]) : null,
      el("div", { class: "card__body" + (opts.flush ? " card__body--flush" : "") }, opts.body),
      opts.foot ? el("div", { class: "card__foot" }, opts.foot) : null
    ]);
  }

  function stat(label, value, note, color) {
    return el("div", { class: "stat" }, [
      el("div", { class: "stat__label", text: label }),
      el("div", { class: "stat__value", text: value, style: color ? { color: color } : null }),
      note ? el("div", { class: "stat__note", text: note }) : null
    ]);
  }

  /** Datei-Auswahl per Klick oder Drag & Drop. */
  function dropzone(opts) {
    var input = el("input", {
      type: "file", class: "hidden",
      accept: opts.accept || "image/*",
      multiple: opts.multiple !== false
    });
    input.addEventListener("change", function () {
      if (input.files && input.files.length) opts.onFiles(Array.from(input.files));
      input.value = "";
    });

    var zone = el("div", {
      class: "dropzone", role: "button", tabindex: "0",
      onClick: function () { input.click(); },
      onKeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } }
    }, [
      el("div", { html: U.icon(opts.icon || "upload") }),
      el("div", { class: "fw-6", text: opts.title || "Datei auswählen oder hierher ziehen" }),
      el("div", { class: "fs-xs faint", text: opts.hint || "" }),
      input
    ]);

    ["dragenter", "dragover"].forEach(function (evt) {
      zone.addEventListener(evt, function (e) { e.preventDefault(); zone.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      zone.addEventListener(evt, function (e) { e.preventDefault(); zone.classList.remove("is-over"); });
    });
    zone.addEventListener("drop", function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) opts.onFiles(Array.from(files));
    });

    return zone;
  }

  NG.ui = {
    toast: toast, modal: modal, confirm: confirm,
    buildForm: buildForm, formModal: formModal,
    empty: empty, gradePill: gradePill, subjectTag: subjectTag, subjectOptions: subjectOptions,
    countdownBadge: countdownBadge, mdBlock: mdBlock, copyText: copyText,
    sectionHead: sectionHead, card: card, stat: stat, dropzone: dropzone
  };
})(window);
