import { describe, it, expect } from 'vitest';
import { NATURE_CHANGE_PRICE, applyNatureChange, canAffordNatureChange } from '../nature-change.js';
import { TYPE_CANDY_TYPE, canEatTypeCandy } from '../inventory.js';

/**
 * Стилист (смена характера за деньги) + типовые конфеты (18, по типам).
 * Решения хозяина: минты убраны, характер только у стилиста;
 * типовая конфета разбита по типам с гейтом.
 */
describe('стилист', () => {
  it('цена сеанса зафиксирована', () => {
    expect(NATURE_CHANGE_PRICE).toBe(100000);
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
    expect(canAffordNatureChange(100000)).toBe(true);
    expect(canAffordNatureChange(99999)).toBe(false);
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
});
