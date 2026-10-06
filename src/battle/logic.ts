// ─────────────────────────────────────────────────────────────
// logic.ts — ЧИСТЫЕ ФУНКЦИИ БОЯ (Pure Functions)
// ─────────────────────────────────────────────────────────────
// Этот файл НЕ ИМЕЕТ САЙД-ЭФФЕКТОВ:
//   - Нет обращений к DOM
//   - Нет изменений глобального состояния
//   - Нет вызовов localStorage, fetch, setTimeout
//   - Все функции получают данные через параметры и возвращают результат
//
// Это позволяет:
//   - Легко тестировать (чистые функции)
//   - Переиспользовать в core.ts и тестах
//   - Переиспользовать в AI (ai.ts)
//
// Содержит:
//   TYPE_CHART — таблица типов (×2, ×0.5, ×0)
//   calculateStat — расчёт характеристики (IV → EV → Nature → Stages → Items)
//   calculateDamage — полный расчёт урона (STAB, Type, Weather, Crit, Held Items)
//   checkAccuracy — проверка попадания (на основе move.accuracy)
//   isStatusImmune — проверка иммунитета к статусам (по типу или способности)
//   checkSuckerPunchFail — проверка провала Sucker Punch
//   checkSturdy — проверка Sturdy (выживание с 1 HP)
//   и другие утилиты для статусов
//
// ЗАВИСИМОСТИ: weather.js (getWeatherMultiplier)
// ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// TYPE_CHART — таблица совместимости типов (атакующий → защищающийся)
// ═══════════════════════════════════════════════════════════════
// Значения: 2 = суперэффективно, 0.5 = малоэффективно, 0 = не действует
// Отсутствующие комбинации = 1 (нейтрально)
//
// Формат: { атакующий_тип: { защищающийся_тип: множитель, ... }, ... }
//
// ИСПОЛЬЗУЕТСЯ В: getTypeMultiplier() — для расчёта множителя урона
// ─────────────────────────────────────────────────────────────
export const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

/** Список всех типов погоды (для цикла/проверок) */
export const WEATHERS = ['clear', 'rain', 'sun', 'sandstorm', 'hail'];

export function getTypeMultiplier(attackType, defenderTypes) {
  if (!TYPE_CHART[attackType]) return 1;
  let multiplier = 1;
  defenderTypes.forEach(typeObj => {
    const defType = typeof typeObj === 'string' ? typeObj : typeObj.type?.name;
    if (TYPE_CHART[attackType][defType] !== undefined) {
      multiplier *= TYPE_CHART[attackType][defType];
    }
  });
  return multiplier;
}

import { getWeatherMultiplier } from '../data/weather.js';
import { calculateStat as calculateStatShared } from './stats.js';
export { getWeatherMultiplier };

/**
 * @param {object} pokemon - has .stats (wild) or .apiData.stats (player), .ivs/, .evs/, .natureIdx
 * @param {string} statName - 'hp'|'attack'|'defense'|'special-attack'|'special-defense'|'speed'
 * @param {object} opts - { isWild, level, ivs, evs, natures }
 *
 * Реализация вынесена в battle/stats.ts: эта же формула считалась ещё в
 * battle/core.ts и ui/inventory.ts, и из-за расхождений профиль показывал статы,
 * отличные от боевых. Здесь оставлена обёртка ради обратной совместимости.
 */
export function calculateStat(pokemon, statName, opts: Record<string, any> = {}) {
  return calculateStatShared(pokemon, statName, opts);
}

export function getAbilityName(pokemon, isWild) {
  if (isWild) return pokemon.abilities?.[0]?.ability?.name || null;
  return pokemon.abilityName || null;
}

export function getStatusIcon(status) {
  const icons = { psn: '☠️', brn: '🔥', par: '⚡', slp: '💤', frz: '❄️' };
  return icons[status] || '';
}

export const STATUS_NAMES = { psn: 'Отравление', tox: 'Токсин', brn: 'Ожог', par: 'Паралич', slp: 'Сон', frz: 'Заморозка' };

/**
 * Apply status to target. Returns false if already has a status.
 */
export function applyStatusEffect(target, statusType) {
  if (target.status) return false;
  target.status = statusType;
  if (statusType === 'slp') {
    target.sleepTurns = Math.floor(Math.random() * 3) + 1;
  }
  // Счётчики длительности обнуляются при наложении: заморозка считается ходы
  // до предохранителя, токсин — сколько раз уже тикнул.
  target.freezeTurns = 0;
  target.toxCounter = 0;
  return true;
}

export function cureStatus(target) {
  target.status = null;
  target.sleepTurns = 0;
  target.freezeTurns = 0;
  target.toxCounter = 0;
}

/**
 * Check if target can act based on status.
 * @returns {{ canAct: boolean, message: string|null }}
 */
export function checkStatusTurn(target) {
  if (!target.status) return { canAct: true, message: null };

  if (target.status === 'slp') {
    target.sleepTurns--;
    if (target.sleepTurns <= 0) {
      target.status = null;
      target.sleepTurns = 0;
      return { canAct: true, message: 'проснулся!' };
    }
    return { canAct: false, message: 'спит...' };
  }

  if (target.status === 'frz') {
    // Предохранитель из спецификации: максимум 3 хода, дальше оттаивает
    // гарантированно. Без него заморозка с шансом 20% могла держаться весь бой.
    target.freezeTurns = (target.freezeTurns || 0) + 1;
    if (Math.random() < 0.2 || target.freezeTurns >= 3) {
      target.status = null;
      target.freezeTurns = 0;
      return { canAct: true, message: 'оттаял!' };
    }
    return { canAct: false, message: 'заморожен!' };
  }

  if (target.status === 'par') {
    if (Math.random() < 0.25) {
      return { canAct: false, message: 'парализован!' };
    }
    return { canAct: true, message: null };
  }

  return { canAct: true, message: null };
}

/**
 * Apply end-of-turn status damage. Returns { damage }.
 */
export function applyStatusEndOfTurn(target, maxHp) {
  if (!target.status) return { damage: 0 };

  if (target.status === 'psn') {
    const dmg = Math.max(1, Math.floor(maxHp / 8));
    return { damage: dmg };
  }

  if (target.status === 'brn') {
    const dmg = Math.max(1, Math.floor(maxHp / 16));
    return { damage: dmg };
  }

  // Токсин: растущий урон 1/16, 2/16, 3/16… за каждый тик.
  // Счётчик хранится на самом объекте (toxCounter). Урон 0 не возвращаем
  // (вызов бессмысленный), но для единообразия с psn/brn считаем от 1.
  if (target.status === 'tox') {
    const c = target.toxCounter || 1;
    const dmg = Math.max(1, Math.floor(maxHp * c / 16));
    return { damage: dmg };
  }

  return { damage: 0 };
}

/**
 * Pure stat stage modification. Returns new stages object.
 */
export function statStageModify(stages, stat, delta) {
  const s = { ...stages };
  s[stat] = Math.max(-6, Math.min(6, (s[stat] || 0) + delta));
  return s;
}

/**
 * Check accuracy of a move. Returns { hit: bool, message: string|null }.
 * move.accuracy from PokeAPI: null = never misses, number = percentage.
 * Always-hitting moves: accuracy is null, or the move has "guaranteed" meta.
 */
export function checkAccuracy(move) {
  // null accuracy = never misses (e.g. Swift, Aerial Ace, Shock Wave)
  if (move.accuracy == null) return { hit: true, message: null };
  const acc = Number(move.accuracy);
  if (isNaN(acc) || acc >= 100) return { hit: true, message: null };
  if (Math.random() * 100 < acc) return { hit: true, message: null };
  return { hit: false, message: 'Атака промахнулась!' };
}

/**
 * Check type immunity for status ailments.
 * @param {string} ailment - move ailment name (paralysis, poison, burn, sleep, freeze, etc.)
 * @param {object} target - has .types[] and optionally .abilities[]
 * @param {boolean} checkAbilities - whether to check ability immunities
 */
export function isStatusImmune(ailment, target, checkAbilities = true) {
  if (!target) return false;

  const types = (target.types || []).map(t => (typeof t === 'string' ? t : t.type?.name));
  const abil = target.abilities?.[0]?.ability?.name || target.abilityName || null;

  // Type immunities
  if (ailment === 'paralysis' && types.includes('ground')) return true;
  if (ailment === 'poison' && (types.includes('steel') || types.includes('poison'))) return true;
  if (ailment === 'burn' && types.includes('fire')) return true;
  if (ailment === 'freeze' && types.includes('ice')) return true;

  // Ability immunities
  if (checkAbilities && abil) {
    if (ailment === 'paralysis' && abil === 'limber') return true;
    if ((ailment === 'sleep' || ailment === 'yawn') && (abil === 'insomnia' || abil === 'vital-spirit')) return true;
    if (ailment === 'poison' && (abil === 'immunity' || abil === 'comatose')) return true;
    if (ailment === 'burn' && abil === 'water-veil') return true;
    if (ailment === 'freeze' && abil === 'magma-armor') return true;
  }

  return false;
}

/**
 * Pure damage calculation. Returns { damage, isCrit, messageParts[] }.
 * Does NOT mutate anything.
 */
export function calculateDamage({
  move,                // PokeAPI move data
  attacker,            // pokemon-like obj with apiData.stats / .stats
  defender,            // pokemon-like obj with apiData.stats / .stats
  attackerLevel = 50,
  defenderLevel = 50,
  isWildAttacker = false,
  isWildDefender = false,
  weather = 'clear',
  attackerStatStages = null,
  defenderStatStages = null,
  attackerHeldItem = null,
  defenderHeldItem = null,
  defenderAbilityName = null,
  attackerAbilityName = null,
  naturesList = [],
alwaysCrit = false,
    critRateStage = 0,  // 0 = 6.25%, 1 = 12.5% (Slash, Stone Edge), 2 = 25%, 3 = 33%, 4+ = 50%
    // Текущее HP защитника. Передаётся отдельно, потому что у дикого покемона HP
    // живёт в S.wildCurHP и в объекте покемона не синхронизировано — без этого
    // Super Fang и OHKO считали бы урон по мусору.
    defenderCurrentHp = undefined,
  }) {
  const parts = [];
  const power = move.power;

  // Атаки с фиксированным уроном ─
  // Seismic Toss (урон = уровень атакующего), Night Shade и Sonic Boom (20),
  // Dragon Rage (40). У них power === null, и раньше calculateDamage возвращал
  // 0 — то есть атака попадала в «ничего не произошло» и не наносила урона вовсе.
  // Super Fang — половина текущего HP цели, считается отдельно.
  const targetHp = defenderCurrentHp !== undefined ? defenderCurrentHp : defender?.currentHp;
  const fixed = move.meta?.damage;
  if (fixed !== undefined && fixed !== null && !power) {
    if (fixed === 0) {
      // Super Fang: meta.damage === 0, урон равен половине текущего HP цели
      const dmg = Math.max(1, Math.floor((targetHp || 1) / 2));
      parts.push(`Фиксированный урон ${dmg}`);
      return { damage: dmg, isCrit: false, messageParts: parts, isFixed: true };
    }
    const dmg = Math.max(1, Math.floor(fixed));
    parts.push(`Фиксированный урон ${dmg}`);
    return { damage: dmg, isCrit: false, messageParts: parts, isFixed: true };
  }

  if (!power) return { damage: 0, isCrit: false, messageParts: [] };

  // Атаки мгновенного убийства ─
  // Fissure, Horn Drill, Guillotine, Sheer Cold: meta.ohko === true. Раньше они
  // считались обычной атакой без power, то есть тоже ничего не делали.
  if (move.meta?.ohko) {
    if (defenderAbilityName === 'battle-armor' || defenderAbilityName === 'shell-armor') {
      parts.push(`${defender?.name || 'Противник'} защищён бронёй`);
      return { damage: 0, isCrit: false, messageParts: parts, ohkoBlocked: true };
    }
    if (typeof targetHp === 'number' && targetHp > 0) {
      parts.push('Мгновенное убийство');
      return { damage: targetHp, isCrit: false, messageParts: parts, isOHKO: true };
    }
  }

  const isPhysical = move.damage_class?.name === 'physical';
  const attackStatName = isPhysical ? 'attack' : 'special-attack';
  const defenseStatName = isPhysical ? 'defense' : 'special-defense';

  // Build temp pokemon objects for stat calc
  const attackerPkm = {
    ...attacker,
    statStages: attackerStatStages || attacker.statStages || null,
    heldItem: attackerHeldItem || attacker.heldItem || null,
  };
  const defenderPkm = {
    ...defender,
    statStages: defenderStatStages || defender.statStages || null,
    heldItem: defenderHeldItem || defender.heldItem || null,
  };

  const A = calculateStat(attackerPkm, attackStatName, {
    isWild: isWildAttacker,
    level: attackerLevel,
    natures: naturesList,
  });
  const D = calculateStat(defenderPkm, defenseStatName, {
    isWild: isWildDefender,
    level: defenderLevel,
    natures: naturesList,
  });

  // Ожог НЕ снижает физическую атаку — решение из спецификации: ожог только
  // наносит урон 1/16 после действия владельца. Раньше здесь стоял множитель
  // 0.5, из-за чего ожог был и уроном, и дебаффом одновременно.
  let baseDmg = Math.floor((((2 * attackerLevel / 5 + 2) * power * (A / D)) / 50) + 2);

  // STAB
  let stab = 1.0;
  const atkTypes = attacker.apiData?.types || attacker.types || [];
  atkTypes.forEach(t => {
    const tn = t.type?.name || t;
    if (tn === move.type?.name) stab = 1.5;
  });

  const typeMult = getTypeMultiplier(move.type?.name, defender.apiData?.types || defender.types || []);
  const weatherMult = getWeatherMultiplier(move.type?.name, weather);
  const randMod = 0.85 + Math.random() * 0.15;  // Всегда случайно, даже при гарантированном крите

  // Crit — таблица канона Gen VII+. Решение из спецификации: базовый шанс 1/24.
  // Раньше здесь стояла таблица Gen II–V с базой 1/16, то есть криты случались
  // в полтора раза чаще задуманного.
  const CRIT_RATES = [1 / 24, 1 / 8, 1 / 2, 1, 1];
  const critRate = alwaysCrit ? 1.0 : CRIT_RATES[Math.min(critRateStage, CRIT_RATES.length - 1)];
  const isCrit = Math.random() < critRate;
  const critMult = isCrit ? 1.5 : 1.0;

  // Crit ignores attacker's negative stages and defender's positive stages
  // Recalculate A/D without stat stages if crit lands
  if (isCrit) {
    const critAttackerPkm = { ...attackerPkm, statStages: null };
    const critDefenderPkm = { ...defenderPkm, statStages: null };
    const critA = calculateStat(critAttackerPkm, attackStatName, {
      isWild: isWildAttacker, level: attackerLevel, natures: naturesList,
    });
    const critD = calculateStat(critDefenderPkm, defenseStatName, {
      isWild: isWildDefender, level: defenderLevel, natures: naturesList,
    });
    baseDmg = Math.floor((((2 * attackerLevel / 5 + 2) * power * (critA / critD)) / 50) + 2);
  }

  // Air Balloon for defender (declare before held items due to Expert Belt check)
  let effectiveTypeMult = typeMult;
  if (defenderHeldItem === 'airBalloon' && move.type?.name === 'ground') effectiveTypeMult = 0;

  // Ability interactions with type effectiveness
  const moveType = move.type?.name;
  if (defenderAbilityName) {
    const defAbil = defenderAbilityName.toLowerCase().replace(/[^a-z0-9-]/g, '');
    // Immunities
    if (defAbil === 'levitate' && moveType === 'ground') effectiveTypeMult = 0;
    if (defAbil === 'flash-fire' && moveType === 'fire') effectiveTypeMult = 0;
    if (defAbil === 'water-absorb' && moveType === 'water') effectiveTypeMult = 0;
    if (defAbil === 'volt-absorb' && moveType === 'electric') effectiveTypeMult = 0;
    if (defAbil === 'dry-skin' && moveType === 'water') effectiveTypeMult = 0;
    if (defAbil === 'motor-drive' && moveType === 'electric') effectiveTypeMult = 0;
    if (defAbil === 'sap-sipper' && moveType === 'grass') effectiveTypeMult = 0;
    if (defAbil === 'storm-drain' && moveType === 'water') effectiveTypeMult = 0;
    if (defAbil === 'lightning-rod' && moveType === 'electric') effectiveTypeMult = 0;
    // Wonder Guard: only super-effective moves hit
    if (defAbil === 'wonder-guard' && effectiveTypeMult <= 1) effectiveTypeMult = 0;
    // Resistances
    if (defAbil === 'thick-fat' && (moveType === 'fire' || moveType === 'ice')) effectiveTypeMult *= 0.5;
    if (defAbil === 'dry-skin' && moveType === 'fire') effectiveTypeMult *= 1.25;
    if ((defAbil === 'filter' || defAbil === 'solid-rock') && effectiveTypeMult > 1) effectiveTypeMult *= 0.75;
  }
  // Guts: раньше давал 1.5x Atk сгоревшему покемону, компенсируя штраф ожога.
  // По решению из спецификации ожог больше не снижает атаку — поэтому и Guts
  // не нужен в текущей логике. Способность помечена к отдельной фазе реализации.
  // TODO(spec): перереализовать Guts, когда определится, даёт ли он +50% к
  // атаке для сгоревшего покемона (сверх несуществующего штрафа).
  // Sniper: 2.25x crit damage instead of 1.5x
  let sniperCritMult = critMult;
  if (attackerAbilityName && isCrit) {
    const atkAbil = attackerAbilityName.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (atkAbil === 'sniper') sniperCritMult = 2.25;
  }

  // Ability power modifier (Sheer Force 1.3x, Hustle 1.5x physical)
  let abilityMult = 1.0;
  if (attackerAbilityName) {
    const atkAbil = attackerAbilityName.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (atkAbil === 'sheer-force') {
      const hasSecondary = !!(move.meta?.ailment_chance || move.meta?.flinch_chance || move.meta?.stat_chance || (move.stat_changes?.length > 0));
      if (hasSecondary) abilityMult = 1.3;
    }
    if (atkAbil === 'hustle' && isPhysical) {
      abilityMult *= 1.5;
    }
  }

  // Held items
  let heldMult = 1.0;
  if (attackerHeldItem === 'expertBelt' && effectiveTypeMult > 1) heldMult = 1.2;
  if (attackerHeldItem === 'lifeOrb') heldMult = 1.3;

  let dmg = Math.floor(baseDmg * stab * effectiveTypeMult * weatherMult * randMod * sniperCritMult * heldMult * abilityMult);

  // Минимум 1 HP для не-иммунных атак (4x резист всё равно наносит 1)
  if (dmg <= 0 && effectiveTypeMult > 0) dmg = 1;
  else if (dmg < 0) dmg = 0;

  // Sucker Punch fail check (handled before calling this)

  const messages = [];
  if (isCrit) messages.push('Критический удар!');
  if (effectiveTypeMult > 1) messages.push('Суперэффективно!');
  else if (effectiveTypeMult < 1 && effectiveTypeMult > 0) messages.push('Малоэффективно...');
  else if (effectiveTypeMult === 0) messages.push('Атака не возымела эффекта...');

  return { damage: dmg, isCrit, messages };
}

/**
 * Check if Sucker Punch fails (opponent using status move).
 */
export function checkSuckerPunchFail(move, enemyChosenMove) {
  if (move.name !== 'sucker-punch') return false;
  if (!enemyChosenMove) return false; // no enemy move info = default to fail (conservative)
  // Sucker punch fails if opponent uses a non-damaging move
  if (!enemyChosenMove.power) return true;
  return false;
}

/**
 * Check Sturdy activation conditions.
 */
export function checkSturdy(abilityName, preHP, maxHP, currentHP) {
  if (abilityName !== 'sturdy') return false;
  // Sturdy only activates if at full HP and would be KO'd
  if (preHP !== maxHP) return false;
  if (currentHP !== 0) return false;
  return true;
}

/**
 * Get the move category string for UI purposes.
 */
export function getMoveCategory(move) {
  if (!move.damage_class?.name) return 'status';
  return move.damage_class.name; // 'physical' | 'special' | 'status'
}
