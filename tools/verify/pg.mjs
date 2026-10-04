/**
 * PostgreSQL для проверки: PGlite в режиме pg-wire сервера.
 *
 * Это настоящий PostgreSQL 18.3 (собран под WASM), подключённый по сетевому
 * протоколу, поэтому драйвер приложения (pg + drizzle) работает без изменений.
 * Альтернативы нет: ни Docker, ни установленный Postgres в среде проверки.
 *
 * Ограничение: соединение обслуживает по одному клиенту, поэтому все запросы
 * к БД идут последовательно, а проверка БД выполняется после остановки сервера.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { STATE_DIR, PG_PORT, PG_URL } from './paths.mjs';

export async function startPg({ fresh = false, dataDir: customDir, port = PG_PORT } = {}) {
  // Своё хранилище позволяет прогнать миграции на пустой базе, не трогая основную.
  // Общий каталог здесь опасен: миграции, применённые напрямую SQL, не оставляют
  // записей в __drizzle_migrations, и основной запуск затем падает на
  // «relation already exists».
  const dataDir = customDir ?? path.join(STATE_DIR, 'pgdata');
  if (fresh) {
    const { rmSync } = await import('node:fs');
    rmSync(dataDir, { recursive: true, force: true });
  }
  mkdirSync(path.dirname(dataDir), { recursive: true });

  const db = await PGlite.create({ dataDir });
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
  await server.start();

  return {
    db,
    url: PG_URL,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}
