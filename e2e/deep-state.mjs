/**
 * Deep analysis of game state and location rendering
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE_URL = 'https://pokematrix.onrender.com';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.addInitScript(() => {
    localStorage.setItem('league17_tutorial', 'complete');
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => {
    // @ts-ignore
    const w = window;

    // Try to access game state
    const getGameState = () => {
      // Try different possible state locations
      if (w.state) return { source: 'window.state', ...w.state };
      if (w.store?.state) return { source: 'window.store.state', ...w.store.state };
      return { source: 'not-found' };
    };

    const gs = getGameState();

    return {
      gameState: gs,
      locationName: document.getElementById('loc-name')?.innerText,
      locationDesc: document.getElementById('loc-desc')?.innerText,
      locationImage: document.getElementById('loc-image')?.style.backgroundImage,
      headerTitle: document.getElementById('header-title')?.innerText,
      locActionsHTML: document.getElementById('loc-actions')?.innerHTML?.slice(0, 200),
      navButtonsHTML: document.getElementById('nav-buttons')?.innerHTML?.slice(0, 200),
      npcButtonsHTML: document.getElementById('npc-buttons')?.innerHTML?.slice(0, 200),
      wildTabContent: document.getElementById('loc-tab-wild')?.innerHTML?.slice(0, 300),
      descTabContent: document.getElementById('loc-tab-desc')?.innerHTML?.slice(0, 200),
      coinDisplay: document.getElementById('coin-display')?.innerText,
      badgeDisplay: document.getElementById('badge-display')?.innerText,
      // Check for various modals
      visibleModals: Array.from(document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]'))
        .filter(el => {
          const style = getComputedStyle(el);
          return style.display === 'flex' && ['fixed', 'absolute'].includes(style.position);
        })
        .map(el => ({
          id: el.id,
          classes: (el.className || '').slice(0, 40),
          zIndex: getComputedStyle(el).zIndex,
          text: (el.innerText || '').slice(0, 80)
        })),
      localStorageKeys: Object.keys(localStorage).filter(k => k.includes('league17')),
      localStorageSample: Object.fromEntries(
        Object.entries(localStorage).filter(([k]) => k.includes('league17')).slice(0, 5)
      ),
    };
  });

  console.log(JSON.stringify(state, null, 2));
  writeFileSync('e2e/screenshots/deep-state.json', JSON.stringify(state, null, 2));

  // Navigate to specific location
  console.log('\n--- Checking body overflow ---');
  const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  console.log(`body.overflow: ${bodyOverflow}`);

  // Try to fix by unblocking scroll
  await page.evaluate(() => {
    document.body.style.overflow = '';
  });
  await page.waitForTimeout(500);

  // Re-check nav buttons after unblocking
  const navBtns = await page.locator('#nav-buttons button').count();
  console.log(`Nav buttons after unblock: ${navBtns}`);

  await page.screenshot({ path: 'e2e/screenshots/deep-state.png', fullPage: true });
  console.log('Screenshot saved');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
