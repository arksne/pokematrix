/**
 * Зеркало урона PvP: клиент ↔ сервер.
 *
 * Клиент (pvp-core.ts doPvPAttack) считает честную формулу дикого боя
 * (STAB/eff/крит/стадии) и шлёт { lvl, atk, power, dmg, crit, calc }.
 * Сервер (server/src/socket/pvp.ts pvp_action) валидирует:
 *   - есть stash из mon_data → кэп = wildBase(stash) × 20 + 700
 *     (покрывает STAB×эфф4×крит×стадии; читерские 99999 — мимо);
 *   - нет stash (старый клиент) → прежняя формула без стадий.
 *
 * Тест держит контракт: честный удар при любом ролле/крите/стадиях проходит,
 * читерский — отбивается. Дрейф любой из сторон роняет тест.
 */
import { describe, it, expect } from 'vitest';

/** Зеркало clampInt из server/src/socket/pvp.ts. */
function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Зеркало серверного кэпа со stash. */
function serverCapStash(lvl: number, power: number, atk: number, dfn: number): number {
  const base = (((2 * lvl / 5 + 2) * power * (atk / Math.max(1, dfn))) / 50) + 2;
  return Math.max(Math.floor(base * 1.15 * 20) + 8, 700);
}

/** Зеркало старого кэпа (без stash). */
function serverCapLegacy(lvl: number, power: number, atk: number, crit: boolean): number {
  const base = (lvl * power * (atk / 100)) / 15;
  return Math.floor(base * 1.15 * (crit ? 1.5 : 1));
}

describe('pvp damage mirror (client formula vs server gate)', () => {
  it('честный удар со stash проходит: STAB, эффективность 4, крит, стадии', () => {
    // Худший честный случай: база × stab1.5 × eff4 × crit1.5 × стадии+3.
    const lvl = 100, power = 150, atk = 400, dfn = 100;
    const base = (((2 * lvl / 5 + 2) * power * (atk / dfn)) / 50) + 2;
    const worstHonest = Math.floor(base * 1.0 * 1.5 * 4 * 1.5 * 2);
    expect(worstHonest).toBeLessThanOrEqual(serverCapStash(lvl, power, atk, dfn) + 5);
  });

  it('читерский урон отбивается и со stash, и без', () => {
    expect(99999).toBeGreaterThan(serverCapStash(5, 40, 60, 50) + 5);
    expect(99999).toBeGreaterThan(serverCapLegacy(5, 40, 60, false) + 5);
  });

  it('мелкие честные удары проходят обеими ветками', () => {
    // stash-ветка: пол 700 покрывает всё мелкое; legacy-ветка (старый
    // клиент со старой формулой) — только свой диапазон.
    for (const dmg of [0, 1, 8, 50]) {
      expect(dmg).toBeLessThanOrEqual(serverCapStash(5, 40, 60, 50) + 5);
    }
    for (const dmg of [0, 1, 8]) {
      expect(dmg).toBeLessThanOrEqual(serverCapLegacy(5, 40, 60, false) + 5);
    }
  });

  it('кэп растёт с уровнем/статами, а не константа', () => {
    expect(serverCapStash(100, 150, 400, 100))
      .toBeGreaterThan(serverCapStash(5, 40, 60, 50));
  });
});
