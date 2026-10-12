import { describe, it, expect, beforeEach } from 'vitest';
import {
  HEAL_PRICE_PER_HP,
  healCostForTeam,
  teamNeedsHeal,
  applyTeamHeal,
  canAffordHeal,
  tryChargeHeal,
} from '../heal.js';
import { state } from '../../game/state.js';
import { calculateStat } from '../../battle/stats.js';

/**
 * M-24: лечение в поке-центре платное, цена = недостающее HP × 1 кр.
 * - без денег — отказ, команда не лечится;
 * - с деньгами — списание цены и полный хил;
 * - здоровая команда — лечить нечего (цена 0, бесплатно).
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

describe('M-24: лечение по HP (1 HP = 1 кр)', () => {
  beforeEach(() => {
    state.inventory = { credit: 0 };
  });

  it('тариф зафиксирован: HEAL_PRICE_PER_HP = 1', () => {
    expect(HEAL_PRICE_PER_HP).toBe(1);
  });

  it('healCostForTeam: здоровая — 0; раненая — недостача; без сознания — полный maxHp', () => {
    expect(healCostForTeam([])).toBe(0);
    const healthy = makeMon();
    expect(healCostForTeam([healthy])).toBe(0);
    const hurt = makeMon({ currentHp: 5 });
    expect(healCostForTeam([hurt])).toBe(hurt.maxHp - 5);
    const dead = makeMon({ currentHp: 0 });
    expect(healCostForTeam([dead])).toBe(dead.maxHp);
    // Статус/PP без ран — 0 (чинятся бесплатно довеском)
    expect(healCostForTeam([makeMon({ status: 'psn' })])).toBe(0);
    expect(healCostForTeam([makeMon({ movesPP: [{ current: 3, max: 30 }] })])).toBe(0);
    // Сумма по команде
    expect(healCostForTeam([hurt, dead])).toBe((hurt.maxHp - 5) + dead.maxHp);
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
    expect(canAffordHeal(10)).toBe(false);
    expect(tryChargeHeal(10)).toBe(false);
    expect(state.inventory.credit).toBe(0);
  });

  it('денег меньше цены — отказ', () => {
    const team = [makeMon({ currentHp: 5 })];
    const cost = healCostForTeam(team);
    expect(cost).toBeGreaterThan(0);
    state.inventory = { credit: cost - 1 };
    expect(tryChargeHeal(cost)).toBe(false);
    expect(state.inventory.credit).toBe(cost - 1);
  });

  it('с деньгами — списание ровно цены ран', () => {
    const team = [makeMon({ currentHp: 5 })];
    const cost = healCostForTeam(team);
    state.inventory = { credit: 5000 };
    expect(canAffordHeal(cost)).toBe(true);
    expect(tryChargeHeal(cost)).toBe(true);
    expect(state.inventory.credit).toBe(5000 - cost);
  });

  it('ровно цена — списание в ноль', () => {
    const team = [makeMon({ currentHp: 0 })];
    const cost = healCostForTeam(team);
    state.inventory = { credit: cost };
    expect(tryChargeHeal(cost)).toBe(true);
    expect(state.inventory.credit).toBe(0);
  });

  it('цена 0 (только статус) — бесплатно, кредит не трогаем', () => {
    const team = [makeMon({ status: 'psn' })];
    expect(healCostForTeam(team)).toBe(0);
    state.inventory = { credit: 0 };
    expect(tryChargeHeal(0)).toBe(true);
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
    const team = [makeMon({ currentHp: 7, status: 'psn' })];
    const cost = healCostForTeam(team);
    state.inventory = { credit: Math.max(0, cost - 1) };
    expect(teamNeedsHeal(team)).toBe(true);
    // UI-путь: денег нет → applyTeamHeal не вызываем
    expect(tryChargeHeal(cost)).toBe(cost === 0);
    if (cost > 0) {
      expect(team[0].currentHp).toBe(7);
      expect(team[0].status).toBe('psn');
    }
  });

  it('полный цикл с деньгами: списание + хил', () => {
    state.inventory = { credit: 10000 };
    const team = [makeMon({ currentHp: 7, status: 'psn' })];
    const cost = healCostForTeam(team);
    expect(cost).toBeGreaterThan(0);
    expect(teamNeedsHeal(team)).toBe(true);
    expect(tryChargeHeal(cost)).toBe(true);
    expect(applyTeamHeal(team)).toBe(true);
    expect(team[0].currentHp).toBe(team[0].maxHp);
    expect(team[0].status).toBeNull();
    expect(state.inventory.credit).toBe(10000 - cost);
  });
});
