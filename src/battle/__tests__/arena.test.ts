import { describe, it, expect } from 'vitest';
import {
  ARENA_TOKEN_ID,
  ARENA_TOKEN_PRICE,
  arenaRewardForStreak,
  hasArenaToken,
  nextArenaStreak,
  sortArenaLeaders,
} from '../arena.js';

/**
 * Unit-тесты PvP-Арены (M-18): чистая логика без DOM и сокетов.
 * Протокол и серверные проверки — в tools/verify/economy.test.mjs (E6/E7).
 */
describe('арена: жетон', () => {
  it('ID и цена жетона зафиксированы', () => {
    expect(ARENA_TOKEN_ID).toBe('arenaToken');
    expect(ARENA_TOKEN_PRICE).toBe(5000);
  });

  it('гейт пускает только с жетоном', () => {
    expect(hasArenaToken({ arenaToken: 1 })).toBe(true);
    expect(hasArenaToken({ arenaToken: 3, credit: 500 })).toBe(true);
    expect(hasArenaToken({})).toBe(false);
    expect(hasArenaToken({ arenaToken: 0 })).toBe(false);
    expect(hasArenaToken({ credit: 999999 })).toBe(false);
    expect(hasArenaToken(null)).toBe(false);
    expect(hasArenaToken(undefined)).toBe(false);
  });
});

describe('арена: призы за стрик', () => {
  it('стрик 1 деньгами равен обычному PvP (+500)', () => {
    expect(arenaRewardForStreak(1).money).toBe(500);
  });

  it('таблица наград зафиксирована', () => {
    expect(arenaRewardForStreak(1)).toEqual({ money: 500, items: [{ id: 'potion', qty: 1 }] });
    expect(arenaRewardForStreak(2)).toEqual({ money: 800, items: [{ id: 'superPotion', qty: 1 }] });
    expect(arenaRewardForStreak(3)).toEqual({ money: 1200, items: [{ id: 'greatBall', qty: 2 }] });
    expect(arenaRewardForStreak(4)).toEqual({ money: 2000, items: [{ id: 'ultraBall', qty: 2 }] });
    expect(arenaRewardForStreak(5)).toEqual({ money: 3000, items: [{ id: 'rareCandy', qty: 1 }] });
  });

  it('деньги строго растут 1→5', () => {
    const ms = [1, 2, 3, 4, 5].map((s) => arenaRewardForStreak(s).money);
    expect(ms).toEqual([...ms].sort((a, b) => a - b));
    expect(new Set(ms).size).toBe(5);
  });

  it('каждый тир даёт предмет', () => {
    for (let s = 1; s <= 5; s++) {
      const r = arenaRewardForStreak(s);
      expect(r.items.length).toBeGreaterThan(0);
      expect(r.items.every((i) => i.qty >= 1)).toBe(true);
    }
  });

  it('границы клампятся: 0/мусор → тир 1, 99 → тир 5', () => {
    expect(arenaRewardForStreak(0)).toEqual(arenaRewardForStreak(1));
    expect(arenaRewardForStreak(-3)).toEqual(arenaRewardForStreak(1));
    expect(arenaRewardForStreak(NaN)).toEqual(arenaRewardForStreak(1));
    expect(arenaRewardForStreak(99)).toEqual(arenaRewardForStreak(5));
    expect(arenaRewardForStreak(6)).toEqual(arenaRewardForStreak(5));
  });

  it('награды — свежие объекты (мутация не течёт между вызовами)', () => {
    const a = arenaRewardForStreak(3);
    a.items.push({ id: 'x', qty: 1 });
    expect(arenaRewardForStreak(3).items.length).toBe(1);
  });
});

describe('арена: стрик', () => {
  it('победа +1, поражение сбрасывает в 0', () => {
    expect(nextArenaStreak(true, 0)).toBe(1);
    expect(nextArenaStreak(true, 4)).toBe(5);
    expect(nextArenaStreak(false, 4)).toBe(0);
    expect(nextArenaStreak(false, 0)).toBe(0);
  });

  it('мусор вместо текущего считается нулём', () => {
    expect(nextArenaStreak(true, undefined)).toBe(1);
    expect(nextArenaStreak(true, -2)).toBe(1);
  });
});

describe('арена: таблица лидеров', () => {
  it('победы важнее лучшего стрика', () => {
    const rows = [
      { userId: 1, wins: 2, best: 9 },
      { userId: 2, wins: 5, best: 1 },
      { userId: 3, wins: 5, best: 4 },
    ];
    expect([...rows].sort(sortArenaLeaders).map((r) => r.userId)).toEqual([3, 2, 1]);
  });
});
