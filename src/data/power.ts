// ─────────────────────────────────────────────────────────────
// СИЛА ВИДА — единственный источник «мощи» для редкости и звёзд
// ─────────────────────────────────────────────────────────────
// Проблема, которую это чинит:
//  * ENCOUNTER_WEETS держал ~70 видов руками. Для всех остальных вес падал
//    в дефолт 1.0 — и Ancient Kabuto (`kabuto-legacy`), которого в таблице
//    нет, ловился ЧАЩЕ обычного Kabuto (0.8). Игроки ловили «редких» чаще
//    обычных.
//  * getRarityStars() смотрел на captureRate, которого нет ни у дикого из
//    Pokédex, ни у покедекса, поэтому у всех подряд выдавалась одна звезда.
//
// Теперь сила вида = сумма базовых статов (BST) из public/pokemon_power.json
// (генерируется tools/data-league17/build_power.py из species.json).
// Редкость и звёзды выводятся из неё — единая система вместо трёх разных.
//
// Шкала силы 0–10: <250 → 1★ … ≥650 → 10★ (совпадает с прежними порогами
// getPowerStars, чтобы у игроков не прыгнули значения).

let table: Record<string, number> | null = null;

/**
 * Задать таблицу напрямую (тесты, SSR). В проде таблица грузится из
 * public/pokemon_power.json через loadPowerTable().
 */
export function setPowerTable(t: Record<string, number>): void {
  table = t;
}

/** Загрузить таблицу силы. Вызывается на старте (loadPokedexData). */
export async function loadPowerTable(): Promise<Record<string, number>> {
  if (table) return table;
  try {
    const base = (import.meta as any).env?.BASE_URL || '/';
    const res = await fetch(`${base}pokemon_power.json`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    table = await res.json();
  } catch (e) {
    console.warn('[power] не удалось загрузить pokemon_power.json:', e);
    table = {};
  }
  return table!;
}

/** Синхронный доступ (таблица должна быть загружена на старте). */
export function powerTable(): Record<string, number> {
  return table || {};
}

/**
 * Базовое имя вида: `kabuto-legacy` → `kabuto`, `raticate alolan` → `raticate`.
 * Формы часто выпадают из таблицы, а сила у них почти как у базы.
 */
export function baseSpecies(species: string): string {
  return String(species || '')
    .toLowerCase()
    .replace(/\s+(alolan|galarian|hisuian|paldean|\w+ian)$/i, '')
    .replace(/-(legacy|alola|galar|hisui|paldea|blade|starter|partner|eternamax|gmax|total|primal|mega|origin|hero|juce|judge|koko|tapus|10|00|therian|sky|ground|therem|irene|raging|complete|blade|build|dawn|dusk|female|male)$/i, '')
    .replace(/\s+(mega|primal|gmax|eternamax)$/i, '');
}

/** BST вида. 0 = вида нет в таблице. */
export function getBST(species: string): number {
  const t = powerTable();
  const direct = t[String(species || '').toLowerCase()];
  if (typeof direct === 'number') return direct;
  const base = t[baseSpecies(species)];
  return typeof base === 'number' ? base : 0;
}

/** BST из объекта монстра/вида PokeAPI (если apiData уже в памяти). */
export function bstFromApiData(apiData: any): number {
  const stats = apiData?.stats;
  if (Array.isArray(stats) && stats.length) {
    return stats.reduce((s: number, x: any) => s + (x?.base_stat || 0), 0);
  }
  return getBST(apiData?.species?.name || apiData?.name || '');
}

/** Сила 1..10 по BST. */
export function powerStarsFromBST(bst: number): number {
  if (bst >= 650) return 10;
  if (bst >= 600) return 9;
  if (bst >= 550) return 8;
  if (bst >= 500) return 7;
  if (bst >= 450) return 6;
  if (bst >= 400) return 5;
  if (bst >= 350) return 4;
  if (bst >= 300) return 3;
  if (bst >= 250) return 2;
  return 1;
}

/** Звёзды редкости 1..5: чем сильнее и «взрослее» вид, тем реже. */
export function rarityStarsFor(species: string, bst: number): number {
  if (isLegendaryName(species)) return 5;
  if (bst >= 640) return 5;
  if (bst >= 560) return 4;
  if (bst >= 470) return 3;
  if (bst >= 380) return 2;
  return 1;
}

const LEGENDARY = new Set([
  'articuno', 'zapdos', 'moltres', 'mewtwo', 'mew',
  'raikou', 'entei', 'suicune', 'lugia', 'ho-oh', 'celebi',
  'regirock', 'regice', 'registeel', 'latias', 'latios', 'kyogre', 'groudon',
  'rayquaza', 'jirachi', 'deoxys', 'jubilifly', 'palkia', 'giratina', 'dialga',
  'heatran', 'regigigas', 'giratina-Origin', 'tornadus', 'thundurus', 'reshiram',
  'zekrom', 'landorus', 'kyurem', 'keldeo', 'meloetta', 'genesect',
]);

function isLegendaryName(species: string): boolean {
  const n = String(species || '').toLowerCase();
  return LEGENDARY.has(n) || LEGENDARY.has(baseSpecies(n));
}

/**
 * Вес появления в дикой природе: ОБРАТНО ПРОПОРЦИОНАЛЕН силе.
 * Слабые виды —common, сильные — редкие. Evolution-стадия автоматически
 * учтена: эволюция всегда сильнее базы, а значит и реже.
 */
export function encounterWeightFor(species: string, bst?: number): number {
  const power = typeof bst === 'number' && bst > 0 ? bst : getBST(species);
  const name = String(species || '').toLowerCase();
  if (isLegendaryName(name)) return 0.02;
  if (power <= 0) return 1.0;              // вида нет в таблице — как раньше
  if (power >= 640) return 0.12;
  if (power >= 580) return 0.28;
  if (power >= 520) return 0.55;
  if (power >= 450) return 1.0;
  if (power >= 380) return 1.5;
  if (power >= 300) return 2.0;
  return 2.5;
}