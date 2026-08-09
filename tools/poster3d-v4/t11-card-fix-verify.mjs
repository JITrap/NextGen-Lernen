/* T11: Verify product-card gallery slide 1 shows hero image (not variant tile),
   and product-page v4 gallery (lp-panels) remains unaffected. */
import { chromium } from 'playwright';
import { routeThroughNode } from './net-route.mjs';
import { mkdirSync } from 'node:fs';

const PREVIEW = '?preview_theme_id=194124087629';
const OUT = 'out/final-r';
mkdirSync(OUT, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true });
await routeThroughNode(ctx);
const page = await ctx.newPage();
const report = [];

async function login(p) {
  await p.goto('https://limitlessposter.com/password', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await p.evaluate(async () => {
    const body = new URLSearchParams({ form_type: 'storefront_password', utf8: '✓', password: 'shieya' });
    await fetch('/password', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }).catch(() => {});
  });
  await pause(1500);
}

async function goSlow(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await pause(4000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes('Verify you are human') || bodyText.includes('connection needs to be verified')) {
      report.push(['CLOUDFLARE bei', url]); return false;
    }
    if (bodyText.toUpperCase().includes('THROTTLED')) {
      report.push([`THROTTLED (Versuch ${i + 1}/${tries}) bei`, url]);
      await pause(4000);
      continue;
    }
    return true;
  }
  return false;
}

await login(page);

// --- 1) Collection page: check first 6 product-card .card-gallery img for "-hero" ---
const collUrl = `https://limitlessposter.com/collections/still-quiet-luxury${PREVIEW}`;
const ok1 = await goSlow(collUrl);
if (!ok1) {
  report.push(['collection: FEHLER', 'Seite nicht geladen']);
} else {
  await pause(2500);
  const cardData = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('product-card .card-gallery')].slice(0, 6);
    return cards.map((gal, i) => {
      // visible slide = slideshow-slide with aria-hidden="false" (arrows hidden, only slide 1 visible)
      let slide = gal.querySelector('slideshow-slide[aria-hidden="false"]');
      if (!slide) slide = gal.querySelector('slideshow-slide'); // fallback: first slide
      const img = slide ? slide.querySelector('img') : gal.querySelector('img');
      const src = img ? (img.currentSrc || img.src || '') : null;
      return { i, src, hasHero: src ? src.includes('-hero') : false };
    });
  });
  const heroCount = cardData.filter(c => c.hasHero).length;
  report.push(['collection: cards gefunden', cardData.length]);
  report.push(['collection: hero-Treffer', `${heroCount}/${cardData.length}`]);
  cardData.forEach(c => report.push([`  card[${c.i}] src`, c.src || 'KEIN IMG']));
  await page.screenshot({ path: `${OUT}/cards-hero-fixed.png`, fullPage: false });
}

await pause(3000);

// --- 2) Product page: v4 lp-panels gallery must be unaffected ---
const prodUrl = `https://limitlessposter.com/products/leopard-on-branch-framed-poster-minimalist-wildlife-wall-art${PREVIEW}`;
const ok2 = await goSlow(prodUrl);
if (!ok2) {
  report.push(['product page: FEHLER', 'Seite nicht geladen']);
} else {
  await pause(2500);
  const lp = await page.evaluate(() => {
    const root = document.querySelector('[data-lp-data]');
    let glb = null;
    try { glb = root ? JSON.parse(root.textContent).glb : null; } catch {}
    const panels = [...document.querySelectorAll('.lp-panel--img img')];
    return {
      hasLpData: !!root,
      glbPresent: !!glb,
      panelImgCount: panels.length,
      panelSrcs: panels.slice(0, 6).map(im => (im.currentSrc || im.src || '').split('/').pop()),
    };
  });
  report.push(['product page: data-lp-data vorhanden', lp.hasLpData]);
  report.push(['product page: glb vorhanden', lp.glbPresent]);
  report.push(['product page: lp-panel--img Anzahl', lp.panelImgCount]);
  report.push(['product page: lp-panel--img srcs', lp.panelSrcs.join(' | ') || 'KEINE']);
  await page.screenshot({ path: `${OUT}/product-page-lp-panels-check.png`, fullPage: false });
}

console.log('\n===== T11 CARD-FIX VERIFY REPORT =====');
for (const [k, v] of report) console.log('-', k, '→', v);
await browser.close();
