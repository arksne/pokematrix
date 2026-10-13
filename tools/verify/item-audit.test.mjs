/**
 * [17] Аудит предметов: каждая ссылка на предмет в игре обязана вести
 * на живой implemented-предмет из src/data/items.ts, цены сервера обязаны
 * совпадать, продажа обязана быть половиной покупки (иначе печатный станок),
 * у каждого предмета обязан быть источник (маркет/дроп/квест/крафт).
 *
 * Статический (без браузера): парсит TS/JS регулярками, как battle-mechanics.
 * Запускается из tools/verify/run.mjs. В финале обязан быть зелёным.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO } from './paths.mjs';
import { createSuite } from './support.mjs';

const suite = createSuite('Предметы');
const R = (p) => readFileSync(path.join(REPO, p), 'utf8');
// Пачки лесенки живут в отдельных файлах (см. шапку npc.ts) — аудит смотрит
// их тоже. Несуществующих файлов не боится (пак ещё не написан).
const npcSrc = () => ['src/data/npc.ts', 'src/data/npc-packs/kanto-1.ts', 'src/data/npc-packs/kanto-2.ts', 'src/data/npc-packs/johto-1.ts', 'src/data/npc-packs/johto-2.ts'].map((p) => { try { return R(p); } catch { return ''; } }).join('\n');

const itemsSrc = R('src/data/items.ts');
const ITEMS = new Map();
{
  const re = /\{ id: '([^']+)', nameRu: '([^']*)', category: '([^']*)', desc: '[\s\S]*?', sprite: '[^']*', spriteType: '[^']*', price: (\d+), sellPrice: (\d+), isUsable: (\w+), isBall: (\w+), implemented: (\w+)/g;
  let m;
  while ((m = re.exec(itemsSrc))) {
    ITEMS.set(m[1], { price: Number(m[4]), sell: Number(m[5]), impl: m[8] === 'true', cat: m[3] });
  }
}
suite.check('I0', `ITEMS распарсился (${ITEMS.size} шт)`, ITEMS.size > 300, `нашлось: ${ITEMS.size}`);

const live = (id) => { const it = ITEMS.get(id); return !!it && it.impl; };

// ── 1. Дропы ──
{
  const drops = R('src/data/drops.js');
  const ids = new Set([...drops.matchAll(/\{ item: '([^']+)'/g)].map((m) => m[1]));
  const dead = [...ids].filter((id) => !live(id));
  suite.check('I-drop', `дропы ведут на живые предметы (${ids.size})`, dead.length === 0, dead.length ? `мёртвые: ${dead.join(', ')}` : `всего: ${ids.size}`);
}

// ── 2. Марки ──
{
  const shops = R('src/data/shops.ts');
  const from = shops.indexOf('SHOP_STOCK_RAW');
  const to = shops.indexOf('SHOP_TIERS', shops.indexOf('TIER_BALLS'));
  const slice = shops.substring(from, to < 0 ? undefined : to);
  const ids = new Set([...slice.matchAll(/'([A-Za-z][A-Za-z0-9_-]*)'(?!:)/g)].map((m) => m[1]));
  const dead = [...ids].filter((id) => !live(id));
  suite.check('I-shop', `ассортимент ведёт на живые предметы (${ids.size})`, dead.length === 0, dead.length ? `мёртвые: ${dead.join(', ')}` : `всего: ${ids.size}`);
}

// ── 3. Квесты ──
{
  const npc = npcSrc();
  const rw = [...npc.matchAll(/rewardItem: '([^']+)'/g)].map((m) => m[1]);
  const tg = [...npc.matchAll(/targetItem: '([^']+)'/g)].map((m) => m[1]);
  const multi = [...npc.matchAll(/\{ id: '([^']+)', qty: \d+ \}/g)].map((m) => m[1]);
  const all = [...new Set([...rw, ...tg, ...multi])];
  const dead = all.filter((id) => !live(id));
  suite.check('I-quest', `награды/цели квестов — живые предметы (${all.length})`, dead.length === 0, dead.length ? `мёртвые: ${dead.join(', ')}` : `всего: ${all.length}`);
}

// ── 4. Серверный прайс ──
{
  const eco = R('server/src/routes/economy.ts');
  const rows = [...eco.matchAll(/\{ id: '([^']+)', price: (\d+) \}/g)].map((m) => [m[1], Number(m[2])]);
  const bad = rows.filter(([id, p]) => { const it = ITEMS.get(id); return !it || it.price !== p; });
  suite.check('I-server', `цены сервера совпадают с клиентом (${rows.length})`, bad.length === 0, bad.length ? `расходятся: ${bad.map(([id]) => id).join(', ')}` : `всего: ${rows.length}`);
}

// ── 5. Крафт ──
{
  const cr = R('src/ui/crafting.ts');
  const results = [...new Set([...cr.matchAll(/result: '([^']+)'/g)].map((m) => m[1]))];
  const deadRes = results.filter((id) => !live(id));
  suite.check('I-craft-res', `результаты крафта — живые предметы (${results.length})`, deadRes.length === 0, deadRes.length ? `мёртвые: ${deadRes.join(', ')}` : `всего: ${results.length}`);
  const ing = new Set();
  for (const m of cr.matchAll(/ingredients: \{([^}]+)\}/g)) {
    for (const k of m[1].matchAll(/'([^']+)'/g)) ing.add(k[1]);
  }
  const deadIng = [...ing].filter((id) => !live(id));
  suite.check('I-craft-ing', `ингредиенты крафта существуют (${ing.size})`, deadIng.length === 0, deadIng.length ? `нет в игре: ${deadIng.join(', ')}` : `всего: ${ing.size}`);
}

// ── 6. Деньги из воздуха ──
{
  const printers = [...ITEMS.entries()].filter(([, it]) => it.price > 0 && it.sell > it.price);
  suite.check('I-print', 'продажа нигде не дороже покупки', printers.length === 0, printers.length ? printers.map(([id]) => id).join(', ') : 'ок');
  const off = [...ITEMS.entries()].filter(([, it]) => it.price > 0 && it.sell !== Math.floor(it.price / 2));
  suite.check('I-half', 'продажа везде ровно половина покупки', off.length === 0, off.length ? off.map(([id]) => id).join(', ') : 'ок');
}

// ── 7. Покупаемое обязано продаваться сервером ──
{
  const eco = R('server/src/routes/economy.ts');
  const serverIds = new Set([...eco.matchAll(/\{ id: '([^']+)', price: (\d+) \}/g)].map((m) => m[1]));
  const noServer = [...ITEMS.entries()]
    .filter(([id, it]) => it.impl && it.price > 0 && !serverIds.has(id))
    .map(([id]) => id);
  suite.check('I-buyable', `покупаемое есть в серверных ценах`, noServer.length === 0, noServer.length ? `не купить: ${noServer.slice(0, 15).join(', ')}${noServer.length > 15 ? ` +${noServer.length - 15}` : ''}` : 'ок');
}

// ── 8. У бесплатного обязан быть источник ──
{
  const drops = R('src/data/drops.js');
  const dropIds = new Set([...drops.matchAll(/\{ item: '([^']+)'/g)].map((m) => m[1]));
  const npc = npcSrc();
  // Источник — не только награда: квестовые грузы (targetItem доставок,
  // giveItem на взятии, takeItem обменов) выдаются кнопками NPC, в дропе/крафте их нет.
  // Считать источником любой предмет, упомянутый квестом как цель, выдача или обмен.
  const questIds = new Set([...npc.matchAll(/(?:rewardItem|targetItem|giveItem|takeItem): '([^']+)'/g)].map((m) => m[1]));
  const cr = R('src/ui/crafting.ts');
  const craftIds = new Set([...cr.matchAll(/result: '([^']+)'/g)].map((m) => m[1]));
  // Коробка типовых конфет: содержимое падает из typeCandyBox (только так,
  // в маркете синглов нет). Ключи TYPE_CANDY_TYPE = валидный источник.
  const inv = R('src/ui/inventory.ts');
  const boxIds = new Set();
  const tcm = inv.match(/TYPE_CANDY_TYPE[^=]*=\s*\{([\s\S]*?)\};/);
  if (tcm) for (const k of tcm[1].matchAll(/(\w+Candy):/g)) boxIds.add(k[1]);
  const sourceless = [...ITEMS.entries()]
    .filter(([id, it]) => it.impl && it.price === 0 && id !== 'credit' && !dropIds.has(id) && !questIds.has(id) && !craftIds.has(id) && !boxIds.has(id))
    .map(([id]) => id);
  suite.check('I-source', 'бесплатное добывается (дроп/квест/крафт)', sourceless.length === 0, sourceless.length ? `взять негде: ${sourceless.slice(0, 15).join(', ')}${sourceless.length > 15 ? ` +${sourceless.length - 15}` : ''}` : 'ок');
}

// ── 8b. Титулы наград — из data/titles.ts ──
{
  const tt = R('src/data/titles.ts');
  const titleIds = new Set([...tt.matchAll(/id: '([A-Za-z0-9_-]+)'/g)].map((m) => m[1]));
  const npc = npcSrc();
  const used = [...new Set([...npc.matchAll(/rewardTitle: '([^']+)'/g)].map((m) => m[1]))];
  const dead = used.filter((id) => !titleIds.has(id));
  suite.check('I-title', `титулы наград существуют (${used.length})`, dead.length === 0, dead.length ? `мёртвые: ${dead.join(', ')}` : `всего: ${used.length}`);
}

// ── 9. Тень: убранное не просачивается обратно ──
{
  const sh = R('src/data/shadow-items.ts');
  const m = sh.match(/SHADOW_IDS: string\[\] = \[([\s\S]*?)\];/);
  const shadow = m ? [...m[1].matchAll(/'([A-Za-z0-9_-]+)'/g)].map((x) => x[1]) : [];
  const leaks = [];
  const shops = R('src/data/shops.ts');
  const drops = R('src/data/drops.js');
  const eco = R('server/src/routes/economy.ts');
  for (const id of shadow) {
    const q = `'${id}'`;
    if (ITEMS.has(id)) leaks.push(`${id}: в ITEMS`);
    else if (new RegExp(`${q}(?!\\w)`).test(shops)) leaks.push(`${id}: в маркетах`);
    else if (drops.includes(q)) leaks.push(`${id}: в дропах`);
    else if (eco.includes(q)) leaks.push(`${id}: в ценах сервера`);
  }
  suite.check('I-shadow', `тень не течёт в игру (${shadow.length})`, leaks.length === 0, leaks.length ? leaks.join(', ') : `теней: ${shadow.length}`);
}

suite.finish();
const failed = suite.results.filter((r) => !r.pass);
if (failed.length) {
  console.log('');
  console.log('  ПРОВАЛЕНО по предметам (нет в игре / чинить):');
  for (const f of failed) console.log(`    ${f.id}: ${f.name} — ${f.detail}`);
  process.exit(1);
}
