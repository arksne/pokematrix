/**
 * Deep init diagnosis - check game state flow
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Capture ALL console output
  const logs = [];
  page.on('console', msg => {
    logs.push({ type: msg.type(), text: msg.text(), time: Date.now() });
    // Print warnings and errors immediately
    if (['error', 'warning'].includes(msg.type())) {
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    logs.push({ type: 'pageerror', text: err.message, stack: err.stack });
    console.log('[PAGE_ERROR]', err.message);
  });

  await page.goto('https://pokematrix.onrender.com?dev', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Wait for the page to be fully interactive
  await page.waitForTimeout(8000);

  // Now capture the FULL game state
  const fullState = await page.evaluate(() => {
    // Check all key game state indicators
    const bodyText = document.body.innerText;

    // Count all fixed-position elements
    const fixedEls = Array.from(document.querySelectorAll('*')).filter(el => {
      try {
        return getComputedStyle(el).position === 'fixed';
      } catch(e) { return false; }
    });

    return {
      // Navigation
      headerTitle: document.getElementById('header-title')?.innerText,
      navCount: document.querySelectorAll('.nav-item').length,
      activeView: Array.from(document.querySelectorAll('.app-view'))
        .filter(v => v.classList.contains('active-view'))
        .map(v => v.id),

      // Location
      locName: document.getElementById('loc-name')?.innerText,
      locDesc: document.getElementById('loc-desc')?.innerText,
      weather: document.getElementById('loc-weather')?.innerText,
      region: document.getElementById('loc-region')?.innerText,
      badges: document.getElementById('badge-display')?.innerText,

      // Dynamic content
      actionsCount: document.getElementById('loc-actions')?.childElementCount,
      navBtnsCount: document.getElementById('nav-buttons')?.childElementCount,
      npcBtnsCount: document.getElementById('npc-buttons')?.childElementCount,

      // Body state
      bodyOverflow: getComputedStyle(document.body).overflow,

      // Fixed elements
      fixedCount: fixedEls.length,
      fixedDetails: fixedEls.slice(0, 8).map(el => ({
        id: el.id || '(no id)',
        tag: el.tagName,
        className: (el.className || '').slice(0, 50),
        zIndex: getComputedStyle(el).zIndex,
        display: getComputedStyle(el).display,
        text: (el.innerText || '').slice(0, 80),
        rect: (function() {
          const r = el.getBoundingClientRect();
          return Math.round(r.width) + 'x' + Math.round(r.height);
        })(),
      })),

      // Specific known overlays
      overlays: Array.from(document.querySelectorAll(
        '#login-overlay, #register-overlay, #info-modal, #npc-modal, ' +
        '#quest-modal, #notif-modal, #pokedex-modal, #tm-modal, ' +
        '#encounter-modal, #gym-modal, #elite-modal, #pvp-modal, ' +
        '#trade-modal, #shop-modal, [class*="overlay"]'
      )).filter(Boolean).map(el => ({
        id: el.id || '(no id)',
        display: getComputedStyle(el).display,
        visible: getComputedStyle(el).visibility,
        zIndex: getComputedStyle(el).zIndex,
        text: (el.innerText || '').slice(0, 60),
      })),

      // Body text snippets (first 30 lines)
      textSample: bodyText.split('\n').filter(t => t.trim()).slice(0, 30),
    };
  });

  console.log('\n=== FULL STATE ===');
  console.log(JSON.stringify(fullState, null, 2));

  // Check for specific error patterns in console logs
  const errors = logs.filter(l => ['error', 'pageerror'].includes(l.type));
  const warnings = logs.filter(l => l.type === 'warning');

  console.log(`\n=== CONSOLE SUMMARY ===`);
  console.log(`Total logs: ${logs.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n--- ERRORS ---');
    errors.forEach(e => console.log(`[${e.type}] ${e.text}`));
  }
  if (warnings.length > 0) {
    console.log('\n--- WARNINGS ---');
    warnings.forEach(w => console.log(w.text));
  }

  // Save diagnostic data
  writeFileSync('e2e/screenshots/full-diagnosis.json', JSON.stringify({
    state: fullState,
    logs: logs.slice(0, 100), // limit log size
  }, null, 2));

  await page.screenshot({ path: 'e2e/screenshots/full-state.png', fullPage: true });
  console.log('\nDiagnosis saved');

  await browser.close();
}

main().catch(e => { console.log('FAIL:', e); process.exit(1); });
