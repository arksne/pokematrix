#!/usr/bin/env node
/**
 * tools/prod-check/run.mjs — 50 проверок против ЖИВОГО прода.
 *
 *   PROD_BOT_TOKEN=<токен прод-бота> node tools/prod-check/run.mjs [all|infra|pvp|trade|arena]
 *
 * Без аргумента гоняет всё. Токен только через окружение, в репо его нет.
 * Тестовые юзеры стабильны (777900101..107), переиспользуются между прогонами.
 * Боевые данные игроков не трогаются — только тестовые аккаунты.
 *
 * Состав (50): infra HF1,V1,SJ1,CH1,LB1 (5) + PvP PC1..PC21 (21)
 *             + трейд TC1..TC15 (15) + арена TA1..TA9 (9).
 * Сверх того HF2 — ИНФОРМАЦИОННАЯ (шлюз Telegram): печатается как INFO и
 * на итог не влияет, потому что зависит от env на Render, а не от кода.
 * Infra идёт первой: если служба/сессия/коммит красные, остальное не имеет смысла.
 */
import { BASE } from './lib.mjs';
import { runInfra } from './infra.mjs';
import { runPvp } from './pvp.mjs';
import { runTrade } from './trade.mjs';
import { runArena } from './arena.mjs';

if (!process.env.PROD_BOT_TOKEN) {
  console.error('Нужен PROD_BOT_TOKEN в окружении (токен прод-бота для подписи тестовых юзеров).');
  process.exit(2);
}

const only = (process.argv[2] || 'all').toLowerCase();
const known = new Set(['all', 'infra', 'pvp', 'trade', 'arena']);
if (!known.has(only)) {
  console.error(`Неизвестный набор: ${only}. Допустимо: ${[...known].join('|')}`);
  process.exit(2);
}

// Пауза между наборами: у сервера два общих скользящих лимита по IP
// (auth 30/мин — логины, save 60/мин — GET+POST /api/save). Разносим наборы,
// чтобы не поймать 429 из-за собственного всплеска.
const GAP_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Прод-чеки против ${BASE}  [${only}]`);

let ok = true;
const suites = [
  ['infra', runInfra],
  ['pvp', runPvp],
  ['trade', runTrade],
  ['arena', runArena],
];

let ran = 0;
for (const [name, fn] of suites) {
  if (only !== 'all' && only !== name) continue;
  if (ran++ > 0) await sleep(GAP_MS);
  try {
    ok = (await fn()) && ok;
  } catch (e) {
    console.log(`  !! ${name} упал исключением: ${e?.message || e}`);
    ok = false;
  }
}

console.log(ok ? '\nВСЕ ПРОД-ЧЕКИ ЗЕЛЁНЫЕ' : '\nЕСТЬ КРАСНЫЕ ПРОД-ЧЕКИ');
process.exit(ok ? 0 : 1);
