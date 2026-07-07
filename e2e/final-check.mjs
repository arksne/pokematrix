/**
 * Final check: can we interact with the game at all?
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));
  page.on('response', resp => {
    const url = typeof resp.url === 'function' ? resp.url() : String(resp.url || '');
    if (url.includes('auth') || url.includes('save') || url.includes('profile')) {
      const textPromise = resp.text().catch(() => '(n/a)');
      textPromise.then(text => {
        console.log(`[HTTP ${resp.status}] ${url.split('?')[0]}`);
        console.log(`  body: ${text.slice(0, 200)}`);
      });
    }
  });

  await page.goto('https://pokematrix.onrender.com/?dev', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  // Wait very long for auth timeout
  console.log('Waiting 30 seconds...');
  await page.waitForTimeout(30000);

  console.log(`\n=== LOGS (${logs.length}) ===`);
  logs.forEach(l => { if (l.type !== 'log') console.log(`${l.type}: ${l.text}`); });

  // Check EVERYTHING
  const state = await page.evaluate(() => ({
    env: {
      hostname: location.hostname,
      search: location.search,
      tgExists: !!window.Telegram,
      tgWebApp: !!window.Telegram?.WebApp,
      initData: window.Telegram?.WebApp?.initData,
      initDataLen: window.Telegram?.WebApp?.initData?.length,
    },
    dom: {
      loginOverlay: (() => {
        const e = document.getElementById('login-overlay');
        return e ? { exists: true, html: e.outerHTML?.slice(0, 300) } : null;
      })(),
      registerOverlay: (() => {
        const e = document.getElementById('register-overlay');
        return e ? { exists: true, display: e.style.display } : null;
      })(),
      errorBar: document.getElementById('error-bar')?.innerText || null,
      viewWorldContent: document.getElementById('view-world')?.innerHTML?.length,
      locActions: document.getElementById('loc-actions')?.childElementCount,
      navButtons: document.getElementById('nav-buttons')?.childElementCount,
    },
    storage: {
      lsKeys: Object.keys(localStorage),
      ssKeys: Object.keys(sessionStorage),
    },
    timing: {
      readyState: document.readyState,
    }
  }));

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(state, null, 2));
  console.log('\nAll console logs:', JSON.stringify(logs, null, 2));

  await page.screenshot({ path: 'e2e/screenshots/final-check.png', fullPage: true });
  await browser.close();
}

main().catch(e => { console.log('FAIL:', e); process.exit(1); });
