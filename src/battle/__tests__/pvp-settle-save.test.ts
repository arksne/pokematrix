import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Гонка сейва конца боя: endPvP слал pvp_end и ТУТ ЖЕ autoSave() с протухшей
 * версией. Серверный сеттл поднимал save_version параллельно → POST /save
 * получал 409 → resolveSaveConflict видел свежеоштампованное облако «новее»
 * → applyCloudSave + тост «Загружена более новая версия» ровно в момент
 * окончания быстрого боя (~15с). Фикс: сейв отложен до pvp_reward /
 * pvp_arena_update (deferSettleSave / confirmSettleSave).
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
import { endPvP, deferSettleSave, confirmSettleSave } from '../pvp-core.js';

const autoSaveMock = autoSave as unknown as ReturnType<typeof vi.fn>;

function resetState() {
  state.pvpBattleId = null;
  state.settlePending = false;
  state.pvpEndSent = false;
  if (state.settleTimer) { clearTimeout(state.settleTimer); state.settleTimer = null; }
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
    expect(state.settlePending).toBe(true);
  });

  it('confirmSettleSave сохраняет один раз и снимает флаг', () => {
    state.settlePending = true;
    confirmSettleSave();
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
    expect(state.settlePending).toBe(false);
    confirmSettleSave();
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
  });

  it('без defer settle ничего не сохраняет', () => {
    confirmSettleSave();
    expect(autoSaveMock).not.toHaveBeenCalled();
  });

  it('фолбэк-таймер досылает сейв через 4с без подтверждения', () => {
    vi.useFakeTimers();
    deferSettleSave();
    expect(autoSaveMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
    expect(state.settlePending).toBe(false);
  });

  it('подтверждение до фолбэка отменяет таймер (без двойного сейва)', () => {
    vi.useFakeTimers();
    deferSettleSave();
    confirmSettleSave();
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(autoSaveMock).toHaveBeenCalledTimes(1);
  });

  it('двойной endPvP (hp_update + fainted) шлёт pvp_end один раз', () => {
    state.pvpBattleId = 'pvp_x';
    endPvP(true);
    endPvP(true);
    const ends = state.socket.emit.mock.calls.filter((c: any[]) => c[0] === 'pvp_end');
    expect(ends.length).toBe(1);
    expect(autoSaveMock).not.toHaveBeenCalled();
    expect(state.settlePending).toBe(true);
  });

  it('AFK-таймаут (announce=false): pvp_end не шлём, сейв отложен до pvp_reward', () => {
    state.pvpBattleId = 'pvp_timeout';
    endPvP(false, false);
    expect(state.socket.emit).not.toHaveBeenCalledWith(
      'pvp_end', expect.anything(),
    );
    expect(autoSaveMock).not.toHaveBeenCalled();
    expect(state.settlePending).toBe(true);
    expect(state.pvpBattleId).toBeNull();
  });
});
