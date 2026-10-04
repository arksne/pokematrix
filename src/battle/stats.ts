/**
 * Единый расчёт характеристик покемона.
 *
 * Раньше формула была продублирована в четырёх местах:
 *   src/battle/logic.ts       — боевой урон (calculateStat)
 *   src/battle/core.ts        — HP и скорость диких, HP левелапа, скорость побега
 *   src/ui/inventory.ts       — то, что игрок видит в профиле
 *   src/battle/pvp-core.ts    — упрощённая формула для PvP
 *
 * Из-за расхождений профиль показывал статы, отличные от боевых: например
 * 39.6 % для Gyarados с тренировкой, потому что бой тренировку не учитывал,
 * а профиль учитывал. Тренировка вообще нигде не применялась — applyTraining()
 * упоминался только в комментарии src/data/training.ts.
 *
 * Теперь все места считают одинаково и тренировка реально работает.
 */
import { natures } from '../data/natures.js';
import { trainingStages } from '../data/training.js';

/** PokeAPI-имя стата -> короткое имя в сейве. */
export const STAT_MAP = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
} as const;

export const STAT_NAMES = Object.keys(STAT_MAP) as (keyof typeof STAT_MAP)[];

/**
 * Процент бонуса от тренировки для конкретного покемона и стата.
 * Учитывает и стадию (trainingStage), и выбранный стат (trainingStat).
 */
export function trainingPercent(pokemon: any, shortStat: string): number {
  const stage = pokemon?.trainingStage ?? 0;
  const entry = trainingStages[stage];
  if (!entry || !pokemon?.trainingStat) return 0;
  if (pokemon.trainingStat !== shortStat) return 0;
  return (entry.pct || 0) / 100;
}

/** Множитель природы для короткого имени стата. */
export function natureModifier(
  natureIdx: number | undefined,
  shortStat: string,
  naturesOverride?: any[],
): number {
  if (natureIdx === undefined || natureIdx === null) return 1;
  const list = Array.isArray(naturesOverride) && naturesOverride.length ? naturesOverride : natures;
  const nature = list[natureIdx];
  if (!nature) return 1;
  if (nature.buff === shortStat) return 1.1;
  if (nature.nerf === shortStat) return 0.9;
  return 1;
}

/** Множитель стадии (Swords Dance, Growl и т.п.). */
export function stageMultiplier(stage: number): number {
  if (!stage) return 1;
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

interface StatOptions {
  isWild?: boolean;
  level?: number;
  ivs?: Record<string, any>;
  evs?: Record<string, any>;
  /** Переопределение таблицы природ (используется в тестах). */
  natures?: any[];
  /** Отключить бонусы, которые видны только в бою (предмет, стадия). */
  ignoreBattleOnly?: boolean;
}

/**
 * Считает характеристику покемона.
 *
 * @param pokemon  покемон; у дикого базовые статы лежат в .stats,
 *                 у своего покемона — в .apiData.stats
 * @param statName имя стата в терминах PokeAPI ('hp' | 'attack' | ...)
 * @param opts     isWild, level, ivs, evs, ignoreBattleOnly
 */
export function calculateStat(pokemon: any, statName: string, opts: StatOptions = {}): number {
  const isWild = opts.isWild || false;
  const baseStats = isWild ? pokemon?.stats : pokemon?.apiData?.stats;
  const statObj = Array.isArray(baseStats)
    ? baseStats.find((s: any) => s?.stat?.name === statName)
    : undefined;
  const base = statObj ? statObj.base_stat : 50;

  const level = opts.level ?? (isWild ? 50 : (pokemon?.baseLevel ?? 1) + (pokemon?.candiesEaten || 0));
  const short = (STAT_MAP as any)[statName] || 'hp';

  const iv = isWild
    ? (pokemon?.wildIVs?.[short] ?? opts.ivs?.[short] ?? 15)
    : (opts.ivs?.[short] ?? pokemon?.ivs?.[short] ?? 15);
  const ev = isWild ? 0 : (opts.evs?.[short] ?? pokemon?.evs?.[short] ?? 0);

  let result: number;
  if (statName === 'hp') {
    result = Math.floor(0.01 * (2 * base + iv + Math.floor(0.25 * ev)) * level) + level + 10;
  } else {
    const natureMod = isWild ? 1 : natureModifier(pokemon?.natureIdx, short, opts.natures);
    result = Math.floor((Math.floor((2 * base + iv + Math.floor(0.25 * ev)) * level / 100) + 5) * natureMod);
    // Тренировка: единственный источник этого бонуса, применяется везде,
    // где считается стат, — и в бою, и в профиле.
    result = Math.floor(result * (1 + trainingPercent(pokemon, short)));
  }

  // Показанные в бою стадии (Swords Dance, Growl и т.п.)
  if (!opts.ignoreBattleOnly && pokemon?.statStages && statName !== 'hp') {
    const stage = pokemon.statStages[short];
    if (stage) result = Math.floor(result * stageMultiplier(stage));
  }

  // Предметы и способности, влияющие на статы
  if (!opts.ignoreBattleOnly && !isWild && pokemon?.heldItem) {
    const item = pokemon.heldItem;
    const choiceMap: Record<string, string> = {
      choiceBand: 'attack',
      choiceScarf: 'speed',
      choiceSpecs: 'special-attack',
    };
    if (choiceMap[item] === statName) result = Math.floor(result * 1.5);
    if (item === 'thickClub' && statName === 'attack') {
      const species = pokemon.apiData?.species?.name || pokemon.apiData?.name || '';
      if (species === 'cubone' || species === 'marowak') result = Math.floor(result * 2);
    }
    if (item === 'eviolite' && (statName === 'defense' || statName === 'special-defense')) {
      if (pokemon.apiData?.species?.url) result = Math.floor(result * 1.5);
    }
    if (item === 'assaultVest' && statName === 'special-defense') {
      result = Math.floor(result * 1.5);
    }
  }

  return Math.max(1, result);
}

/** Сумма базовых статов (для звёзд редкости и BST). */
export function baseStatTotal(pokemon: any): number {
  const stats = pokemon?.apiData?.stats;
  if (!Array.isArray(stats)) return 0;
  return stats.reduce((sum: number, s: any) => sum + (s?.base_stat || 0), 0);
}
