import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../../game/state.js';
import { store } from '../../game/store.js';

// ─────────────────────────────────────────────────────────────
// npcs.test.ts — идемпотентность сдачи, special-verify UI, посылки/дроп,
// expCandyXs. DOM — минимальные стабы как в avatars/starter-issue.
// ─────────────────────────────────────────────────────────────

function makeEl(id = ''): any {
  const el: any = {
    id,
    innerHTML: '',
    textContent: '',
    innerText: '',
    style: {},
    dataset: {},
    className: '',
    title: '',
    onclick: null as any,
    disabled: false,
    children: [] as any[],
    parentNode: null as any,
    appendChild(c: any) { this.children.push(c); c.parentNode = this; return c; },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  return el;
}

function installDom() {
  const els: Record<string, any> = {};
  const body = makeEl('body');
  (body as any).appendChild = (c: any) => { (body.children as any[]).push(c); return c; };
  (globalThis as any).document = {
    getElementById: (id: string) => {
      if (els[id]) return els[id];
      const found = (body.children as any[]).find((c) => c?.id === id);
      if (found) return found;
      // npc-dialog/npc-quests/trade-toast/battle-log создаются лениво
      // (completeNPCQuest трогает лог боя, showToast — тост; без них appendToLog падает).
      if (id === 'npc-dialog' || id === 'npc-quests' || id === 'trade-toast' || id === 'btn-close-npc' || id === 'battle-log') {
        els[id] = makeEl(id);
        return els[id];
      }
      return null;
    },
    createElement: (_tag: string) => makeEl(),
    body,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return els;
}

function testNpc(quests: any[]) {
  return {
    id: '__test_npc',
    name: 'Тест',
    sprite: '🧪',
    location: 'pewterCity',
    dialog: { greet: 'hi', default: 'done', quest_offer: 'take', quest_complete: 'sold!', quest_incomplete: 'not yet' },
    quests,
  };
}

function testQuest(over: any = {}) {
  return {
    id: '__q1',
    type: 'defeat_x',
    targetItem: null,
    targetQty: 2,
    desc: 'Тестовый квест',
    rewardMoney: 1000,
    rewardItem: 'potion',
    rewardQty: 2,
    prereqQuest: null,
    ...over,
  };
}

beforeEach(() => {
  installDom();
  store.setState(state);
  state.npcQuestProgress = {};
  state.completedNPCQuests = [];
  state.inventory = { credit: 5000, potion: 0, superPotion: 0 };
  state.myTeam = [];
  state.pokedexCaught = new Set<string>();
  state.visitedLocations = new Set<string>(['pewterCity']);
  state.currentLocationId = 'pewterCity';
  state.isDaytime = true;
  state.tutorialStep = 99;
});

describe('completeNPCQuest: идемпотентность (дабл-клик «Сдать»)', () => {
  it('одиночная сдача: деньги+предмет раз, completed раз, прогресс вычищен', async () => {
    const { completeNPCQuest } = await import('../npcs.js');
    const npc = testNpc([]);
    const q = testQuest({ id: '__solo', targetQty: 2 });
    state.npcQuestProgress['__solo'] = 2;
    const before = state.inventory['credit'];
    completeNPCQuest(npc, q);
    expect(state.completedNPCQuests.filter((id: string) => id === '__solo')).toHaveLength(1);
    expect(state.npcQuestProgress['__solo']).toBeUndefined();
    expect(state.inventory['credit']).toBe(before + 1000);
    expect(state.inventory['potion']).toBe(2);
  });

  it('дабл-клик синхронно: вторая выдача no-op', async () => {
    const { completeNPCQuest } = await import('../npcs.js');
    const npc = testNpc([]);
    const q = testQuest({ id: '__dbl', targetQty: 1 });
    state.npcQuestProgress['__dbl'] = 1;
    completeNPCQuest(npc, q);
    const creditAfterFirst = state.inventory['credit'];
    const potionAfterFirst = state.inventory['potion'];
    state.npcQuestProgress['__dbl'] = 1; // ререндер мог бы вернуть прогресс — имитируем гонку
    completeNPCQuest(npc, q);
    expect(state.completedNPCQuests.filter((id: string) => id === '__dbl')).toHaveLength(1);
    expect(state.inventory['credit']).toBe(creditAfterFirst);
    expect(state.inventory['potion']).toBe(potionAfterFirst);
  });

  it('уже сданный до вызова — no-op без награды', async () => {
    const { completeNPCQuest } = await import('../npcs.js');
    const npc = testNpc([]);
    const q = testQuest({ id: '__done' });
    state.completedNPCQuests = ['__done'];
    const before = state.inventory['credit'];
    completeNPCQuest(npc, q);
    expect(state.inventory['credit']).toBe(before);
    expect(state.completedNPCQuests.filter((id: string) => id === '__done')).toHaveLength(1);
  });

  it('битый вызов (null/без id) не падает и ничего не выдаёт', async () => {
    const { completeNPCQuest } = await import('../npcs.js');
    const npc = testNpc([]);
    const before = state.inventory['credit'];
    expect(() => completeNPCQuest(npc, null)).not.toThrow();
    expect(() => completeNPCQuest(npc, {})).not.toThrow();
    expect(state.inventory['credit']).toBe(before);
    expect(state.completedNPCQuests).toEqual([]);
  });

  it('target-предметы списываются один раз, а не дважды', async () => {
    const { completeNPCQuest } = await import('../npcs.js');
    const npc = testNpc([]);
    const q = testQuest({ id: '__take3', type: 'collect_items', targetItem: 'potion', targetQty: 3 });
    state.inventory['potion'] = 5;
    state.npcQuestProgress['__take3'] = 3;
    completeNPCQuest(npc, q);
    // 5 − 3 списанных + 2 награды = 4
    expect(state.inventory['potion']).toBe(4);
    state.npcQuestProgress['__take3'] = 3;
    state.inventory['potion'] = 4;
    completeNPCQuest(npc, q);
    expect(state.inventory['potion']).toBe(4);
  });

  it('isCompletingQuest: вне выдачи false', async () => {
    const m = await import('../npcs.js');
    expect(m.isCompletingQuest('__none')).toBe(false);
  });

  it('verify-ветка дабл: два быстрых резолва дают одну награду', async () => {
    const { completeNPCQuest } = await import('../npcs.js');
    const { verifyQuest } = await import('../../game/quest-track.js');
    const npc = testNpc([]);
    const q = testQuest({ id: '__verify_dbl', type: 'special', targetQty: 1, verify: { evPool: 10 } });
    state.myTeam = [{ evPool: 20 } as any];
    state.npcQuestProgress['__verify_dbl'] = 0;
    expect(verifyQuest(q).ok).toBe(true);
    const before = state.inventory['credit'];
    // Два асинхронных резолва verify подряд (дабл-клик по «Сдать»)
    await Promise.all([
      (async () => { if (verifyQuest(q).ok) completeNPCQuest(npc, q); })(),
      (async () => { if (verifyQuest(q).ok) completeNPCQuest(npc, q); })(),
    ]);
    expect(state.completedNPCQuests.filter((id: string) => id === '__verify_dbl')).toHaveLength(1);
    expect(state.inventory['credit']).toBe(before + 1000);
  });

  it('тройной вызов подряд — всё равно одна запись', async () => {
    const { completeNPCQuest } = await import('../npcs.js');
    const npc = testNpc([]);
    const q = testQuest({ id: '__triple' });
    state.npcQuestProgress['__triple'] = 2;
    completeNPCQuest(npc, q);
    completeNPCQuest(npc, q);
    completeNPCQuest(npc, q);
    expect(state.completedNPCQuests.filter((id: string) => id === '__triple')).toHaveLength(1);
  });
});

describe('renderNPCQuests: кнопки и special-verify', () => {
  it('готовый квест — кнопка «Сдать» активна', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__ready', targetQty: 2 });
    state.npcQuestProgress['__ready'] = 2;
    renderNPCQuests(testNpc([q]));
    const container = (globalThis as any).document.getElementById('npc-quests');
    const btns: any[] = [];
    for (const card of container.children) for (const c of card.children) if (c.onclick) btns.push(c);
    expect(btns.length).toBe(1);
    expect(btns[0].innerText).toBe('Сдать');
    expect(btns[0].disabled).toBe(false);
  });

  it('невзятый — «Взять», клик ставит прогресс 0', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__take' });
    renderNPCQuests(testNpc([q]));
    const container = (globalThis as any).document.getElementById('npc-quests');
    const btn = container.children[0].children.find((c: any) => c.onclick);
    expect(btn.innerText).toBe('Взять');
    btn.onclick();
    expect(state.npcQuestProgress['__take']).toBe(0);
  });

  it('активный неготовый обычный — мёртвые «...» disabled', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__mid', targetQty: 5 });
    state.npcQuestProgress['__mid'] = 2;
    renderNPCQuests(testNpc([q]));
    const container = (globalThis as any).document.getElementById('npc-quests');
    const btn = container.children[0].children.find((c: any) => 'innerText' in c && c.onclick !== undefined);
    expect(btn.innerText).toBe('...');
    expect(btn.disabled).toBe(true);
  });

  it('сданный — ✅ без кнопки сдачи', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__sold' });
    state.completedNPCQuests = ['__sold'];
    renderNPCQuests(testNpc([q]));
    const container = (globalThis as any).document.getElementById('npc-quests');
    expect(container.children.length).toBe(1);
    expect(String(container.children[0].innerHTML)).toContain('✅');
    const btn = container.children[0].children.find((c: any) => c.onclick);
    expect(btn).toBeUndefined();
  });

  it('special verify-ok при 0/1: «Сдать» + «Готов к сдаче»', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__sp_ok', type: 'special', targetQty: 1, verify: { evPool: 10 } });
    state.myTeam = [{ evPool: 50 } as any];
    state.npcQuestProgress['__sp_ok'] = 0;
    renderNPCQuests(testNpc([q]));
    const container = (globalThis as any).document.getElementById('npc-quests');
    const card = container.children[0];
    expect(String(card.innerHTML)).toContain('Готов к сдаче');
    const btn = card.children.find((c: any) => c.onclick);
    expect(btn.innerText).toBe('Сдать');
    expect(btn.disabled).toBe(false);
  });

  it('special verify-fail при 0/1: «⏳» + «Нужно: ...» вместо «...»', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__sp_need', type: 'special', targetQty: 1, desc: 'Набери EV', verify: { evPool: 100 } });
    state.myTeam = [{ evPool: 5 } as any];
    state.npcQuestProgress['__sp_need'] = 0;
    renderNPCQuests(testNpc([q]));
    const container = (globalThis as any).document.getElementById('npc-quests');
    const card = container.children[0];
    expect(String(card.innerHTML)).toContain('Нужно:');
    expect(String(card.innerHTML)).toContain('EV');
    const btn = card.children.find((c: any) => c.onclick !== undefined || 'innerText' in c);
    expect(btn.innerText).not.toBe('...');
    expect(btn.disabled).toBe(true);
  });

  it('special verify-ok клик реально сдаёт (0/1 без счётчика)', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__sp_click', type: 'special', targetQty: 1, verify: { evPool: 10 } });
    state.myTeam = [{ evPool: 99 } as any];
    state.npcQuestProgress['__sp_click'] = 0;
    const npc = testNpc([q]);
    renderNPCQuests(npc);
    const container = (globalThis as any).document.getElementById('npc-quests');
    const btn = container.children[0].children.find((c: any) => c.onclick);
    expect(btn.innerText).toBe('Сдать');
    btn.onclick();
    // verify-ветка асинхронна (dynamic import) — ждём тик
    for (let i = 0; i < 50 && !state.completedNPCQuests.includes('__sp_click'); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(state.completedNPCQuests).toContain('__sp_click');
  });

  it('prereq не выполнен — карточка скрыта', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__locked', prereqQuest: '__nope' });
    renderNPCQuests(testNpc([q]));
    const container = (globalThis as any).document.getElementById('npc-quests');
    expect(container.children.length).toBe(0);
  });

  it('клик «Сдать» дважды подряд — одна награда (кнопка гаснет)', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const q = testQuest({ id: '__btn_dbl', targetQty: 1 });
    state.npcQuestProgress['__btn_dbl'] = 5;
    const npc = testNpc([q]);
    renderNPCQuests(npc);
    const container = (globalThis as any).document.getElementById('npc-quests');
    const btn = container.children[0].children.find((c: any) => c.onclick);
    const before = state.inventory['credit'];
    btn.onclick();
    btn.onclick();
    expect(state.completedNPCQuests.filter((id: string) => id === '__btn_dbl')).toHaveLength(1);
    expect(state.inventory['credit']).toBe(before + 1000);
  });
});

describe('checkNPCQuestProgress: сбор', () => {
  it('активный collect растёт, чужой предмет мимо', async () => {
    const { checkNPCQuestProgress } = await import('../npcs.js');
    const { NPC_DATA } = await import('../../data/npc.js');
    (NPC_DATA as any)['__test_npc'] = {
      id: '__test_npc', name: 'Т', sprite: 'x', location: 'pewterCity',
      dialog: { greet: '', default: '', quest_offer: '', quest_complete: '', quest_incomplete: '' },
      quests: [{ id: '__col1', type: 'collect_items', targetItem: 'potion', targetQty: 5 }],
    };
    try {
      state.npcQuestProgress['__col1'] = 1;
      checkNPCQuestProgress('potion', 2);
      expect(state.npcQuestProgress['__col1']).toBe(3);
      checkNPCQuestProgress('superPotion', 5);
      expect(state.npcQuestProgress['__col1']).toBe(3);
    } finally {
      delete (NPC_DATA as any)['__test_npc'];
    }
  });

  it('невзятый и сданный не двигаются', async () => {
    const { checkNPCQuestProgress } = await import('../npcs.js');
    const { NPC_DATA } = await import('../../data/npc.js');
    (NPC_DATA as any)['__test_npc'] = {
      id: '__test_npc', name: 'Т', sprite: 'x', location: 'pewterCity',
      dialog: { greet: '', default: '', quest_offer: '', quest_complete: '', quest_incomplete: '' },
      quests: [{ id: '__col2', type: 'collect_items', targetItem: 'potion', targetQty: 5 }],
    };
    try {
      checkNPCQuestProgress('potion', 1);
      expect(state.npcQuestProgress['__col2']).toBeUndefined();
      state.npcQuestProgress['__col2'] = 2;
      state.completedNPCQuests = ['__col2'];
      checkNPCQuestProgress('potion', 2);
      expect(state.npcQuestProgress['__col2']).toBe(2);
    } finally {
      delete (NPC_DATA as any)['__test_npc'];
    }
  });
});

describe('quest-drops: посылки не падают, обычные падают', () => {
  it('questItemSources исключает посылки и ноги караванов', async () => {
    const m = await import('../../data/quest-drops.js');
    (m as any).clearQuestItemSourcesCache?.();
    const src = m.questItemSources();
    for (const parcel of ['courierParcel', 'parcelCer', 'parcelVer', 'parcelCel', 'parcelSaf', 'parcelFuc', 'parcelVir', 'parcelVio', 'cinLeg2', 'azaLeg2', 'golLeg2', 'ecrLeg2', 'ciaLeg2', 'mahLeg3', 'blaLeg3', 'secretPotion']) {
      expect(src[parcel], parcel).toBeUndefined();
    }
  });

  it('rollQuestDrops: даже явно переданная посылка не падает', async () => {
    const m = await import('../../data/quest-drops.js');
    const got = m.rollQuestDrops(new Set(['pw_courier']), { courierParcel: ['pw_courier'] }, () => 0);
    expect(got).toEqual([]);
  });

  it('rollQuestDrops: обычный предмет с активным квестом падает', async () => {
    const m = await import('../../data/quest-drops.js');
    const got = m.rollQuestDrops(new Set(['q1']), { potion: ['q1'] }, () => 0);
    expect(got).toEqual([{ item: 'potion', qty: 1 }]);
  });

  it('parcels имеют category quest в ITEMS', async () => {
    const { ITEMS } = await import('../../data/items.js');
    const byId = new Map((ITEMS as any[]).map((i) => [i.id, i]));
    for (const id of ['courierParcel', 'parcelCer', 'parcelVer', 'parcelCel', 'parcelSaf', 'parcelFuc', 'parcelVir', 'parcelVio', 'cinLeg1', 'cinLeg2', 'azaLeg1', 'azaLeg2', 'golLeg1', 'golLeg2', 'ecrLeg1', 'ecrLeg2', 'ciaLeg1', 'ciaLeg2', 'mahLeg1', 'mahLeg2', 'mahLeg3', 'blaLeg1', 'blaLeg2', 'blaLeg3', 'secretPotion']) {
      expect(byId.get(id)?.category, id).toBe('quest');
    }
  });
});

describe('expCandyXs: убрана как tm-диск', () => {
  it('implemented false + пометка в desc', async () => {
    const { ITEMS } = await import('../../data/items.js');
    const xs = (ITEMS as any[]).find((i) => i.id === 'expCandyXs')!;
    expect(xs).toBeTruthy();
    expect(xs.implemented).toBe(false);
    expect(String(xs.desc)).toContain('Убрана');
  });

  it('ни один NPC-квест не награждает expCandyXs', async () => {
    const { NPC_DATA } = await import('../../data/npc.js');
    const bad: string[] = [];
    for (const npc of Object.values(NPC_DATA as any) as any[]) {
      for (const q of (npc?.quests || []) as any[]) {
        if (q?.rewardItem === 'expCandyXs') bad.push(q.id);
        for (const r of (q?.rewardItems || []) as any[]) if (r?.id === 'expCandyXs') bad.push(q.id);
      }
    }
    expect(bad).toEqual([]);
  });

  it('useItem без кейса даёт внятный отказ (default-ветка inventory.ts)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'src', 'ui', 'inventory.ts'), 'utf8');
    // default честно отказывает, а не молчит и не сжигает предмет
    expect(src).toContain('скоро будет доступно');
  });
});
