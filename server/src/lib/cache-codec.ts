/**
 * Формат хранения PokeAPI-ответов в L2-кэше (таблица pokemon_cache).
 *
 * Зачем отдельный модуль: Neon Free считает public network transfer (5 ГБ/мес),
 * а дампы PokeAPI жирные — в среднем 220 КБ JSON на `pokemon/*` (максимум
 * 436 КБ). Postgres хранит их TOAST-сжатыми, но отдаёт клиенту распакованными,
 * поэтому каждое чтение строки из базы — это сотни килобайт в лимит.
 *
 * В базе держим `gz:` + base64(gzip(json)): по проводу едет в 5–30 раз меньше,
 * побайтовая точность не нужна, а распаковка на сервере — доли миллисекунды.
 * Старые строки (без префикса) читаются как обычный JSON, поэтому формат
 * можно мигрировать лениво, по одному чтению.
 */

/** Префикс сжатой строки в БД. */
export const GZ_PREFIX = 'gz:';

/** Ниже этого размера сжимать бессмысленно: base64 + префикс съедят выигрыш. */
export const COMPRESS_MIN_LENGTH = 2048;

/**
 * Готовим JSON-строку к записи в БД.
 * Мелкие ответы (эволюции, спрайты) оставляем как есть — они дешевле в базе.
 */
export function encodeForDb(raw: string, gzip: (buf: Buffer) => Buffer = defaultGzip): string {
  if (raw.length < COMPRESS_MIN_LENGTH) return raw;
  return GZ_PREFIX + gzip(Buffer.from(raw, 'utf8')).toString('base64');
}

/**
 * Достаём JSON-строку из БД. Битые данные не бросают исключение: возвращаем
 * пустую строку, и вызывающий код считает это промахом кэша (пойдёт в PokeAPI).
 */
export function decodeFromDb(stored: string, gunzip: (buf: Buffer) => Buffer = defaultGunzip): string {
  if (!stored.startsWith(GZ_PREFIX)) return stored; // legacy-строка
  try {
    return gunzip(Buffer.from(stored.slice(GZ_PREFIX.length), 'base64')).toString('utf8');
  } catch {
    return '';
  }
}

/** Строка уже в новом формате? */
export function isCompressed(stored: string): boolean {
  return stored.startsWith(GZ_PREFIX);
}

import { gzipSync, gunzipSync } from 'node:zlib';

function defaultGzip(buf: Buffer): Buffer {
  return gzipSync(buf, { level: 6 });
}

function defaultGunzip(buf: Buffer): Buffer {
  return gunzipSync(buf);
}
