import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkAccuracy, stageMultiplier, statChangeKey } from '../logic.js';

/**
 * Точность/уклонение как статы боя.
 *
 * Нашлось при аудите «описано, но не работает»: stat_changes из PokeAPI
 * понимал только пять статов, а accuracy/evasion — нет. Поэтому Sand Attack,
 * Double Team, Flash, Smokescreen, Kinesis и Sweet Scent ничего не делали:
 * play-лог писал «Но ничего не произошло...».
 */
describe('statChangeKey — имена статов из PokeAPI', () => {
  it('пять обычных статов', () => {
    expect(statChangeKey('attack')).toBe('atk');
    expect(statChangeKey('defense')).toBe('def');
    expect(statChangeKey('special-attack')).toBe('spa');
    expect(statChangeKey('special-defense')).toBe('spd');
    expect(statChangeKey('speed')).toBe('spe');
  });

  it('точность и уклонение (раньше падали в null → ход «ничего не произошло»)', () => {
    expect(statChangeKey('accuracy')).toBe('acc');
    expect(statChangeKey('evasion')).toBe('eva');
  });

  it('неизвестный стат — null', () => {
    expect(statChangeKey('crit-rate')).toBeNull();
    expect(statChangeKey('')).toBeNull();
    expect(statChangeKey(null as any)).toBeNull();
  });
});

describe('stageMultiplier — канонные множители стадий', () => {
  it('положительные стадии', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(1)).toBeCloseTo(4 / 3, 6);
    expect(stageMultiplier(2)).toBeCloseTo(5 / 3, 6);
    expect(stageMultiplier(3)).toBe(2);
    expect(stageMultiplier(6)).toBe(3);
  });

  it('отрицательные стадии', () => {
    expect(stageMultiplier(-1)).toBeCloseTo(3 / 4, 6);
    expect(stageMultiplier(-2)).toBeCloseTo(3 / 5, 6);
    expect(stageMultiplier(-3)).toBeCloseTo(0.5, 6);
    expect(stageMultiplier(-6)).toBeCloseTo(1 / 3, 6);
  });

  it('стадии за пределами ±6 обрезаются, мусор даёт 1', () => {
    expect(stageMultiplier(9)).toBe(3);
    expect(stageMultiplier(-9)).toBeCloseTo(1 / 3, 6);
    expect(stageMultiplier(Number.NaN)).toBe(1);
  });
});

describe('checkAccuracy — способность Tangled Feet', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Способность была помечена implemented:true, но в коде не встречалась:
  // в замешательстве уклонение не росло.
  it('в замешательстве уклонение выше (точность ×0.75)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.78);
    const move = { accuracy: 100, name: 'tackle' };
    expect(checkAccuracy(move, null, 'tangled-feet', 'clear').hit).toBe(true);
    expect(checkAccuracy(move, null, 'tangled-feet', 'clear', null, 0, 0, true).hit).toBe(false);
  });

  it('без замешательства бонуса нет', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.78);
    const move = { accuracy: 100, name: 'tackle' };
    expect(checkAccuracy(move, null, 'tangled-feet', 'clear', null, 0, 0, false).hit).toBe(true);
  });

  it('другая способность в замешательстве не помогает', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.78);
    const move = { accuracy: 100, name: 'tackle' };
    expect(checkAccuracy(move, null, 'levitate', 'clear', null, 0, 0, true).hit).toBe(true);
  });
});

describe('checkAccuracy — стадии точности/уклонения', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Sand Attack (−1 точность): удар 100% может промахнуться', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // 80 < 100 без стадий
    const move = { accuracy: 100, name: 'tackle' };
    expect(checkAccuracy(move).hit).toBe(true);
    // 100 × 0.75 = 75 → 80 >= 75 → промах
    expect(checkAccuracy(move, null, null, 'clear', null, -1, 0).hit).toBe(false);
  });

  it('Double Team (+1 уклонение): удар 100% может промахнуться', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const move = { accuracy: 100, name: 'tackle' };
    // 100 / (4/3) = 75 → 80 >= 75 → промах
    expect(checkAccuracy(move, null, null, 'clear', null, 0, 1).hit).toBe(false);
  });

  it('бонус точности атакующего возвращает попадание', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const move = { accuracy: 60, name: 'hydro-pump' };
    // 60 × 0.75 = 45 → 90 >= 45 → промах; но с +2 точности: 60 × 5/3 = 100 → попадание
    expect(checkAccuracy(move, null, null, 'clear', null, -1, 0).hit).toBe(false);
    expect(checkAccuracy(move, null, null, 'clear', null, 2, 0).hit).toBe(true);
  });

  it('стадии не ломают атаки без промаха', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(checkAccuracy({ accuracy: null, name: 'swift' }, null, null, 'clear', null, -6, 6).hit).toBe(true);
  });
});
