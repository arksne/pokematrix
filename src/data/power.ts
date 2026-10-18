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
    // «raticate alolan» → «raticate»
    .replace(/\s+(alolan|galarian|hisuian|paldean)$/, '')
    // «kabuto-legacy», «giratina-altered», «deoxys-normal» → база
    .replace(/-(legacy|alola|galar|hisui|paldea|altered|origin|hero|gmax|total|primal|mega|blade|starter|partner|eternamax|therian|sky|ground|therem|irene|raging|complete|build|dawn|dusk|female|male|normal|attack|defense|speed)$/, '')
    // «nidoran-f» / «deoxys-form-1» → хвост-индекс
    .replace(/-\d+$/, '')
    .replace(/\s+(mega|primal|gmax|eternamax)$/, '');
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
 * ═══════════════════════════════════════════════════════════════════════
 * ЭВОЛЮЦИИ ПО УРОВНЮ — канон лиги (public/pokemon_evo.json)
 * ═══════════════════════════════════════════════════════════════════════
 * Зачем: уровень эволюции брался из PokeAPI `evolution_details`, где
 * `min_level` зависит от версии игры и иногда приходит null. null означает
 * «эвлюция на ЛЮБОМ уровне» (levelDetailMet пропускает проверку), из-за чего
 * дикий покемон эволюционировал сразу при поимке на чужом уровне, а уровень,
 * показанный в покедексе, не совпадал с тем, который проверял бой.
 *
 * Таблица собрана из канона лиги (tools/data-league17/build_evo.py):
 * 319 переходов, уровни 7..64.
 */

let evoTable: Record<string, Array<{ to: string; level: number }>> | null = null;

export async function loadEvoTable(): Promise<void> {
  if (evoTable) return;
  try {
    const base = (import.meta as any).env?.BASE_URL || '/';
    const res = await fetch(`${base}pokemon_evo.json`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    evoTable = await res.json();
  } catch (e) {
    console.warn('[power] не удалось загрузить pokemon_evo.json:', e);
    evoTable = {};
  }
}

export function setEvoTable(t: Record<string, Array<{ to: string; level: number }>>): void {
  evoTable = t;
}

export function evoTableData(): Record<string, Array<{ to: string; level: number }>> {
  return evoTable || {};
}

/**
 * Канонный уровень эволюции вида → конкретного потомка.
 * null = в каноне не задан (камень/трейд/другое условие) — тогда решает
 * PokeAPI-деталь, как и раньше.
 */
export function evolutionLevelFor(species: string, target: string): number | null {
  const edges = evoTableData()[String(species || '').toLowerCase()];
  if (!edges) return null;
  const hit = edges.find((e) => e.to === String(target || '').toLowerCase());
  return hit ? hit.level : null;
}

/** Все уровневые эволюции вида: [{to, level}]. */
export function levelEvolutionsFor(species: string): Array<{ to: string; level: number }> {
  return evoTableData()[String(species || '').toLowerCase()] || [];
}

/**
 * Вес появления в дикой природе: ОБРАТНО ПРОПОРЦИОНАЛЕН силе.
 * Слабые виды — common, сильные — редкие. Evolution-стадия автоматически
 * учтена: эволюция всегда сильнее базы, а значит и реже.
 */
export function encounterWeightFor(species: string, bst?: number): number {
  const power = typeof bst === 'number' && bst > 0 ? bst : getBST(species);
  const name = String(species || '').toLowerCase();
  if (isLegendaryName(name)) return 0.02;
  if (power <= 0) return 0.5;               // вида нет в таблице — НЕ «обычный»
  if (power >= 640) return 0.08;
  if (power >= 580) return 0.20;
  if (power >= 520) return 0.40;
  if (power >= 470) return 0.75;
  if (power >= 400) return 1.3;
  if (power >= 330) return 1.9;
  if (power >= 260) return 2.4;
  return 2.8;
}