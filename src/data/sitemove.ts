// ─────────────────────────────────────────────────────────────
// sitemove.ts — ДЕТАЛИ АТАК С САЙТА ЛИГИ
// ─────────────────────────────────────────────────────────────
// Единственная точка загрузки деталей атак для боя, ТМ, профиля:
// GET /api/sitemove/:name (цифры с сайта лиги, форма PokeAPI /move/).
// Кэш в памяти: за бой каждая атака грузится один раз.
// Нет записи на сервере → fallback на PokeAPI-прокси (с warn в консоль),
// чтобы игра не вставала на атаках вне базы (их 741).
//
// ЭКСПОРТЫ:
//   fetchSiteMoveDetail — детали атаки по {move:{name,url}} или имени
//   clearSiteMoveCache  — сброс кэша (для тестов)
// ─────────────────────────────────────────────────────────────

import { fetchPokeAPI } from '../utils/api.js';

const cache = new Map<string, any>();

export function clearSiteMoveCache() {
  cache.clear();
}

function slugOf(moveOrName: any): string {
  const raw = typeof moveOrName === 'string'
    ? moveOrName
    : moveOrName?.move?.name || moveOrName?.name || '';
  // URL вида .../move/thunder-shock/ → имя из пути
  const m = /\/move\/([^/]+)\/?$/.exec(raw);
  const name = m ? m[1] : raw;
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function pokeUrlFor(slug: string): string {
  return `https://pokeapi.co/api/v2/move/${slug}/`;
}

export async function fetchSiteMoveDetail(moveOrName: any): Promise<any> {
  const slug = slugOf(moveOrName);
  if (!slug) throw new Error('sitemove: empty move name');
  if (cache.has(slug)) return cache.get(slug);
  try {
    const res = await fetch(`/api/sitemove/${encodeURIComponent(slug)}`);
    if (res.ok) {
      const detail = await res.json();
      cache.set(slug, detail);
      return detail;
    }
  } catch {
    // ниже — fallback
  }
  // Safety net: атаки нет в базе сайта — берём PokeAPI, чтобы не ронять бой.
  console.warn(`[sitemove] нет на сайте: ${slug} — fallback PokeAPI`);
  const detail = await fetchPokeAPI(pokeUrlFor(slug));
  cache.set(slug, detail);
  return detail;
}
