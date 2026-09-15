/* =========================================================
   NextGen Lernen – Datei-Leser
   Macht aus hochgeladenen Dateien Text oder Bilder, die an
   die KI weitergereicht werden können.
   Ohne externe Bibliotheken: .docx wird als ZIP selbst geöffnet
   und mit DecompressionStream ausgepackt.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});

  var ACCEPT = ".txt,.md,.csv,.html,.htm,.docx,.pdf,image/*";
  var MAX_BYTES = 25 * 1024 * 1024;    // größere Dateien nehmen wir nicht an
  var MAX_CHARS = 200000;              // so viel Text reicht der KI allemal
  var IMAGE_PX = 1600;                 // Bilder vorher verkleinern
  var W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  /* ---------- Feste Texte (alle auf Deutsch) --------------- */

  var ONE_HINT = "OneNote-Notizbücher (.one) lassen sich nicht direkt lesen. " +
    "Exportiere die Seite in OneNote über Datei > Exportieren als Word oder mach einen Screenshot.";

  var MSG = {
    noFile: "Es kam gar keine Datei an. Versuch es noch einmal.",
    tooBig: "Diese Datei ist größer als 25 MB. Schick nur die Seiten, um die es wirklich geht, " +
      "oder mach Screenshots davon.",
    empty: "In der Datei war kein lesbarer Text – mach lieber Screenshots davon.",
    cut: "Der Text war sehr lang – ich habe nur den Anfang übernommen.",
    imagesLost: "Bilder im Dokument wurden nicht übernommen – mach davon bei Bedarf Screenshots.",
    noInflate: "Dein Browser kann Word-Dateien nicht entpacken. " +
      "Exportiere stattdessen als HTML oder mach Screenshots.",
    brokenDocx: "Diese Word-Datei konnte ich nicht öffnen. Speichere sie in Word noch einmal neu – " +
      "oder exportiere sie als PDF.",
    hugeDocx: "Diese Word-Datei ist zu groß gepackt, als dass ich sie öffnen könnte. " +
      "Exportiere sie als PDF oder mach Screenshots.",
    unreadable: "Diese Datei konnte ich nicht lesen. Mach einen Screenshot davon " +
      "oder speichere sie als PDF.",
    unknown: "Dieses Dateiformat kann ich nicht lesen. Speichere es als PDF oder als Textdatei – " +
      "oder mach einen Screenshot."
  };

  /* ---------- Was wir können und was nicht ----------------- */

  var EXT_KIND = {
    txt: "text", text: "text", md: "text", markdown: "text", csv: "text", tsv: "text",
    log: "text", json: "text", xml: "text", tex: "text", srt: "text", vtt: "text",
    html: "html", htm: "html", xhtml: "html",
    docx: "docx", docm: "docx",
    pdf: "pdf",
    jpg: "image", jpeg: "image", jpe: "image", png: "image", gif: "image",
    webp: "image", bmp: "image", avif: "image"
  };

  var LABELS = {
    text: "Textdatei", html: "Webseite (HTML)", docx: "Word-Dokument",
    pdf: "PDF-Dokument", image: "Bild", unknown: "Unbekannte Datei"
  };

  var OFFICE_HINT = {
    ppt: "PowerPoint-Folien kann ich nicht direkt lesen. Exportiere sie als PDF oder mach Screenshots.",
    xls: "Tabellen aus Excel kann ich nicht direkt lesen. Speichere das Tabellenblatt als CSV.",
    doc: "Das alte Word-Format (.doc) kann ich nicht öffnen. Speichere die Datei in Word als .docx oder als PDF."
  };

  /** Bekannte, aber nicht lesbare Formate: Bezeichnung + Tipp. */
  var UNSUPPORTED = {
    one: { label: "OneNote-Notizbuch", hint: ONE_HINT },
    onepkg: { label: "OneNote-Paket", hint: ONE_HINT },
    onetoc2: { label: "OneNote-Notizbuch", hint: ONE_HINT },
    doc: { label: "Word-Dokument (altes Format)", hint: OFFICE_HINT.doc },
    dot: { label: "Word-Vorlage (altes Format)", hint: OFFICE_HINT.doc },
    ppt: { label: "PowerPoint-Präsentation", hint: OFFICE_HINT.ppt },
    pptx: { label: "PowerPoint-Präsentation", hint: OFFICE_HINT.ppt },
    pps: { label: "PowerPoint-Vorführung", hint: OFFICE_HINT.ppt },
    ppsx: { label: "PowerPoint-Vorführung", hint: OFFICE_HINT.ppt },
    xls: { label: "Excel-Tabelle", hint: OFFICE_HINT.xls },
    xlsx: { label: "Excel-Tabelle", hint: OFFICE_HINT.xls },
    xlsm: { label: "Excel-Tabelle", hint: OFFICE_HINT.xls },
    odt: { label: "OpenDocument-Text", hint: "OpenDocument-Texte (.odt) kann ich nicht öffnen. Speichere sie als .docx oder als PDF." },
    ods: { label: "OpenDocument-Tabelle", hint: "OpenDocument-Tabellen (.ods) kann ich nicht öffnen. Speichere sie als CSV." },
    odp: { label: "OpenDocument-Präsentation", hint: "OpenDocument-Folien (.odp) kann ich nicht öffnen. Exportiere sie als PDF." },
    rtf: { label: "RTF-Dokument", hint: "Das Format .rtf lese ich nicht sauber. Speichere die Datei als .docx, .txt oder PDF." },
    pages: { label: "Pages-Dokument", hint: "Pages-Dateien kann ich nicht öffnen. Exportiere sie in Pages als Word oder PDF." },
    key: { label: "Keynote-Präsentation", hint: "Keynote-Dateien kann ich nicht öffnen. Exportiere sie als PDF." },
    numbers: { label: "Numbers-Tabelle", hint: "Numbers-Dateien kann ich nicht öffnen. Exportiere sie als CSV." },
    epub: { label: "E-Book", hint: "E-Books (.epub) kann ich nicht lesen. Exportiere die Seiten als PDF." },
    mobi: { label: "E-Book", hint: "E-Books (.mobi) kann ich nicht lesen. Exportiere die Seiten als PDF." },
    zip: { label: "Archiv", hint: "Archive packe ich nicht aus. Entpacke die Datei zuerst und lade die einzelnen Dateien hoch." },
    rar: { label: "Archiv", hint: "Archive packe ich nicht aus. Entpacke die Datei zuerst und lade die einzelnen Dateien hoch." },
    "7z": { label: "Archiv", hint: "Archive packe ich nicht aus. Entpacke die Datei zuerst und lade die einzelnen Dateien hoch." },
    svg: { label: "SVG-Grafik", hint: "SVG-Grafiken kann die KI nicht ansehen. Speichere das Bild als PNG oder mach einen Screenshot." },
    heic: { label: "iPhone-Foto (HEIC)", hint: "HEIC-Fotos kann der Browser nicht öffnen. Stelle am iPhone unter Einstellungen > Kamera > Formate auf „Maximal kompatibel“ – oder schick das Foto als JPG." },
    heif: { label: "Foto (HEIF)", hint: "HEIF-Fotos kann der Browser nicht öffnen. Speichere das Bild als JPG oder PNG." },
    exe: { label: "Programmdatei", hint: "Programmdateien lese ich nicht. Lade lieber dein Arbeitsblatt oder ein Foto hoch." }
  };

  var AUDIO_HINT = "Ton- und Videodateien kann ich nicht anhören. Schreib die wichtigsten Stellen auf oder mach Screenshots.";
  ["mp3", "m4a", "wav", "ogg", "oga", "aac", "flac", "mp4", "mov", "avi", "mkv", "webm", "wmv"]
    .forEach(function (ext) {
      UNSUPPORTED[ext] = { label: /mp3|m4a|wav|ogg|oga|aac|flac/.test(ext) ? "Tondatei" : "Video", hint: AUDIO_HINT };
    });

  /* =========================================================
     Kleine Helfer
     ========================================================= */

  function fileName(file) {
    var name = String((file && file.name) || "").trim();
    return name || "Datei";
  }

  function extOf(name) {
    var m = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/);
    return m ? m[1] : "";
  }

  /** Fehler mit einem Text, den man einer Schülerin/einem Schüler zeigen kann. */
  function fail(message) {
    var err = new Error(message);
    err.ngHint = message;
    return err;
  }

  function hintOf(err) {
    if (err && err.ngHint) return err.ngHint;
    return MSG.unreadable;
  }

  function toArray(list) {
    var out = [];
    if (!list) return out;
    for (var i = 0; i < list.length; i++) out.push(list[i]);
    return out;
  }

  /** Bild verkleinern – notfalls unverändert weiterreichen. */
  function shrink(file) {
    var U = NG.util;
    if (!U || typeof U.shrinkImage !== "function") return Promise.resolve(file);
    try {
      return Promise.resolve(U.shrinkImage(file, IMAGE_PX)).then(function (blob) {
        return blob || file;
      }, function () { return file; });
    } catch (e) {
      return Promise.resolve(file);
    }
  }

  /** Zeilen aufräumen: keine Leerzeichen am Zeilenende, keine großen Lücken. */
  function squash(text) {
    return String(text === null || text === undefined ? "" : text)
      .replace(/\r\n?/g, "\n")
      .replace(/\u00A0/g, " ")
      .split("\n")
      .map(function (line) {
        var trimmed = line.replace(/[ \t]+$/g, "");
        // leere Überschriften oder Listenpunkte ohne Inhalt bringen nichts
        if (/^\s*#{1,6}\s*$/.test(trimmed) || /^\s*-\s*$/.test(trimmed)) return "";
        return trimmed;
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  var ENTITIES = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", shy: "",
    ndash: "–", mdash: "—", hellip: "…", bull: "•", middot: "·",
    laquo: "«", raquo: "»", bdquo: "„", ldquo: "“", rdquo: "”",
    sbquo: "‚", lsquo: "‘", rsquo: "’", euro: "€", deg: "°",
    auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
    times: "×", minus: "−", plusmn: "±", sup2: "²", sup3: "³", frac12: "½"
  };

  function decodeEntities(text) {
    return String(text === null || text === undefined ? "" : text)
      .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]{1,10});/gi, function (all, code) {
        if (code.charAt(0) === "#") {
          var hex = code.charAt(1) === "x" || code.charAt(1) === "X";
          var num = hex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
          if (!isFinite(num) || num <= 0 || num > 0x10FFFF) return all;
          try { return String.fromCodePoint(num); } catch (e) { return all; }
        }
        if (Object.prototype.hasOwnProperty.call(ENTITIES, code)) return ENTITIES[code];
        var lower = code.toLowerCase();
        return Object.prototype.hasOwnProperty.call(ENTITIES, lower) ? ENTITIES[lower] : all;
      });
  }

  /* =========================================================
     Dateityp erkennen (Endung UND MIME-Typ)
     ========================================================= */

  function kindFromMime(mime) {
    if (!mime) return null;
    if (mime === "image/svg+xml" || mime === "image/heic" || mime === "image/heif") return null;
    if (mime.indexOf("image/") === 0) return "image";
    if (mime === "application/pdf" || mime === "application/x-pdf") return "pdf";
    if (mime.indexOf("wordprocessingml.document") >= 0) return "docx";
    if (mime === "text/html" || mime === "application/xhtml+xml") return "html";
    if (mime.indexOf("text/") === 0) return "text";
    if (mime === "application/json" || mime === "application/xml") return "text";
    return null;
  }

  function mimeUnsupported(mime) {
    if (!mime) return null;
    if (mime.indexOf("presentationml") >= 0 || mime.indexOf("ms-powerpoint") >= 0) {
      return { label: "PowerPoint-Präsentation", hint: OFFICE_HINT.ppt };
    }
    if (mime.indexOf("spreadsheetml") >= 0 || mime.indexOf("ms-excel") >= 0) {
      return { label: "Excel-Tabelle", hint: OFFICE_HINT.xls };
    }
    if (mime === "application/msword") return { label: "Word-Dokument (altes Format)", hint: OFFICE_HINT.doc };
    if (mime === "image/svg+xml") return UNSUPPORTED.svg;
    if (mime === "image/heic" || mime === "image/heif") return UNSUPPORTED.heic;
    if (mime.indexOf("audio/") === 0) return { label: "Tondatei", hint: AUDIO_HINT };
    if (mime.indexOf("video/") === 0) return { label: "Video", hint: AUDIO_HINT };
    if (mime === "application/zip" || mime === "application/x-zip-compressed") return UNSUPPORTED.zip;
    return null;
  }

  /**
   * Was ist das für eine Datei?
   * @returns {{kind:string,label:string,supported:boolean,hint:string}}
   */
  function describe(file) {
    try {
      if (!file) return { kind: "unknown", label: LABELS.unknown, supported: false, hint: MSG.noFile };

      var ext = extOf(fileName(file));
      var mime = String((file && file.type) || "").toLowerCase().split(";")[0].trim();

      // Bekannte Problemformate haben immer Vorrang – auch wenn der MIME-Typ etwas anderes behauptet.
      var known = Object.prototype.hasOwnProperty.call(UNSUPPORTED, ext) ? UNSUPPORTED[ext] : null;
      var kind = known ? "unknown" : (EXT_KIND[ext] || kindFromMime(mime) || "unknown");

      if (kind !== "unknown") {
        var ok = {
          kind: kind,
          label: LABELS[kind] || LABELS.unknown,
          supported: true,
          hint: ""
        };
        if (typeof file.size === "number" && file.size > MAX_BYTES) {
          ok.supported = false;
          ok.hint = MSG.tooBig;
        }
        return ok;
      }

      var info = known || mimeUnsupported(mime) || { label: LABELS.unknown, hint: MSG.unknown };
      return { kind: "unknown", label: info.label, supported: false, hint: info.hint };
    } catch (e) {
      return { kind: "unknown", label: LABELS.unknown, supported: false, hint: MSG.unknown };
    }
  }

  /* =========================================================
     Rohdaten lesen
     ========================================================= */

  function toArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      if (file && typeof file.arrayBuffer === "function") {
        file.arrayBuffer().then(resolve, function () { reject(fail(MSG.unreadable)); });
        return;
      }
      if (typeof global.FileReader !== "function") { reject(fail(MSG.unreadable)); return; }
      var reader = new global.FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(fail(MSG.unreadable)); };
      try { reader.readAsArrayBuffer(file); } catch (e) { reject(fail(MSG.unreadable)); }
    });
  }

  function decodeWith(bytes, label) {
    if (typeof global.TextDecoder !== "function") return null;
    try { return new global.TextDecoder(label).decode(bytes); } catch (e) { return null; }
  }

  function decodeUtf8(bytes) {
    var text = decodeWith(bytes, "utf-8");
    if (text !== null) return text;
    // Notlösung ohne TextDecoder: Byte für Byte, Umlaute nachträglich retten
    var raw = "";
    for (var i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(raw)); } catch (e) { return raw; }
  }

  /** Text lesen und dabei die Zeichenkodierung erraten (UTF-8, sonst Windows-1252). */
  function readTextFile(file) {
    return toArrayBuffer(file).then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      var text = decodeWith(bytes, "utf-8");
      if (text === null || text.indexOf("\uFFFD") >= 0) {
        var alt = decodeWith(bytes, "windows-1252");
        if (alt !== null && (text === null || alt.indexOf("\uFFFD") < 0)) text = alt;
      }
      if (text === null) text = decodeUtf8(bytes);
      return text.replace(/^\uFEFF/, "");
    }, function () {
      var U = NG.util;
      if (U && typeof U.readAsText === "function") {
        return U.readAsText(file).then(function (t) { return String(t || "").replace(/^\uFEFF/, ""); });
      }
      throw fail(MSG.unreadable);
    });
  }

  /* =========================================================
     HTML lesen
     ========================================================= */

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, IFRAME: 1,
    OBJECT: 1, EMBED: 1, HEAD: 1, META: 1, LINK: 1, TITLE: 1,
    INPUT: 1, SELECT: 1, TEXTAREA: 1, AUDIO: 1, VIDEO: 1
  };

  var BLOCK2 = {
    P: 1, TABLE: 1, BLOCKQUOTE: 1, PRE: 1, UL: 1, OL: 1, SECTION: 1,
    ARTICLE: 1, MAIN: 1, FIGURE: 1, FORM: 1
  };

  var BLOCK1 = {
    DIV: 1, DT: 1, DD: 1, DL: 1, HEADER: 1, FOOTER: 1, ASIDE: 1, NAV: 1,
    ADDRESS: 1, FIGCAPTION: 1, CAPTION: 1, THEAD: 1, TBODY: 1, TFOOT: 1,
    FIELDSET: 1, LEGEND: 1, LABEL: 1
  };

  function parseHtml(html) {
    if (typeof global.DOMParser !== "function") return null;
    try {
      var doc = new global.DOMParser().parseFromString(String(html || ""), "text/html");
      return doc && (doc.body || doc.documentElement) ? doc : null;
    } catch (e) {
      return null;
    }
  }

  function dropNoise(doc) {
    ["script", "style", "noscript", "template", "svg", "iframe", "object", "embed"]
      .forEach(function (tag) {
        toArray(doc.getElementsByTagName(tag)).forEach(function (node) {
          if (node && node.parentNode) node.parentNode.removeChild(node);
        });
      });
  }

  /** Sammelt Ausgabestücke und merkt sich offene Zeilenumbrüche. */
  function makeSink() {
    var parts = [];
    var breaks = 0;
    var started = false;
    return {
      text: function (value) {
        if (!value) return;
        var solid = String(value).trim().length > 0;
        if (!started && !solid) return;
        if (!solid && breaks > 0) return;
        if (breaks > 0) { parts.push(breaks > 1 ? "\n\n" : "\n"); breaks = 0; }
        parts.push(value);
        started = true;
      },
      br: function (n) { if (started) breaks = Math.max(breaks, n || 1); },
      done: function () { return parts.join(""); }
    };
  }

  function inlineText(node) {
    return String((node && node.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function rowText(tr) {
    var cells = [];
    var kids = tr.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
      var cell = kids[i];
      if (!cell || cell.nodeType !== 1) continue;
      var tag = String(cell.tagName || "").toUpperCase();
      if (tag !== "TD" && tag !== "TH") continue;
      cells.push(inlineText(cell));
    }
    return cells.join(" | ");
  }

  function walkChildren(node, sink, inPre, depth) {
    var kids = node.childNodes;
    if (!kids) return;
    for (var i = 0; i < kids.length; i++) walk(kids[i], sink, inPre, depth + 1);
  }

  function walk(node, sink, inPre, depth) {
    if (!node || depth > 400) return;
    if (node.nodeType === 3) {
      var value = String(node.nodeValue || "");
      sink.text(inPre ? value : value.replace(/\s+/g, " "));
      return;
    }
    if (node.nodeType !== 1) return;

    var tag = String(node.tagName || "").toUpperCase();
    if (SKIP_TAGS[tag]) return;

    if (tag === "BR") { sink.br(1); return; }
    if (tag === "HR") { sink.br(1); sink.text("---"); sink.br(1); return; }
    if (tag === "IMG") {
      var alt = String(node.getAttribute && node.getAttribute("alt") || "").trim();
      if (alt) { sink.br(1); sink.text("[Bild: " + alt + "]"); sink.br(1); }
      return;
    }

    var heading = /^H([1-6])$/.exec(tag);
    if (heading) {
      sink.br(2);
      sink.text(new Array(Number(heading[1]) + 1).join("#") + " ");
      walkChildren(node, sink, false, depth);
      sink.br(2);
      return;
    }
    if (tag === "LI") {
      sink.br(1);
      sink.text("- ");
      walkChildren(node, sink, inPre, depth);
      sink.br(1);
      return;
    }
    if (tag === "TR") {
      sink.br(1);
      sink.text(rowText(node));
      sink.br(1);
      return;
    }
    if (tag === "PRE") {
      sink.br(2);
      sink.text(String(node.textContent || ""));
      sink.br(2);
      return;
    }

    var level = BLOCK2[tag] ? 2 : (BLOCK1[tag] ? 1 : 0);
    if (level) sink.br(level);
    walkChildren(node, sink, inPre, depth);
    if (level) sink.br(level);
  }

  function collectImages(doc) {
    var out = [];
    var seen = {};
    toArray(doc.getElementsByTagName("img")).forEach(function (img) {
      if (!img || !img.getAttribute || out.length >= 60) return;
      // OneNote legt das große Bild in data-fullres-src ab.
      var src = img.getAttribute("data-fullres-src") || img.getAttribute("src") ||
        img.getAttribute("data-src") || img.getAttribute("data-original") || "";
      src = String(src).trim();
      if (!src || seen[src]) return;
      seen[src] = true;
      out.push({ src: src, alt: String(img.getAttribute("alt") || "").trim() });
    });
    return out;
  }

  /** Bilder ohne DOM finden (Notlösung, wenn DOMParser fehlt). */
  function imagesFromSource(html) {
    var out = [];
    var seen = {};
    var re = /<img\b[^>]*>/gi;
    var match;
    while ((match = re.exec(String(html || ""))) !== null && out.length < 60) {
      var tag = match[0];
      var src = attrFromTag(tag, "data-fullres-src") || attrFromTag(tag, "src") ||
        attrFromTag(tag, "data-src") || "";
      if (!src || seen[src]) continue;
      seen[src] = true;
      out.push({ src: src, alt: attrFromTag(tag, "alt") || "" });
    }
    return out;
  }

  function attrFromTag(tag, name) {
    var re = new RegExp("\\b" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i");
    var m = re.exec(tag);
    if (!m) return "";
    return decodeEntities(m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4] || "")).trim();
  }

  /** Notlösung ohne DOM: Tags durch Umbrüche ersetzen. */
  function stripTagsToText(html) {
    var s = String(html || "");
    s = s.replace(/<!--[\s\S]*?-->/g, "");
    s = s.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, "");
    s = s.replace(/<br\b[^>]*>/gi, "\n");
    s = s.replace(/<h([1-6])\b[^>]*>/gi, function (all, n) {
      return "\n\n" + new Array(Number(n) + 1).join("#") + " ";
    });
    s = s.replace(/<\/h[1-6]\s*>/gi, "\n\n");
    s = s.replace(/<li\b[^>]*>/gi, "\n- ");
    s = s.replace(/<\/li\s*>/gi, "\n");
    s = s.replace(/<\/t[dh]\s*>/gi, " | ");
    s = s.replace(/<\/tr\s*>/gi, "\n");
    s = s.replace(/<\/(p|div|section|article|header|footer|blockquote|pre|ul|ol|dl|dt|dd|figure|figcaption|address|table|caption)\s*>/gi, "\n\n");
    s = s.replace(/<[^>]+>/g, "");
    s = decodeEntities(s);
    s = s.split("\n").map(function (line) {
      return line.replace(/[ \t]{2,}/g, " ").replace(/\s*\|\s*$/, "").trim();
    }).join("\n");
    return squash(s);
  }

  /**
   * HTML in lesbaren Text und die enthaltenen Bilder zerlegen.
   * Kommt auch mit OneNote-Seiten zurecht (viele verschachtelte div).
   * @returns {{text:string, images:Array<{src:string, alt:string}>}}
   */
  function htmlToBlocks(html) {
    var raw = String(html === null || html === undefined ? "" : html);
    try {
      var doc = parseHtml(raw);
      if (!doc) return { text: stripTagsToText(raw), images: imagesFromSource(raw) };

      dropNoise(doc);
      var images = collectImages(doc);
      var sink = makeSink();
      walk(doc.body || doc.documentElement, sink, false, 0);
      var text = squash(sink.done());

      var title = String(doc.title || "").trim();
      if (title && text.indexOf(title) !== 0 && text.indexOf("# " + title) !== 0) {
        text = squash("# " + title + "\n\n" + text);
      }
      return { text: text, images: images };
    } catch (e) {
      try {
        return { text: stripTagsToText(raw), images: imagesFromSource(raw) };
      } catch (e2) {
        return { text: "", images: [] };
      }
    }
  }

  function htmlToText(html) {
    try {
      return htmlToBlocks(html).text;
    } catch (e) {
      return "";
    }
  }

  /* =========================================================
     .docx = ZIP: selbst öffnen und auspacken
     ========================================================= */

  function sourceStream(data) {
    if (typeof global.Response === "function") {
      try {
        var body = new global.Response(data).body;
        if (body && typeof body.pipeThrough === "function") return body;
      } catch (e) { /* nächster Versuch */ }
    }
    if (typeof global.ReadableStream !== "function") throw fail(MSG.noInflate);
    return new global.ReadableStream({
      start: function (controller) { controller.enqueue(data); controller.close(); }
    });
  }

  function drain(stream) {
    var reader = stream.getReader();
    var chunks = [];
    var total = 0;
    function step() {
      return reader.read().then(function (res) {
        if (res.done) {
          var out = new Uint8Array(total);
          var at = 0;
          chunks.forEach(function (chunk) { out.set(chunk, at); at += chunk.length; });
          return out;
        }
        chunks.push(res.value);
        total += res.value.length;
        return step();
      });
    }
    return step();
  }

  /** Rohes Deflate auspacken – ohne Bibliothek, mit DecompressionStream. */
  function inflateRaw(data) {
    if (typeof global.DecompressionStream !== "function") return Promise.reject(fail(MSG.noInflate));
    return Promise.resolve().then(function () {
      var stream = sourceStream(data).pipeThrough(new global.DecompressionStream("deflate-raw"));
      return drain(stream);
    }).catch(function (err) {
      throw (err && err.ngHint) ? err : fail(MSG.brokenDocx);
    });
  }

  /**
   * ZIP-Verzeichnis lesen: End-of-Central-Directory suchen, dann alle Einträge.
   * Gibt ein kleines Objekt mit find()/read() zurück.
   */
  function readZip(buffer) {
    var bytes = new Uint8Array(buffer);
    var view = new DataView(buffer);
    var len = bytes.length;
    if (len < 22) throw fail(MSG.brokenDocx);

    // Von hinten nach der Signatur suchen; der Kommentar am Ende darf bis 65535 Bytes lang sein.
    var eocd = -1;
    var min = Math.max(0, len - 22 - 65535);
    for (var i = len - 22; i >= min; i--) {
      if (view.getUint32(i, true) !== 0x06054b50) continue;
      var commentLen = view.getUint16(i + 20, true);
      if (i + 22 + commentLen === len) { eocd = i; break; }
      if (eocd < 0) eocd = i;            // Notnagel, falls die Kommentarlänge nicht passt
    }
    if (eocd < 0) throw fail(MSG.brokenDocx);

    var count = view.getUint16(eocd + 10, true);
    var cdOffset = view.getUint32(eocd + 16, true);
    if (cdOffset === 0xFFFFFFFF || count === 0xFFFF) throw fail(MSG.hugeDocx);
    if (cdOffset + 4 > len) throw fail(MSG.brokenDocx);

    var entries = [];
    var p = cdOffset;
    for (var n = 0; n < count && p + 46 <= len; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      var nameLen = view.getUint16(p + 28, true);
      var extraLen = view.getUint16(p + 30, true);
      var cmtLen = view.getUint16(p + 32, true);
      entries.push({
        name: decodeUtf8(bytes.subarray(p + 46, p + 46 + nameLen)),
        method: view.getUint16(p + 10, true),
        compSize: view.getUint32(p + 20, true),
        rawSize: view.getUint32(p + 24, true),
        offset: view.getUint32(p + 42, true)
      });
      p += 46 + nameLen + extraLen + cmtLen;
    }
    if (!entries.length) throw fail(MSG.brokenDocx);

    function find(wanted) {
      var key = String(wanted).toLowerCase();
      for (var k = 0; k < entries.length; k++) {
        var name = entries[k].name.replace(/^\//, "").toLowerCase();
        if (name === key) return entries[k];
      }
      return null;
    }

    function hasMedia() {
      return entries.some(function (e) { return /^word\/media\//i.test(e.name.replace(/^\//, "")); });
    }

    /** Einen Eintrag auspacken. Die echten Längen stehen im LOCAL header. */
    function read(entry) {
      return Promise.resolve().then(function () {
        var off = entry.offset;
        if (off + 30 > len || view.getUint32(off, true) !== 0x04034b50) throw fail(MSG.brokenDocx);
        var method = view.getUint16(off + 8, true);
        if (method !== 0 && method !== 8) method = entry.method;
        var localNameLen = view.getUint16(off + 26, true);
        var localExtraLen = view.getUint16(off + 28, true);
        var start = off + 30 + localNameLen + localExtraLen;
        if (start > len) throw fail(MSG.brokenDocx);

        // Ohne Größenangabe (Data Descriptor) bis zum Verzeichnis lesen.
        var end = entry.compSize
          ? Math.min(len, start + entry.compSize)
          : Math.min(len, cdOffset > start ? cdOffset : len);

        var data = bytes.slice(start, end);
        if (method === 0) return data;
        if (method !== 8) throw fail(MSG.brokenDocx);
        return inflateRaw(data);
      });
    }

    return { entries: entries, find: find, hasMedia: hasMedia, read: read };
  }

  /* ---------- Word-XML in Text verwandeln ------------------ */

  function localNameOf(node) {
    return String(node.localName || String(node.nodeName || "").replace(/^.*:/, ""));
  }

  function firstChildNamed(node, local) {
    var kids = node.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].nodeType === 1 && localNameOf(kids[i]) === local) return kids[i];
    }
    return null;
  }

  function wordAttr(node, name) {
    var val = "";
    if (node.getAttributeNS) {
      try { val = node.getAttributeNS(W_NS, name) || ""; } catch (e) { val = ""; }
    }
    if (!val && node.getAttribute) val = node.getAttribute("w:" + name) || node.getAttribute(name) || "";
    return String(val || "");
  }

  /** Überschriften erkennen: „Heading2“ oder – bei deutschem Word – „berschrift2“. */
  function headingLevel(paragraph) {
    var pPr = firstChildNamed(paragraph, "pPr");
    if (!pPr) return 0;
    var style = firstChildNamed(pPr, "pStyle");
    if (!style) return 0;
    var val = wordAttr(style, "val");
    var m = /(?:heading|berschrift)[\s-]*([1-6])/i.exec(val);
    if (m) return Number(m[1]);
    return /^(?:heading|berschrift)$/i.test(val.trim()) ? 1 : 0;
  }

  function runText(node) {
    var out = "";
    var kids = node.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
      var child = kids[i];
      if (!child || child.nodeType !== 1) continue;
      var local = localNameOf(child);
      if (local === "t") out += String(child.textContent || "");
      else if (local === "tab") out += "\t";
      else if (local === "br" || local === "cr") out += "\n";
      else if (local === "noBreakHyphen") out += "-";
      else if (local === "instrText" || local === "delText") continue;   // Feldbefehle und gelöschter Text
      else out += runText(child);
    }
    return out;
  }

  function paragraphNodes(doc) {
    var list = [];
    if (doc.getElementsByTagNameNS) {
      try { list = toArray(doc.getElementsByTagNameNS(W_NS, "p")); } catch (e) { list = []; }
    }
    if (!list.length) list = toArray(doc.getElementsByTagName("w:p"));
    return list;
  }

  function paragraphToLine(paragraph) {
    var text = runText(paragraph).replace(/[ \t]+$/g, "");
    if (!text.trim()) return "";
    var level = headingLevel(paragraph);
    return level ? new Array(level + 1).join("#") + " " + text.trim() : text;
  }

  /** Notlösung, falls kein DOMParser da ist oder das XML nicht sauber ist. */
  function docxTextFallback(xml) {
    var chunks = String(xml || "").split(/<\/w:p>/i);
    var lines = chunks.map(function (chunk) {
      var level = 0;
      var style = /<w:pStyle[^>]*\bw:val\s*=\s*"([^"]*)"/i.exec(chunk);
      if (style) {
        var m = /(?:heading|berschrift)[\s-]*([1-6])/i.exec(style[1]);
        if (m) level = Number(m[1]);
        else if (/^(?:heading|berschrift)$/i.test(style[1].trim())) level = 1;
      }
      var cleaned = chunk
        .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/gi, "")
        .replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/gi, "");

      var parts = [];
      var re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:(?:br|cr)\b[^>]*\/?>/gi;
      var match;
      while ((match = re.exec(cleaned)) !== null) {
        if (match[1] !== undefined) parts.push(decodeEntities(match[1]));
        else if (/^<w:tab/i.test(match[0])) parts.push("\t");
        else parts.push("\n");
      }
      var text = parts.join("").replace(/[ \t]+$/g, "");
      if (!text.trim()) return "";
      return level ? new Array(level + 1).join("#") + " " + text.trim() : text;
    });
    return lines.join("\n");
  }

  function docxXmlToText(xml) {
    if (typeof global.DOMParser === "function") {
      try {
        var doc = new global.DOMParser().parseFromString(String(xml || ""), "application/xml");
        var broken = doc && doc.getElementsByTagName && doc.getElementsByTagName("parsererror").length;
        if (doc && !broken) {
          var paragraphs = paragraphNodes(doc);
          if (paragraphs.length) {
            return paragraphs.map(paragraphToLine).join("\n");
          }
        }
      } catch (e) { /* unten weiter mit der Notlösung */ }
    }
    return docxTextFallback(xml);
  }

  function readDocx(file, name) {
    return toArrayBuffer(file).then(function (buffer) {
      var zip = readZip(buffer);
      var entry = zip.find("word/document.xml");
      if (!entry) throw fail(MSG.brokenDocx);
      var withImages = zip.hasMedia();
      return zip.read(entry).then(function (bytes) {
        var text = docxXmlToText(decodeUtf8(bytes));
        return textResult(name, text, [withImages ? MSG.imagesLost : ""]);
      });
    });
  }

  /* =========================================================
     extract(): Datei -> Text, Bild oder Dokument
     ========================================================= */

  function unsupportedResult(name, warning) {
    return { kind: "unsupported", name: name, warning: warning || MSG.unknown };
  }

  function textResult(name, text, warnings) {
    var value = squash(text);
    var notes = (warnings || []).filter(Boolean);
    if (value.length > MAX_CHARS) {
      value = value.slice(0, MAX_CHARS);
      notes.push(MSG.cut);
    }
    if (!value) notes.push(MSG.empty);
    var res = { kind: "text", name: name, text: value };
    if (notes.length) res.warning = notes.join(" ");
    return res;
  }

  function readImage(file, name) {
    return shrink(file).then(function (blob) {
      return { kind: "image", name: name, blob: blob || file };
    });
  }

  function readPlain(file, name) {
    return readTextFile(file).then(function (text) {
      return textResult(name, text, []);
    });
  }

  function readHtmlFile(file, name) {
    return readTextFile(file).then(function (raw) {
      var blocks = htmlToBlocks(raw);
      return textResult(name, blocks.text, [blocks.images.length ? MSG.imagesLost : ""]);
    });
  }

  /**
   * Datei einlesen. Wirft nie – im Zweifel kommt ein Hinweis zurück.
   * @returns {Promise<{kind:string,name:string,text?:string,blob?:Blob,warning?:string}>}
   */
  function extract(file) {
    var name = fileName(file);
    return Promise.resolve().then(function () {
      if (!file) return unsupportedResult(name, MSG.noFile);
      if (typeof file.size === "number" && file.size > MAX_BYTES) {
        return unsupportedResult(name, MSG.tooBig);
      }

      var info = describe(file);
      if (info.kind === "image") return readImage(file, name);
      if (info.kind === "pdf") return { kind: "document", name: name, blob: file };
      if (info.kind === "text") return readPlain(file, name);
      if (info.kind === "html") return readHtmlFile(file, name);
      if (info.kind === "docx") return readDocx(file, name);
      return unsupportedResult(name, info.hint);
    }).catch(function (err) {
      return unsupportedResult(name, hintOf(err));
    });
  }

  NG.importers = {
    ACCEPT: ACCEPT,
    describe: describe,
    extract: extract,
    htmlToText: htmlToText,
    htmlToBlocks: htmlToBlocks
  };
})(window);
