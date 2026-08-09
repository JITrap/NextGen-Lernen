/* Stichprobe T12: Template-Zuordnung für apex/grit-Kollektion im Preview-Theme. */
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

const targets = [
  { handle: 'apex-motorsport-cars', tpl: 'collection.apex', out: 'col-apex.png' },
  { handle: 'grit-boxing-mma', tpl: 'collection.grit', out: 'col-grit.png' },
];

for (const t of targets) {
  const url = `https://limitlessposter.com/collections/${t.handle}${PREVIEW}`;
  const ok = await goSlow(url);
  if (!ok) { report.push([`${t.handle}: FEHLER`, 'Seite nicht geladen']); continue; }
  await pause(2000);
  const dom = await page.evaluate((expectedTpl) => {
    const main = document.querySelector('main[data-template]');
    const dataTemplate = main ? main.getAttribute('data-template') : null;
    const ghost = document.querySelector('.lpcat-ghost');
    const ghostVisible = ghost ? (ghost.offsetWidth > 0 && ghost.offsetHeight > 0) : false;
    const priceEls = [...document.querySelectorAll('.price')].filter(e => e.offsetWidth > 0);
    const priceColors = [...new Set(priceEls.slice(0, 5).map(e => getComputedStyle(e).color))];
    return {
      dataTemplate,
      templateMatches: dataTemplate === expectedTpl,
      ghostPresent: !!ghost,
      ghostVisible,
      ghostSrc: ghost ? (ghost.currentSrc || ghost.src || '').split('/').pop() : null,
      priceColors,
      priceCount: priceEls.length,
    };
  }, t.tpl);
  report.push([`${t.handle}: data-template`, `${dom.dataTemplate} (erwartet ${t.tpl}, match=${dom.templateMatches})`]);
  report.push([`${t.handle}: .lpcat-ghost vorhanden/sichtbar`, `${dom.ghostPresent}/${dom.ghostVisible} src=${dom.ghostSrc}`]);
  report.push([`${t.handle}: Preisfarben (${dom.priceCount} Preise)`, dom.priceColors.join(' | ') || 'KEINE PREISE']);
  await page.screenshot({ path: `${OUT}/${t.out}`, fullPage: false });
  await pause(4000);
}

console.log('\n===== T12 VERIFY REPORT =====');
for (const [k, v] of report) console.log('-', k, '→', v);
await browser.close();
