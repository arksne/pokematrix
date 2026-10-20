import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyCloudSave, adoptServerSaveVersion } from '../save.js';
import { state } from '../state.js';

// applyCloudSave тянет localStorage (node-окружения нет) и ленивый импорт
// локаций — подменяем минимальными стабами.
const mem: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = String(v); },
  removeItem: (k: string) => { delete mem[k]; },
});
vi.mock('../../ui/location.js', () => ({
  getLocation: (id: string) => ({ id }),
}));

function resetState() {
  state.badges = [];
  state.myTeam = [];
  state.pcBoxes = [[]];
  state.inventory = { credit: 500 };
  state.pokedexSeen = new Set<string>() as any;
  state.pokedexCaught = new Set<string>() as any;
  state.visitedLocations = new Set<string>() as any;
  state.daycareMons = [];
  state.breedBoxes = [];
  state.eggs = [];
  state.quests = [];
  state.completedQuests = [];
  (state as any).pvpBattleId = null;
  (state as any).pvpMyMon = null;
  (state as any).pvpOppMon = null;
}

function mon(uid: string, hp: number) {
  return { uid, baseLevel: 50, currentHp: hp, maxHp: 100, apiData: { id: 25 } };
}

/**
 * Бой вылетал с тостом «Загружена более новая версия...»: resolveSaveConflict
 * принимал облако (сервер штампует _ts при каждой своей записи — награда PvP,
 * сжигание жетона), а applyCloudSave заменял команду облачной копией.
 * pvpMyMon оставался висящим на старом объекте с другим HP — бой разваливался.
 *
 * Правило: пока идёт бой (pvpBattleId выставлен), команда неприкосновенна:
 * локальное состояние боя новее любого облачного снимка.
 */
describe('applyCloudSave во время боя', () => {
  beforeEach(resetState);

  it('не трогает команду и pvpMyMon, версию из облака принимает', async () => {
    state.myTeam = [mon('m1', 12)];
    (state as any).pvpBattleId = 'pvp_test_1';
    (state as any).pvpMyMon = state.myTeam[0];
    const cloud = {
      myTeam: [mon('m1', 100)],
      inventory: { credit: 999 },
      badges: [],
      pcBoxes: [[]],
      _v: 1,
      _ts: Date.now(),
    };
    await applyCloudSave(cloud as any);
    expect(state.myTeam[0].currentHp).toBe(12);
    expect((state as any).pvpMyMon).toBe(state.myTeam[0]);
    expect((state as any).pvpBattleId).toBe('pvp_test_1');
  });

  it('без боя слияние идёт как раньше (облако побеждает по uid)', async () => {
    state.myTeam = [mon('m1', 12)];
    const cloud = {
      myTeam: [mon('m1', 100)],
      inventory: { credit: 999 },
      badges: [],
      pcBoxes: [[]],
      _v: 1,
      _ts: Date.now(),
    };
    await applyCloudSave(cloud as any);
    expect(state.myTeam[0].currentHp).toBe(100);
  });
});

describe('adoptServerSaveVersion', () => {
  beforeEach(resetState);

  it('принимает версию сервера и кладёт в localStorage', () => {
    adoptServerSaveVersion(42);
    expect(state.saveVersion).toBe(42);
  });

  it('игнорирует мусор', () => {
    state.saveVersion = 7;
    adoptServerSaveVersion(undefined);
    adoptServerSaveVersion('9' as any);
    adoptServerSaveVersion(NaN);
    expect(state.saveVersion).toBe(7);
  });
});
