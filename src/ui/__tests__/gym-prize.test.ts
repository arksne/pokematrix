import { describe, it, expect } from 'vitest';
import { rollGymPrize } from '../gym-reward.js';

/**
 * Приз гима: 50/50 — супердарки ×1–10 или случайный мон лидера.
 * Чистый розыгрыш, без DOM.
 */
const TEAM = [{ name: 'geodude' }, { name: 'onix' }, { name: 'rhyhorn' }];

describe('rollGymPrize', () => {
  it('пустая команда — null', () => {
    expect(rollGymPrize([])).toBeNull();
    expect(rollGymPrize(null as any)).toBeNull();
  });

  it('первый бросок < 0.5 — мячи, количество 1–10', () => {
    // второй бросок задаёт qty: 0 → 1, 0.99 → 10
    expect(rollGymPrize(TEAM, (() => { let i = 0; return () => [0.1, 0][i++]; })())).toEqual({ type: 'balls', qty: 1 });
    expect(rollGymPrize(TEAM, (() => { let i = 0; return () => [0.1, 0.99][i++]; })())).toEqual({ type: 'balls', qty: 10 });
    expect(rollGymPrize(TEAM, (() => { let i = 0; return () => [0.49, 0.5][i++]; })())).toEqual({ type: 'balls', qty: 6 });
  });

  it('первый бросок >= 0.5 — мон строго из команды лидера', () => {
    for (const r of [0.5, 0.7, 0.99]) {
      const p = rollGymPrize(TEAM, () => r);
      expect(p?.type).toBe('mon');
      if (p?.type === 'mon') {
        expect(TEAM.map((m) => m.name)).toContain(p.name);
      }
    }
  });

  it('распределение примерно 50/50 на большой выборке', () => {
    let balls = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (rollGymPrize(TEAM)?.type === 'balls') balls++;
    }
    expect(balls).toBeGreaterThan(N * 0.4);
    expect(balls).toBeLessThan(N * 0.6);
  });
});
