import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Задвоенные кнопки атак (8 вместо 4): updatePvPUI асинхронна (fetch мувсета)
 * и дёргается по 2–3 раза на событие боя. Чистка была ДО await, вставка —
 * ПОСЛЕ: два перекрывшихся вызова давали 4+4=8 кнопок. Барьер pvpRenderSeq
 * отбрасывает протухший рендер до вставки в DOM.
 */
vi.mock('../../game/save.js', () => ({ autoSave: vi.fn() }));
vi.mock('../../utils/dom.js', () => ({ showToast: vi.fn() }));
vi.mock('../../ui/location.js', () => ({ updateMoneyDisplay: vi.fn() }));
vi.mock('../../ui/achievements.js', () => ({ checkAchievement: vi.fn() }));
vi.mock('../../data/sitemove.js', () => ({ fetchSiteMoveDetail: vi.fn(async () => ({})) }));
vi.mock('../../utils/sprite.js', () => ({ getSpriteUrl: () => '' }));
vi.mock('../../game/store.js', () => ({ store: { emit: vi.fn() } }));

const madeButtons: any[] = [];
function makeEl() {
  return {
    textContent: '',
    style: {} as any,
    classList: { add: vi.fn(), remove: vi.fn() },
    src: '',
  };
}
const movesDiv = {
  _html: '',
  children: [] as any[],
  get innerHTML() { return this._html; },
  set innerHTML(v: string) { this._html = v; this.children = []; },
  appendChild(c: any) { this.children.push(c); },
  querySelectorAll: () => [],
};
vi.stubGlobal('document', {
  getElementById: (id: string) => (id === 'pvp-moves' ? movesDiv : makeEl()),
  createElement: () => ({ ...makeEl(), className: '', onclick: null as any }),
  body: { appendChild: vi.fn() },
});

import { state } from '../../game/state.js';
import { updatePvPUI } from '../pvp-core.js';

function learnset(names: string[]) {
  return {
    moves: names.map((name, i) => ({
      move: { name, url: `https://pokeapi.co/m/${name}` },
      version_group_details: [{ move_learn_method: { name: 'level-up' }, level_learned_at: 10 * (i + 1) }],
    })),
  };
}

describe('updatePvPUI: перекрывающиеся рендеры не двоят кнопки', () => {
  beforeEach(() => {
    movesDiv.children = [];
    movesDiv._html = '';
    madeButtons.length = 0;
    state.pvpMyMon = {
      baseLevel: 100, candiesEaten: 0, currentHp: 146, maxHp: 350,
      apiData: { id: 130 }, nickname: 'gyarados',
    } as any;
    state.pvpMyTurn = true;
  });

  it('два перекрывшихся вызова дают 4 кнопки, а не 8', async () => {
    let resolveFirst!: (v: any) => void;
    const firstGate = new Promise((res) => { resolveFirst = res; });
    const resp = (names: string[]) => ({ ok: true, json: async () => learnset(names) });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => firstGate.then(() => resp(['a1', 'a2', 'a3', 'a4'])))
      .mockImplementationOnce(async () => resp(['b1', 'b2', 'b3', 'b4']));
    vi.stubGlobal('fetch', fetchMock);

    const p1 = updatePvPUI(); // медленный (завис на fetch)
    const p2 = updatePvPUI(); // быстрый второй
    await p2;
    resolveFirst(null);
    await p1;
    await new Promise((r) => setTimeout(r, 0));

    expect(movesDiv.children.length).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('одиночный рендер даёт ровно 4 кнопки', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => learnset(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) })));
    await updatePvPUI();
    await new Promise((r) => setTimeout(r, 0));
    expect(movesDiv.children.length).toBe(4);
  });
});
