/**
 * Раздача спрайтов покемонов через наш сервер (кэш + долгий HTTP-кэш).
 *
 * Зачем: спрайты (`official-artwork`) — это PNG на 100–200 КБ с
 * raw.githubusercontent.com. Две проблемы:
 *  1. GitHub отдаёт их с `Cache-Control: max-age=300` — вебвью перекачивает
 *     картинки каждые 5 минут, хотя файлы не меняются годами.
 *  2. В части регионов (и в некоторых вебвью) raw.githubusercontent.com
 *     медленный или вовсе недоступен — тогда игрок видит битые картинки вместо
 *     покемонов (ровно это поймал UI-тур: в бою были «сломанные» спрайты).
 *
 * Решение: `/api/sprite/<path>` — сервер сам тянет PNG из GitHub, держит его в
 * LRU-кэше памяти и отдаёт с `Cache-Control: public, max-age=31536000, immutable`
 * (+ ETag/304). Клиент качает картинку один раз, а не раз в пять минут.
 *
 * Модуль без Express: LRU и проверка пути тестируются юнит-тестами, маршрут —
 * тонкая обёртка (server/src/routes/sprite.ts).
 */

export const SPRITE_UPSTREAM_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

/** Сколько байт PNG держим в памяти процесса (Render Free: 512 МБ). */
export const SPRITE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
export const SPRITE_CACHE_MAX_ENTRIES = 900;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Разрешённый путь спрайта: только безопасные символы, только .png и без
 * `..`. Это защита от SSRF: без проверки через прокси можно было бы
 * попросить сервер сходить на произвольный путь GitHub.
 */
export function isAllowedSpritePath(p: string): boolean {
  if (!p || p.length > 200) return false;
  if (p.startsWith('/')) return false;
  if (/\.\./.test(p)) return false;
  if (!/^[A-Za-z0-9/_.-]+\.png$/.test(p)) return false;
  // Не разрешаем «служебные» сегменты и двойные слэши.
  if (p.includes('//')) return false;
  return true;
}

export type SpriteEntry = { body: Buffer; contentType: string; etag: string };

/** Простой LRU по суммарному весу байт (как L1-кэш PokeAPI). */
export class SpriteCache {
  private map = new Map<string, SpriteEntry>();
  private bytes = 0;
  constructor(
    private readonly maxBytes = SPRITE_CACHE_MAX_BYTES,
    private readonly maxEntries = SPRITE_CACHE_MAX_ENTRIES
  ) {}

  get size(): number {
    return this.map.size;
  }

  get totalBytes(): number {
    return this.bytes;
  }

  get(key: string): SpriteEntry | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    // Освежаем позицию: Map хранит порядок вставки.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit;
  }

  set(key: string, entry: SpriteEntry): void {
    const prev = this.map.get(key);
    if (prev) {
      this.map.delete(key);
      this.bytes -= prev.body.length;
    }
    this.map.set(key, entry);
    this.bytes += entry.body.length;
    while (this.bytes > this.maxBytes || this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const oldest = this.map.get(oldestKey);
      this.map.delete(oldestKey);
      if (oldest) this.bytes -= oldest.body.length;
    }
  }

  clear(): void {
    this.map.clear();
    this.bytes = 0;
  }
}

/** Слабый, но стабильный ETag по содержимому (длина + FNV-1a). */
export function spriteEtag(body: Buffer): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    hash ^= body[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `"${body.length.toString(16)}-${hash.toString(16)}"`;
}

export interface LoadSpriteDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Скачать спрайт из GitHub. Возвращает null, если upstream отдал ошибку или
 * ответ не похож на PNG (чтобы не кэшировать HTML-страницу ошибки).
 */
export async function loadSprite(spritePath: string, deps: LoadSpriteDeps = {}): Promise<SpriteEntry | null> {
  if (!isAllowedSpritePath(spritePath)) return null;
  const fetchImpl = deps.fetchImpl || (globalThis.fetch as typeof fetch);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    const resp = await fetchImpl(`${SPRITE_UPSTREAM_BASE}/${spritePath}`, { signal: controller.signal });
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await resp.arrayBuffer());
    // Проверяем сигнатуру PNG: GitHub на 404 может вернуть HTML с кодом 200
    // в редких случаях прокси-кэшей, а кэшировать мусор нельзя.
    if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
    return { body: buf, contentType, etag: spriteEtag(buf) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
