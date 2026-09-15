/* =========================================================
   NextGen Lernen – Hilfsfunktionen
   Globale Namensraum-Datei: definiert window.NG
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});

  /* ---------- DOM ---------------------------------------- */

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var val = props[key];
        if (val === null || val === undefined || val === false) return;
        if (key === "class" || key === "className") node.className = val;
        else if (key === "html") node.innerHTML = val;
        else if (key === "text") node.textContent = val;
        else if (key === "style" && typeof val === "object") Object.assign(node.style, val);
        else if (key === "dataset") Object.assign(node.dataset, val);
        else if (key.slice(0, 2) === "on" && typeof val === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (val === true) node.setAttribute(key, "");
        else node.setAttribute(key, val);
      });
    }
    append(node, children);
    return node;
  }

  function append(parent, children) {
    if (children === null || children === undefined || children === false) return parent;
    if (Array.isArray(children)) {
      children.forEach(function (c) { append(parent, c); });
      return parent;
    }
    if (children instanceof Node) parent.appendChild(children);
    else parent.appendChild(document.createTextNode(String(children)));
    return parent;
  }

  function frag(children) {
    var f = document.createDocumentFragment();
    append(f, children);
    return f;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  /* ---------- Text --------------------------------------- */

  function escapeHtml(str) {
    return String(str === null || str === undefined ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function uid(prefix) {
    return (prefix || "id") + "_" +
      Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 8);
  }

  function truncate(str, n) {
    str = String(str || "");
    return str.length > n ? str.slice(0, n - 1) + "…" : str;
  }

  function slug(str) {
    return String(str || "").toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /* ---------- Markdown (sicher: erst escapen, dann formatieren) ---- */

  function mdInline(text) {
    return text
      .replace(/`([^`\n]+)`/g, function (_, c) { return "<code>" + c + "</code>"; })
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function md(src) {
    if (!src) return "";
    var lines = escapeHtml(src).replace(/\r\n?/g, "\n").split("\n");
    var out = [];
    var listStack = [];   // {tag}
    var inCode = false;
    var codeBuf = [];
    var paraBuf = [];
    var tableBuf = [];

    function closeLists() {
      while (listStack.length) out.push("</" + listStack.pop().tag + ">");
    }
    function flushPara() {
      if (paraBuf.length) { out.push("<p>" + mdInline(paraBuf.join(" ")) + "</p>"); paraBuf = []; }
    }
    function flushTable() {
      if (!tableBuf.length) return;
      var body = tableBuf.filter(function (r) { return !/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(r); });
      if (body.length) {
        var cells = function (row) {
          return row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|")
            .map(function (c) { return mdInline(c.trim()); });
        };
        var head = cells(body[0]);
        var html = "<table><thead><tr>" +
          head.map(function (c) { return "<th>" + c + "</th>"; }).join("") +
          "</tr></thead><tbody>";
        body.slice(1).forEach(function (r) {
          html += "<tr>" + cells(r).map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
        });
        out.push(html + "</tbody></table>");
      }
      tableBuf = [];
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fence = line.match(/^\s*```(.*)$/);

      if (fence) {
        if (inCode) { out.push("<pre><code>" + codeBuf.join("\n") + "</code></pre>"); codeBuf = []; inCode = false; }
        else { flushPara(); flushTable(); closeLists(); inCode = true; }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }

      if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); closeLists(); tableBuf.push(line); continue; }
      if (tableBuf.length) flushTable();

      if (!line.trim()) { flushPara(); closeLists(); continue; }

      var heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushPara(); closeLists();
        var lvl = Math.min(heading[1].length + 1, 6);
        out.push("<h" + lvl + ">" + mdInline(heading[2].trim()) + "</h" + lvl + ">");
        continue;
      }

      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); closeLists(); out.push("<hr>"); continue; }

      // Achtung: der Text ist bereits escaped, ">" steht hier als "&gt;".
      var quote = line.match(/^\s*(?:&gt;|>)\s?(.*)$/);
      if (quote) {
        flushPara(); closeLists();
        out.push("<blockquote>" + mdInline(quote[1]) + "</blockquote>");
        continue;
      }

      var li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        flushPara();
        var depth = Math.floor(li[1].replace(/\t/g, "  ").length / 2);
        var tag = /\d/.test(li[2]) ? "ol" : "ul";
        while (listStack.length > depth + 1) out.push("</" + listStack.pop().tag + ">");
        if (listStack.length === depth + 1 && listStack[depth].tag !== tag) {
          out.push("</" + listStack.pop().tag + ">");
        }
        if (listStack.length < depth + 1) { out.push("<" + tag + ">"); listStack.push({ tag: tag }); }
        out.push("<li>" + mdInline(li[3]) + "</li>");
        continue;
      }

      closeLists();
      paraBuf.push(line.trim());
    }

    if (inCode && codeBuf.length) out.push("<pre><code>" + codeBuf.join("\n") + "</code></pre>");
    flushTable();
    flushPara();
    closeLists();
    return out.join("\n");
  }

  /* ---------- Datum & Zeit -------------------------------- */

  var WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  var WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  var MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"];

  /** ISO-Datum (YYYY-MM-DD) -> lokales Date-Objekt (ohne Zeitzonen-Versatz). */
  function toDate(iso) {
    if (iso instanceof Date) return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate());
    if (!iso) return null;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) { var d = new Date(iso); return isNaN(d) ? null : d; }
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function toISO(date) {
    if (!date) return "";
    var d = date instanceof Date ? date : toDate(date);
    if (!d || isNaN(d)) return "";
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function todayISO() { return toISO(new Date()); }

  function addDays(iso, n) {
    var d = toDate(iso) || new Date();
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  /** Ganze Tage zwischen heute und dem Datum (negativ = Vergangenheit). */
  function daysUntil(iso) {
    var d = toDate(iso);
    if (!d) return null;
    var t = toDate(new Date());
    return Math.round((d - t) / 86400000);
  }

  function fmtDate(iso, opts) {
    var d = toDate(iso);
    if (!d) return "—";
    var style = (opts && opts.style) || "medium";
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    if (style === "short") return dd + "." + mm + ".";
    if (style === "numeric") return dd + "." + mm + "." + d.getFullYear();
    if (style === "long") return WEEKDAYS[d.getDay()] + ", " + d.getDate() + ". " + MONTHS[d.getMonth()] + " " + d.getFullYear();
    return WEEKDAYS_SHORT[d.getDay()] + ", " + dd + "." + mm + "." + d.getFullYear();
  }

  /** Menschliche Beschreibung: „heute“, „morgen“, „in 4 Tagen“, „vor 2 Tagen“. */
  function relDays(iso) {
    var n = daysUntil(iso);
    if (n === null) return "";
    if (n === 0) return "heute";
    if (n === 1) return "morgen";
    if (n === 2) return "übermorgen";
    if (n === -1) return "gestern";
    if (n > 0) return "in " + n + " Tagen";
    return "vor " + Math.abs(n) + " Tagen";
  }

  function fmtTime(t) {
    if (!t) return "";
    var m = String(t).match(/^(\d{1,2}):(\d{2})/);
    return m ? String(m[1]).padStart(2, "0") + ":" + m[2] : String(t);
  }

  function fmtMinutes(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60);
    var m = min % 60;
    return h ? h + " h " + (m ? m + " min" : "").trim() : m + " min";
  }

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  /** Kalenderwoche (ISO 8601). */
  function isoWeek(iso) {
    var d = toDate(iso) || new Date();
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    var week1 = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  /** Montag der Woche, in der `iso` liegt. */
  function startOfWeek(iso) {
    var d = toDate(iso) || new Date();
    var day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return toISO(d);
  }

  /* ---------- Zahlen -------------------------------------- */

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function num(v, fallback) {
    var n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return isFinite(n) ? n : (fallback === undefined ? null : fallback);
  }

  function fmtNum(n, decimals) {
    if (n === null || n === undefined || !isFinite(n)) return "—";
    var d = decimals === undefined ? 2 : decimals;
    return n.toFixed(d).replace(".", ",");
  }

  /* ---------- Sammlungen ---------------------------------- */

  function sortBy(arr, fn, dir) {
    var sign = dir === "desc" ? -1 : 1;
    return arr.slice().sort(function (a, b) {
      var x = fn(a), y = fn(b);
      if (x === null || x === undefined || x === "") return 1;
      if (y === null || y === undefined || y === "") return -1;
      return x > y ? sign : x < y ? -sign : 0;
    });
  }

  function groupBy(arr, fn) {
    var out = {};
    arr.forEach(function (item) {
      var k = fn(item);
      (out[k] = out[k] || []).push(item);
    });
    return out;
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  /* ---------- Dateien ------------------------------------- */

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
  }

  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error || new Error("Datei konnte nicht gelesen werden")); };
      r.readAsDataURL(file);
    });
  }

  function readAsText(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error || new Error("Datei konnte nicht gelesen werden")); };
      r.readAsText(file);
    });
  }

  /** Bild verkleinern, damit Uploads klein bleiben. Gibt einen Blob zurück. */
  function shrinkImage(file, maxPx, quality) {
    maxPx = maxPx || 1600;
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type) || /svg/.test(file.type)) return resolve(file);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        if (scale >= 1 && file.size < 900 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { resolve(blob || file); }, "image/jpeg", quality || 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* ---------- Icons (Feather-Stil, 24×24) ------------------ */

  var ICONS = {
    home: "M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1h3.5v-6h4v6H17.5a1 1 0 0 0 1-1V9.5",
    book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z",
    award: "M12 3a6 6 0 1 0 0 12A6 6 0 0 0 12 3zM8.5 14 7 22l5-2.5L17 22l-1.5-8",
    calendar: "M7 3v3M17 3v3M3.5 9h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5z",
    check: "M20 6 9 17l-5-5",
    checkSquare: "m9 11 3 3 5-6M20.5 12.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5h10",
    clock: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7v5.2l3.4 2",
    folder: "M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z",
    sparkles: "m12 3 1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9zM18.5 15l.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8zM5.5 2.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6L3.3 4.7l1.6-.6z",
    layers: "m12 3 9 4.8-9 4.8-9-4.8zM3 12.5l9 4.8 9-4.8M3 17l9 4.8 9-4.8",
    timer: "M12 7.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 11v3.5l2.3 1.4M9.5 2.5h5M19 6.5l1.6 1.6",
    settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
    plus: "M12 5v14M5 12h14",
    trash: "M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 12.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10 11v6M14 11v6",
    edit: "M16.8 3.8a2.1 2.1 0 0 1 3 3L8.5 18.1l-4 1 1-4zM14.5 6.1l3.4 3.4",
    x: "M18 6 6 18M6 6l12 12",
    menu: "M4 7h16M4 12h16M4 17h16",
    chevronLeft: "m15 5-7 7 7 7",
    chevronRight: "m9 5 7 7-7 7",
    chevronDown: "m5 9 7 7 7-7",
    download: "M12 3.5v12M7.5 11 12 15.5 16.5 11M4.5 19.5h15",
    upload: "M12 20.5v-12M7.5 13 12 8.5 16.5 13M4.5 4.5h15",
    image: "M4.5 4.5h15a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM3.5 16.5 9 11l4 4 2.5-2.5 5 5",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
    alert: "M12 8v5M12 16.5h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    info: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5.5M12 7.6h.01",
    sun: "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6",
    moon: "M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z",
    target: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.3a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4z",
    refresh: "M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.5 4v5h-5",
    play: "M7 4.5v15l13-7.5z",
    pause: "M9 5v14M15 5v14",
    stop: "M6.5 6.5h11v11h-11z",
    save: "M5 4.5h11L19.5 8v11a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5v-14a.5.5 0 0 1 .5-.5zM8 4.5v5h7v-5M8 19.5v-6h8v6",
    copy: "M9.5 9.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM5.5 14.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1",
    filter: "M3.5 5.5h17l-6.5 7.5v6l-4 2v-8z",
    grid: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
    list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
    users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5zM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.75 3.75 0 0 1 0 7.1",
    graduation: "M12 3 2.5 8 12 13l9.5-5zM6 10.3V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5.7M21.5 8v6",
    message: "M20.5 12.5a7.5 7.5 0 0 1-10.8 6.7L4 20.5l1.4-5.4A7.5 7.5 0 1 1 20.5 12.5z",
    send: "M21 3 3 10.5l7 3 3 7z M10 13.5 21 3",
    brain: "M9.5 3.5A3 3 0 0 0 6.6 6 2.8 2.8 0 0 0 4 8.8c0 .9.4 1.7 1 2.3a2.9 2.9 0 0 0-.6 1.8c0 1.2.7 2.2 1.7 2.6a2.8 2.8 0 0 0 2.8 3.5c.6 0 1.1-.2 1.6-.5V3.9c-.3-.2-.7-.4-1-.4zM14.5 3.5A3 3 0 0 1 17.4 6 2.8 2.8 0 0 1 20 8.8c0 .9-.4 1.7-1 2.3.4.5.6 1.1.6 1.8 0 1.2-.7 2.2-1.7 2.6a2.8 2.8 0 0 1-2.8 3.5c-.6 0-1.1-.2-1.6-.5V3.9c.3-.2.7-.4 1-.4z",
    file: "M13.5 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5zM13.5 3.5V8.5h5",
    flag: "M5 21V4.5M5 5h10l-1.5 3.5L15 12H5",
    star: "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z",
    eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    zap: "M13.5 2 4 13.5h7L10.5 22 20 10.5h-7z",
    trending: "m3.5 16.5 5.5-5.5 3.5 3.5 7-7M15 7.5h4.5V12",
    clipboard: "M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V6a1.5 1.5 0 0 0-1.5-1.5H15M9.5 3h5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5z",
    key: "M15 3.5a5.5 5.5 0 1 0-4.6 8.6L9 13.5H7v2H5v2H3v-2.6l6.1-6.1A5.5 5.5 0 0 0 15 3.5zM16 7h.01",
    cloud: "M7 18.5A4 4 0 0 1 6.6 10.6a5.5 5.5 0 0 1 10.6-1.2A3.8 3.8 0 0 1 17.5 18.5z",
    link: "M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.5 1.5M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1.5-1.5"
  };

  function icon(name, cls) {
    var d = ICONS[name] || ICONS.info;
    return '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  function iconEl(name, cls) {
    var span = document.createElement("span");
    span.style.display = "contents";
    span.innerHTML = icon(name, cls);
    return span.firstChild;
  }

  /* ---------- Export -------------------------------------- */

  NG.util = {
    el: el, h: el, append: append, frag: frag, $: $, $$: $$, clear: clear,
    escapeHtml: escapeHtml, uid: uid, truncate: truncate, slug: slug, md: md,
    toDate: toDate, toISO: toISO, todayISO: todayISO, addDays: addDays,
    daysUntil: daysUntil, fmtDate: fmtDate, relDays: relDays, fmtTime: fmtTime,
    fmtMinutes: fmtMinutes, fmtBytes: fmtBytes, isoWeek: isoWeek, startOfWeek: startOfWeek,
    WEEKDAYS: WEEKDAYS, WEEKDAYS_SHORT: WEEKDAYS_SHORT, MONTHS: MONTHS,
    clamp: clamp, num: num, fmtNum: fmtNum,
    sortBy: sortBy, groupBy: groupBy, debounce: debounce,
    downloadBlob: downloadBlob, readAsDataURL: readAsDataURL, readAsText: readAsText,
    shrinkImage: shrinkImage,
    icon: icon, iconEl: iconEl, ICONS: ICONS
  };
})(window);
