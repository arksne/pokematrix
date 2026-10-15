import { describe, it, expect } from 'vitest';
import { clearLeechSeedFlags } from '../special-moves.js';

/**
 * Жалоба 2: «Лич сид работает на следующих диких даже после конца боя».
 * Корень — core.ts: seedPlayer/seedWild (types.ts:132) не чистились ни в
 * resetBattleField (216), ни в clearBattleState (266). Тик applyLeechSeedTick
 * бил и в следующем бою. Фикс — clearLeechSeedFlags в обоих местах.
 */
describe('leech-seed — флаги сида не живут между боями', () => {
  it('чистит оба флага', () => {
    const s: any = { seedPlayer: true, seedWild: true };
    clearLeechSeedFlags(s);
    expect(s.seedPlayer).toBe(false);
    expect(s.seedWild).toBe(false);
  });

  it('чистит только засеянного игрока', () => {
    const s: any = { seedPlayer: true, seedWild: false };
    clearLeechSeedFlags(s);
    expect(s.seedPlayer).toBe(false);
    expect(s.seedWild).toBe(false);
  });

  it('чистит только засеянного дикого', () => {
    const s: any = { seedPlayer: false, seedWild: true };
    clearLeechSeedFlags(s);
    expect(s.seedPlayer).toBe(false);
    expect(s.seedWild).toBe(false);
  });

  it('пустое состояние — безопасно, возвращает тот же объект', () => {
    const s: any = {};
    const same = clearLeechSeedFlags(s);
    expect(same).toBe(s);
    expect(s.seedPlayer).toBe(false);
    expect(s.seedWild).toBe(false);
  });

  it('не трогает соседние поля боя', () => {
    const s: any = { seedPlayer: true, seedWild: true, battleRound: 5, wildCurHP: 42 };
    clearLeechSeedFlags(s);
    expect(s.battleRound).toBe(5);
    expect(s.wildCurHP).toBe(42);
  });
});
