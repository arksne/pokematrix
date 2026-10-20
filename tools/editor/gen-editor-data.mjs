#!/usr/bin/env node
/**
 * gen-editor-data.mjs — собирает public/editor-data.json для страницы-редактора.
 *
 * Источники (правь в них, потом запусти скрипт — он пересоберёт JSON):
 *   src/data/regions.ts        — локации, энкаунтеры (день/ночь), уровни, механики
 *   src/data/drops.js          — дропы по видам (покемон → предмет/шанс/количество)
 *   src/data/shops.ts          — ассортимент маркетов (тиры, списки, исключения)
 *   src/data/items.ts          — цены предметов (покупка/продажа)
 *   server/src/routes/economy.ts — АВТОРИТЕТНЫЕ цены сервера (покупка/продажа)
 *
 * Запуск:  node tools/editor/gen-editor-data.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
// Исходники в репозитории с CRLF — нормализуем переводы строк, иначе
// все регулярки с \n перестают совпадать.
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

/** Разбор списка ['a','b'] или ["a","b"] → массив строк. */
function parseList(s) {
  if (!s) return [];
  return [...s.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
}

// ─────────────────────────────────────────── локации
// Линейный разбор: идём по файлу, локация — ключ с отступом 6 пробелов,
// регион меняется на '  johto: {'. Тело локации — от ключа до следующего
// ключа с таким же отступом.
function parseRegions() {
  const src = read('src/data/regions.ts');
  const lines = src.split('\n');
  const out = [];

  const locRe = /^ {6}([a-zA-Z0-9_]+):\s*\{/;
  const regionRe = /^ {2}([a-z]+):\s*\{/;

  let region = 'kanto';
  let cur = null;   // { id, region, body: string[] }

  const flush = () => {
    if (!cur) return;
    const body = cur.body.join('\n');
    const pick = (re) => (body.match(re) || [])[1];
    out.push({
      id: cur.id,
      region: cur.region,
      name: pick(/name:\s*'([^']*)'/) || cur.id,
      links: parseList(pick(/links:\s*\[([^\]]*)\]/)),
      encounters: parseList(pick(/encounters:\s*\[([^\]]*)\]/)),
      dayEncounters: parseList(pick(/dayEncounters:\s*\[([^\]]*)\]/)),
      nightEncounters: parseList(pick(/nightEncounters:\s*\[([^\]]*)\]/)),
      wildMinLvl: pick(/wildMinLvl:\s*(\d+)/) ? +pick(/wildMinLvl:\s*(\d+)/) : null,
      wildMaxLvl: pick(/wildMaxLvl:\s*(\d+)/) ? +pick(/wildMaxLvl:\s*(\d+)/) : null,
      mechanic: pick(/mechanic:\s*\{([^}]*)\}/)?.replace(/\s+/g, ' ').trim() || null,
      noCatch: /noCatch:\s*true/.test(body),
      bossLvl: pick(/bossLvl:\s*(\d+)/) ? +pick(/bossLvl:\s*(\d+)/) : null,
      requiresBadges: pick(/requiresBadges:\s*(\d+)/) ? +pick(/requiresBadges:\s*(\d+)/) : null,
      hasWater: /hasWater:\s*true/.test(body),
      hasHeal: /hasHeal:\s*true/.test(body),
    });
    cur = null;
  };

  for (const line of lines) {
    const rm = line.match(regionRe);
    if (rm) { region = rm[1]; continue; }
    const lm = line.match(locRe);
    if (lm) { flush(); cur = { id: lm[1], region, body: [line] }; continue; }
    if (cur) cur.body.push(line);
  }
  flush();
  return out;
}

// ─────────────────────────────────────────── дропы по видам
function parseDrops() {
  const src = read('src/data/drops.js');
  const body = src.slice(src.indexOf('MONSTER_DROP_TABLE'));
  const out = {};
  for (const m of body.matchAll(/\n {2}([a-zA-Z0-9_\-]+):\s*\[(.*?)\]/gs)) {
    const species = m[1];
    const entries = [];
    for (const d of m[2].matchAll(/item:\s*'([^']+)'[^}]*?chance:\s*([\d.]+)[^}]*?qty:\s*(\d+)/gs)) {
      entries.push({ item: d[1], chance: +d[2], qty: +d[3] });
    }
    if (entries.length) out[species] = entries;
  }
  return out;
}

// ─────────────────────────────────────────── маркеты
function parseShops() {
  const src = read('src/data/shops.ts');
  const tiers = {};
  const tierBlock = src.slice(src.indexOf('SHOP_TIERS'), src.indexOf('SHOP_STOCK_RAW'));
  for (const m of tierBlock.matchAll(/'([^']+)':\s*(\d+)/g)) tiers[m[1]] = +m[2];

  const rawBlock = src.slice(src.indexOf('SHOP_STOCK_RAW'), src.indexOf('export const TIER_BALLS'));
  const stock = {};
  for (const m of rawBlock.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) {
    stock[m[1]] = parseList(m[2]);
  }

  const balls = {};
  const ballBlock = src.slice(src.indexOf('TIER_BALLS'), src.indexOf('SHOP_STOCK'));
  for (const m of ballBlock.matchAll(/\n {2}(\d+):\s*\[([^\]]*)\]/g)) {
    balls[m[1]] = parseList(m[2]);
  }

  const exclude = {};
  const exBlock = src.includes('MART_EXCLUDE')
    ? src.slice(src.indexOf('MART_EXCLUDE'), src.indexOf('/** Итоговый ассортимент'))
    : '';
  for (const m of exBlock.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) exclude[m[1]] = parseList(m[2]);

  return { tiers, stock, balls, exclude };
}

// ─────────────────────────────────────────── предметы и цены
function parseItems() {
  const src = read('src/data/items.ts');
  const out = {};
  for (const m of src.matchAll(/\{ id:\s*'([\w]+)',\s*nameRu:\s*'([^']*)'/g)) {
    const tail = src.slice(m.index, m.index + 700);
    const price = (tail.match(/price:\s*(\d+)/) || [])[1];
    const sell = (tail.match(/sellPrice:\s*(\d+)/) || [])[1];
    const cat = (tail.match(/category:\s*'([^']*)'/) || [])[1];
    if (price !== undefined) {
      out[m[1]] = { name: m[2], price: +price, sellPrice: sell ? +sell : null, category: cat || '' };
    }
  }
  return out;
}

/** Цены сервера — они авторитетные для покупки/продажи. */
function parseServerPrices() {
  const src = read('server/src/routes/economy.ts');
  const out = {};
  // Серверный прайс-лист: массив ITEMS = [ { id: 'x', price: N }, ... ]
  for (const m of src.matchAll(/\{\s*id:\s*'([\w]+)',\s*price:\s*(\d+)\s*\}/g)) {
    out[m[1]] = +m[2];
  }
  return out;
}

// ─────────────────────────────────────────── сборка
const locations = parseRegions();
const drops = parseDrops();
const shops = parseShops();
const items = parseItems();
const serverPrices = parseServerPrices();

// Итоговый ассортимент маркета = базовый список + шары тира − исключения
const martStock = {};
for (const [mart, base] of Object.entries(shops.stock)) {
  const tier = shops.tiers[mart];
  const balls = shops.balls[String(tier)] || shops.balls['0'] || [];
  const ex = new Set(shops.exclude[mart] || []);
  martStock[mart] = [...new Set([...base, ...balls])].filter((id) => !ex.has(id)).sort();
}

const data = {
  generatedAt: new Date().toISOString(),
  note: 'Изменения применяются в исходниках: src/data/regions.ts, src/data/drops.js, src/data/shops.ts, src/data/items.ts, server/src/routes/economy.ts',
  locations,
  drops,
  shops: {
    tiers: shops.tiers,
    stock: martStock,
    exclude: shops.exclude,
    balls: shops.balls,
  },
  items,
  serverPrices,
};

const outPath = join(ROOT, 'public', 'editor-data.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 1), 'utf8');

console.log('public/editor-data.json:');
console.log('  локаций      :', locations.length);
console.log('  видов с дропом:', Object.keys(drops).length);
console.log('  маркетов     :', Object.keys(martStock).length);
console.log('  предметов    :', Object.keys(items).length);
console.log('  цен сервера  :', Object.keys(serverPrices).length);
console.log('  размер       :', Math.round(readFileSync(outPath).length / 1024), 'KB');
