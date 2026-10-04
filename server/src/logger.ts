/**
 * Логгер сервера.
 *
 * Вынесен в отдельный модуль, чтобы db/index.ts мог логировать ошибки пула,
 * не импортируя index.ts: тот импортирует db/index.ts, и получился бы цикл.
 */
import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.logLevel,
  transport: config.isProduction ? undefined : { target: 'pino-pretty' },
});
