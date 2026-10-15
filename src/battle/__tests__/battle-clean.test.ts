import { describe, it, expect } from 'vitest';
import { clearMonBattleFlags, restoreMonAbility, isMonBattleClean } from '../special-moves.js';

/**
 * Жалоба 3: «способности перешли на новых диких» — закешированные
 * способности/статусы/волатильные переживали бой. Корни:
 *  - core.ts:resetBattleField не чистил S.enemyChosenMove и mon.saltCure;
 *  - mon.abilityName, сменённый в бою (skill-swap/worry-seed/mummy/trace),
 *    оставался в команде и уходил в следующий бой.
 * Фикс — clearMonBattleFlags + restoreMonAbility в resetBattleField.
 * Статусы/сон/стадии не трогаем (существующее поведение).
 */
describe('battle-clean — мон чист для нового боя', () => {
  it('clearMonBattleFlags сносит vol/ловушку/соль/заряды', () => {
    const mon: any = {
      vol: { confusion: 3, trapped: true, bindChip: true },
      trapped: true,
      saltCure: true,
      typeOverride: ['water'],
      stock: 2, rageHits: 3, payDayHits: 1, slowStartTurns: 2,
      lockedOn: true, recharging: true, flinch: true,
    };
    clearMonBattleFlags(mon);
    expect(mon.vol).toEqual({});
    expect(mon.trapped).toBe(false);
    expect(mon.saltCure).toBeNull();
    expect(mon.typeOverride).toBeNull();
    expect(mon.stock).toBe(0);
    expect(mon.rageHits).toBe(0);
    expect(isMonBattleClean(mon)).toBe(true);
  });

  it('null-мон — безопасно', () => {
    expect(clearMonBattleFlags(null)).toBeNull();
    expect(isMonBattleClean(null)).toBe(true);
  });

  it('restoreMonAbility возвращает способность из apiData', () => {
    const mon: any = {
      abilityName: 'mummy', // прилипла в бою
      apiData: { abilities: [{ ability: { name: 'overgrow' } }] },
    };
    restoreMonAbility(mon);
    expect(mon.abilityName).toBe('overgrow');
  });

  it('restoreMonAbility без apiData — не ломает', () => {
    const mon: any = { abilityName: 'mummy' };
    restoreMonAbility(mon);
    expect(mon.abilityName).toBe('mummy');
    expect(restoreMonAbility(null)).toBeNull();
  });

  it('isMonBattleClean ловит грязный vol', () => {
    expect(isMonBattleClean({ vol: { attract: true }, trapped: false })).toBe(false);
    expect(isMonBattleClean({ vol: {}, trapped: true })).toBe(false);
    expect(isMonBattleClean({ vol: {}, saltCure: true })).toBe(false);
    expect(isMonBattleClean({ vol: {} })).toBe(true);
  });
});
