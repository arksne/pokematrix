import { describe, it, expect } from 'vitest';
import { calculateStat, trainingPercent, natureModifier, stageMultiplier } from '../stats.js';

/**
 * Рег��онсия расхождения, которое было между боем и профилем:
 * формула считалась в четырёх местах, и бой не учитывал тренировку,
 * а профиль учитывал — расхождение доходило до 39.6 %.
 */

/** Покемон в стиле сейва: базовые статы лежат в apiData.stats. */
function mon(over = {}) {
  return {
    uid: 'm1',
    baseLevel: 50,
    candiesEaten: 0,
    apiData: {
      id: 130,
      name: 'gyarados',
      types: [{ type: { name: 'water' } }],
      abilities: [{ ability: { name: 'intimidate' } }],
      species: { name: 'gyarados', url: 'https://pokeapi.co/api/v2/pokemon-species/130/' },
      // порядок PokeAPI: hp, attack, defense, special-attack, special-defense, speed
      stats: [
        { base_stat: 95, stat: { name: 'hp' } },
        { base_stat: 125, stat: { name: 'attack' } },
        { base_stat: 79, stat: { name: 'defense' } },
        { base_stat: 60, stat: { name: 'special-attack' } },
        { base_stat: 100, stat: { name: 'special-defense' } },
        { base_stat: 81, stat: { name: 'speed' } },
      ],
    },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    natureIdx: 3, // Adamant: +atk, -spa
    ...over,
  };
}

describe('trainingPercent — тренировка наконец применяется', () => {
  it('даёт бонус выбранному стату на выбранной стадии', () => {
    expect(trainingPercent({ trainingStat: 'atk', trainingStage: 6 }, 'atk')).toBeCloseTo(0.40);
    expect(trainingPercent({ trainingStat: 'atk', trainingStage: 3 }, 'atk')).toBeCloseTo(0.25);
  });

  it('не даёт бонус другим статам', () => {
    expect(trainingPercent({ trainingStat: 'atk', trainingStage: 6 }, 'def')).toBe(0);
  });

  it('без тренировки бонуса нет', () => {
    expect(trainingPercent({ trainingStage: 6 }, 'atk')).toBe(0);
    expect(trainingPercent({}, 'atk')).toBe(0);
    expect(trainingPercent({ trainingStat: 'atk', trainingStage: 99 }, 'atk')).toBe(0);
  });

  it('тренировка реально меняет характеристику', () => {
    const base = mon();
    const trained = mon({ trainingStat: 'atk', trainingStage: 6 });
    const plain = calculateStat(base, 'attack');
    const withTraining = calculateStat(trained, 'attack');
    // stage 6 = +40%
    expect(withTraining).toBe(Math.floor(plain * 1.4));
    expect(withTraining).toBeGreaterThan(plain);
  });
});

describe('calculateStat — единая формула', () => {
  it('считает HP по стандартной формуле', () => {
    const gyarados = mon();
    // floor(0.01 * (2*95 + 31 + 0) * 50) + 50 + 10
    expect(calculateStat(gyarados, 'hp')).toBe(Math.floor(0.01 * 221 * 50) + 60);
  });

  it('учитывает природу: Adamant +atk, -spa', () => {
    const gyarados = mon();
    // Нейтральный характер: natureIdx 0 (Hardy, без buff/nerf)
    const neutralMon = mon({ natureIdx: 0 });
    const plain = calculateStat(neutralMon, 'attack');
    // Adamant (natureIdx 3) даёт +10% атаки
    expect(calculateStat(gyarados, 'attack')).toBe(Math.floor(plain * 1.1));
    // и -10% специальной атаки
    const plainSpA = calculateStat(neutralMon, 'special-attack');
    expect(calculateStat(gyarados, 'special-attack')).toBe(Math.floor(plainSpA * 0.9));
  });

  it('учитывает стадии боя', () => {
    const plain = calculateStat(mon(), 'attack');
    const boosted = calculateStat(mon({ statStages: { atk: 2 } }), 'attack');
    const lowered = calculateStat(mon({ statStages: { atk: -1 } }), 'attack');
    expect(boosted).toBe(Math.floor(plain * 2));
    expect(lowered).toBe(Math.floor(plain * (2 / 3)));
  });

  it('учитывает предметы (Choice Band, Assault Vest)', () => {
    const plain = calculateStat(mon(), 'attack');
    expect(calculateStat(mon({ heldItem: 'choiceBand' }), 'attack')).toBe(Math.floor(plain * 1.5));
    const plainSpd = calculateStat(mon(), 'special-defense');
    expect(calculateStat(mon({ heldItem: 'assaultVest' }), 'special-defense')).toBe(Math.floor(plainSpd * 1.5));
  });

  it('одинаково считает для игрока и для дикого при одинаковых входных данных', () => {
    // Раньше wild и player считались разными копиями формулы. Проверяем, что
    // базовая часть и IV одинаковы. Природа к диким не применяется by design,
    // поэтому у wild natureIdx не задан, а у игрока выставлен нейтральный.
    const ivs = { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 };
    const player = mon({ ivs, natureIdx: 0 });
    const wild = {
      stats: player.apiData.stats,
      wildIVs: ivs,
    };
    expect(calculateStat(player, 'attack', { isWild: false }))
      .toBe(calculateStat(wild, 'attack', { isWild: true, level: 50 }));
  });

  it('не падает на неполных данных', () => {
    expect(calculateStat({}, 'attack')).toBeGreaterThan(0);
    expect(calculateStat({ apiData: {} }, 'hp')).toBeGreaterThan(0);
    // стат не найден — используется базовое 50
    expect(calculateStat({ apiData: { stats: [] } }, 'attack')).toBeGreaterThan(0);
  });
});

describe('вспомогательные множители', () => {
  it('природа: buff 1.1, nerf 0.9, нейтральная 1.0', () => {
    expect(natureModifier(1, 'atk')).toBe(1.1);
    expect(natureModifier(1, 'def')).toBe(0.9);
    expect(natureModifier(0, 'atk')).toBe(1);
    expect(natureModifier(undefined, 'atk')).toBe(1);
  });

  it('стадии: +2 = x2, -1 = 2/3, 0 = x1', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3);
  });
});
