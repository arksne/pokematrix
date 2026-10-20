#!/usr/bin/env node
/**
 * gen-editor.mjs — вписывает ТЕКУЩИЕ данные игры прямо в public/editor.html.
 *
 * Страница должна работать с диска (file://), без сервера и без выкачивания
 * JSON — значит всё, что нужно для правки, лежит внутри неё:
 *
 *   const BASELINE = { locations, drops, shops, items, serverPrices }
 *
 * BASELINE — снимок того, что сейчас в игре. Редактор показывает его и
 * правит копию. Разница BASELINE vs DATA — твои правки (я потом применю).
 *
 * Генератор ТОЛЬКО ЧИТАЕТ исходники и переписывает один html-файл.
 * Код игры он не трогает.
 *
 * Запуск:  node tools/editor/gen-editor.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const list = (s) => [...(s || '').matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);

// ── Локации: всё, что сейчас в regions.ts ────────────────────────────────
function parseRegions() {
  const src = read('src/data/regions.ts');
  const out = [];
  const locRe = /^ {6}([a-zA-Z0-9_]+):\s*\{/;
  const regionRe = /^ {2}([a-z]+):\s*\{/;
  let region = 'kanto', cur = null;

  const flush = () => {
    if (!cur) return;
    const body = cur.body.join('\n');
    const pick = (re) => (body.match(re) || [])[1];
    const num = (re) => (pick(re) ? +pick(re) : null);
    out.push({
      id: cur.id, region: cur.region,
      name: pick(/name:\s*'([^']*)'/) || cur.id,
      encounters: list(pick(/encounters:\s*\[([^\]]*)\]/)),
      dayEncounters: list(pick(/dayEncounters:\s*\[([^\]]*)\]/)),
      nightEncounters: list(pick(/nightEncounters:\s*\[([^\]]*)\]/)),
      wildMinLvl: num(/wildMinLvl:\s*(\d+)/),
      wildMaxLvl: num(/wildMaxLvl:\s*(\d+)/),
      mechanic: pick(/mechanic:\s*\{([^}]*)\}/)?.replace(/\s+/g, ' ').trim() || null,
      noCatch: /noCatch:\s*true/.test(body),
      bossLvl: num(/bossLvl:\s*(\d+)/),
      requiresBadges: num(/requiresBadges:\s*(\d+)/),
      hasWater: /hasWater:\s*true/.test(body),
    });
    cur = null;
  };

  for (const line of src.split('\n')) {
    const rm = line.match(regionRe);
    if (rm) { region = rm[1]; continue; }
    const lm = line.match(locRe);
    if (lm) { flush(); cur = { id: lm[1], region, body: [line] }; continue; }
    if (cur) cur.body.push(line);
  }
  flush();
  return out;
}

// ── Дропы по видам ───────────────────────────────────────────────────────
function parseDrops() {
  const src = read('src/data/drops.js');
  const body = src.slice(src.indexOf('MONSTER_DROP_TABLE'));
  const out = {};
  for (const m of body.matchAll(/\n {2}([a-zA-Z0-9_\-]+):\s*\[(.*?)\]/gs)) {
    const entries = [];
    for (const d of m[2].matchAll(/item:\s*'([^']+)'[^}]*?chance:\s*([\d.]+)[^}]*?qty:\s*(\d+)/gs)) {
      entries.push({ item: d[1], chance: +d[2], qty: +d[3] });
    }
    if (entries.length) out[m[1]] = entries;
  }
  return out;
}

// ── Магазины ─────────────────────────────────────────────────────────────
function parseShops() {
  const src = read('src/data/shops.ts');
  const tiers = {};
  const tierBlock = src.slice(src.indexOf('SHOP_TIERS'), src.indexOf('SHOP_STOCK_RAW'));
  for (const m of tierBlock.matchAll(/'([^']+)':\s*(\d+)/g)) tiers[m[1]] = +m[2];

  const stock = {};
  const rawBlock = src.slice(src.indexOf('SHOP_STOCK_RAW'), src.indexOf('export const TIER_BALLS'));
  for (const m of rawBlock.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) stock[m[1]] = list(m[2]);

  const balls = {};
  const ballBlock = src.slice(src.indexOf('TIER_BALLS'), src.indexOf('SHOP_STOCK'));
  for (const m of ballBlock.matchAll(/\n {2}(\d+):\s*\[([^\]]*)\]/g)) balls[m[1]] = list(m[2]);

  const exclude = {};
  if (src.includes('MART_EXCLUDE')) {
    const exBlock = src.slice(src.indexOf('MART_EXCLUDE'), src.indexOf('/** Итоговый ассортимент'));
    for (const m of exBlock.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) exclude[m[1]] = list(m[2]);
  }

  const final = {};
  for (const [mart, base] of Object.entries(stock)) {
    const tier = tiers[mart];
    const ex = new Set(exclude[mart] || []);
    final[mart] = {
      tier: tier ?? 0,
      items: [...new Set([...base, ...(balls[String(tier)] || balls['0'] || [])])]
        .filter((id) => !ex.has(id)).sort(),
    };
  }
  return final;
}

// ── Предметы и цены ─────────────────────────────────────────────────────
function parseItems() {
  const src = read('src/data/items.ts');
  const out = {};
  for (const m of src.matchAll(/\{ id:\s*'([\w]+)',\s*nameRu:\s*'([^']*)'/g)) {
    const tail = src.slice(m.index, m.index + 700);
    const price = (tail.match(/price:\s*(\d+)/) || [])[1];
    const sell = (tail.match(/sellPrice:\s*(\d+)/) || [])[1];
    if (price !== undefined) {
      out[m[1]] = { name: m[2], price: +price, sellPrice: sell ? +sell : null };
    }
  }
  return out;
}

function parseServerPrices() {
  const src = read('server/src/routes/economy.ts');
  const out = {};
  for (const m of src.matchAll(/\{\s*id:\s*'([\w]+)',\s*price:\s*(\d+)\s*\}/g)) out[m[1]] = +m[2];
  return out;
}

// ── Сборка и вставка ────────────────────────────────────────────────────
const baseline = {
  locations: parseRegions(),
  drops: parseDrops(),
  shops: parseShops(),
  items: parseItems(),
  serverPrices: parseServerPrices(),
};

const htmlPath = join(ROOT, 'public', 'editor.html');
let html = readFileSync(htmlPath, 'utf8');

const marker = 'const BASELINE = /*__BASELINE__*/null;';
if (!html.includes(marker)) {
  console.error('маркер BASELINE не найден в editor.html');
  process.exit(1);
}
html = html.replace(marker, 'const BASELINE = ' + JSON.stringify(baseline) + ';');

writeFileSync(htmlPath, html, 'utf8');

const size = Math.round(Buffer.byteLength(html) / 1024);
console.log('public/editor.html обновлён:');
console.log('  локаций  :', baseline.locations.length);
console.log('  дропов   :', Object.keys(baseline.drops).length);
console.log('  маркетов :', Object.keys(baseline.shops).length);
console.log('  предметов:', Object.keys(baseline.items).length);
console.log('  размер   :', size, 'KB (страница самодостаточная, работает с диска)');
