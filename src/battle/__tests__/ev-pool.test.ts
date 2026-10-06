import { describe, it, expect } from 'vitest';
import { evBudget, grantLevelUpEVs } from '../core.js';

/**
 * EV-пул (спека 3.3/3.10): уровень даёт +2 в пул на ручное распределение,
 * +3 со скобой (evBrace). Автораскладки нет. Капы: 496 всего, витамины 100.
 */

describe('grantLevelUpEVs', () => {
  it('даёт +2 в пул без автораскладки', () => {
    const mon: any = { evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
    const r = grantLevelUpEVs(mon);
    expect(r).toMatchObject({ gain: 2, brace: false, total: 2 });
    expect(mon.evPool).toBe(2);
    expect(Object.values(mon.evs).every((v) => v === 0)).toBe(true);
  });

  it('со скобой даёт +3', () => {
    const mon: any = { heldItem: 'evBrace', evs: {} };
    const r = grantLevelUpEVs(mon);
    expect(r).toMatchObject({ gain: 3, brace: true, total: 3 });
    expect(mon.evPool).toBe(3);
  });

  it('пул копится', () => {
    const mon: any = { evPool: 4, evs: {} };
    grantLevelUpEVs(mon);
    expect(mon.evPool).toBe(6);
  });

  it('без покемона — null', () => {
    expect(grantLevelUpEVs(null)).toBeNull();
  });
});

describe('evBudget', () => {
  it('конфеты ×4 + витамины ×10 + пул', () => {
    expect(evBudget({ candiesEaten: 2, vitaminsEaten: 3, evPool: 5 })).toBe(2 * 4 + 3 * 10 + 5);
  });

  it('витамины capped на 100', () => {
    expect(evBudget({ candiesEaten: 0, vitaminsEaten: 50, evPool: 0 })).toBe(100);
  });

  it('потолок 496', () => {
    expect(evBudget({ candiesEaten: 99, vitaminsEaten: 99, evPool: 297 })).toBe(496);
  });

  it('legacy evFromLevel учитывается', () => {
    expect(evBudget({ candiesEaten: 0, vitaminsEaten: 0, evFromLevel: 10 })).toBe(10);
  });

  it('пустого нет', () => {
    expect(evBudget(null)).toBe(0);
    expect(evBudget({})).toBe(0);
  });
});
