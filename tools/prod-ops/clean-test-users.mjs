/**
 * Уборка тестовых тренеров из БОЕВОЙ базы.
 *
 * Зачем: tools/prod-check, browser-check и ui-tour логинятся под синтетическими
 * tg_id (7779001xx, 7779003xx, 7779031x…), и эти аккаунты живут в той же базе,
 * что и живые игроки — они видны в «Тренерах» и в таблице лидеров, занимают
 * места и путают владельца («кто такой pc_intruder?»). Настоящие игроки —
 * все, у кого tg_id НЕ в тестовом диапазоне.
 *
 * Скрипт ничего не делает без --apply (по умолчанию dry-run: показывает, кого
 * удалит). Диапазон задаётся TEST_TG_FROM / TEST_TG_TO (по умолчанию
 * 777900000..777999999), подключение — DATABASE_URL.
 *
 * Использование:
 *   $env:DATABASE_URL='postgresql://...'; node tools/prod-ops/clean-test-users.mjs
 *   $env:DATABASE_URL='postgresql://...'; node tools/prod-ops/clean-test-users.mjs --apply
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..');
const require_ = createRequire(path.join(REPO, 'server', 'package.json'));

const FROM = Number(process.env.TEST_TG_FROM || 777900000);
const TO = Number(process.env.TEST_TG_TO || 777999999);
const APPLY = process.argv.includes('--apply');
const URL = process.env.DATABASE_URL || '';

if (!URL) {
  console.error('Нужен DATABASE_URL (строка подключения Neon)');
  process.exit(2);
}
if (!Number.isFinite(FROM) || !Number.isFinite(TO) || FROM > TO) {
  console.error(`Плохой диапазон: ${FROM}..${TO}`);
  process.exit(2);
}

// Страховка: не даём случайно удалить «настоящий» диапазон Telegram id.
// Реальные аккаунты Telegram начинаются с маленьких чисел (1..9_999_999_999),
// а тестовые мы специально держим в 7779xxxxx; запрещаем диапазоны, которые
// начинаются ниже 700000000 и не совпадают с нашим тестовым префиксом.
if (FROM < 700_000_000 || !String(FROM).startsWith('7779')) {
  console.error(`Отказ: диапазон ${FROM}..${TO} не похож на тестовый (ожидается 7779xxxxxx)`);
  process.exit(2);
}

const { Client } = require_('pg');

async function main() {
  const client = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows: users } = await client.query(
      `SELECT id, tg_id, nickname, first_name, username, created_at
         FROM users WHERE tg_id BETWEEN $1 AND $2 ORDER BY tg_id`,
      [FROM, TO]
    );
    const { rows: realPlayers } = await client.query(
      'SELECT count(*)::int AS n FROM users WHERE tg_id NOT BETWEEN $1 AND $2',
      [FROM, TO]
    );
    const { rows: realEntries } = await client.query(
      'SELECT count(*)::int AS n FROM users WHERE registered = 1 AND tg_id NOT BETWEEN $1 AND $2',
      [FROM, TO]
    );

    console.log(`Диапазон тестовых tg_id: ${FROM}..${TO}`);
    console.log(`Настоящих игроков в базе: ${realPlayers[0].n} (в лидерборде: ${realEntries[0].n})`);
    console.log(`Тестовых аккаунтов найдено: ${users.length}`);
    for (const u of users) {
      // created_at приходит то Date, то строкой (зависит от типа колонки и парсера).
      const created = u.created_at instanceof Date
        ? u.created_at.toISOString().slice(0, 10)
        : String(u.created_at || '').slice(0, 10);
      console.log(`  ${u.tg_id}  ${u.nickname || '—'}  @${u.username || '—'}  с ${created}`);
    }

    if (!users.length) {
      console.log('\nНечего чистить.');
      return;
    }
    const ids = users.map((u) => u.id);

    // Считаем, что уйдёт вместе с аккаунтами (для отчёта).
    const { rows: related } = await client.query(
      `SELECT
         (SELECT count(*)::int FROM refresh_tokens WHERE user_id = ANY($1)) AS refresh_tokens,
         (SELECT count(*)::int FROM save_history   WHERE user_id = ANY($1)) AS save_history,
         (SELECT count(*)::int FROM arena_stats    WHERE user_id = ANY($1)) AS arena_stats,
         (SELECT count(*)::int FROM battle_ratings WHERE user_id = ANY($1)) AS battle_ratings,
         (SELECT count(*)::int FROM chat_messages  WHERE user_id = ANY($1)) AS chat_messages`,
      [ids]
    );
    console.log('\nВместе с ними удалится:', JSON.stringify(related[0]));

    if (!APPLY) {
      console.log('\nDRY-RUN. Ничего не изменено. Для удаления запусти с --apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      // Порядок — под внешние ключи (FK у этих таблиц на users.id).
      const del = async (sql) => (await client.query(sql, [ids])).rowCount;
      const nChat = await del('DELETE FROM chat_messages  WHERE user_id = ANY($1)');
      const nRefresh = await del('DELETE FROM refresh_tokens WHERE user_id = ANY($1)');
      const nHistory = await del('DELETE FROM save_history   WHERE user_id = ANY($1)');
      const nArena = await del('DELETE FROM arena_stats    WHERE user_id = ANY($1)');
      const nRatings = await del('DELETE FROM battle_ratings WHERE user_id = ANY($1)');
      const nUsers = await del('DELETE FROM users          WHERE id = ANY($1)');
      await client.query('COMMIT');
      console.log(`\nУдалено: users=${nUsers}, refresh_tokens=${nRefresh}, save_history=${nHistory}, `
        + `arena_stats=${nArena}, battle_ratings=${nRatings}, chat_messages=${nChat}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Уборка упала:', e?.message || e);
  process.exit(1);
});
