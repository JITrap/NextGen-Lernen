import { chromium } from 'playwright';
import { routeThroughNode } from '/home/user/NextGen-Lernen/tools/poster3d-v4/net-route.mjs';
import fs from 'node:fs';

const STATE = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad/pinterest-state.json';
const OUTDIR = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({
  storageState: STATE,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  locale: 'de-DE',
  viewport: { width: 1400, height: 1000 },
});
await routeThroughNode(context);
const page = await context.newPage();

page.on('console', msg => { if (process.env.LP_DEBUG) console.log('PAGECONSOLE', msg.text().slice(0,200)); });

console.log('Navigating to pinterest.com ...');
await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUTDIR}/pin-home.png` }).catch(()=>{});

// Find profile link in DOM (avatar link usually has href starting with "/<username>/")
const profileHref = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a[href]')];
  // Look for the account switcher/avatar area -- Pinterest usually has a link like /username/
  const candidates = links
    .map(a => a.getAttribute('href'))
    .filter(h => h && /^\/[a-zA-Z0-9_.]+\/$/.test(h) && !['/today/','/news/','/business/','/about/'].includes(h));
  return candidates;
});
console.log('candidate profile hrefs:', JSON.stringify(profileHref).slice(0, 500));

fs.writeFileSync(`${OUTDIR}/pin-debug-hrefs.json`, JSON.stringify(profileHref, null, 2));

await browser.close();
