/**
 * Check specifically for login overlay and auth state
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  // First test: WITHOUT Telegram mock (fresh browser)
  console.log('=== TEST 1: WITHOUT TELEGRAM MOCK ===');
  const page1 = await context.newPage();
  const errors1 = [];
  page1.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      errors1.push({ type: msg.type(), text: msg.text() });
  });
  page1.on('pageerror', err => errors1.push({ type: 'pageerror', text: err.message }));

  const url = process.argv.find(a => a.startsWith('--url='))?.slice(6) || 'https://pokematrix.onrender.com';
  await page1.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page1.waitForTimeout(3000);

  const state1 = await page1.evaluate(() => {
    const overlay = document.getElementById('login-overlay');
    const tg = window.Telegram;
    return {
      loginOverlay: overlay ? {
        text: overlay.innerText.slice(0, 300),
        display: getComputedStyle(overlay).display,
        zIndex: getComputedStyle(overlay).zIndex,
      } : null,
      hasTelegram: !!tg,
      hasWebApp: !!(tg && tg.WebApp),
      location: window.location.href,
      hostname: window.location.hostname,
      search: window.location.search,
      navItems: document.querySelectorAll('.nav-item').length,
      locTabs: document.querySelectorAll('.loc-tab').length,
      locActions: document.getElementById('loc-actions')?.childElementCount ?? -1,
      navButtons: document.getElementById('nav-buttons')?.childElementCount ?? -1,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });

  console.log('State without Telegram mock:', JSON.stringify(state1, null, 2));
  if (errors1.length > 0) {
    console.log('Errors:', JSON.stringify(errors1, null, 2));
  }

  await page1.screenshot({ path: 'e2e/screenshots/no-telegram.png', fullPage: true });
  console.log('Screenshot: no-telegram.png');

  // Second test: WITH Telegram mock + ?dev
  console.log('\n=== TEST 2: WITH TELEGRAM MOCK & ?dev ===');
  const page2 = await context.newPage();
  page2.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      console.log(`[${msg.type()}] ${msg.text()}`);
  });
  page2.on('pageerror', err => console.log('[pageerror]', err.message));

  // Mock Telegram before page loads
  await page2.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'test',
        ready: function() {},
      }
    };
  });

  await page2.goto(url + '?dev', { waitUntil: 'networkidle', timeout: 60000 });
  await page2.waitForTimeout(5000);

  const state2 = await page2.evaluate(() => {
    const overlay = document.getElementById('login-overlay');
    const register = document.getElementById('register-overlay');
    const locActions = document.getElementById('loc-actions');
    const navButtons = document.getElementById('nav-buttons');
    const npcButtons = document.getElementById('npc-buttons');
    return {
      loginOverlay: overlay ? {
        text: overlay.innerText.slice(0, 200),
        display: getComputedStyle(overlay).display,
      } : null,
      registerOverlay: register ? {
        text: register.innerText.slice(0, 200),
        display: getComputedStyle(register).display,
      } : null,
      title: document.title,
      headerTitle: document.getElementById('header-title')?.innerText,
      locName: document.getElementById('loc-name')?.innerText,
      locDesc: document.getElementById('loc-desc')?.innerText,
      navItems: document.querySelectorAll('.nav-item').length,
      locTabs: document.querySelectorAll('.loc-tab').length,
      actionsHTML: locActions?.innerHTML?.slice(0, 150),
      navButtonsHTML: navButtons?.innerHTML?.slice(0, 150),
      npcButtonsHTML: npcButtons?.innerHTML?.slice(0, 150),
      visibleModals: Array.from(document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]'))
        .filter(el => {
          const s = getComputedStyle(el);
          return s.display === 'flex' && ['fixed', 'absolute'].includes(s.position);
        })
        .map(el => ({
          id: el.id || '(no id)',
          className: (el.className || '').slice(0, 40),
          text: (el.innerText || '').slice(0, 80)
        })),
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });

  console.log('State WITH Telegram mock:', JSON.stringify(state2, null, 2));
  await page2.screenshot({ path: 'e2e/screenshots/with-telegram.png', fullPage: true });
  console.log('Screenshot: with-telegram.png');

  await browser.close();
}

main().catch(e => { console.log('FAIL:', e.message, e.stack); process.exit(1); });
