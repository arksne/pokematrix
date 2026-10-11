import { describe, it, expect } from 'vitest';
import { isFirstGymWin } from '../gym-reward.js';

/** N4: гимы можно проходить повторно, но награда — только за первую победу. */
describe('N4: первая победа vs реванш', () => {
  it('без значка — первая победа', () => {
    expect(isFirstGymWin([], 'Boulder Badge')).toBe(true);
  });

  it('значок уже есть — реванш', () => {
    expect(isFirstGymWin(['Boulder Badge'], 'Boulder Badge')).toBe(false);
  });

  it('другой значок не мешает первой победе здесь', () => {
    expect(isFirstGymWin(['Cascade Badge'], 'Boulder Badge')).toBe(true);
  });

  it('мусор вместо массива — не первая победа (не выдаём награду вслепую)', () => {
    expect(isFirstGymWin(null, 'Boulder Badge')).toBe(false);
    expect(isFirstGymWin(undefined, 'Boulder Badge')).toBe(false);
    expect(isFirstGymWin('Boulder Badge', 'Boulder Badge')).toBe(false);
  });
});
