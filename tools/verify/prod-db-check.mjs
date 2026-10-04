/**
 * Диагностика живой базы Render: подключается ли, есть ли таблицы, сколько игроков.
 * Переменные берутся из окружения, в репозиторий ничего не попадает.
 *
 * Запуск: DATABASE_URL=postgres://... node tools/verify/prod-db-check.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { REPO, SERVER_DIR } from './paths.mjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL не задан');
  process.exit(2);
}

const req = createRequire(path.join(SERVER_DIR, 'package.json'));
const { Client } = req('pg');

const host = (() => {
  try { return new URL(url.replace(/^postgres(ql)?:\/\//, 'http://')).host; } catch { return '?'; }
})();
console.log(`хост: ${host}`);

const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await c.connect();
  console.log('подключение: ОК');

  const v = await c.query('select version()');
  console.log(`версия: ${v.rows[0].version.split(',')[0]}`);

  const t = await c.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1",
  );
  console.log(`таблиц: ${t.rows.length} -> ${t.rows.map((r) => r.table_name).join(', ') || '(нет)'}`);

  if (t.rows.length) {
    for (const tbl of ['users', 'chat_messages', 'refresh_tokens', 'battle_ratings']) {
      if (!t.rows.some((r) => r.table_name === tbl)) continue;
      try {
        const n = await c.query(`select count(*)::int as n from ${tbl}`);
        console.log(`  ${tbl}: ${n.rows[0].n} строк`);
      } catch (e) {
        console.log(`  ${tbl}: ошибка ${e.message}`);
      }
    }
    const cols = await c.query(
      "select column_name from information_schema.columns where table_name='users' order by ordinal_position",
    );
    console.log(`users.columns: ${cols.rows.map((r) => r.column_name).join(', ')}`);
  }
} catch (e) {
  console.log(`ПОДКЛЮЧЕНИЕ ПРОВАЛИЛОСЬ: ${e.message}`);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => {});
}
