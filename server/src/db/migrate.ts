/**
 * Запуск миграций Drizzle.
 * Применяет только новые миграции — существующие данные не трогает.
 */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { connectDb, closeDb } from './index.js';

async function runMigrations() {
  console.log('[db] Running migrations...');
  const { db } = connectDb();
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('[db] Migrations complete.');
  await closeDb();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('[db] Migration failed:', err);
  process.exit(1);
});
