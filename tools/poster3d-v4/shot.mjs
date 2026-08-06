import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const MIME = { '.html': 'text/html', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((req, res) => {
  const p = join(process.cwd(), decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const shots = JSON.parse(readFileSync(process.argv[2] || 'shots.json', 'utf8'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
for (const s of shots) {
  await page.goto(`http://127.0.0.1:${port}/harness.html?glb=${encodeURIComponent(s.glb)}&orbit=${encodeURIComponent(s.orbit)}`, { timeout: 30000 });
  await Promise.race([
    page.evaluate(() => window.mvReady),
    page.waitForTimeout(20000).then(() => { throw new Error('mv load timeout'); }),
  ]).catch(e => console.log('WARN', s.out, e.message));
  await page.waitForTimeout(400);
  await page.screenshot({ path: s.out });
  console.log('shot:', s.out);
}
if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 5));
await browser.close(); server.close();
