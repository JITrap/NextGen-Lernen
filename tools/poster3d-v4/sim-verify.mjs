import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const MIME = { '.html': 'text/html', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };
const server = createServer((req, res) => {
  const p = join(process.cwd(), decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
mkdirSync('out/verify', { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const report = [];

async function runDesktop() {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:${port}/sim/index.html`, { timeout: 30000 });
  const loaded = await page.waitForFunction(() => {
    const mv = document.querySelector('.lp-3d-mount model-viewer');
    return mv && mv.loaded;
  }, { timeout: 30000 }).then(() => true).catch(() => false);
  report.push(['3D geladen', loaded]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'out/verify/sim-front.png' });
  // Env angewendet?
  report.push(['environment-image', await page.evaluate(() => document.querySelector('.lp-3d-mount model-viewer')?.getAttribute('environment-image'))]);
  // Detail-Tour
  await page.click('.lp-thumb[data-target="detail"]');
  await page.waitForTimeout(1200);
  report.push(['Spots (soll 4)', await page.locator('.lp-spot').count()]);
  const geom = await page.evaluate(() => {
    const c = document.querySelector('.lp-detail-canvas');
    const b = c.getBoundingClientRect();
    const want = parseFloat(c.closest('.lp-panel--detail').style.getPropertyValue('--lp-detail-ratio'));
    const img = c.querySelector('img');
    const ib = img.getBoundingClientRect();
    return { canvas: +(b.width / b.height).toFixed(3), want: +want.toFixed(3), imgRatio: +(ib.width / ib.height).toFixed(3), natRatio: +(img.naturalWidth / img.naturalHeight).toFixed(3) };
  });
  report.push(['Canvas-Ratio ist/soll + Bild ist/nat', JSON.stringify(geom)]);
  await page.screenshot({ path: 'out/verify/sim-detail.png' });
  // Karte öffnen: Rahmen-Spot
  await page.click('.lp-spot[data-spot="rahmen"]');
  await page.waitForTimeout(900);
  const fs1 = await page.evaluate(() => {
    const t = document.querySelector('.lp-dcard-text');
    return t ? getComputedStyle(t).fontSize : null;
  });
  report.push(['dcard Textgröße (soll 16px)', fs1]);
  await page.screenshot({ path: 'out/verify/sim-card.png' });
  // Weiter bis Rückseite (design -> weiter = rueckseite)
  await page.click('.lp-dcard-btn[data-dnav="1"]'); // glas
  await page.click('.lp-dcard-btn[data-dnav="1"]'); // design
  await page.waitForTimeout(400);
  await page.click('.lp-dcard-btn[data-dnav="1"]'); // rueckseite -> 3D Rückansicht
  await page.waitForTimeout(2600);
  const orbit = await page.evaluate(() => {
    const mv = document.querySelector('.lp-3d-mount model-viewer');
    const o = mv && mv.getCameraOrbit ? mv.getCameraOrbit() : null;
    return o ? +o.theta.toFixed(2) : null;
  });
  report.push(['Orbit nach Tour-Rückseite (soll ~3.46 rad)', orbit]);
  const activePanel = await page.evaluate(() => document.querySelector('[data-lp-gallery]')?.dataset.lpActive);
  report.push(['aktives Panel nach Rückseite (soll 3d)', activePanel]);
  await page.screenshot({ path: 'out/verify/sim-tour-back.png' });
  report.push(['Fehler', errors.length ? errors.slice(0, 4) : 'keine']);
  await page.close();
}

async function runMobile() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${port}/sim/index.html`, { timeout: 30000 });
  await page.waitForFunction(() => {
    const mv = document.querySelector('.lp-3d-mount model-viewer');
    return mv && mv.loaded;
  }, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'out/verify/sim-mobile.png' });
  const stage = await page.evaluate(() => {
    const s = document.querySelector('.lp-gallery__stage').getBoundingClientRect();
    return { w: Math.round(s.width), h: Math.round(s.height), ratio: +(s.width / s.height).toFixed(3) };
  });
  report.push(['Mobil Stage (ratio soll 0.75)', JSON.stringify(stage)]);
  await page.close();
}

await runDesktop();
await runMobile();
console.log('\n===== SIM REPORT =====');
for (const [k, v] of report) console.log('-', k, '→', typeof v === 'object' ? JSON.stringify(v) : v);
await browser.close(); server.close();
