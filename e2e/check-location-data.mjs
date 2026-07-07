/**
 * Check if 'goldenrod' exists in the regions data and what renderLocation would do
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const logs = [];
  page.on('console', msg => {
    logs.push({ type: msg.type(), text: msg.text() });
    if (['error', 'warning'].includes(msg.type())) {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto('https://pokematrix.onrender.com', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(8000);

  // Check specific game data
  const result = await page.evaluate(() => {
    // Check if the page has regions data embedded
    const scripts = Array.from(document.querySelectorAll('script')).map(s => ({
      src: s.src,
      type: s.type,
      textLength: (s.innerText || '').length,
      textStart: (s.innerText || '').slice(0, 100),
    }));

    // Check for error bars
    const errorBar = document.getElementById('error-bar');

    // Check trainer-card elements (post-auth init trace)
    const trainerName = document.getElementById('trainer-name');
    const trainerBadges = document.getElementById('trainer-badges');
    const trainerCaught = document.getElementById('trainer-caught');
    const tradeCenterBtn = document.getElementById('btn-trade-center');
    const btnAllTrainers = document.getElementById('btn-all-trainers');
    const btnHelpSystem = document.getElementById('btn-help-system');
    const btnQuests = document.getElementById('btn-quests');
    const btnPvp = document.getElementById('btn-pvp');

    // Check the header reset button (line 168)
    const resetBtn = document.getElementById('btn-reset-game');

    // Check if trainer-card elements have content (means renderTrainerCard ran)
    return {
      scripts: scripts.slice(0, 5),
      errorBar: errorBar ? { text: errorBar.innerText.slice(0, 200) } : null,
      trainerCard: {
        name: trainerName?.innerText,
        badges: trainerBadges?.innerText,
        caught: trainerCaught?.innerText,
      },
      postAuthIndicators: {
        btnHelpSystem: !!btnHelpSystem,
        btnQuests: !!btnQuests,
        btnPvp: !!btnPvp,
        btnAllTrainers: !!btnAllTrainers,
        tradeCenterBtn: !!tradeCenterBtn,
        resetBtnStyle: resetBtn?.style.display,
      },
      lsKeys: Object.keys(localStorage),
    };
  });

  console.log(JSON.stringify(result, null, 2));

  // Now let's check the rendered HTML for the main loc-tab-content
  const descHTML = await page.evaluate(() => {
    const el = document.getElementById('loc-tab-desc');
    return el?.innerHTML?.slice(0, 500) || 'NOT FOUND';
  });
  console.log('\n--- loc-tab-desc HTML ---');
  console.log(descHTML);

  const wildHTML = await page.evaluate(() => {
    const el = document.getElementById('loc-tab-wild');
    return el?.innerHTML?.slice(0, 300) || 'NOT FOUND';
  });
  console.log('\n--- loc-tab-wild HTML ---');
  console.log(wildHTML);

  await page.screenshot({ path: 'e2e/screenshots/location-data-check.png', fullPage: true });
  await browser.close();
}

main().catch(e => { console.log('FAIL:', e); process.exit(1); });
