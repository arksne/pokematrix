/**
 * Запуск миграций Drizzle.
 * Применяет только новые — существующие данные не трогает.
 */
import { connectDb, runMigrations, closeDb } from './index.js';

async function main() {
  console.log('[db] Running migrations...');
  connectDb();
  await runMigrations();
  console.log('[db] Migrations complete.');
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error('[db] Migration failed:', err);
  process.exit(1);
});
