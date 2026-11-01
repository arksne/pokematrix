import { describe, it, expect } from 'vitest';
import { checkGymEntry, gymEntryRequirements, gymMaxLevel, GYM_MIN_ALIVE } from '../gym-entry.js';

/**
 * Условия входа в зал (game-spec §2 п.1): 4+ живых, уникальные типы,
 * уровень не выше уровня лидера. Раньше игрок узнавал об этом только после
 * нажатия «Сразиться!» — теперь условия видны в модалке зала, и та же функция
 * валидирует старт боя.
 */

function mon(over: any = {}): any {
  return {
    currentHp: 10,
    baseLevel: 10,
    candiesEaten: 0,
    nickname: '',
    apiData: { name: 'geodude', types: [{ type: { name: 'rock' } }] },
    ...over,
  };
}

const leader = { team: [{ level: 40 }, { level: 40 }, { level: 40 }, { level: 40 }] };

describe('gymMaxLevel', () => {
  it('берёт максимальный уровень команды лидера', () => {
    expect(gymMaxLevel(leader)).toBe(40);
    expect(gymMaxLevel({ team: [{ level: 12 }, { level: 17 }, { level: 15 }] })).toBe(17);
  });

  it('пустая команда — 0, без падения', () => {
    expect(gymMaxLevel({ team: [] })).toBe(0);
    expect(gymMaxLevel({} as any)).toBe(0);
  });
});

describe('gymEntryRequirements', () => {
  it('перечисляет все три условия и уровень лидера', () => {
    const text = gymEntryRequirements(leader);
    expect(text).toContain('4+ живых');
    expect(text).toContain('уникальные типы');
    expect(text).toContain('≤ 40');
  });

  it('для лидера без данных об уровнях не врёт про число', () => {
    const text = gymEntryRequirements({ team: [] });
    expect(text).toContain('не выше лидера');
    expect(text).not.toMatch(/≤\s*0/);
  });
});

describe('checkGymEntry', () => {
  it('пускает команду из 4 живых с уникальными типами и уровнем ≤ лидера', () => {
    const team = [
      mon({ apiData: { name: 'a', types: [{ type: { name: 'rock' } }] } }),
      mon({ apiData: { name: 'b', types: [{ type: { name: 'water' } }] } }),
      mon({ apiData: { name: 'c', types: [{ type: { name: 'fire' } }] } }),
      mon({ apiData: { name: 'd', types: [{ type: { name: 'grass' } }] } }),
    ];
    expect(checkGymEntry(team, leader)).toEqual({ ok: true, error: null });
  });

  it('меньше 4 живых — отказ с понятным текстом', () => {
    const team = [mon(), mon({ apiData: { name: 'b', types: [{ type: { name: 'water' } }] } }), mon({ apiData: { name: 'c', types: [{ type: { name: 'fire' } }] } })];
    const res = checkGymEntry(team, leader);
    expect(res.ok).toBe(false);
    expect(res.error).toContain(`${GYM_MIN_ALIVE}`);
    expect(res.error).toContain('живых покемона');
  });

  it('без сознания не считаются: 4 в команде, но 1 живой — отказ', () => {
    const team = [
      mon({ currentHp: 5 }),
      mon({ currentHp: 0 }),
      mon({ currentHp: 0 }),
      mon({ currentHp: 0 }),
    ];
    expect(checkGymEntry(team, leader).ok).toBe(false);
  });

  it('покемон выше лидера — отказ и перечисление виновников', () => {
    const team = [
      mon({ baseLevel: 45, nickname: 'Rocker' }),
      mon({ baseLevel: 10, apiData: { name: 'b', types: [{ type: { name: 'water' } }] } }),
      mon({ baseLevel: 10, apiData: { name: 'c', types: [{ type: { name: 'fire' } }] } }),
      mon({ baseLevel: 10, apiData: { name: 'd', types: [{ type: { name: 'grass' } }] } }),
    ];
    const res = checkGymEntry(team, leader);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Rocker');
    expect(res.error).toContain('макс 40');
  });

  it('конфеты повышают уровень и тоже учитываются', () => {
    const team = [
      mon({ baseLevel: 39, candiesEaten: 5 }),
      mon({ baseLevel: 10, apiData: { name: 'b', types: [{ type: { name: 'water' } }] } }),
      mon({ baseLevel: 10, apiData: { name: 'c', types: [{ type: { name: 'fire' } }] } }),
      mon({ baseLevel: 10, apiData: { name: 'd', types: [{ type: { name: 'grass' } }] } }),
    ];
    expect(checkGymEntry(team, leader).ok).toBe(false);
  });

  it('повторяющиеся основные типы — отказ', () => {
    const team = [
      mon({ apiData: { name: 'a', types: [{ type: { name: 'rock' } }] } }),
      mon({ apiData: { name: 'b', types: [{ type: { name: 'rock' } }] } }),
      mon({ apiData: { name: 'c', types: [{ type: { name: 'fire' } }] } }),
      mon({ apiData: { name: 'd', types: [{ type: { name: 'grass' } }] } }),
    ];
    const res = checkGymEntry(team, leader);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('повторяющиеся типы');
    expect(res.error).toContain('rock');
  });

  it('второй тип не считается дублем (уникальность — по основному)', () => {
    const team = [
      mon({ apiData: { name: 'a', types: [{ type: { name: 'rock' } }, { type: { name: 'ground' } }] } }),
      mon({ apiData: { name: 'b', types: [{ type: { name: 'water' } }, { type: { name: 'ground' } }] } }),
      mon({ apiData: { name: 'c', types: [{ type: { name: 'fire' } }] } }),
      mon({ apiData: { name: 'd', types: [{ type: { name: 'grass' } }] } }),
    ];
    expect(checkGymEntry(team, leader).ok).toBe(true);
  });

  it('null/undefined команда не роняет проверку', () => {
    expect(checkGymEntry(null, leader).ok).toBe(false);
    expect(checkGymEntry(undefined, leader).ok).toBe(false);
    expect(checkGymEntry([null, undefined] as any, leader).ok).toBe(false);
  });
});
