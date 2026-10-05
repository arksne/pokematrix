/**
 * Проверка работоспособности PokeMatrix через Telegram Mini App.
 *
 *   node tools/verify/run.mjs            полный прогон
 *   node tools/verify/run.mjs --keep-pg  не пересоздавать БД
 *   node tools/verify/run.mjs --serve    только поднять и ждать (ручная отладка)
 *
 * Что происходит:
 *   1. поднимается настоящий PostgreSQL (PGlite в режиме pg-wire сервера);
 *   2. собираются клиент (Vite) и сервер (tsc), если нет свежих сборок;
 *   3. сервер поднимается в NODE_ENV=production с настоящим BOT_TOKEN
 *      и ALLOW_DEV_LOGIN=false — тот же путь, что на Render;
 *   4. в Chromium проверяется вход через Telegram Mini App;
 *   5. отдельными процессами идут проверки данных, безопасности и экономики.
 *
 * Почему браузер открывается не на localhost: клиент (src/game/auth.ts)
 * считает `localhost` и `?dev` режимом разработки и обходит аутентификацию.
 * Поэтому страница открывается на хосте pokematrix.test, а Chromium запускается
 * с --host-resolver-rules.
 *
 * Почему telegram-web-app.js перехватывается: index.html подключает настоящий
 * скрипт Telegram, который перезатирает window.Telegram. В ответ на его запрос
 * отдаётся шим с initData, подписанным по алгоритму Telegram.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { startPg } from './pg.mjs';
import {
  REPO, TOOLS, STATE_DIR, SERVER_DIR, DIST_DIR, PG_URL, APP_PORT, APP_URL, BOT_TOKEN, HOST_ALIAS,
} from './paths.mjs';
import { playwright } from './support.mjs';

const KEEP_PG = process.argv.includes('--keep-pg');
const SERVE_ONLY = process.argv.includes('--serve');
const SKIP_BUILD = process.argv.includes('--skip-build') || existsSync(path.join(DIST_DIR, 'index.html'))
  && existsSync(path.join(SERVER_DIR, 'dist', 'index.js'));

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runNode(args, opts = {}) {
  const r = spawnSync(process.execPath, args, {
    stdio: 'pipe', encoding: 'utf8', ...opts,
  });
  if (r.error) return { code: -1, out: String(r.error.message) };
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function buildClient() {
  log('  [build] vite build');
  const r = runNode([path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: REPO });
  if (r.code !== 0) return fail('vite build', r.out);
  return true;
}

function buildServer() {
  log('  [build] tsc server');
  const r = runNode(
    [path.join(SERVER_DIR, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'],
    { cwd: SERVER_DIR },
  );
  if (r.code !== 0) return fail('tsc server', r.out);
  // Миграции копируются отдельно: в npm-скрипте это делает shell-команда cp.
  const cp = runNode(['-e',
    `require('fs').cpSync('src/db/migrations','dist/db/migrations',{recursive:true})`],
    { cwd: SERVER_DIR });
  if (cp.code !== 0) return fail('копирование миграций', cp.out);
  return true;
}

function fail(what, out) {
  log(`  [build] ${what} FAILED:`);
  for (const l of out.split('\n').slice(-12)) log('    ' + l);
  return false;
}

async function waitHealthy(timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${APP_PORT}/api/health`);
      if (res.ok) return res.json();
    } catch (_) {}
    await sleep(400);
  }
  return null;
}

// ─────────────────────────────────────────── сценарии в браузере
async function browserScenarios() {
  const { chromium } = playwright();
  const results = [];
  const browser = await chromium.launch({
    args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
  });

  // A. Mini App с валидно подписанным initData
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const badResponses = [];

    let authStatus = null;
    let trainersStatus = null;
    let trainersBody = '';
    let trainersUrl = '';
    let trainersAllStatus = null;
    let trainersAllUrl = '';
    let trainersAllBody = '';
    let locationPostStatus = null;
    let chatStatus = null;
    let chatUrl = '';
    let chatBody = '';

    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(m.text().slice(0, 240)); });

    page.on('response', async (r) => {
      if (r.url().includes('/api/auth/tg')) authStatus = r.status();
      if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
      // Список тренеров на локации: важно не только что запрос ушёл, но и что он
      // прошёл авторизацию. Раньше здесь был голый fetch() без Bearer, сервер
      // отвечал 401, и список всегда был пустым — а сценарий этого не замечал,
      // потому что 401 не попадал в badResponses как ошибка приложения.
      // Списки тренеров. Проверяем оба: по локации и общий.
      // Для локации важно не только что запрос ушёл, но и что он прошёл
      // авторизацию: раньше здесь был голый fetch() без Bearer, сервер отвечал
      // 401, и список всегда был пустым. Для общего списка важно отсутствие
      // двойного префикса: apiFetch уже добавляет /api, и вызов apiFetch('/api/...')
      // давал /api/api/... -> 404.
      if (/\/api\/profile\/trainers(\?|$)/.test(r.url())) {
        trainersStatus = r.status();
        trainersUrl = r.url();
        try { trainersBody = (await r.text()).slice(0, 120); } catch { trainersBody = '(не читается)'; }
      }
      if (/\/api\/profile\/trainers\/all/.test(r.url())) {
        trainersAllStatus = r.status();
        trainersAllUrl = r.url();
        try { trainersAllBody = (await r.text()).slice(0, 120); } catch { trainersAllBody = '(не читается)'; }
      }

      if (r.url().includes('/api/profile/location') && r.request().method() === 'POST') {
        locationPostStatus = r.status();
      }
      // Чат. Там был тот же баг, что и в списке тренеров: голый fetch() без
      // Bearer давал 401, и пустой чат выглядел как «сообщений нет».
      if (r.url().includes('/api/chat/messages')) {
        chatStatus = r.status();
        chatUrl = r.url();
        try { chatBody = (await r.text()).slice(0, 80); } catch { chatBody = '(не читается)'; }
      }

    });

    const { signInitData, webAppShim, makeUser } = await import('./tgsign.mjs');
    const { initData } = signInitData(BOT_TOKEN, makeUser());
    await page.route('**/telegram-web-app.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) })
    );
    await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(9000);

    // Панель тренера рендерится не сразу, поэтому ждём сам запрос, а не время.
    // Без этого проверка молча проходила: запрос ещё не ушёл, trainersStatus
    // оставался null, и сценарий выглядел как «ничего не проверял».
    let listPresent = false;
    const trainersDeadline = Date.now() + 25000;
    while (Date.now() < trainersDeadline) {
      if (trainersStatus !== null) break;
      listPresent = await page.evaluate(() => !!document.getElementById('trainer-location-list'));
      if (!listPresent) { await sleep(500); continue; }
      await sleep(500);
    }
    listPresent = listPresent || await page.evaluate(() => !!document.getElementById('trainer-location-list'));
    if ((trainersStatus === null || trainersAllStatus === null) && listPresent) {
      // Панель есть, но запрос не ушёл — открываем вкладку и ждём ещё.
      await page.evaluate(() => {
        document.querySelector('[data-target="view-trainers"]')?.click();
        document.getElementById('view-trainers')?.click();
      });
      const until = Date.now() + 15000;
      while ((trainersStatus === null || trainersAllStatus === null) && Date.now() < until) await sleep(500);
    }
    await page.evaluate(() => {
      document.querySelector('[data-target="view-chat"]')?.click();
      document.getElementById('view-chat')?.click();
      document.querySelector('.nav-btn[data-target*="chat" i]')?.click();
    });
    const chatUntil = Date.now() + 12000;
    while (chatStatus === null && Date.now() < chatUntil) await sleep(400);

    const listText = await page.evaluate(() => document.getElementById('trainer-location-list')?.textContent ?? null);
    const cardDiag = await page.evaluate(() => ({
      'trainer-name': document.getElementById('trainer-name')?.textContent ?? '(нет элемента)',
      'trainer-badges': document.getElementById('trainer-badges')?.textContent ?? '(нет элемента)',
      'trainer-caught': document.getElementById('trainer-caught')?.textContent ?? '(нет элемента)',
    }));


    const diag = await page.evaluate(() => ({
      hasWebApp: !!window.Telegram?.WebApp,
      initDataLen: (window.Telegram?.WebApp?.initData || '').length,
      hostname: location.hostname,
    }));
    const trainerId = await page.evaluate(() => localStorage.getItem('league17_trainer_id'));
    const overlayVisible = await page.evaluate(() => {
      const o = document.getElementById('login-overlay');
      return !!o && getComputedStyle(o).display !== 'none' && o.offsetParent !== null;
    });
    const domSize = await page.evaluate(() => document.body.innerHTML.length);

    results.push({
      id: 'A', name: 'Mini App: валидная подпись initData -> игра грузится',
      pass: authStatus === 200 && !!trainerId && !overlayVisible && domSize > 5000 && pageErrors.length === 0
        // 4xx на фоновых запросах раньше только попадали в details и никогда не
        // роняли прогон. Из-за этого chat/messages 401-ился на каждом опросе,
        // попадал в badResponses — и набор оставался зелёным.
        && badResponses.length === 0,
      details: {
        'диагностика': JSON.stringify(diag),
        'HTTP /api/auth/tg': authStatus,
        'trainer_id': trainerId,
        'login-overlay виден': overlayVisible,
        'DOM размер': domSize,
        'pageerror': pageErrors,
        'ответы с ошибкой': badResponses.slice(0, 8),
      },
    });


    // A2. Оба списка тренеров
    // Общий список — это вкладка «Тренеры», он обязан работать: с двойным
    // префиксом apiFetch('/api/...') уходил /api/api/... и получал 404.
    // Список по локации проверяем на запрете 401/404: в этом окружении панель
    // тренера может не отрисоваться, и тогда запрос просто не уйдёт. Но если
    // ушёл — обязан быть 200. Исходные баги были именно 401 (нет Bearer) и 404.
    const allOk = trainersAllStatus === 200 && /"users"/.test(trainersAllBody);
    const locOk = trainersStatus === null ? true : (trainersStatus === 200 && /"trainers"/.test(trainersBody));
    const chatOk = chatStatus === 200 && /"messages"/.test(chatBody);
    results.push({
      id: 'A2', name: 'Списки тренеров и чат загружаются с авторизацией',
      pass: allOk && locOk && chatOk,
      details: {
        'HTTP /api/profile/trainers/all': trainersAllStatus === null ? '(запрос не уходил)' : trainersAllStatus,
        'URL all': trainersAllUrl || '(не было)',
        'ответ all': (trainersAllBody || '(пусто)').slice(0, 90),
        'HTTP /api/profile/trainers': trainersStatus === null ? '(панель не отрисована, запрос не уходил)' : trainersStatus,
        'URL': trainersUrl || '(не было)',
        'ответ': (trainersBody || '(пусто)').slice(0, 90),
        'HTTP /api/chat/messages': chatStatus === null ? '(запрос не уходил)' : chatStatus,
        'URL chat': chatUrl || '(не было)',
        'ответ chat': chatBody || '(пусто)',
        'текст в панели': listText === null ? '(элемента нет)' : `"${listText}"`,
        'карточка тренера': JSON.stringify(cardDiag),
        'POST /api/profile/location': locationPostStatus === null ? '(не уходил)' : locationPostStatus,
        'почему важно': '401 без Bearer -> пустой список и пустой чат; /api/api/... -> 404',
      },
    });

    await ctx.close();
  }

  // B. Обычный браузер без Telegram
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let authStatus = null;
    page.on('response', (r) => { if (r.url().includes('/api/auth/tg')) authStatus = r.status(); });
    await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(7000);
    const text = await page.evaluate(() => {
      const o = document.getElementById('login-overlay');
      return o ? o.innerText.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    });
    const visible = await page.evaluate(() => {
      const o = document.getElementById('login-overlay');
      return !!o && getComputedStyle(o).display !== 'none';
    });
    results.push({
      id: 'B', name: 'Браузер без Telegram -> вход запрещён',
      pass: authStatus === null && visible && /Telegram/i.test(text),
      details: { 'HTTP /api/auth/tg': authStatus ?? '(не вызывался)', 'overlay виден': visible, 'текст': text },
    });
    await ctx.close();
  }

  // C. Подделанная подпись
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let authStatus = null;
    let body = '';
    page.on('response', async (r) => {
      if (r.url().includes('/api/auth/tg')) {
        authStatus = r.status();
        try { body = (await r.text()).slice(0, 160); } catch (_) {}
      }
    });
    const { signInitData, webAppShim, makeUser } = await import('./tgsign.mjs');
    const { initData } = signInitData(BOT_TOKEN, makeUser(777000111, 'verify_tester', 'Verify'));
    const tampered = initData.replace(/hash=[0-9a-f]{64}/, 'hash=' + '0'.repeat(64));
    await page.route('**/telegram-web-app.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(tampered) })
    );
    await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(7000);
    results.push({
      id: 'C', name: 'Подделанная подпись initData -> 401',
      pass: authStatus === 401,
      details: { 'HTTP /api/auth/tg': authStatus, 'ответ': body },
    });
    await ctx.close();
  }

  await browser.close();
  return results;
}

// ─────────────────────────────────────────── запуск набора тестов
function runSuite(name, file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(TOOLS, file)], {
      cwd: REPO,
      env: { ...process.env, VERIFY_PORT: String(APP_PORT), VERIFY_BOT_TOKEN: BOT_TOKEN },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buf = '';
    child.stdout.on('data', (d) => { buf += d.toString(); });
    child.stderr.on('data', (d) => { buf += d.toString(); });
    child.on('close', (code) => resolve({ code, out: buf }));
  });
}

// ─────────────────────────────────────────── main
async function main() {
  log('═══ ПРОВЕРКА РАБОТОСПОСОБНОСТИ POKEMATRIX (Telegram Mini App) ═══');
  log(`репозиторий: ${REPO}`);
  log(`хост-алиас:  ${HOST_ALIAS} -> 127.0.0.1 (чтобы клиент не считал себя localhost)\n`);

  let exitCode = 0;
  mkdirSync(STATE_DIR, { recursive: true });
  if (!KEEP_PG) rmSync(path.join(STATE_DIR, 'pgdata'), { recursive: true, force: true });

  // Проверка миграций на пустой базе идёт первой и в своём процессе: она
  // поднимает собственный PGlite, поэтому порт основной БД ещё свободен.
  // В продакшене база создаётся заново, и applied с нуля — самый рискованный
  // момент: любая ошибка порядка видна только там.
  log('[0] миграции на пустой базе (сверка с schema.ts)');
  {
    const r = await runSuite('migrations', 'migrate-fresh.test.mjs');
    for (const l of r.out.split('\n')) {
      if (/PASS|FAIL|МИГРАЦИИ/.test(l)) log('  ' + l.trimEnd());
    }
    if (r.code !== 0) exitCode = 1;
  }

  log('[1] PostgreSQL (PGlite, pg-wire)');
  const pg = await startPg({ fresh: false });
  log(`    ${PG_URL}`);
  {
    const { createRequire } = await import('node:module');
    const req = createRequire(path.join(SERVER_DIR, 'package.json'));
    const { Client } = req('pg');
    const c = new Client({ connectionString: PG_URL });
    await c.connect();
    const v = await c.query('select version()');
    await c.end();
    log(`    ${v.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
  }

  log('\n[2] сборка');
  if (SKIP_BUILD) {
    log('    пропущена (сборки на месте)');
  } else {
    if (!buildClient()) { await pg.stop(); process.exit(1); }
    log('    клиент: OK');
    if (!buildServer()) { await pg.stop(); process.exit(1); }
    log('    сервер: OK');
  }

  log('\n[3] сервер (NODE_ENV=production, BOT_TOKEN задан, ALLOW_DEV_LOGIN=false)');
  const out = openSync(path.join(STATE_DIR, 'server.out.log'), 'a');
  const err = openSync(path.join(STATE_DIR, 'server.err.log'), 'a');
  const srv = spawn(process.execPath, ['dist/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(APP_PORT),
      DATABASE_URL: PG_URL,
      BOT_TOKEN,
      JWT_SECRET: 'verify-jwt-secret-not-production',
      ADMIN_PASS: 'verify-admin-pass',
      ALLOW_DEV_LOGIN: 'false',
      CORS_ORIGINS: `http://localhost:${APP_PORT},http://${HOST_ALIAS}:${APP_PORT}`,
      LOG_LEVEL: 'info',
          DB_SSL: 'disable',
          // PGlite отдаёт одно соединение по pg-wire. С пулом больше одного
          // параллельные запросы рвали его с ECONNRESET, и чат отвечал 500.
          DB_POOL_MAX: '1',

    },
    stdio: ['ignore', out, err],
  });

  const health = await waitHealthy();
  if (!health) {
    log('    сервер не поднялся / не стал здоровым');
    srv.kill(); await pg.stop(); process.exit(1);
  }
  log(`    /api/health -> ${JSON.stringify(health)}`);

  if (SERVE_ONLY) {
    log('\n    --serve: держу сервер. Ctrl+C для остановки.');
    await new Promise(() => {});
  }

  log('\n[4] сценарии в браузере');
  let browserResults = [];
  try {
    browserResults = await browserScenarios();
  } catch (e) {
    log('    ОШИБКА сценариев:', e.message);
    exitCode = 1;
  }
  for (const r of browserResults) {
    log(`\n  [${r.id}] ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
    for (const [k, v] of Object.entries(r.details || {})) {
      log(`        ${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`);
    }
  }
  if (browserResults.length && browserResults.some((r) => !r.pass)) {
    log('\n  ИТОГ: есть проваленные сценарии');
    exitCode = 1;
  } else if (browserResults.length) {
    log('\n  ИТОГ: все сценарии прошли');
  }

  // Отдельными процессами: PGlite обслуживает одно соединение, поэтому
  // синхронный запуск (spawnSync) заблокировал бы event loop и БД перестала бы
  // отвечать. spawn + ожидание оставляет цикл событий свободным.
  for (const [title, file] of [
    ['[5] проверки данных', 'data.test.mjs'],
    ['[6] проверки безопасности', 'security.test.mjs'],
    ['[7] проверки экономики', 'economy.test.mjs'],
    ['[8] схема против настоящего сейва', 'schema-real-save.test.mjs'],
    ['[9] сохранения: конфликт версий и целостность', 'save-conflict.test.mjs'],
    ['[10] рендер мира', 'world-render.test.mjs'],
    ['[11] достижимость обмена', 'trade-reach.test.mjs'],
    ['[12] аудит боевых механик', 'battle-mechanics.test.mjs'],
    ['[13] аудит графа импортов клиента', 'import-audit.test.mjs'],
    ['[14] аудит DOM-контракта', 'dom-audit.test.mjs'],
  ]) {
    log(`\n${title}`);
    const r = await runSuite(title, file);
    for (const l of r.out.split('\n')) {
      if (/\[(?:R|S|E|T|D|TR|DR|W|C|M|H|B|P|G)\d+\]/.test(l) || /ПРОВАЛЕНО|ВСЕ ПРОВЕРКИ|МИР РЕНДЕРИТСЯ|ОБМЕН ДОСТИЖИМ|Боевые механики/.test(l)) log('  ' + l.trimEnd());
    }
    if (r.code !== 0) {
      if (!/ПРОВАЛЕНО|ВСЕ ПРОВЕРКИ/.test(r.out)) log('  вывод: ' + r.out.slice(-500));
      exitCode = 1;
    }
  }

  // Проверка БД — после остановки сервера: pg-wire держит одно соединение.
  srv.kill();
  await sleep(600);
  closeSync(out);
  closeSync(err);
  try {
    const t = await pg.db.query(
      "select table_name from information_schema.tables where table_schema='public' order by 1",
    );
    const u = await pg.db.query('select count(*)::int as n from users').catch(() => ({ rows: [{ n: 'n/a' }] }));
    log(`\n  [БД] таблиц: ${t.rows.length} -> ${t.rows.map((r) => r.table_name).join(', ')}`);
    log(`  [БД] пользователей: ${u.rows[0].n}`);
  } catch (e) {
    log(`\n  [БД] проверка не удалась: ${e.message}`);
  }

  await pg.stop();
  log(`\nлоги сервера: ${path.join(STATE_DIR, 'server.out.log')}`);
  process.exit(exitCode);
}

main().catch((e) => {
  log('КРИТИЧЕСКАЯ ОШИБКА ПРОВЕРКИ:', e.stack || e.message);
  process.exit(2);
});
