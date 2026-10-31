#!/usr/bin/env node
/**
 * tools/prod-check/wait-health.mjs — ждёт, пока прод оживёт.
 *
 *   node tools/prod-check/wait-health.mjs                  # ждать до 90 мин
 *   node tools/prod-check/wait-health.mjs --timeout-min 20
 *   node tools/prod-check/wait-health.mjs --interval-sec 10
 *   node tools/prod-check/wait-health.mjs --once           # один замер
 *
 * Успех = HTTP 200 И тело {status:"ok", db:true} (см. server/src/index.ts:181).
 * Пока идут миграции — 503 {status:"warming", db:false}; если упала БД —
 * 503 {status:"degraded", db:false}. Оба случая печатаются как есть, чтобы
 * отличать «ещё не поднялся» от «база отвалилась».
 *
 * Каждый запрос ограничен по времени (--request-timeout-sec, по умолчанию 20):
 * на Render сервис без доступной БД может держать соединение открытым, и без
 * этого таймаута один fetch съел бы весь бюджет ожидания.
 *
 * Код выхода: 0 — здоров, 1 — таймаут/не дождались, 2 — ошибка аргументов.
 * Последняя строка всегда HEALTH_OK или HEALTH_TIMEOUT — удобно грепать.
 */
import { BASE } from './lib.mjs';

const USAGE = `Usage: node tools/prod-check/wait-health.mjs [options]

  --timeout-min <n>          сколько всего ждать, минут (default 90)
  --interval-sec <n>         пауза между замерами, секунд (default 15)
  --request-timeout-sec <n>  таймаут одного запроса, секунд (default 20)
  --once                     сделать один замер и выйти
  --quiet                    печатать только смену состояния
  -h, --help                 эта справка`;

const argv = process.argv.slice(2);

function numArg(name, def) {
  const i = argv.indexOf(name);
  if (i === -1) return def;
  const raw = argv[i + 1];
  if (raw === undefined) throw new Error(`у ${name} нет значения`);
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`у ${name} некорректное значение: ${raw}`);
  return v;
}

function hasFlag(...names) {
  return names.some((n) => argv.includes(n));
}

if (hasFlag('-h', '--help')) {
  console.log(USAGE);
  process.exit(0);
}

const known = new Set(['--timeout-min', '--interval-sec', '--request-timeout-sec']);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--once' || a === '--quiet' || a === '-h' || a === '--help') continue;
  if (known.has(a)) { i++; continue; }
  console.error(`Неизвестный аргумент: ${a}\n\n${USAGE}`);
  process.exit(2);
}

let TIMEOUT_MIN, INTERVAL_SEC, REQ_TIMEOUT_SEC, ONCE, QUIET;
try {
  TIMEOUT_MIN = numArg('--timeout-min', 90);
  INTERVAL_SEC = numArg('--interval-sec', 15);
  REQ_TIMEOUT_SEC = numArg('--request-timeout-sec', 20);
  ONCE = hasFlag('--once');
  QUIET = hasFlag('--quiet');
} catch (e) {
  console.error(`${e.message}\n\n${USAGE}`);
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const startedAt = Date.now();
const hhmmss = () => new Date().toISOString().slice(11, 19);
const elapsedSec = () => Math.round((Date.now() - startedAt) / 1000);

/** Один замер. Никогда не бросает — всегда возвращает объект состояния. */
async function probe() {
  const url = `${BASE}/api/health`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(REQ_TIMEOUT_SEC * 1000),
      headers: { accept: 'application/json' },
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = JSON.parse(text); } catch { /* не JSON — печатаем как есть */ }
    const healthy = res.status === 200 && json?.status === 'ok' && json?.db === true;
    return {
      healthy,
      status: res.status,
      state: json?.status ?? null,
      db: json?.db ?? null,
      body: (text || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      error: null,
    };
  } catch (e) {
    const name = e?.name || '';
    const msg = name === 'TimeoutError' || name === 'AbortError'
      ? `нет ответа за ${REQ_TIMEOUT_SEC}с`
      : (e?.cause?.code || e?.code || e?.message || String(e));
    return { healthy: false, status: null, state: null, db: null, body: '', error: msg };
  }
}

function describe(s) {
  if (s.error) return `net: ${s.error}`;
  const bits = [`HTTP ${s.status}`];
  if (s.state) bits.push(`status=${s.state}`);
  if (s.db !== null) bits.push(`db=${s.db}`);
  if (s.body && !s.state) bits.push(`body=${s.body}`);
  return bits.join(' ');
}

console.log(`Жду готовности прода: ${BASE}/api/health`);
console.log(`Критерий: HTTP 200 + {"status":"ok","db":true}. Бюджет: ${TIMEOUT_MIN} мин, интервал ${INTERVAL_SEC}с.\n`);

let attempt = 0;
let lastLine = '';
let result = null;

while (true) {
  attempt++;
  const s = await probe();
  const line = describe(s);

  if (s.healthy) {
    console.log(`[${hhmmss()} +${elapsedSec()}s] #${attempt} OK  ${line}`);
    console.log(`\nHEALTH_OK ${BASE} за ${elapsedSec()}с (${attempt} замеров)`);
    process.exit(0);
  }
  result = s;

  // --quiet: печатаем только когда состояние изменилось, но каждый 5-й замер —
  // всегда, иначе процесс выглядит мёртвым и непонятно, ждём мы или повисли.
  if (!QUIET || line !== lastLine || attempt % 5 === 0) {
    console.log(`[${hhmmss()} +${elapsedSec()}s] #${attempt} ждём  ${line}`);
  }
  lastLine = line;

  if (ONCE) {
    console.log(`\nHEALTH_TIMEOUT (--once) ${BASE}`);
    process.exit(1);
  }

  if (elapsedSec() >= TIMEOUT_MIN * 60) {
    console.log(`\nHEALTH_TIMEOUT ${BASE} — бюджет ${TIMEOUT_MIN} мин исчерпан, ${attempt} замеров, последний: ${line}`);
    process.exit(1);
  }

  await sleep(INTERVAL_SEC * 1000);
}
