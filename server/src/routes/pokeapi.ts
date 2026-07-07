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
import { getDb } from '../db/index.js';
import { pokemonCache } from '../db/schema.js';

const router = Router();
const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT = 10_000; // 10s

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
    const allowed = ALLOWED_PREFIXES.some(p => pokePath.startsWith(p));
    if (!allowed) {
      res.status(403).json({ error: `Path not allowed: ${pokePath}. Allowed prefixes: ${ALLOWED_PREFIXES.join(', ')}` });
      return;
    }

    const db = getDb();

    // ── Проверяем кэш ──
    const cached = (await db.select()
      .from(pokemonCache)
      .where(eq(pokemonCache.name, pokePath))
      .limit(1))[0];

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL) {
        res.json(JSON.parse(cached.data));
        return;
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

    // ── Сохраняем в кэш ──
    try {
      await db.insert(pokemonCache).values({
        name: pokePath,
        data: JSON.stringify(data),
        fetched_at: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: pokemonCache.name,
        set: { data: JSON.stringify(data), fetched_at: new Date().toISOString() },
      });
    } catch (e) {
      // Кэш опционален — при ошибке просто продолжаем
      console.warn('[pokeapi] Cache write failed:', e);
    }

    res.json(data);
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
