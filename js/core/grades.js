/* =========================================================
   NextGen Lernen – Notenlogik
   Gewichtete Durchschnitte aus schriftlichen und mündlichen
   Leistungen, Prognosen und Umrechnungen.
   ========================================================= */
(function (global) {
  "use strict";

  var NG = global.NG || (global.NG = {});
  var U = NG.util;

  /* ---------- Notensysteme -------------------------------- */

  var SCALES = {
    de6: {
      id: "de6",
      label: "Noten 1–6",
      min: 1, max: 6,
      best: 1, worst: 6,
      step: 0.1,
      lowerIsBetter: true,
      decimals: 1,
      suffix: "",
      /** Gängige Werte inkl. Tendenzen für Schnellauswahl. */
      presets: [1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4, 4.3, 4.7, 5, 5.3, 5.7, 6],
      presetLabel: function (v) {
        var base = Math.round(v);
        var diff = +(v - base).toFixed(1);
        if (Math.abs(diff - 0) < 0.05) return String(base);
        if (Math.abs(diff + 0.3) < 0.05) return base + "+";
        if (Math.abs(diff - 0.3) < 0.05) return base + "−";
        return U.fmtNum(v, 1);
      }
    },
    points15: {
      id: "points15",
      label: "Punkte 0–15 (Oberstufe)",
      min: 0, max: 15,
      best: 15, worst: 0,
      step: 1,
      lowerIsBetter: false,
      decimals: 1,
      suffix: " P",
      presets: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
      presetLabel: function (v) { return String(v); }
    }
  };

  function scaleId() {
    return NG.store.getSetting("gradeScale", "de6") === "points15" ? "points15" : "de6";
  }

  function scale() { return SCALES[scaleId()]; }

  /* ---------- Umrechnung ---------------------------------- */

  /** Punkte -> Note (1–6). 15 P ≈ 0,7 · 0 P ≈ 5,7 */
  function pointsToGrade(p) { return (17 - U.clamp(U.num(p, 0), 0, 15)) / 3; }

  /** Note (1–6) -> Punkte. */
  function gradeToPoints(g) { return U.clamp(Math.round(17 - 3 * U.num(g, 4)), 0, 15); }

  /** Einen Wert im aktuellen System auf die 1–6-Skala bringen (für Farben/Vergleiche). */
  function asGrade(value) {
    if (value === null || value === undefined || !isFinite(value)) return null;
    return scaleId() === "points15" ? pointsToGrade(value) : value;
  }

  /** Einen 1–6-Wert in das aktuell eingestellte System zurückrechnen. */
  function fromGrade(g) {
    if (g === null || g === undefined || !isFinite(g)) return null;
    return scaleId() === "points15" ? gradeToPoints(g) : g;
  }

  function isValid(value) {
    var s = scale();
    var n = U.num(value, null);
    return n !== null && n >= s.min - 0.001 && n <= s.max + 0.001;
  }

  /* ---------- Darstellung --------------------------------- */

  /** CSS-Klasse g1…g6 für einen Wert im aktuellen System. */
  function gradeClass(value) {
    var g = asGrade(U.num(value, null));
    if (g === null) return "";
    return "g" + U.clamp(Math.round(g), 1, 6);
  }

  function format(value, decimals) {
    var n = U.num(value, null);
    if (n === null) return "—";
    var s = scale();
    var d = decimals === undefined ? (s.id === "points15" ? 1 : 2) : decimals;
    var txt = U.fmtNum(n, d);
    // Ganze Punktzahlen ohne Nachkommastelle anzeigen
    if (s.id === "points15" && Math.abs(n - Math.round(n)) < 0.05) txt = String(Math.round(n));
    return txt + s.suffix;
  }

  /** Kurze verbale Einordnung. */
  function verdict(value) {
    var g = asGrade(U.num(value, null));
    if (g === null) return "";
    if (g < 1.5) return "sehr gut";
    if (g < 2.5) return "gut";
    if (g < 3.5) return "befriedigend";
    if (g < 4.5) return "ausreichend";
    if (g < 5.5) return "mangelhaft";
    return "ungenügend";
  }

  /** „Besser“ heißt je nach System kleiner oder größer. */
  function isBetter(a, b) {
    if (a === null || b === null) return false;
    return scale().lowerIsBetter ? a < b : a > b;
  }

  /* ---------- Durchschnitte -------------------------------- */

  /** Gewichteter Mittelwert einer Notenliste. */
  function weightedMean(list) {
    var sum = 0, w = 0;
    (list || []).forEach(function (g) {
      var v = U.num(g.value, null);
      if (v === null) return;
      var gw = U.num(g.weight, 1);
      if (!(gw > 0)) gw = 1;
      sum += v * gw;
      w += gw;
    });
    return w > 0 ? sum / w : null;
  }

  function gradesOf(subjectId) {
    return NG.store.all("grades").filter(function (g) {
      return g.subjectId === subjectId && U.num(g.value, null) !== null;
    });
  }

  /**
   * Durchschnitt eines Fachs.
   * @returns {{written:number|null, oral:number|null, total:number|null,
   *            weights:{written:number,oral:number}, counts:{written:number,oral:number},
   *            effective:{written:number,oral:number}}}
   */
  function subjectAverage(subjectId) {
    var sub = NG.store.subject(subjectId) || {};
    var weights = Object.assign({ written: 50, oral: 50 }, sub.weights || {});
    var list = gradesOf(subjectId);

    var written = list.filter(function (g) { return g.type === "written"; });
    var oral = list.filter(function (g) { return g.type === "oral"; });

    var avgW = weightedMean(written);
    var avgO = weightedMean(oral);

    var wW = avgW === null ? 0 : Math.max(0, U.num(weights.written, 50));
    var wO = avgO === null ? 0 : Math.max(0, U.num(weights.oral, 50));

    var total = null;
    if (wW + wO > 0) total = ((avgW || 0) * wW + (avgO || 0) * wO) / (wW + wO);
    else if (avgW !== null) total = avgW;
    else if (avgO !== null) total = avgO;

    return {
      written: avgW,
      oral: avgO,
      total: total,
      weights: { written: U.num(weights.written, 50), oral: U.num(weights.oral, 50) },
      effective: { written: wW, oral: wO },
      counts: { written: written.length, oral: oral.length, total: list.length }
    };
  }

  /** Gesamtschnitt über alle Fächer; `credit` gewichtet einzelne Fächer stärker. */
  function overallAverage() {
    var sum = 0, w = 0, subjects = [];
    NG.store.activeSubjects().forEach(function (sub) {
      var avg = subjectAverage(sub.id);
      if (avg.total === null) return;
      var credit = U.num(sub.credit, 1);
      if (!(credit > 0)) credit = 1;
      sum += avg.total * credit;
      w += credit;
      subjects.push({ subject: sub, avg: avg });
    });
    return { value: w > 0 ? sum / w : null, subjects: subjects, count: subjects.length };
  }

  /**
   * Welche Note wird in der nächsten Leistung gebraucht, um `target` zu erreichen?
   * @returns {{value:number|null, reachable:boolean, reason:string}}
   */
  function neededFor(subjectId, target, type, weight) {
    var s = scale();
    target = U.num(target, null);
    if (target === null) return { value: null, reachable: false, reason: "Kein Ziel gesetzt." };

    type = type === "oral" ? "oral" : "written";
    var w = U.num(weight, 1);
    if (!(w > 0)) w = 1;

    var sub = NG.store.subject(subjectId) || {};
    var weights = Object.assign({ written: 50, oral: 50 }, sub.weights || {});
    var list = gradesOf(subjectId);

    var same = list.filter(function (g) { return g.type === type; });
    var other = list.filter(function (g) { return g.type !== type; });

    var sumSame = 0, wSame = 0;
    same.forEach(function (g) {
      var gw = U.num(g.weight, 1); if (!(gw > 0)) gw = 1;
      sumSame += U.num(g.value, 0) * gw; wSame += gw;
    });

    var avgOther = weightedMean(other);
    var catW = Math.max(0, U.num(type === "written" ? weights.written : weights.oral, 50));
    var othW = avgOther === null ? 0 : Math.max(0, U.num(type === "written" ? weights.oral : weights.written, 50));

    var neededCatAvg;
    if (othW > 0 && catW > 0) {
      neededCatAvg = (target * (catW + othW) - avgOther * othW) / catW;
    } else {
      neededCatAvg = target;
    }

    var x = (neededCatAvg * (wSame + w) - sumSame) / w;

    var reachable = x >= s.min - 0.001 && x <= s.max + 0.001;
    var reason = "";
    if (!reachable) {
      var tooGood = s.lowerIsBetter ? x < s.min : x > s.max;
      reason = tooGood
        ? "Mit einer einzelnen Note nicht mehr erreichbar – es braucht mehrere gute Leistungen."
        : "Das Ziel ist auch mit der schlechtesten Note noch sicher.";
    }
    return { value: x, reachable: reachable, reason: reason, clamped: U.clamp(x, s.min, s.max) };
  }

  /** Entwicklung: Schnitt der letzten `days` Tage gegen den Rest. */
  function trend(subjectId, days) {
    days = days || 60;
    var cut = U.addDays(U.todayISO(), -days);
    var list = gradesOf(subjectId);
    var recent = list.filter(function (g) { return g.date && g.date >= cut; });
    var older = list.filter(function (g) { return !g.date || g.date < cut; });
    var a = weightedMean(recent), b = weightedMean(older);
    if (a === null || b === null) return { delta: null, direction: "flat", recent: a, older: b };
    var delta = a - b;
    var improving = scale().lowerIsBetter ? delta < -0.05 : delta > 0.05;
    var worsening = scale().lowerIsBetter ? delta > 0.05 : delta < -0.05;
    return {
      delta: delta,
      direction: improving ? "up" : worsening ? "down" : "flat",
      recent: a, older: b
    };
  }

  /** Häufigkeitsverteilung über die Notenstufen 1–6. */
  function distribution(subjectId) {
    var counts = [0, 0, 0, 0, 0, 0];
    NG.store.all("grades").forEach(function (g) {
      if (subjectId && g.subjectId !== subjectId) return;
      var val = asGrade(U.num(g.value, null));
      if (val === null) return;
      counts[U.clamp(Math.round(val), 1, 6) - 1]++;
    });
    return counts;
  }

  /** Vorschlag für eine Fachfarbe passend zum Schnitt (für Diagramme). */
  function colorFor(value) {
    var g = asGrade(U.num(value, null));
    if (g === null) return "var(--text-faint)";
    return "var(--grade-" + U.clamp(Math.round(g), 1, 6) + ")";
  }

  NG.grades = {
    SCALES: SCALES,
    scale: scale, scaleId: scaleId,
    pointsToGrade: pointsToGrade, gradeToPoints: gradeToPoints,
    asGrade: asGrade, fromGrade: fromGrade,
    isValid: isValid, gradeClass: gradeClass, format: format, verdict: verdict, isBetter: isBetter,
    weightedMean: weightedMean, gradesOf: gradesOf,
    subjectAverage: subjectAverage, overallAverage: overallAverage,
    neededFor: neededFor, trend: trend, distribution: distribution, colorFor: colorFor
  };
})(window);
