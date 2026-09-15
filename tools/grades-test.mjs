/**
 * Prüft die Notenrechnung ohne Browser.
 *   node tools/grades-test.mjs
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/* --- Minimal-Umgebung, damit die Browser-Module laufen --- */
const memory = new Map();
const fakeWindow = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};

for (const file of ["js/core/util.js", "js/core/store.js", "js/core/grades.js"]) {
  const code = await readFile(join(ROOT, file), "utf8");
  new Function("window", code)(fakeWindow);
}

const { NG } = fakeWindow;
NG.store.init();

/* --- Testgerüst --- */
let passed = 0;
const failed = [];
function test(name, fn) {
  try { fn(); passed++; process.stdout.write(`  ✓ ${name}\n`); }
  catch (err) { failed.push({ name, err }); process.stdout.write(`  ✗ ${name}\n      ${err.message}\n`); }
}
const near = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} sollte ${b} sein`);

function reset(scale = "de6") {
  NG.store.reset();
  NG.store.setSetting("gradeScale", scale);
}
function subject(id, weights, extra) {
  return NG.store.add("subjects", Object.assign({ id, name: id, color: "#000", weights }, extra || {}));
}
function grade(subjectId, type, value, weight) {
  return NG.store.add("grades", { subjectId, type, value, weight: weight === undefined ? 1 : weight });
}

console.log("\nNotenrechnung\n");

test("Ein einzelner Wert ergibt genau diesen Schnitt", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  grade("s1", "written", 2);
  near(NG.grades.subjectAverage("s1").total, 2);
});

test("Ohne Noten gibt es keinen Schnitt", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  assert.equal(NG.grades.subjectAverage("s1").total, null);
});

test("Nur schriftliche Noten zählen zu 100 Prozent", () => {
  reset();
  subject("s1", { written: 60, oral: 40 });
  grade("s1", "written", 2);
  grade("s1", "written", 4);
  near(NG.grades.subjectAverage("s1").total, 3);
});

test("Nur mündliche Noten zählen zu 100 Prozent", () => {
  reset();
  subject("s1", { written: 70, oral: 30 });
  grade("s1", "oral", 3);
  near(NG.grades.subjectAverage("s1").total, 3);
});

test("Gewichtung 60/40 wird richtig angewendet", () => {
  reset();
  subject("s1", { written: 60, oral: 40 });
  grade("s1", "written", 2);
  grade("s1", "oral", 3);
  near(NG.grades.subjectAverage("s1").total, 2 * 0.6 + 3 * 0.4);
});

test("Gewicht einer einzelnen Note (doppelt) wirkt", () => {
  reset();
  subject("s1", { written: 100, oral: 0 });
  grade("s1", "written", 2, 2);   // Klassenarbeit, doppelt
  grade("s1", "written", 4, 1);   // Test, einfach
  near(NG.grades.subjectAverage("s1").total, (2 * 2 + 4 * 1) / 3);
});

test("Gewichtungen müssen sich nicht auf 100 summieren", () => {
  reset();
  subject("s1", { written: 3, oral: 1 });
  grade("s1", "written", 2);
  grade("s1", "oral", 6);
  near(NG.grades.subjectAverage("s1").total, (2 * 3 + 6 * 1) / 4);
});

test("Gewichtung 100/0 ignoriert mündliche Noten", () => {
  reset();
  subject("s1", { written: 100, oral: 0 });
  grade("s1", "written", 1);
  grade("s1", "oral", 6);
  near(NG.grades.subjectAverage("s1").total, 1);
});

test("Ungültige Gewichtung fällt auf 50/50 zurück", () => {
  reset();
  subject("s1", { written: NaN, oral: undefined });
  grade("s1", "written", 1);
  grade("s1", "oral", 3);
  near(NG.grades.subjectAverage("s1").total, 2);
});

test("Gesamtschnitt mittelt über die Fächer", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  subject("s2", { written: 50, oral: 50 });
  grade("s1", "written", 1);
  grade("s2", "written", 3);
  near(NG.grades.overallAverage().value, 2);
});

test("Wertigkeit eines Fachs (credit) wirkt im Gesamtschnitt", () => {
  reset();
  subject("s1", { written: 50, oral: 50 }, { credit: 2 });
  subject("s2", { written: 50, oral: 50 }, { credit: 1 });
  grade("s1", "written", 1);
  grade("s2", "written", 4);
  near(NG.grades.overallAverage().value, (1 * 2 + 4 * 1) / 3);
});

test("Fächer ohne Noten zählen nicht im Gesamtschnitt", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  subject("leer", { written: 50, oral: 50 });
  grade("s1", "written", 2);
  near(NG.grades.overallAverage().value, 2);
  assert.equal(NG.grades.overallAverage().count, 1);
});

test("Archivierte Fächer bleiben draußen", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  subject("alt", { written: 50, oral: 50 }, { archived: true });
  grade("s1", "written", 2);
  grade("alt", "written", 5);
  near(NG.grades.overallAverage().value, 2);
});

console.log("\nPrognose „Was brauche ich noch?“\n");

test("Nötige Note führt tatsächlich zum Ziel", () => {
  reset();
  subject("s1", { written: 60, oral: 40 });
  grade("s1", "written", 3, 1);
  grade("s1", "oral", 2, 1);
  const need = NG.grades.neededFor("s1", 2.5, "written", 2);
  assert.ok(need.reachable, "sollte erreichbar sein");
  grade("s1", "written", need.value, 2);
  near(NG.grades.subjectAverage("s1").total, 2.5, 1e-9);
});

test("Erste Note: nötiger Wert ist die Zielnote selbst", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  const need = NG.grades.neededFor("s1", 2, "written", 1);
  near(need.value, 2);
});

test("Unerreichbares Ziel wird als solches gemeldet", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  grade("s1", "written", 5, 3);
  grade("s1", "oral", 5, 3);
  const need = NG.grades.neededFor("s1", 1, "written", 1);
  assert.equal(need.reachable, false);
  assert.ok(need.reason.length > 0, "Begründung fehlt");
});

test("Bereits sicheres Ziel wird erkannt", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  grade("s1", "written", 1, 5);
  grade("s1", "oral", 1, 5);
  const need = NG.grades.neededFor("s1", 4, "written", 1);
  assert.equal(need.reachable, false);
});

console.log("\nPunktesystem 0–15\n");

test("Punkte werden korrekt in Noten übersetzt", () => {
  reset("points15");
  near(NG.grades.pointsToGrade(15), (17 - 15) / 3);
  near(NG.grades.pointsToGrade(11), 2);
  near(NG.grades.pointsToGrade(5), 4);
  near(NG.grades.pointsToGrade(0), 17 / 3);
});

test("Noten werden korrekt in Punkte übersetzt", () => {
  reset("points15");
  assert.equal(NG.grades.gradeToPoints(1), 14);
  assert.equal(NG.grades.gradeToPoints(2), 11);
  assert.equal(NG.grades.gradeToPoints(4), 5);
  assert.equal(NG.grades.gradeToPoints(6), 0);
});

test("Im Punktesystem ist mehr besser", () => {
  reset("points15");
  assert.equal(NG.grades.scale().lowerIsBetter, false);
  assert.ok(NG.grades.isBetter(13, 8));
  assert.ok(!NG.grades.isBetter(4, 9));
});

test("Punkte-Schnitt wird gewichtet gerechnet", () => {
  reset("points15");
  subject("s1", { written: 60, oral: 40 });
  grade("s1", "written", 12);
  grade("s1", "oral", 7);
  near(NG.grades.subjectAverage("s1").total, 12 * 0.6 + 7 * 0.4);
});

test("Farbklasse passt zum Punktewert", () => {
  reset("points15");
  assert.equal(NG.grades.gradeClass(15), "g1");
  assert.equal(NG.grades.gradeClass(0), "g6");
  reset("de6");
  assert.equal(NG.grades.gradeClass(1.2), "g1");
  assert.equal(NG.grades.gradeClass(5.6), "g6");
});

test("Gültigkeitsprüfung achtet auf die Grenzen", () => {
  reset("de6");
  assert.ok(NG.grades.isValid(1) && NG.grades.isValid(6));
  assert.ok(!NG.grades.isValid(0) && !NG.grades.isValid(7));
  reset("points15");
  assert.ok(NG.grades.isValid(0) && NG.grades.isValid(15));
  assert.ok(!NG.grades.isValid(16) && !NG.grades.isValid(-1));
});

console.log("\nWeitere Auswertungen\n");

test("Verteilung zählt jede Note genau einmal", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  grade("s1", "written", 1);
  grade("s1", "written", 1.4);
  grade("s1", "oral", 3);
  const d = NG.grades.distribution();
  assert.equal(d[0], 2);
  assert.equal(d[2], 1);
  assert.equal(d.reduce((a, b) => a + b, 0), 3);
});

test("Trend erkennt Verbesserung", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  const old = NG.util.addDays(NG.util.todayISO(), -120);
  const recent = NG.util.addDays(NG.util.todayISO(), -3);
  NG.store.add("grades", { subjectId: "s1", type: "written", value: 4, weight: 1, date: old });
  NG.store.add("grades", { subjectId: "s1", type: "written", value: 2, weight: 1, date: recent });
  assert.equal(NG.grades.trend("s1", 60).direction, "up");
});

test("Löschen eines Fachs entfernt dessen Noten", () => {
  reset();
  subject("s1", { written: 50, oral: 50 });
  grade("s1", "written", 2);
  assert.equal(NG.store.all("grades").length, 1);
  NG.store.removeSubject("s1");
  assert.equal(NG.store.all("grades").length, 0);
  assert.equal(NG.store.all("subjects").length, 0);
});

test("Export und Import erhalten die Daten", () => {
  reset();
  subject("s1", { written: 60, oral: 40 });
  grade("s1", "written", 2);
  const json = NG.store.exportJSON();
  NG.store.reset();
  assert.equal(NG.store.all("subjects").length, 0);
  NG.store.importJSON(json, "replace");
  assert.equal(NG.store.all("subjects").length, 1);
  near(NG.grades.subjectAverage("s1").total, 2);
});

console.log("\nDatum & Text\n");

test("Datumsrechnung über Monatsgrenzen", () => {
  assert.equal(NG.util.addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(NG.util.addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(NG.util.addDays("2028-02-28", 1), "2028-02-29");
});

test("Markdown erkennt Zitate, Listen, Tabellen und Code", () => {
  const html = NG.util.md([
    "> Merksatz: Ableitung ist die Steigung.",
    "",
    "1. erster Schritt",
    "2. zweiter Schritt",
    "",
    "| Fach | Note |",
    "| --- | --- |",
    "| Mathe | 2 |",
    "",
    "```",
    "x = 42",
    "```",
  ].join("\n"));
  assert.ok(html.includes("<blockquote>"), "Zitat fehlt");
  assert.ok(html.includes("Merksatz"), "Zitattext fehlt");
  assert.ok(html.includes("<ol>") && html.includes("<li>erster Schritt</li>"), "Nummerierte Liste fehlt");
  assert.ok(html.includes("<table>") && html.includes("<th>Fach</th>"), "Tabelle fehlt");
  assert.ok(html.includes("<pre><code>x = 42"), "Codeblock fehlt");
});

test("Markdown wird sicher umgesetzt", () => {
  const html = NG.util.md("# Titel\n\n- **fett**\n- <script>alert(1)</script>");
  assert.ok(html.includes("<h2>Titel</h2>"), "Überschrift fehlt");
  assert.ok(html.includes("<strong>fett</strong>"), "Fettschrift fehlt");
  assert.ok(!html.includes("<script>"), "Script wurde nicht entschärft");
  assert.ok(html.includes("&lt;script&gt;"), "Script sollte escaped sein");
});

console.log(`\n${"-".repeat(52)}`);
console.log(`${passed} von ${passed + failed.length} Prüfungen bestanden`);
process.exit(failed.length ? 1 : 0);
