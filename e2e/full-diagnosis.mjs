/**
 * Final comprehensive diagnosis
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Capture ALL console output including info/debug
  const allLogs = [];
  page.on('console', msg => {
    allLogs.push({
      type: msg.type(),
      text: msg.text(),
      stack: msg.stackTrace?.()?.slice(0, 3) || [],
    });
    // Print everything
    const prefix = msg.type() === 'error' ? '🔴' : msg.type() === 'warning' ? '🟡' : '⚪';
    if (['error', 'warning', 'info', 'debug'].includes(msg.type()) || msg.text().includes('[auth]') || msg.text().includes('init')) {
      console.log(`${prefix} [${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    allLogs.push({ type: 'pageerror', text: err.message, stack: err.stack });
    console.log(`🔴 [pageerror] ${err.message}`);
  });

  await page.goto('https://pokematrix.onrender.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for full page load and allow async init to complete
  await page.waitForTimeout(12000);

  // Track if any error appeared AFTER the wait
  const afterLogs = [];
  page.on('console', msg => {
    afterLogs.push({ type: msg.type(), text: msg.text() });
  });

  await page.waitForTimeout(2000);

  console.log('\n=== FULL LOG ANALYSIS ===');

  // Check group logs by type
  const errors = allLogs.filter(l => l.type === 'error');
  const warnings = allLogs.filter(l => l.type === 'warning');
  const infos = allLogs.filter(l => l.type === 'info' || l.type === 'debug');
  const networkFailures = allLogs.filter(l => l.type === 'network');

  console.log(`Total logs: ${allLogs.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Info/Debug: ${infos.length}`);

  // Print ALL logs in order
  console.log('\n=== ALL LOGS (chronological) ===');
  allLogs.forEach((l, i) => {
    const icon = l.type === 'error' ? '🔴' : l.type === 'warning' ? '🟡' : l.type === 'network' ? '🔵' : '  ';
    console.log(`${i}:${icon}[${l.type}] ${(l.text || '').slice(0, 500)}`);
  });

  // Current page state
  const pageState = await page.evaluate(() => {
    return {
      title: document.title,
      url: location.href,
      viewInfoExists: !!document.getElementById('view-info'),
      btnHelpSystem: !!document.getElementById('btn-help-system'),
      btnQuests: !!document.getElementById('btn-quests'),
      btnPvp: !!document.getElementById('btn-pvp'),
      btnAllTrainers: !!document.getElementById('btn-all-trainers'),
      resetBtnDisplay: document.getElementById('btn-reset-game')?.style.display,
      actionsCount: document.getElementById('loc-actions')?.childElementCount ?? -1,
      navBtnsCount: document.getElementById('nav-buttons')?.childElementCount ?? -1,
      npcBtnsCount: document.getElementById('npc-buttons')?.childElementCount ?? -1,
      trainerName: document.getElementById('trainer-name')?.innerText,
      backdropFixed: Array.from(document.querySelectorAll('.modal-overlay')).filter(m => {
        const s = getComputedStyle(m);
        return s.display === 'flex' || (s.display === 'block' && s.visibility !== 'hidden');
      }).map(m => ({ id: m.id, display: getComputedStyle(m).display })),
      bodyStyles: {
        overflow: getComputedStyle(document.body).overflow,
        position: getComputedStyle(document.body).position,
        height: getComputedStyle(document.body).height,
      },
    };
  });

  console.log('\n=== FINAL PAGE STATE ===');
  console.log(JSON.stringify(pageState, null, 2));

  // Save everything
  writeFileSync('e2e/screenshots/full-logs.json', JSON.stringify({
    logs: allLogs.slice(0, 300),
    pageState,
  }, null, 2));

  await page.screenshot({ path: 'e2e/screenshots/full-diagnosis.png', fullPage: true });

  await browser.close();
}

main().catch(e => { console.log('FAIL:', e); process.exit(1); });
