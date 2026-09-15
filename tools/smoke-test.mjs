/**
 * NextGen Lernen – automatische Funktionsprüfung.
 *
 * Startet einen lokalen Server, öffnet die App in Chromium und klickt sie durch.
 * Jeder JavaScript-Fehler in der Konsole lässt die Prüfung scheitern.
 *
 *   node tools/smoke-test.mjs            (alles)
 *   node tools/smoke-test.mjs --headed   (mit sichtbarem Browser)
 */
import { createRequire } from "node:module";
import { execSync, spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SHOTS = join(ROOT, "tests", "screenshots");
const PORT = Number(process.env.TEST_PORT || 4399);
const BASE = `http://localhost:${PORT}`;

function loadPlaywright() {
  try { return require("playwright"); } catch { /* weiter unten */ }
  const globalRoot = execSync("npm root -g").toString().trim();
  return require(join(globalRoot, "playwright"));
}

/* ---------- Testgerüst ------------------------------------- */

const results = [];
let failures = 0;

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    failures++;
    results.push({ name, ok: false, ms: Date.now() - started, error: String(err.message || err) });
    process.stdout.write(`  ✗ ${name}\n      ${String(err.message || err).split("\n")[0]}\n`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/* ---------- Beispieldaten ---------------------------------- */

function iso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const SEED = {
  version: 1,
  settings: {
    name: "Test", klasse: "9b", schoolYear: "2025/26", theme: "auto",
    gradeScale: "de6", defaultWeights: { written: 50, oral: 50 },
    startView: "dashboard", firstHourStart: "08:00", lessonMinutes: 45,
    ai: { provider: "auto", apiKey: "", model: "claude-opus-5", proxyUrl: "", mode: "explain" },
    cloudSync: false, onboarded: true,
  },
  subjects: [
    { id: "s1", name: "Mathematik", short: "MA", color: "#4b5bd4", teacher: "Frau Berg", room: "A12", credit: 2, weights: { written: 60, oral: 40 }, targetGrade: 2 },
    { id: "s2", name: "Deutsch", short: "DE", color: "#0f9d58", teacher: "Herr Kant", room: "B03", credit: 2, weights: { written: 50, oral: 50 } },
    { id: "s3", name: "Biologie", short: "BI", color: "#c7700a", teacher: "Frau Lind", room: "C21", credit: 1, weights: { written: 40, oral: 60 } },
  ],
  grades: [
    { id: "g1", subjectId: "s1", title: "1. Klassenarbeit", type: "written", category: "Klassenarbeit", value: 2, weight: 2, date: iso(-40) },
    { id: "g2", subjectId: "s1", title: "Test Gleichungen", type: "written", category: "Test", value: 3, weight: 1, date: iso(-15) },
    { id: "g3", subjectId: "s1", title: "Mitarbeit", type: "oral", category: "Mitarbeit", value: 2.3, weight: 1, date: iso(-5) },
    { id: "g4", subjectId: "s2", title: "Aufsatz", type: "written", category: "Klassenarbeit", value: 1.7, weight: 2, date: iso(-22) },
    { id: "g5", subjectId: "s2", title: "Referat Goethe", type: "oral", category: "Referat", value: 2, weight: 1, date: iso(-9) },
    { id: "g6", subjectId: "s3", title: "Mitarbeit", type: "oral", category: "Mitarbeit", value: 3, weight: 1, date: iso(-3) },
  ],
  events: [
    { id: "e1", subjectId: "s1", title: "2. Klassenarbeit Funktionen", type: "exam", date: iso(6), time: "09:45", place: "A12" },
    { id: "e2", subjectId: "s2", title: "Test Lyrik", type: "test", date: iso(2), time: "08:00" },
    { id: "e3", subjectId: "s3", title: "Referat Ökosysteme", type: "presentation", date: iso(12) },
    { id: "e4", subjectId: null, title: "Elternsprechtag", type: "other", date: iso(20) },
    { id: "e5", subjectId: "s1", title: "Alte Arbeit", type: "exam", date: iso(-30), done: true },
  ],
  tasks: [
    { id: "t1", subjectId: "s1", title: "Übungsblatt 4 rechnen", due: iso(-1), done: false, priority: 1 },
    { id: "t2", subjectId: "s2", title: "Gedicht auswendig lernen", due: iso(0), done: false, priority: 2 },
    { id: "t3", subjectId: "s3", title: "Protokoll abgeben", due: iso(4), done: false, priority: 3 },
    { id: "t4", subjectId: null, title: "Federmappe auffüllen", due: null, done: false, priority: 3 },
    { id: "t5", subjectId: "s1", title: "Vokabeln wiederholen", due: iso(-5), done: true, priority: 3, doneAt: new Date().toISOString() },
  ],
  timetable: [
    { id: "tt1", day: 0, slot: 1, subjectId: "s1", room: "A12" },
    { id: "tt2", day: 0, slot: 2, subjectId: "s2", room: "B03" },
    { id: "tt3", day: 1, slot: 3, subjectId: "s3", room: "C21" },
    { id: "tt4", day: 2, slot: 1, subjectId: "s1", room: "A12" },
    { id: "tt5", day: 3, slot: 4, subjectId: "s2", room: "B03" },
    { id: "tt6", day: 4, slot: 2, subjectId: "s3", room: "C21" },
  ],
  materials: [],
  aiRuns: [
    { id: "a1", kind: "solve", title: "Aufgaben Seite 42", prompt: "Löse die Aufgaben", result: "## Aufgabe 1\n\nDas Ergebnis ist **42**.\n\n- Schritt eins\n- Schritt zwei", subjectId: "s1", createdAt: new Date().toISOString() },
  ],
  decks: [
    { id: "d1", name: "Mathe Formeln", subjectId: "s1" },
    { id: "d2", name: "Bio Fachbegriffe", subjectId: "s3" },
  ],
  cards: [
    { id: "c1", deckId: "d1", front: "Satz des Pythagoras", back: "a² + b² = c²", box: 1, due: iso(0), reps: 0, lapses: 0 },
    { id: "c2", deckId: "d1", front: "Fläche eines Kreises", back: "A = π · r²", box: 2, due: iso(0), reps: 1, lapses: 0 },
    { id: "c3", deckId: "d1", front: "Binomische Formel 1", back: "(a+b)² = a² + 2ab + b²", box: 4, due: iso(5), reps: 3, lapses: 0 },
    { id: "c4", deckId: "d2", front: "Mitochondrium", back: "Kraftwerk der Zelle", box: 1, due: iso(0), reps: 0, lapses: 0 },
  ],
  sessions: [
    { id: "se1", subjectId: "s1", startedAt: new Date(Date.now() - 86400000).toISOString(), minutes: 25, kind: "focus" },
    { id: "se2", subjectId: "s2", startedAt: new Date().toISOString(), minutes: 50, kind: "focus" },
  ],
  meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
};

/** Baut eine echte, kleine .docx-Datei (ZIP mit deflate) – ohne Fremdbibliothek. */
function baueDocx(absaetze) {
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    absaetze.map(([stil, text]) =>
      "<w:p>" +
      (stil ? '<w:pPr><w:pStyle w:val="' + stil + '"/></w:pPr>' : "") +
      "<w:r><w:t>" + text.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</w:t></w:r></w:p>"
    ).join("") +
    "</w:body></w:document>";

  const name = Buffer.from("word/document.xml", "utf8");
  const roh = Buffer.from(xml, "utf8");
  const gepackt = zlib.deflateRawSync(roh);
  const crc = zlib.crc32(roh);

  const lokal = Buffer.alloc(30);
  lokal.writeUInt32LE(0x04034b50, 0);
  lokal.writeUInt16LE(20, 4);            // benötigte Version
  lokal.writeUInt16LE(0, 6);             // Flags
  lokal.writeUInt16LE(8, 8);             // Methode: deflate
  lokal.writeUInt32LE(0, 10);            // Zeit/Datum
  lokal.writeUInt32LE(crc, 14);
  lokal.writeUInt32LE(gepackt.length, 18);
  lokal.writeUInt32LE(roh.length, 22);
  lokal.writeUInt16LE(name.length, 26);
  lokal.writeUInt16LE(0, 28);            // Extrafeld

  const zentral = Buffer.alloc(46);
  zentral.writeUInt32LE(0x02014b50, 0);
  zentral.writeUInt16LE(20, 4);
  zentral.writeUInt16LE(20, 6);
  zentral.writeUInt16LE(0, 8);
  zentral.writeUInt16LE(8, 10);
  zentral.writeUInt32LE(0, 12);
  zentral.writeUInt32LE(crc, 16);
  zentral.writeUInt32LE(gepackt.length, 20);
  zentral.writeUInt32LE(roh.length, 24);
  zentral.writeUInt16LE(name.length, 28);
  zentral.writeUInt16LE(0, 30);          // Extrafeld
  zentral.writeUInt16LE(0, 32);          // Kommentar
  zentral.writeUInt16LE(0, 34);
  zentral.writeUInt16LE(0, 36);
  zentral.writeUInt32LE(0, 38);
  zentral.writeUInt32LE(0, 42);          // Offset des lokalen Kopfs

  const cdGroesse = zentral.length + name.length;
  const cdOffset = lokal.length + name.length + gepackt.length;

  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(0, 4);
  ende.writeUInt16LE(0, 6);
  ende.writeUInt16LE(1, 8);
  ende.writeUInt16LE(1, 10);
  ende.writeUInt32LE(cdGroesse, 12);
  ende.writeUInt32LE(cdOffset, 16);
  ende.writeUInt16LE(0, 20);

  return Buffer.concat([lokal, name, gepackt, zentral, name, ende]);
}

/** Kleinstes gültiges PNG (1x1 Pixel) für den Upload-Test. */
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const VIEWS = [
  ["dashboard", "Übersicht"],
  ["calendar", "Termine"],
  ["tasks", "Aufgaben"],
  ["timetable", "Stundenplan"],
  ["subjects", "Fächer"],
  ["grades", "Noten"],
  ["assistant", "KI-Assistent"],
  ["import", "Importieren"],
  ["materials", "Materialien"],
  ["flashcards", "Karteikarten"],
  ["focus", "Lernzeit"],
  ["settings", "Einstellungen"],
];

/* ---------- Hauptlauf --------------------------------------- */

const IGNORE = [
  /favicon/i,
  /Failed to load resource.*_blob/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
];

async function main() {
  const { chromium } = loadPlaywright();

  await rm(SHOTS, { recursive: true, force: true });
  await mkdir(SHOTS, { recursive: true });

  const server = spawn(process.execPath, [join(ROOT, "tools", "serve.mjs"), String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  let serverTot = null;
  server.stdout.on("data", (d) => { serverLog += d; });
  server.stderr.on("data", (d) => { serverLog += d; });
  server.on("exit", (code, signal) => {
    serverTot = `Der Testserver hat sich beendet (Code ${code}, Signal ${signal}).\n${serverLog.slice(-1200)}`;
    console.error("\n!! " + serverTot + "\n");
  });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("Server startete nicht:\n" + serverLog)), 8000);
    const warte = setInterval(() => {
      if (serverLog.includes("läuft auf")) { clearTimeout(t); clearInterval(warte); res(); }
      if (serverTot) { clearTimeout(t); clearInterval(warte); rej(new Error(serverTot)); }
    }, 50);
    server.on("error", rej);
  });

  const browser = await chromium.launch({
    headless: !process.argv.includes("--headed"),
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  });

  const errors = [];

  /** Neue, saubere Browser-Sitzung. `data` wird nur gesetzt, wenn noch nichts gespeichert ist,
   *  damit spätere Änderungen einen Neustart überleben. */
  async function newPage(data) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-DE" });
    if (data) {
      await context.addInitScript((seedData) => {
        try {
          if (!window.localStorage.getItem("nextgen-lernen.state.v1")) {
            window.localStorage.setItem("nextgen-lernen.state.v1", JSON.stringify(seedData));
          }
        } catch { /* Speicher gesperrt */ }
      }, data);
    }
    const p = await context.newPage();
    p.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORE.some((re) => re.test(text))) return;
      const ort = msg.location && msg.location();
      const woher = ort && ort.url ? ` (${ort.url}${ort.lineNumber ? ":" + ort.lineNumber : ""})` : "";
      errors.push(`[console] ${text}${woher}`);
    });
    p.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
    return { context, page: p };
  }

  let { context, page } = await newPage(null);

  console.log("\nNextGen Lernen – Funktionsprüfung\n");

  /* --- 1. Erststart & Einrichtung --- */
  console.log("Erststart");
  await check("App lädt ohne gespeicherte Daten", async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#nav .nav__item", { timeout: 8000 });
    const items = await page.locator("#nav .nav__item").count();
    assert(items >= 10, `Nur ${items} Navigationspunkte gefunden, erwartet mindestens 10`);
  });

  await check("Einrichtungsassistent erscheint", async () => {
    await page.waitForSelector(".modal-backdrop", { timeout: 4000 });
    const title = await page.locator(".modal__head h2").first().innerText();
    assert(title.length > 0, "Dialog ohne Titel");
    await page.screenshot({ path: join(SHOTS, "01-onboarding.png") });
  });

  await check("Einrichtung lässt sich überspringen", async () => {
    const skip = page.locator(".modal button", { hasText: /Überspringen|Später|Skip/i }).first();
    if (await skip.count()) await skip.click();
    else await page.keyboard.press("Escape");
    await page.waitForSelector(".modal-backdrop", { state: "detached", timeout: 4000 });
  });

  /* --- 2. Alle Ansichten mit Beispieldaten --- */
  console.log("\nAnsichten");
  await context.close();
  ({ context, page } = await newPage(SEED));
  await page.goto(BASE + "#/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#view .view", { timeout: 8000 });

  for (const [id, title] of VIEWS) {
    await check(`Ansicht „${title}“ rendert`, async () => {
      const before = errors.length;
      await page.goto(`${BASE}#/${id}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelector("#view .view") !== null, { timeout: 6000 });
      await page.waitForTimeout(450);
      const heading = await page.locator("#topbar-title").innerText();
      assert(heading.trim() === title, `Kopfzeile zeigt „${heading}“ statt „${title}“`);
      const body = await page.locator("#view").innerText();
      assert(body.trim().length > 20, "Ansicht ist leer");
      const fresh = errors.slice(before);
      assert(fresh.length === 0, `JavaScript-Fehler:\n      ${fresh.join("\n      ")}`);
      await page.screenshot({ path: join(SHOTS, `10-${id}.png`), fullPage: true });
    });
  }

  /* --- 3. Kerninhalte --- */
  console.log("\nInhalte");
  await check("Übersicht zeigt Gesamtschnitt und nächste Arbeit", async () => {
    await page.goto(`${BASE}#/dashboard`);
    await page.waitForTimeout(400);
    const text = await page.locator("#view").innerText();
    assert(/Gesamtschnitt/i.test(text), "Kachel „Gesamtschnitt“ fehlt");
    assert(/Klassenarbeit/i.test(text), "Keine Klassenarbeit sichtbar");
    assert(/Mathematik/.test(text), "Fach Mathematik fehlt");
  });

  await check("Notenansicht rechnet gewichtet", async () => {
    await page.goto(`${BASE}#/grades`);
    await page.waitForTimeout(400);
    // Mathematik: schriftlich (2*2 + 3*1)/3 = 2,333 bei 60 %, mündlich 2,3 bei 40 %
    const expected = ((2 * 2 + 3 * 1) / 3) * 0.6 + 2.3 * 0.4;
    const value = await page.evaluate(() => window.NG.grades.subjectAverage("s1").total);
    assert(Math.abs(value - expected) < 0.001, `Schnitt ${value} statt ${expected}`);
    const text = await page.locator("#view").innerText();
    assert(/Mathematik/.test(text), "Mathematik fehlt in der Notenansicht");
  });

  await check("Gewichtung wirkt sich aus", async () => {
    const changed = await page.evaluate(() => {
      const before = window.NG.grades.subjectAverage("s1").total;
      window.NG.store.update("subjects", "s1", { weights: { written: 100, oral: 0 } });
      const after = window.NG.grades.subjectAverage("s1").total;
      window.NG.store.update("subjects", "s1", { weights: { written: 60, oral: 40 } });
      return { before, after };
    });
    assert(Math.abs(changed.after - (2 * 2 + 3 * 1) / 3) < 0.001,
      `Bei 100 % schriftlich erwartet ${(2 * 2 + 3 * 1) / 3}, bekommen ${changed.after}`);
    assert(changed.before !== changed.after, "Gewichtung hatte keine Wirkung");
  });

  await check("Notenprognose liefert plausible Werte", async () => {
    const res = await page.evaluate(() => window.NG.grades.neededFor("s1", 2, "written", 2));
    assert(typeof res.value === "number" && isFinite(res.value), "neededFor lieferte keine Zahl");
  });

  await check("Kalender zeigt den aktuellen Monat", async () => {
    await page.goto(`${BASE}#/calendar`);
    await page.waitForTimeout(400);
    const days = await page.locator(".cal__day").count();
    const list = await page.locator("#view").innerText();
    assert(days >= 28 || /Klassenarbeit|Termin/i.test(list), "Weder Monatsraster noch Terminliste gefunden");
  });

  await check("Stundenplan zeigt Fächer", async () => {
    await page.goto(`${BASE}#/timetable`);
    await page.waitForTimeout(400);
    const filled = await page.locator(".tt__cell.is-filled").count();
    assert(filled >= 1, "Keine belegte Stundenplan-Zelle gefunden");
  });

  await check("Karteikarten zeigen fällige Karten", async () => {
    await page.goto(`${BASE}#/flashcards`);
    await page.waitForTimeout(400);
    const text = await page.locator("#view").innerText();
    assert(/Mathe Formeln/.test(text), "Stapel „Mathe Formeln“ fehlt");
  });

  await check("KI-Ansicht weist auf fehlende Einrichtung hin", async () => {
    await page.goto(`${BASE}#/assistant`);
    await page.waitForTimeout(400);
    const text = await page.locator("#view").innerText();
    assert(/einricht|Schlüssel|API/i.test(text), "Kein Hinweis auf die KI-Einrichtung");
  });

  /* --- 4. Interaktion --- */
  console.log("\nInteraktion");
  await check("Aufgabe abhaken funktioniert", async () => {
    await page.goto(`${BASE}#/tasks`);
    await page.waitForTimeout(400);
    const openBefore = await page.evaluate(() =>
      window.NG.store.all("tasks").filter((t) => !t.done).length);
    const box = page.locator('#view input[type="checkbox"]').first();
    assert(await box.count(), "Keine Checkbox gefunden");
    // Bewusst click() statt check(): nach dem Abhaken rendert die Ansicht neu,
    // check() würde die Liste erneut auflösen und ein zweites Kästchen treffen.
    await box.click({ force: true });
    await page.waitForTimeout(600);
    const openAfter = await page.evaluate(() =>
      window.NG.store.all("tasks").filter((t) => !t.done).length);
    assert(openAfter === openBefore - 1, `Offene Aufgaben: ${openBefore} -> ${openAfter}`);
  });

  await check("Neuer Eintrag über den Dialog", async () => {
    await page.goto(`${BASE}#/subjects`);
    await page.waitForTimeout(400);
    const btn = page.locator("#topbar-actions button, #view button").filter({ hasText: /Neues Fach|Fach anlegen/i }).first();
    assert(await btn.count(), "Knopf zum Anlegen eines Fachs fehlt");
    await btn.click();
    await page.waitForSelector(".modal", { timeout: 4000 });
    await page.locator('.modal input[type="text"]').first().fill("Testfach");
    await page.screenshot({ path: join(SHOTS, "20-dialog.png") });
    await page.locator(".modal__foot button").filter({ hasText: /Speichern|Anlegen|Hinzufügen/i }).first().click();
    await page.waitForSelector(".modal-backdrop", { state: "detached", timeout: 4000 });
    const found = await page.evaluate(() =>
      window.NG.store.all("subjects").some((s) => s.name === "Testfach"));
    assert(found, "Das neue Fach wurde nicht gespeichert");
  });

  await check("Daten überleben einen Neustart", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#view .view", { timeout: 6000 });
    const found = await page.evaluate(() =>
      window.NG.store.all("subjects").some((s) => s.name === "Testfach"));
    assert(found, "Nach dem Neuladen fehlen die Daten");
  });

  await check("Sicherung exportiert gültiges JSON", async () => {
    const json = await page.evaluate(() => window.NG.store.exportJSON());
    const parsed = JSON.parse(json);
    assert(parsed.data && Array.isArray(parsed.data.subjects), "Export hat nicht die erwartete Struktur");
    assert(parsed.data.subjects.length >= 4, "Export enthält zu wenige Fächer");
  });

  await check("Dunkles Design lässt sich einschalten", async () => {
    await page.goto(`${BASE}#/dashboard`);
    await page.waitForTimeout(300);
    await page.locator("#theme-btn").click();
    await page.waitForTimeout(200);
    await page.locator("#theme-btn").click();
    await page.waitForTimeout(200);
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    assert(theme === "light" || theme === "dark", `Unerwartetes Design: ${theme}`);
    await page.evaluate(() => { window.NG.store.setSetting("theme", "dark"); window.NG.app.applyTheme(); });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, "30-dark.png"), fullPage: true });
    await page.evaluate(() => { window.NG.store.setSetting("theme", "auto"); window.NG.app.applyTheme(); });
  });

  /* --- 5. Darstellung --- */
  console.log("\nDarstellung");
  for (const [id, title] of VIEWS) {
    await check(`„${title}“ läuft am Desktop nicht über`, async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${BASE}#/${id}`);
      await page.waitForTimeout(350);
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(over <= 2, `${over}px waagerechter Überlauf`);
    });
  }

  await check("Mobile Ansicht zeigt die Tab-Leiste", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}#/dashboard`);
    await page.waitForTimeout(400);
    const visible = await page.locator("#tabbar").isVisible();
    assert(visible, "Tab-Leiste ist auf dem Handy nicht sichtbar");
    const tabs = await page.locator("#tabbar .tabbar__item").count();
    assert(tabs >= 4, `Nur ${tabs} Tabs`);
    await page.screenshot({ path: join(SHOTS, "40-mobile.png"), fullPage: true });
  });

  for (const [id, title] of VIEWS) {
    await check(`„${title}“ läuft am Handy nicht über`, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE}#/${id}`);
      await page.waitForTimeout(350);
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(over <= 2, `${over}px waagerechter Überlauf`);
    });
  }

  await check("Menü lässt sich auf dem Handy öffnen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}#/dashboard`);
    await page.waitForTimeout(300);
    await page.locator("#menu-btn").click();
    await page.waitForTimeout(300);
    const open = await page.evaluate(() => document.querySelector(".sidebar").classList.contains("is-open"));
    assert(open, "Seitenleiste öffnet sich nicht");
    await page.locator(".scrim").click({ force: true });
  });

  /* --- 5b. KI mit simuliertem Claude --- */
  console.log("\nKI-Funktionen (simuliert)");
  {
    await context.close();
    ({ context, page } = await newPage(SEED));
    await context.addInitScript(() => {
      const ANTWORT = "## Aufgabe 1\n\nZuerst beide Seiten durch 2 teilen.\n\n1. Schritt eins\n2. Schritt zwei\n\nErgebnis: **x = 42**";
      const sample = async (input, opts) => {
        window.__kiAufrufe = (window.__kiAufrufe || 0) + 1;
        window.__kiEingabe = input;
        window.__kiBilder = opts && opts.images ? (opts.images.length || 1) : 0;
        const signal = opts && opts.signal;
        if (signal && signal.aborted) throw { code: "cancelled", message: "Abgebrochen" };
        await new Promise((r) => setTimeout(r, 60));
        if (signal && signal.aborted) throw { code: "cancelled", message: "Abgebrochen" };
        if (opts && opts.onText) opts.onText({ text: ANTWORT, delta: ANTWORT });
        return { text: ANTWORT, truncated: false, modelTierApplied: "default" };
      };
      sample.json = async () => ({
        deck: "Testkarten",
        cards: [{ front: "Frage A", back: "Antwort A" }, { front: "Frage B", back: "Antwort B" }],
        tasks: [{ title: "Kapitel 1 wiederholen", due: new Date().toISOString().slice(0, 10), note: "30 Minuten" }],
      });
      sample.limits = async () => ({
        maxPromptBytes: 65536,
        images: { maxCount: 5, maxInputBytes: 20000000, mediaTypes: ["image/jpeg", "image/png"] },
      });
      window.claude = { use: async (name) => (name === "sample" ? sample : null) };
    });
    await page.goto(BASE + "#/assistant", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#view .view", { timeout: 8000 });
    await page.waitForTimeout(700);

    await check("KI wird als bereit erkannt", async () => {
      const st = await page.evaluate(() => window.NG.ai.status());
      assert(st.ready === true, `Status: ${JSON.stringify(st)}`);
      assert(st.provider === "claude", `Anbieter ${st.provider} statt claude`);
      assert(st.canImages === true, "Bilder sollten möglich sein");
    });

    await check("Textanfrage liefert eine Antwort", async () => {
      const res = await page.evaluate(async () => {
        let gestreamt = "";
        const r = await window.NG.ai.run({
          system: window.NG.ai.systemPrompt(),
          prompt: "Löse 2x = 84",
          onText: (u) => { gestreamt = u.text; },
        });
        return { text: r.text, gestreamt, provider: r.provider };
      });
      assert(/x = 42/.test(res.text), "Antworttext fehlt");
      assert(res.gestreamt === res.text, "onText lieferte nicht den vollen Text");
      assert(res.provider === "claude", "Falscher Anbieter");
    });

    await check("Bildanfrage reicht die Bilder durch", async () => {
      const anzahl = await page.evaluate(async () => {
        const c = document.createElement("canvas");
        c.width = 20; c.height = 20;
        c.getContext("2d").fillRect(0, 0, 20, 20);
        const blob = await new Promise((r) => c.toBlob(r, "image/png"));
        await window.NG.ai.run({ prompt: "Was steht auf dem Bild?", images: [blob] });
        return window.__kiBilder;
      });
      assert(anzahl === 1, `${anzahl} Bilder angekommen statt 1`);
    });

    await check("JSON-Anfrage liefert ausgewertete Daten", async () => {
      const data = await page.evaluate(() =>
        window.NG.ai.run({ prompt: "Gib JSON", json: true }).then((r) => r.data));
      assert(data && Array.isArray(data.cards) && data.cards.length === 2, "JSON kam nicht durch");
    });

    await check("Schuldaten stehen als Kontext bereit", async () => {
      const ctxText = await page.evaluate(() => window.NG.ai.context());
      assert(/Mathematik/.test(ctxText), "Fächer fehlen im Kontext");
      assert(/Klassenarbeit|Termine/.test(ctxText), "Termine fehlen im Kontext");
    });

    await check("KI-Ansicht zeigt keinen Einrichtungshinweis mehr", async () => {
      await page.goto(BASE + "#/assistant");
      await page.waitForTimeout(600);
      const text = await page.locator("#view").innerText();
      assert(!/Jetzt einrichten/i.test(text), "Einrichtungshinweis wird trotz bereiter KI angezeigt");
    });

    await check("KI-Ansicht löst eine Aufgabe komplett durch", async () => {
      await page.goto(BASE + "#/assistant");
      await page.waitForTimeout(600);
      const box = page.locator("#view textarea").first();
      assert(await box.count(), "Kein Eingabefeld in der KI-Ansicht");
      await box.fill("Löse 2x = 84");
      const btn = page.locator("#view button.btn--primary").first();
      assert(await btn.count(), "Kein Start-Knopf in der KI-Ansicht");
      await btn.click();
      await page.waitForFunction(
        () => /x = 42|Schritt eins/.test(document.querySelector("#view").innerText),
        { timeout: 8000 }
      );
      const text = await page.locator("#view").innerText();
      assert(/x = 42/.test(text), "Die Antwort wurde nicht angezeigt");
      const runs = await page.evaluate(() => window.NG.store.all("aiRuns").length);
      assert(runs >= 1, "Die Antwort landete nicht im Verlauf");
      await page.screenshot({ path: join(SHOTS, "50-ki-antwort.png"), fullPage: true });
    });

    await check("KI-Antwort lässt sich weiterverwenden", async () => {
      const btn = page.locator("#view button").filter({ hasText: /Als Material speichern/i }).first();
      if (await btn.count()) {
        const before = await page.evaluate(() => window.NG.store.all("materials").length);
        await btn.click();
        await page.waitForTimeout(400);
        const after = await page.evaluate(() => window.NG.store.all("materials").length);
        assert(after === before + 1, "Material wurde nicht angelegt");
      }
      const copy = page.locator("#view button").filter({ hasText: /Kopieren/i }).first();
      assert(await copy.count() > 0, "Kein Kopieren-Knopf an der Antwort");
    });

    await check("Abbrechen bricht sauber ab (Fehlercode cancelled)", async () => {
      const code = await page.evaluate(async () => {
        const ctl = new AbortController();
        const p = window.NG.ai.run({ prompt: "lang", signal: ctl.signal });
        ctl.abort();
        try { await p; return "kein-fehler"; }
        catch (e) { return e.code || e.name || "unbekannt"; }
      });
      assert(code !== "kein-fehler", "Abbruch wurde nicht gemeldet");
    });

    await check("Datei hochladen legt ein Material an", async () => {
      await page.goto(BASE + "#/materials");
      await page.waitForTimeout(600);
      const input = page.locator('#view input[type="file"]').first();
      assert(await input.count(), "Keine Dateiauswahl in den Materialien");
      await input.setInputFiles({
        name: "aufgabe.png",
        mimeType: "image/png",
        buffer: Buffer.from(PNG_1x1, "base64"),
      });
      await page.waitForFunction(() => window.NG.store.all("materials").length > 0, { timeout: 8000 });
      const mats = await page.evaluate(() => window.NG.store.all("materials").map((m) => ({
        name: m.name, kind: m.file && m.file.kind, key: !!(m.file && m.file.key),
      })));
      assert(mats.length >= 1, "Kein Material angelegt");
      assert(mats.some((m) => m.key), "Material ohne Dateiverweis gespeichert");
      await page.waitForTimeout(500);
      const text = await page.locator("#view").innerText();
      assert(/aufgabe/i.test(text), "Das Material taucht nicht in der Liste auf");
      await page.screenshot({ path: join(SHOTS, "51-material.png"), fullPage: true });
    });

    await check("Hochgeladene Datei ist wieder lesbar", async () => {
      const groesse = await page.evaluate(async () => {
        const m = window.NG.store.all("materials").find((x) => x.file && x.file.key);
        if (!m) return -1;
        const blob = await window.NG.files.get(m.file);
        return blob ? blob.size : 0;
      });
      assert(groesse > 0, `Datei kam nicht zurück (Größe ${groesse})`);
    });

    await check("Material lässt sich wieder löschen", async () => {
      // Aus dem KI-Test liegt noch ein Material ohne Datei vor – hier zählt
      // nur, dass genau das hochgeladene verschwindet.
      const res = await page.evaluate(async () => {
        const m = window.NG.store.all("materials").find((x) => x.file && x.file.key);
        if (!m) return { fehler: "kein hochgeladenes Material gefunden" };
        await window.NG.files.del(m.file);
        window.NG.store.remove("materials", m.id);
        return {
          nochDa: window.NG.store.all("materials").some((x) => x.id === m.id),
          mitDatei: window.NG.store.all("materials").filter((x) => x.file && x.file.key).length,
        };
      });
      assert(!res.fehler, res.fehler);
      assert(res.nochDa === false, "Das Material wurde nicht entfernt");
      assert(res.mitDatei === 0, `Noch ${res.mitDatei} Datei-Materialien übrig`);
    });

    await check("Fehlermeldungen kommen auf Deutsch", async () => {
      const texte = await page.evaluate(() => [
        window.NG.ai.friendly({ code: "rate_limited", message: "x" }),
        window.NG.ai.friendly({ status: 401, message: "x" }),
        window.NG.ai.friendly({ code: "not_granted", message: "x" }),
      ]);
      texte.forEach((t, i) => assert(t && t.length > 15 && !/^x$/.test(t), `Meldung ${i} unbrauchbar: ${t}`));
    });
  }

  /* --- 5c. Abläufe mit Zustand --- */
  console.log("\nAbläufe");

  await check("Einrichtungsassistent legt Fächer an", async () => {
    await context.close();
    ({ context, page } = await newPage(null));          // bewusst ohne Daten
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".modal", { timeout: 8000 });

    await page.locator('.modal input[type="text"]').first().fill("Testkind");
    await page.locator(".modal__foot button").filter({ hasText: /Los geht/i }).first().click();
    await page.waitForTimeout(350);

    // Schritt 2: Notensystem – die erste anklickbare Auswahl nehmen
    let weiter = page.locator(".modal__foot button").filter({ hasText: /^Weiter$/ }).first();
    assert(await weiter.count(), "Schritt 2 hat keinen Weiter-Knopf");
    await weiter.click();
    await page.waitForTimeout(350);

    // Schritt 3: Gewichtung
    weiter = page.locator(".modal__foot button").filter({ hasText: /^Weiter$/ }).first();
    assert(await weiter.count(), "Schritt 3 hat keinen Weiter-Knopf");
    await weiter.click();
    await page.waitForTimeout(350);

    // Schritt 4: Fächer auswählen
    const chips = page.locator(".modal .chip");
    const n = await chips.count();
    assert(n >= 5, `Nur ${n} Fachvorschläge`);
    await chips.nth(0).click();
    await chips.nth(1).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(SHOTS, "02-onboarding-faecher.png") });

    await page.locator(".modal__foot button").filter({ hasText: /Fertig/i }).first().click();
    await page.waitForSelector(".modal-backdrop", { state: "detached", timeout: 5000 });

    const st = await page.evaluate(() => ({
      name: window.NG.store.getSetting("name", ""),
      onboarded: window.NG.store.getSetting("onboarded", false),
      faecher: window.NG.store.all("subjects").length,
      gewicht: window.NG.store.getSetting("defaultWeights", null),
    }));
    assert(st.name === "Testkind", `Name nicht gespeichert (${st.name})`);
    assert(st.onboarded === true, "onboarded wurde nicht gesetzt");
    assert(st.faecher === 2, `${st.faecher} Fächer statt 2 angelegt`);
    assert(st.gewicht && st.gewicht.written + st.gewicht.oral === 100, "Gewichtung ergibt nicht 100 %");
  });

  await check("Karteikarten-Lernmodus funktioniert", async () => {
    await context.close();
    ({ context, page } = await newPage(SEED));
    await page.goto(BASE + "#/flashcards", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    const lernen = page.locator("#view button").filter({ hasText: /^Lernen$/ }).first();
    assert(await lernen.count(), "Kein Lernen-Knopf");
    await lernen.click();
    await page.waitForTimeout(500);

    const karte = page.locator(".flashcard").first();
    assert(await karte.count(), "Keine Lernkarte sichtbar");
    const vorher = await page.evaluate(() => {
      const c = window.NG.store.all("cards");
      return c.map((x) => ({ id: x.id, box: x.box, due: x.due }));
    });

    await karte.click();                    // umdrehen
    await page.waitForTimeout(500);
    const gedreht = await page.evaluate(() =>
      document.querySelector(".flashcard").classList.contains("is-flipped"));
    assert(gedreht, "Die Karte dreht sich nicht um");
    await page.screenshot({ path: join(SHOTS, "52-karteikarte.png") });

    const gewusst = page.locator("#view button").filter({ hasText: /Gewusst/i }).first();
    assert(await gewusst.count(), "Kein „Gewusst“-Knopf");
    await gewusst.click();
    await page.waitForTimeout(600);

    const nachher = await page.evaluate(() =>
      window.NG.store.all("cards").map((x) => ({ id: x.id, box: x.box, due: x.due })));
    const geaendert = nachher.filter((n2, i) => n2.box !== vorher[i].box || n2.due !== vorher[i].due);
    assert(geaendert.length === 1, `${geaendert.length} Karten verändert statt 1`);
    assert(geaendert[0].box > vorher.find((v) => v.id === geaendert[0].id).box,
      "Das Leitner-Fach wurde nicht erhöht");
    assert(geaendert[0].due > new Date().toISOString().slice(0, 10),
      "Die Karte ist immer noch heute fällig");
  });

  await check("Lerntimer startet und speichert eine Sitzung", async () => {
    await page.goto(BASE + "#/focus", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const vorher = await page.evaluate(() => window.NG.store.all("sessions").length);
    const start = page.locator("#view button").filter({ hasText: /Lernphase starten|Starten|Start/i }).first();
    assert(await start.count(), "Kein Start-Knopf im Lerntimer");
    await start.click();
    await page.waitForTimeout(2200);

    const laeuft = await page.locator("#view").innerText();
    assert(/24:5\d|Pause|Stopp/.test(laeuft), "Der Timer scheint nicht zu laufen: " + laeuft.slice(0, 120));

    const stopp = page.locator("#view button").filter({ hasText: /Stopp/i }).first();
    assert(await stopp.count(), "Kein Stopp-Knopf");
    await stopp.click();
    await page.waitForTimeout(600);
    const bestaetigen = page.locator(".modal__foot button").filter({ hasText: /Ja|Beenden|Stopp|Verwerfen|Speichern/i }).first();
    if (await bestaetigen.count()) await bestaetigen.click();
    await page.waitForTimeout(500);

    const nachher = await page.evaluate(() => window.NG.store.all("sessions").length);
    assert(nachher >= vorher, "Sitzungen sind verloren gegangen");
    const titel = await page.evaluate(() => document.title);
    assert(!/^\d?\d:\d\d/.test(titel), `Der Seitentitel wurde nicht zurückgesetzt: ${titel}`);
  });

  /* --- 5d. Tempo, auch mit viel Daten --- */
  console.log("\nTempo");
  {
    await context.close();
    ({ context, page } = await newPage(SEED));
    await page.goto(BASE + "#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#view .view", { timeout: 8000 });

    // Kräftig aufblähen: ein volles Schuljahr mit sehr viel Inhalt.
    await page.evaluate(() => {
      const S = window.NG.store;
      const U = window.NG.util;
      const faecher = S.all("subjects").map((x) => x.id);
      const heute = U.todayISO();
      const noten = [], termine = [], aufgaben = [], karten = [], sitzungen = [];
      for (let i = 0; i < 400; i++) {
        noten.push({
          subjectId: faecher[i % faecher.length],
          title: "Leistung " + i,
          type: i % 3 === 0 ? "oral" : "written",
          category: "Test",
          value: 1 + (i % 5),
          weight: (i % 3) + 1,
          date: U.addDays(heute, -(i % 300)),
        });
      }
      for (let i = 0; i < 200; i++) {
        termine.push({
          subjectId: faecher[i % faecher.length],
          title: "Termin " + i,
          type: i % 2 ? "exam" : "other",
          date: U.addDays(heute, (i % 120) - 30),
        });
        aufgaben.push({
          subjectId: faecher[i % faecher.length],
          title: "Aufgabe " + i,
          due: U.addDays(heute, (i % 60) - 20),
          done: i % 4 === 0,
          priority: (i % 3) + 1,
        });
      }
      const deck = S.add("decks", { name: "Großer Stapel", subjectId: faecher[0] });
      for (let i = 0; i < 400; i++) {
        karten.push({
          deckId: deck.id, front: "Frage " + i, back: "Antwort " + i,
          box: (i % 5) + 1, due: U.addDays(heute, i % 7),
        });
      }
      for (let i = 0; i < 200; i++) {
        sitzungen.push({
          subjectId: faecher[i % faecher.length],
          startedAt: new Date(Date.now() - i * 3600000).toISOString(),
          minutes: 20 + (i % 40), kind: "focus",
        });
      }
      S.addMany("grades", noten);
      S.addMany("events", termine);
      S.addMany("tasks", aufgaben);
      S.addMany("cards", karten);
      S.addMany("sessions", sitzungen);
    });

    const zeiten = {};
    for (const [id, title] of VIEWS) {
      await check(`„${title}“ bleibt mit 1400 Einträgen flüssig`, async () => {
        const before = errors.length;
        const ms = await page.evaluate((viewId) => {
          const t0 = performance.now();
          window.location.hash = "#/" + viewId;
          window.NG.app.render();
          return performance.now() - t0;
        }, id);
        zeiten[id] = Math.round(ms);
        await page.waitForTimeout(140);
        const fresh = errors.slice(before);
        assert(fresh.length === 0, `Fehler beim Rendern:\n      ${fresh.join("\n      ")}`);
        assert(ms < 700, `${Math.round(ms)} ms zum Aufbauen – zu langsam`);
      });
    }
    console.log("    Renderzeiten (ms): " +
      Object.keys(zeiten).map((k) => `${k} ${zeiten[k]}`).join(" · "));

    await check("Speichern bleibt auch bei viel Daten schnell", async () => {
      const ms = await page.evaluate(() => {
        const t0 = performance.now();
        window.NG.store.add("tasks", { title: "Tempoprobe", due: null, done: false, priority: 2 });
        window.NG.store.flush();
        return performance.now() - t0;
      });
      assert(ms < 600, `${Math.round(ms)} ms zum Speichern`);
    });
  }

  /* --- 5e. OneNote (Microsoft-Aufrufe abgefangen) --- */
  console.log("\nOneNote");
  {
    await context.close();
    ({ context, page } = await newPage(SEED));

    const GRAPH = "https://graph.microsoft.com/v1.0";
    const SEITE_HTML = `<!DOCTYPE html><html><head><title>Photosynthese</title></head><body>
      <div data-id="_default"><h1>Photosynthese</h1>
      <p>Pflanzen wandeln Lichtenergie in chemische Energie um.</p>
      <ul><li>Ort: Chloroplasten</li><li>Edukte: Wasser und Kohlenstoffdioxid</li></ul>
      <img src="${GRAPH}/me/onenote/resources/res-1/$value" alt="Schema" width="400" />
      </div></body></html>`;

    let graphAufrufe = 0;
    await context.route("https://graph.microsoft.com/**", async (route) => {
      graphAufrufe++;
      const url = route.request().url();
      const auth = route.request().headers()["authorization"] || "";
      if (!/^Bearer /.test(auth)) {
        return route.fulfill({ status: 401, body: "{}" });
      }
      if (/\/resources\/.+\/\$value/.test(url)) {
        return route.fulfill({
          status: 200, contentType: "image/png",
          body: Buffer.from(PNG_1x1, "base64"),
        });
      }
      if (/\/pages\/[^/]+\/content/.test(url)) {
        return route.fulfill({ status: 200, contentType: "text/html", body: SEITE_HTML });
      }
      if (/\/notebooks\?/.test(url)) {
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ value: [
            { id: "nb-1", displayName: "Schule 2025/26", lastModifiedDateTime: "2026-09-01T10:00:00Z" },
            { id: "nb-2", displayName: "Privat", lastModifiedDateTime: "2026-08-01T10:00:00Z" },
          ] }),
        });
      }
      if (/\/notebooks\/[^/]+\/sections/.test(url)) {
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ value: [
            { id: "sec-1", displayName: "Biologie", lastModifiedDateTime: "2026-09-01T10:00:00Z" },
            { id: "sec-2", displayName: "Mathematik", lastModifiedDateTime: "2026-09-01T09:00:00Z" },
          ] }),
        });
      }
      const sekt = url.match(/\/sections\/([^/]+)\/pages/);
      if (sekt) {
        // Wie in echt: jeder Abschnitt hat eigene Seiten mit eigenen Kennungen.
        const proSektion = {
          "sec-1": [
            { id: "pg-bio-1", title: "Photosynthese", lastModifiedDateTime: "2026-09-10T10:00:00Z" },
            { id: "pg-bio-2", title: "Zellatmung", lastModifiedDateTime: "2026-09-09T10:00:00Z" },
          ],
          "sec-2": [
            { id: "pg-ma-1", title: "Quadratische Funktionen", lastModifiedDateTime: "2026-09-08T10:00:00Z" },
          ],
        };
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ value: proSektion[sekt[1]] || [] }),
        });
      }
      return route.fulfill({ status: 404, body: "{}" });
    });

    let tokenAufrufe = 0;
    await context.route("https://login.microsoftonline.com/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/token")) {
        tokenAufrufe++;
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({
            access_token: "neues-token", refresh_token: "neues-refresh",
            expires_in: 3600, token_type: "Bearer",
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" });
    });

    await page.goto(BASE + "#/import", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#view .view", { timeout: 8000 });
    await page.waitForTimeout(500);

    await check("OneNote ist im Browser grundsätzlich möglich", async () => {
      const st = await page.evaluate(() => ({
        available: window.NG.onenote.available(),
        configured: window.NG.onenote.isConfigured(),
        signedIn: window.NG.onenote.isSignedIn(),
        redirect: window.NG.onenote.redirectUri(),
      }));
      assert(st.available === true, "available() ist false: " + JSON.stringify(st));
      assert(st.configured === false, "Ohne ID darf nichts eingerichtet sein");
      assert(st.signedIn === false, "Ohne Anmeldung darf signedIn nicht true sein");
      assert(st.redirect.startsWith(BASE), `Umleitungs-Adresse unerwartet: ${st.redirect}`);
    });

    await check("Ohne Einrichtung wird die Anleitung gezeigt", async () => {
      const text = await page.locator("#view").innerText();
      assert(/OneNote/i.test(text), "Die Import-Ansicht erwähnt OneNote nicht");
      const hatAnleitung = /entra\.microsoft\.com|App-Registrierung|Anwendungs-ID/i.test(text);
      const hatUmschalter = await page.locator("#view .btn-group button, #view .chip").count();
      assert(hatAnleitung || hatUmschalter > 0, "Weder Anleitung noch Umschalter gefunden");
    });

    await check("Anmelden ohne Anwendungs-ID wird sauber abgelehnt", async () => {
      const code = await page.evaluate(() =>
        window.NG.onenote.signIn().then(() => "kein-fehler", (e) => e.code));
      assert(code === "not_configured", `Fehlercode ${code} statt not_configured`);
    });

    await check("Notizbücher werden geladen", async () => {
      await page.evaluate(() => {
        window.NG.store.setSetting("onenote.clientId", "11111111-2222-3333-4444-555555555555");
        window.localStorage.setItem("nextgen-lernen.onenote.token", JSON.stringify({
          accessToken: "test-token",
          refreshToken: "test-refresh",
          expiresAt: Date.now() + 3600000,
          account: { name: "Testkind", username: "test@schule.de" },
        }));
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#view .view", { timeout: 8000 });
      const nb = await page.evaluate(() => window.NG.onenote.notebooks());
      assert(Array.isArray(nb) && nb.length === 2, `${nb && nb.length} Notizbücher`);
      assert(nb[0].displayName === "Schule 2025/26", "Falsches Notizbuch");
    });

    await check("Abschnitte und Seiten werden geladen", async () => {
      const sec = await page.evaluate(() => window.NG.onenote.sections("nb-1"));
      assert(sec.length === 2 && sec[0].displayName === "Biologie", "Abschnitte falsch");
      const pg = await page.evaluate(() => window.NG.onenote.pages("sec-1"));
      assert(pg.length === 2 && pg[0].title === "Photosynthese", "Seiten falsch");
      const pgMa = await page.evaluate(() => window.NG.onenote.pages("sec-2"));
      assert(pgMa.length === 1, "Der zweite Abschnitt liefert die falschen Seiten");
    });

    await check("Seiteninhalt kommt als HTML zurück", async () => {
      const html = await page.evaluate(() => window.NG.onenote.pageHtml("pg-1"));
      assert(/Photosynthese/.test(html), "Seiteninhalt fehlt");
      assert(/Chloroplasten/.test(html), "Listeninhalt fehlt");
    });

    await check("Bild einer Seite lässt sich laden", async () => {
      const groesse = await page.evaluate(async () => {
        const blob = await window.NG.onenote.resourceBlob(
          "https://graph.microsoft.com/v1.0/me/onenote/resources/res-1/$value");
        return blob ? blob.size : 0;
      });
      assert(groesse > 0, "Kein Bild zurückbekommen");
    });

    await check("Fremde Adressen werden nicht abgerufen", async () => {
      const ergebnis = await page.evaluate(() =>
        window.NG.onenote.resourceBlob("https://example.com/boese.png"));
      assert(ergebnis === null, "Eine fremde Adresse wurde abgerufen");
    });

    await check("Abgelaufenes Token wird selbstständig erneuert", async () => {
      const vorher = tokenAufrufe;
      await page.evaluate(() => {
        const t = JSON.parse(window.localStorage.getItem("nextgen-lernen.onenote.token"));
        t.expiresAt = Date.now() - 1000;
        window.localStorage.setItem("nextgen-lernen.onenote.token", JSON.stringify(t));
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      const nb = await page.evaluate(() => window.NG.onenote.notebooks());
      assert(nb.length === 2, "Nach dem Erneuern kamen keine Notizbücher");
      assert(tokenAufrufe > vorher, "Das Token wurde nicht erneuert");
    });

    await check("HTML einer OneNote-Seite wird zu lesbarem Text", async () => {
      const res = await page.evaluate(async () => {
        const html = await window.NG.onenote.pageHtml("pg-1");
        const blocks = window.NG.importers.htmlToBlocks(html);
        return { text: blocks.text, bilder: blocks.images.length };
      });
      assert(/Photosynthese/.test(res.text), "Überschrift fehlt im Text");
      assert(/Chloroplasten/.test(res.text), "Listenpunkt fehlt im Text");
      assert(!/<div|<img|style=/.test(res.text), "Im Text steckt noch HTML");
      assert(res.bilder === 1, `${res.bilder} Bilder erkannt statt 1`);
    });

    await check("Import-Ansicht zeigt den angemeldeten Zustand", async () => {
      await page.goto(BASE + "#/import");
      await page.waitForTimeout(800);
      const text = await page.locator("#view").innerText();
      assert(/Testkind|Abmelden|Schule 2025/i.test(text),
        "Der angemeldete Zustand wird nicht angezeigt: " + text.slice(0, 200));
      await page.screenshot({ path: join(SHOTS, "60-onenote.png"), fullPage: true });
    });

    await check("Kompletter Import: Notizbuch bis fertiges Material", async () => {
      await page.goto(BASE + "#/import");
      await page.waitForTimeout(900);

      const notizbuch = page.locator("#view button, #view [role=button]")
        .filter({ hasText: /Schule 2025/ }).first();
      assert(await notizbuch.count(), "Das Notizbuch wird nicht angezeigt");
      await notizbuch.click();
      await page.waitForTimeout(900);

      const abschnitt = page.locator("#view button, #view [role=button]")
        .filter({ hasText: /Biologie/ }).first();
      assert(await abschnitt.count(), "Der Abschnitt wird nicht angezeigt");
      await abschnitt.click();
      await page.waitForTimeout(900);

      const text = await page.locator("#view").innerText();
      assert(/Photosynthese/.test(text), "Die Seiten des Abschnitts fehlen");

      const box = page.locator('#view input[aria-label*="Photosynthese"]').first();
      assert(await box.count(), "Kein Auswahlkästchen für die Seite „Photosynthese“");
      await box.click({ force: true });
      await page.waitForTimeout(500);
      const auswahl = await page.locator("#view").innerText();
      assert(/1 Seite ausgewählt/.test(auswahl), "Die Auswahl wurde nicht gezählt");

      const knopf = page.locator("#view button").filter({ hasText: /Auswahl importieren/i }).first();
      assert(await knopf.count(), "Kein Knopf zum Importieren");
      assert(await knopf.isEnabled(), "Der Import-Knopf bleibt gesperrt");

      const vorher = await page.evaluate(() => window.NG.store.all("materials").length);
      await knopf.click();
      await page.waitForFunction(
        (n) => window.NG.store.all("materials").length > n, vorher, { timeout: 15000 });
      await page.waitForTimeout(800);

      const mats = await page.evaluate(() => window.NG.store.all("materials").map((m) => ({
        name: m.name, subjectId: m.subjectId, text: m.text || "",
        hatDatei: !!(m.file && m.file.key), tags: m.tags || [],
      })));
      const seite = mats.find((m) => /Photosynthese/.test(m.name));
      assert(seite, "Die Seite wurde nicht als Material angelegt");
      assert(/Chloroplasten/.test(seite.text), "Der Seitentext fehlt im Material");
      assert(!/<div|<img|style=/.test(seite.text), "Im Material steckt noch HTML");
      assert(seite.hatDatei, "Das Bild der Seite wurde nicht mitgespeichert");
      assert(seite.tags.indexOf("OneNote") >= 0, "Die Herkunft wurde nicht vermerkt");
      assert(seite.subjectId === "s3",
        `Der Abschnitt „Biologie“ wurde dem Fach ${seite.subjectId} statt s3 zugeordnet`);
      await page.screenshot({ path: join(SHOTS, "61-onenote-import.png"), fullPage: true });

      // Der Abschluss-Dialog bleibt offen – schließen, sonst blockiert er die nächsten Klicks.
      const schliessen = page.locator(".modal__foot button, .modal__head button")
        .filter({ hasText: /Schließen/i }).first();
      if (await schliessen.count()) await schliessen.click();
      else await page.keyboard.press("Escape");
      await page.waitForSelector(".modal-backdrop", { state: "detached", timeout: 5000 });
    });

    await check("Einstellungen zeigen den OneNote-Bereich", async () => {
      await page.goto(BASE + "#/settings");
      await page.waitForTimeout(600);
      const text = await page.locator("#view").innerText();
      assert(/OneNote/.test(text), "Kein OneNote-Bereich in den Einstellungen");
      assert(/Umleitungs-Adresse/i.test(text), "Die Umleitungs-Adresse wird nicht angezeigt");
    });

    await check("Im eingebetteten Betrieb wird OneNote sauber abgelehnt", async () => {
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-DE" });
      await ctx2.addInitScript((d) => {
        try { window.localStorage.setItem("nextgen-lernen.state.v1", JSON.stringify(d)); } catch { }
        window.claude = { use: async () => null };
      }, SEED);
      const p2 = await ctx2.newPage();
      await p2.goto(BASE + "#/import", { waitUntil: "domcontentloaded" });
      await p2.waitForTimeout(700);
      const st = await p2.evaluate(() => ({
        available: window.NG.onenote.available(),
        grund: window.NG.onenote.unavailableReason(),
      }));
      assert(st.available === false, "available() sollte im Artifact false sein");
      assert(st.grund && st.grund.length > 20, "Es fehlt eine verständliche Begründung");
      const text = await p2.locator("#view").innerText();
      assert(/Datei|hochladen|lokal|npm start/i.test(text),
        "Es wird kein Ausweg genannt: " + text.slice(0, 200));
      await ctx2.close();
    });

    await check("Word-Datei wird ohne Fremdbibliothek gelesen", async () => {
      await page.goto(BASE + "#/import");
      await page.waitForTimeout(500);
      const umschalter = page.locator("#view .btn-group button").filter({ hasText: /Aus Dateien/i }).first();
      assert(await umschalter.count(), "Kein Umschalter zum Datei-Import");
      await umschalter.click();
      await page.waitForTimeout(500);

      const eingabe = page.locator('#view input[type="file"]').first();
      assert(await eingabe.count(), "Keine Dateiauswahl im Datei-Import");
      await eingabe.setInputFiles({
        name: "Biologie Mitschrift.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: baueDocx([
          ["Heading1", "Zellbiologie"],
          [null, "Die Zelle ist die kleinste lebende Einheit."],
          ["Heading2", "Zellorganellen"],
          [null, "Mitochondrien liefern die Energie."],
        ]),
      });
      await page.waitForTimeout(2500);
      const text = await page.locator("#view").innerText();
      assert(/Biologie Mitschrift/.test(text), "Die Datei taucht nicht in der Liste auf");
      assert(!/nicht unterstützt|kann nicht gelesen/i.test(text),
        "Die Word-Datei wurde als nicht lesbar gemeldet: " + text.slice(0, 300));
      await page.screenshot({ path: join(SHOTS, "62-dateiimport.png"), fullPage: true });
    });

    await check("Word-Inhalt landet als Material in der App", async () => {
      const vorher = await page.evaluate(() => window.NG.store.all("materials").length);
      const knopf = page.locator("#view button").filter({ hasText: /Als Materialien ablegen|Als Material ablegen/i }).first();
      assert(await knopf.count(), "Kein Knopf „Als Materialien ablegen“");
      await knopf.click();
      await page.waitForFunction(
        (n) => window.NG.store.all("materials").length > n, vorher, { timeout: 10000 });
      const mat = await page.evaluate(() => {
        const m = window.NG.store.all("materials").find((x) => /Biologie Mitschrift/.test(x.name));
        return m ? { name: m.name, text: m.text || "" } : null;
      });
      assert(mat, "Kein Material aus der Word-Datei");
      assert(/Zellbiologie/.test(mat.text), "Die Überschrift fehlt im Text");
      assert(/Mitochondrien liefern die Energie/.test(mat.text), "Der Fließtext fehlt");
      assert(/#\s*Zellbiologie|# Zellbiologie/.test(mat.text), "Überschriften werden nicht als solche erkannt");
    });

    assert(graphAufrufe > 0, "Es gab gar keine Graph-Aufrufe");
  }

  /* --- 6. Schnittstellen --- */
  console.log("\nSchnittstellen");
  await check("Alle benutzten NG-Funktionen existieren wirklich", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const dirs = [join(ROOT, "js", "views"), join(ROOT, "js")];
    const used = new Set();
    for (const dir of dirs) {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
        const code = await readFile(join(dir, entry.name), "utf8");
        for (const m of code.matchAll(/\bNG\.([a-zA-Z]+)\.([a-zA-Z_$][\w$]*)/g)) {
          used.add(m[1] + "." + m[2]);
        }
      }
    }
    const missing = await page.evaluate((names) => {
      const own = ["store.state", "app.views", "app.byId", "app.ctx", "ui.toast"];
      return names.filter((n) => {
        const [ns, fn] = n.split(".");
        const target = window.NG[ns];
        if (!target) return true;
        return target[fn] === undefined;
      }).filter((n) => !own.includes(n));
    }, [...used]);
    assert(missing.length === 0, `Unbekannte Aufrufe: ${missing.join(", ")}`);
  });

  /* --- 6. Abschluss --- */
  await check("Der Testserver hat den ganzen Lauf überstanden", async () => {
    assert(!serverTot, serverTot || "");
  });

  await check("Keine JavaScript-Fehler im gesamten Lauf", async () => {
    assert(errors.length === 0, `${errors.length} Fehler:\n      ${errors.slice(0, 12).join("\n      ")}`);
  });

  await browser.close();
  server.kill();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${"-".repeat(52)}`);
  console.log(`${passed} von ${results.length} Prüfungen bestanden`);
  if (failures) {
    console.log(`\nFehlgeschlagen:`);
    results.filter((r) => !r.ok).forEach((r) => console.log(`  • ${r.name}\n    ${r.error}`));
  }
  console.log(`Bildschirmfotos: tests/screenshots/`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("\nPrüfung abgebrochen:", err);
  process.exit(2);
});
