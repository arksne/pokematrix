/**
 * =============================================================================
 *  ФАЙЛ: src/utils/api.ts
 * =============================================================================
 *
 *  1. НАЗНАЧЕНИЕ
 *     ----------
 *     Единственная утилита для HTTP-запросов к PokeAPI (Pokémon REST API).
 *     Проксирует все вызовы через серверный endpoint `/api/pokeapi/*`, чтобы
 *     обойти CORS-ограничения браузера и скрыть реальный base URL от клиента.
 *
 *  2. ЗАВИСИМОСТИ
 *     ------------
 *     - Node.js/браузерный `fetch` (глобально, без импорта)
 *     - `localStorage` — второй уровень кэша (может отсутствовать: приватный
 *       режим, отключённое хранилище в вебвью — тогда работаем без него)
 *     - Серверный роут `/api/pokeapi/:path` — прокси к https://pokeapi.co/api/v2/
 *
 *  3. ЗАЧЕМ КЭШ НА КЛИЕНТЕ
 *     -------------------
 *     Раньше каждый вызов шёл в сеть, а клиент дёргает прокси постоянно: на
 *     каждого встреченного покемона, его вид, эволюционную цепочку, атаки,
 *     TM-совместимость, инвентарь, покедекс. Дампы жирные (pokemon/* — до
 *     400 КБ, в среднем 220 КБ; после gzip по проводу 10–30 КБ), но данные
 *     PokeAPI статичны: один и тот же покемон не меняется.
 *
 *     Кэш двухуровневый:
 *       L1 — Map в памяти (POKE_TTL_MS, до POKE_MAX_ENTRIES записей);
 *       L2 — localStorage (POKE_DISK_TTL_MS, бюджет POKE_DISK_BUDGET_BYTES):
 *            переживает перезагрузку и переоткрытие Mini App, поэтому холодное
 *            открытие не тянет заново весь покедекс.
 *     Плюс дедупликация одновременных запросов одного пути: раньше два
 *     параллельных вызова (например, бой и панель команды грузят одного
 *     покемона) делали два сетевых запроса.
 *
 *  4. ЭКСПОРТЫ
 *     ---------
 *     fetchPokeAPI        — GET к PokeAPI через прокси, с кэшем и дедупом.
 *     clearPokeCache      — сбросить оба уровня (тесты, «жёсткое обновление»).
 *
 * =============================================================================
 */

/** Сколько живёт запись в памяти. */
export const POKE_TTL_MS = 30 * 60 * 1000;
/** Сколько живёт запись на диске (данные PokeAPI статичны). */
export const POKE_DISK_TTL_MS = 24 * 60 * 60 * 1000;
/** Максимум записей в памяти (вытесняем самую старую). */
export const POKE_MAX_ENTRIES = 300;
/** Бюджет localStorage под кэш PokeAPI. */
export const POKE_DISK_BUDGET_BYTES = 2 * 1024 * 1024;
/** Запись больше этого на диск не кладём: иначе покедекс съест весь бюджет. */
export const POKE_DISK_MAX_ENTRY_BYTES = 150 * 1024;
/** Префикс ключей на диске (по нему же чистим namespace целиком). */
export const POKE_DISK_PREFIX = 'pm_pokeapi_v1:';

const mem = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function normPath(pathOrUrl: string): string {
  return String(pathOrUrl).replace('https://pokeapi.co/api/v2/', '');
}

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

/** Читаем L2. Просроченные и битые записи выбрасываем. */
function diskGet(key: string): { at: number; data: unknown } | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: unknown };
    if (!parsed || typeof parsed.at !== 'number' || parsed.data === undefined) return null;
    if (Date.now() - parsed.at > POKE_DISK_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return { at: parsed.at, data: parsed.data };
  } catch {
    // Мусор в ключе (обрезанная запись, чужой формат) не должен ломать загрузку.
    return null;
  }
}

/** Пишем L2, укладываясь в бюджет. Не влезло — молча пропускаем. */
function diskSet(key: string, data: unknown): void {
  if (!canUseStorage()) return;
  try {
    const payload = JSON.stringify({ at: Date.now(), data });
    if (payload.length > POKE_DISK_MAX_ENTRY_BYTES) return;
    let used = 0;
    const ourKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(POKE_DISK_PREFIX)) {
        ourKeys.push(k);
        used += (localStorage.getItem(k) || '').length;
      }
    }
    if (used + payload.length > POKE_DISK_BUDGET_BYTES) {
      // Место кончилось — чистим весь наш namespace. Часть данных перезагрузится
      // с сервера (у него свой кэш в памяти), зато квота хранилища не рванёт.
      for (const k of ourKeys) localStorage.removeItem(k);
    }
    localStorage.setItem(key, payload);
  } catch {
    // Переполнение квоты/запрет хранилища: просто работаем без дискового кэша.
  }
}

function memSet(path: string, data: unknown): void {
  mem.set(path, { at: Date.now(), data });
  if (mem.size > POKE_MAX_ENTRIES) {
    // Map хранит порядок вставки: первый ключ — самый старый.
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
}

/**
 * Глубокая копия JSON-значения.
 *
 * Зачем: раньше каждый вызов возвращал свежий объект из сети, и вызывающий код
 * спокойно его мутировал (например, бой кладёт ответ в S.activeWild и меняет
 * HP/статус). Если начать отдавать одну и ту же ссылку из кэша, мутации одного
 * боя протекут в следующий — «покемон приходит уже побитым». Поэтому наружу
 * всегда уходит копия, а в кэше лежит нетронутый оригинал.
 */
function cloneJson<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch { /* fallback ниже: данные всегда JSON-совместимые */ }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Сбросить оба уровня кэша (тесты, «обновить данные из PokeAPI»). */
export function clearPokeCache(): void {
  mem.clear();
  inflight.clear();
  if (!canUseStorage()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(POKE_DISK_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch { /* хранилище недоступно — чистить нечего */ }
}

/**
 * fetchPokeAPI(pathOrUrl)
 *
 * Выполняет GET-запрос к PokeAPI через серверный прокси-роут `/api/pokeapi/`.
 * Если передан полный URL вида `https://pokeapi.co/api/v2/...`, префикс
 * автоматически отрезается, остаётся только относительный путь.
 *
 * Вход:
 *   - pathOrUrl (string):
 *       - Относительный путь: `"pokemon/25"` → запрос к `/api/pokeapi/pokemon/25`
 *       - Полный URL: `"https://pokeapi.co/api/v2/pokemon-species/6"` → запрос
 *         к `/api/pokeapi/pokemon-species/6`
 *
 * Выход:
 *   - Promise<object> — распарсенный JSON-ответ от PokeAPI.
 *
 * Порядок: память → localStorage → сеть. Одновременные запросы одного пути
 * делят один сетевой запрос.
 *
 * Ошибки:
 *   - Если HTTP-статус не 2xx, бросает Error с текстом `"PokeAPI error: {status}"`.
 *     Вызывающий код отвечает за обработку (try/catch).
 */
export async function fetchPokeAPI(pathOrUrl: string): Promise<any> {
  const path = normPath(pathOrUrl);

  const hit = mem.get(path);
  if (hit && Date.now() - hit.at < POKE_TTL_MS) return cloneJson(hit.data);
  if (hit) mem.delete(path);

  const diskKey = POKE_DISK_PREFIX + path;
  const fromDisk = diskGet(diskKey);
  if (fromDisk) {
    // Поднимаем в память: дальше отдаём без JSON.parse на каждый вызов.
    memSet(path, fromDisk.data);
    return cloneJson(fromDisk.data);
  }

  const pending = inflight.get(path);
  if (pending) return cloneJson(await pending);

  const request = (async () => {
    const res = await fetch(`/api/pokeapi/${path}`);
    if (!res.ok) throw new Error(`PokeAPI error: ${res.status}`);
    const data = await res.json();
    // В кэш — копия: вызывающий получает свой объект и может его мутировать.
    memSet(path, cloneJson(data));
    diskSet(diskKey, data);
    return data;
  })();

  inflight.set(path, request);
  try {
    return await request;
  } finally {
    inflight.delete(path);
  }
}
