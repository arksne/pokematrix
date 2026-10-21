import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Честная механика PvP (как в диком бою): STAB/эффективность/точность,
 * танцы со стадиями, фиксированный урон. Регрессия жалобы «статус-атака
 * сняла пол-HP» и «рандомные атаки».
 */
vi.mock('../../game/save.js', () => ({ autoSave: vi.fn() }));
vi.mock('../../utils/dom.js', () => ({ showToast: vi.fn() }));
vi.mock('../../ui/location.js', () => ({ updateMoneyDisplay: vi.fn() }));
vi.mock('../../ui/achievements.js', () => ({ checkAchievement: vi.fn() }));
vi.mock('../../data/sitemove.js', () => ({ fetchSiteMoveDetail: vi.fn() }));
vi.mock('../../utils/sprite.js', () => ({ getSpriteUrl: () => '' }));
vi.mock('../../game/store.js', () => ({ store: { emit: vi.fn() } }));

vi.stubGlobal('document', {
  getElementById: (id: string) => {
    if (id === 'pvp-log') return { innerHTML: '' };
    if (id === 'pvp-moves') return { innerHTML: '', appendChild: () => {}, querySelectorAll: () => [] };
    return { textContent: '', style: {}, classList: { add: () => {}, remove: () => {} }, src: '' };
  },
  createElement: () => ({ className: '', textContent: '', style: {}, onclick: null, title: '' }),
  body: { appendChild: vi.fn() },
});

import { state } from '../../game/state.js';
import { doPvPAttack } from '../pvp-core.js';

function resetState() {
  state.pvpBattleId = 'pvp_mech';
  state.pvpEndSent = false;
  state.settlePending = false;
  state.pvpMyTurn = true;
  state.pvpMyMon = {
    baseLevel: 50, candiesEaten: 0, currentHp: 120, maxHp: 120,
    apiData: {
      id: 25, name: 'pikachu',
      types: [{ type: { name: 'electric' } }],
      stats: [{ base_stat: 35 }, { base_stat: 55 }, { base_stat: 40 }, { base_stat: 50 }, { base_stat: 50 }, { base_stat: 90 }],
    },
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nickname: 'pika',
  } as any;
  state.pvpOppMon = {
    currentHp: 200, maxHp: 200, lvl: 50,
    types: ['water', 'flying'],
    stats: [80, 80, 80, 80, 80, 80],
    stages: null,
  } as any;
  state.pvpMovesDetailed = [];
  state.socket = { emit: vi.fn() };
}

const emitAction = () => {
  const calls = (state.socket.emit as any).mock.calls;
  const a = calls.find((c: any[]) => c[0] === 'pvp_action');
  return a?.[1]?.action;
};

describe('pvp mechanics (wild-like)', () => {
  beforeEach(resetState);

  it('танец мечей: +2 атаки, урона 0, ход переходит', () => {
    state.pvpMovesDetailed = [{
      name: 'swords-dance', power: null, accuracy: null,
      type: { name: 'normal' }, damage_class: { name: 'status' },
    }];
    doPvPAttack(0);
    expect(state.pvpMyMon.statStages.atk).toBe(2);
    const a = emitAction();
    expect(a.dmg).toBe(0);
    expect(a.moveName).toBe('swords-dance');
    expect(state.pvpMyTurn).toBe(false);
  });

  it('статус без эффекта (growl): 0 урона, без падения', () => {
    state.pvpMovesDetailed = [{
      name: 'growl', power: null, accuracy: 100,
      type: { name: 'normal' }, damage_class: { name: 'status' },
    }];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.dmg).toBe(0);
    expect(state.pvpMyTurn).toBe(false);
  });

  it('thunderbolt по воде/полёту: эффективность 4, урон есть', () => {
    state.pvpMovesDetailed = [{
      name: 'thunderbolt', power: 90, accuracy: 100,
      type: { name: 'electric' }, damage_class: { name: 'special' },
    }];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.eff).toBe(4);
    expect(a.dmg).toBeGreaterThan(0);
  });

  it('промах (точность 0): missed, урона 0, ход переходит', () => {
    state.pvpMovesDetailed = [{
      name: 'focus-blast', power: 120, accuracy: 0,
      type: { name: 'fighting' }, damage_class: { name: 'special' },
    }];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.missed).toBe(true);
    expect(a.dmg).toBe(0);
    expect(state.pvpMyTurn).toBe(false);
  });

  it('seismic toss: фиксированный урон = уровню', () => {
    state.pvpMovesDetailed = [{
      name: 'seismic-toss', power: null, accuracy: 100,
      type: { name: 'fighting' }, damage_class: { name: 'physical' },
    }];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.dmg).toBe(50);
  });
});
