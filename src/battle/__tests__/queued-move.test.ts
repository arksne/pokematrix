import { describe, it, expect } from 'vitest';
import { isQueuedMoveStale } from '../core.js';

/**
 * N1: упавший покемон не «передаёт» свою атаку замене.
 * Репро хозяина: Wing Attack заказана за Aerodactyl, быстрый дикий убивает
 * его до хода, выходит Farfetch'd — и бьёт атакой мёртвого.
 */
describe('N1: queued-ход мёртвого отменяется', () => {
  it('тот же покемон — ход не протух', () => {
    const mon = { name: 'aerodactyl', currentHp: 10 };
    expect(isQueuedMoveStale(mon, mon)).toBe(false);
  });

  it('активный сменился (автозамена после faint) — ход протух', () => {
    const dead = { name: 'aerodactyl', currentHp: 0 };
    const replacement = { name: 'farfetchd', currentHp: 50 };
    expect(isQueuedMoveStale(dead, replacement)).toBe(true);
  });

  it('активного нет вообще (поражение) — тоже протух', () => {
    expect(isQueuedMoveStale({ name: 'x' }, null)).toBe(true);
    expect(isQueuedMoveStale({ name: 'x' }, undefined)).toBe(true);
  });

  it('до заказа хода никого не было — нечего отменять', () => {
    expect(isQueuedMoveStale(null, { name: 'x' })).toBe(false);
    expect(isQueuedMoveStale(null, null)).toBe(false);
  });

  it('сравнение по ссылке, а не по имени (два одинаковых вида — разные объекты)', () => {
    const a = { name: 'pikachu', currentHp: 0 };
    const b = { name: 'pikachu', currentHp: 30 };
    expect(isQueuedMoveStale(a, b)).toBe(true);
  });
});
