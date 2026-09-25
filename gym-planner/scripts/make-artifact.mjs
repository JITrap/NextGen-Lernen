// Baut aus dist-single/ eine einzelne HTML-Datei mit eingebettetem CSS und JS (für Hosting ohne externe Dateien).
// Aufruf: GP_SINGLE=1 npx vite build && node scripts/make-artifact.mjs [--fragment]
//   --fragment: ohne <html>/<head>/<body>-Hülle (für Seiten-Hoster, die die Hülle selbst setzen)
import fs from 'node:fs';
import path from 'node:path';

const dir = 'dist-single';
const fragment = process.argv.includes('--fragment');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const cssFiles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)];
const jsFiles = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)];
const read = (href) => fs.readFileSync(path.join(dir, href.replace(/^\.\//, '')), 'utf8');

let styles = '';
for (const m of cssFiles) { styles += read(m[1]); html = html.replace(m[0], ''); }
let scripts = '';
for (const m of jsFiles) { scripts += read(m[1]) + '\n'; html = html.replace(m[0], ''); }
html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');

const escapeClose = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
const title = '<title>GymPlanner</title>';
const styleTag = `<style>\n${escapeClose(styles)}\n</style>`;
const scriptTag = `<script type="module">\n${escapeClose(scripts)}</script>`;

let out;
if (fragment) {
  out = `${title}\n${styleTag}\n<div id="root"></div>\n${scriptTag}\n`;
} else {
  // Funktions-Ersetzung: String-Ersatz würde „$“-Muster im minifizierten JS interpretieren.
  html = html.replace(/<title>[^<]*<\/title>/, () => title);
  html = html.replace('</head>', () => `${styleTag}\n</head>`);
  html = html.replace('</body>', () => `${scriptTag}\n</body>`);
  out = html;
}
const outFile = path.join(dir, fragment ? 'gymplanner-artifact.html' : 'gymplanner.html');
fs.writeFileSync(outFile, out);
console.log(outFile, (out.length / 1024 / 1024).toFixed(2) + ' MB');
