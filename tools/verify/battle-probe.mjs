/**
 * Диагностика боевой модалки: почему encounter-modal не виден, хотя кнопки атак
 * в DOM есть. Ничего не «чинит» — только снимает фактическое состояние, чтобы
 * отличить баг в игре от бага в тесте.
 *
 * Запуск (против поднятого verify-сервера):
 *   VERIFY_PORT=8099 VERIFY_BOT_TOKEN=... node tools/verify/battle-probe.mjs
 */
import { chromium } from 'playwright';
import { signInitData, webAppShim, makeUser } from './tgsign.mjs';
import { BOT_TOKEN, APP_URL, HOST_ALIAS } from './paths.mjs';
import { api } from './support.mjs';

const TG_ID = 779333111;

async function register() {
  const { initData } = signInitData(BOT_TOKEN, makeUser(TG_ID, 'probe', 'Probe'));
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData } });
  if (r.status !== 200 || !r.json?.token) throw new Error('auth failed ' + r.status);
  const reg = await api('/api/auth/register', {
    method: 'POST', token: r.json.token, body: { nickname: 'probe' },
  });
  return reg.status === 200;
}

// Регистрация обязательна: без неё init.ts показывает #register-overlay, который
// перехватывает все клики по странице — и зонд измеряет не бой, а заглушку.
const registered = await register();
console.log('registered:', registered);

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();

const console_ = [];
page.on('console', (m) => console_.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console_.push(`[pageerror] ${e.message}`));

const { initData } = signInitData(BOT_TOKEN, makeUser(TG_ID, 'probe', 'Probe'));
await page.route('**/telegram-web-app.js*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) }));

// Детерминированный шанс встречи.
await page.addInitScript(() => { Math.random = () => 0; });

await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(16000);

const starter = page.locator('#starter-modal');
if (await starter.isVisible().catch(() => false)) {
  await page.locator('.starter-option').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(8000);
}

console.log('--- ДО нажатия охоты ---');
console.log(JSON.stringify(await probeState(page), null, 2));

await page.locator('#btn-hunt-toggle').click().catch((e) => console.log('click hunt failed:', e.message));
await page.waitForTimeout(15000);

console.log('--- ПОСЛЕ охоты ---');
console.log(JSON.stringify(await probeState(page), null, 2));

// Пробуем реальный клик по атаке и смотрим, что происходит.
const before = await page.locator('#battle-log').innerText().catch(() => '');
const btn = page.locator('[id^="move-btn-"]').first();
let clickResult = 'no button';
if (await btn.count()) {
  const visible = await btn.isVisible().catch(() => false);
  const box = await btn.boundingBox().catch(() => null);
  try {
    await btn.click({ timeout: 5000 });
    clickResult = `clicked (visible=${visible}, box=${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'null'})`;
  } catch (e) {
    clickResult = `FAILED (visible=${visible}, box=${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'null'}): ${e.message.split('\n')[0]}`;
  }
}
await page.waitForTimeout(6000);
const after = await page.locator('#battle-log').innerText().catch(() => '');
console.log('--- КЛИК ПО АТАКЕ ---');
console.log('  ' + clickResult);
console.log('  лог изменился:', before !== after);
console.log('  лог после:', JSON.stringify(after.slice(-200)));

console.log('--- КОНСОЛЬ (последние 25) ---');
for (const c of console_.slice(-25)) console.log('  ' + c);

await browser.close();

async function probeState(p) {
  return await p.evaluate(() => {
    const el = document.getElementById('encounter-modal');
    const cs = el ? getComputedStyle(el) : null;
    const bb = el ? el.getBoundingClientRect() : null;
    const btn = document.querySelector('[id^="move-btn-"]');
    const bcs = btn ? getComputedStyle(btn) : null;
    const bbb = btn ? btn.getBoundingClientRect() : null;
    return {
      modalExists: !!el,
      modalInDom: el ? document.contains(el) : false,
      modalDisplay: el ? el.style.display : null,
      modalComputed: cs ? cs.display : null,
      modalOpacity: cs ? cs.opacity : null,
      modalVisibility: cs ? cs.visibility : null,
      modalZIndex: cs ? cs.zIndex : null,
      modalBox: bb ? `${Math.round(bb.width)}x${Math.round(bb.height)} @${Math.round(bb.x)},${Math.round(bb.y)}` : null,
      moveBtnCount: document.querySelectorAll('[id^="move-btn-"]').length,
      moveBtnDisplay: bcs ? bcs.display : null,
      moveBtnBox: bbb ? `${Math.round(bbb.width)}x${Math.round(bbb.height)}` : null,
      // сколько .modal-overlay реально осталось в DOM
      modalOverlayCount: document.querySelectorAll('.modal-overlay').length,
      battleType: window.__battlePhase ?? 'n/a',
      logTail: (document.getElementById('battle-log')?.textContent || '').slice(-160),
      lsKeys: Object.keys(localStorage).filter((k) => !k.startsWith('league17_refresh')),
    };
  });
}
