import { describe, it, expect } from 'vitest';
import { effectiveEncounterRate, tickEncounterCounters } from '../encounter.js';

/**
 * Репелленты / приманки / флейты: шанс встречи и расход зарядов.
 * Чистые функции со подменным стейтом (без DOM).
 */
describe('effectiveEncounterRate', () => {
  it('без расходников — как было', () => {
    expect(effectiveEncounterRate(0.2, {})).toBe(0.2);
  });

  it('репеллент глушит в ноль', () => {
    expect(effectiveEncounterRate(0.2, { repelHunts: 5 })).toBe(0);
    expect(effectiveEncounterRate(1, { repelHunts: 1 })).toBe(0);
  });

  it('приманка умножает, кап 1', () => {
    expect(effectiveEncounterRate(0.2, { lureHunts: 10, lureMult: 2 })).toBeCloseTo(0.4);
    expect(effectiveEncounterRate(0.5, { lureHunts: 10, lureMult: 3 })).toBe(1);
  });

  it('репеллент бьёт приманку', () => {
    expect(effectiveEncounterRate(0.2, { repelHunts: 3, lureHunts: 10, lureMult: 3 })).toBe(0);
  });
});

describe('tickEncounterCounters', () => {
  it('репеллент тикает первым', () => {
    const st: any = { repelHunts: 2, lureHunts: 5, lureMult: 2 };
    tickEncounterCounters(st);
    expect(st.repelHunts).toBe(1);
    expect(st.lureHunts).toBe(5);
  });

  it('приманка тикает и сбрасывает множитель в конце', () => {
    const st: any = { lureHunts: 1, lureMult: 3 };
    tickEncounterCounters(st);
    expect(st.lureHunts).toBe(0);
    expect(st.lureMult).toBe(1);
  });

  it('пусто — ничего не ломается', () => {
    const st: any = {};
    tickEncounterCounters(st);
    expect(st.repelHunts || 0).toBe(0);
  });
});
