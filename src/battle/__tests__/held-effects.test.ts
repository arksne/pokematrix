import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  accuracyModForDefenderHeldItem,
  onWaterDamage,
  onIntimidated,
  BRIGHT_POWDER_ACCURACY_MOD,
} from '../held-effects.js';
import { checkAccuracy } from '../logic.js';

/**
 * Предметы, которые продавались за ¥4000 без единого эффекта:
 * brightPowder, absorbBulb, adrenalineOrb. Правила вынесены сюда и закрыты
 * тестами, чтобы предмет снова не оказался пустышкой.
 */
describe('Bright Powder — уклонение', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('множитель точности 0.9 только у владельца brightPowder', () => {
    expect(accuracyModForDefenderHeldItem('brightPowder')).toBe(BRIGHT_POWDER_ACCURACY_MOD);
    expect(accuracyModForDefenderHeldItem('leftovers')).toBe(1);
    expect(accuracyModForDefenderHeldItem(null)).toBe(1);
    expect(accuracyModForDefenderHeldItem(undefined)).toBe(1);
  });

  it('атака 95% попадает по обычной цели и промахивается по brightPowder', () => {
    // Math.random 0.93: 93 < 95 → попадание; 93 < 85.5 → промах.
    vi.spyOn(Math, 'random').mockReturnValue(0.93);
    const move = { accuracy: 95, name: 'test-move' };
    expect(checkAccuracy(move, null, null, 'clear').hit).toBe(true);
    expect(checkAccuracy(move, null, null, 'clear', 'brightPowder').hit).toBe(false);
  });

  it('атаки с accuracy 90 без предмета бьют, с brightPowder — мимо при том же ролле', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.88);
    const move = { accuracy: 90, name: 'test-move' };
    expect(checkAccuracy(move, null, null, 'clear').hit).toBe(true);
    expect(checkAccuracy(move, null, null, 'clear', 'brightPowder').hit).toBe(false);
  });

  it('атаки без промаха (accuracy null) не страдают', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(checkAccuracy({ accuracy: null, name: 'swift' }, null, null, 'clear', 'brightPowder').hit).toBe(true);
  });
});

describe('Absorb Bulb — вода → +1 Спец. атака', () => {
  it('срабатывает только на водный урон и расходуется', () => {
    const boost = onWaterDamage('absorbBulb', 'water');
    expect(boost).toEqual({ stat: 'spa', delta: 1, consume: true, message: expect.stringContaining('Спец. атака +1') });
  });

  it('не срабатывает на другие типы', () => {
    expect(onWaterDamage('absorbBulb', 'fire')).toBeNull();
    expect(onWaterDamage('absorbBulb', 'electric')).toBeNull();
    expect(onWaterDamage('absorbBulb', null)).toBeNull();
  });

  it('не срабатывает, если предмета нет', () => {
    expect(onWaterDamage(null, 'water')).toBeNull();
    expect(onWaterDamage('leftovers', 'water')).toBeNull();
  });
});

describe('Adrenaline Orb — Intimidate → +1 скорость', () => {
  it('срабатывает на испуг и расходуется', () => {
    const boost = onIntimidated('adrenalineOrb');
    expect(boost).toEqual({ stat: 'spe', delta: 1, consume: true, message: expect.stringContaining('Скорость +1') });
  });

  it('не срабатывает без предмета', () => {
    expect(onIntimidated(null)).toBeNull();
    expect(onIntimidated('brightPowder')).toBeNull();
  });
});
