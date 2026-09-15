/**
 * Winziger statischer Webserver ohne Abhängigkeiten.
 * Start:  node tools/serve.mjs [port]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 4321);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/** Antwortet nur, solange die Verbindung noch offen ist. */
function sende(res, status, headers, body) {
  if (res.writableEnded || res.headersSent || res.destroyed) return;
  try {
    res.writeHead(status, headers);
    res.end(body);
  } catch {
    try { res.destroy(); } catch { /* Verbindung ist schon weg */ }
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";

    const full = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    if (!full.startsWith(ROOT)) {
      sende(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Verboten");
      return;
    }

    const info = await stat(full);
    const file = info.isDirectory() ? join(full, "index.html") : full;
    const body = await readFile(file);

    sende(res, 200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
    }, body);
  } catch {
    // Auch hier kann die Gegenseite längst weg sein – sende() prüft das.
    sende(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Nicht gefunden");
  }
});

// Ein abgebrochener Download darf den Server nicht umbringen.
server.on("clientError", (_err, socket) => {
  try { socket.destroy(); } catch { /* egal */ }
});
process.on("uncaughtException", (err) => {
  console.error("[Server] Fehler übergangen:", err && err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("[Server] Offene Zusage übergangen:", err && err.message);
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} ist belegt. Starte mit einem anderen Port: node tools/serve.mjs 4322`);
    process.exit(1);
  }
  console.error("[Server]", err && err.message);
});

server.listen(PORT, () => {
  console.log(`NextGen Lernen läuft auf http://localhost:${PORT}`);
});
