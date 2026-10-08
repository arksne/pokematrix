import { describe, it, expect, beforeEach } from 'vitest';
import {
  HEAL_PRICE,
  teamNeedsHeal,
  applyTeamHeal,
  canAffordHeal,
  tryChargeHeal,
} from '../heal.js';
import { ITEMS } from '../../data/items.js';
import { state } from '../../game/state.js';
import { calculateStat } from '../../battle/stats.js';

/**
 * M-24: лечение в поке-центре платное.
 * - без денег — отказ, команда не лечится;
 * - с деньгами — списание HEAL_PRICE и полный хил;
 * - здоровая команда — лечить нечего (отдельная ветка, бесплатно).
 */

function makeMon(over: Record<string, any> = {}): any {
  const mon: any = {
    apiData: {
      name: 'pikachu',
      // Статы в порядке PokeAPI НЕ по алфавиту — hp обязан находиться по
      // имени, а не «первым в массиве»: на этом ловилась старая формула.
      stats: [
        { stat: { name: 'attack' }, base_stat: 55 },
        { stat: { name: 'hp' }, base_stat: 35 },
        { stat: { name: 'defense' }, base_stat: 40 },
      ],
      moves: [{ move: { name: 'tackle', url: '' } }],
    },
    baseLevel: 10,
    candiesEaten: 0,
    ivs: { hp: 10 },
    evs: { hp: 0 },
    status: null,
    sleepTurns: 0,
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    movesPP: [{ current: 30, max: 30 }],
    ...over,
  };
  // maxHp считаем той же формулой, что и прод — иначе тест врал бы
  if (mon.maxHp === undefined) mon.maxHp = calculateStat(mon, 'hp', { ignoreBattleOnly: true });
  if (mon.currentHp === undefined) mon.currentHp = mon.maxHp;
  return mon;
}

describe('M-24: платное лечение', () => {
  beforeEach(() => {
    state.inventory = { credit: 0 };
  });

  it('HEAL_PRICE = potion × 5 (решение зафиксировано константой)', () => {
    const potion = ITEMS.find((i) => i.id === 'potion')!;
    expect(potion.price).toBe(300);
    expect(HEAL_PRICE).toBe(potion.price * 5);
    expect(HEAL_PRICE).toBe(1500);
  });

  it('teamNeedsHeal: здоровая — false; раненая/статус/PP — true', () => {
    expect(teamNeedsHeal([])).toBe(false);
    expect(teamNeedsHeal([makeMon()])).toBe(false);
    expect(teamNeedsHeal([makeMon({ currentHp: 5 })])).toBe(true);
    expect(teamNeedsHeal([makeMon({ status: 'psn' })])).toBe(true);
    expect(
      teamNeedsHeal([makeMon({ movesPP: [{ current: 3, max: 30 }] })]),
    ).toBe(true);
    // Один раненый среди здоровых — всё равно надо лечить
    expect(teamNeedsHeal([makeMon(), makeMon({ currentHp: 1 })])).toBe(true);
  });

  it('без денег — отказ, кредит не трогаем', () => {
    state.inventory = { credit: 0 };
    expect(canAffordHeal()).toBe(false);
    expect(tryChargeHeal()).toBe(false);
    expect(state.inventory.credit).toBe(0);
  });

  it('денег меньше цены — отказ', () => {
    state.inventory = { credit: HEAL_PRICE - 1 };
    expect(tryChargeHeal()).toBe(false);
    expect(state.inventory.credit).toBe(HEAL_PRICE - 1);
  });

  it('с деньгами — списание ровно HEAL_PRICE', () => {
    state.inventory = { credit: 5000 };
    expect(canAffordHeal()).toBe(true);
    expect(tryChargeHeal()).toBe(true);
    expect(state.inventory.credit).toBe(5000 - HEAL_PRICE);
  });

  it('ровно цена — списание в ноль', () => {
    state.inventory = { credit: HEAL_PRICE };
    expect(tryChargeHeal()).toBe(true);
    expect(state.inventory.credit).toBe(0);
  });

  it('applyTeamHeal чинит HP/статус/сон/стадии/PP', () => {
    const mon = makeMon({
      currentHp: 4,
      status: 'par',
      sleepTurns: 3,
      statStages: { atk: 2, def: 0, spa: 0, spd: 0, spe: 0 },
      movesPP: [{ current: 5, max: 30 }],
    });
    const healed = applyTeamHeal([mon]);
    expect(healed).toBe(true);
    expect(mon.currentHp).toBe(mon.maxHp);
    expect(mon.status).toBeNull();
    expect(mon.sleepTurns).toBe(0);
    expect(mon.statStages).toEqual({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    expect(mon.movesPP).toEqual([{ current: 30, max: 30 }]);
  });

  it('applyTeamHeal здоровой команды — false (лечить нечего)', () => {
    expect(applyTeamHeal([makeMon()])).toBe(false);
  });

  it('полный цикл без денег: отказ, команда остаётся раненой', () => {
    state.inventory = { credit: 100 };
    const team = [makeMon({ currentHp: 7, status: 'psn' })];
    expect(teamNeedsHeal(team)).toBe(true);
    // UI-путь: денег нет → applyTeamHeal не вызываем
    expect(tryChargeHeal()).toBe(false);
    expect(team[0].currentHp).toBe(7);
    expect(team[0].status).toBe('psn');
  });

  it('полный цикл с деньгами: списание + хил', () => {
    state.inventory = { credit: 10000 };
    const team = [makeMon({ currentHp: 7, status: 'psn' })];
    expect(teamNeedsHeal(team)).toBe(true);
    expect(tryChargeHeal()).toBe(true);
    expect(applyTeamHeal(team)).toBe(true);
    expect(team[0].currentHp).toBe(team[0].maxHp);
    expect(team[0].status).toBeNull();
    expect(state.inventory.credit).toBe(10000 - HEAL_PRICE);
  });
});
