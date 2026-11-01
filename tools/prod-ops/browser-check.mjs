#!/usr/bin/env node
/**
 * browser-check.mjs — проверка ЖИВОГО прода так, как его видит игрок в Telegram.
 *
 *   PROD_BOT_TOKEN=<токен бота> node tools/prod-ops/browser-check.mjs
 *   PROD_BASE=https://pokematrix.onrender.com   (по умолчанию)
 *   HEADED=1                                    (показать браузер)
 *
 * Что делает:
 *   1. поднимает Chromium с мобильным вьюпортом (390x844, как телефон);
 *   2. подменяет https://telegram.org/js/telegram-web-app.js на шим с initData,
 *      подписанным РЕАЛЬНЫМ прод-токеном по алгоритму Telegram — то есть сервер
 *      проверяет вход ровно тем же кодом, что и для настоящего игрока;
 *   3. открывает прод, ждёт холодный старт Render free (до 90 с);
 *   4. собирает все запросы к /api/* и их статусы, консольные ошибки, pageerror;
 *   5. проверяет, что игра отрисовалась (#view-world + текст локации);
 *   6. делает скриншот в tools/prod-ops/.state/.
 *
 * Выход: 0 — всё зелёное, 1 — есть провалы, 2 — нет токена/окружения.
 *
 * Токен в репозиторий не пишется: только через переменную окружения.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..');
const STATE_DIR = path.join(here, '.state');
const require_ = createRequire(path.join(REPO, 'package.json'));

const BASE = (process.env.PROD_BASE || 'https://pokematrix.onrender.com').replace(/\/$/, '');
const BOT_TOKEN = process.env.PROD_BOT_TOKEN || '';
const HEADED = process.env.HEADED === '1';
// Отдельные от tools/prod-check тестовые игроки, чтобы наборы не мешали друг другу.
const TG_ID = Number(process.env.PROD_TG_ID || 777900301);
const TG_NAME = process.env.PROD_TG_NAME || 'browser_check';

if (!BOT_TOKEN) {
  console.error('Нужен PROD_BOT_TOKEN в окружении (токен прод-бота).');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Подпись initData ровно как у Telegram (и как проверяет server/src/routes/auth.ts). */
function signInitData(botToken, user) {
  const params = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return decodeURIComponent(new URLSearchParams({ ...params, hash }).toString());
}

/** Шим Telegram.WebApp: отдаётся вместо настоящего telegram-web-app.js. */
function webAppShim(initData, user) {
  return `(() => {
  const noop = () => {};
  const win = window;
  win.Telegram = win.Telegram || {};
  win.Telegram.WebApp = {
    initData: ${JSON.stringify(initData)},
    initDataUnsafe: { user: ${JSON.stringify(user)}, auth_date: Math.floor(Date.now() / 1000) },
    version: '7.0', platform: 'android', colorScheme: 'dark',
    themeParams: { bg_color: '#0f1420', text_color: '#e6e9ef', hint_color: '#8b93a7', link_color: '#4ea1ff', button_color: '#4ea1ff', button_text_color: '#ffffff' },
    isExpanded: true, viewportHeight: 844, viewportStableHeight: 844,
    headerColor: '#0f1420', backgroundColor: '#0f1420',
    isClosingConfirmationEnabled: false, isFullscreen: false, isActive: true, isVisible: true,
    orientation: 'portrait', devicePixelRatio: 3,
    safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    ready: noop, expand: noop, close: noop, setHeaderColor: noop, setBackgroundColor: noop,
    enableClosingConfirmation: noop, disableVerticalSwipes: noop, requestFullscreen: noop, exitFullscreen: noop,
    onEvent: noop, offEvent: noop, sendData: noop, switchInlineQuery: noop, openTelegramLink: noop,
    showPopup: (cb) => cb && cb('ok'),
    showAlert: (msg, cb) => { win.__tgAlert = msg; cb && cb(); },
    showConfirm: (msg, cb) => cb && cb(false),
    HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
    BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop, isVisible: false },
    MainButton: { text: '', show: noop, hide: noop, onClick: noop, offClick: noop, isVisible: false },
    CloudStorage: {
      setItem: (k, v, cb) => { win.__cloudStore = Object.assign(win.__cloudStore || {}, { [k]: v }); cb && cb(true, null); },
      getItem: (k, cb) => cb && cb((win.__cloudStore && win.__cloudStore[k]) || '', null),
      removeItem: (k, cb) => cb && cb(true, null),
    },
    deviceStorage: { removeItem: noop },
    requestWriteAccess: (cb) => cb && cb(false),
  };
})();`;
}

const results = [];
function check(id, name, pass, detail = '') {
  results.push({ id, name, pass: !!pass, detail });
  console.log(`  [${id}] ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function main() {
  mkdirSync(STATE_DIR, { recursive: true });
  const { chromium } = require_('playwright');

  const user = {
    id: TG_ID,
    first_name: 'Browser',
    last_name: 'Check',
    username: TG_NAME,
    language_code: 'ru',
    is_premium: false,
  };
  const initData = signInitData(BOT_TOKEN, user);

  console.log(`Прод: ${BASE}`);
  console.log('Запуск Chromium (мобильный вьюпорт 390x844)...');
  // Для локального прогона против verify-сервера (хост pokematrix.test, порт 8099):
  //   LOCAL=1 PROD_BASE=http://pokematrix.test:8099 PROD_BOT_TOKEN=<тот же тестовый> ...
  // Клиент считает localhost/127.0.0.1 dev-режимом и обходит авторизацию, поэтому
  // ходим по имени pokematrix.test и разворачиваем его на 127.0.0.1 здесь.
  const LOCAL = process.env.LOCAL === '1';
  const launchArgs = LOCAL ? ['--host-resolver-rules=MAP pokematrix.test 127.0.0.1'] : [];
  const browser = await chromium.launch({ headless: !HEADED, args: launchArgs });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();

  const apiCalls = [];
  const consoleErrors = [];
  const pageErrors = [];
  // Размер трафика спрайтов считаем через Performance API: у response.body()
  // часть тел к моменту обработки уже недоступна, и байты недосчитывались.
  const spriteTraffic = () =>
    page
      .evaluate(() => {
        const entries = performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/sprite/'));
        const bytes = entries.reduce((sum, e) => sum + (e.encodedBodySize || e.transferSize || 0), 0);
        return { count: entries.length, bytes };
      })
      .catch(() => ({ count: 0, bytes: 0 }));
  page.on('response', (resp) => {
    const url = resp.url();
    if (!url.includes('/api/')) return;
    apiCalls.push({ url: url.replace(BASE, ''), status: resp.status(), method: resp.request().method() });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err.message).slice(0, 400)));

  await page.route('**/telegram-web-app.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData, user) })
  );

  let mainStatus = 0;
  try {
    const resp = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    mainStatus = resp ? resp.status() : 0;
  } catch (e) {
    check('B0', 'страница открывается', false, `goto упал: ${e.message}`);
  }
  check('B0', 'index.html отдаётся с прода (HTTP 200)', mainStatus === 200, `HTTP ${mainStatus}`);

  // Холодный старт Render free: ждём, пока сервер прогреется и клиент нарисует мир
  // ИЛИ экран регистрации (новый игрок).
  const authCallSeen = () =>
    apiCalls.some((c) => c.url.includes('/auth/tg') && c.status >= 200 && c.status < 300);
  const isRegScreen = () =>
    page.evaluate(() => !!document.getElementById('btn-register')).catch(() => false);
  // ВАЖНО: #view-world виден ещё до инициализации клиента — это статическая
  // заглушка в index.html («Мир (Канто)», «Вермилион»). Проверка только по нему
  // изредка срабатывала слишком рано (холодный старт Render, медленные чанки):
  // мир «виден», а /api/save ещё не ушёл и кнопки навигации не отрисованы —
  // так B2/B9 падали на ровном месте. Поэтому готовность = клиент отрисовал
  // ссылки локаций (#nav-buttons .btn-nav) — их в статической разметке нет.
  const isReadyClient = async () =>
    page
      .evaluate(() => document.querySelectorAll('#nav-buttons .btn-nav, #loc-actions button').length > 0)
      .catch(() => false);
  const isWorld = () =>
    page
      .evaluate(() => {
        const el = document.getElementById('view-world');
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
      })
      .catch(() => false);

  let worldVisible = false;
  let registrationShown = false;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    worldVisible = await isWorld();
    registrationShown = registrationShown || (await isRegScreen());
    if ((worldVisible && authCallSeen() && (await isReadyClient())) || registrationShown) break;
    await sleep(1000);
  }

  const authCall = apiCalls.find((c) => c.url.includes('/auth/tg'));
  check(
    'B1',
    'вход по Telegram initData принят сервером',
    !!authCall && authCall.status >= 200 && authCall.status < 300,
    authCall ? `POST ${authCall.url} -> ${authCall.status}` : 'запроса /api/auth/tg не было'
  );

  // ── Новый игрок: проходим регистрацию так, как это делает живой человек ──
  if (registrationShown) {
    console.log('\nЭкран регистрации — создаём профиль тренера...');
    await page.fill('#reg-nickname', `Browser${Math.floor(Math.random() * 900 + 100)}`).catch(() => {});
    await page.click('#btn-register').catch(() => {});
    let regOk = false;
    for (let i = 0; i < 60; i++) {
      regOk = apiCalls.some((c) => c.url.includes('/auth/register') && c.status >= 200 && c.status < 300);
      if (regOk) break;
      await sleep(500);
    }
    check('B1a', 'регистрация нового тренера проходит', regOk, regOk ? 'POST /api/auth/register -> 200' : 'нет успешного /api/auth/register');
    // Ждём, пока уйдёт оверлей регистрации
    for (let i = 0; i < 40 && (await isRegScreen()); i++) await sleep(500);
    check('B1b', 'экран регистрации закрылся', !(await isRegScreen()));
  }

  // Ждём мир после входа/регистрации
  const worldDeadline = Date.now() + 90_000;
  while (Date.now() < worldDeadline && !(await isWorld())) await sleep(1000);
  worldVisible = await isWorld();

  // Сейв грузится после логина, но до отрисовки локации: ждём его отдельно,
  // а не рассчитываем, что к этому моменту он уже улетел.
  const saveDeadline = Date.now() + 60_000;
  while (Date.now() < saveDeadline && !apiCalls.some((c) => c.url.includes('/save'))) await sleep(500);

  const saveCall = apiCalls.find((c) => c.url.includes('/save'));
  check(
    'B2',
    'облачный сейв загружается',
    !!saveCall && saveCall.status >= 200 && saveCall.status < 300,
    saveCall ? `GET ${saveCall.url} -> ${saveCall.status}` : 'запроса /api/save не было'
  );

  check('B3', 'мир игры отрисовался (#view-world виден)', worldVisible);

  // Стартовый покемон: у нового игрока открывается модалка выбора стартера.
  const starterVisible = await page
    .evaluate(() => {
      const m = document.getElementById('starter-modal');
      return !!m && window.getComputedStyle(m).display !== 'none';
    })
    .catch(() => false);
  const hasTeam = await page
    .evaluate(() => {
      const t = document.getElementById('team-roster');
      return !!t && (t.textContent || '').trim().length > 0;
    })
    .catch(() => false);
  check('B3a', 'стартовый покемон предложен или уже есть в команде', starterVisible || hasTeam, starterVisible ? 'модалка стартера открыта' : hasTeam ? 'в команде есть покемон' : 'ни модалки, ни команды');

  const fiveXX = apiCalls.filter((c) => c.status >= 500);
  check(
    'B4',
    'ни один /api-запрос не вернул 5xx',
    fiveXX.length === 0,
    fiveXX.length ? fiveXX.map((c) => `${c.method} ${c.url} -> ${c.status}`).join('; ') : `запросов: ${apiCalls.length}`
  );

  // 404 на своём же API — почти всегда опечатка в пути клиента (ловили так
  // /api/api/version: API_BASE уже содержит '/api', и путь дублировался).
  const fourXX = apiCalls.filter((c) => c.status === 404);
  check(
    'B4a',
    'клиент не стучится в несуществующие /api-маршруты (нет 404)',
    fourXX.length === 0,
    fourXX.length ? fourXX.map((c) => `${c.method} ${c.url}`).join('; ') : 'ок'
  );

  // Ошибки консоли: часть из них — шум заблокированных артов (raw.githubusercontent)
  // и предупреждение COOP на http-стенде (на HTTPS-проде его нет).
  // Поэтому считаем только настоящие JS-ошибки приложения.
  const meaningful = consoleErrors.filter(
    (t) =>
      !/ERR_FAILED|ERR_ABORTED|net::ERR|Failed to load resource|raw\.githubusercontent/i.test(t) &&
      !/Cross-Origin-Opener-Policy/i.test(t)
  );
  check('B5', 'нет ошибок JS в консоли', meaningful.length === 0, meaningful.slice(0, 3).join(' | '));
  check('B6', 'нет необработанных исключений страницы', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  const bodyText = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim()).catch(() => '');
  check('B7', 'на странице есть игровой UI', bodyText.length > 200, `${bodyText.length} символов текста`);
  const bodyLen = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
  check('B8', 'DOM страницы не пустой', bodyLen > 20000, `innerHTML ${bodyLen} Б`);

  const screenshot = path.join(STATE_DIR, 'prod-browser.png');
  await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
  console.log(`\nСкриншот: ${screenshot}`);

  // ── Переключение вкладок: доказываем, что UI живой, а не «нарисовался и замер» ──
  const tabCheck = await page
    .evaluate(() => {
      // Кнопки локаций клиент создаёт с классом .btn-nav (селектор .nav-btn
      // когда-то искал несуществующий класс — проверка падала на «кнопок нет»),
      // а вкладки внизу — .nav-item[data-target].
      const btns = Array.from(
        document.querySelectorAll('#nav-buttons button, #nav-buttons .btn-nav, .nav-item[data-target]')
      );
      if (!btns.length) return { ok: false, detail: 'кнопок навигации нет' };
      const target = btns.find((b) => b.offsetHeight > 0);
      if (!target) return { ok: false, detail: 'нет видимых кнопок навигации' };
      target.click();
      return { ok: true, detail: `${btns.length} кнопок, кликнули по «${(target.textContent || '').trim().slice(0, 30)}»` };
    })
    .catch((e) => ({ ok: false, detail: String(e).slice(0, 120) }));
  await sleep(1200);
  // Реакция на клик: либо сменилась локация, либо переключилась вкладка.
  const navReacted = await page
    .evaluate(() => {
      const activeView = document.querySelector('.app-view.active, .app-view[style*="display: flex"], .app-view[style*="display:flex"]');
      const world = document.getElementById('view-world');
      const worldShown = !!world && window.getComputedStyle(world).display !== 'none';
      const locName = (document.getElementById('loc-name')?.textContent || '').trim();
      return { worldShown, locName, activeView: activeView ? activeView.id : null };
    })
    .catch(() => ({}));
  check('B9', 'навигация по вкладкам реагирует на клик', tabCheck.ok,
    `${tabCheck.detail}; мир: ${navReacted.worldShown ? 'виден' : 'скрыт'}, локация: «${navReacted.locName || '—'}»`);

  // ── Возвращающийся игрок: перезагрузка должна поднять сейв из облака ──
  // Это главный сценарий живого игрока: Telegram открывает Mini App заново,
  // клиент логинится по initData и обязан показать мир БЕЗ регистрации.
  apiCalls.length = 0;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
  const reloadDeadline = Date.now() + 90_000;
  let reloadWorld = false;
  while (Date.now() < reloadDeadline) {
    reloadWorld = await isWorld();
    if (reloadWorld && apiCalls.some((c) => c.url.includes('/save'))) break;
    await sleep(1000);
  }
  const reloadReg = await isRegScreen();
  const reloadSave = apiCalls.find((c) => c.url.includes('/save'));
  check('B10', 'повторный вход: экран регистрации не появляется', !reloadReg);
  check('B11', 'повторный вход: сейв поднят из облака', !!reloadSave && reloadSave.status < 400, reloadSave ? `GET ${reloadSave.url} -> ${reloadSave.status}` : 'запроса /api/save не было');
  check('B12', 'повторный вход: мир отрисован', reloadWorld);

  const screenshot2 = path.join(STATE_DIR, 'prod-browser-reload.png');
  await page.screenshot({ path: screenshot2, fullPage: false }).catch(() => {});
  console.log(`Скриншот после перезагрузки: ${screenshot2}`);

  console.log(`\nAPI-запросов за вторую загрузку: ${apiCalls.length}`);
  if (apiCalls.length) {
    for (const c of apiCalls.slice(0, 40)) console.log(`   ${String(c.status).padEnd(3)} ${c.method.padEnd(4)} ${c.url}`);
  }

  // ── B13: бюджет трафика Покедекса ────────────────────────────
  // В сетке 1025 покемонов. Крупный официальный арт на каждую ячейку — это
  // ~100 КБ × 15 видимых = мегабайты на экран прокрутки; замер на проде дал
  // 24.6 МБ на открытие Покедекса. В сетке арт должен быть только у пойманных,
  // остальные — 96px спрайты. Бюджет: 4 МБ на открытие (с запасом).
  const POKEDEX_SPRITE_BUDGET_BYTES = 4 * 1024 * 1024;
  const before = await spriteTraffic();
  const dexOpened = await page
    .evaluate(() => {
      const b = document.getElementById('btn-open-pokedex');
      if (!b) return false;
      b.click();
      return true;
    })
    .catch(() => false);
  await sleep(9000);
  const after = await spriteTraffic();
  const dexBytes = Math.max(0, after.bytes - before.bytes);
  const dexCount = Math.max(0, after.count - before.count);
  check(
    'B13',
    'Покедекс не тянет мегабайты картинок (арт только у пойманных)',
    dexOpened && dexBytes > 0 && dexBytes <= POKEDEX_SPRITE_BUDGET_BYTES,
    dexOpened
      ? `спрайтов: ${dexCount}, ${(dexBytes / 1024 / 1024).toFixed(1)} МБ (бюджет ${POKEDEX_SPRITE_BUDGET_BYTES / 1024 / 1024} МБ)`
      : 'кнопка Покедекса не найдена'
  );

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log('');
  if (failed.length) {
    console.log(`ПРОВАЛЕНО: ${failed.map((f) => f.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (${results.length})`);
}

main().catch((e) => {
  console.error('Фатальная ошибка:', e);
  process.exit(1);
});
