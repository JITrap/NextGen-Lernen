/* =========================================================
   NextGen Lernen – OneNote-Anbindung
   Holt Notizbücher, Abschnitte und Seiten direkt über die
   Microsoft-Graph-Schnittstelle – ohne fremden Server.

   Anmeldung: OAuth 2.0 Authorization Code Flow mit PKCE
   (der für Single-Page-Anwendungen vorgesehene Weg; es wird
   kein geheimer Schlüssel im Browser gespeichert).
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});

  var AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0";
  var GRAPH = "https://graph.microsoft.com/v1.0";
  var SCOPES = "openid profile offline_access https://graph.microsoft.com/Notes.Read";

  var TOKEN_KEY = "nextgen-lernen.onenote.token";
  var PKCE_KEY = "nextgen-lernen.onenote.pkce";

  var session = null;          // {accessToken, refreshToken, expiresAt, account}
  var listeners = [];
  var refreshing = null;

  /* ---------- kleine Helfer -------------------------------- */

  function fail(code, message) {
    return Promise.reject({ code: code, message: message });
  }

  function b64url(bytes) {
    var bin = "";
    var arr = new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return global.btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function randomString(len) {
    var bytes = new Uint8Array(len);
    global.crypto.getRandomValues(bytes);
    return b64url(bytes);
  }

  function sha256(text) {
    return global.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  }

  /** Nutzdaten eines ID-Tokens lesen – nur zur Anzeige des Namens. */
  function readIdToken(jwt) {
    try {
      var part = String(jwt).split(".")[1];
      if (!part) return null;
      var json = global.atob(part.replace(/-/g, "+").replace(/_/g, "/"));
      var data = JSON.parse(decodeURIComponent(escape(json)));
      return {
        name: data.name || data.preferred_username || "Microsoft-Konto",
        username: data.preferred_username || data.email || ""
      };
    } catch (e) {
      return null;
    }
  }

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(publicState()); } catch (e) { console.error(e); }
    });
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  /* ---------- Sitzung speichern ---------------------------- */

  function loadSession() {
    try {
      var raw = global.localStorage.getItem(TOKEN_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch (e) {
      session = null;
    }
    return session;
  }

  function saveSession(next) {
    session = next;
    try {
      if (next) global.localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
      else global.localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* Speicher gesperrt – Sitzung gilt dann nur für dieses Laden */ }
    notify();
  }

  /* ---------- Verfügbarkeit -------------------------------- */

  function isFramed() {
    try { return global.top !== global.self; } catch (e) { return true; }
  }

  function available() {
    if (isFramed() || (global.claude && typeof global.claude.use === "function")) return false;
    if (global.location.protocol === "file:") return false;
    if (!global.crypto || !global.crypto.subtle) return false;
    return true;
  }

  function unavailableReason() {
    if (isFramed() || (global.claude && typeof global.claude.use === "function")) {
      return "In der eingebetteten Claude-Fassung darf die Seite keine Verbindung zu Microsoft aufbauen. " +
        "Öffne NextGen Lernen dafür lokal (npm start) oder unter einer eigenen Adresse.";
    }
    if (global.location.protocol === "file:") {
      return "Beim Öffnen per Doppelklick (file://) ist keine Anmeldung möglich. " +
        "Starte die App mit „npm start“ und öffne http://localhost:4321.";
    }
    if (!global.crypto || !global.crypto.subtle) {
      return "Die sichere Anmeldung braucht eine verschlüsselte Verbindung. " +
        "Nutze https:// oder http://localhost.";
    }
    return "";
  }

  function clientId() {
    return String(NG.store.getSetting("onenote.clientId", "") || "").trim();
  }

  function isConfigured() { return !!clientId(); }

  /** Genau diese Adresse muss in der Microsoft-App-Registrierung stehen. */
  function redirectUri() {
    return global.location.origin + global.location.pathname;
  }

  function isSignedIn() {
    return !!(session && session.refreshToken);
  }

  function account() {
    return session && session.account ? session.account : null;
  }

  function publicState() {
    return {
      available: available(),
      configured: isConfigured(),
      signedIn: isSignedIn(),
      account: account()
    };
  }

  /* ---------- Anmeldung ------------------------------------ */

  function signIn() {
    if (!available()) return fail("unavailable", unavailableReason());
    if (!isConfigured()) return fail("not_configured", "Es ist noch keine Microsoft-Anwendungs-ID hinterlegt.");

    var verifier = randomString(48);
    var state = randomString(12);

    return sha256(verifier).then(function (digest) {
      try {
        global.sessionStorage.setItem(PKCE_KEY, JSON.stringify({
          verifier: verifier,
          state: state,
          returnHash: global.location.hash || "#/import"
        }));
      } catch (e) {
        throw { code: "storage", message: "Der Browser erlaubt keinen Sitzungsspeicher – die Anmeldung kann nicht abgesichert werden." };
      }

      var params = new URLSearchParams({
        client_id: clientId(),
        response_type: "code",
        redirect_uri: redirectUri(),
        response_mode: "query",
        scope: SCOPES,
        state: state,
        code_challenge: b64url(digest),
        code_challenge_method: "S256",
        prompt: "select_account"
      });
      global.location.assign(AUTH_BASE + "/authorize?" + params.toString());
      // Der Browser verlässt die Seite; dieses Promise wird nicht mehr erfüllt.
      return new Promise(function () { });
    });
  }

  function signOut() {
    saveSession(null);
    return Promise.resolve();
  }

  /**
   * Beim Start aufrufen: verarbeitet die Rückkehr von der Microsoft-Anmeldung.
   * @returns {Promise<boolean>} true, wenn eine Anmeldung abgeschlossen wurde
   */
  function handleRedirect() {
    loadSession();

    var query = new URLSearchParams(global.location.search || "");
    var code = query.get("code");
    var error = query.get("error");
    if (!code && !error) return Promise.resolve(false);

    var stored = null;
    try { stored = JSON.parse(global.sessionStorage.getItem(PKCE_KEY) || "null"); } catch (e) { stored = null; }
    try { global.sessionStorage.removeItem(PKCE_KEY); } catch (e) { /* egal */ }

    var returnHash = (stored && stored.returnHash) || "#/import";
    cleanUrl(returnHash);

    if (error) {
      var desc = query.get("error_description") || error;
      return Promise.reject({ code: "auth_" + error, message: kurz(desc) });
    }
    if (!stored || stored.state !== query.get("state")) {
      return Promise.reject({
        code: "state_mismatch",
        message: "Die Anmeldung konnte nicht zugeordnet werden. Bitte noch einmal versuchen."
      });
    }

    return exchange({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri(),
      code_verifier: stored.verifier
    }).then(function () { return true; });
  }

  function cleanUrl(hash) {
    try {
      global.history.replaceState(null, "", global.location.pathname + (hash || ""));
    } catch (e) { /* egal */ }
  }

  function kurz(text) {
    var t = String(text || "").split(/\r?\n/)[0];
    return t.length > 220 ? t.slice(0, 217) + "…" : t;
  }

  /** Code oder Refresh-Token gegen ein Zugriffstoken tauschen. */
  function exchange(extra) {
    var body = new URLSearchParams(Object.assign({
      client_id: clientId(),
      scope: SCOPES
    }, extra));

    return fetch(AUTH_BASE + "/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          throw {
            code: "token_" + (data.error || res.status),
            message: deutenTokenFehler(data, res.status)
          };
        }
        var next = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || (session && session.refreshToken) || "",
          expiresAt: Date.now() + (Number(data.expires_in || 3600) - 90) * 1000,
          account: (data.id_token && readIdToken(data.id_token)) || (session && session.account) || null
        };
        saveSession(next);
        return next;
      });
    }, function () {
      throw {
        code: "network",
        message: "Microsoft war nicht erreichbar. Prüfe deine Internetverbindung."
      };
    });
  }

  function deutenTokenFehler(data, status) {
    var raw = String(data.error_description || data.error || "");
    if (/AADSTS9002326|cross-origin token redemption/i.test(raw)) {
      return "Die Umleitungs-Adresse ist in Azure nicht als „Single-Page-Application (SPA)“ eingetragen. " +
        "Trag sie dort unter genau diesem Typ ein: " + redirectUri();
    }
    if (/AADSTS50011|redirect URI/i.test(raw)) {
      return "Die Umleitungs-Adresse stimmt nicht mit der in Azure hinterlegten überein. Erwartet wird: " + redirectUri();
    }
    if (/AADSTS65001|consent/i.test(raw)) {
      return "Die Berechtigung „Notes.Read“ wurde noch nicht erteilt. Bei einem Schulkonto muss das eventuell die IT freigeben.";
    }
    if (/AADSTS700016|application.*not found/i.test(raw)) {
      return "Diese Anwendungs-ID kennt Microsoft nicht. Prüfe die ID aus der App-Registrierung.";
    }
    if (data.error === "invalid_grant") {
      return "Die Anmeldung ist abgelaufen. Bitte melde dich erneut an.";
    }
    return kurz(raw) || ("Anmeldung fehlgeschlagen (Status " + status + ").");
  }

  /* ---------- Zugriffstoken besorgen ----------------------- */

  function token() {
    if (!available()) return fail("unavailable", unavailableReason());
    if (!session) loadSession();
    if (!session || !session.refreshToken) {
      return fail("not_signed_in", "Du bist nicht bei Microsoft angemeldet.");
    }
    if (session.accessToken && Date.now() < session.expiresAt) {
      return Promise.resolve(session.accessToken);
    }
    if (refreshing) return refreshing;

    refreshing = exchange({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken
    }).then(function (next) {
      refreshing = null;
      return next.accessToken;
    }, function (err) {
      refreshing = null;
      // Ein abgelaufenes Refresh-Token ist der Normalfall: Bei SPA-Anmeldungen
      // gilt es nur 24 Stunden. Dann muss neu angemeldet werden.
      if (err && /invalid_grant|expired/i.test(err.code + " " + err.message)) {
        saveSession(null);
        throw {
          code: "not_signed_in",
          message: "Die Anmeldung bei Microsoft ist abgelaufen (das passiert nach 24 Stunden). Bitte melde dich neu an."
        };
      }
      throw err;
    });
    return refreshing;
  }

  /* ---------- Graph-Aufrufe -------------------------------- */

  function graph(path, opts) {
    opts = opts || {};
    return token().then(function (accessToken) {
      var url = path.indexOf("http") === 0 ? path : GRAPH + path;
      return fetch(url, {
        headers: Object.assign({ Authorization: "Bearer " + accessToken }, opts.headers || {}),
        signal: opts.signal
      });
    }).then(function (res) {
      if (res.status === 401) {
        saveSession(null);
        throw { code: "not_signed_in", message: "Die Anmeldung bei Microsoft ist abgelaufen. Bitte melde dich neu an." };
      }
      if (res.status === 403) {
        throw {
          code: "http_403",
          message: "Microsoft verweigert den Zugriff. Fehlt die Berechtigung „Notes.Read“ – oder hat deine Schul-IT " +
            "die App gesperrt?"
        };
      }
      if (res.status === 404) {
        throw { code: "http_404", message: "Das gibt es bei Microsoft nicht (mehr)." };
      }
      if (res.status === 429) {
        throw { code: "http_429", message: "Microsoft bremst gerade ab. Warte kurz und versuche es erneut." };
      }
      if (!res.ok) {
        return res.text().then(function (txt) {
          var msg = txt;
          try { var j = JSON.parse(txt); msg = (j.error && j.error.message) || txt; } catch (e) { /* roh lassen */ }
          throw { code: "http_" + res.status, message: kurz(msg) || ("Fehler " + res.status) };
        });
      }
      return res;
    }, function (err) {
      if (err && err.code) throw err;
      throw { code: "network", message: "Microsoft war nicht erreichbar. Prüfe deine Internetverbindung." };
    });
  }

  /** Alle Seiten einer Liste einsammeln (Graph liefert sie häppchenweise). */
  function collect(path, limit) {
    var out = [];
    function next(url) {
      return graph(url).then(function (res) { return res.json(); }).then(function (data) {
        out = out.concat(data.value || []);
        if (data["@odata.nextLink"] && out.length < (limit || 400)) {
          return next(data["@odata.nextLink"]);
        }
        return out;
      });
    }
    return next(path);
  }

  function notebooks() {
    return collect("/me/onenote/notebooks?$select=id,displayName,lastModifiedDateTime" +
      "&$orderby=lastModifiedDateTime desc&$top=50");
  }

  function sections(notebookId) {
    return collect("/me/onenote/notebooks/" + encodeURIComponent(notebookId) +
      "/sections?$select=id,displayName,lastModifiedDateTime&$top=100");
  }

  function sectionGroups(notebookId) {
    return collect("/me/onenote/notebooks/" + encodeURIComponent(notebookId) +
      "/sectionGroups?$select=id,displayName&$top=50");
  }

  function pages(sectionId) {
    return collect("/me/onenote/sections/" + encodeURIComponent(sectionId) +
      "/pages?$select=id,title,createdDateTime,lastModifiedDateTime" +
      "&$orderby=lastModifiedDateTime desc&$top=100");
  }

  function pageHtml(pageId) {
    return graph("/me/onenote/pages/" + encodeURIComponent(pageId) + "/content", {
      headers: { Accept: "text/html" }
    }).then(function (res) { return res.text(); });
  }

  /** Bild aus einer Seite holen. Liefert null, statt den Import zu stoppen. */
  function resourceBlob(url) {
    if (!url) return Promise.resolve(null);
    if (url.indexOf("https://graph.microsoft.com/") !== 0) return Promise.resolve(null);
    return graph(url)
      .then(function (res) { return res.blob(); })
      .catch(function () { return null; });
  }

  NG.onenote = {
    available: available,
    unavailableReason: unavailableReason,
    isConfigured: isConfigured,
    redirectUri: redirectUri,
    isSignedIn: isSignedIn,
    account: account,
    state: publicState,
    signIn: signIn,
    signOut: signOut,
    handleRedirect: handleRedirect,
    notebooks: notebooks,
    sections: sections,
    sectionGroups: sectionGroups,
    pages: pages,
    pageHtml: pageHtml,
    resourceBlob: resourceBlob,
    onChange: onChange,
    SCOPES: SCOPES
  };

  loadSession();
})(window);
