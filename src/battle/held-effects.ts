/**
 * Эффекты боевых предметов, которые держат покемоны.
 *
 * Зачем отдельный модуль: часть таких предметов продавалась в магазинах за
 * ¥4000, но код про них ничего не знал — они лежали мёртвым грузом в рюкзаке.
 * Аудит нашёл три: brightPowder (уклонение), absorbBulb (+1 Спец. атака от
 * воды), adrenalineOrb (+1 скорость от Intimidate). Здесь чистые правила,
 * которые можно проверить юнит-тестами; battle/core.ts только применяет их.
 */

/** Bright Powder: уклонение владельца выше на 1/9 → точность атакующего ×0.9. */
export const BRIGHT_POWDER_ACCURACY_MOD = 0.9;

/** Множитель точности атакующего с учётом предмета защитника. */
export function accuracyModForDefenderHeldItem(heldItem?: string | null): number {
  return String(heldItem || '') === 'brightPowder' ? BRIGHT_POWDER_ACCURACY_MOD : 1;
}

/** Изменение статов, которое предмет даёт в ответ на событие боя. */
export interface HeldItemStatBoost {
  /** Какой стат поднимаем. */
  stat: 'atk' | 'def' | 'spa' | 'spd' | 'spe';
  /** На сколько стадий. */
  delta: number;
  /** Предмет расходуется после срабатывания. */
  consume: boolean;
  /** Строка в лог боя. */
  message: string;
}

/**
 * Absorb Bulb: получил урон водой → +1 Спец. атака, предмет расходуется.
 * Возвращает null, если предмет не подходит или урон не водный.
 */
export function onWaterDamage(heldItem?: string | null, moveType?: string | null): HeldItemStatBoost | null {
  if (String(heldItem || '') !== 'absorbBulb') return null;
  if (String(moveType || '').toLowerCase() !== 'water') return null;
  return { stat: 'spa', delta: 1, consume: true, message: 'впитывает влагу — Спец. атака +1!' };
}

/**
 * Adrenaline Orb: испуг от Intimidate → +1 скорость, предмет расходуется.
 */
export function onIntimidated(heldItem?: string | null): HeldItemStatBoost | null {
  if (String(heldItem || '') !== 'adrenalineOrb') return null;
  return { stat: 'spe', delta: 1, consume: true, message: 'ускоряется от адреналина — Скорость +1!' };
}
