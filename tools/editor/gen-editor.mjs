#!/usr/bin/env node
/**
 * gen-editor.mjs — вписывает ТЕКУЩИЕ ДАННЫЕ ИГРЫ в public/editor.html.
 *
 * Страница самодостаточная: работает с диска (file://), без сервера.
 * Внутрь вшиваются:
 *   BASELINE — слепок игры: локации (энкаунтеры день/ночь/общий, уровни,
 *     механики, гейты), дропы видов, магазины (состав+тиры), предметы с
 *     ценами, серверные цены.
 *   WEIGHTS  — вес появления вида (та же таблица шкалы, что в коде).
 *
 * Генератор ТОЛЬКО ЧИТАЕТ исходники. Код он не трогает.
 * Запуск: node tools/editor/gen-editor.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const list = (s) => [...(s || '').matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);

// ── ЛОКАЦИИ ──────────────────────────────────────────────────────────────
// Строка может быть обычной ('pidgey') или с явным весом встречи
// ({ name: 'snorlax', weight: 0.2 }). Вес — множитель к естественному весу
// вида: 1 = как обычно, 0.2 = в 5 раз реже.
function parseEntries(listStr) {
  if (!listStr) return [];
  const out = [];
  // сначала вынимаем объекты { name: 'x', ... }, потом одиночные строки
  const objRe = /\{\s*name:\s*'([^']+)'[^}]*\}/g;
  const objNames = new Set();
  let m;
  while ((m = objRe.exec(listStr))) {
    const e = { name: m[1] };
    const w = m[0].match(/weight:\s*([\d.]+)/);
    if (w) e.weight = +w[1];
    const lv = m[0].match(/level:\s*(\d+)/);
    if (lv) e.level = +lv[1];
    objNames.add(m[1].toLowerCase());
    out.push(e);
  }
  for (const n of list(listStr)) {
    if (!objNames.has(String(n).toLowerCase())) out.push(n);
  }
  return out;
}
function parseRegions() {
  const src = read('src/data/regions.ts');
  const lines = src.split('\n');
  const locRe = /^ {6}([a-zA-Z0-9_]+):\s*\{/;
  const regionRe = /^ {2}([a-z]+):\s*\{/;
  const out = [];
  let region = 'kanto', cur = null;
  const flush = () => {
    if (!cur) return;
    const body = cur.body.join('\n');
    const pick = (re) => (body.match(re) || [])[1];
    const num = (re) => (pick(re) !== undefined ? +pick(re) : null);
    out.push({
      id: cur.id, region,
      name: pick(/name:\s*'([^']*)'/) || cur.id,
      encounters: parseEntries(pick(/encounters:\s*\[([^\]]*)\]/) || ''),
      dayEncounters: parseEntries(pick(/dayEncounters:\s*\[([^\]]*)\]/) || ''),
      nightEncounters: parseEntries(pick(/nightEncounters:\s*\[([^\]]*)\]/) || ''),
      wildMinLvl: num(/wildMinLvl:\s*(\d+)/),
      wildMaxLvl: num(/wildMaxLvl:\s*(\d+)/),
      mechanic: pick(/mechanic:\s*\{([^}]*)\}/)?.replace(/\s+/g, ' ').trim() || null,
      noCatch: /noCatch:\s*true/.test(body),
      bossLvl: num(/bossLvl:\s*(\d+)/),
      requiresBadges: num(/requiresBadges:\s*(\d+)/),
      hasWater: /hasWater:\s*true/.test(body),
      hasHeal: /hasHeal:\s*true/.test(body),
      links: list(pick(/links:\s*\[([^\]]*)\]/)),
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

// ── ДРОПЫ ────────────────────────────────────────────────────────────────
function parseDrops() {
  const src = read('src/data/drops.js');
  const body = src.slice(src.indexOf('MONSTER_DROP_TABLE'));
  const out = {};
  for (const m of body.matchAll(/\n {2}([a-zA-Z0-9_\-]+):\s*\[(.*?)\]\s*,?(?=\n)/gs)) {
    const entries = [];
    for (const d of m[2].matchAll(/item:\s*'([^']+)'[^}]*?chance:\s*([\d.]+)[^}]*?qty:\s*(\d+)/gs)) {
      entries.push({ item: d[1], chance: +d[2], qty: +d[3] });
    }
    if (entries.length) out[m[1]] = entries;
  }
  return out;
}

// ── МАГАЗИНЫ + ЦЕНЫ ──────────────────────────────────────────────────────
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

function parseItems() {
  const src = read('src/data/items.ts');
  const out = {};
  for (const m of src.matchAll(/\{ id:\s*'([\w]+)',\s*nameRu:\s*'([^']*)'/g)) {
    const tail = src.slice(m.index, m.index + 700);
    const price = (tail.match(/price:\s*(\d+)/) || [])[1];
    if (price !== undefined) out[m[1]] = { name: m[2], price: +price };
  }
  return out;
}

function parseServerPrices() {
  const src = read('server/src/routes/economy.ts');
  const out = {};
  for (const m of src.matchAll(/\{\s*id:\s*'([\w]+)',\s*price:\s*(\d+)\s*\}/g)) out[m[1]] = +m[2];
  return out;
}

// ── ВЕС ПОЯВЛЕНИЯ (та же шкала, что в power.ts) ──────────────────────────
function weights(powerJson) {
  const w = (bst) => {
    if (!(bst > 0)) return 0.5;
    if (bst >= 640) return 0.08;
    if (bst >= 580) return 0.2;
    if (bst >= 520) return 0.4;
    if (bst >= 470) return 0.75;
    if (bst >= 400) return 1.3;
    if (bst >= 330) return 1.9;
    if (bst >= 260) return 2.4;
    return 2.8;
  };
  const out = {};
  for (const [s, b] of Object.entries(powerJson)) out[s] = w(b);
  return out;
}

// питания для базовой силы — грубо по public/pokemon_power.json
function powerJson() {
  try {
    return JSON.parse(read('public/pokemon_power.json'));
  } catch { return {}; }
}

// ── СБОРКА ───────────────────────────────────────────────────────────────
const baseline = {
  locations: parseRegions(),
  drops: parseDrops(),
  shops: parseShops(),
  items: parseItems(),
  serverPrices: parseServerPrices(),
};
const wmap = weights(powerJson());

const htmlPath = join(ROOT, 'public', 'editor.html');
let html = readFileSync(htmlPath, 'utf8');
const startM = '/*__BASELINE_START__*/';
const endM = '/*__BASELINE_END__*/';
const si = html.indexOf(startM);
const ei = html.indexOf(endM);
if (si < 0 || ei < 0 || ei <= si) { console.error('маркеры не найдены'); process.exit(1); }
html = html.slice(0, si + startM.length)
  + '\nconst BASELINE = ' + JSON.stringify({ ...baseline, weights: wmap }) + ';\n'
  + html.slice(ei);
writeFileSync(htmlPath, html, 'utf8');

console.log('public/editor.html обновлён:');
console.log('  локаций  :', baseline.locations.length);
console.log('  дропов   :', Object.keys(baseline.drops).length);
console.log('  маркетов :', Object.keys(baseline.shops).length);
console.log('  предметов:', Object.keys(baseline.items).length);
console.log('  страницу можно открыть с диска (file://)');
