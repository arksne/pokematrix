/**
 * Test dev mode (?dev) which bypasses Telegram
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => console.log(`[PAGE_ERROR] ${err.message}`));
  page.on('requestfailed', req => {
    console.log(`[NETWORK FAIL] ${req.url()}`);
  });

  console.log('Loading with ?dev mode...');
  await page.goto('https://pokematrix.onrender.com/?dev', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page.waitForTimeout(25000);

  console.log('\n=== FINAL STATE ===');
  const state = await page.evaluate(() => ({
    title: document.title,
    loginOverlay: document.getElementById('login-overlay') ? {
      display: document.getElementById('login-overlay').style.display,
      text: document.getElementById('login-overlay').innerText.slice(0, 150),
    } : null,
    registerOverlay: document.getElementById('register-overlay') ? {
      display: getComputedStyle(document.getElementById('register-overlay')).display,
    } : null,
    actionsCount: document.getElementById('loc-actions')?.childElementCount ?? -1,
    navBtnsCount: document.getElementById('nav-buttons')?.childElementCount ?? -1,
    npcBtnsCount: document.getElementById('npc-buttons')?.childElementCount ?? -1,
    trainerName: document.getElementById('trainer-name')?.innerText,
    resetBtnDisplay: document.getElementById('btn-reset-game')?.style.display,
    headerTitle: document.getElementById('header-title')?.innerText,
    locName: document.getElementById('loc-name')?.innerText,
    bodyOverflow: getComputedStyle(document.body).overflow,
  }));

  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: 'e2e/screenshots/dev-mode.png', fullPage: true });
  console.log('Screenshot saved');

  await browser.close();
}

main().catch(e => { console.log('FAIL:', e); process.exit(1); });
