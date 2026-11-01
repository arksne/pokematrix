/**
 * PokeAPI proxy route:
 *   GET /api/pokeapi/*  → прокси на https://pokeapi.co/api/v2/{path}
 *
 * Кэширует ответы в таблицу pokemon_cache на 24 часа.
 * Таймаут запроса: 10 секунд.
 * Разрешены только валидные пути (защита от SSRF).
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { gzipSync, gunzipSync } from 'node:zlib';
import { getDb } from '../db/index.js';
import { pokemonCache } from '../db/schema.js';
import { logger } from '../logger.js';

const router = Router();
const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT = 10_000; // 10s

// ── Сжатие в L2 (таблица pokemon_cache) ─────────────────────
// Neon Free считает public network transfer: всё, что Postgres отдаёт
// клиенту, идёт в лимит 5 ГБ/мес. PokeAPI-дамп pokemon/* — в среднем 220 КБ
// JSON на запись (301 строка = 65 МБ «логически»), species/move — по 30 КБ.
// Каждый холодный старт Render обнуляет L1-кэш в памяти, и первые запросы
// снова тянут эти строки из базы — именно это съело квоту в прошлый раз.
//
// Поэтому в L2 данные лежат сжатыми: gzip + base64 с префиксом 'gz:'. По
// проводу из базы едет ~в 5-7 раз меньше, а на сервере распаковка занимает
// доли миллисекунды (в память кладём уже распакованную строку).
// Формат терпит оба варианта: старые строки без префикса читаются как JSON.
const GZ_PREFIX = 'gz:';

function encodeForDb(raw: string): string {
  // Мелкие ответы незачем сжимать: base64 + заголовок съедят выигрыш.
  if (raw.length < 2048) return raw;
  return GZ_PREFIX + gzipSync(Buffer.from(raw, 'utf8'), { level: 6 }).toString('base64');
}

function decodeFromDb(stored: string): string {
  if (!stored.startsWith(GZ_PREFIX)) return stored; // legacy-строка
  try {
    return gunzipSync(Buffer.from(stored.slice(GZ_PREFIX.length), 'base64')).toString('utf8');
  } catch (err) {
    // Битые данные в кэше не должны ронять запрос: считаем промахом.
    logger.warn({ err }, '[pokeapi] не удалось распаковать строку кэша');
    return '';
  }
}

// ── L1-кэш в памяти ─────────────────────────────────────────
// Раньше кэшем служила ТОЛЬКО таблица pokemon_cache: каждый запрос
// /api/pokeapi/* (а клиент дёргает его на каждого встреченного покемона,
// его вид, эволюционную цепочку и атаки) шёл SELECT'ом в Postgres и тянул
// из базы целый JSON PokeAPI. Размеры там серьёзные: pokemon-species и
// pokemon — это десятки-сотни килобайт на запись. На Neon Free входящий
// трафик из базы ("public network transfer", 5 ГБ/мес) закончился за месяц
// и база была приостановлена — то есть кэш, который должен экономить,
// сам стал источником трафика и уронил прод.
//
// Теперь перед базой стоит обычный LRU в памяти процесса: пока данные
// свежие, Postgres не опрашивается вообще. L2 (таблица) остаётся, чтобы
// холодный старт Render не бил в PokeAPI, но читается сильно реже.
//
// Храним готовую JSON-строку, а не объект: её можно отдать клиенту как есть
// (res.type(...).send), без повторного JSON.parse/stringify на каждый запрос.
const MEM_TTL = CACHE_TTL;
// 512 МБ у Render Free. JSON'ы PokeAPI крупные (до ~300 КБ), поэтому
// ограничиваем не числом записей, а суммарным весом строк.
const MEM_MAX_BYTES = 48 * 1024 * 1024;
const MEM_MAX_ENTRIES = 600;

type MemEntry = { raw: string; bytes: number; expiresAt: number };
const memCache = new Map<string, MemEntry>();
let memBytes = 0;

function memGet(key: string): string | undefined {
  const hit = memCache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    memCache.delete(key);
    memBytes -= hit.bytes;
    return undefined;
  }
  // LRU: поднимаем запись в конец очереди Map
  memCache.delete(key);
  memCache.set(key, hit);
  return hit.raw;
}

function memSet(key: string, raw: string) {
  const bytes = raw.length * 2; // UTF-16 строка в V8 — две единицы на символ (верхняя оценка)
  if (bytes > MEM_MAX_BYTES / 4) return; // одна огромная запись не должна вымывать весь кэш
  const prev = memCache.get(key);
  if (prev) {
    memCache.delete(key);
    memBytes -= prev.bytes;
  }
  memCache.set(key, { raw, bytes, expiresAt: Date.now() + MEM_TTL });
  memBytes += bytes;
  // Вытесняем самые старые, пока не влезли в бюджет
  while ((memBytes > MEM_MAX_BYTES || memCache.size > MEM_MAX_ENTRIES) && memCache.size > 0) {
    const oldest = memCache.keys().next();
    if (oldest.done) break;
    const evicted = memCache.get(oldest.value)!;
    memCache.delete(oldest.value);
    memBytes -= evicted.bytes;
  }
}

/** Отдаёт готовую JSON-строку без повторного парсинга/сериализации. */
function sendRawJson(res: Response, raw: string) {
  res.type('application/json').send(raw);
}

// Разрешённые префиксы путей (защита от SSRF через wildcard)
const ALLOWED_PREFIXES = [
  'pokemon/',
  'pokemon-species/',
  'move/',
  'evolution-chain/',
  'type/',
  'ability/',
  'item/',
  'location/',
  'berry/',
  'machine/',
  'growth-rate/',
  'nature/',
  'stat/',
  'egg-group/',
];

router.get('*', async (req: Request, res: Response) => {
  try {
    const pokePath = req.path.replace(/^\//, '').trim();
    if (!pokePath) {
      res.status(400).json({ error: 'PokeAPI path required' });
      return;
    }

    // ── Валидация пути (SSRF-защита) ──
    // Проверки по списку префиксов было недостаточно: «pokemon/../../x» проходит
    // через startsWith('pokemon/') и после нормализации уходит на другой путь
    // PokeAPI. Поэтому дополнительно режем всё, что не похоже на имя ресурса.
    const allowed = ALLOWED_PREFIXES.some(p => pokePath.startsWith(p));
    if (!allowed) {
      res.status(403).json({ error: `Path not allowed: ${pokePath}. Allowed prefixes: ${ALLOWED_PREFIXES.join(', ')}` });
      return;
    }
    if (pokePath.includes('..') || !/^[a-z0-9\-/_]+$/.test(pokePath) || pokePath.length > 120) {
      res.status(400).json({ error: 'Malformed PokeAPI path' });
      return;
    }

    // ── L1: кэш в памяти процесса ──
    // Основной путь для уже виденных покемонов/атак: БД не трогаем вообще.
    const memHit = memGet(pokePath);
    if (memHit !== undefined) {
      sendRawJson(res, memHit);
      return;
    }

    const db = getDb();

    // ── L2: таблица pokemon_cache ──
    // Читаем её только после промаха L1 — это и есть экономия входящего
    // трафика Neon, из-за которого прод останавливался.
    let cached: { data: string; fetched_at: string } | undefined;
    try {
      cached = (await db.select({
        data: pokemonCache.data,
        fetched_at: pokemonCache.fetched_at,
      })
        .from(pokemonCache)
        .where(eq(pokemonCache.name, pokePath))
        .limit(1))[0];
    } catch (e) {
      // База недоступна (приостановлен Neon, обрыв соединения) — не роняем
      // запрос: идём напрямую в PokeAPI, это дешевле, чем 500 у клиента.
      logger.warn({ err: e }, '[pokeapi] cache read failed, falling back to upstream');
    }

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL) {
        const raw = decodeFromDb(cached.data);
        if (raw) {
          memSet(pokePath, raw);
          sendRawJson(res, raw);
          // Ленивая миграция формата: старые строки лежат несжатым JSON'ом
          // (в базе таких ещё сотни), и каждое их чтение — лишний трафик Neon.
          // Переписываем в сжатый вид в фоне, без ожидания ответа клиенту.
          if (!cached.data.startsWith(GZ_PREFIX)) {
            void db.update(pokemonCache)
              .set({ data: encodeForDb(raw) })
              .where(eq(pokemonCache.name, pokePath))
              .catch((e: unknown) => logger.warn({ err: e }, '[pokeapi] recompress failed'));
          }
          return;
        }
        // Распаковать не вышло — считаем промахом и идём в PokeAPI.
      }
    }

    // ── Запрашиваем из PokeAPI с таймаутом ──
    const url = `${POKEAPI_BASE}/${pokePath}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let fetchResp: globalThis.Response;
    try {
      fetchResp = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!fetchResp.ok) {
      res.status(fetchResp.status).json({ error: `PokeAPI error: ${fetchResp.status}` });
      return;
    }

    const data = await fetchResp.json();
    // Сериализуем один раз: одна и та же строка уходит и в ответ, и в кэши.
    const raw = JSON.stringify(data);
    memSet(pokePath, raw);

    // ── Сохраняем в кэш (L2) ──
    // В базу пишем сжатый base64 (см. encodeForDb): чтение этой строки — это
    // трафик Neon, а он в лимите 5 ГБ/мес. Ошибку записи глотаем: на Neon при
    // превышении квоты база отклоняет INSERT'ы, и падать из-за этого нельзя.
    const nowIso = new Date().toISOString();
    try {
      await db.insert(pokemonCache).values({
        name: pokePath,
        data: encodeForDb(raw),
        fetched_at: nowIso,
      }).onConflictDoUpdate({
        target: pokemonCache.name,
        set: { data: encodeForDb(raw), fetched_at: nowIso },
      });
    } catch (e) {
      logger.warn({ err: e }, '[pokeapi] cache write failed');
    }

    sendRawJson(res, raw);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'PokeAPI timeout (10s)' });
      return;
    }
    console.error('[pokeapi]', err);
    res.status(500).json({ error: 'PokeAPI proxy error' });
  }
});

export default router;
