#!/usr/bin/env node
/**
 * tools/prod-check/run.mjs — 38 проверок боя и обмена против ЖИВОГО прода.
 *
 *   PROD_BOT_TOKEN=<токен прод-бота> node tools/prod-check/run.mjs [pvp|trade|arena]
 *
 * Без аргумента гоняет всё. Токен только через окружение, в репо его нет.
 * Тестовые юзеры стабильны (777900101..107), переиспользуются между прогонами.
 * Боевые данные игроков не трогаются — только тестовые аккаунты.
 */
import { BASE } from './lib.mjs';
import { runPvp } from './pvp.mjs';
import { runTrade } from './trade.mjs';
import { runArena } from './arena.mjs';

if (!process.env.PROD_BOT_TOKEN) {
  console.error('Нужен PROD_BOT_TOKEN в окружении (токен прод-бота для подписи тестовых юзеров).');
  process.exit(2);
}

const only = (process.argv[2] || 'all').toLowerCase();
console.log(`Прод-чеки против ${BASE}  [${only}]`);

let ok = true;
try {
  if (only === 'all' || only === 'pvp') ok = (await runPvp()) && ok;
} catch (e) {
  console.log(`  !! pvp упал исключением: ${e?.message || e}`);
  ok = false;
}
try {
  if (only === 'all' || only === 'trade') ok = (await runTrade()) && ok;
} catch (e) {
  console.log(`  !! trade упал исключением: ${e?.message || e}`);
  ok = false;
}
try {
  if (only === 'all' || only === 'arena') ok = (await runArena()) && ok;
} catch (e) {
  console.log(`  !! arena упал исключением: ${e?.message || e}`);
  ok = false;
}

console.log(ok ? '\nВСЕ ПРОД-ЧЕКИ ЗЕЛЁНЫЕ' : '\nЕСТЬ КРАСНЫЕ ПРОД-ЧЕКИ');
process.exit(ok ? 0 : 1);
