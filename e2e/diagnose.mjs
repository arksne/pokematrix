/**
 * PokeMatrix UI Diagnosis Script
 * Takes screenshots, checks clickability, finds overlays
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE_URL = process.argv.find(a => a.startsWith('--url='))?.slice(6) || 'https://pokematrix.onrender.com';
const HEADED = process.argv.includes('--headed');
const SCREENSHOTS = 'e2e/screenshots';

mkdirSync(SCREENSHOTS, { recursive: true });

const results = { errors: [], overlays: [], clicks: [], screenshots: [] };

async function main() {
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') results.errors.push({ text: msg.text(), url: msg.location()?.url });
  });
  page.on('pageerror', err => results.errors.push({ text: err.message }));

  await page.addInitScript(() => {
    localStorage.setItem('league17_tutorial', 'complete');
  });

  // Load page
  console.log(`📄 Loading ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Screenshot 1: Initial state
  await page.screenshot({ path: `${SCREENSHOTS}/01-initial.png`, fullPage: true });
  results.screenshots.push('01-initial.png');
  console.log('📸 Screenshot 1: initial state');

  // Dismiss overlays
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, #tutorial-overlay, [class*="overlay"]')
      .forEach(el => { if (el.parentNode) el.style.display = 'none'; });
  }).catch(() => {});
  await page.waitForTimeout(500);

  // Check page title
  const title = await page.title();
  console.log(`📌 Page title: "${title}"`);

  // Analyze DOM state
  const domState = await page.evaluate(() => {
    const navItems = document.querySelectorAll('.nav-item');
    const locTabs = document.querySelectorAll('.loc-tab');
    const locActions = document.getElementById('loc-actions');
    const navButtons = document.getElementById('nav-buttons');
    const npcButtons = document.getElementById('npc-buttons');

    // Find all fixed/overlay elements that might block clicks
    const potentialBlockers = [];
    document.querySelectorAll('*').forEach(el => {
      const style = getComputedStyle(el);
      if (style.position === 'fixed' && style.display !== 'none' && style.visibility !== 'hidden') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50) {
          potentialBlockers.push({
            tag: el.tagName,
            id: el.id,
            className: el.className.slice(0, 80),
            zIndex: style.zIndex,
            opacity: style.opacity,
            rect: `${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)},${Math.round(rect.top)})`,
            text: (el.innerText || '').slice(0, 60)
          });
        }
      }
    });

    // Check clickability of key elements
    const checkClickable = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return { found: false };
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        found: true,
        display: style.display,
        visible: style.visibility,
        pointerEvents: style.pointerEvents,
        opacity: style.opacity,
        zIndex: style.zIndex,
        rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        disabled: el.disabled,
        classList: (el.className || '').slice(0, 60)
      };
    };

    return {
      navItems: navItems.length,
      locTabs: locTabs.length,
      visibleViews: Array.from(document.querySelectorAll('.app-view')).filter(v => v.classList.contains('active-view')).map(v => v.id),
      hasActions: locActions ? locActions.childElementCount : 'not-found',
      hasNavButtons: navButtons ? navButtons.childElementCount : 'not-found',
      hasNpcButtons: npcButtons ? npcButtons.childElementCount : 'not-found',
      blockers: potentialBlockers.slice(0, 15),
      clickable: {
        nav: checkClickable('.nav-item[data-target="view-world"]'),
        locTab: checkClickable('.loc-tab[data-tab="desc"]'),
        shop: checkClickable('#loc-actions button'),
        npc: checkClickable('#npc-buttons button'),
        navButton: checkClickable('#nav-buttons button'),
      },
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
    };
  });

  console.log('📊 DOM Analysis:', JSON.stringify(domState, null, 2));
  results.domState = domState;

  // Try clicking nav tabs
  console.log('\n🗂️ Testing navigation clicks...');
  for (const target of ['view-world', 'view-backpack', 'view-team', 'view-chat', 'view-trainers', 'view-info']) {
    const item = page.locator(`.nav-item[data-target="${target}"]`);
    const count = await item.count();
    if (count > 0) {
      try {
        await item.click({ timeout: 2000 });
        await page.waitForTimeout(400);
        const view = page.locator(`#${target}`);
        const classes = await view.getAttribute('class');
        const isActive = classes?.includes('active-view');
        results.clicks.push({ target, success: true, active: isActive });
        console.log(`  ✅ ${target}: clicked, active=${isActive}`);
      } catch (e) {
        results.clicks.push({ target, success: false, error: e.message });
        console.log(`  ❌ ${target}: ${e.message}`);
      }
    } else {
      results.clicks.push({ target, success: false, error: 'not found' });
      console.log(`  ⚠️ ${target}: nav item not found`);
    }
  }

  // Screenshot 2: After nav clicks
  await page.screenshot({ path: `${SCREENSHOTS}/02-after-nav.png`, fullPage: true });
  results.screenshots.push('02-after-nav.png');
  console.log('📸 Screenshot 2: after nav clicks');

  // Try clicking loc-tabs
  console.log('\n🔍 Testing location tabs...');
  const locTabs = await page.locator('.loc-tab').count();
  console.log(`  Found ${locTabs} location tabs`);

  if (locTabs > 0) {
    const tabLabels = await page.locator('.loc-tab').allTextContents();
    for (let i = 0; i < locTabs; i++) {
      try {
        await page.locator('.loc-tab').nth(i).click({ timeout: 2000 });
        await page.waitForTimeout(300);
        console.log(`  ✅ Tab ${i} ("${tabLabels[i].trim()}") clicked`);
      } catch (e) {
        console.log(`  ❌ Tab ${i}: ${e.message}`);
      }
    }
  }

  // Try clicking location action buttons
  console.log('\n🔍 Testing action buttons...');
  const actionBtns = await page.locator('#loc-actions button').count();
  console.log(`  Found ${actionBtns} action buttons`);
  if (actionBtns > 0) {
    const btnTexts = await page.locator('#loc-actions button').allTextContents();
    btnTexts.forEach((t, i) => console.log(`  Button ${i}: "${t.trim()}"`));
    // Try clicking first button
    try {
      const firstBtn = page.locator('#loc-actions button').first();
      await firstBtn.click({ timeout: 2000 });
      console.log('  ✅ First action button clicked');
    } catch (e) {
      console.log(`  ❌ First action button: ${e.message}`);
    }
  }

  // Screenshot 3: After interactions
  await page.screenshot({ path: `${SCREENSHOTS}/03-after-interactions.png`, fullPage: true });
  results.screenshots.push('03-after-interactions.png');

  // Try clicking nav buttons (location links)
  console.log('\n🔍 Testing nav buttons (location links)...');
  const navBtns = await page.locator('#nav-buttons button').count();
  console.log(`  Found ${navBtns} nav buttons`);
  if (navBtns > 0) {
    const navTexts = await page.locator('#nav-buttons button').allTextContents();
    navTexts.forEach((t, i) => console.log(`  Nav ${i}: "${t.trim()}"`));
  }

  // Check for JS errors
  console.log(`\n${'='.repeat(55)}`);
  console.log(`   JS Errors:      ${results.errors.length}`);
  console.log(`   Blockers:       ${domState.blockers.length}`);
  console.log(`   Navigation:     ${results.clicks.filter(c => c.success).length}/${results.clicks.length} successful`);
  console.log(`   Screenshots:    ${results.screenshots.length}`);
  console.log(`${'='.repeat(55)}`);

  if (results.errors.length > 0) {
    console.error('\n❌ Console errors:');
    results.errors.forEach(e => console.error(`  ${e.text}`));
  }

  // Save results
  writeFileSync(`${SCREENSHOTS}/diagnose-results.json`, JSON.stringify(results, null, 2));
  console.log('\n📄 Results saved to e2e/screenshots/diagnose-results.json');

  await browser.close();
  process.exit(results.errors.length > 0 ? 1 : 0);
}

main().catch(err => { console.error('💥', err); process.exit(1); });
