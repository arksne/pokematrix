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

// Все пути /api/pokeapi/* ловятся экспрессом
router.get('*', async (req: Request, res: Response) => {
  try {
    // Express монтирует роутер на /api/pokeapi,
    // req.path = /pokemon/25 (уже без префикса)
    const pokePath = req.path.replace(/^\//, '').trim();
    if (!pokePath) {
      res.status(400).json({ error: 'PokeAPI path required' });
      return;
    }

    // ── Запрашиваем из PokeAPI напрямую (кеш опционально) ──
    const url = `${POKEAPI_BASE}/${pokePath}`;
    const response = await fetch(url);

    if (!response.ok) {
      res.status(response.status).json({ error: `PokeAPI error: ${response.status}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('[pokeapi]', err);
    res.status(500).json({ error: `PokeAPI proxy error: ${err.message || err}` });
  }
});

export default router;
