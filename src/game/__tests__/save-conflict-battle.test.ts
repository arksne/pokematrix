import { describe, it, expect, beforeEach, vi } from 'vitest';
import { doCloudSave, applyCloudSave, adoptServerSaveVersion } from '../save.js';
import { state, lsKey } from '../state.js';

/**
 * Сценарий вылета из боя: «Загружена более новая версия...» посреди PvP.
 *
 * Механика: сервер поднимает save_version при каждой своей записи (награда
 * PvP, сжигание жетона), а клиент узнавал версию только из ответов /save.
 * Первый же автосейв после такой записи получал 409 → resolveSaveConflict
 * видел облако «новее» (сервер только что штамповал _ts) → applyCloudSave
 * перезаписывал команду облачной копией прямо посреди боя, pvpMyMon
 * оставался висеть на старом объекте — бой разваливался с тем самым тостом.
 *
 * Тест едет полным путём doCloudSave → 409 → конфликт → облако новее:
 * команда обязана уцелеть, версия — подтянуться.
 */
const mem: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = String(v); },
  removeItem: (k: string) => { delete mem[k]; },
});
vi.stubGlobal('document', { getElementById: () => null });
vi.mock('../../utils/dom.js', () => ({
  showToast: vi.fn(),
  showConfirmModal: vi.fn(),
  escHtml: (s: string) => String(s),
}));
vi.mock('../ui/location.js', () => ({
  getLocation: (id: string) => ({ id }),
}));
vi.mock('../apiClient.js', () => ({
  apiFetch: vi.fn(),
  getCloudAuthHeaders: () => ({}),
}));

const CLOUD_TS = Date.now();
const cloudSave = {
  myTeam: [{ uid: 'm-1', baseLevel: 50, currentHp: 100, maxHp: 100, apiData: { id: 25 } }],
  inventory: { credit: 500, pokeBall: 5 },
  badges: [],
  pcBoxes: [[]],
  _ts: CLOUD_TS,
};

function resetState() {
  (state as any).tgUser = { id: 777 };
  state.myTeam = [];
  state.pcBoxes = [[]];
  state.inventory = { credit: 500 };
  state.badges = [];
  state.pokedexSeen = new Set<string>() as any;
  state.pokedexCaught = new Set<string>() as any;
  state.visitedLocations = new Set<string>() as any;
  state.quests = [];
  state.completedQuests = [];
  (state as any).pvpBattleId = null;
  (state as any).pvpMyMon = null;
  (state as any).saveVersion = 0;
  (state as any).saveInProgress = false;
  (state as any).tgToken = 'test-token';
  for (const k of Object.keys(mem)) delete mem[k];
  localStorage.setItem(lsKey('save_ts'), '1000');
}

describe('вылет из боя при 409 посреди PvP', () => {
  beforeEach(resetState);

  it('бой выживает: команда не трогается, версия догоняет сервер', async () => {
    const { apiFetch } = await import('../apiClient.js');
    (apiFetch as any).mockImplementation(async (path: string, opts: any) => {
      if (opts?.method === 'POST') {
        return { ok: false, status: 409, json: async () => ({ serverVersion: 999 }) };
      }
      return { ok: true, status: 200, json: async () => ({ saveData: cloudSave, saveVersion: 999 }) };
    });

    // Идёт бой: мон побит до 12 HP, ход у нас.
    state.myTeam = [{
      uid: 'm-1', baseLevel: 50, currentHp: 12, maxHp: 100,
      apiData: { id: 25 }, originalTrainer: 't', createdAt: 1,
      ivs: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    } as any];
    state.pvpBattleId = 'pvp_test_clash';
    state.pvpMyMon = state.myTeam[0];
    state.saveVersion = 5; // протухла: сервер уже на 999 (награда прошлого боя)

    await doCloudSave();

    // Бой цел: HP боевое, объект тот же, battleId на месте...
    expect(state.myTeam[0].currentHp).toBe(12);
    expect(state.pvpMyMon).toBe(state.myTeam[0]);
    expect(state.pvpBattleId).toBe('pvp_test_clash');
    // ...а версия догнала сервер — следующий автосейв не 409ит.
    expect(state.saveVersion).toBe(999);
  });
});
