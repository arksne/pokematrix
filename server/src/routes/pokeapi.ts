/**
 * PokeAPI proxy route:
 *   GET /api/pokeapi/*  → прокси на https://pokeapi.co/api/v2/{path}
 *
 * Кэширует ответы в таблицу pokemon_cache на 24 часа.
 * Без этого клиент не может загрузить: покемонов, атаки, эволюции.
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { pokemonCache } from '../db/schema.js';

const router = Router();
const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

// Все пути /api/pokeapi/* ловятся экспрессом
router.get('*', async (req: Request, res: Response) => {
  try {
    // Вытаскиваем путь после /api/pokeapi/
    // Express роут: GET /api/pokeapi/* → req.path = /api/pokeapi/pokemon/25
    // Нам нужно: pokemon/25
    const pokePath = req.path.replace(/^\/api\/pokeapi\//, '');
    if (!pokePath) {
      res.status(400).json({ error: 'PokeAPI path required' });
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
      if (age < CACHE_TTL_MS) {
        res.json(JSON.parse(cached.data));
        return;
      }
    }

    // ── Запрашиваем из PokeAPI ──
    const response = await fetch(`${POKEAPI_BASE}/${pokePath}`);
    if (!response.ok) {
      // Если PokeAPI вернул ошибку, но есть кэш — отдаём его
      if (cached) {
        res.json(JSON.parse(cached.data));
        return;
      }
      res.status(response.status).json({ error: `PokeAPI error: ${response.status}` });
      return;
    }

    const data = await response.json();
    const dataStr = JSON.stringify(data);

    // ── Сохраняем в кэш ──
    if (cached) {
      await db.update(pokemonCache).set({
        data: dataStr,
        fetched_at: new Date().toISOString(),
      }).where(eq(pokemonCache.name, pokePath));
    } else {
      await db.insert(pokemonCache).values({
        name: pokePath,
        data: dataStr,
        fetched_at: new Date().toISOString(),
      }).catch(() => {
        // Конкурентная вставка — игнорируем, данные те же
      });
    }

    res.json(data);
  } catch (err: any) {
    console.error('[pokeapi]', err);
    res.status(500).json({ error: 'PokeAPI proxy error' });
  }
});

export default router;
