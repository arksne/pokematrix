import { describe, it, expect } from 'vitest';
import {
  crushGripPower, flailPower, finalGambitDmg, flingPower, naturalGift,
  presentRoll, spitUpPower, swallowPct, lastRespectsPower, rageFistPower,
  populationBombHits, confuseChance, confusionTurns, confusionSelfHit,
  confusionDamage, attractBlocks, tauntBlocks, encoreForces, disableBlocks,
  tormentBlocks, perishTick, yawnWakes, WEATHER_SET, TERRAIN_SET,
  FIELD_TURNS, TAILWIND_TURNS, TRICK_ROOM_TURNS, collisionCourseMult,
  saltCureChip, resistantType, metronomePick, METRONOME_POOL, meFirstCopy,
  baseDefOf, effectivePowerMove, moveDealsDamage,
} from '../special-moves.js';

/** Проход-741, пачка 2: переменная сила, волатильные, поле, подмены. */
describe('crush-grip / wring-out', () => {
  it('120 × HP/max цели', () => {
    expect(crushGripPower(100, 100)).toBe(120);
    expect(crushGripPower(50, 100)).toBe(60);
    expect(crushGripPower(1, 100)).toBe(1);
    expect(crushGripPower(0, 100)).toBe(1);
    expect(crushGripPower(10, 0)).toBe(1);
  });
});

describe('flail / reversal', () => {
  it('таблица по доле HP', () => {
    expect(flailPower(100, 100)).toBe(20);
    expect(flailPower(70, 100)).toBe(20);
    expect(flailPower(69, 100)).toBe(40);
    expect(flailPower(35, 100)).toBe(40);
    expect(flailPower(34, 100)).toBe(80);
    expect(flailPower(20, 100)).toBe(80);
    expect(flailPower(19, 100)).toBe(100);
    expect(flailPower(10, 100)).toBe(100);
    expect(flailPower(9, 100)).toBe(150);
    expect(flailPower(5, 100)).toBe(150);
    expect(flailPower(4, 100)).toBe(200);
    expect(flailPower(1, 100)).toBe(200);
  });

  it('мусорный макс — безопасный дефолт', () => {
    expect(flailPower(10, 0)).toBe(20);
  });
});

describe('final-gambit', () => {
  it('урон равен текущему HP', () => {
    expect(finalGambitDmg(80)).toBe(80);
    expect(finalGambitDmg(0)).toBe(0);
  });
});

describe('fling', () => {
  it('таблица + категории', () => {
    expect(flingPower('iron-ball')).toBe(130);
    expect(flingPower('stick')).toBe(60);
    expect(flingPower('cheri-berry', 'berries')).toBe(10);
    expect(flingPower('poke-ball', 'balls')).toBe(30);
    expect(flingPower('potion', 'healing')).toBe(30);
    expect(flingPower(null)).toBe(30);
  });
});

describe('natural-gift', () => {
  it('ягода → сила 80 и тип', () => {
    expect(naturalGift('cheri-berry')).toEqual({ power: 80, type: 'fire' });
    expect(naturalGift('yache-berry')).toEqual({ power: 80, type: 'ice' });
    expect(naturalGift('неягода')).toEqual({ power: 80, type: 'normal' });
    expect(naturalGift(null)).toBeNull();
    expect(naturalGift('')).toBeNull();
  });
});

describe('present', () => {
  it('распределение 40/30/10/20', () => {
    expect(presentRoll(() => 0.0)).toEqual({ kind: 'dmg', power: 40 });
    expect(presentRoll(() => 0.39)).toEqual({ kind: 'dmg', power: 40 });
    expect(presentRoll(() => 0.4)).toEqual({ kind: 'dmg', power: 80 });
    expect(presentRoll(() => 0.69)).toEqual({ kind: 'dmg', power: 80 });
    expect(presentRoll(() => 0.7)).toEqual({ kind: 'dmg', power: 120 });
    expect(presentRoll(() => 0.79)).toEqual({ kind: 'dmg', power: 120 });
    expect(presentRoll(() => 0.8)).toEqual({ kind: 'heal' });
    expect(presentRoll(() => 0.99)).toEqual({ kind: 'heal' });
  });
});

describe('stockpile / spit-up / swallow', () => {
  it('spit-up: 100 × заряды, 0 — провал', () => {
    expect(spitUpPower(1)).toBe(100);
    expect(spitUpPower(3)).toBe(300);
    expect(spitUpPower(9)).toBe(300);
    expect(spitUpPower(0)).toBeNull();
    expect(spitUpPower(null)).toBeNull();
  });

  it('swallow: 25/50/100 по зарядам', () => {
    expect(swallowPct(1)).toBe(25);
    expect(swallowPct(2)).toBe(50);
    expect(swallowPct(3)).toBe(100);
    expect(swallowPct(0)).toBeNull();
  });
});

describe('last-respects / rage-fist / population-bomb', () => {
  it('last-respects: 50 + 50 за павшего', () => {
    expect(lastRespectsPower(0)).toBe(50);
    expect(lastRespectsPower(3)).toBe(200);
    expect(lastRespectsPower(-2)).toBe(50);
  });

  it('rage-fist: 50 + 50 за попадание', () => {
    expect(rageFistPower(0)).toBe(50);
    expect(rageFistPower(4)).toBe(250);
  });

  it('population-bomb: 1–10 ударов', () => {
    expect(populationBombHits(() => 0.99)).toBe(1);
    expect(populationBombHits(() => 0.0)).toBe(10);
    for (let i = 0; i < 20; i++) {
      const h = populationBombHits();
      expect(h).toBeGreaterThanOrEqual(1);
      expect(h).toBeLessThanOrEqual(10);
    }
  });
});

describe('замешательство', () => {
  it('шансы по таблице', () => {
    expect(confuseChance('supersonic')).toBe(55);
    expect(confuseChance('confuse-ray')).toBe(100);
    expect(confuseChance('water-pulse')).toBe(20);
    expect(confuseChance('tackle')).toBe(0);
    expect(confuseChance('chatter')).toBe(0);
  });

  it('ходы 1–4, самобитие 1/3', () => {
    expect(confusionTurns(() => 0)).toBe(1);
    expect(confusionTurns(() => 0.999)).toBe(4);
    expect(confusionSelfHit(() => 0.0)).toBe(true);
    expect(confusionSelfHit(() => 0.5)).toBe(false);
  });

  it('урон себе считается и не ноль', () => {
    const d = confusionDamage(100, 80, 50);
    expect(d).toBeGreaterThan(0);
    expect(confusionDamage(0, 0, 0)).toBeGreaterThan(0);
  });
});

describe('волатильные проверки', () => {
  it('attract: разные полы — 50%, иначе нет', () => {
    expect(attractBlocks('male', 'female', () => 0.0)).toBe(true);
    expect(attractBlocks('male', 'female', () => 0.9)).toBe(false);
    expect(attractBlocks('male', 'male', () => 0.0)).toBe(false);
    expect(attractBlocks(null, 'female', () => 0.0)).toBe(false);
    expect(attractBlocks('genderless', 'female', () => 0.0)).toBe(false);
  });

  it('taunt блокирует не дамажащие', () => {
    expect(tauntBlocks({ power: 80 })).toBe(false);
    expect(tauntBlocks({ power: null })).toBe(true);
  });

  it('encore заставляет повторять', () => {
    const vol = { encore: { move: 'tackle', turns: 3 } };
    expect(encoreForces(vol, 'growl')).toBe('tackle');
    expect(encoreForces(vol, 'tackle')).toBeNull();
    expect(encoreForces({}, 'growl')).toBeNull();
    expect(encoreForces({ encore: { move: 'x', turns: 0 } }, 'growl')).toBeNull();
  });

  it('disable блокирует одну атаку', () => {
    const vol = { disable: { move: 'tackle', turns: 2 } };
    expect(disableBlocks(vol, 'tackle')).toBe(true);
    expect(disableBlocks(vol, 'growl')).toBe(false);
    expect(disableBlocks({}, 'tackle')).toBe(false);
  });

  it('torment запрещает повтор', () => {
    expect(tormentBlocks({ torment: true, lastMove: 'tackle' }, 'tackle')).toBe(true);
    expect(tormentBlocks({ torment: true, lastMove: 'tackle' }, 'growl')).toBe(false);
    expect(tormentBlocks({}, 'tackle')).toBe(false);
  });

  it('perish-song тикает до обморока', () => {
    expect(perishTick({ perish: 3 })).toEqual({ faint: false, left: 2 });
    expect(perishTick({ perish: 1 })).toEqual({ faint: true, left: 0 });
    expect(perishTick({})).toEqual({ faint: false, left: 0 });
    expect(perishTick(undefined)).toEqual({ faint: false, left: 0 });
  });

  it('yawn будит только без статуса', () => {
    expect(yawnWakes(null)).toBe(true);
    expect(yawnWakes('psn')).toBe(false);
  });
});

describe('поле боя', () => {
  it('погода и террейн маппятся', () => {
    expect(WEATHER_SET['sunny-day']).toBe('sun');
    expect(WEATHER_SET['rain-dance']).toBe('rain');
    expect(WEATHER_SET['snowscape']).toBe('hail');
    expect(TERRAIN_SET['electric-terrain']).toBe('electric');
    expect(TERRAIN_SET['misty-terrain']).toBe('misty');
    expect(FIELD_TURNS).toBe(5);
    expect(TAILWIND_TURNS).toBe(4);
    expect(TRICK_ROOM_TURNS).toBe(5);
  });

  it('collision-course ×4/3 только по суперэффективной', () => {
    expect(collisionCourseMult(2)).toBeCloseTo(4 / 3, 5);
    expect(collisionCourseMult(1)).toBe(1);
    expect(collisionCourseMult(0.5)).toBe(1);
    expect(collisionCourseMult(0)).toBe(1);
  });

  it('salt-cure: 1/8, по стали/воде 1/4', () => {
    expect(saltCureChip(80, ['normal'])).toBe(10);
    expect(saltCureChip(80, ['steel'])).toBe(20);
    expect(saltCureChip(80, ['water', 'flying'])).toBe(20);
    expect(saltCureChip(0, ['normal'])).toBe(0);
  });

  it('resistantType находит устойчивость', () => {
    const chart = {
      fire: { grass: 2, water: 0.5, fire: 0.5 },
      water: { fire: 2, grass: 0.5 },
      normal: { rock: 0.5, ghost: 0 },
    };
    expect(resistantType('fire', chart)).toBe('water');
    expect(resistantType('unknown-type', chart)).toBeNull();
    expect(resistantType(null, chart)).toBeNull();
  });
});

describe('подмены', () => {
  it('metronome отдаёт боеспособную атаку', () => {
    const m = metronomePick(() => 0);
    expect(m.power).toBeGreaterThan(0);
    expect(m.type?.name).toBeTruthy();
    expect(m.damage_class?.name).toMatch(/physical|special/);
    expect(METRONOME_POOL.length).toBeGreaterThanOrEqual(15);
  });

  it('me-first крадёт дамажащую с ×1.5', () => {
    const foe = { name: 'tackle', power: 40, type: { name: 'normal' } };
    const copy = meFirstCopy(foe);
    expect(copy.power).toBe(60);
    expect(copy.name).toBe('tackle');
    expect(meFirstCopy({ name: 'growl', power: null })).toBeNull();
    expect(meFirstCopy(null)).toBeNull();
  });

  it('baseDefOf читает защиту вида', () => {
    const mon = { apiData: { stats: [{ stat: { name: 'defense' }, base_stat: 90 }] } };
    expect(baseDefOf(mon, false)).toBe(90);
    expect(baseDefOf({}, false)).toBe(50);
  });

  it('effectivePowerMove не трогает обычные атаки', () => {
    const m = { name: 'tackle', power: 40 };
    expect(effectivePowerMove(m, {}, {}, 100, 100, false)).toBe(m);
    const gk = effectivePowerMove(
      { name: 'grass-knot', power: null },
      {}, { weight: 200 }, 100, 100, false,
    );
    expect(gk.power).toBe(40); // 20 кг → 40
    const gyro = effectivePowerMove(
      { name: 'gyro-ball', power: null }, {}, {}, 50, 100, false,
    );
    expect(gyro.power).toBe(51);
  });

  it('counter-семья — дамажащие (идут в ветку урона)', () => {
    for (const n of ['counter', 'mirror-coat', 'metal-burst', 'comeuppance']) {
      expect(moveDealsDamage({ name: n, power: null }), n).toBe(true);
    }
    expect(moveDealsDamage({ name: 'splash', power: null })).toBe(false);
  });
});
