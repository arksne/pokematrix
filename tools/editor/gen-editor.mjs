#!/usr/bin/env node
/**
 * gen-editor.mjs — вписывает списки локаций/магазинов/предметов
 * прямо в public/editor.html (в виде массивов JS).
 *
 * Зачем: страница должна работать БЕЗ сервера и БЕЗ выкачивания JSON —
 * открыл файл с диска и работаешь. Поэтому id-шники лежат внутри страницы.
 *
 * Генератор ТОЛЬКО ЧИТАЕТ исходники и правит один html-файл.
 *
 * Запуск:  node tools/editor/gen-editor.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

/** id всех локаций (ключ с отступом 6 пробелов в regions.ts). */
function locations() {
  const src = read('src/data/regions.ts');
  const ids = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^ {6}([a-zA-Z0-9_]+):\s*\{/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/** id всех магазинов (ключи SHOP_STOCK_RAW). */
function shops() {
  const src = read('src/data/shops.ts');
  const block = src.slice(src.indexOf('SHOP_STOCK_RAW'), src.indexOf('export const TIER_BALLS'));
  const ids = [];
  for (const m of block.matchAll(/'([^']+)':\s*\[/g)) ids.push(m[1]);
  return ids;
}

/** id всех предметов. */
function items() {
  const src = read('src/data/items.ts');
  const ids = [];
  for (const m of src.matchAll(/\{ id:\s*'([\w]+)'/g)) ids.push(m[1]);
  return ids;
}

const htmlPath = join(ROOT, 'public', 'editor.html');
let html = readFileSync(htmlPath, 'utf8');

const put = (marker, arr) => {
  const val = JSON.stringify(arr, null, 0);
  const re = new RegExp(`(/?\\*${marker}\\*/)[^;]*?(;)`);
  if (!re.test(html)) {
    console.error('маркер не найден:', marker);
    process.exit(1);
  }
  html = html.replace(re, `$1${val}$2`);
};

put('__LOCATIONS__', locations());
put('__SHOPS__', shops());
put('__ITEMS__', items());

writeFileSync(htmlPath, html, 'utf8');
console.log('public/editor.html обновлён:');
console.log('  локаций :', locations().length);
console.log('  магазинов:', shops().length);
console.log('  предметов:', items().length);
console.log('  страница работает офлайн (file://), без сервера и без JSON');
