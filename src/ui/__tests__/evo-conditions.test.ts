import { describe, it, expect } from 'vitest';
import { levelDetailMet, evoLocationMet, matchStoneEvo } from '../evolution.js';
import { calculateStat } from '../../battle/stats.js';

/**
 * Полная проверка эволюций: пол, время, счастье, место, атаки,
 * сопартийцы, статы тайрога. Без сети — только чистые функции.
 */

function makeMon(over: Record<string, any> = {}): any {
  const mon: any = {
    apiData: {
      name: 'tyrogue',
      stats: [
        { stat: { name: 'attack' }, base_stat: 35 },
        { stat: { name: 'hp' }, base_stat: 35 },
        { stat: { name: 'defense' }, base_stat: 35 },
        { stat: { name: 'special-attack' }, base_stat: 35 },
        { stat: { name: 'special-defense' }, base_stat: 35 },
        { stat: { name: 'speed' }, base_stat: 35 },
      ],
      moves: [
        { move: { name: 'tackle' } },
        { move: { name: 'mimic' } },
        { move: { name: 'ancient-power' } },
      ],
      types: [{ type: { name: 'fighting' } }],
    },
    baseLevel: 20,
    natureIdx: 0, // Hardy — нейтральный, чтобы atk/def сравнивались чисто
    candiesEaten: 0,
    ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    gender: 'male',
    happiness: 100,
    ...over,
  };
  return mon;
}

function ctx(over: Record<string, any> = {}): any {
  return {
    isDaytime: true,
    locationId: 'route1',
    knownMoves: ['tackle', 'mimic', 'ancient-power'],
    teamSpecies: ['pikachu', 'remoraid'],
    teamTypes: ['electric', 'water'],
    ...over,
  };
}

const base = { trigger: 'level-up', minLevel: 20 };

describe('levelDetailMet', () => {
  it('база: уровень met — true', () => {
    expect(levelDetailMet({ ...base }, makeMon(), ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base }, makeMon(), ctx(), 19)).toBe(false);
  });

  it('пол: галлейд только самец, фросласс только самка', () => {
    expect(levelDetailMet({ ...base, gender: 2 }, makeMon({ gender: 'male' }), ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base, gender: 2 }, makeMon({ gender: 'female' }), ctx(), 20)).toBe(false);
    expect(levelDetailMet({ ...base, gender: 1 }, makeMon({ gender: 'female' }), ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base, gender: 1 }, makeMon({ gender: 'male' }), ctx(), 20)).toBe(false);
  });

  it('время: день/ночь', () => {
    expect(levelDetailMet({ ...base, time: 'day' }, makeMon(), ctx({ isDaytime: true }), 20)).toBe(true);
    expect(levelDetailMet({ ...base, time: 'day' }, makeMon(), ctx({ isDaytime: false }), 20)).toBe(false);
    expect(levelDetailMet({ ...base, time: 'night' }, makeMon(), ctx({ isDaytime: false }), 20)).toBe(true);
    expect(levelDetailMet({ ...base, time: 'night' }, makeMon(), ctx({ isDaytime: true }), 20)).toBe(false);
  });

  it('счастье: порог', () => {
    expect(levelDetailMet({ ...base, minHappiness: 220 }, makeMon({ happiness: 220 }), ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base, minHappiness: 220 }, makeMon({ happiness: 100 }), ctx(), 20)).toBe(false);
  });

  it('привязанность: счастье ≥ 220', () => {
    expect(levelDetailMet({ ...base, minAffection: 2 }, makeMon({ happiness: 255 }), ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base, minAffection: 2 }, makeMon({ happiness: 100 }), ctx(), 20)).toBe(false);
  });

  it('красота — всегда нет (системы нет)', () => {
    expect(levelDetailMet({ ...base, minBeauty: 170 }, makeMon(), ctx(), 20)).toBe(false);
  });

  it('атака: нужна выученная', () => {
    expect(levelDetailMet({ ...base, knownMove: 'mimic' }, makeMon(), ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base, knownMove: 'fly' }, makeMon(), ctx(), 20)).toBe(false);
  });

  it('сопартийцы: вид и тип', () => {
    expect(levelDetailMet({ ...base, partySpecies: 'remoraid' }, makeMon(), ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base, partySpecies: 'darkrai' }, makeMon(), ctx(), 20)).toBe(false);
    expect(levelDetailMet({ ...base, partyType: 'dark' }, makeMon(), ctx(), 20)).toBe(false);
    const darkCtx = ctx({ teamTypes: ['dark', 'water'] });
    expect(levelDetailMet({ ...base, partyType: 'dark' }, makeMon(), darkCtx, 20)).toBe(true);
  });

  it('тайрог: сравнение атаки и защиты', () => {
    const atk = calculateStat(makeMon(), 'atk', { ignoreBattleOnly: true });
    const def = calculateStat(makeMon(), 'def', { ignoreBattleOnly: true });
    expect(atk).toBe(def); // равные IV → ничья
    expect(levelDetailMet({ ...base, relStats: 0 }, makeMon(), ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base, relStats: 1 }, makeMon(), ctx(), 20)).toBe(false);
    const atkMon = makeMon({ ivs: { hp: 20, atk: 50, def: 0, spa: 20, spd: 20, spe: 20 } });
    expect(levelDetailMet({ ...base, relStats: 1 }, atkMon, ctx(), 20)).toBe(true);
    expect(levelDetailMet({ ...base, relStats: -1 }, atkMon, ctx(), 20)).toBe(false);
  });

  it('переворот — нет', () => {
    expect(levelDetailMet({ ...base, upsideDown: true }, makeMon(), ctx(), 20)).toBe(false);
  });

  it('не level-up триггер — нет', () => {
    expect(levelDetailMet({ trigger: 'trade' }, makeMon(), ctx(), 20)).toBe(false);
  });
});

describe('evoLocationMet', () => {
  it('без места — true', () => {
    expect(evoLocationMet(null, 'route1')).toBe(true);
  });

  it('мшистые → леса', () => {
    expect(evoLocationMet('eterna-forest', 'viridianForest')).toBe(true);
    expect(evoLocationMet('eterna-forest', 'powerPlant')).toBe(false);
  });

  it('ледяные → льды', () => {
    expect(evoLocationMet('sinnoh-route-217', 'icePath')).toBe(true);
    expect(evoLocationMet('sinnoh-route-217', 'route1')).toBe(false);
  });

  it('магнитные → станция', () => {
    expect(evoLocationMet('mt-coronet', 'powerPlant')).toBe(true);
    expect(evoLocationMet('mt-coronet', 'viridianForest')).toBe(false);
  });

  it('неизвестное место — честное нет', () => {
    expect(evoLocationMet('some-weird-place', 'route1')).toBe(false);
  });
});

describe('matchStoneEvo (регрессия)', () => {
  it('use-item и trade', () => {
    expect(matchStoneEvo({ trigger: 'use-item', item: 'leaf-stone' }, 'leaf-stone')).toBe(true);
    expect(matchStoneEvo({ trigger: 'trade', held: 'metal-coat' }, 'metal-coat')).toBe(true);
  });
});
