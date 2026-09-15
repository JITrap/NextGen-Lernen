/**
 * Baut aus index.html die Fassung für ein Claude-Artifact.
 *
 * Ein Artifact bekommt nur den Inhalt von <body> (die Hülle mit
 * <!doctype>, <head> und <body> setzt die Plattform selbst).
 * Ergebnis: dist/artifact.html – CSS und JS bleiben eigene Dateien.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT_DIR = join(ROOT, "dist");

const html = await readFile(join(ROOT, "index.html"), "utf8");

const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) throw new Error("index.html hat keinen <body>-Abschnitt.");

const links = [...html.matchAll(/<link\s+rel="stylesheet"[^>]*>/gi)].map((m) => m[0]);
const title = (html.match(/<title>([^<]*)<\/title>/i) || [, "NextGen Lernen"])[1];

const body = bodyMatch[1]
  .replace(/<noscript>[\s\S]*?<\/noscript>/gi, "")
  .trim();

const out = [
  `<title>${title}</title>`,
  // Die Artifact-Hülle polstert :root mit den Safe-Area-Abständen.
  // Diese App bringt eigene fixe Leisten mit (Topbar, Tab-Leiste, Seitenleiste),
  // die den Abstand selbst über env(safe-area-inset-*) einrechnen – deshalb hier
  // zurücksetzen, sonst wird er doppelt gezählt.
  `<style>:root{padding-top:0;padding-bottom:0}</style>`,
  ...links,
  "",
  body,
  "",
].join("\n");

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, "artifact.html"), out, "utf8");

const files = [
  "css/tokens.css", "css/base.css", "css/components.css",
  "js/core/util.js", "js/core/store.js", "js/core/grades.js", "js/core/files.js",
  "js/core/ai.js", "js/core/ui.js", "js/core/sync.js",
  ...[...body.matchAll(/<script src="(js\/views\/[^"]+)"/g)].map((m) => m[1]),
  "js/app.js",
];

await writeFile(
  join(OUT_DIR, "artifact-files.json"),
  JSON.stringify(Object.fromEntries(files.map((f) => [f, f])), null, 2),
  "utf8"
);

console.log(`dist/artifact.html geschrieben (${out.length} Zeichen)`);
console.log(`dist/artifact-files.json listet ${files.length} Begleitdateien`);
