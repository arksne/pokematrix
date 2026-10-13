import { describe, it, expect } from 'vitest';
import { NATURE_CHANGE_PRICE, applyNatureChange, canAffordNatureChange, rollRandomNature } from '../nature-change.js';
import { TYPE_CANDY_TYPE, canEatTypeCandy, pickRandomCandies } from '../inventory.js';

/**
 * Стилист (смена характера за деньги) + типовые конфеты (18, по типам).
 * Решения хозяина: минты убраны, характер только у стилиста;
 * типовая конфета разбита по типам с гейтом.
 */
describe('стилист', () => {
  it('цена сеанса зафиксирована', () => {
    expect(NATURE_CHANGE_PRICE).toBe(1500000);
  });

  it('rollRandomNature: выпадает другой, в диапазоне', () => {
    for (let i = 0; i < 50; i++) {
      const idx = rollRandomNature(5, 25, Math.random);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(25);
      expect(idx).not.toBe(5);
    }
    // детерминированно: 0.0 при текущем 0 → сдвиг на 1
    expect(rollRandomNature(0, 25, () => 0)).toBe(1);
  });

  it('applyNatureChange: валидный новый индекс', () => {
    const mon: any = { natureIdx: 0 };
    expect(applyNatureChange(mon, 3, 25)).toBe(true);
    expect(mon.natureIdx).toBe(3);
  });

  it('applyNatureChange: мусор и повтор отклоняются', () => {
    expect(applyNatureChange({ natureIdx: 3 }, 3, 25)).toBe(false);
    expect(applyNatureChange({ natureIdx: 0 }, -1, 25)).toBe(false);
    expect(applyNatureChange({ natureIdx: 0 }, 25, 25)).toBe(false);
    expect(applyNatureChange({ natureIdx: 0 }, NaN, 25)).toBe(false);
    expect(applyNatureChange(null, 3, 25)).toBe(false);
  });

  it('canAffordNatureChange: порог', () => {
    expect(canAffordNatureChange(1500000)).toBe(true);
    expect(canAffordNatureChange(1499999)).toBe(false);
    expect(canAffordNatureChange(0)).toBe(false);
  });
});

describe('типовые конфеты', () => {
  it('ровно 18 типов, без дублей', () => {
    const vals = Object.values(TYPE_CANDY_TYPE);
    expect(Object.keys(TYPE_CANDY_TYPE)).toHaveLength(18);
    expect(new Set(vals).size).toBe(18);
  });

  it('гейт: своему типу можно, чужому нет', () => {
    const fireMon: any = { apiData: { types: [{ type: { name: 'fire' } }] } };
    expect(canEatTypeCandy(fireMon, 'fireCandy')).toBe(true);
    expect(canEatTypeCandy(fireMon, 'waterCandy')).toBe(false);
    const dual: any = { apiData: { types: [{ type: { name: 'water' } }, { type: { name: 'flying' } }] } };
    expect(canEatTypeCandy(dual, 'flyingCandy')).toBe(true);
    expect(canEatTypeCandy(dual, 'fireCandy')).toBe(false);
  });

  it('мусор: нет типов/нет конфеты', () => {
    expect(canEatTypeCandy({ apiData: {} }, 'fireCandy')).toBe(false);
    expect(canEatTypeCandy(null, 'fireCandy')).toBe(false);
    expect(canEatTypeCandy({ apiData: { types: [{ type: { name: 'fire' } }] } }, 'potion')).toBe(false);
  });

  it('pickRandomCandies: 10 штук, все из пула 18', () => {
    const pool = Object.keys(TYPE_CANDY_TYPE);
    const got = pickRandomCandies(10, () => 0.5);
    expect(got).toHaveLength(10);
    for (const id of got) expect(pool).toContain(id);
    // детерминированно: 0 → всегда первая
    expect(pickRandomCandies(3, () => 0)).toEqual([pool[0], pool[0], pool[0]]);
  });
});
