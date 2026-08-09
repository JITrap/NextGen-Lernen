import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { routeThroughNode } from '../net-route.mjs';

const ROOT = '/home/user/NextGen-Lernen/tools/poster3d-v4';
const STATE_PATH = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad/pinterest-state.json';
const BOARD_NAME = 'fertig limitless';
const PROFILE_URL = 'https://www.pinterest.com/juliuserb2006/';

const confirmedPath = path.join(ROOT, 'out/pinterest-confirmed.json');
const movedPath = path.join(ROOT, 'out/pinterest-moved.json');
const failedPath = path.join(ROOT, 'out/pinterest-failed.json');
const shotDir = path.join(ROOT, 'out/verify');

const confirmed = JSON.parse(fs.readFileSync(confirmedPath, 'utf8'));
const moved = fs.existsSync(movedPath) ? JSON.parse(fs.readFileSync(movedPath, 'utf8')) : [];
const failed = fs.existsSync(failedPath) ? JSON.parse(fs.readFileSync(failedPath, 'utf8')) : [];
const movedSet = new Set(moved);
const failedSet = new Set(failed.map(f => f.pinId));

function saveMoved() {
  fs.writeFileSync(movedPath, JSON.stringify(moved, null, 2));
}
function saveFailed() {
  fs.writeFileSync(failedPath, JSON.stringify(failed, null, 2));
}
function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const MODE = process.argv[2] || 'run'; // 'ensure-board' | 'run' | 'move-one'
const ONLY_PIN = process.argv[3];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: STATE_PATH,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'de-DE',
    viewport: { width: 1400, height: 1000 },
  });
  await routeThroughNode(context);
  const page = await context.newPage();

  try {
    if (MODE === 'ensure-board') {
      await ensureBoard(page);
    } else if (MODE === 'move-one' && ONLY_PIN) {
      await ensureBoard(page);
      await movePin(page, ONLY_PIN, confirmed.find(c => c.pinId === ONLY_PIN)?.handle || '');
    } else {
      await ensureBoard(page);
      for (const { pinId, handle } of confirmed) {
        if (movedSet.has(pinId)) continue;
        if (failedSet.has(pinId)) continue;
        try {
          const ok = await movePin(page, pinId, handle);
          if (ok) {
            moved.push(pinId);
            movedSet.add(pinId);
            saveMoved();
            console.log('MOVED', pinId);
          } else {
            failed.push({ pinId, handle, reason: 'move-verification-failed' });
            failedSet.add(pinId);
            saveFailed();
            console.log('FAILED', pinId);
          }
        } catch (e) {
          console.log('ERROR on', pinId, String(e).slice(0, 300));
          failed.push({ pinId, handle, reason: String(e).slice(0, 300) });
          failedSet.add(pinId);
          saveFailed();
        }
      }
    }
  } finally {
    await browser.close();
  }
})();

async function ensureBoard(page) {
  console.log('Navigating to profile...');
  await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(4000);
  await page.screenshot({ path: path.join(shotDir, 'dbg-profile.jpg'), fullPage: false });

  // Look for a board link/tile with the target name
  const boardExists = await page.evaluate((name) => {
    const els = Array.from(document.querySelectorAll('a, div, span'));
    return els.some(el => el.textContent && el.textContent.trim() === name);
  }, BOARD_NAME);

  if (boardExists) {
    console.log('Board already exists:', BOARD_NAME);
    return;
  }

  console.log('Board not found, creating...');
  // Click the "+" / create button. Try common selectors.
  const plusSelectors = [
    'div[data-test-id="header-plus-icon"]',
    'button[aria-label="Erstellen"]',
    'button[aria-label="Create"]',
    'div[data-test-id="createPin"]',
  ];
  let clicked = false;
  for (const sel of plusSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    // fallback: navigate directly to board-creation URL
    await page.goto('https://www.pinterest.com/board-create/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await wait(3000);
  } else {
    await wait(2000);
    await page.screenshot({ path: path.join(shotDir, 'dbg-plusmenu.jpg') });
    // Look for "Pinnwand" / "Board" option in dropdown
    const boardOption = await page.getByText(/Pinnwand|Board$/i).first();
    if (await boardOption.count()) {
      await boardOption.click();
      await wait(2000);
    }
  }

  await page.screenshot({ path: path.join(shotDir, 'dbg-create-board-dialog.jpg') });

  // Fill in board name field, scoped to the modal dialog (avoid matching the global search box)
  const dialog = page.getByRole('dialog');
  const nameInput = dialog.locator('input[placeholder*="benennen" i], input[type="text"]').first();
  await nameInput.waitFor({ timeout: 15000 });
  await nameInput.click();
  await nameInput.fill(BOARD_NAME);
  await wait(1000);
  await page.screenshot({ path: path.join(shotDir, 'dbg-board-name-filled.jpg') });

  // Ensure "secret" toggle is OFF (default off) - just verify screenshot, don't touch unless needed.

  // Click create/submit button, scoped to dialog
  const submitBtn = dialog.getByRole('button', { name: /Erstellen|Create/i }).last();
  await submitBtn.waitFor({ timeout: 10000 });
  await wait(500);
  await submitBtn.click();
  await wait(4000);
  await page.screenshot({ path: path.join(shotDir, 'dbg-board-created.jpg') });
  console.log('Board creation flow submitted.');
}

async function movePin(page, pinId, handle) {
  const url = `https://www.pinterest.com/pin/${pinId}/`;
  console.log('Opening pin', pinId, handle);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(4000);

  // Find edit (pencil) icon/button
  const editSelectors = [
    'div[data-test-id="pin-edit-button"]',
    'button[aria-label="Bearbeiten"]',
    'button[aria-label="Edit"]',
    'a[href*="/pin/"][href*="/edit/"]',
  ];
  let editEl = null;
  for (const sel of editSelectors) {
    const el = await page.$(sel);
    if (el) { editEl = el; break; }
  }
  if (!editEl) {
    await page.screenshot({ path: path.join(shotDir, `dbg-noedit-${pinId}.jpg`) });
    console.log('No edit button found for', pinId);
    return false;
  }
  await editEl.click();
  await wait(3000);
  await page.screenshot({ path: path.join(shotDir, `dbg-edit-${pinId}.jpg`) });

  // Open board dropdown
  const boardDropdownSelectors = [
    'div[data-test-id="board-dropdown-select-button"]',
    'button[data-test-id="board-dropdown-select-button"]',
  ];
  let dd = null;
  for (const sel of boardDropdownSelectors) {
    const el = await page.$(sel);
    if (el) { dd = el; break; }
  }
  if (!dd) {
    console.log('No board dropdown found for', pinId);
    return false;
  }
  await dd.click();
  await wait(2000);
  await page.screenshot({ path: path.join(shotDir, `dbg-boarddd-${pinId}.jpg`) });

  // Type board name into search box if present
  const searchBox = await page.locator('input[placeholder*="Suche" i], input[placeholder*="Search" i]').first();
  if (await searchBox.count()) {
    await searchBox.fill(BOARD_NAME);
    await wait(1500);
  }
  await page.screenshot({ path: path.join(shotDir, `dbg-boardsearch-${pinId}.jpg`) });

  const boardOption = await page.getByText(BOARD_NAME, { exact: true }).first();
  if (!(await boardOption.count())) {
    console.log('Board option not found in dropdown for', pinId);
    return false;
  }
  await boardOption.click();
  await wait(2000);

  // Save
  const saveBtn = await page.getByRole('button', { name: /Speichern|Save|Fertig|Done/i }).last();
  if (await saveBtn.count()) {
    await saveBtn.click();
    await wait(3000);
  }
  await page.screenshot({ path: path.join(shotDir, `dbg-saved-${pinId}.jpg`) });

  // Verify
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(3000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const ok = bodyText.includes(BOARD_NAME);
  if (!ok) {
    await page.screenshot({ path: path.join(shotDir, `dbg-verifyfail-${pinId}.jpg`) });
  }
  return ok;
}
