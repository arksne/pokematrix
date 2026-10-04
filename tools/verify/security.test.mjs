/**
 * Проверки безопасности: закрытые дыры действительно закрыты,
 * а сервер в production отказывается стартовать с опасной конфигурацией.
 * Требует поднятого сервера (см. run.mjs).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  createSuite, api, login, connect, sleep, socketIoClient,
} from './support.mjs';
import { SERVER_DIR, BOT_TOKEN, APP_PORT, PG_URL } from './paths.mjs';
import { signInitData, makeUser } from './tgsign.mjs';

const { check, finish } = createSuite('Безопасность');

// ── S1: initData без HMAC-подписи не даёт токен
// (прежний fallback «BOT_TOKEN не задан — просто распарсим user» позволял
//  получить JWT на любой tg_id без каких-либо учётных данных)
{
  const forged = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(makeUser(888000111, 'attacker', 'Mallory')),
  }).toString();
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData: forged } });
  check('S1', 'initData без HMAC-подписи не даёт токен', r.status !== 200 && !r.json?.token,
    `HTTP ${r.status} ${(r.json?.error || '').slice(0, 50)}`);
}

// ── S2: вход по initData="test" отключён
{
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData: 'test' } });
  check('S2', 'вход по initData="test" отключён', r.status !== 200 && !r.json?.token, `HTTP ${r.status}`);
}

// ── S3: подмена tg_id ломает подпись
{
  const { initData } = signInitData(BOT_TOKEN, makeUser(777000111, 'verify_tester', 'Verify'));
  const tampered = initData.replace('777000111', '888000111');
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData: tampered } });
  check('S3', 'подмена tg_id ломает подпись', r.status === 401, `HTTP ${r.status}`);
}

// ── S4: просроченная initData отклоняется (защита от replay)
{
  const old = Math.floor(Date.now() / 1000) - 7200;
  const { initData } = signInitData(BOT_TOKEN, makeUser(777000111, 'verify_tester', 'Verify'), {
    auth_date: String(old),
  });
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData } });
  check('S4', 'просроченная initData (2ч) отклоняется', r.status === 401, `HTTP ${r.status}`);
}

// ── S5: avatar санитизируется на сервере (stored XSS)
{
  const token = await login(666000333, 'xss_tester', 'Xss');
  await api('/api/auth/register', {
    method: 'POST', token,
    body: {
      nickname: 'Тест',
      avatar: '<img src=x onerror="fetch(`/api/admin/api`,{method:`POST`})">',
    },
  });
  const trainers = await api('/api/profile/trainers?locationId=goldenrodCity');
  const body = trainers.text || '';
  const payloadLeaked = /onerror/i.test(body);
  check('S5', 'avatar санитизируется (stored XSS закрыт)', !payloadLeaked,
    payloadLeaked ? 'payload попал в выдачу' : 'payload в выдаче отсутствует');
}

// ── S9: сервер переживает socket-пакеты без аргументов
{
  const token = await login(444000555, 'crash_tester', 'Crash');
  const io = socketIoClient();
  const sock = io(`http://127.0.0.1:${APP_PORT}`, {
    auth: { token }, transports: ['websocket'], reconnection: false,
  });
  await new Promise((res) => { sock.on('connect', res); setTimeout(res, 5000); });

  // Каждый из этих вызовов раньше приводил к TypeError внутри обработчика,
  // а бросок из callback'а socket.io доходит до uncaughtException.
  for (const ev of ['pvp_action', 'pvp_end', 'trade_offer', 'pvp_challenge', 'trade_accept']) {
    sock.emit(ev, undefined);
    await sleep(200);
  }
  sock.emit('pvp_action');
  sock.emit('trade_offer');
  await sleep(1500);
  sock.close();

  const alive = await api('/api/health');
  check('S9', 'сервер переживает socket-пакеты без аргументов', alive.status === 200,
    `/api/health -> ${alive.status}`);
}

// ── S6..S8: fail-fast при опасной конфигурации production
{
  const runServer = (env) => new Promise((resolve) => {
    // Собираем окружение явно: переменные из process.env наследуются, и если
    // забыть удалить BOT_TOKEN, сервер успешно стартует и проверка ложно «пройдёт».
    const childEnv = { ...process.env, PORT: String(APP_PORT + 1), DB_SSL: 'disable' };
    delete childEnv.BOT_TOKEN;
    delete childEnv.DATABASE_URL;
    delete childEnv.JWT_SECRET;
    delete childEnv.ADMIN_PASS;
    delete childEnv.ALLOW_DEV_LOGIN;
    delete childEnv.NODE_ENV;
    Object.assign(childEnv, env);

    const child = spawn('node', ['dist/index.js'], {
      cwd: SERVER_DIR, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => { child.kill(); resolve(-1); }, 15000);
    child.on('close', (code) => { clearTimeout(timer); resolve(code); });
  });

  const secrets = { JWT_SECRET: 'x'.repeat(20), ADMIN_PASS: 'y'.repeat(20) };

  const noToken = await runServer({
    ...secrets, NODE_ENV: 'production', DATABASE_URL: PG_URL, ALLOW_DEV_LOGIN: 'false',
  });
  check('S6', 'production без BOT_TOKEN не стартует (fail-fast)', noToken === 1, `exit=${noToken}`);

  const devLogin = await runServer({
    ...secrets, NODE_ENV: 'production', BOT_TOKEN, DATABASE_URL: PG_URL, ALLOW_DEV_LOGIN: 'true',
  });
  check('S7', 'production с ALLOW_DEV_LOGIN=true не стартует', devLogin === 1, `exit=${devLogin}`);

  const noDb = await runServer({
    ...secrets, NODE_ENV: 'production', BOT_TOKEN, ALLOW_DEV_LOGIN: 'false',
  });
  check('S8', 'production без DATABASE_URL не стартует', noDb === 1, `exit=${noDb}`);
}

await sleep(50);
finish();
