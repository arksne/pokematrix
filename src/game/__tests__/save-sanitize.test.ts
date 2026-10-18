import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dedupeBadges, getFullSaveData, validateGameState } from '../save.js';
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

/**
 * Шкала IV каноническая 0–31 (её ждёт calculateStat в battle/stats.ts).
 * Генераторы диких/яиц/стартера исторически выдавали 0–50, из-за чего у
 * игроков разброс по генам был «где-то под 50, где-то 0», а монсы имели
 * завышенные статы. Старые сейвы чиним клампом на загрузке.
 */
describe('IV: шкала 0–31 (анти-разброс по генам)', () => {
  const IVS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

  beforeEach(() => {
    // validateGameState дёргает getTrainerId() → localStorage; в node его нет.
    vi.stubGlobal('localStorage', {
      _d: {} as Record<string, string>,
      getItem(k: string) { return this._d[k] ?? null; },
      setItem(k: string, v: string) { this._d[k] = String(v); },
      removeItem(k: string) { delete this._d[k]; },
    });
    resetState();
    (state as any).breedBoxes = [];
    (state as any).eggs = [];
  });

  it('команда: значения выше 31 и мусор клампятся/заменяются', () => {
    state.myTeam = [
      { apiData: { name: 'zapdos' }, uid: 'u1', maxHp: 100, currentHp: 100, baseLevel: 50,
        ivs: { hp: 50, atk: 44, def: 0, spa: 31, spd: 18, spe: 7 } } as any,
      { apiData: { name: 'mewtwo' }, uid: 'u2', maxHp: 100, currentHp: 100, baseLevel: 50,
        ivs: { hp: NaN, atk: undefined, def: -5, spa: 99, spd: 20, spe: 12 } } as any,
    ];
    validateGameState();
    const a = state.myTeam[0].ivs, b = state.myTeam[1].ivs;
    expect(a.hp).toBe(31); expect(a.atk).toBe(31); expect(a.def).toBe(0);
    expect(a.spa).toBe(31); expect(a.spd).toBe(18); expect(a.spe).toBe(7);
    expect(b.hp).toBe(15); expect(b.atk).toBe(15); expect(b.def).toBe(0);
    expect(b.spa).toBe(31); expect(b.spd).toBe(20); expect(b.spe).toBe(12);
    for (const mon of state.myTeam) {
      for (const st of IVS) {
        expect(mon.ivs[st]).toBeGreaterThanOrEqual(0);
        expect(mon.ivs[st]).toBeLessThanOrEqual(31);
      }
    }
  });

  it('ПК, бокса разведения и яйца тоже чинятся', () => {
    state.pcBoxes = [[{ uid: 'p1', ivs: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 } } as any]];
    (state as any).breedBoxes = [{ mons: [{ uid: 'b1', ivs: { hp: 44, atk: 12, def: 31, spa: 0, spd: 60, spe: 20 } } as any] }];
    (state as any).eggs = [{ id: 'e1', ivs: { hp: 50, atk: 33, def: 8, spa: 31, spd: 21, spe: 14 } }];
    validateGameState();
    const box = (state.pcBoxes[0] as any[])[0].ivs;
    for (const st of IVS) expect(box[st]).toBe(31);
    const bb = (state as any).breedBoxes[0].mons[0].ivs;
    expect(bb.hp).toBe(31); expect(bb.atk).toBe(12); expect(bb.def).toBe(31);
    expect(bb.spa).toBe(0); expect(bb.spd).toBe(31); expect(bb.spe).toBe(20);
    const egg = (state as any).eggs[0].ivs;
    expect(egg.hp).toBe(31); expect(egg.atk).toBe(31); expect(egg.def).toBe(8);
    expect(egg.spa).toBe(31); expect(egg.spd).toBe(21); expect(egg.spe).toBe(14);
  });

  it('валидные IV 0–31 не трогаются', () => {
    const ivs = { hp: 31, atk: 0, def: 15, spa: 22, spd: 7, spe: 31 };
    state.myTeam = [{ apiData: { name: 'mew' }, uid: 'u3', maxHp: 90, currentHp: 90,
      baseLevel: 40, ivs: { ...ivs } } as any];
    validateGameState();
    expect(state.myTeam[0].ivs).toEqual(ivs);
  });
});
