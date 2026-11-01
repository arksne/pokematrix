/**
 * Холодный старт Render Free глазами игрока.
 *
 * Free-инстанс засыпает после 15 минут простоя: первый игрок утром ждёт
 * 30–60 секунд, пока сервер отвечает 503 `{status:'warming'}` (или соединение
 * вообще отклонено). apiClient это переживает (повторяет с backoff до 45 с), но
 * раньше игрок всё это время видел мёртвый интерфейс — теперь должен видеть
 * экран «Сервер просыпается…».
 *
 * Проверка не ждёт настоящего засыпания Render (это ~15 минут): она
 * перехватывает запросы в браузере и первые секунды отдаёт ровно тот же 503,
 * что и продовый гейт прогрева. Так проверяется реальная реакция клиента:
 * оверлей появился → сервер «поднялся» → оверлей исчез, игра работает.
 *
 * Запуск:
 *   $env:PROD_BOT_TOKEN='<token>'; $env:PROD_BASE='https://pokematrix.onrender.com'
 *   node tools/prod-ops/cold-start-check.mjs
 *
 * Коды проверок: C1..C4.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..');
const require_ = createRequire(path.join(REPO, 'package.json'));
const { chromium } = require_('playwright');

const BASE = (process.env.PROD_BASE || 'https://pokematrix.onrender.com').replace(/\/$/, '');
const BOT_TOKEN = process.env.PROD_BOT_TOKEN || '';
const TG_ID = Number(process.env.PROD_TG_ID || 777900390);
const STATE_DIR = path.join(here, '.state');
/** Сколько секунд изображаем «сервер просыпается». */
const WARMUP_SECONDS = Number(process.env.COLD_START_SECONDS || 8);
const HEADFUL = process.argv.includes('--headful');

if (!BOT_TOKEN) {
  console.error('Нужен PROD_BOT_TOKEN (токен бота) — им подписывается initData.');
  process.exit(2);
}
mkdirSync(STATE_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, title, ok, detail = '') {
  results.push({ id, title, ok, detail });
  console.log(`  [${id}] ${ok ? 'PASS' : 'FAIL'}  ${title}${detail ? `  — ${detail}` : ''}`);
}

function makeInitData(userId) {
  const params = new URLSearchParams({
    query_id: 'AAH' + crypto.randomBytes(4).toString('hex'),
    user: JSON.stringify({ id: userId, first_name: 'coldcheck', username: 'coldcheck', language_code: 'ru' }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

function telegramShim(initData) {
  return `(function(){
  const q = new URLSearchParams(${JSON.stringify(initData)});
  window.Telegram = { WebApp: {
    initData: ${JSON.stringify(initData)},
    initDataUnsafe: { user: JSON.parse(q.get('user')), auth_date: Number(q.get('auth_date')), hash: q.get('hash') },
    version: '8.0', platform: 'android', colorScheme: 'dark', themeParams: {}, isExpanded: true,
    viewportHeight: window.innerHeight, viewportStableHeight: window.innerHeight,
    ready(){}, expand(){}, close(){}, onEvent(){}, offEvent(){}, sendData(){}, isVersionAtLeast(){ return true; },
    BackButton: { isVisible: false, show(){}, hide(){}, onClick(){}, offClick(){} },
    MainButton: { isVisible: false, show(){}, hide(){}, onClick(){}, offClick(){}, setText(){}, enable(){}, disable(){} },
    HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} }
  }};
})();`;
}

async function main() {
  const initData = makeInitData(TG_ID);
  const pageErrors = [];
  const consoleErrors = [];
  const apiCalls = [];
  const warmingAnswers = { count: 0 };
  const warmupUntil = Date.now() + WARMUP_SECONDS * 1000;

  const browser = await chromium.launch({ headless: !HEADFUL });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('response', (r) => {
    const u = r.url();
    if (!u.includes('/api/')) return;
    if (r.status() === 503) warmingAnswers.count++;
    apiCalls.push({ url: u.replace(BASE, ''), method: r.request().method(), status: r.status(), at: Date.now() });
  });

  // Изображаем гейт прогрева прода: до warmupUntil все /api/* (кроме version и
  // health, которые отдаются до гейта) отвечают ровно как server/src/index.ts.
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const isEarly = /\/api\/(version|health)/.test(url);
    if (!isEarly && Date.now() < warmupUntil) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: { 'Retry-After': '3' },
        body: JSON.stringify({ status: 'warming', error: 'Server is warming up' }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/telegram-web-app.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: telegramShim(initData) })
  );

  try {
    console.log(`\nХолодный старт: ${BASE} (греем ${WARMUP_SECONDS} с, tg_id=${TG_ID})\n`);
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    // ── C1: оверлей «Сервер просыпается…» появляется ──────────────
    let overlay = null;
    const overlayDeadline = Date.now() + 25_000;
    while (Date.now() < overlayDeadline) {
      overlay = await page
        .evaluate(() => {
          const el = document.getElementById('pm-warming-overlay');
          if (!el) return null;
          const visible = window.getComputedStyle(el).display !== 'none';
          return { visible, text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) };
        })
        .catch(() => null);
      if (overlay?.visible) break;
      await sleep(300);
    }
    check(
      'C1',
      'во время прогрева игрок видит экран «Сервер просыпается…»',
      !!overlay?.visible && /Сервер просыпается/i.test(overlay.text || ''),
      overlay ? `через ${Date.now() - t0} мс: «${overlay.text}»` : 'оверлей не появился'
    );
    await page.screenshot({ path: path.join(STATE_DIR, 'cold-01-warming.png') }).catch(() => {});
    check(
      'C2',
      'сервер действительно отвечал 503 warming (мы проверили реакцию на настоящий ответ)',
      warmingAnswers.count > 0,
      `503-ответов: ${warmingAnswers.count}`
    );

    // ── C3: после подъёма оверлей исчезает, игра загружается ────────
    // Новый тренер после логина видит регистрацию и выбор стартовой карты —
    // проходим их так же, как живой игрок, иначе «готовности мира» не будет.
    const isRegVisible = async () =>
      page
        .evaluate(() => {
          const b = document.getElementById('btn-register');
          const o = document.getElementById('register-overlay');
          return (!!b && b.offsetHeight > 0) || (!!o && window.getComputedStyle(o).display !== 'none');
        })
        .catch(() => false);
    const regDeadline = Date.now() + 60_000;
    while (Date.now() < regDeadline && !(await isRegVisible())) {
      const readyNow = await page
        .evaluate(() => document.querySelectorAll('#nav-buttons .btn-nav, #loc-actions button').length > 0)
        .catch(() => false);
      if (readyNow) break;
      await sleep(500);
    }
    if (await isRegVisible()) {
      await page
        .evaluate((nick) => {
          const input = document.querySelector('#register-overlay input') || document.getElementById('reg-nickname');
          if (input) {
            input.value = nick;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          document.getElementById('btn-register')?.click();
        }, `cold${String(TG_ID).slice(-4)}`)
        .catch(() => {});
      await sleep(3000);
    }
    // Стартовая карта (появляется с задержкой после отрисовки мира).
    for (let i = 0; i < 25; i++) {
      const starterOpen = await page
        .evaluate(() => {
          const m = document.getElementById('starter-modal');
          return !!m && window.getComputedStyle(m).display !== 'none';
        })
        .catch(() => false);
      if (!starterOpen) break;
      await page.evaluate(() => document.querySelector('#starter-grid .starter-option')?.click()).catch(() => {});
      await sleep(2000);
    }

    let ready = false;
    const readyDeadline = Date.now() + 90_000;
    while (Date.now() < readyDeadline && !ready) {
      ready = await page
        .evaluate(
          () =>
            document.querySelectorAll('#nav-buttons .btn-nav, #loc-actions button').length > 0 &&
            !!document.getElementById('view-world')
        )
        .catch(() => false);
      if (!ready) await sleep(500);
    }
    const overlayAfter = await page
      .evaluate(() => {
        const el = document.getElementById('pm-warming-overlay');
        if (!el) return { present: false, visible: false };
        return { present: true, visible: window.getComputedStyle(el).display !== 'none' };
      })
      .catch(() => ({ present: false, visible: false }));
    check(
      'C3',
      'после подъёма сервера оверлей скрылся и игра загрузилась',
      ready && !overlayAfter.visible,
      `готовность: ${ready ? 'да' : 'нет'}, оверлей: ${overlayAfter.visible ? 'всё ещё виден' : 'скрыт'}`
    );
    await page.screenshot({ path: path.join(STATE_DIR, 'cold-02-loaded.png') }).catch(() => {});

    // ── C4: игра реально работает после такого старта ──────────────
    const authOk = apiCalls.some((c) => c.url.includes('/api/auth/tg') && c.status === 200);
    const saveOk = apiCalls.some((c) => c.url.includes('/api/save') && c.status === 200);
    check('C4', 'вход и облачный сейв после прогрева проходят', authOk && saveOk,
      `POST /api/auth/tg: ${authOk ? '200' : 'нет'}, GET /api/save: ${saveOk ? '200' : 'нет'}`);

    const meaningfulErrors = consoleErrors.filter(
      (t) => !/ERR_FAILED|ERR_ABORTED|net::ERR|Failed to load resource|raw\.githubusercontent|Cross-Origin-Opener-Policy|503/i.test(t)
    );
    check('C5', 'нет JS-ошибок во время холодного старта', pageErrors.length === 0 && meaningfulErrors.length === 0,
      [...pageErrors, ...meaningfulErrors].slice(0, 3).join(' | ') || 'ок');
  } finally {
    await browser.close().catch(() => {});
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nИТОГ: ${passed}/${results.length} проверок пройдено`);
  console.log(`Скриншоты: ${STATE_DIR}`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\nПРОВАЛЕНО: ${failed.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Проверка холодного старта упала:', e?.stack || e);
  process.exit(1);
});
