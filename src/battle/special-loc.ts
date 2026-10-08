// ─────────────────────────────────────────────────────────────
// special-loc.ts — МЕХАНИКИ ОСОБЫХ ЛОКАЦИЙ (интервью M, п.4)
// ─────────────────────────────────────────────────────────────
// «Спец-локи расширить (свои механики)». Пещеры/башни/руины уже есть, но
// механика у них была одна на всех: поймал случайного зверька. Теперь у
// локации может быть `mechanic`, и он реально меняет игру:
//
//   tower — башня/руины: каждый новый заход (этаж) поднимает уровень врагов.
//           Выход наружу (в соседнюю локацию) сбрасывает этаж. Так башня
//           становится «пробой на силу», а не повторной фарм-комнатой.
//   dark  — тёмная пещера: в темноте врагов намного меньше, зато они сильнее.
//
// Файл чистый: логику считают и боевой цикл, и тесты.
// ─────────────────────────────────────────────────────────────

export type SpecialKind = 'tower' | 'dark';

export interface SpecialMechanic {
  kind: SpecialKind;
  /** Сколько этажей у башни (для показа в UI/логе). */
  floors?: number;
  /** На сколько уровней растёт враг за каждый подъём. */
  perFloorLvl?: number;
  /** Множитель шанса встречи в темноте (0.3 = втрое реже). */
  darkRate?: number;
}

/** Значения по умолчанию, если поля не заданы явно. */
export const TOWER_PER_FLOOR = 3;
export const DARK_RATE = 0.3;

/** Механика локации (или null у обычных локаций). */
export function specialMechanic(loc: any): SpecialMechanic | null {
  const m = loc?.mechanic;
  if (!m || (m.kind !== 'tower' && m.kind !== 'dark')) return null;
  return m as SpecialMechanic;
}

/**
 * Уровень дикого с учётом этажа башни. Факел/свет не нужен — правило одно:
 * каждый подъём = +perFloorLvl к потолку уровня.
 */
export function towerLevel(baseLevel: number, floor: number, perFloor = TOWER_PER_FLOOR): number {
  const f = Math.max(0, Math.floor(floor || 0));
  return baseLevel + f * Math.max(0, perFloor);
}

/** Потолок башни: за её пределами враги не бесконечные. */
export function towerCap(baseMax: number, mechanic?: SpecialMechanic | null): number {
  if (!mechanic || mechanic.kind !== 'tower') return baseMax;
  const floors = Math.max(1, mechanic.floors || 10);
  const per = Math.max(0, mechanic.perFloorLvl ?? TOWER_PER_FLOOR);
  return baseMax + (floors - 1) * per;
}

/** Шанс встречи с учётом темноты. */
export function encounterRateFor(rate: number, mechanic: SpecialMechanic | null, isDaytime: boolean): number {
  if (!mechanic || mechanic.kind !== 'dark' || isDaytime) return rate;
  return rate * (mechanic.darkRate ?? DARK_RATE);
}

/**
 * Новый этаж при входе в башню. Возвращает 1, если заходим впервые за этот
 * визит (то есть сменили локацию), иначе ничего не меняет.
 */
export function nextFloor(currentLocId: string | null, targetLocId: string, mechanic: SpecialMechanic | null): number {
  if (!mechanic || mechanic.kind !== 'tower') return 0;
  // В ту же башню, что и сейчас — этаж прежний (перерисовка/открытие меню).
  return currentLocId === targetLocId ? 0 : 1;
}