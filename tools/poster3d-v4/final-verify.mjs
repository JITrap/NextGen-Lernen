/* Schlussverifikation: v3-Preview (Homepage, Queens, 3 Produkt-Stichproben)
   + v2-Gegenprobe (Live ohne Preview-Param). Bewusst langsam getaktet. */
import { chromium } from 'playwright';
import { routeThroughNode } from './net-route.mjs';
import { mkdirSync } from 'node:fs';

const PREVIEW = '?preview_theme_id=194124087629';
const OUT = 'out/final';
mkdirSync(OUT, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true });
await routeThroughNode(ctx);
const page = await ctx.newPage();
const report = [];

async function login() {
  await page.goto('https://limitlessposter.com/password', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(async () => {
    const body = new URLSearchParams({ form_type: 'storefront_password', utf8: '✓', password: 'shieya' });
    await fetch('/password', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }).catch(() => {});
  });
  await pause(1500);
}

async function goSlow(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pause(4000);
  const challenged = await page.evaluate(() => document.body.innerText.includes('Verify you are human') || document.body.innerText.includes('connection needs to be verified'));
  if (challenged) { report.push(['CLOUDFLARE-CHALLENGE bei', url]); return false; }
  return true;
}

await login();

// Homepage v3
if (await goSlow('https://limitlessposter.com/' + PREVIEW)) {
  await pause(2500);
  const tiles = await page.locator('.lp-tile').count();
  const tileImg = await page.evaluate(() => document.querySelector('.lp-tile img')?.currentSrc?.split('/').pop().split('?')[0] || null);
  const stats = await page.evaluate(() => Array.from(document.querySelectorAll('.lp-stats__label')).map(e => e.textContent.trim()).join(' | '));
  const editorial = await page.evaluate(() => Array.from(document.querySelectorAll('img')).some(i => (i.currentSrc || '').includes('lp-editorial-v3')));
  report.push(['home: Kacheln (soll 8)', tiles]);
  report.push(['home: 1. Kachelbild', tileImg]);
  report.push(['home: Stats', stats]);
  report.push(['home: Editorial-Bild neu', editorial]);
  const ts = page.locator('.lp-tiles');
  if (await ts.count()) { await ts.scrollIntoViewIfNeeded(); await pause(1500); }
  await page.screenshot({ path: `${OUT}/home-tiles.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(800);
  await page.screenshot({ path: `${OUT}/home-hero.png` });
}
await pause(8000);

// Produkt-Stichproben (Batch-Produkte, nicht Pilot)
for (const h of ['roaring-jaguar-floral-poster', 'marlboro-f1-racing-car-poster-horizontal-framed-print', 'money-talks-framed-poster-benjamin-franklin-eye-art-print']) {
  if (await goSlow(`https://limitlessposter.com/products/${h}${PREVIEW}`)) {
    const d = await page.evaluate(() => {
      const s = document.querySelector('[data-lp-data]');
      const j = s ? JSON.parse(s.textContent) : {};
      return { glb: j.glb ? j.glb.split('/').pop().split('?')[0] : null, env: !!j.env, size: j.size || null };
    });
    const sizecompLabel = await page.evaluate(() => document.querySelector('.lp-sizecomp-label')?.textContent?.trim() || null);
    report.push([`produkt ${h.slice(0, 28)}…`, JSON.stringify(d)]);
    report.push([`  größenvergleich`, sizecompLabel]);
    await pause(2500);
    await page.screenshot({ path: `${OUT}/prod-${h.slice(0, 24)}.png` });
  }
  await pause(8000);
}

// Queens
if (await goSlow('https://limitlessposter.com/collections/queens-feminine-energy' + PREVIEW)) {
  await pause(1500);
  await page.screenshot({ path: `${OUT}/queens.png` });
  report.push(['queens: screenshot', 'ok']);
}
await pause(8000);

// v2-Gegenprobe: Live-Seite OHNE preview-Param (frischer Kontext ohne Preview-Cookie)
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true });
await routeThroughNode(ctx2);
const p2 = await ctx2.newPage();
await p2.goto('https://limitlessposter.com/password', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await p2.evaluate(async () => {
  const body = new URLSearchParams({ form_type: 'storefront_password', utf8: '✓', password: 'shieya' });
  await fetch('/password', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }).catch(() => {});
});
await pause(1500);
await p2.goto('https://limitlessposter.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await pause(3000);
const v2home = await p2.evaluate(() => ({
  tiles: document.querySelectorAll('.lp-tile').length,
  collectionCards: document.querySelectorAll('.collection-card').length,
  title: document.title.slice(0, 60),
}));
report.push(['v2 live home: lp-tiles (soll 0)', v2home.tiles]);
report.push(['v2 live home: collection-cards (>0 = alte Sektion aktiv)', v2home.collectionCards]);
await pause(6000);
await p2.goto('https://limitlessposter.com/products/roaring-jaguar-floral-poster', { waitUntil: 'domcontentloaded', timeout: 90000 });
await pause(3000);
const v2prod = await p2.evaluate(() => ({
  hasV4Gallery: !!document.querySelector('.lp-sizecomp, .lp-spot[data-spot="rueckseite"]'),
  glb: (() => { const s = document.querySelector('[data-lp-data]'); if (!s) return 'kein lp-gallery'; try { const j = JSON.parse(s.textContent); return j.glb ? j.glb.split('/').pop().split('?')[0] : null; } catch { return '?'; } })(),
}));
report.push(['v2 live produkt: v4-Galerie-Marker (soll false)', v2prod.hasV4Gallery]);
report.push(['v2 live produkt: glb', v2prod.glb]);

console.log('\n===== FINAL REPORT =====');
for (const [k, v] of report) console.log('-', k, '→', v);
await browser.close();
