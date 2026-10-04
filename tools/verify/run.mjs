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
    const badResponses = [];
    let authStatus = null;
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/api/auth/tg')) authStatus = r.status();
      if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
    });

    const { signInitData, webAppShim, makeUser } = await import('./tgsign.mjs');
    const { initData } = signInitData(BOT_TOKEN, makeUser());
    await page.route('**/telegram-web-app.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) })
    );
    await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(9000);

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
      pass: authStatus === 200 && !!trainerId && !overlayVisible && domSize > 5000 && pageErrors.length === 0,
      details: {
        'диагностика': JSON.stringify(diag),
        'HTTP /api/auth/tg': authStatus,
        'trainer_id': trainerId,
        'login-overlay виден': overlayVisible,
        'DOM размер': domSize,
        'pageerror': pageErrors,
        'ответы с ошибкой': badResponses.slice(0, 5),
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
  ]) {
    log(`\n${title}`);
    const r = await runSuite(title, file);
    for (const l of r.out.split('\n')) {
      if (/\[(?:R|S|E|T|D)\d+\]/.test(l) || /ПРОВАЛЕНО|ВСЕ ПРОВЕРКИ/.test(l)) log('  ' + l.trimEnd());
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
