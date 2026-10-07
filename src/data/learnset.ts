// ─────────────────────────────────────────────────────────────
// learnset.ts — СТАТИЧНЫЕ МУВСЕТЫ С САЙТА ЛИГИ
// ─────────────────────────────────────────────────────────────
// Порядок изучения атак — как в покедексе league17reborn.ru
// (таблица «Развитие»: сначала статусы, ударные позже), а не в
// порядке ID PokeAPI, где к 1 уровню набегало 4 ударные атаки.
//
// Источник: GET /api/learnset/:name (server/src/routes/learnset.ts,
// данные tools/data-league17/learnsets.json). Кэш в памяти.
// Нет ответа/404 → null, вызывающий падает back на фильтр PokeAPI.
//
// ЭКСПОРТЫ:
//   fetchSiteLearnset  — { levelup: [[lvl, name]], egg: [names] } | null
//   siteStarterMoves   — первые `count` атак level <= maxLevel в порядке сайта
//   rollEggMove        — канон лиги: 30% случайная яйцевая атака при вылуплении
//   siteMoveEntry      — запись вида { move: { name, url } } для apiData.moves
// ─────────────────────────────────────────────────────────────

export type SiteLearnset = {
  levelup: Array<[number, string]>;
  egg: string[];
  tm?: Array<[number, string]>;
  tutor?: string[];
};

const cache = new Map<string, SiteLearnset | null>();

/** Имя атаки → slug PokeAPI: 'Thunder Shock' → 'thunder-shock'. */
export function moveNameToSlug(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Запись мувсета в формате apiData.moves (URL резолвится PokeAPI по имени). */
export function siteMoveEntry(name: string): any {
  const slug = moveNameToSlug(name);
  return { move: { name: slug, url: `https://pokeapi.co/api/v2/move/${slug}/` } };
}

export function tackleEntry(): any {
  return { move: { name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' } };
}

export async function fetchSiteLearnset(species: string): Promise<SiteLearnset | null> {
  const key = (species || '').toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const res = await fetch(`/api/learnset/${encodeURIComponent(species)}`);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json();
    const ls: SiteLearnset = {
      levelup: Array.isArray(data.levelup) ? data.levelup : [],
      egg: Array.isArray(data.egg) ? data.egg : [],
      tm: Array.isArray(data.tm) ? data.tm : [],
      tutor: Array.isArray(data.tutor) ? data.tutor : [],
    };
    cache.set(key, ls);
    return ls;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/**
 * Первые `count` атак с level <= maxLevel в порядке таблицы сайта.
 * Пусто → [tackle] (как у стартера).
 */
export function siteStarterMoves(ls: SiteLearnset | null, maxLevel: number, count = 4): any[] {
  const names = (ls?.levelup || [])
    .filter(([lvl]) => lvl <= maxLevel)
    .map(([, name]) => name)
    .slice(0, count);
  if (!names.length) return [tackleEntry()];
  return names.map(siteMoveEntry);
}

/**
 * Канон лиги (FAQ): 30% шанс при вылуплении получить случайную
 * яйцевую атаку вида. Возвращает запись атаки или null.
 * `rand` инжектится для тестов.
 */
export function rollEggMove(
  eggMoves: string[] | undefined,
  knownNames: string[],
  rand: () => number = Math.random,
): any | null {
  if (rand() >= 0.3) return null;
  const known = new Set((knownNames || []).map(moveNameToSlug));
  const candidates = (eggMoves || []).filter((n) => n && !known.has(moveNameToSlug(n)));
  if (!candidates.length) return null;
  return siteMoveEntry(candidates[Math.floor(rand() * candidates.length)]);
}
