import { describe, it, expect } from 'vitest';
import { calcCatchExp } from '../special-moves.js';

/**
 * Жалоба 7: «за ловлю тоже опыт капать должен» (спека 1.5).
 * Корень — core.ts: обработчик успешной поимки (setTimeout после броска)
 * создавал покемона, но EXP не выдавал. Фикс — там же выдаём EXP активному
 * как в handleWildFaintRewards (baseExp × уровень / 7, Lucky Egg/double_exp/
 * Training Grounds, EXP Share, level-up, EV в пул через grantLevelUpEVs).
 * Здесь — чистое ядро формулы (тестируется без DOM/S).
 */
describe('catch-exp — формула baseExp × уровень / 7', () => {
  it('база: 50×5/7=35', () => {
    expect(calcCatchExp(50, 5)).toBe(35);
  });

  it('канон: 100×10/7=142', () => {
    expect(calcCatchExp(100, 10)).toBe(142);
  });

  it('легенда: 255×100/7=3642', () => {
    expect(calcCatchExp(255, 100)).toBe(Math.floor((255 * 100) / 7));
  });

  it('ноль/мусор — 0, а не NaN', () => {
    expect(calcCatchExp(0, 10)).toBe(0);
    expect(calcCatchExp(50, 0)).toBe(0);
    expect(calcCatchExp(null, 5)).toBe(0);
    expect(calcCatchExp(50, null)).toBe(0);
    expect(calcCatchExp(undefined, undefined)).toBe(0);
  });

  it('дроби режутся вниз', () => {
    // 60×7/7=60 ровно; 60×8/7=68.57→68.
    expect(calcCatchExp(60, 7)).toBe(60);
    expect(calcCatchExp(60, 8)).toBe(68);
  });
});
