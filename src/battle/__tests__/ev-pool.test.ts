import { describe, it, expect } from 'vitest';
import { evBudget, evSpent, settleEVSpend, grantLevelUpEVs } from '../core.js';

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
  const evs = (o: Partial<Record<string, number>> = {}) => ({
    hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...o,
  });

  it('бюджет = потрачено + пул (конфеты/витамины лежат В ПУЛЕ)', () => {
    // D1: бюджет больше не складывает candiesEaten×4 поверх пула — иначе
    // редкая конфета давала +8 вместо +4.
    expect(evBudget({ evs: evs(), evPool: 5 })).toBe(5);
    expect(evBudget({ evs: evs({ atk: 10, spa: 4 }), evPool: 5 })).toBe(19);
  });

  it('потраченные EV входят в бюджет', () => {
    expect(evBudget({ evs: evs({ hp: 126 }), evPool: 0 })).toBe(126);
    expect(evSpent({ evs: evs({ hp: 10, atk: 6 }) })).toBe(16);
  });

  it('legacy evFromLevel учитывается', () => {
    expect(evBudget({ evs: evs(), evFromLevel: 10 })).toBe(10);
  });

  it('потолок 496', () => {
    expect(evBudget({ evs: evs({ atk: 200 }), evPool: 400 })).toBe(496);
  });

  it('пустого нет', () => {
    expect(evBudget(null)).toBe(0);
    expect(evBudget({})).toBe(0);
  });
});

describe('settleEVSpend', () => {
  const zeros = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  it('рост списывается из пула', () => {
    const r = settleEVSpend(zeros, { ...zeros, atk: 4 }, 10, false);
    expect(r.ok).toBe(true);
    expect(r.evs.atk).toBe(4);
    expect(r.pool).toBe(6);
  });

  it('не хватило пула → отказ и evs без изменений', () => {
    const old = { ...zeros, atk: 2 };
    const r = settleEVSpend(old, { ...zeros, atk: 100 }, 10, false);
    expect(r.ok).toBe(false);
    expect(r.evs.atk).toBe(2);
    expect(r.pool).toBe(10);
  });

  it('после лока нельзя забрать (значение ниже текущего игнорируется)', () => {
    const old = { ...zeros, atk: 30 };
    const r = settleEVSpend(old, { ...zeros, atk: 10, def: 5 }, 10, true);
    expect(r.ok).toBe(true);
    expect(r.evs.atk).toBe(30);  // не отняли
    expect(r.evs.def).toBe(5);   // добавить можно
    expect(r.pool).toBe(5);
  });

  it('до лока забрать можно, пул растёт', () => {
    const old = { ...zeros, atk: 30 };
    const r = settleEVSpend(old, { ...zeros, atk: 10 }, 10, false);
    expect(r.ok).toBe(true);
    expect(r.evs.atk).toBe(10);
    expect(r.pool).toBe(30);
  });

  it('клампит 126', () => {
    const r = settleEVSpend(zeros, { ...zeros, atk: 500 }, 1000, false);
    expect(r.evs.atk).toBe(126);
  });
});
