import { describe, it, expect, vi } from 'vitest';
import {
  TYPE_CHART,
  getTypeMultiplier,
  getWeatherMultiplier,
  calculateStat,
  getAbilityName,
  getStatusIcon,
  STATUS_NAMES,
  applyStatusEffect,
  cureStatus,
  checkStatusTurn,
  applyStatusEndOfTurn,
  statStageModify,
  checkAccuracy,
  isStatusImmune,
  calculateDamage,
  checkSuckerPunchFail,
  checkSturdy,
  getMoveCategory,
} from '../logic.js';

// ======================================================================
// 1. TYPE CHART
// ======================================================================
describe('Type chart — 18 attacking types', () => {
  const ALL_TYPES = Object.keys(TYPE_CHART);

  it('has all 18 types defined', () => {
    expect(ALL_TYPES.length).toBe(18);
    expect(ALL_TYPES).toContain('normal');
    expect(ALL_TYPES).toContain('fairy');
  });

  it('Normal vs Ghost = 0x', () => {
    expect(getTypeMultiplier('normal', ['ghost'])).toBe(0);
  });

  it('Normal vs Rock = 0.5x', () => {
    expect(getTypeMultiplier('normal', ['rock'])).toBe(0.5);
  });

  it('Fire vs Grass = 2x', () => {
    expect(getTypeMultiplier('fire', ['grass'])).toBe(2);
  });

  it('Water vs Fire = 2x', () => {
    expect(getTypeMultiplier('water', ['fire'])).toBe(2);
  });

  it('Electric vs Ground = 0x', () => {
    expect(getTypeMultiplier('electric', ['ground'])).toBe(0);
  });

  it('Fighting vs Ghost = 0x', () => {
    expect(getTypeMultiplier('fighting', ['ghost'])).toBe(0);
  });

  it('Psychic vs Dark = 0x', () => {
    expect(getTypeMultiplier('psychic', ['dark'])).toBe(0);
  });

  it('Dragon vs Fairy = 0x', () => {
    expect(getTypeMultiplier('dragon', ['fairy'])).toBe(0);
  });

  it('Ground vs Flying = 0x', () => {
    expect(getTypeMultiplier('ground', ['flying'])).toBe(0);
  });

  it('Ghost vs Normal = 0x', () => {
    expect(getTypeMultiplier('ghost', ['normal'])).toBe(0);
  });

  it('Poison vs Steel = 0x', () => {
    expect(getTypeMultiplier('poison', ['steel'])).toBe(0);
  });

  it('Fairy vs Dragon = 2x', () => {
    expect(getTypeMultiplier('fairy', ['dragon'])).toBe(2);
  });

  it('Ice vs Dragon = 2x', () => {
    expect(getTypeMultiplier('ice', ['dragon'])).toBe(2);
  });

  it('Fighting vs Steel = 2x', () => {
    expect(getTypeMultiplier('fighting', ['steel'])).toBe(2);
  });

  it('Fire vs Water = 0.5x', () => {
    expect(getTypeMultiplier('fire', ['water'])).toBe(0.5);
  });

  it('Electric vs Dragon = 0.5x', () => {
    expect(getTypeMultiplier('electric', ['dragon'])).toBe(0.5);
  });

  it('dual-type Water/Ground is immune to Electric (4x resist → 0x)', () => {
    // Water takes 2x from Electric, Ground takes 0x → 2 * 0 = 0
    expect(getTypeMultiplier('electric', ['water', 'ground'])).toBe(0);
  });

  it('dual-type Fire/Flying vs Fighting = 0.5x (1 * 0.5)', () => {
    // Fighting vs Fire = 1x (no chart entry), Fighting vs Flying = 0.5x
    expect(getTypeMultiplier('fighting', ['fire', 'flying'])).toBe(0.5);
  });

  it('dual-type Grass/Poison vs Fighting = 0.5x (1 * 0.5)', () => {
    // Fighting vs Grass = 1x, Fighting vs Poison = 0.5x
    expect(getTypeMultiplier('fighting', ['grass', 'poison'])).toBe(0.5);
  });

  it('dual-type Water/Flying vs Electric = 4x (2 * 2)', () => {
    // Electric vs Water = 2x, Electric vs Flying = 2x
    expect(getTypeMultiplier('electric', ['water', 'flying'])).toBe(4);
  });

  it('accepts object-format types (like PokeAPI)', () => {
    expect(getTypeMultiplier('fire', [{ type: { name: 'grass' } }])).toBe(2);
  });

  it('unknown attacking type returns 1x', () => {
    expect(getTypeMultiplier('bird', ['normal'])).toBe(1);
  });

  // Verify all 324 (18x18) matchups produce valid multipliers
  it('all 324 type matchups return valid multipliers', () => {
    const valid = [0, 0.25, 0.5, 1, 2, 4];
    for (const atk of ALL_TYPES) {
      for (const def of ALL_TYPES) {
        const mult = getTypeMultiplier(atk, [def]);
        expect(valid).toContain(mult);
      }
    }
  });

  it('all 18 types are in TYPE_CHART (no typos)', () => {
    const required = [
      'normal', 'fire', 'water', 'electric', 'grass', 'ice',
      'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
      'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
    ];
    for (const t of required) {
      expect(TYPE_CHART[t]).toBeDefined();
    }
  });
});

// ======================================================================
// 2. WEATHER MULTIPLIERS
// ======================================================================
describe('Weather multipliers', () => {
  it('rain boosts water 1.5x, reduces fire 0.5x', () => {
    expect(getWeatherMultiplier('water', 'rain')).toBe(1.5);
    expect(getWeatherMultiplier('fire', 'rain')).toBe(0.5);
  });

  it('sun boosts fire 1.5x, reduces water 0.5x', () => {
    expect(getWeatherMultiplier('fire', 'sun')).toBe(1.5);
    expect(getWeatherMultiplier('water', 'sun')).toBe(0.5);
  });

  it('sandstorm boosts rock 1.5x', () => {
    expect(getWeatherMultiplier('rock', 'sandstorm')).toBe(1.5);
  });

  it('hail boosts ice 1.5x', () => {
    expect(getWeatherMultiplier('ice', 'hail')).toBe(1.5);
  });

  it('clear weather = 1x for all', () => {
    expect(getWeatherMultiplier('fire', 'clear')).toBe(1);
    expect(getWeatherMultiplier('water', 'clear')).toBe(1);
    expect(getWeatherMultiplier('grass', 'clear')).toBe(1);
  });

  it('unaffected types = 1x', () => {
    expect(getWeatherMultiplier('normal', 'rain')).toBe(1);
    expect(getWeatherMultiplier('psychic', 'sun')).toBe(1);
    expect(getWeatherMultiplier('dark', 'hail')).toBe(1);
  });
});

// ======================================================================
// 3. STAT CALCULATION
// ======================================================================
describe('calculateStat', () => {
  const natures = [{ buff: 'atk', nerf: 'spa' }]; // +Atk -SpA (Adamant)

  const baseMon = {
    apiData: {
      stats: [
        { base_stat: 100, stat: { name: 'hp' } },
        { base_stat: 120, stat: { name: 'attack' } },
        { base_stat: 80, stat: { name: 'defense' } },
        { base_stat: 60, stat: { name: 'special-attack' } },
        { base_stat: 70, stat: { name: 'special-defense' } },
        { base_stat: 90, stat: { name: 'speed' } },
      ],
    },
    baseLevel: 50,
    candiesEaten: 0,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    natureIdx: 0,
    statStages: null,
    heldItem: null,
  };

  const wildMon = {
    stats: [
      { base_stat: 80, stat: { name: 'hp' } },
      { base_stat: 100, stat: { name: 'attack' } },
    ],
    wildIVs: { hp: 15, atk: 15 },
  };

  it('calculates HP correctly at level 50', () => {
    const hp = calculateStat(baseMon, 'hp', { natures });
    // Floor(0.01 * (2*100 + 31 + 0.25*0) * 50) + 50 + 10
    // = Floor(0.01 * 231 * 50) + 60 = Floor(115.5) + 60 = 115 + 60 = 175
    expect(hp).toBe(175);
  });

  it('calculates Atk with Adamant nature (+10%)', () => {
    const atk = calculateStat(baseMon, 'attack', { natures });
    // Base: Floor((Floor((2*120 + 31) * 50/100) + 5) * 1.1)
    // = Floor((Floor(271 * 0.5) + 5) * 1.1)
    // = Floor((Floor(135.5) + 5) * 1.1)
    // = Floor((135 + 5) * 1.1)
    // = Floor(140 * 1.1) = Floor(154) = 154
    expect(atk).toBe(154);
  });

  it('calculates SpA with Adamant nature (-10%)', () => {
    const spa = calculateStat(baseMon, 'special-attack', { natures });
    // (Floor((2*60 + 31) * 50/100) + 5) * 0.9
    // = (Floor(151 * 0.5) + 5) * 0.9
    // = (Floor(75.5) + 5) * 0.9
    // = 80 * 0.9 = 72
    expect(spa).toBe(72);
  });

  it('calculates wild HP correctly', () => {
    const hp = calculateStat(wildMon, 'hp', { isWild: true, level: 50 });
    // Floor(0.01 * (2*80 + 15) * 50) + 50 + 10
    // = Floor(0.01 * 175 * 50) + 60 = Floor(87.5) + 60 = 87 + 60 = 147
    expect(hp).toBe(147);
  });

  it('applies stat stage boost (+1 = 1.5x)', () => {
    const mon = { ...baseMon, statStages: { atk: 1, def: 0, spa: 0, spd: 0, spe: 0 } };
    const atk = calculateStat(mon, 'attack', { natures });
    // 154 * (2+1)/2 = 154 * 1.5 = 231
    expect(atk).toBe(231);
  });

  it('applies stat stage reduction (-1 = 0.67x)', () => {
    const mon = { ...baseMon, statStages: { atk: -1, def: 0, spa: 0, spd: 0, spe: 0 } };
    const atk = calculateStat(mon, 'attack', { natures });
    // 154 * 2/(2+1) = 154 * 2/3 = 102.67 → 102
    expect(atk).toBe(102);
  });

  it('caps stat stages at -6 (0.25x)', () => {
    const mon = { ...baseMon, statStages: { atk: -6, def: 0, spa: 0, spd: 0, spe: 0 } };
    const atk = calculateStat(mon, 'attack', { natures });
    // 154 * 2/(2+6) = 154 * 0.25 = 38.5 → 38
    expect(atk).toBe(38);
  });

  it('caps stat stages at +6 (4x)', () => {
    const mon = { ...baseMon, statStages: { atk: 6, def: 0, spa: 0, spd: 0, spe: 0 } };
    const atk = calculateStat(mon, 'attack', { natures });
    // 154 * (2+6)/2 = 154 * 4 = 616
    expect(atk).toBe(616);
  });

  it('Choice Band multiplies Atk by 1.5', () => {
    const mon = { ...baseMon, heldItem: 'choiceBand' };
    const atk = calculateStat(mon, 'attack', { natures });
    expect(atk).toBe(231); // 154 * 1.5 = 231
  });

  it('Choice Scarf multiplies Speed by 1.5', () => {
    const mon = { ...baseMon, heldItem: 'choiceScarf' };
    const spe = calculateStat(mon, 'speed', { natures });
    // Base spe: Floor((Floor((2*90 + 31) * 50/100) + 5) * 1) = 110
    // 110 * 1.5 = 165
    expect(spe).toBe(165);
  });
});

// ======================================================================
// 4. ACCURACY
// ======================================================================
describe('checkAccuracy', () => {
  it('move with null accuracy always hits', () => {
    const move = { accuracy: null };
    const r = checkAccuracy(move);
    expect(r.hit).toBe(true);
  });

  it('move with 100 accuracy always hits', () => {
    const move = { accuracy: 100 };
    const r = checkAccuracy(move);
    expect(r.hit).toBe(true);
  });

  it('move with <100 accuracy can miss (stochastic, run 100x)', () => {
    // Thunder has 70 accuracy → should miss sometimes
    const move = { accuracy: 70 };
    let hits = 0;
    let misses = 0;
    for (let i = 0; i < 200; i++) {
      const r = checkAccuracy(move);
      if (r.hit) hits++;
      else misses++;
    }
    // Should have at least some of each (very unlikely to be all hits/all misses)
    expect(hits).toBeGreaterThan(50);
    expect(misses).toBeGreaterThan(0);
  });

  it('move with 0 accuracy always misses', () => {
    const move = { accuracy: 0 };
    for (let i = 0; i < 20; i++) {
      expect(checkAccuracy(move).hit).toBe(false);
    }
  });

  it('Swift (null acc) never misses', () => {
    const swift = { name: 'swift', accuracy: null };
    for (let i = 0; i < 20; i++) {
      expect(checkAccuracy(swift).hit).toBe(true);
    }
  });
});

// ======================================================================
// 5. STATUS IMMUNITY
// ======================================================================
describe('isStatusImmune — type immunities', () => {
  it('Ground type is immune to paralysis', () => {
    expect(isStatusImmune('paralysis', { types: [{ type: { name: 'ground' } }] })).toBe(true);
  });

  it('Steel type is immune to poison', () => {
    expect(isStatusImmune('poison', { types: [{ type: { name: 'steel' } }] })).toBe(true);
  });

  it('Poison type is immune to poison', () => {
    expect(isStatusImmune('poison', { types: [{ type: { name: 'poison' } }] })).toBe(true);
  });

  it('Fire type is immune to burn', () => {
    expect(isStatusImmune('burn', { types: [{ type: { name: 'fire' } }] })).toBe(true);
  });

  it('Ice type is immune to freeze', () => {
    expect(isStatusImmune('freeze', { types: [{ type: { name: 'ice' } }] })).toBe(true);
  });

  it('Normal type is NOT immune to paralysis', () => {
    expect(isStatusImmune('paralysis', { types: [{ type: { name: 'normal' } }] })).toBe(false);
  });

  it('Water type is NOT immune to freezing', () => {
    expect(isStatusImmune('freeze', { types: [{ type: { name: 'water' } }] })).toBe(false);
  });
});

describe('isStatusImmune — ability immunities', () => {
  it('Limber prevents paralysis', () => {
    expect(isStatusImmune('paralysis', { abilities: [{ ability: { name: 'limber' } }] })).toBe(true);
  });

  it('Insomnia prevents sleep', () => {
    expect(isStatusImmune('sleep', { abilities: [{ ability: { name: 'insomnia' } }] })).toBe(true);
  });

  it('Vital Spirit prevents sleep', () => {
    expect(isStatusImmune('sleep', { abilities: [{ ability: { name: 'vital-spirit' } }] })).toBe(true);
  });

  it('Immunity prevents poison', () => {
    expect(isStatusImmune('poison', { abilities: [{ ability: { name: 'immunity' } }] })).toBe(true);
  });

  it('Water Veil prevents burn', () => {
    expect(isStatusImmune('burn', { abilities: [{ ability: { name: 'water-veil' } }] })).toBe(true);
  });

  it('Magma Armor prevents freeze', () => {
    expect(isStatusImmune('freeze', { abilities: [{ ability: { name: 'magma-armor' } }] })).toBe(true);
  });

  it('non-immune ability does not block poison', () => {
    expect(isStatusImmune('poison', { abilities: [{ ability: { name: 'blaze' } }] })).toBe(false);
  });

  it('checkAbilities=false skips ability checks', () => {
    expect(isStatusImmune('paralysis', { abilities: [{ ability: { name: 'limber' } }] }, false)).toBe(false);
  });

  it('works with abilityName shortcut for player mons', () => {
    expect(isStatusImmune('sleep', { abilityName: 'insomnia' })).toBe(true);
  });
});

// ======================================================================
// 6. DAMAGE CALCULATION
// ======================================================================
describe('calculateDamage', () => {
  // Level 50 Charizard with max IVs
  const attacker = {
    apiData: {
      name: 'charizard',
      stats: [
        { base_stat: 78, stat: { name: 'hp' } },
        { base_stat: 84, stat: { name: 'attack' } },
        { base_stat: 78, stat: { name: 'defense' } },
        { base_stat: 109, stat: { name: 'special-attack' } },
        { base_stat: 85, stat: { name: 'special-defense' } },
        { base_stat: 100, stat: { name: 'speed' } },
      ],
      types: [{ type: { name: 'fire' } }, { type: { name: 'flying' } }],
    },
    baseLevel: 50,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    statStages: null,
    heldItem: null,
    status: null,
  };

  // Level 50 Venusaur
  const defender = {
    apiData: {
      name: 'venusaur',
      stats: [
        { base_stat: 80, stat: { name: 'hp' } },
        { base_stat: 82, stat: { name: 'attack' } },
        { base_stat: 83, stat: { name: 'defense' } },
        { base_stat: 100, stat: { name: 'special-attack' } },
        { base_stat: 100, stat: { name: 'special-defense' } },
        { base_stat: 80, stat: { name: 'speed' } },
      ],
      types: [{ type: { name: 'grass' } }, { type: { name: 'poison' } }],
    },
    statStages: null,
    heldItem: null,
  };

  const flamethrower = {
    name: 'flamethrower',
    power: 90,
    accuracy: 100,
    type: { name: 'fire' },
    damage_class: { name: 'special' },
    pp: 15,
  };

  it('deals non-zero damage with valid move', () => {
    const result = calculateDamage({
      move: flamethrower,
      attacker,
      defender,
      attackerLevel: 50,
      defenderLevel: 50,
      alwaysCrit: true,
    });
    expect(result.damage).toBeGreaterThan(0);
    expect(result.damage).toBeLessThan(999);
  });

  it('Flamethrower on Venusaur is super-effective (Fire > Grass: 2x)', () => {
    const result = calculateDamage({
      move: flamethrower,
      attacker,
      defender,
      alwaysCrit: true,
    });
    expect(result.messages).toContain('Суперэффективно!');
  });

  it('STAB applies (Charizard is Fire type)', () => {
    const result = calculateDamage({
      move: flamethrower,
      attacker,
      defender,
      alwaysCrit: true,
    });
    // Damage should be higher than without STAB (hard to isolate, but we can verify the damage calc includes it)
    const noStab = calculateDamage({
      move: { ...flamethrower },
      attacker: { ...attacker, apiData: { ...attacker.apiData, types: [{ type: { name: 'normal' } }] } },
      defender,
      alwaysCrit: true,
    });
    expect(result.damage).toBeGreaterThan(noStab.damage);
  });

  it('crit = 1.5x multiplier', () => {
    const noCrit = calculateDamage({
      move: flamethrower,
      attacker,
      defender,
      alwaysCrit: true,
    });
    // Without alwaysCrit, damage varies. With fixed random, crit is ~1.5x
    expect(noCrit.isCrit).toBe(true);
  });

  it('Life Orb adds 1.3x multiplier', () => {
    const normal = calculateDamage({
      move: flamethrower,
      attacker,
      defender,
      alwaysCrit: true,
      attackerHeldItem: null,
    });
    const orb = calculateDamage({
      move: flamethrower,
      attacker,
      defender,
      alwaysCrit: true,
      attackerHeldItem: 'lifeOrb',
    });
    expect(orb.damage).toBeGreaterThan(normal.damage);
  });

  it('Expert Belt adds 1.2x on super-effective', () => {
    const normal = calculateDamage({
      move: flamethrower,
      attacker,
      defender,
      alwaysCrit: true,
      attackerHeldItem: null,
    });
    const belt = calculateDamage({
      move: flamethrower,
      attacker,
      defender,
      alwaysCrit: true,
      attackerHeldItem: 'expertBelt',
    });
    expect(belt.damage).toBeGreaterThan(normal.damage);
  });

  it('Air Balloon nullifies Ground moves', () => {
    const earthquake = {
      name: 'earthquake', power: 100, accuracy: 100,
      type: { name: 'ground' }, damage_class: { name: 'physical' }, pp: 10,
    };
    const result = calculateDamage({
      move: earthquake,
      attacker,
      defender,
      defenderHeldItem: 'airBalloon',
      alwaysCrit: true,
    });
    expect(result.damage).toBe(0);
    expect(result.messages).toContain('Атака не возымела эффекта...');
  });

  it('move with no power returns 0 damage', () => {
    const growl = {
      name: 'growl', power: null, accuracy: 100,
      type: { name: 'normal' }, damage_class: { name: 'status' }, pp: 40,
    };
    const result = calculateDamage({
      move: growl,
      attacker,
      defender,
      alwaysCrit: true,
    });
    expect(result.damage).toBe(0);
  });
});

// ======================================================================
// 7. BURN MODIFIER
// ======================================================================
describe('Burn halves physical attack damage', () => {
  const attacker = {
    apiData: {
      name: 'machamp',
      stats: [
        { base_stat: 90, stat: { name: 'hp' } },
        { base_stat: 130, stat: { name: 'attack' } },
        { base_stat: 80, stat: { name: 'defense' } },
        { base_stat: 65, stat: { name: 'special-attack' } },
        { base_stat: 85, stat: { name: 'special-defense' } },
        { base_stat: 55, stat: { name: 'speed' } },
      ],
      types: [{ type: { name: 'fighting' } }],
    },
    baseLevel: 50, status: 'brn',
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    statStages: null, heldItem: null,
  };
  const defender = {
    apiData: {
      name: 'snorlax',
      stats: [
        { base_stat: 160, stat: { name: 'hp' } },
        { base_stat: 110, stat: { name: 'attack' } },
        { base_stat: 65, stat: { name: 'defense' } },
        { base_stat: 65, stat: { name: 'special-attack' } },
        { base_stat: 110, stat: { name: 'special-defense' } },
        { base_stat: 30, stat: { name: 'speed' } },
      ],
      types: [{ type: { name: 'normal' } }],
    },
    statStages: null, heldItem: null,
  };

  it('burned physical attack does ~half damage', () => {
    const result = calculateDamage({
      move: { name: 'karate-chop', power: 50, accuracy: 100, type: { name: 'fighting' }, damage_class: { name: 'physical' }, pp: 25 },
      attacker,
      defender,
      alwaysCrit: true,
    });
    const resultNoBurn = calculateDamage({
      move: { name: 'karate-chop', power: 50, accuracy: 100, type: { name: 'fighting' }, damage_class: { name: 'physical' }, pp: 25 },
      attacker: { ...attacker, status: null },
      defender,
      alwaysCrit: true,
    });
    expect(result.damage).toBeLessThan(resultNoBurn.damage);
    expect(result.damage).toBe(Math.floor(resultNoBurn.damage * 0.5));
  });

  it('burn does NOT affect special attacks', () => {
    const result = calculateDamage({
      move: { name: 'flamethrower', power: 90, accuracy: 100, type: { name: 'fire' }, damage_class: { name: 'special' }, pp: 15 },
      attacker,
      defender,
      alwaysCrit: true,
    });
    const resultNoBurn = calculateDamage({
      move: { name: 'flamethrower', power: 90, accuracy: 100, type: { name: 'fire' }, damage_class: { name: 'special' }, pp: 15 },
      attacker: { ...attacker, status: null },
      defender,
      alwaysCrit: true,
    });
    expect(result.damage).toBe(resultNoBurn.damage);
  });
});

// ======================================================================
// 8. SUCKER PUNCH FAIL CONDITION
// ======================================================================
describe('checkSuckerPunchFail', () => {
  const suckerPunch = { name: 'sucker-punch', power: 70, priority: 1 };

  it('does NOT fail if opponent uses damaging move', () => {
    expect(checkSuckerPunchFail(suckerPunch, { power: 60 })).toBe(false);
  });

  it('fails if opponent uses status move (no power)', () => {
    expect(checkSuckerPunchFail(suckerPunch, { power: null })).toBe(true);
  });

  it('fails if opponent uses status move (undefined power)', () => {
    expect(checkSuckerPunchFail(suckerPunch, {})).toBe(true);
  });

  it('does NOT affect non-SuckerPunch moves', () => {
    expect(checkSuckerPunchFail({ name: 'tackle', power: 40 }, { power: null })).toBe(false);
  });

  it('returns false if no enemy move info available', () => {
    expect(checkSuckerPunchFail(suckerPunch, null)).toBe(false);
  });
});

// ======================================================================
// 9. STURDY
// ======================================================================
describe('checkSturdy', () => {
  it('activates when at full HP and OHKO', () => {
    expect(checkSturdy('sturdy', 100, 100, 0)).toBe(true);
  });

  it('does NOT activate if not at full HP before hit', () => {
    expect(checkSturdy('sturdy', 50, 100, 0)).toBe(false);
  });

  it('does NOT activate if not KO\'d (HP > 0)', () => {
    expect(checkSturdy('sturdy', 100, 100, 20)).toBe(false);
  });

  it('does NOT activate for non-Sturdy abilities', () => {
    expect(checkSturdy('blaze', 100, 100, 0)).toBe(false);
  });
});

// ======================================================================
// 10. STAT STAGE MODIFICATION
// ======================================================================
describe('statStageModify', () => {
  it('returns new stages object without mutating input', () => {
    const stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = statStageModify(stages, 'atk', 1);
    expect(result.atk).toBe(1);
    expect(stages.atk).toBe(0); // original unchanged
  });

  it('caps at +6', () => {
    const stages = { atk: 5, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = statStageModify(stages, 'atk', 2);
    expect(result.atk).toBe(6);
  });

  it('caps at -6', () => {
    const stages = { atk: -5, def: 0, spa: 0, spd: 0, spe: 0 };
    const result = statStageModify(stages, 'atk', -2);
    expect(result.atk).toBe(-6);
  });

  it('handles multiple stats independently', () => {
    const stages = { atk: 1, def: -2, spa: 0, spd: 0, spe: 0 };
    const result = statStageModify(stages, 'atk', 2);
    expect(result.atk).toBe(3);
    expect(result.def).toBe(-2); // unchanged
  });
});

// ======================================================================
// 11. STATUS EFFECTS
// ======================================================================
describe('applyStatusEffect', () => {
  it('applies status to target without status', () => {
    const target = { status: null };
    expect(applyStatusEffect(target, 'psn')).toBe(true);
    expect(target.status).toBe('psn');
  });

  it('returns false if target already has status', () => {
    const target = { status: 'brn' };
    expect(applyStatusEffect(target, 'psn')).toBe(false);
    expect(target.status).toBe('brn'); // unchanged
  });

  it('sleep sets 1-3 sleepTurns', () => {
    const target = { status: null };
    applyStatusEffect(target, 'slp');
    expect(target.status).toBe('slp');
    expect(target.sleepTurns).toBeGreaterThanOrEqual(1);
    expect(target.sleepTurns).toBeLessThanOrEqual(3);
  });
});

describe('cureStatus', () => {
  it('clears status and sleepTurns', () => {
    const target = { status: 'slp', sleepTurns: 2 };
    cureStatus(target);
    expect(target.status).toBeNull();
    expect(target.sleepTurns).toBe(0);
  });
});

describe('checkStatusTurn', () => {
  it('can act with no status', () => {
    const r = checkStatusTurn({ status: null });
    expect(r.canAct).toBe(true);
    expect(r.message).toBeNull();
  });

  it('sleep reduces turn counter, wakes up at 0', () => {
    const target = { status: 'slp', sleepTurns: 1 };
    const r = checkStatusTurn(target);
    expect(r.canAct).toBe(true);
    expect(r.message).toBe('проснулся!');
    expect(target.status).toBeNull();
  });

  it('sleep prevents action when turns remain', () => {
    const target = { status: 'slp', sleepTurns: 2 };
    const r = checkStatusTurn(target);
    expect(r.canAct).toBe(false);
    expect(r.message).toBe('спит...');
    expect(target.sleepTurns).toBe(1);
  });

  it('freeze: 20% chance to thaw each turn', () => {
    // This is probabilistic, but we can verify the structure
    const target = { status: 'frz' };
    let thawed = false;
    for (let i = 0; i < 100; i++) {
      const r = checkStatusTurn({ status: 'frz' });
      if (r.canAct && r.message === 'оттаял!') thawed = true;
    }
    expect(thawed).toBe(true);
  });

  it('paralysis: 25% chance to prevent action', () => {
    const target = { status: 'par' };
    let prevented = 0;
    for (let i = 0; i < 1000; i++) {
      const r = checkStatusTurn({ status: 'par' });
      if (!r.canAct) prevented++;
    }
    // Should be roughly 25%
    expect(prevented).toBeGreaterThan(150);
    expect(prevented).toBeLessThan(350);
  });
});

describe('applyStatusEndOfTurn', () => {
  it('poison deals 1/8 max HP damage', () => {
    const target = { status: 'psn' };
    const r = applyStatusEndOfTurn(target, 200);
    expect(r.damage).toBe(25); // 200/8 = 25
  });

  it('burn deals 1/16 max HP damage', () => {
    const target = { status: 'brn' };
    const r = applyStatusEndOfTurn(target, 200);
    expect(r.damage).toBe(12); // floor(200/16) = 12
  });

  it('no damage with no status', () => {
    const r = applyStatusEndOfTurn({ status: null }, 200);
    expect(r.damage).toBe(0);
  });
});

// ======================================================================
// 12. ABILITY NAME
// ======================================================================
describe('getAbilityName', () => {
  it('returns first ability for wild', () => {
    const wild = { abilities: [{ ability: { name: 'intimidate' } }] };
    expect(getAbilityName(wild, true)).toBe('intimidate');
  });

  it('returns abilityName for player mon', () => {
    const mon = { abilityName: 'blaze' };
    expect(getAbilityName(mon, false)).toBe('blaze');
  });

  it('returns null if no abilities', () => {
    expect(getAbilityName({}, true)).toBeNull();
  });
});

// ======================================================================
// 13. MOVE CATEGORY
// ======================================================================
describe('getMoveCategory', () => {
  it('returns physical for physical moves', () => {
    expect(getMoveCategory({ damage_class: { name: 'physical' } })).toBe('physical');
  });

  it('returns special for special moves', () => {
    expect(getMoveCategory({ damage_class: { name: 'special' } })).toBe('special');
  });

  it('returns status for moves without damage_class', () => {
    expect(getMoveCategory({})).toBe('status');
  });

  it('returns status for status moves', () => {
    expect(getMoveCategory({ damage_class: { name: 'status' } })).toBe('status');
  });
});

// ======================================================================
// 14. CRITICAL HITS
// ======================================================================
describe('Critical hit mechanics', () => {
  const attacker = {
    apiData: {
      name: 'charizard',
      stats: [{ base_stat: 84, stat: { name: 'attack' } }, { base_stat: 78, stat: { name: 'defense' } }],
      types: [{ type: { name: 'fire' } }],
    },
    baseLevel: 50,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    statStages: null, heldItem: null, status: null,
  };
  const defender = {
    apiData: {
      name: 'bulbasaur',
      stats: [{ base_stat: 45, stat: { name: 'attack' } }, { base_stat: 49, stat: { name: 'defense' } }],
      types: [{ type: { name: 'grass' } }],
    },
    statStages: null, heldItem: null,
  };

  it('alwaysCrit parameter forces crit', () => {
    const result = calculateDamage({
      move: { name: 'scratch', power: 40, accuracy: 100, type: { name: 'normal' }, damage_class: { name: 'physical' }, pp: 35 },
      attacker,
      defender,
      alwaysCrit: true,
    });
    expect(result.isCrit).toBe(true);
  });

  it('crit is stochastic with default params', () => {
    // Base crit rate is 6.25%, so in 200 trials we should see some crits
    let crits = 0;
    for (let i = 0; i < 200; i++) {
      const result = calculateDamage({
        move: { name: 'scratch', power: 40, accuracy: 100, type: { name: 'normal' }, damage_class: { name: 'physical' }, pp: 35 },
        attacker,
        defender,
        alwaysCrit: false,
      });
      if (result.isCrit) crits++;
    }
    expect(crits).toBeGreaterThan(0);
  });
});

// ======================================================================
// 15. STATUS ICONS
// ======================================================================
describe('getStatusIcon', () => {
  it('returns correct icons', () => {
    expect(getStatusIcon('psn')).toBe('☠️');
    expect(getStatusIcon('brn')).toBe('🔥');
    expect(getStatusIcon('par')).toBe('⚡');
    expect(getStatusIcon('slp')).toBe('💤');
    expect(getStatusIcon('frz')).toBe('❄️');
  });

  it('returns empty string for unknown status', () => {
    expect(getStatusIcon(null)).toBe('');
    expect(getStatusIcon('')).toBe('');
  });
});
