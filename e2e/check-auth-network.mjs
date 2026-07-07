/**
 * Check auth network requests specifically
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Track ALL network requests
  const requests = [];
  page.on('request', req => {
    requests.push({
      time: Date.now(),
      url: req.url().slice(0, 150),
      method: req.method(),
    });
  });

  // Also track response data for auth
  page.on('response', async resp => {
    const url = resp.url;
    if (url.includes('/auth/tg') || url.includes('api/') || url.includes('auth/')) {
      try {
        const body = await resp.text().catch(() => '(no body)');
        console.log(`\n[AUTH RESPONSE] Status: ${resp.status}, URL: ${url}`);
        console.log(`[AUTH RESPONSE] Body: ${body.slice(0, 500)}`);
      } catch(e) {
        console.log(`[AUTH RESPONSE ERROR] ${e.message}`);
      }
    }
  });

  page.on('requestfailed', req => {
    console.log(`[NETWORK FAIL] ${req.url().slice(0, 150)}: ${req.failure()?.errorText}`);
  });

  console.log('Loading page...');
  const startTime = Date.now();
  await page.goto('https://pokematrix.onrender.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log(`DOM loaded after ${Date.now() - startTime}ms`);

  // Wait for init to complete (wait long enough for auth timeout)
  await page.waitForTimeout(25000);

  const elapsed = Date.now() - startTime;
  console.log(`\n=== AFTER ${Math.round(elapsed / 1000)}s ===`);

  // Check auth overlay state
  const hasLogin = await page.evaluate(() => {
    const overlay = document.getElementById('login-overlay');
    if (!overlay) return { exists: false };
    return {
      exists: true,
      display: getComputedStyle(overlay).display,
      text: overlay.innerText.slice(0, 300),
    };
  });
  console.log('\nLogin overlay:', JSON.stringify(hasLogin, null, 2));

  // Check current state
  const currentState = await page.evaluate(() => ({
    trainerName: document.getElementById('trainer-name')?.innerText,
    headerTitle: document.getElementById('header-title')?.innerText,
    resetBtnDisplay: document.getElementById('btn-reset-game')?.style.display,
    locBtnCount: document.getElementById('loc-actions')?.childElementCount,
  }));
  console.log('\nCurrent state:', JSON.stringify(currentState, null, 2));

  // Print network requests summary
  console.log(`\n=== NETWORK REQUESTS (${requests.length}) ===`);
  requests.forEach(r => {
    console.log(`  ${r.method} ${r.url}`);
  });

  await page.screenshot({ path: 'e2e/screenshots/auth-network.png', fullPage: true });
  console.log('\nScreenshot saved');

  await browser.close();
}

main().catch(e => { console.log('FAIL:', e); process.exit(1); });
