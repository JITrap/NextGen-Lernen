import { chromium } from 'playwright';
import { routeThroughNode } from '../net-route.mjs';
import { mkdirSync } from 'node:fs';

const PREVIEW = '?preview_theme_id=194124087629';
const OUT = 'out/final-r';
mkdirSync(OUT, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true });
await routeThroughNode(ctx);
const page = await ctx.newPage();

async function login(p) {
  await p.goto('https://limitlessposter.com/password', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await p.evaluate(async () => {
    const body = new URLSearchParams({ form_type: 'storefront_password', utf8: '✓', password: 'shieya' });
    await fetch('/password', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }).catch(() => {});
  });
  await pause(1500);
}

await login(page);

await page.goto('https://limitlessposter.com/collections' + PREVIEW, { waitUntil: 'domcontentloaded', timeout: 90000 });
await pause(4000);
const challenged = await page.evaluate(() => document.body.innerText.includes('Verify you are human') || document.body.innerText.includes('connection needs to be verified'));
if (challenged) {
  console.log('CLOUDFLARE CHALLENGE bei /collections');
  await browser.close();
  process.exit(1);
}

const data = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.resource-list__item')];
  const cards = items.map(el => {
    const a = el.querySelector('a[href*="/collections/"]');
    const img = el.querySelector('img');
    const text = el.innerText.trim().split('\n')[0] || '';
    return {
      href: a ? a.getAttribute('href') : null,
      imgSrc: img ? (img.currentSrc || img.src || img.getAttribute('src') || '') : null,
      text,
    };
  });
  return { count: items.length, cards };
});

console.log('===== COLLECTIONS PAGE REPORT =====');
console.log('Karten gefunden:', data.count);
for (const c of data.cards) {
  console.log('-', c.href, '|', c.text, '|', (c.imgSrc || '').split('/').pop());
}

const forbiddenHandles = ['frontpage', 'bestseller', 'quotes', 'artists', 'all'];
const forbiddenPresent = data.cards.filter(c => c.href && forbiddenHandles.some(h => c.href === `/collections/${h}` || c.href.endsWith(`/collections/${h}`)));
console.log('\nVerbotene Karten (sollten leer sein):', JSON.stringify(forbiddenPresent));

const lpColCount = data.cards.filter(c => (c.imgSrc || '').includes('lp-col')).length;
console.log('Karten mit lp-col im Bild-src:', lpColCount, '/', data.count);

await page.screenshot({ path: `${OUT}/collections-after.png`, fullPage: true });
console.log('\nScreenshot gespeichert.');

await browser.close();
