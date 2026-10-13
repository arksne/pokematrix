import { describe, it, expect } from 'vitest';
import { RANKS, getRankByBadges, rankLabel, badgesToNextRank } from './ranks.js';

/**
 * Ранги тренера: лестница 0–16+ значков (Канто 8 + Джото 8).
 * Чистые функции — без DOM и state.
 */

describe('ranks data', () => {
  it('9 рангов, id уникальны, границы растут', () => {
    expect(RANKS.length).toBe(9);
    const ids = RANKS.map((r) => r.id);
    expect(new Set(ids).size).toBe(9);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minBadges).toBeGreaterThan(RANKS[i - 1].minBadges);
    }
    expect(RANKS[0].minBadges).toBe(0);
    expect(RANKS[RANKS.length - 1].minBadges).toBe(16);
  });
});

describe('getRankByBadges', () => {
  it('границы шкалы', () => {
    expect(getRankByBadges(0).id).toBe('novice');
    expect(getRankByBadges(1).id).toBe('apprentice');
    expect(getRankByBadges(2).id).toBe('apprentice');
    expect(getRankByBadges(3).id).toBe('seeker');
    expect(getRankByBadges(5).id).toBe('fighter');
    expect(getRankByBadges(7).id).toBe('veteran');
    expect(getRankByBadges(9).id).toBe('elite');
    expect(getRankByBadges(11).id).toBe('master');
    expect(getRankByBadges(14).id).toBe('champion');
    expect(getRankByBadges(16).id).toBe('legend');
    expect(getRankByBadges(99).id).toBe('legend');
  });

  it('мусор → новичок, не падает', () => {
    expect(getRankByBadges(undefined).id).toBe('novice');
    expect(getRankByBadges(null).id).toBe('novice');
    expect(getRankByBadges('5' as any).id).toBe('novice');
    expect(getRankByBadges(-3).id).toBe('novice');
    expect(getRankByBadges(NaN).id).toBe('novice');
  });
});

describe('rankLabel/badgesToNextRank', () => {
  it('подпись содержит иконку и имя', () => {
    expect(rankLabel(0)).toContain('Новичок');
    expect(rankLabel(16)).toContain('Легенда');
  });

  it('до следующего ранга', () => {
    expect(badgesToNextRank(0)).toBe(1);
    expect(badgesToNextRank(2)).toBe(1);
    expect(badgesToNextRank(15)).toBe(1);
    expect(badgesToNextRank(16)).toBe(0);
    expect(badgesToNextRank(99)).toBe(0);
  });
});
