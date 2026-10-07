import { describe, it, expect } from 'vitest';
import { mergeMonLists, getFullSaveData } from '../save.js';
import { state } from '../state.js';

/**
 * Слияние сейвов по uid (защита от stale-cloud: сервер штампует _ts при
 * каждой своей правке, и облако может быть «новее по времени, но старее
 * по составу» — прямая замена удаляла свежий локальный прогресс).
 * Правило: общий uid — версия из облака; uid только с одной стороны — живёт.
 */

const byUid = (m: any) => m?.uid;

describe('mergeMonLists', () => {
  it('общий uid: побеждает облачная версия', () => {
    const out = mergeMonLists(
      [{ uid: 'a', level: 5 }],
      [{ uid: 'a', level: 7 }],
      byUid,
    );
    expect(out).toEqual([{ uid: 'a', level: 7 }]);
  });

  it('uid только локально: выживает', () => {
    const out = mergeMonLists(
      [{ uid: 'a' }, { uid: 'local-new' }],
      [{ uid: 'a' }],
      byUid,
    );
    expect(out.map((m) => m.uid).sort()).toEqual(['a', 'local-new']);
  });

  it('uid только в облаке: забирается', () => {
    const out = mergeMonLists(
      [{ uid: 'a' }],
      [{ uid: 'a' }, { uid: 'other-device' }],
      byUid,
    );
    expect(out.map((m) => m.uid).sort()).toEqual(['a', 'other-device']);
  });

  it('облака нет: локальный список как есть', () => {
    const local = [{ uid: 'a' }];
    expect(mergeMonLists(local, undefined, byUid)).toBe(local);
  });

  it('дубли внутри одного списка схлопываются', () => {
    const out = mergeMonLists(
      [{ uid: 'a' }, { uid: 'a' }],
      [{ uid: 'a' }],
      byUid,
    );
    expect(out).toEqual([{ uid: 'a' }]);
  });

  it('записи без uid игнорируются, а не плодятся', () => {
    const out = mergeMonLists([{}], [{ uid: 'a' }], byUid);
    expect(out).toEqual([{ uid: 'a' }]);
  });
});

describe('getFullSaveData: персист флагов', () => {
  it('hasBred и evPool попадают в сейв команды и боксов', () => {
    const prevTeam = state.myTeam;
    const prevPc = state.pcBoxes;
    const prevInv = state.inventory;
    try {
      const mon = (uid: string, extra: any = {}) => ({
        uid,
        originalTrainer: 't',
        createdAt: 1,
        caughtLocation: 'x',
        apiData: null,
        maxHp: 50,
        currentHp: 50,
        ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        baseLevel: 5,
        ...extra,
      });
      state.myTeam = [mon('m1', { hasBred: true, evPool: 7 })];
      state.pcBoxes = [[mon('m2', { hasBred: false, evPool: 0 })]];
      state.inventory = { credit: 500 };
      state.badges = [];
      state.pokedexSeen = new Set();
      state.pokedexCaught = new Set();
      state.visitedLocations = new Set();
      state.daycareMons = [];
      state.breedingPairs = [];
      state.eggs = [];
      state.notifications = [];
      const data = getFullSaveData();
      expect(data.myTeam[0].hasBred).toBe(true);
      expect(data.myTeam[0].evPool).toBe(7);
      expect(data.pcBoxes[0][0].hasBred).toBe(false);
      expect(data.pcBoxes[0][0].evPool).toBe(0);
    } finally {
      state.myTeam = prevTeam;
      state.pcBoxes = prevPc;
      state.inventory = prevInv;
    }
  });

  it('isShiny и EV-лок переживают сейв (команда и боксы)', () => {
    const prevTeam = state.myTeam;
    const prevPc = state.pcBoxes;
    const prevInv = state.inventory;
    try {
      const mon = (uid: string, extra: any = {}) => ({
        uid,
        originalTrainer: 't',
        createdAt: 1,
        caughtLocation: 'x',
        apiData: null,
        maxHp: 50,
        currentHp: 50,
        ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        baseLevel: 5,
        ...extra,
      });
      state.myTeam = [mon('s1', { isShiny: true, evsLocked: true, trainingFails: 3, evVitMigrated: true })];
      state.pcBoxes = [[mon('s2', { isShiny: true, evsLocked: false, trainingFails: 0 })]];
      state.inventory = { credit: 500 };
      state.badges = [];
      state.pokedexSeen = new Set();
      state.pokedexCaught = new Set();
      state.visitedLocations = new Set();
      state.daycareMons = [];
      state.breedingPairs = [];
      state.eggs = [];
      state.notifications = [];
      const data = getFullSaveData();
      expect(data.myTeam[0].isShiny).toBe(true);
      expect(data.myTeam[0].evsLocked).toBe(true);
      expect(data.myTeam[0].trainingFails).toBe(3);
      expect(data.myTeam[0].evVitMigrated).toBe(true);
      expect(data.pcBoxes[0][0].isShiny).toBe(true);
      expect(data.pcBoxes[0][0].evsLocked).toBe(false);
    } finally {
      state.myTeam = prevTeam;
      state.pcBoxes = prevPc;
      state.inventory = prevInv;
    }
  });
});
