/**
 * Статический аудит клиентской части: обрыв в графе импортов.
 *
 * Тот же класс поломки, что и с openTradeCenter, и с картой, но в масштабе всего
 * клиента: если модуль импортирует имя, которого нет в экспортах целевого
 * файла, в бандле это `undefined`, и вызов падает в момент клика — без ошибки на
 * этапе сборки (ESM-импорт имени, которого нет, даёт undefined, а не throw),
 * и часто без записи в консоль, если промис не awaited.
 *
 * Пример из этого же репозитория: ui/location.ts вызывал
 * `getMainModule().then(mm => mm.openTradeCenter())`, а main.ts не экспортирует
 * ничего. Кнопка обмена не работала вообще, и ни один тест этого не ловил.
 *
 * Проверяем все именованные импорты в src/ и main.ts против реальных экспортов
 * целевых модулей.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createSuite } from './support.mjs';
import { REPO } from './paths.mjs';

const suite = createSuite('Клиент: аудит графа импортов');

const SRC = path.join(REPO, 'src');

/** Все .ts под каталогом, рекурсивно. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const files = [...walk(SRC), path.join(REPO, 'main.ts')];

/**
 * Имена, экспортируемые файлом: export function/const/class/let,
 * export { a, b }, export * from.
 */
function exportsOf(file) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();

  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
  )) {
    names.add(m[1]);
  }
  // export const a = ..., b = ...  (несколько в одной строке через запятую)
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([^=;]+)=/g)) {
    for (const part of m[1].split(',')) {
      const id = part.trim().split(/[:=]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(id)) names.add(id);
    }
  }
  // export { a, b as c }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits[1] || bits[0] || '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  if (/export\s+default/.test(src)) names.add('default');

  return names;
}

/** Куда указывает относительный импорт, и существует ли файл. */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // пакетный импорт — не наша зона

  // Исходники используют .js-расширения в .ts-импортах (так пишет сборщик), то
  // есть '../utils/dom.js' означает файл dom.ts. Сначала пробуем спецификацию как
  // есть, потом заменяем расширение — иначе каждый относительный импорт в проекте
  // выглядит битым.
  const base = path.resolve(path.dirname(fromFile), spec);
  const asTs = base.replace(/\.js$/, '.ts');
  const candidates = spec.endsWith('.js')
    // index.d.ts — объявления типов, они не эмитятся в рантайм, но импортируются
    // как '../types/index.js', поэтому их тоже нужно считать существующими.
    ? [base, asTs, `${asTs.replace(/\.ts$/, '')}.d.ts`, path.join(asTs.replace(/\.ts$/, ''), 'index.ts')]
    : [base, `${base}.ts`, path.join(base, 'index.ts')];

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch { /* пробуем дальше */ }
  }
  return undefined; // относительный, но файла нет
}

const cache = new Map();
const exportsOfCached = (file) => {
  if (!cache.has(file)) cache.set(file, exportsOf(file));
  return cache.get(file);
};

let checked = 0;
const broken = [];
const missingFiles = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = path.relative(REPO, file).replace(/\\/g, '/');

  for (const m of src.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  )) {
    const spec = m[2];
    const target = resolveImport(file, spec);
    if (target === null) continue;        // пакетный импорт
    if (target === undefined) {            // относительный, файла нет
      missingFiles.push(`${rel} -> ${spec}`);
      continue;
    }

    const available = exportsOfCached(target);
    const targetRel = path.relative(REPO, target).replace(/\\/g, '/');

    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const original = (bits[0] || '').trim();
      if (!original) continue;
      // `import type` — стирается компилятором, но пропускаем явно
      if (/^type\s+/.test(part.trim())) continue;
      checked++;
      if (!available.has(original)) {
        broken.push(`${rel}: '${original}' отсутствует в ${targetRel}`);
      }
    }
  }
}

suite.check(
  'I1',
  'все именованные импорты разрешаются в реальные экспорты',
  broken.length === 0,
  broken.length ? `сломано импортов: ${broken.length}` : `проверено импортов: ${checked}`,
);
for (const b of broken.slice(0, 20)) console.log(`      - ${b}`);

suite.check(
  'I2',
  'все относительные импорты указывают на существующие файлы',
  missingFiles.length === 0,
  missingFiles.length ? `нет файлов: ${missingFiles.length}` : 'все найдены',
);
for (const b of missingFiles.slice(0, 20)) console.log(`      - ${b}`);

suite.finish();

const failed = suite.results.filter((r) => !r.pass);
if (failed.length) process.exit(1);