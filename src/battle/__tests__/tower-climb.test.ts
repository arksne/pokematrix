import { describe, it, expect } from 'vitest';
import { climbFloor, nextFloor, towerLevel, towerCap } from '../special-loc.js';

/**
 * M-4, этажи башен: явный подъём.
 *
 * Контракт: вход в башню даёт 1-й этаж (nextFloor), перерисовка этаж
 * не двигает, выход наружу сбрасывает в 0 (location.ts). Рост дальше —
 * только climbFloor по кнопке «Подняться», с cap = floors. Сила врагов
 * растёт через towerLevel(), которую getWildLevel уже учитывает.
 */

const tower5 = { kind: 'tower', floors: 5, perFloorLvl: 3 } as any;
const dark = { kind: 'dark', darkRate: 0.3 } as any;

describe('climbFloor', () => {
  it('подъём +1 от входа', () => {
    expect(climbFloor(1, tower5)).toBe(2);
    expect(climbFloor(3, tower5)).toBe(4);
  });

  it('cap: выше floors не подняться', () => {
    expect(climbFloor(5, tower5)).toBe(5);
    expect(climbFloor(99, tower5)).toBe(5);
  });

  it('с нуля — первый этаж', () => {
    expect(climbFloor(0, tower5)).toBe(1);
    expect(climbFloor(undefined as any, tower5)).toBe(1);
  });

  it('мусор не ломает: дроби и отрицательные', () => {
    expect(climbFloor(2.7, tower5)).toBe(3);
    expect(climbFloor(-4, tower5)).toBe(1);
  });

  it('не башня — этаж не трогаем', () => {
    expect(climbFloor(3, dark)).toBe(3);
    expect(climbFloor(3, null)).toBe(3);
    expect(climbFloor(0, null)).toBe(0);
  });

  it('без floors — дефолт 10', () => {
    expect(climbFloor(9, { kind: 'tower' } as any)).toBe(10);
    expect(climbFloor(10, { kind: 'tower' } as any)).toBe(10);
  });
});

describe('подъём реально усиливает врагов (связка с towerLevel)', () => {
  it('этаж 1 → 5 даёт +perFloorLvl за каждый подъём', () => {
    const base = 10;
    expect(towerLevel(base, climbFloor(1, tower5), 3)).toBe(base + 2 * 3);
    expect(towerLevel(base, climbFloor(4, tower5), 3)).toBe(base + 5 * 3);
    // Потолок башни совпадает с cap подъёма
    expect(towerCap(base, tower5)).toBe(base + (5 - 1) * 3);
  });

  it('контракт входа не сломан: извне — 1, ререндер — 0', () => {
    expect(nextFloor('route3', 'mtMoon', tower5)).toBe(1);
    expect(nextFloor('mtMoon', 'mtMoon', tower5)).toBe(0);
  });
});
