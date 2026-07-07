/**
 * Сброс прогресса всех пользователей (без удаления аккаунтов).
 * - Очищает save_data (→ '{}')
 * - Сбрасывает registered (→ 0)
 * - Сбрасывает деньги на 500
 * - Сбрасывает значки, покемонов
 * - Удаляет refresh-токены (чтобы перелогиниться)
 */
import { getDb, connectDb, closeDb } from './index.js';
import { users, refreshTokens } from './schema.js';

async function resetAll() {
  console.log('[reset] Подключаюсь к БД...');
  connectDb();
  const db = getDb();

  console.log('[reset] Сбрасываю save_data всем пользователям...');
  await db.update(users).set({
    save_data: '{}',
    save_version: 0,
    registered: 0,
    nickname: '',
    avatar: 'trainer_f',
    money: 500,
    badges_count: 0,
    pokemon_count: 0,
  });
  console.log('[reset] save_data сброшен');

  console.log('[reset] Удаляю refresh-токены...');
  await db.delete(refreshTokens);
  console.log('[reset] refresh-токены удалены');

  console.log('[reset] ✅ Готово! Войдите заново — будет регистрация + стартовик.');
  await closeDb();
}

resetAll().catch((err) => {
  console.error('[reset] ❌ Ошибка:', err);
  process.exit(1);
});
