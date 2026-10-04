/**
 * Общие пути и настройки для проверки работоспособности.
 *
 * Все пути вычисляются от корня репозитория, поэтому набор запускается
 * из любого каталога и не зависит от машины.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Корень репозитория. */
export const REPO = path.resolve(here, '..', '..');
/** Каталог этого набора проверок. */
export const TOOLS = here;
/** Каталог для логов и временных данных. */
export const STATE_DIR = path.join(here, '.state');

export const APP_PORT = Number(process.env.VERIFY_PORT || 8099);
export const PG_PORT = Number(process.env.VERIFY_PG_PORT || 5433);
export const PG_URL = `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`;
export const BASE = `http://127.0.0.1:${APP_PORT}`;

/**
 * Хост-алиас для браузера. Нужен обязательно: клиент (src/game/auth.ts)
 * считает `localhost` и `?dev` режимом разработки и обходит аутентификацию,
 * поэтому проверка должна идти не с localhost.
 */
export const HOST_ALIAS = 'pokematrix.test';
export const APP_URL = `http://${HOST_ALIAS}:${APP_PORT}`;

/** Тестовый токен бота. Подпись initData считается по нему, как это делает Telegram. */
export const BOT_TOKEN = '1234567890:VERIFY_BOT_TOKEN_local_only';

export const SERVER_DIR = path.join(REPO, 'server');
export const DIST_DIR = path.join(REPO, 'dist');

/** Каталог SQL-миграций и файл объявленной схемы drizzle. */
export const MIGRATIONS_DIR = path.join(SERVER_DIR, 'src', 'db', 'migrations');
export const SCHEMA_FILE = path.join(SERVER_DIR, 'src', 'db', 'schema.ts');

/** Резолвит модуль из node_modules репозитория (root или server). */
export function requireFrom(specifier, fromDir) {
  const { createRequire } = requireFrom;
  return createRequire(fromDir)(specifier);
}

import { createRequire } from 'node:module';
requireFrom.createRequire = createRequire;
