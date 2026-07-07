/**
 * Root cause diagnosis - trace init flow
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Trap all console messages including infos and debug
  const allLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    allLogs.push({ type: msg.type(), text: text });
  });
  page.on('pageerror', err => {
    allLogs.push({ type: 'pageerror', text: err.message, stack: err.stack });
    console.log('[UNCAUGHT]', err.message);
  });
  page.on('requestfailed', req => {
    allLogs.push({ type: 'network', text: `${req.url()} FAILED: ${req.failure()?.errorText}` });
  });

  await page.goto('https://pokematrix.onrender.com', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Wait 10 seconds for full init to complete
  await page.waitForTimeout(10000);

  // Check all console output
  console.log('\n=== ALL CONSOLE OUTPUT (' + allLogs.length + ' lines) ===');
  allLogs.forEach(l => {
    const prefix = l.type === 'error' ? '🔴' : l.type === 'warning' ? '🟡' : '  ';
    console.log(`${prefix} [${l.type}] ${l.text.slice(0, 400)}`);
  });

  // Deep probe of game state
  const gameState = await page.evaluate(() => {
    // Try to find game state in module closures
    // Check if init module stored anything on DOM or window
    const bodyStyles = document.body.style.cssText;

    // Check for error-bar elements
    const errorBar = document.getElementById('error-bar');

    // Try to find renderLocation or state via various probes
    const results = {
      bodyStyles,
      errorBarText: errorBar?.innerText || null,
      locActionsHTML: document.getElementById('loc-actions')?.innerHTML?.slice(0, 100),

      // Check if init.ts ran at all by looking for DOM modifications
      initRan: {
        shopEvents: !!document.getElementById('shop-modal'),
        encounterModal: !!document.getElementById('encounter-modal'),
        gymModal: !!document.getElementById('gym-modal'),
        pokedexModal: !!document.getElementById('pokedex-modal'),
        infoModal: !!document.getElementById('info-modal'),
        questModal: !!document.getElementById('quest-modal'),
        trainersTab: !!document.getElementById('btn-all-trainers'),
      },

      // Check the location-tab click handlers (from init.ts line 249)
      locTabListeners: (() => {
        const tabs = document.querySelectorAll('.loc-tab');
        if (tabs.length === 0) return 'no-tabs';
        const el = tabs[0];
        const handlers = el.listeners ? 'has-listeners' : 'unknown';
        return `${tabs.length} tabs, onclick: ${!!el.onclick}, listeners: ${handlers}, class: ${el.className}`;
      })(),

      // Nav item listeners
      navListeners: (() => {
        const items = document.querySelectorAll('.nav-item');
        if (items.length === 0) return 'no-items';
        const el = items[0];
        return `${items.length} items, onclick: ${!!el.onclick}, class: ${el.className}`;
      })(),

      // Check if anything has pointer-events:none
      pointerEventsNone: (() => {
        const results = [];
        document.querySelectorAll('*').forEach(el => {
          try {
            if (getComputedStyle(el).pointerEvents === 'none' &&
                el.getBoundingClientRect().width > 50 &&
                getComputedStyle(el).display !== 'none') {
              results.push({
                tag: el.tagName,
                id: el.id || '(no id)',
                class: (el.className || '').slice(0, 40),
                text: (el.innerText || '').slice(0, 40),
              });
            }
          } catch(e) {}
        });
        return results.slice(0, 10);
      })(),

      // Check if starter-modal is display:flex (means giveStarter is open)
      starterModal: (() => {
        const el = document.getElementById('starter-modal');
        if (!el) return 'not-found';
        return {
          display: getComputedStyle(el).display,
          text: el.innerText.slice(0, 150),
        };
      })(),

      // Check localStorage for game save data
      lsKeys: Object.keys(localStorage),
      lsSaveData: (() => {
        const keys = Object.keys(localStorage);
        const saveKey = keys.find(k => k.includes('save') || k.includes('team'));
        if (saveKey) {
          try {
            const raw = localStorage.getItem(saveKey);
            return { key: saveKey, length: raw?.length, preview: raw?.slice(0, 100) };
          } catch(e) {
            return { key: saveKey, error: e.message };
          }
        }
        return null;
      })(),
    };

    return results;
  });

  console.log('\n=== GAME STATE ===');
  console.log(JSON.stringify(gameState, null, 2));

  writeFileSync('e2e/screenshots/root-cause.json', JSON.stringify({
    logs: allLogs.slice(0, 200),
    gameState,
  }, null, 2));

  await page.screenshot({ path: 'e2e/screenshots/root-cause.png', fullPage: true });
  console.log('\nScreenshots saved');

  await browser.close();
}

main().catch(e => { console.log('FAIL:', e); process.exit(1); });
