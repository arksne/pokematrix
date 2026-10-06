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

// ======================================================================
// calculateStat — аргумент isWild булевым значением
// ======================================================================
// Регрессия на настоящий баг: в calculateStat передавали `true` вместо
// `{ isWild: true }`. У булева значения нет поля isWild, поэтому isWild всегда
// был false, и база бралась из `pokemon.apiData.stats` — а у дикого покемона
// такого поля нет (S.activeWild это сырой ответ PokeAPI со `stats` на объекте).
// В результате у ВСЕХ диких покемонов базовый стат падал до запасных 50:
// HP, скорость и урон не зависели от вида.
describe('calculateStat — boolean вместо { isWild }', () => {
  const wild = {
    name: 'blissey',
    stats: [
      { base_stat: 255, stat: { name: 'hp' } },
      { base_stat: 10, stat: { name: 'attack' } },
      { base_stat: 10, stat: { name: 'defense' } },
      { base_stat: 75, stat: { name: 'special-attack' } },
      { base_stat: 135, stat: { name: 'special-defense' } },
      { base_stat: 55, stat: { name: 'speed' } },
    ],
    wildIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  };

  it('boolean true считается как дикий (статы вида, а не запасные 50)', () => {
    // HP = floor(0.01 * (2*255 + 31) * 50) + 50 + 10 = 330
    const hp = calculateStat(wild, 'hp', true);
    expect(hp).toBe(330);
  });

  it('старое поведение (запасные 50) больше не возвращается', () => {
    // С запасной базой 50 и iv 15 вышло бы floor(0.01*(2*50+15)*50)+60 = 117.
    expect(calculateStat(wild, 'hp', true)).not.toBe(117);
  });

  it('boolean true и { isWild: true } дают одно и то же', () => {
    for (const stat of ['hp', 'attack', 'defense', 'special-attack', 'speed']) {
      expect(calculateStat(wild, stat, true)).toBe(calculateStat(wild, stat, { isWild: true }));
    }
  });

  it('атака дикого считается по своему виду (10), а не по 50', () => {
    // floor((floor((2*10 + 31) * 50 / 100) + 5) * 1) = floor(25.5 + 5) = 30
    expect(calculateStat(wild, 'attack', true)).toBe(30);
  });

  it('свой покемон по-прежнему берёт статы из apiData.stats', () => {
    const own = {
      apiData: {
        stats: [
          { base_stat: 255, stat: { name: 'hp' } },
          { base_stat: 10, stat: { name: 'attack' } },
        ],
      },
      baseLevel: 50,
      ivs: { hp: 31, atk: 31 },
      evs: { hp: 0, atk: 0 },
    };
    expect(calculateStat(own, 'hp', false)).toBe(330);
    expect(calculateStat(own, 'hp', { isWild: false })).toBe(330);
  });
});
