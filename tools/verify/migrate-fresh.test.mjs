/**
 * Проверка миграций на пустой базе + дрейф схемы.
 *
 * Зачем: в продакшене база появится заново (старая Render PostgreSQL удалена),
 * поэтому все миграцииapplied к пустой базе впервые. Если порядок или набор
 * колонок расходится с schema.ts, это обнаружится только в проде, на первой же
 * записи. Здесь мы воспроизводим ровно этот сценарий локально.
 *
 * Что делает:
 *   1. Поднимает пустой PGlite (fresh).
 *   2. Применяет SQL-файлы в порядке meta/_journal.json, режя по
 *      --> statement-breakpoint — так же, как это делает drizzle-мигратор.
 *   3. Сверяет фактические таблицы и колонки с объявленными в schema.ts.
 *
 * Запуск: node tools/verify/migrate-fresh.test.mjs
 */
import { startPg } from './pg.mjs';
import { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS_DIR, SCHEMA_FILE, STATE_DIR } from './paths.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Собственное хранилище и порт. Общие с основной проверкой использовать нельзя:
 * миграции, применённые напрямую SQL, не оставляют записей в
 * __drizzle_migrations, и drizzle затем пытается применить их повторно.
 */
const MIG_DATA_DIR = path.join(STATE_DIR, 'pgdata-migrations');
const MIG_PORT = 5434;

let pass = 0;
const problems = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    problems.push(name);
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
  }
}

/** Таблицы и колонки, объявленные в schema.ts. */
function parseSchema() {
  const src = readFileSync(SCHEMA_FILE, 'utf8');
  const tables = new Map();
  const tableRe = /pgTable\(\s*'(\w+)'\s*,\s*\{/g;
  let m;
  while ((m = tableRe.exec(src))) {
    const name = m[1];
    // Тело объекта — до закрывающей скобки, с учётом вложенности.
    // Иначе колонки собираются сразу из всех таблиц файла.
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
    }
    const body = src.slice(m.index + m[0].length, i - 1);
    const cols = new Set();
    // Колонка: key: type('db_name' [, opts])
    const colRe = /\b(\w+)\s*:\s*\w+\(\s*'(\w+)'/g;
    let c;
    while ((c = colRe.exec(body))) cols.add(c[2]);
    tables.set(name, cols);
  }
  return tables;
}

/** Порядок миграций из журнала drizzle. */
function journalOrder() {
  const j = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'));
  return [...j.entries].sort((a, b) => a.idx - b.idx).map((e) => e.tag);
}

const pg = await startPg({ fresh: true, dataDir: MIG_DATA_DIR, port: MIG_PORT });
try {
  console.log('\n=== 1. Порядок миграций ===');
  const order = journalOrder();
  for (const t of order) console.log(`  ${t}`);

  const files = order.map((tag) => {
    const p = path.join(MIGRATIONS_DIR, `${tag}.sql`);
    if (!readFileSync(p, 'utf8').length) throw new Error(`пустая миграция: ${tag}`);
    return p;
  });
  check('все миграции журнала существуют на диске', files.length === order.length, `${order.length} шт.`);
  check(
    'каждая запись журнала имеет .sql',
    order.every((t) => readFileSync(path.join(MIGRATIONS_DIR, `${t}.sql`), 'utf8').length > 0),
  );

  console.log('\n=== 2. Применение к пустой базе (fresh) ===');
  for (let i = 0; i < files.length; i++) {
    const sql = readFileSync(files[i], 'utf8');
    const stmts = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const st of stmts) await pg.db.exec(st);
    console.log(`  применена ${order[i]} (${stmts.length} stmt)`);
  }
  check('все миграции применились без ошибок', problems.length === 0);

  console.log('\n=== 3. Порядок корректен (FK-зависимости) ===');
  // Прямой порядок уже доказан тем, что применение прошло без ошибок: 0001
  // добавляет внешний ключ на users, поэтому до 0000 он был бы невалиден.
  // Проверяем обратное: если бы порядок действительно не имел значения,
  // применение в обратном порядке тоже прошло бы успешно.
  const reverse = await PGlite.create();
  let reverseFailed = false;
  let reverseErr = '';
  try {
    for (const t of [...order].reverse()) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, `${t}.sql`), 'utf8');
      for (const st of sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)) {
        await reverse.exec(st);
      }
    }
  } catch (e) {
    reverseFailed = true;
    reverseErr = e.message.split('\n')[0].slice(0, 90);
  } finally {
    await reverse.close();
  }
  check(
    'обратный порядок действительно ломается (порядок значим)',
    reverseFailed,
    reverseFailed ? reverseErr : 'применился без ошибок — порядок не проверяем',
  );

  console.log('\n=== 4. Дрейф схемы: schema.ts против БД ===');
  const tabs = (
    await pg.db.query(
      `select table_name from information_schema.tables where table_schema='public' order by 1`,
    )
  ).rows.map((r) => r.table_name);
  const expected = parseSchema();
  console.log(`  таблиц в schema.ts: ${expected.size}, в БД: ${tabs.length}`);
  check('каждая таблица schema.ts создана миграциями', expected.size === tabs.length,
    `schema.ts: ${[...expected.keys()].join(',')} | БД: ${tabs.join(',')}`);

  for (const [table, cols] of expected) {
    if (!tabs.includes(table)) {
      check(`таблица ${table} создана миграциями`, false, 'ОТСУТСТВУЕТ В БД');
      continue;
    }
    const actual = new Set(
      (
        await pg.db.query(
          `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
          [table],
        )
      ).rows.map((r) => r.column_name),
    );
    const missing = [...cols].filter((c) => !actual.has(c));
    check(`${table}: все ${cols.size} колонок на месте`, missing.length === 0, missing.length ? `нет: ${missing.join(', ')}` : '');
  }

  console.log('\n=== 5. Ключевые колонки, на которые опираются исправления ===');
  const ucols = (
    await pg.db.query(
      `select column_name from information_schema.columns where table_name='users' and table_schema='public'`,
    )
  ).rows.map((r) => r.column_name);
  check('users.last_reward_at есть (кулдаун награды, миграция 0003)', ucols.includes('last_reward_at'));
  check('users.save_version есть (миграция облачных сохранений)', ucols.includes('save_version'));

  const br = tabs.includes('battle_ratings')
    ? (
        await pg.db.query(
          `select count(*)::int n from information_schema.table_constraints
           where table_name='battle_ratings' and constraint_type='FOREIGN KEY'`,
        )
      ).rows[0].n
    : 0;
  check('battle_ratings имеет FK на users', br > 0, `fk=${br}`);
} catch (e) {
  check('миграции применяются к пустой базе', false, e.message);
} finally {
  await pg.stop();
}

console.log(`\n${'='.repeat(58)}`);
if (problems.length === 0) {
  console.log(`МИГРАЦИИ С НУЛЯ: OK — ${pass} проверок пройдено`);
  console.log('Пустая база (Neon) применится корректно.');
  process.exit(0);
} else {
  console.log(`МИГРАЦИИ С НУЛЯ: ПРОБЛЕМЫ (${problems.length}) — пройдено ${pass}`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
