/**
 * Nuclear option: check if init function is even called
 * Use page.addInitScript to intercept and observe
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 390, height: 844 } }).then(c => c.newPage());

  // Trap everything from the start
  const allMessages = [];

  const page2 = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page2.on('console', msg => allMessages.push({ type: msg.type(), text: msg.text() }));
  page2.on('pageerror', err => allMessages.push({ type: 'pageerror', text: err.message }));

  // Monkey-patch init BEFORE page loads
  await page2.addInitScript(() => {
    // Stub window.Telegram to provide valid test data
    window.__initStarted = false;
    window.__authStarted = false;
    window.__authCompleted = false;

    // Hook into init by stubbing document.addEventListener
    const origAddEventListener = document.addEventListener.bind(document);
    document.addEventListener = function(type, handler, ...args) {
      if (type === 'DOMContentLoaded') {
        window.__initStarted = true;
        // Wrap the handler to track progress
        const origHandler = handler;
        const wrappedHandler = async function(event) {
          window.__initHandlerCalled = true;
          return origHandler.call(this, event);
        };
        return origAddEventListener(type, wrappedHandler, ...args);
      }
      return origAddEventListener(type, handler, ...args);
    };

    // Provide Telegram mock
    window.Telegram = {
      WebApp: {
        initData: 'test',
        initDataUnsafe: { user: { id: 1, first_name: 'Test' } },
        ready: function() { console.log('[MOCK] Telegram.WebApp.ready()'); },
        expand: function() {},
        setHeaderColor: function() {},
        setBottomBarColor: function() {},
        requestTheme: function() {},
        requestViewport: function() {},
        close: function() {},
      }
    };
  });

  console.log('Loading page with script injection...');
  await page2.goto('https://pokematrix.onrender.com/?dev', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page2.waitForTimeout(30000);

  console.log('\n=== ALL CONSOLE MESSAGES (' + allMessages.length + ') ===');
  allMessages.forEach((m, i) => {
    if (m.type !== 'log' || m.text.includes('[auth]') || m.text.includes('error') || m.text.includes('init')) {
      console.log(`${i}: [${m.type}] ${m.text}`);
    }
  });

  // Check our hooks
  const hooks = await page2.evaluate(() => ({
    initStarted: window.__initStarted,
    initHandlerCalled: window.__initHandlerCalled,
  }));
  console.log('\n=== HOOKS ===');
  console.log(JSON.stringify(hooks, null, 2));

  const state = await page2.evaluate(() => ({
    loginOverlay: !!document.getElementById('login-overlay'),
    actionsCount: document.getElementById('loc-actions')?.childElementCount ?? -1,
    trainerName: document.getElementById('trainer-name')?.innerText,
    btnHelpSystem: !!document.getElementById('btn-help-system'),
  }));
  console.log('\n=== STATE ===');
  console.log(JSON.stringify(state, null, 2));

  await page2.screenshot({ path: 'e2e/screenshots/init-hook.png', fullPage: true });
  await browser.close();
}

main().catch(e => { console.log('FAIL:', e); process.exit(1); });
