import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../../game/state.js';
import { store } from '../../game/store.js';
import { ITEMS } from '../../data/items.js';
import { QUEST_CONFIGS } from '../../data/quests.js';
import { generateDailyQuests, checkQuestProgress, claimQuestReward } from '../core.js';

// Unit-тесты daily-цепочки на фейковом state:
// генерация (3 шт, без сброса посреди дня, самолечение битых, смена дня),
// прогресс (типы + фильтр targetItem + cap + completed),
// claim (награда, claimed, защита от двойной выдачи и от несобранного).

function makeLocalStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => { m.clear(); },
  };
}

function mockEl() {
  return {
    innerHTML: '',
    innerText: '',
    textContent: '',
    className: '',
    style: {} as Record<string, string>,
    scrollTop: 0,
    scrollHeight: 0,
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll() { return []; },
  };
}

function installDom() {
  const doc: any = {
    getElementById: (id: string) => {
      // quest-list отсутствует → renderQuests early-return (NPC-секцию не ломаем).
      if (id === 'quest-list') return null;
      return mockEl();
    },
    createElement: () => mockEl(),
    body: { appendChild() {} },
  };
  vi.stubGlobal('document', doc);
}

const questDateKey = () => store.lsKey('quest_date');
const todayStr = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorage());
  installDom();
  state.quests = [];
  state.questProgress = {};
  state.completedQuests = [];
  state.npcQuestProgress = {};
  state.completedNPCQuests = [];
  state.inventory = { credit: 500 } as Record<string, number>;
  store.setState(state);
});

describe('generateDailyQuests', () => {
  it('генерирует 3 валидных квеста с нулевым прогрессом и ставит дату', () => {
    generateDailyQuests();
    expect(state.quests.length).toBe(3);
    const ids = new Set((QUEST_CONFIGS as any[]).map((q) => q.id));
    for (const q of state.quests as any[]) {
      expect(ids.has(q.id)).toBe(true);
      expect(q.progress).toBe(0);
      expect(q.completed).toBe(false);
      expect(q.claimed).toBe(false);
      expect(q.target).toBeGreaterThan(0);
      if (q.type === 'collect_items') {
        expect(ITEMS.some((i) => i.id === q.targetItem), `targetItem ${q.targetItem}`).toBe(true);
      }
      if (q.rewardItem) {
        expect(ITEMS.some((i) => i.id === q.rewardItem), `rewardItem ${q.rewardItem}`).toBe(true);
      }
      expect(state.questProgress[q.id]).toBe(0);
    }
    expect((globalThis as any).localStorage.getItem(questDateKey())).toBe(todayStr());
  });

  it('не сбрасывает прогресс посреди дня (второй вызов — no-op)', () => {
    generateDailyQuests();
    const firstIds = (state.quests as any[]).map((q) => q.id);
    (state.quests as any[])[0].progress = 2;
    state.questProgress[(state.quests as any[])[0].id] = 2;
    generateDailyQuests();
    expect((state.quests as any[]).map((q: any) => q.id)).toEqual(firstIds);
    expect((state.quests as any[])[0].progress).toBe(2);
  });

  it('самолечение: битый квест из старого сейва перегенерируется в тот же день', () => {
    (state.quests as any[]).push({
      id: 'collect_hair', type: 'collect_items', targetItem: 'venonatHair',
      target: 3, desc: 'битый', rewardMoney: 300, rewardItem: 'rareCandy', rewardQty: 1,
      progress: 1, completed: false, claimed: false,
    });
    state.questProgress = { collect_hair: 1 };
    (globalThis as any).localStorage.setItem(questDateKey(), todayStr());
    generateDailyQuests();
    expect(state.quests.length).toBe(3);
    for (const q of state.quests as any[]) {
      if (q.type === 'collect_items') {
        expect(ITEMS.some((i) => i.id === q.targetItem)).toBe(true);
      }
    }
    expect((state.quests as any[]).some((q: any) => q.targetItem === 'venonatHair')).toBe(false);
  });

  it('новый день — перегенерация и сброс прогресса', () => {
    generateDailyQuests();
    (state.quests as any[])[0].progress = 2;
    (globalThis as any).localStorage.setItem(questDateKey(), '2000-01-01');
    generateDailyQuests();
    expect((globalThis as any).localStorage.getItem(questDateKey())).toBe(todayStr());
    for (const q of state.quests as any[]) {
      expect(q.progress).toBe(0);
      expect(q.completed).toBe(false);
      expect(q.claimed).toBe(false);
    }
  });
});

describe('checkQuestProgress', () => {
  it('двигает catch_x, капает на target и помечает completed', () => {
    state.quests = [{
      id: 'catch_5', type: 'catch_x', target: 5, desc: 't',
      rewardMoney: 500, rewardItem: 'pokeBall', rewardQty: 3,
      progress: 0, completed: false, claimed: false,
    }];
    state.questProgress = { catch_5: 0 };
    checkQuestProgress('catch_x', 2);
    expect((state.quests as any[])[0].progress).toBe(2);
    checkQuestProgress('catch_x', 10);
    expect((state.quests as any[])[0].progress).toBe(5);
    expect((state.quests as any[])[0].completed).toBe(true);
    expect(state.questProgress['catch_5']).toBe(5);
  });

  it('collect_items: чужой предмет игнорируется, свой — двигает', () => {
    const target = (QUEST_CONFIGS as any[]).find((q) => q.type === 'collect_items')!.targetItem;
    state.quests = [{
      id: 'c1', type: 'collect_items', targetItem: target, target: 3, desc: 't',
      rewardMoney: 1, rewardItem: 'potion', rewardQty: 1,
      progress: 0, completed: false, claimed: false,
    }];
    state.questProgress = { c1: 0 };
    checkQuestProgress('collect_items', 2, 'definitely_not_the_target');
    expect((state.quests as any[])[0].progress).toBe(0);
    checkQuestProgress('collect_items', 2, target);
    expect((state.quests as any[])[0].progress).toBe(2);
  });

  it('выполненные/забранные квесты не двигаются', () => {
    state.quests = [{
      id: 'd', type: 'defeat_x', target: 10, desc: 't',
      rewardMoney: 1, rewardItem: 'potion', rewardQty: 1,
      progress: 10, completed: true, claimed: false,
    }];
    state.questProgress = { d: 10 };
    checkQuestProgress('defeat_x', 5);
    expect((state.quests as any[])[0].progress).toBe(10);
  });
});

describe('claimQuestReward', () => {
  function seedCompleted() {
    state.quests = [{
      id: 'earn_1000', type: 'earn_money', target: 1000, desc: 't',
      rewardMoney: 300, rewardItem: 'potion', rewardQty: 2,
      progress: 1000, completed: true, claimed: false,
    }];
    state.questProgress = { earn_1000: 1000 };
    state.completedQuests = [];
  }

  it('выдаёт деньги+предмет, помечает claimed и пишет историю', () => {
    seedCompleted();
    const creditBefore = state.inventory.credit;
    const qtyBefore = state.inventory.potion || 0;
    claimQuestReward('earn_1000');
    expect((state.quests as any[])[0].claimed).toBe(true);
    expect(state.inventory.credit).toBe(creditBefore + 300);
    expect(state.inventory.potion).toBe(qtyBefore + 2);
    expect(state.completedQuests.length).toBe(1);
    // Сервер требует z.array(z.string()): объект ронял каждый сейв с 422.
    expect(state.completedQuests[0]).toBe('earn_1000');
  });

  it('повторный claim не выдаёт награду дважды', () => {
    seedCompleted();
    claimQuestReward('earn_1000');
    const creditAfterFirst = state.inventory.credit;
    claimQuestReward('earn_1000');
    expect(state.inventory.credit).toBe(creditAfterFirst);
    expect(state.completedQuests.length).toBe(1);
  });

  it('невыполненный квест забрать нельзя', () => {
    state.quests = [{
      id: 'e', type: 'earn_money', target: 1000, desc: 't',
      rewardMoney: 300, rewardItem: 'potion', rewardQty: 2,
      progress: 100, completed: false, claimed: false,
    }];
    state.questProgress = { e: 100 };
    state.completedQuests = [];
    const creditBefore = state.inventory.credit;
    claimQuestReward('e');
    expect(state.inventory.credit).toBe(creditBefore);
    expect((state.quests as any[])[0].claimed).toBe(false);
    expect(state.completedQuests.length).toBe(0);
  });
});
