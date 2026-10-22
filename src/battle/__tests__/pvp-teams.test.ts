import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Командные PvP-бои: нокаут НЕ кончает бой, пока есть живые; смена тратит ход;
 * ожидание замены с фолбэком 15с; XP участникам; закрытие чужого боя игнором.
 */
vi.mock('../../game/save.js', () => ({ autoSave: vi.fn(), adoptServerSaveVersion: vi.fn() }));
vi.mock('../../utils/dom.js', () => ({ showToast: vi.fn(), escHtml: (s: string) => String(s) }));
vi.mock('../../ui/location.js', () => ({ updateMoneyDisplay: vi.fn() }));
vi.mock('../../ui/achievements.js', () => ({ checkAchievement: vi.fn() }));
vi.mock('../../data/sitemove.js', () => ({ fetchSiteMoveDetail: vi.fn(async () => ({})) }));
vi.mock('../../utils/sprite.js', () => ({ getSpriteUrl: () => '' }));
vi.mock('../../game/store.js', () => ({ store: { emit: vi.fn() } }));
vi.mock('../../ui/inventory.js', () => ({ grantBattleExp: vi.fn(async () => 0) }));

const appended: any[] = [];
const els: Record<string, any> = {};
function makeEl(id = '') {
  return {
    id, textContent: '', innerHTML: '', style: {} as any,
    classList: { add: vi.fn(), remove: vi.fn() },
    src: '', onclick: null as any, dataset: {},
    appendChild(c: any) { appended.push(c); return c; },
  prepend(c: any) { appended.unshift(c); return c; },
    remove() {}, querySelectorAll: () => [], querySelector: () => null,
  };
}
vi.stubGlobal('document', {
  getElementById: (id: string) => els[id] || (els[id] = makeEl(id)),
  createElement: (tag: string) => makeEl(tag),
  body: { appendChild: (c: any) => { appended.push(c); return c; } },
});
vi.stubGlobal('alert', vi.fn());

import { state } from '../../game/state.js';
import {
  openPvpSwitchPicker, pvpPickFighter, handleMyFaint,
  waitPvpReplacement, clearPvpReplaceWait, grantPvpExp, closePvpModalIf, sendMyMonData,
} from '../pvp-core.js';

const mon = (uid: string, hp: number, lvl = 50) => ({
  uid, currentHp: hp, maxHp: 100, baseLevel: lvl, candiesEaten: 0,
  nickname: uid, apiData: { id: 25, name: 'pika', types: [{ type: { name: 'electric' } }], stats: [{ base_stat: 35 }, { base_stat: 55 }, { base_stat: 40 }, { base_stat: 50 }, { base_stat: 50 }, { base_stat: 90 }] },
  ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
});

function resetState() {
  for (const k of Object.keys(els)) delete els[k];
  appended.length = 0;
  state.pvpBattleId = 'pvp_team_test';
  state.pvpEndSent = false;
  state.settlePending = false;
  if (state.settleTimer) { clearTimeout(state.settleTimer); state.settleTimer = null; }
  state.pvpAwaitingReplacement = false;
  if (state.pvpReplaceTimer) { clearTimeout(state.pvpReplaceTimer); state.pvpReplaceTimer = null; }
  state.pvpParticipants = [];
  state.pvpEnemyLvls = [];
  state.pvpOppMon = null;
  state.pvpOppTeam = null;
  state.myTeam = [mon('m1', 0), mon('m2', 80), mon('m3', 100)];
  state.pvpMyMon = null;
  state.pvpMyTurn = true;
  state.socket = { emit: vi.fn() };
  vi.useRealTimers();
}

describe('командные бои', () => {
  beforeEach(resetState);

  it('handleMyFaint с живыми в запасе открывает выбор, pvp_end не шлёт', () => {
    state.pvpMyMon = state.myTeam[0]; // m1 упал (0 HP)
    handleMyFaint();
    const emits = (state.socket.emit as any).mock.calls.map((c: any[]) => c[0]);
    expect(emits).not.toContain('pvp_end');
    expect(state.pvpMyTurn).toBe(false);
    expect(appended.some((c: any) => c?.id === 'pvp-switch-modal')).toBe(true);
  });

  it('handleMyFaint без живых — поражение через pvp_end', () => {
    state.myTeam = [mon('m1', 0)];
    state.pvpMyMon = state.myTeam[0];
    handleMyFaint();
    const emits = (state.socket.emit as any).mock.calls;
    expect(emits.some((c: any[]) => c[0] === 'pvp_end'
      && c[1]?.action?.type === 'lose')).toBe(true);
    expect(state.pvpBattleId).toBeNull();
  });

  it('pvpPickFighter ставит мона, шлёт mon_data+switch, тратит ход', () => {
    state.pvpBattleId = 'pvp_x';
    pvpPickFighter(state.myTeam[1], 'switch');
    expect(state.pvpMyMon.uid).toBe('m2');
    const emitted = (state.socket.emit as any).mock.calls.map((c: any[]) => c[1]?.action?.type);
    expect(emitted).toContain('mon_data');
    expect(emitted).toContain('switch');
    expect(state.pvpMyTurn).toBe(false);
    expect(state.pvpParticipants).toContain('m2');
  });

  it('waitPvpReplacement ждёт, фолбэк 15с забирает победу', () => {
    vi.useFakeTimers();
    state.pvpBattleId = 'pvp_x';
    waitPvpReplacement();
    expect(state.pvpAwaitingReplacement).toBe(true);
    expect(state.pvpMyTurn).toBe(false);
    vi.advanceTimersByTime(15000);
    expect(state.pvpAwaitingReplacement).toBe(false);
    const emits = (state.socket.emit as any).mock.calls;
    expect(emits.some((c: any[]) => c[0] === 'pvp_end' && c[1]?.action?.type === 'win')).toBe(true);
  });

  it('clearPvpReplaceWait снимает ожидание и таймер', () => {
    state.pvpBattleId = 'pvp_x';
    state.pvpAwaitingReplacement = true;
    state.pvpReplaceTimer = setTimeout(() => {}, 10000) as any;
    clearPvpReplaceWait();
    expect(state.pvpAwaitingReplacement).toBe(false);
    expect(state.pvpReplaceTimer).toBeNull();
  });

  it('closePvpModalIf закрывает только свой бой', () => {
    state.pvpBattleId = 'pvp_a';
    const modal = document.getElementById('pvp-modal');
    (modal as any).style.display = 'flex';
    closePvpModalIf('pvp_other');
    expect(state.pvpBattleId).toBe('pvp_a');
    expect((modal as any).style.display).toBe('flex');
    closePvpModalIf('pvp_a');
    expect(state.pvpBattleId).toBeNull();
    expect((modal as any).style.display).toBe('none');
  });

  it('grantPvpExp: слабым больше, чужие не получают', async () => {
    const { grantBattleExp } = await import('../../ui/inventory.js');
    state.myTeam = [mon('m1', 50, 10), mon('m2', 50, 50), mon('mx', 50, 50)];
    state.pvpParticipants = ['m1', 'm2'];
    state.pvpEnemyLvls = [50];
    await grantPvpExp(true); // avgEnemy 50: m1(lvl10): 25*50/10=125; m2(lvl50): 25
    const calls = (grantBattleExp as any).mock.calls;
    const byUid: Record<string, number> = {};
    for (const [m, amount] of calls) byUid[m.uid] = amount;
    expect(byUid['m1']).toBe(125);
    expect(byUid['m2']).toBe(25);
    expect('mx' in byUid).toBe(false);
    expect(state.pvpParticipants).toEqual([]);
  });

  it('sendMyMonData несёт команду для баров соперника', () => {
    state.pvpBattleId = 'pvp_x';
    state.pvpMyMon = state.myTeam[1];
    sendMyMonData('pvp_x');
    const call = (state.socket.emit as any).mock.calls
      .find((c: any[]) => c[1]?.action?.type === 'mon_data');
    expect(call).toBeTruthy();
    expect(call[1].action.team).toHaveLength(3);
    expect(call[1].action.types).toContain('electric');
    expect(call[1].action.calc.patk).toBeGreaterThan(0);
  });
});
