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

const VIEWS = [
  ["dashboard", "Übersicht"],
  ["calendar", "Termine"],
  ["tasks", "Aufgaben"],
  ["timetable", "Stundenplan"],
  ["subjects", "Fächer"],
  ["grades", "Noten"],
  ["assistant", "KI-Assistent"],
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
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("Server startete nicht")), 8000);
    server.stdout.on("data", (d) => { if (String(d).includes("läuft auf")) { clearTimeout(t); res(); } });
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
      errors.push(`[console] ${text}`);
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
    await box.check({ force: true });
    await page.waitForTimeout(500);
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
        await new Promise((r) => setTimeout(r, 60));
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

    await check("KI-Ansicht hat einen Start-Knopf", async () => {
      const btn = page.locator("#view button").filter({ hasText: /Loslegen|Aufgaben lösen|Starten|Analysieren|Los geht/i });
      assert(await btn.count() > 0, "Kein erkennbarer Start-Knopf in der KI-Ansicht");
    });

    await check("Abbrechen bricht sauber ab", async () => {
      const code = await page.evaluate(async () => {
        const ctl = new AbortController();
        const p = window.NG.ai.run({ prompt: "lang", signal: ctl.signal });
        ctl.abort();
        try { await p; return "kein-fehler"; }
        catch (e) { return e.code || e.name || "unbekannt"; }
      });
      assert(code !== "kein-fehler", "Abbruch wurde nicht gemeldet");
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
