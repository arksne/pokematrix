import { describe, it, expect, beforeEach } from 'vitest';
import { dedupeBadges, getFullSaveData } from '../save.js';
import { state } from '../state.js';

/**
 * Санация сейва: дубли значков + NaN (анти-422).
 * NaN в числах превращается JSON'ом в null, а серверный Zod отвечает 422
 * на каждый сейв. getFullSaveData обязан отдавать только конечные числа.
 */

function resetState() {
  state.badges = [];
  state.myTeam = [];
  state.pcBoxes = [[]];
  state.inventory = { credit: 500 };
  state.pokedexSeen = new Set<string>();
  state.pokedexCaught = new Set<string>();
  state.visitedLocations = new Set<string>();
  state.quests = [];
  state.questProgress = {};
  state.completedQuests = [];
  state.npcQuestProgress = {};
  state.completedNPCQuests = [];
  state.achievements = [];
  state.daycareMons = [];
  state.breedBoxes = [];
  state.breedingPairs = [];
  state.eggs = [];
  state.notifications = [];
}

describe('dedupeBadges', () => {
  it('режет дубли, хранит порядок', () => {
    expect(dedupeBadges(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('32 вместо 16 — чинится', () => {
    const gyms = Array.from({ length: 16 }, (_, i) => `G${i}`);
    expect(dedupeBadges([...gyms, ...gyms])).toEqual(gyms);
  });

  it('мусор отбрасывается', () => {
    expect(dedupeBadges(['a', '', null, 5, 'b'] as any)).toEqual(['a', 'b']);
    expect(dedupeBadges('nope' as any)).toEqual([]);
  });
});

describe('getFullSaveData: без NaN', () => {
  beforeEach(resetState);

  it('NaN-счастье/EV/опыт превращаются в дефолты', () => {
    state.myTeam = [{
      uid: 'm1', baseLevel: 5, maxHp: 50, currentHp: 50,
      apiData: null, ivs: { hp: NaN }, evs: null,
      happiness: NaN, evPool: NaN, exp: NaN,
      candiesEaten: 0, vitaminsEaten: 0,
    } as any];
    const data = getFullSaveData();
    const m = data.myTeam[0];
    expect(Number.isFinite(m.happiness)).toBe(true);
    expect(Number.isFinite(m.evPool)).toBe(true);
    expect(Number.isFinite(m.exp)).toBe(true);
    expect(Object.values(m.ivs).every(Number.isFinite)).toBe(true);
    expect(Object.values(m.evs).every(Number.isFinite)).toBe(true);
  });

  it('JSON сейва не содержит null в числовых полях покемона', () => {
    state.myTeam = [{
      uid: 'm1', baseLevel: NaN, maxHp: NaN, currentHp: NaN,
      happiness: NaN, evPool: NaN, exp: NaN, expToNext: NaN,
      candiesEaten: NaN, vitaminsEaten: NaN, trainingStage: NaN,
      trainingFails: NaN, natureIdx: NaN, sleepTurns: NaN,
      ivs: null, evs: null, apiData: null,
      movesPP: [{ current: NaN, max: NaN }, null],
    } as any];
    const json = JSON.parse(JSON.stringify(getFullSaveData()));
    const m = json.myTeam[0];
    for (const k of ['baseLevel', 'maxHp', 'happiness', 'evPool', 'exp',
      'expToNext', 'candiesEaten', 'vitaminsEaten', 'trainingStage',
      'trainingFails', 'natureIdx', 'sleepTurns']) {
      expect(typeof m[k], k).toBe('number');
    }
    expect(m.movesPP).toEqual([{ current: 0, max: 1 }]);
  });
});

describe('completedQuests: только строки (анти-422)', () => {
  beforeEach(resetState);

  it('объекты-наследие превращаются в id', () => {
    (state as any).completedQuests = [
      'catch_5',
      { id: 'earn_1000', date: '2026-10-01' },
      null,
      42,
    ];
    const data = getFullSaveData();
    expect(data.completedQuests).toEqual(['catch_5', 'earn_1000']);
  });
});
