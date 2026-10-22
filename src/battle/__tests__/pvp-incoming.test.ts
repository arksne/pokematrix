import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * PvP фаза 2 (приёмник): protect/sub/скрытие nullify, статусы +
 * иммунитет, ловушки, forced switch, perish/dbond/grudge, поле.
 */
vi.mock('../../game/save.js', () => ({ autoSave: vi.fn() }));
vi.mock('../../utils/dom.js', () => ({ showToast: vi.fn() }));
vi.mock('../../ui/location.js', () => ({ updateMoneyDisplay: vi.fn() }));
vi.mock('../../ui/achievements.js', () => ({ checkAchievement: vi.fn() }));
vi.mock('../../data/sitemove.js', () => ({ fetchSiteMoveDetail: vi.fn(async () => null) }));
vi.mock('../../utils/sprite.js', () => ({ getSpriteUrl: () => '' }));
vi.mock('../../game/store.js', () => ({ store: { emit: vi.fn() } }));

function el() {
  return {
    textContent: '', innerHTML: '', src: '', value: '',
    style: {}, dataset: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    appendChild: () => {}, prepend: () => {}, remove: () => {},
    addEventListener: () => {}, querySelectorAll: () => [],
    onclick: null,
  };
}
vi.stubGlobal('document', {
  getElementById: () => el(),
  createElement: () => el(),
  body: { appendChild: vi.fn(), removeChild: vi.fn() },
});

import { state } from '../../game/state.js';
import {
  applyIncomingPvpAction, resetPvpVol, resetPvpFoeVol, resetPvpField,
  pvpVol, pvpField, myApproxSpeed, foeApproxSpeed, beginOwnTurn,
} from '../pvp-core.js';

function resetBattle() {
  state.pvpBattleId = 'pvp_inc';
  state.pvpEndSent = false;
  state.pvpMyTurn = false;
  state.pvpRound = 0;
  state.pvpAwaitingReplacement = false;
  state.pvpOppTeam = null;
  resetPvpVol();
  resetPvpFoeVol();
  resetPvpField();
  state.pvpMyMon = {
    baseLevel: 50, candiesEaten: 0, currentHp: 120, maxHp: 120,
    abilityName: 'static',
    apiData: {
      id: 25, name: 'pikachu',
      types: [{ type: { name: 'electric' } }],
      stats: [{ base_stat: 35 }, { base_stat: 55 }, { base_stat: 40 }, { base_stat: 50 }, { base_stat: 50 }, { base_stat: 90 }],
      moves: [{ move: { name: 'thunderbolt' } }, { move: { name: 'quick-attack' } }],
    },
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    movesPP: [{ current: 15, max: 15 }, { current: 15, max: 15 }],
    nickname: 'pika',
  } as any;
  state.pvpOppMon = {
    currentHp: 200, maxHp: 200, lvl: 50, name: 'squirtle',
    types: ['water'], stats: [80, 80, 80, 80, 80, 80], stages: null,
  } as any;
  state.myTeam = [state.pvpMyMon];
  state.pvpMovesDetailed = [];
  state.socket = { emit: vi.fn() };
}

const lastHpUpdate = () => {
  const calls = (state.socket.emit as any).mock.calls;
  const a = [...calls].reverse().find((c: any[]) => c[0] === 'pvp_action' && c[1]?.action?.type === 'hp_update');
  return a?.[1]?.action;
};
const atk = (moveName: string, extra: any = {}) => ({
  type: 'attack', moveName, dmg: 20, crit: false, lvl: 50,
  moveType: 'water', damageClass: 'special', ...extra,
});

describe('pvp phase2 receiver', () => {
  beforeEach(resetBattle);

  it('protect блокирует дамаг и гаснет', () => {
    pvpVol.protectActive = true;
    applyIncomingPvpAction(atk('water-gun'));
    expect((state.pvpMyMon as any).currentHp).toBe(120);
    expect(pvpVol.protectActive).toBe(false);
    expect(state.pvpMyTurn).toBe(true);
    expect(lastHpUpdate().hp).toBe(120);
  });

  it('feint пробивает protect', () => {
    pvpVol.protectActive = true;
    applyIncomingPvpAction(atk('feint', { moveType: 'normal', damageClass: 'physical' }));
    expect((state.pvpMyMon as any).currentHp).toBe(100);
    expect(pvpVol.protectActive).toBe(true);
  });

  it('substitute поглощает дамаг и ломается', () => {
    pvpVol.substituteHp = 25;
    applyIncomingPvpAction(atk('water-gun'));
    expect((state.pvpMyMon as any).currentHp).toBe(120);
    expect(pvpVol.substituteHp).toBe(5);
    applyIncomingPvpAction(atk('water-gun', { dmg: 10 }));
    expect(pvpVol.substituteHp).toBe(0);
    expect((state.pvpMyMon as any).currentHp).toBe(120);
    applyIncomingPvpAction(atk('water-gun', { dmg: 10 }));
    expect((state.pvpMyMon as any).currentHp).toBe(110);
  });

  it('substitute блокирует статус', () => {
    pvpVol.substituteHp = 15;
    applyIncomingPvpAction(atk('thunder-wave', { dmg: 0, ailment: 'par', ailChance: 100 }));
    expect((state.pvpMyMon as any).status).toBeFalsy();
    expect(state.pvpMyTurn).toBe(true);
  });

  it('звук пробивает substitute', () => {
    pvpVol.substituteHp = 15;
    applyIncomingPvpAction(atk('hyper-voice', { moveType: 'normal' }));
    expect((state.pvpMyMon as any).currentHp).toBe(100);
  });

  it('скрывшийся dig не достаёт earthquake-иммунными', () => {
    pvpVol.charging = 'dig';
    applyIncomingPvpAction(atk('surf', { moveType: 'water' }));
    expect((state.pvpMyMon as any).currentHp).toBe(120);
    expect(state.pvpMyTurn).toBe(true);
    pvpVol.charging = 'dig';
    applyIncomingPvpAction(atk('earthquake', { moveType: 'ground', damageClass: 'physical' }));
    expect((state.pvpMyMon as any).currentHp).toBe(100);
  });

  it('thunder wave парализует (иммунитета нет)', () => {
    applyIncomingPvpAction(atk('thunder-wave', { dmg: 0, ailment: 'par', ailChance: 100 }));
    expect((state.pvpMyMon as any).status).toBe('par');
  });

  it('will-o-wisp по огненному: иммунитет', () => {
    (state.pvpMyMon as any).apiData.types = [{ type: { name: 'fire' } }];
    applyIncomingPvpAction(atk('will-o-wisp', { dmg: 0, ailment: 'brn', ailChance: 100 }));
    expect((state.pvpMyMon as any).status).toBeFalsy();
  });

  it('toxic spikes стакаются до 2 слоёв', () => {
    pvpField.foeHazards.toxic = 1;
    (state.pvpMyMon as any).currentHp = 120;
    applyIncomingPvpAction({ type: 'attack', moveName: 'tackle', dmg: 0, crit: false, lvl: 5, hazard: 'toxic' });
    expect(pvpField.foeHazards.toxic).toBe(2);
    expect(state.pvpMyTurn).toBe(true);
  });

  it('forced switch меняет бойца автоматически', () => {
    (state as any).myTeam = [
      state.pvpMyMon,
      { uid: 'u2', nickname: 'bulba', baseLevel: 5, candiesEaten: 0, currentHp: 60, maxHp: 60, apiData: { name: 'bulbasaur', types: [], stats: [] }, statStages: null },
    ];
    applyIncomingPvpAction(atk('dragon-tail', { damageClass: 'physical', forcedSwitch: true }));
    expect((state.pvpMyMon as any).nickname).toBe('bulba');
  });

  it('perish ставит обратный отсчёт обеим', () => {
    applyIncomingPvpAction(atk('perish-song', { dmg: 0, perish: true }));
    expect(pvpVol.perishUntilRound).toBeGreaterThan(0);
    expect(state.pvpMyTurn).toBe(true);
  });

  it('taunt/encore/disable применяются и истекают', () => {
    applyIncomingPvpAction(atk('taunt', { dmg: 0, taunt: true }));
    expect(pvpVol.tauntUntilRound).toBeGreaterThan(0);
    applyIncomingPvpAction(atk('encore', { dmg: 0, encore: { move: 'tackle' } }));
    expect(pvpVol.encoreMove).toBe('tackle');
    applyIncomingPvpAction(atk('disable', { dmg: 0, disabled: { move: 'growl' } }));
    expect(pvpVol.disabledMove).toBe('growl');
  });

  it('dbond destiny роняет моего активного', () => {
    (state as any).myTeam = [state.pvpMyMon];
    applyIncomingPvpAction({ type: 'dbond', kind: 'destiny' });
    expect((state.pvpMyMon as any).currentHp).toBe(0);
  });

  it('dbond grudge обнуляет мой последний приём', () => {
    pvpVol.lastMoveName = 'thunderbolt';
    applyIncomingPvpAction({ type: 'dbond', kind: 'grudge' });
    expect((state.pvpMyMon as any).movesPP[0].current).toBe(0);
  });

  it('item соперника просто передаёт ход', () => {
    applyIncomingPvpAction({ type: 'item', item: 'potion', label: '+20 HP' });
    expect((state.pvpMyMon as any).currentHp).toBe(120);
    expect(state.pvpMyTurn).toBe(true);
  });

  it('скорости: формула детерминирована', () => {
    const a = myApproxSpeed();
    const b = foeApproxSpeed();
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(myApproxSpeed()).toBe(a);
  });

  it('debuff применяется, clear body блокирует', () => {
    applyIncomingPvpAction(atk('growl', { dmg: 0, debuff: [['atk', -1]] }));
    expect((state.pvpMyMon as any).statStages.atk).toBe(-1);
    (state.pvpMyMon as any).statStages.atk = 0;
    (state.pvpMyMon as any).abilityName = 'clear-body';
    applyIncomingPvpAction(atk('growl', { dmg: 0, debuff: [['atk', -1]] }));
    expect((state.pvpMyMon as any).statStages.atk).toBe(0);
  });

  it('nightmare тикает только во сне', () => {
    (state.pvpMyMon as any).status = 'slp';
    applyIncomingPvpAction({ type: 'attack', moveName: 'nightmare', dmg: 0, crit: false, lvl: 50, nightmare: true });
    expect(beginOwnTurn()).toBe(true);
    expect((state.pvpMyMon as any).currentHp).toBe(90);
  });

  it('roost соперника снимает полёт для моего урона', () => {
    (state.pvpOppMon as any).types = ['flying'];
    applyIncomingPvpAction({ type: 'attack', moveName: 'roost', dmg: 0, crit: false, lvl: 50, heal: 30, myHp: 200, roost: true });
    expect((state.pvpOppMon as any).roosted).toBe(true);
  });

  it('trick: обмен + ack, липкий захват отменяет', () => {
    (state.pvpMyMon as any).heldItem = 'leftovers';
    applyIncomingPvpAction({ type: 'attack', moveName: 'trick', dmg: 0, crit: false, lvl: 50, trick: true, myHeld: 'choice-band' });
    expect((state.pvpMyMon as any).heldItem).toBe('choice-band');
    const sent = (state.socket.emit as any).mock.calls.map((c: any[]) => c[1]?.action).find((a: any) => a?.type === 'trick-result');
    expect(sent.held).toBe('leftovers');
    (state.pvpMyMon as any).heldItem = 'leftovers';
    (state.pvpOppMon as any).ability = 'sticky-hold';
    applyIncomingPvpAction({ type: 'attack', moveName: 'trick', dmg: 0, crit: false, lvl: 50, trick: true, myHeld: 'choice-band' });
    expect((state.pvpMyMon as any).heldItem).toBe('leftovers');
    const fail = (state.socket.emit as any).mock.calls.map((c: any[]) => c[1]?.action).find((a: any) => a?.type === 'trick-result' && a.failed);
    expect(fail).toBeTruthy();
  });

  it('trick-result применяет холд без тика раунда', () => {
    (state as any).pvpRound = 10;
    (state.pvpMyMon as any).heldItem = 'leftovers';
    applyIncomingPvpAction({ type: 'trick-result', held: 'choice-band' });
    expect((state.pvpMyMon as any).heldItem).toBe('choice-band');
    expect((state as any).pvpRound).toBe(10);
  });

  it('mental herb снимает taunt', () => {
    (state.pvpMyMon as any).heldItem = 'mental-herb';
    applyIncomingPvpAction({ type: 'attack', moveName: 'taunt', dmg: 0, crit: false, lvl: 50, taunt: true });
    expect(pvpVol.tauntUntilRound).toBe(0);
    expect((state.pvpMyMon as any).heldItem).toBeNull();
  });

  it('forced switch блокируется куклой, roar-звук проходит', () => {
    pvpVol.substituteHp = 10;
    (state as any).myTeam = [state.pvpMyMon, { uid: 'u2', nickname: 'b', baseLevel: 5, candiesEaten: 0, currentHp: 60, maxHp: 60, apiData: { name: 'b', types: [], stats: [] }, statStages: null }];
    applyIncomingPvpAction(atk('dragon-tail', { damageClass: 'physical', forcedSwitch: true }));
    expect((state.pvpMyMon as any).nickname).toBe('pika');
    applyIncomingPvpAction(atk('roar', { damageClass: 'status', forcedSwitch: true }));
    expect((state.pvpMyMon as any).nickname).toBe('b');
  });
});
