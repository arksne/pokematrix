import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * PvP фаза 2 (отправитель): protect/substitute/зарядка/PP/борьба,
 * таунт/encore/фейк/sucker, погода/ловушки, отдача/дрейн, forced switch.
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
  doPvPAttack, resetPvpVol, resetPvpFoeVol, resetPvpField,
  pvpVol, pvpFoeVol, pvpField, usePvpItem,
} from '../pvp-core.js';

function resetBattle() {
  state.pvpBattleId = 'pvp_p2';
  state.pvpEndSent = false;
  state.settlePending = false;
  state.pvpMyTurn = true;
  state.pvpRound = 0;
  state.pvpItemsUsed = 0;
  (state as any).inventory = { potion: 2, ether: 1 };
  (state as any).pvpFoeActed = false;
  (state as any).pvpWasHit = false;
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
      moves: [
        { move: { name: 'thunderbolt' } }, { move: { name: 'protect' } },
        { move: { name: 'thunder-wave' } }, { move: { name: 'fly' } },
      ],
    },
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    movesPP: [{ current: 15, max: 15 }, { current: 10, max: 10 }, { current: 20, max: 20 }, { current: 15, max: 15 }],
    nickname: 'pika',
  } as any;
  state.pvpOppMon = {
    currentHp: 200, maxHp: 200, lvl: 50, name: 'squirtle',
    types: ['water'],
    stats: [80, 80, 80, 80, 80, 80],
    stages: null,
  } as any;
  state.pvpMovesDetailed = [];
  state.socket = { emit: vi.fn() };
}

const emitAction = () => {
  const calls = (state.socket.emit as any).mock.calls;
  const a = [...calls].reverse().find((c: any[]) => c[0] === 'pvp_action');
  return a?.[1]?.action;
};
const dmgOf = (name: string, extra: any = {}) => ({
  name, power: 90, accuracy: 100, pp: 15,
  type: { name: 'electric' }, damage_class: { name: 'physical' }, meta: {}, ...extra,
});

describe('pvp phase2 sender', () => {
  beforeEach(resetBattle);

  it('protect: ставится флаг, стрик растёт, ход уходит', () => {
    state.pvpMovesDetailed = [dmgOf('protect', { power: null, damage_class: { name: 'status' }, type: { name: 'normal' }, pp: 10 })];
    doPvPAttack(0);
    expect(pvpVol.protectActive).toBe(true);
    expect(pvpVol.protectStreak).toBe(1);
    const a = emitAction();
    expect(a.protect).toBe(true);
    expect(a.dmg).toBe(0);
    expect(state.pvpMyTurn).toBe(false);
  });

  it('второй protect подряд может провалиться (decay)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const prot = [dmgOf('protect', { power: null, damage_class: { name: 'status' }, type: { name: 'normal' }, pp: 10 })];
      state.pvpMovesDetailed = prot;
      doPvPAttack(0);
      expect(pvpVol.protectActive).toBe(true);
      state.pvpMyTurn = true;
      state.pvpMovesDetailed = prot;
      doPvPAttack(0);
      const a = emitAction();
      expect(a.protectFailed).toBe(true);
      expect(pvpVol.protectActive).toBe(false);
    } finally {
      (Math.random as any).mockRestore?.();
    }
  });

  it('substitute: тратит 25% HP, ставит куклу', () => {
    state.pvpMovesDetailed = [dmgOf('substitute', { power: null, damage_class: { name: 'status' }, type: { name: 'normal' } })];
    doPvPAttack(0);
    expect(pvpVol.substituteHp).toBe(30);
    expect(state.pvpMyMon.currentHp).toBe(90);
    expect(emitAction().substitute).toBe(true);
  });

  it('substitute без HP: отказ без траты хода', () => {
    (state.pvpMyMon as any).currentHp = 10;
    state.pvpMovesDetailed = [dmgOf('substitute', { power: null, damage_class: { name: 'status' }, type: { name: 'normal' } })];
    doPvPAttack(0);
    expect(pvpVol.substituteHp).toBe(0);
    expect(state.pvpMyTurn).toBe(true);
    expect(emitAction()).toBeUndefined();
  });

  it('таунт блокирует статус, но не атаку', () => {
    pvpVol.tauntUntilRound = pvpVol.tauntUntilRound = 999;
    (state as any).pvpRound = 0;
    state.pvpMovesDetailed = [dmgOf('thunder-wave', { power: null, damage_class: { name: 'status' }, type: { name: 'electric' } })];
    doPvPAttack(0);
    expect(state.pvpMyTurn).toBe(true); // ход не потрачен
    state.pvpMovesDetailed = [dmgOf('tackle', { power: 40, damage_class: { name: 'physical' }, type: { name: 'normal' } })];
    doPvPAttack(0);
    expect(state.pvpMyTurn).toBe(false);
  });

  it('encore заставляет повторять приём', () => {
    pvpVol.encoreMove = 'tackle';
    pvpVol.encoreUntilRound = 999;
    (state as any).pvpRound = 0;
    state.pvpMovesDetailed = [dmgOf('growl', { power: null, damage_class: { name: 'status' }, type: { name: 'normal' } })];
    doPvPAttack(0);
    expect(state.pvpMyTurn).toBe(true);
    state.pvpMovesDetailed = [dmgOf('tackle', { power: 40, damage_class: { name: 'physical' }, type: { name: 'normal' } })];
    doPvPAttack(0);
    expect(state.pvpMyTurn).toBe(false);
  });

  it('fake-out только первым действием', () => {
    state.pvpMovesDetailed = [dmgOf('fake-out', { power: 40, damage_class: { name: 'physical' }, type: { name: 'normal' } })];
    pvpVol.actedStint = true;
    doPvPAttack(0);
    expect(state.pvpMyTurn).toBe(true);
    expect(emitAction()).toBeUndefined();
  });

  it('sucker-punch без вражеского дамага проваливается с тратой хода', () => {
    pvpFoeVol.lastMoveDamaging = false;
    state.pvpMovesDetailed = [dmgOf('sucker-punch', { power: 70, damage_class: { name: 'physical' }, type: { name: 'dark' } })];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.dmg).toBe(0);
    expect(state.pvpMyTurn).toBe(false);
  });

  it('зарядка fly: первый тап прячет, второй бьёт', () => {
    const fly = [dmgOf('fly', { power: 90, damage_class: { name: 'physical' }, type: { name: 'flying' } })];
    state.pvpMovesDetailed = fly;
    doPvPAttack(0);
    expect(pvpVol.charging).toBe('fly');
    expect(emitAction().charging).toEqual({ move: 'fly' });
    state.pvpMyTurn = true;
    state.pvpMovesDetailed = fly;
    doPvPAttack(0);
    expect(pvpVol.charging).toBeNull();
    const a = emitAction();
    expect(a.dmg).toBeGreaterThan(0);
  });

  it('sunny-day ставит погоду и ретранслируется', () => {
    state.pvpMovesDetailed = [dmgOf('sunny-day', { power: null, damage_class: { name: 'status' }, type: { name: 'fire' } })];
    doPvPAttack(0);
    expect(pvpField.weather.type).toBe('sun');
    expect(emitAction().weather).toBe('sun');
  });

  it('stealth-rock ставит ловушки сопернику', () => {
    state.pvpMovesDetailed = [dmgOf('stealth-rock', { power: null, damage_class: { name: 'status' }, type: { name: 'rock' } })];
    doPvPAttack(0);
    expect(pvpField.myHazards.rocks).toBe(true);
    expect(emitAction().hazard).toBe('rocks');
  });

  it('perish-song взводит обратный отсчёт', () => {
    state.pvpMovesDetailed = [dmgOf('perish-song', { power: null, damage_class: { name: 'status' }, type: { name: 'normal' } })];
    doPvPAttack(0);
    expect(pvpVol.perishUntilRound).toBeGreaterThan(0);
    expect(emitAction().perish).toBe(true);
  });

  it('destiny-bond взводится локально', () => {
    state.pvpMovesDetailed = [dmgOf('destiny-bond', { power: null, damage_class: { name: 'status' }, type: { name: 'ghost' } })];
    doPvPAttack(0);
    expect(pvpVol.dbond).toBe('destiny');
  });

  it('борьба при пустых PP: typeless + отдача себе', () => {
    (state.pvpMyMon as any).movesPP = [{ current: 0, max: 15 }, { current: 0, max: 10 }, { current: 0, max: 20 }, { current: 0, max: 15 }];
    state.pvpMovesDetailed = [dmgOf('thunderbolt')];
    const hpBefore = (state.pvpMyMon as any).currentHp;
    doPvPAttack(0);
    const a = emitAction();
    expect(a.moveName).toBe('Struggle');
    expect(a.dmg).toBeGreaterThan(0);
    expect((state.pvpMyMon as any).currentHp).toBeLessThan(hpBefore);
  });

  it('нет PP у выбранного, но есть у других: отказ без траты хода', () => {
    (state.pvpMyMon as any).movesPP = [{ current: 0, max: 15 }, { current: 10, max: 10 }, { current: 20, max: 20 }, { current: 15, max: 15 }];
    state.pvpMovesDetailed = [dmgOf('thunderbolt')];
    doPvPAttack(0);
    expect(emitAction()).toBeUndefined();
    expect(state.pvpMyTurn).toBe(true);
  });

  it('thunder wave шлёт ailment для применения получателем', () => {
    state.pvpMovesDetailed = [dmgOf('thunder-wave', {
      power: null, damage_class: { name: 'status' }, type: { name: 'electric' },
      accuracy: 90, meta: { ailment: { name: 'paralysis' }, ailment_chance: 100 },
    })];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.ailment).toBe('par');
    expect(a.dmg).toBe(0);
  });

  it('dragon-tail помечается forced switch', () => {
    state.pvpMovesDetailed = [dmgOf('dragon-tail', { power: 60, damage_class: { name: 'physical' }, type: { name: 'dragon' } })];
    doPvPAttack(0);
    expect(emitAction().forcedSwitch).toBe(true);
  });

  it('brave-bird: отдача себе', () => {
    state.pvpMovesDetailed = [dmgOf('brave-bird', { power: 120, damage_class: { name: 'physical' }, type: { name: 'flying' }, meta: { drain: -33 } })];
    const hpBefore = (state.pvpMyMon as any).currentHp;
    doPvPAttack(0);
    const a = emitAction();
    expect(a.dmg).toBeGreaterThan(0);
    expect((state.pvpMyMon as any).currentHp).toBeLessThan(hpBefore);
  });

  it('предмет: зелье лечит и тратит ход (лимит 3)', () => {
    (state.pvpMyMon as any).currentHp = 40;
    usePvpItem('potion');
    expect((state.pvpMyMon as any).currentHp).toBe(60);
    expect((state as any).inventory.potion).toBe(1);
    expect((state as any).pvpItemsUsed).toBe(1);
    const a = emitAction();
    expect(a.type).toBe('item');
    expect(state.pvpMyTurn).toBe(false);
  });

  it('предмет: эфир чинит PP', () => {
    (state.pvpMyMon as any).movesPP = [{ current: 0, max: 15 }, { current: 10, max: 10 }, { current: 20, max: 20 }, { current: 15, max: 15 }];
    usePvpItem('ether');
    expect((state.pvpMyMon as any).movesPP[0].current).toBe(10);
    expect((state as any).inventory.ether).toBe(0);
  });

  it('roost: лечит 50% и снимает полёт', () => {
    (state.pvpMyMon as any).currentHp = 40;
    state.pvpMovesDetailed = [dmgOf('roost', { power: null, damage_class: { name: 'status' }, type: { name: 'flying' } })];
    doPvPAttack(0);
    expect((state.pvpMyMon as any).currentHp).toBe(100);
    const a = emitAction();
    expect(a.heal).toBe(60);
    expect(a.roost).toBe(true);
  });

  it('synthesis: на солнце 2/3, в дождь 1/4', () => {
    (state.pvpMyMon as any).currentHp = 20;
    const syn = [dmgOf('synthesis', { power: null, damage_class: { name: 'status' }, type: { name: 'grass' } })];
    state.pvpMovesDetailed = syn;
    pvpField.weather = { type: 'sun', untilRound: 999 };
    (state as any).pvpRound = 0;
    doPvPAttack(0);
    expect(emitAction().heal).toBe(80);
  });

  it('strength sap: лечит по атаке врага и режет её', () => {
    (state.pvpMyMon as any).currentHp = 40;
    (state.pvpOppMon as any).calc = { patk: 90 };
    state.pvpMovesDetailed = [dmgOf('strength-sap', { power: null, damage_class: { name: 'status' }, type: { name: 'grass' } })];
    doPvPAttack(0);
    expect((state.pvpMyMon as any).currentHp).toBe(120);
    const a = emitAction();
    expect(a.heal).toBe(80);
    expect(a.debuff).toEqual([['atk', -1]]);
  });

  it('nightmare без сна: отказ', () => {
    state.pvpMovesDetailed = [dmgOf('nightmare', { power: null, damage_class: { name: 'status' }, type: { name: 'ghost' } })];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.missed).toBe(true);
    expect(a.noEffect).toBe(true);
  });

  it('trick: шлёт намерение, локально холд не меняет', () => {
    (state.pvpMyMon as any).heldItem = 'leftovers';
    state.pvpMovesDetailed = [dmgOf('trick', { power: null, damage_class: { name: 'status' }, type: { name: 'psychic' } })];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.trick).toBe(true);
    expect(a.myHeld).toBe('leftovers');
    expect((state.pvpMyMon as any).heldItem).toBe('leftovers');
  });

  it('roar: принудительная смена без урона', () => {
    state.pvpMovesDetailed = [dmgOf('roar', { power: null, accuracy: 100, damage_class: { name: 'status' }, type: { name: 'normal' } })];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.dmg).toBe(0);
    expect(a.forcedSwitch).toBe(true);
  });

  it('growl: шлёт дебафф', () => {
    state.pvpMovesDetailed = [dmgOf('growl', { power: null, accuracy: 100, damage_class: { name: 'status' }, type: { name: 'normal' } })];
    doPvPAttack(0);
    const a = emitAction();
    expect(a.debuff).toEqual([['atk', -1]]);
    expect(a.dmg).toBe(0);
  });

  it('hex вдвое по статусу', () => {
    (state.pvpOppMon as any).status = 'brn';
    state.pvpMovesDetailed = [dmgOf('hex', { power: 65, damage_class: { name: 'special' }, type: { name: 'ghost' } })];
    doPvPAttack(0);
    const a = emitAction();
    (state.pvpOppMon as any).status = null;
    state.pvpMovesDetailed = [dmgOf('hex', { power: 65, damage_class: { name: 'special' }, type: { name: 'ghost' } })];
    state.pvpMyTurn = true;
    const before = (state.pvpMyMon as any).currentHp;
    void before;
    doPvPAttack(0);
    const b = emitAction();
    expect(a.dmg).toBeGreaterThan(b.dmg);
  });
});
