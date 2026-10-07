import { describe, it, expect } from 'vitest';
import { tmTierAllows } from '../tm.js';

/**
 * Тиры ТМ (B5): слабая <60 — 200к, средняя ≤90 — 2М, топ — 20М.
 * Legacy 'tm' без ограничений. Статусным (power null) разрешён любой тир.
 */

describe('tmTierAllows', () => {
  it('legacy tm: всё разрешено', () => {
    expect(tmTierAllows('tm', 120)).toBe(true);
    expect(tmTierAllows('tm', null)).toBe(true);
  });

  it('tmWeak: до 59 + статусные', () => {
    expect(tmTierAllows('tmWeak', 40)).toBe(true);
    expect(tmTierAllows('tmWeak', 59)).toBe(true);
    expect(tmTierAllows('tmWeak', 60)).toBe(false);
    expect(tmTierAllows('tmWeak', 120)).toBe(false);
    expect(tmTierAllows('tmWeak', null)).toBe(true);
  });

  it('tmMid: до 90', () => {
    expect(tmTierAllows('tmMid', 90)).toBe(true);
    expect(tmTierAllows('tmMid', 91)).toBe(false);
  });

  it('tmTop: всё', () => {
    expect(tmTierAllows('tmTop', 250)).toBe(true);
    expect(tmTierAllows('tmTop', null)).toBe(true);
  });

  it('неизвестный диск: ничего', () => {
    expect(tmTierAllows('tmUltra', 10)).toBe(false);
  });
});
