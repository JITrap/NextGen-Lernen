/* =========================================================
   NextGen Lernen – KI-Anbindung
   Drei Wege, dieselbe Schnittstelle:
     1. "claude"    – Seite läuft als Claude-Artifact (kein Schlüssel nötig)
     2. "anthropic" – direkter Aufruf der Claude-API mit eigenem API-Key
     3. "proxy"     – eigener Server als Vermittler (Schlüssel bleibt geheim)
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});
  var U = NG.util;

  var API_URL = "https://api.anthropic.com/v1/messages";
  var API_VERSION = "2023-06-01";

  var sampleFn = null;        // claude.use("sample")
  var sampleLimits = null;
  var initialized = false;
  var initPromise = null;
  var readyListeners = [];

  var MODELS = [
    { id: "claude-opus-5", label: "Claude Opus 5 – am stärksten" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5 – schnell & günstig" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 – am schnellsten" }
  ];

  /* ---------- Start ---------------------------------------- */

  function init() {
    if (initPromise) return initPromise;
    initPromise = new Promise(function (resolve) {
      if (!global.claude || typeof global.claude.use !== "function") {
        initialized = true;
        return resolve(status());
      }
      global.claude.use("sample").then(function (fn) {
        sampleFn = typeof fn === "function" ? fn : null;
        if (sampleFn && sampleFn.limits) {
          return sampleFn.limits().then(function (lim) { sampleLimits = lim; }).catch(function () { });
        }
      }).catch(function () { sampleFn = null; })
        .then(function () {
          initialized = true;
          resolve(status());
          readyListeners.forEach(function (fn) { try { fn(status()); } catch (e) { } });
          readyListeners = [];
        });
    });
    return initPromise;
  }

  function onReady(fn) {
    if (initialized) fn(status());
    else readyListeners.push(fn);
  }

  /* ---------- Zustand -------------------------------------- */

  function configured() {
    var cfg = NG.store.getSetting("ai", {}) || {};
    var choice = cfg.provider || "auto";
    if (choice === "claude") return sampleFn ? "claude" : null;
    if (choice === "anthropic") return cfg.apiKey ? "anthropic" : null;
    if (choice === "proxy") return cfg.proxyUrl ? "proxy" : null;
    if (sampleFn) return "claude";
    if (cfg.apiKey) return "anthropic";
    if (cfg.proxyUrl) return "proxy";
    return null;
  }

  function status() {
    var p = configured();
    var labels = {
      claude: "Claude (über diese Seite)",
      anthropic: "Claude-API mit eigenem Schlüssel",
      proxy: "Eigener Server"
    };
    return {
      provider: p,
      ready: !!p,
      initialized: initialized,
      canImages: p === "claude" ? !!(sampleLimits && sampleLimits.images) : !!p,
      label: p ? labels[p] : "Nicht eingerichtet",
      reason: p ? "" : "Trage in den Einstellungen einen API-Schlüssel ein – oder öffne die Seite als Claude-Artifact."
    };
  }

  /* ---------- Fehlermeldungen ------------------------------ */

  var ERROR_TEXT = {
    not_granted: "Claude darf für diese Seite nicht genutzt werden. Erlaube den Zugriff und versuche es erneut.",
    sampling_disabled: "Für dieses Konto ist Claude hier nicht verfügbar.",
    rate_limited: "Zu viele Anfragen in kurzer Zeit. Warte einen Moment und versuche es noch einmal.",
    session_expired: "Bitte melde dich erneut an.",
    image_rejected: "Das Bild konnte nicht gelesen werden. Versuche ein anderes Format (JPG oder PNG) oder eine kleinere Datei.",
    images_unavailable: "Bilder können hier nicht gesendet werden. Tippe die Aufgabe als Text ein.",
    refused: "Claude hat diese Anfrage abgelehnt. Formuliere sie anders.",
    empty_completion: "Es kam keine Antwort zurück. Frage etwas kürzer oder konkreter.",
    invalid_json: "Die Antwort hatte nicht das erwartete Format. Versuche es noch einmal.",
    prompt_too_large: "Die Anfrage ist zu lang. Kürze den Text oder die Auswahl.",
    cancelled: "Abgebrochen.",
    upstream_error: "Verbindungsproblem. Bitte noch einmal versuchen."
  };

  function friendly(err) {
    if (!err) return "Unbekannter Fehler.";
    if (err.code && ERROR_TEXT[err.code]) return ERROR_TEXT[err.code];
    if (err.status === 401) return "Der API-Schlüssel wurde nicht akzeptiert. Prüfe ihn in den Einstellungen.";
    if (err.status === 429) return ERROR_TEXT.rate_limited;
    if (err.status === 400) return "Die Anfrage war fehlerhaft: " + (err.message || "");
    if (err.status >= 500) return "Der Dienst ist gerade nicht erreichbar. Bitte später erneut versuchen.";
    if (err.name === "AbortError" || err.code === "cancelled") return ERROR_TEXT.cancelled;
    if (err.message && /Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
      return "Keine Verbindung zur Claude-API. Prüfe die Internetverbindung – oder nutze einen eigenen Server (Proxy), " +
        "falls der Browser die Anfrage blockiert.";
    }
    return err.message || String(err);
  }

  /* ---------- JSON aus Text lesen -------------------------- */

  function parseJsonLoose(text) {
    if (!text) throw { code: "invalid_json", message: "Leere Antwort" };
    var candidates = [];
    candidates.push(text.trim());
    var fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) candidates.push(fence[1].trim());
    var first = text.search(/[[{]/);
    var last = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
    for (var i = 0; i < candidates.length; i++) {
      try { return JSON.parse(candidates[i]); } catch (e) { /* nächster Versuch */ }
    }
    throw { code: "invalid_json", message: "Antwort enthielt kein gültiges JSON.", text: text };
  }

  /* ---------- Bilder --------------------------------------- */

  function blobToBase64(blob) {
    return U.readAsDataURL(blob).then(function (dataUrl) {
      var comma = String(dataUrl).indexOf(",");
      return {
        media_type: (String(dataUrl).match(/^data:([^;]+)/) || [])[1] || blob.type || "image/jpeg",
        data: String(dataUrl).slice(comma + 1)
      };
    });
  }

  /* ---------- Weg 1: Claude-Artifact ----------------------- */

  function runSample(opts) {
    var turns = [];
    if (opts.system) turns.push({ role: "user", content: opts.system });
    if (opts.turns && opts.turns.length) {
      opts.turns.forEach(function (t) { turns.push({ role: t.role, content: t.content }); });
    } else {
      turns.push({ role: "user", content: opts.prompt || "" });
    }
    if (turns[turns.length - 1].role !== "user") turns.push({ role: "user", content: "Bitte weiter." });

    var options = {
      modelTier: opts.tier || "default",
      cache: false
    };
    if (opts.onText) options.onText = opts.onText;
    if (opts.signal) options.signal = opts.signal;
    if (opts.images && opts.images.length) options.images = opts.images;

    var call = opts.json ? sampleFn.json(turns, options) : sampleFn(turns, options);
    return call.then(function (res) {
      if (opts.json) return { text: JSON.stringify(res), data: res, truncated: false };
      return { text: res.text, truncated: !!res.truncated };
    });
  }

  /* ---------- Weg 2 & 3: HTTP-Aufruf ----------------------- */

  function buildMessages(opts) {
    return Promise.all((opts.images || []).map(blobToBase64)).then(function (imgs) {
      var msgs = [];
      if (opts.turns && opts.turns.length) {
        opts.turns.forEach(function (t) { msgs.push({ role: t.role, content: t.content }); });
      } else {
        msgs.push({ role: "user", content: opts.prompt || "" });
      }
      if (imgs.length) {
        var lastUser = null;
        for (var i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === "user") { lastUser = i; break; } }
        if (lastUser === null) { msgs.push({ role: "user", content: "" }); lastUser = msgs.length - 1; }
        var blocks = imgs.map(function (img) {
          return { type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } };
        });
        blocks.push({ type: "text", text: String(msgs[lastUser].content || "Schau dir die Bilder an.") });
        msgs[lastUser] = { role: "user", content: blocks };
      }
      return msgs;
    });
  }

  function effortFor(tier) {
    if (tier === "quick") return "low";
    if (tier === "complex") return "high";
    return "medium";
  }

  function runHttp(opts, provider) {
    var cfg = NG.store.getSetting("ai", {}) || {};
    var model = cfg.model || "claude-opus-5";

    return buildMessages(opts).then(function (messages) {
      var body = {
        model: model,
        max_tokens: opts.maxTokens || 12000,
        stream: true,
        messages: messages,
        output_config: { effort: effortFor(opts.tier) }
      };
      if (opts.system) body.system = opts.system;

      var url, headers;
      if (provider === "proxy") {
        url = cfg.proxyUrl;
        headers = { "Content-Type": "application/json" };
      } else {
        url = API_URL;
        headers = {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": API_VERSION,
          "anthropic-dangerous-direct-browser-access": "true"
        };
      }

      return fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
        signal: opts.signal
      }).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            var msg = txt;
            try { var j = JSON.parse(txt); msg = (j.error && j.error.message) || txt; } catch (e) { }
            throw { status: res.status, message: msg };
          });
        }
        return readStream(res, opts.onText);
      });
    }).then(function (text) {
      if (opts.json) return { text: text, data: parseJsonLoose(text), truncated: false };
      return { text: text, truncated: false };
    });
  }

  /** Server-Sent-Events der Messages-API auslesen. */
  function readStream(res, onText) {
    if (!res.body || !res.body.getReader) {
      return res.json().then(function (data) {
        return (data.content || []).filter(function (b) { return b.type === "text"; })
          .map(function (b) { return b.text; }).join("");
      });
    }
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var text = "";

    function pump() {
      return reader.read().then(function (chunk) {
        if (chunk.done) return text;
        buffer += decoder.decode(chunk.value, { stream: true });
        var parts = buffer.split("\n\n");
        buffer = parts.pop();
        parts.forEach(function (part) {
          part.split("\n").forEach(function (line) {
            if (line.indexOf("data:") !== 0) return;
            var payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") return;
            var evt;
            try { evt = JSON.parse(payload); } catch (e) { return; }
            if (evt.type === "content_block_delta" && evt.delta && evt.delta.type === "text_delta") {
              text += evt.delta.text;
              if (onText) onText({ text: text, delta: evt.delta.text });
            } else if (evt.type === "error") {
              throw { message: (evt.error && evt.error.message) || "Streaming-Fehler" };
            }
          });
        });
        return pump();
      });
    }
    return pump();
  }

  /* ---------- Öffentlicher Aufruf -------------------------- */

  /**
   * @param {{system?:string, prompt?:string, turns?:Array, images?:Blob[],
   *          onText?:Function, signal?:AbortSignal, tier?:string,
   *          json?:boolean, maxTokens?:number}} opts
   */
  function run(opts) {
    opts = opts || {};
    var provider = configured();
    if (!provider) {
      return Promise.reject({ code: "not_configured", message: status().reason });
    }
    var started = Date.now();
    var call = provider === "claude" ? runSample(opts) : runHttp(opts, provider);
    return call.then(function (res) {
      res.ms = Date.now() - started;
      res.provider = provider;
      return res;
    });
  }

  /* ---------- Kontext für Prompts -------------------------- */

  /** Kompakte Beschreibung der eigenen Schuldaten für bessere Antworten. */
  function context(opts) {
    opts = opts || {};
    var s = NG.store.settings();
    var lines = [];
    if (s.name) lines.push("Name: " + s.name);
    if (s.klasse) lines.push("Klasse/Stufe: " + s.klasse);
    lines.push("Notensystem: " + (NG.grades.scale().label));

    var subs = NG.store.activeSubjects();
    if (subs.length) {
      lines.push("");
      lines.push("Fächer und aktuelle Durchschnitte:");
      subs.forEach(function (sub) {
        var avg = NG.grades.subjectAverage(sub.id);
        lines.push("- " + sub.name +
          ": Schnitt " + (avg.total === null ? "noch keine Note" : NG.grades.format(avg.total)) +
          " (schriftlich " + avg.weights.written + " %, mündlich " + avg.weights.oral + " %)");
      });
    }

    if (opts.events !== false) {
      var today = U.todayISO();
      var soon = NG.store.all("events")
        .filter(function (e) { return e.date >= today && !e.done; })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
        .slice(0, 8);
      if (soon.length) {
        lines.push("");
        lines.push("Nächste Termine:");
        soon.forEach(function (e) {
          lines.push("- " + U.fmtDate(e.date, { style: "numeric" }) + ": " + e.title +
            (e.subjectId ? " (" + NG.store.subjectName(e.subjectId) + ")" : "") +
            " [" + (EVENT_LABEL[e.type] || e.type) + "]");
        });
      }
    }

    if (opts.tasks !== false) {
      var open = NG.store.all("tasks").filter(function (t) { return !t.done; }).slice(0, 10);
      if (open.length) {
        lines.push("");
        lines.push("Offene Aufgaben:");
        open.forEach(function (t) {
          lines.push("- " + t.title + (t.due ? " (bis " + U.fmtDate(t.due, { style: "numeric" }) + ")" : ""));
        });
      }
    }
    return lines.join("\n");
  }

  var EVENT_LABEL = {
    exam: "Klassenarbeit", test: "Test", oral: "mündliche Prüfung",
    presentation: "Referat", homework: "Hausaufgabe", project: "Projekt", other: "Termin"
  };

  /** Standard-Rollenbeschreibung für alle Anfragen. */
  function systemPrompt(extra) {
    var mode = NG.store.getSetting("ai.mode", "explain");
    var base =
      "Du bist der persönliche Lern-Assistent in der App „NextGen Lernen“ für eine Schülerin/einen Schüler in Deutschland. " +
      "Antworte immer auf Deutsch, freundlich, klar und altersgerecht. " +
      "Nutze Markdown mit Überschriften, kurzen Absätzen und Listen. Formeln schreibst du gut lesbar in Textform.";
    base += mode === "explain"
      ? " Wichtig: Erkläre jeden Lösungsweg Schritt für Schritt, damit der Weg nachvollziehbar ist und wirklich verstanden wird. " +
      "Nenne am Ende das Ergebnis und einen kurzen Merksatz."
      : " Fasse dich kurz und nenne direkt das Ergebnis, mit nur den nötigsten Zwischenschritten.";
    base += " Wenn eine Aufgabe unklar oder unlesbar ist, sage das offen, statt zu raten.";
    return extra ? base + "\n\n" + extra : base;
  }

  /* ---------- Verlauf --------------------------------------- */

  function logRun(entry) {
    var rec = NG.store.add("aiRuns", Object.assign({ createdAt: new Date().toISOString() }, entry));
    // Verlauf begrenzen, damit der Speicher nicht vollläuft
    var runs = NG.store.all("aiRuns");
    if (runs.length > 60) {
      var keep = {};
      runs.slice(-60).forEach(function (r) { keep[r.id] = true; });
      NG.store.removeWhere("aiRuns", function (r) { return !keep[r.id]; });
    }
    return rec;
  }

  NG.ai = {
    MODELS: MODELS,
    init: init, onReady: onReady, status: status, run: run,
    friendly: friendly, parseJsonLoose: parseJsonLoose,
    context: context, systemPrompt: systemPrompt, logRun: logRun,
    EVENT_LABEL: EVENT_LABEL
  };
})(window);
