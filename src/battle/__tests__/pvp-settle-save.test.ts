import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Гонка сейва конца боя: endPvP слал pvp_end и ТУТ ЖЕ autoSave() с протухшей
 * версией. Серверный сеттл поднимал save_version параллельно → POST /save
 * получал 409 → resolveSaveConflict видел свежеоштампованное облако «новее»
 * → applyCloudSave + тост «Загружена более новая версия» ровно в момент
 * окончания быстрого боя (~15с). Фикс: сейв отложен до pvp_reward /
 * pvp_arena_update (deferBattleEndSave / settleBattleEndSave).
 */
vi.mock('../../game/save.js', () => ({ autoSave: vi.fn() }));
vi.mock('../../utils/dom.js', () => ({ showToast: vi.fn() }));
vi.mock('../../ui/location.js', () => ({ updateMoneyDisplay: vi.fn() }));
vi.mock('../../ui/achievements.js', () => ({ checkAchievement: vi.fn() }));
vi.mock('../../data/sitemove.js', () => ({ fetchSiteMoveDetail: vi.fn() }));
vi.mock('../../utils/sprite.js', () => ({ getSpriteUrl: () => '' }));
vi.mock('../../game/store.js', () => ({ store: { emit: vi.fn() } }));

vi.stubGlobal('document', {
  getElementById: () => ({ style: {}, addEventListener: () => {} }),
});

import { state } from '../../game/state.js';
import { autoSave } from '../../game/save.js';
import { endPvP, deferBattleEndSave, settleBattleEndSave } from '../pvp-core.js';

const autoSaveMock = autoSave as unknown as ReturnType<typeof vi.fn>;

function resetState() {
  state.pvpBattleId = null;
  state.pvpSettlePending = false;
  if (state.pvpSettleTimer) { clearTimeout(state.pvpSettleTimer); state.pvpSettleTimer = null; }
  state.saveDirty = false;
  state.socket = { emit: vi.fn() };
  autoSaveMock.mockClear();
}

describe('отложенный сейв конца боя', () => {
  beforeEach(() => { vi.useRealTimers(); resetState(); });
  afterEach(() => { vi.useRealTimers(); resetState(); });

  it('endPvP с announce НЕ сохраняет сразу, а откладывает до сеттла', () => {
    state.pvpBattleId = 'pvp_x';
    endPvP(true);
    expect(state.socket.emit).toHaveBeenCalledWith(
      'pvp_end', { battleId: 'pvp_x', action: { type: 'win' } },
    );
    expect(state.pvpBattleId).toBeNull();
    expect(autoSaveMock).not.toHaveBeenCalled();
    expect(state.pvpSettlePending).toBe(true);
  });

  it('settleBattleEndSave сохраняет один раз и снимает флаг', () => {
    state.pvpSettlePending = true;
    settleBattleEndSave();
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
    expect(state.pvpSettlePending).toBe(false);
    settleBattleEndSave();
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
  });

  it('без defer settle ничего не сохраняет', () => {
    settleBattleEndSave();
    expect(autoSaveMock).not.toHaveBeenCalled();
  });

  it('фолбэк-таймер досылает сейв через 4с без подтверждения', () => {
    vi.useFakeTimers();
    deferBattleEndSave();
    expect(autoSaveMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
    expect(state.pvpSettlePending).toBe(false);
  });

  it('подтверждение до фолбэка отменяет таймер (без двойного сейва)', () => {
    vi.useFakeTimers();
    deferBattleEndSave();
    settleBattleEndSave();
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
  });

  it('AFK-таймаут (announce=false) сохраняется сразу: сеттла с версией там нет', () => {
    state.pvpBattleId = 'pvp_timeout';
    endPvP(false, false);
    expect(state.socket.emit).not.toHaveBeenCalledWith(
      'pvp_end', expect.anything(),
    );
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
    expect(state.pvpSettlePending).toBe(false);
  });
});
