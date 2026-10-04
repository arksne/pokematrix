/**
 * Сброс прогресса всех пользователей (без удаления аккаунтов).
 *
 * ⚠️ ОПАСНАЯ ОПЕРАЦИЯ. Скрипт безусловно обнуляет save_data всех игроков,
 *    поэтому защищён тремя предохранителями:
 *      1. требует явный флаг --yes (без него скрипт только показывает план);
 *      2. требует WIPE_CONFIRM=<строка> в окружении — защита от случайного запуска;
 *      3. по умолчанию делает дамп save_data в файл перед изменением.
 *
 * Запуск:
 *   npm --prefix server run db:wipe            # план, ничего не меняет
 *   npm --prefix server run db:wipe -- --yes   # выполнить (потребует WIPE_CONFIRM)
 *
 * Перенос всех данных конкретного пользователя делается через save_data вручную;
 * для точечных операций используйте admin API (reset_save по tg_id).
 */
import { writeFileSync } from 'node:fs';
import { getDb, connectDb, closeDb } from './index.js';
import { users, refreshTokens } from './schema.js';
import { eq, isNotNull } from 'drizzle-orm';

const CONFIRM_PHRASE = 'WIPE_ALL_PLAYER_PROGRESS';
const args = process.argv.slice(2);
const confirmed = args.includes('--yes');

async function resetAll() {
  console.log('[reset] Подключаюсь к БД...');
  connectDb();
  const db = getDb();

  const rows = await db.select({ id: users.id, save_data: users.save_data })
    .from(users)
    .where(isNotNull(users.id));

  console.log(`[reset] Затронуто пользователей: ${rows.length}`);

  if (!confirmed || process.env.WIPE_CONFIRM !== CONFIRM_PHRASE) {
    console.log('[reset] Это был план. Ничего не изменено.');
    console.log('[reset] Для выполнения:');
    console.log(`[reset]   ${CONFIRM_PHRASE}=1 npm --prefix server run db:wipe -- --yes`);
    await closeDb();
    return;
  }

  // Дамп перед изменением — без него восстановиться нечем.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpPath = `wipe-backup-${stamp}.json`;
  writeFileSync(dumpPath, JSON.stringify(rows, null, 2));
  console.log(`[reset] Дамп save_data сохранён в ${dumpPath}`);

  console.log('[reset] Сбрасываю save_data всем пользователям...');
  // _resetAt — метка намеренного сброса. Клиент после перезагрузки видит её в
  // облачном сейве и не восстанавливает локальное состояние из localStorage,
  // иначе сброс отменялся бы сам собой на следующем же запуске.
  const resetAt = new Date().toISOString();
  for (const row of rows) {
    await db.update(users).set({
      save_data: JSON.stringify({ _ts: Date.now(), _resetAt: resetAt, starterGiven: false, myTeam: [], pcBoxes: [[]], badges: [], inventory: { credit: 500 } }),
      save_version: 0,
      registered: 0,
      nickname: '',
      avatar: 'trainer_f',
      money: 500,
      badges_count: 0,
      pokemon_count: 0,
    }).where(eq(users.id, row.id));
  }
  console.log('[reset] save_data сброшен');

  console.log('[reset] Удаляю refresh-токены...');
  await db.delete(refreshTokens);
  console.log('[reset] refresh-токены удалены');

  console.log(`[reset] ✅ Готово. Дамп: ${dumpPath}`);
  await closeDb();
}

resetAll().catch((err) => {
  console.error('[reset] ❌ Ошибка:', err);
  process.exit(1);
});
