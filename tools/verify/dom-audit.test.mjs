/**
 * Аудит DOM-контракта: каждая кнопка в разметке вешается и кликабельна.
 *
 * Класс поломки, который уже дважды стоил игре функции: обработчик вешается на
 * элемент, которого нет в index.html, либо вешается на id, которого нет в коде.
 * getElementById вернёт null, и addEventListener на нём упадёт — либо тихо
 * ничего не сделает, если обращение идёт через ?.addEventListener.
 *
 * Конкретные случаи из этого репозитория:
 *   - `btn-trainer-trade` в trainer-profile.ts: обработчик навешивался, когда
 *     игрок онлайн, но если карточка не открыта — падение.
 *   - Кнопки боя (`btn-run`, `btn-switch`, `btn-use-item`) вешаются в core.ts
 *     каждый раз при входе в бой: если разметка переименуется, бой перестаёт
 *     запускаться целиком, и это видно только в бою.
 *
 * Здесь проверяем две вещи, которые можно проверить статически:
 *   1. Каждый id, к которому код обращается через getElementById, есть в разметке
 *      (или создаётся кодом — такие помечены).
 *   2. Каждая кнопка боя из разметки имеет обработчик в коде.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createSuite } from './support.mjs';
import { REPO } from './paths.mjs';

const suite = createSuite('Клиент: аудит DOM-контракта');

const SRC = path.join(REPO, 'src');
const HTML = readFileSync(path.join(REPO, 'index.html'), 'utf8');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const allCode = files.map((f) => readFileSync(f, 'utf8')).join('\n');

// ── id, присутствующие в статической разметке ──────────────────────────
// Учитываем и одинарные кавычки: в шаблонах модалок атрибуты часто так записаны.
const htmlIds = new Set();
for (const m of HTML.matchAll(/\bid="([^"]+)"/g)) htmlIds.add(m[1]);
for (const m of HTML.matchAll(/\bid='([^']+)'/g)) htmlIds.add(m[1]);

// ── id, которые код создаёт сам (динамические модалки и панели) ─────────
// Без этого списка любая динамически созданная модалка выглядела бы битой.
const dynamicIds = new Set();
for (const m of allCode.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)) dynamicIds.add(m[1]);
for (const m of allCode.matchAll(/createElement\(['"][^'"]+['"]\);\s*\n?\s*\w+\.id\s*=/g)) {
  // уже поймано выше
}
for (const m of allCode.matchAll(/id="\$\{[^}]+\}"/g)) dynamicIds.add('(template)');
// id, собираемые шаблонной строкой
for (const m of allCode.matchAll(/`[^`]*\$\{[^}]+\}[^`]*`/g)) {
  // слишком широко; вместо этого помечаем все id, встречающиеся в innerHTML
}

// ── id, присутствующие в innerHTML-коде (создаются через innerHTML) ─────
const innerHtmlIds = new Set();
for (const m of allCode.matchAll(/id="([a-z][\w-]*)"/gi)) innerHtmlIds.add(m[1]);

/**
 * Убирает комментарии из исходника.
 *
 * Без этого аудит находит id в тексте комментария: после исправления блока
 * `if (infoView)` в init.ts осталось упоминание `getElementById('view-info')`
 * в объяснении, почему блок был мёртвым, и тест ругался на собственную
 * документацию.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ── Все id, к которым обращается код ───────────────────────────────────
const referenced = new Map(); // id -> [файлы]
for (const file of files) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const rel = path.relative(REPO, file).replace(/\\/g, '/');
  for (const m of src.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const id = m[1];
    if (!referenced.has(id)) referenced.set(id, []);
    referenced.get(id).push(rel);
  }
}

// ── id, которых нет нигде ─────────────────────────────────────────────
const orphans = [];
for (const [id, where] of referenced) {
  const known = htmlIds.has(id) || dynamicIds.has(id) || innerHtmlIds.has(id);
  if (!known) orphans.push(`${id}  (${[...new Set(where)].slice(0, 2).join(', ')})`);
}

suite.check(
  'D1',
  'каждый id из getElementById существует в разметке или создаётся кодом',
  orphans.length === 0,
  orphans.length ? `не найдено id: ${orphans.length}` : `проверено id: ${referenced.size}`,
);
for (const o of orphans.slice(0, 25)) console.log(`      - ${o}`);

// ── Кнопки боя: разметка против кода ────────────────────────────────────
// Часть боевых экранов (PvP) собирается динамически через innerHTML, поэтому
// «есть в index.html» здесь не обязательно — важно, чтобы кнопка существовала
// там, где вешается обработчик, и чтобы обработчик был.
const core = readFileSync(path.join(SRC, 'battle', 'core.ts'), 'utf8');
const pvp = readFileSync(path.join(SRC, 'battle', 'pvp-core.ts'), 'utf8');

const inDynamicMarkup = (id) =>
  [core, pvp].some((src) => new RegExp(`id="${id}"`).test(src));

const BATTLE_BUTTONS = [
  'btn-run',
  'btn-switch',
  'btn-use-item',
  'btn-leave-battle',
  'btn-start-gym-battle',
  'btn-close-gym-modal',
  'btn-close-elite-modal',
  'btn-start-elite-battle',
  'btn-pvp-leave',
];

for (const id of BATTLE_BUTTONS) {
  const inHtml = htmlIds.has(id);
  const markupExists = inHtml || inDynamicMarkup(id);
  const inCode = core.includes(`'${id}'`) || pvp.includes(`'${id}'`);
  // Кнопка должна существовать и иметь обработчик: иначе она либо невидима,
  // либо не нажимается.
  suite.check(
    `B-${id}`,
    `кнопка боя ${id}: разметка есть и обработчик вешается`,
    markupExists && inCode,
    `разметка: ${markupExists}${inHtml ? ' (index.html)' : ' (создаётся кодом)'}, обработчик: ${inCode}`,
  );
}

// ── Кнопки нижней навигации: каждая вкладка должна быть в titles ────────
const nav = readFileSync(path.join(SRC, 'ui', 'nav.ts'), 'utf8');
for (const m of HTML.matchAll(/class="nav-item[^"]*"\s+data-target="(view-[\w-]+)"/g)) {
  const target = m[1];
  const inTitles = new RegExp(`'${target}'\\s*:`).test(nav);
  const viewExists = htmlIds.has(target);
  suite.check(
    `N-${target}`,
    `вкладка ${target}: экран есть и заголовок прописан`,
    viewExists && inTitles,
    `экран: ${viewExists}, заголовок в titles: ${inTitles}`,
  );
}

suite.finish();

const failed = suite.results.filter((r) => !r.pass);
if (failed.length) process.exit(1);