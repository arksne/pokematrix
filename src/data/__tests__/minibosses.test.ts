// ─────────────────────────────────────────────────────────────
// minibosses.test.ts — 15 мини-боссов лесенки (docs/QUESTS-LADDER.md)
// ─────────────────────────────────────────────────────────────
// Проверяет:
//   1. Все 15 ключей существуют в gymLeaders.
//   2. friendly === true, badgeName === '', moneyReward === 0.
//   3. Размеры и уровни команд совпадают с лесенкой (3×33 … 6×88).
// ─────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { gymLeaders } from '../gyms.js';

type MiniBoss = {
  friendly: boolean;
  badgeName: string;
  moneyReward: number;
  team: Array<{ name: string; level: number }>;
};

const leaders = gymLeaders as unknown as Record<string, MiniBoss>;

// Лесенка из docs/QUESTS-LADDER.md, разделы городов 1–15 (босс + команда).
// Формат: ключ записи = filter.bossId будущих квестов.
const EXPECTED: Record<string, { size: number; level: number; team: string[] }> = {
  ceruleanFinn: { size: 3, level: 33, team: ['psyduck', 'poliwhirl', 'tentacruel'] },
  vermilionVolt: { size: 3, level: 38, team: ['pikachu', 'magneton', 'electabuzz'] },
  celadonFlora: { size: 4, level: 43, team: ['bellsprout', 'exeggcute', 'tangela', 'vileplume'] },
  saffronEsper: { size: 4, level: 48, team: ['drowzee', 'kadabra', 'mr-mime', 'hypno'] },
  fuchsiaApprentice: { size: 4, level: 53, team: ['koffing', 'grimer', 'ekans', 'arbok'] },
  cinnabarBlaze: { size: 4, level: 58, team: ['ponyta', 'growlithe', 'magmar', 'rapidash'] },
  viridianAgent: { size: 5, level: 63, team: ['cubone', 'rhyhorn', 'diglett', 'dugtrio', 'marowak'] },
  violetSky: { size: 5, level: 68, team: ['pidgeotto', 'fearow', 'noctowl', 'skarmory', 'dodrio'] },
  azaleaSwarm: { size: 5, level: 73, team: ['parasect', 'venomoth', 'scyther', 'heracross', 'forretress'] },
  goldenrodNorm: { size: 5, level: 78, team: ['raticate', 'clefable', 'wigglytuff', 'persian', 'porygon'] },
  ecruteakShade: { size: 6, level: 83, team: ['gastly', 'haunter', 'haunter', 'misdreavus', 'gengar', 'gengar'] },
  cianwoodPupil: { size: 6, level: 88, team: ['primeape', 'machoke', 'hitmonlee', 'hitmonchan', 'machamp', 'heracross'] },
  olivineSteel: { size: 6, level: 88, team: ['magneton', 'forretress', 'skarmory', 'steelix', 'scizor', 'magneton'] },
  mahoganyFrost: { size: 6, level: 88, team: ['dewgong', 'cloyster', 'sneasel', 'piloswine', 'delibird', 'jynx'] },
  blackthornHeir: { size: 6, level: 88, team: ['dragonair', 'kingdra', 'dragonair', 'kingdra', 'dragonite', 'dragonite'] },
};

const KEYS = Object.keys(EXPECTED);

describe('minibosses (лесенка, 15 городов)', () => {
  it('все 15 ключей существуют в gymLeaders', () => {
    expect(KEYS).toHaveLength(15);
    for (const key of KEYS) {
      expect(leaders[key], `missing key: ${key}`).toBeDefined();
    }
  });

  it('friendly === true, badgeName === "", moneyReward === 0', () => {
    for (const key of KEYS) {
      expect(leaders[key].friendly, `${key}.friendly`).toBe(true);
      expect(leaders[key].badgeName, `${key}.badgeName`).toBe('');
      expect(leaders[key].moneyReward, `${key}.moneyReward`).toBe(0);
    }
  });

  it('размеры и уровни команд совпадают с лесенкой (3×33 … 6×88)', () => {
    for (const key of KEYS) {
      const exp = EXPECTED[key];
      const team = leaders[key].team;
      expect(team.length, `${key}.size`).toBe(exp.size);
      for (const mon of team) {
        expect(mon.level, `${key}.${mon.name}.level`).toBe(exp.level);
      }
      expect(team.map((m) => m.name), `${key}.team`).toEqual(exp.team);
    }
  });
});
