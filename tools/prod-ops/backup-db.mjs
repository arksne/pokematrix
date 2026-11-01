/**
 * Резервная копия БОЕВОЙ базы PokeMatrix (Neon) в локальные файлы.
 *
 * Зачем: Neon Free — ветка одна, история 6 часов, а в базе лежат живые игроки.
 * Один неудачный DELETE/миграция — и сохранения людей теряются навсегда.
 * Скрипт снимает полный слепок данных в обычные JSON-файлы, которые можно
 * открыть глазами и из которых можно восстановить строки.
 *
 * Что копируется: users (вместе с save_data), save_history, arena_stats,
 * battle_ratings, chat_messages, server_features, drop_config.
 * Что НЕ копируется: pokemon_cache (это регенерируемый кэш PokeAPI, 84 МБ
 * «логически») и refresh_tokens (сессионные токены; копируются в отдельный
 * файл с пометкой «секретно», чтобы можно было восстановить при желании).
 *
 * Запуск:
 *   $env:DATABASE_URL='postgresql://...'
 *   node tools/prod-ops/backup-db.mjs                       # в Documents\pokematrix-backups
 *   node tools/prod-ops/backup-db.mjs --out=D:\backups\pm   # в свою папку
 *
 * Выход: папка <out>\<UTC-таймстемп>\ с файлами:
 *   manifest.json        — счётчики строк, размеры, sha256 по каждому файлу
 *   users.json           — все пользователи с полными save_data
 *   djafar.json          — слепок конкретного игрока (по умолчанию Джафар)
 *   <таблица>.jsonl      — остальные таблицы, по строке на запись
 */
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..');
const require_ = createRequire(path.join(REPO, 'server', 'package.json'));

const URL = process.env.DATABASE_URL || '';
const argvOut = process.argv.find((a) => a.startsWith('--out='));
const OUT_ROOT = argvOut
  ? argvOut.slice('--out='.length)
  : path.join(os.homedir(), 'Documents', 'pokematrix-backups');
// Игрок, чей слепок нужно держать отдельным файлом «на виду» (по умолчанию Джафар).
const FOCUS_TG_ID = Number(process.env.BACKUP_FOCUS_TG_ID || 1631771412);
const FOCUS_LABEL = (process.env.BACKUP_FOCUS_LABEL || 'djafar').replace(/[^\w.-]+/g, '_');

if (!URL) {
  console.error('Нужен DATABASE_URL (строка подключения Neon)');
  process.exit(2);
}

const { Client } = require_('pg');

/** Таблицы, которые копируем полностью (без кэша). */
const TABLES = [
  'users',
  'save_history',
  'arena_stats',
  'battle_ratings',
  'chat_messages',
  'server_features',
  'drop_config',
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
const outDir = path.join(OUT_ROOT, stamp);

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const client = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const manifest = {
    createdAt: new Date().toISOString(),
    outDir,
    focusTgId: FOCUS_TG_ID,
    tables: {},
    skipped: {
      pokemon_cache: 'регенерируемый кэш PokeAPI (не данные игроков)',
      refresh_tokens: 'сессионные токены — в отдельном файле',
    },
    errors: [],
  };

  try {
    for (const table of TABLES) {
      const { rows } = await client.query(`SELECT * FROM ${table}`);
      let payload;
      if (table === 'users') {
        // Пользователей пишем одним красивым JSON-массивом: удобно открыть,
        // найти игрока по tg_id и восстановить конкретную строку.
        payload = Buffer.from(JSON.stringify(rows, null, 1), 'utf8');
        writeFileSync(path.join(outDir, 'users.json'), payload);
      } else {
        payload = Buffer.from(rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
        writeFileSync(path.join(outDir, `${table}.jsonl`), payload);
      }
      manifest.tables[table] = {
        rows: rows.length,
        bytes: payload.length,
        sha256: sha256(payload),
        file: table === 'users' ? 'users.json' : `${table}.jsonl`,
      };
      console.log(`  ${table}: ${rows.length} строк, ${(payload.length / 1024).toFixed(1)} КБ`);
    }

    // ── Слепок конкретного игрока на виду ──
    const { rows: focusRows } = await client.query('SELECT * FROM users WHERE tg_id = $1', [FOCUS_TG_ID]);
    if (focusRows.length === 0) {
      const msg = `игрок ${FOCUS_TG_ID} не найден`;
      manifest.errors.push(msg);
      console.warn(`  ! ${msg}`);
    } else {
      const user = focusRows[0];
      let save = null;
      try {
        save = JSON.parse(user.save_data);
      } catch (e) {
        manifest.errors.push(`save_data игрока ${FOCUS_TG_ID} не парсится: ${e.message}`);
      }
      const focus = {
        backedUpAt: new Date().toISOString(),
        source: 'Neon production branch',
        tg_id: user.tg_id,
        nickname: user.nickname,
        first_name: user.first_name,
        username: user.username,
        save_version: user.save_version,
        registered: user.registered,
        created_at: user.created_at,
        summary: save
          ? {
              team: Array.isArray(save.myTeam) ? save.myTeam.length : null,
              pc: Array.isArray(save.pcBoxes) ? save.pcBoxes.reduce((n, box) => n + (Array.isArray(box) ? box.length : 0), 0) : null,
              badges: Array.isArray(save.badges) ? save.badges.length : null,
              credit: save.inventory?.credit ?? null,
              locationId: save.currentLocationId ?? null,
              trainerNickname: save.trainerNickname ?? null,
            }
          : null,
        user_row: user,
        save_data_parsed: save,
      };
      const buf = Buffer.from(JSON.stringify(focus, null, 1), 'utf8');
      const focusFile = path.join(outDir, `${FOCUS_LABEL}.json`);
      writeFileSync(focusFile, buf);
      // Дубликат в корень backup-папки: чтобы «тот самый файл» было легко найти.
      writeFileSync(path.join(OUT_ROOT, `${FOCUS_LABEL}-latest.json`), buf);
      manifest.focus = {
        tgId: FOCUS_TG_ID,
        file: `${FOCUS_LABEL}.json`,
        copy: path.join(OUT_ROOT, `${FOCUS_LABEL}-latest.json`),
        bytes: buf.length,
        sha256: sha256(buf),
        summary: focus.summary,
      };
      console.log(`  ${FOCUS_LABEL}: tg_id=${user.tg_id} nick=${user.nickname} sv=${user.save_version} `
        + `team=${focus.summary?.team} pc=${focus.summary?.pc} badges=${focus.summary?.badges} ` + `кредиты=${focus.summary?.credit}`);
    }

    // ── Токены сессии: нужны только для полного восстановления, помечаем как секрет ──
    try {
      const { rows } = await client.query('SELECT * FROM refresh_tokens');
      const buf = Buffer.from(rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
      writeFileSync(path.join(outDir, 'refresh_tokens.SECRET.jsonl'), buf);
      manifest.tables.refresh_tokens = { rows: rows.length, bytes: buf.length, sha256: sha256(buf), file: 'refresh_tokens.SECRET.jsonl', sensitive: true };
      console.log(`  refresh_tokens: ${rows.length} строк (файл помечен SECRET)`);
    } catch (e) {
      manifest.errors.push(`refresh_tokens: ${e.message}`);
    }

    // ── Контрольные суммы и размеры всей папки ──
    const files = Object.values(manifest.tables).map((t) => t.file).concat(manifest.focus ? [manifest.focus.file] : []);
    manifest.files = files.map((f) => ({ file: f, bytes: statSync(path.join(outDir, f)).size }));
    manifest.totalBytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
    writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1), 'utf8');
    console.log(`\nГотово: ${outDir}`);
    console.log(`Всего файлов: ${manifest.files.length}, ${(manifest.totalBytes / 1024 / 1024).toFixed(2)} МБ`);
    if (manifest.focus) console.log(`Копия слепка игрока: ${manifest.focus.copy}`);
    if (manifest.errors.length) {
      console.warn('Предупреждения:', manifest.errors);
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Бэкап упал:', e?.message || e);
  process.exit(1);
});
