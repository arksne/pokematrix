import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../../game/state.js';
import { store } from '../../game/store.js';
import { NPC_DATA } from '../../data/npc.js';
import { ITEMS } from '../../data/items.js';
import {
  TUTORIAL_QUEST_DEFS,
  ensureTutorialQuests,
  applyTutorialCompletion,
  completeTutorialGate,
} from '../tutorial.js';

/**
 * Мост UI-тур → NPC-гейт.
 * DOM-прохождение (клики по оверлею) тестами не покрыть — здесь только
 * unit-тестируемая логика: наличие дефов, их инъекция и смена гейта.
 */

const TUTORIAL_IDS = ['tutorial_1', 'tutorial_2', 'tutorial_3', 'tutorial_4', 'tutorial_5', 'tutorial_6'];

beforeEach(() => {
  state.tutorialStep = 0;
  state.completedNPCQuests = [];
  state.npcQuestProgress = {};
  // completeTutorialGate мутирует живое состояние через store.getState();
  // в проде это та же ссылка (init.ts: store.setState(state)).
  store.setState(state);
});

describe('TUTORIAL_QUEST_DEFS: цепочка проходима', () => {
  it('6 шагов, строгая prereq-лесенка', () => {
    expect(TUTORIAL_QUEST_DEFS.map((q) => q.id)).toEqual(TUTORIAL_IDS);
    expect(TUTORIAL_QUEST_DEFS[0].prereqQuest).toBeNull();
    for (let i = 1; i < TUTORIAL_QUEST_DEFS.length; i++) {
      expect(TUTORIAL_QUEST_DEFS[i].prereqQuest).toBe(TUTORIAL_IDS[i - 1]);
    }
  });

  it('типы совпадают с эмиттерами battle/core.ts', () => {
    const emitters = new Set(['catch_x', 'defeat_x', 'use_item', 'explore', 'earn_money', 'collect_drop']);
    for (const q of TUTORIAL_QUEST_DEFS) {
      expect(emitters.has(q.type)).toBe(true);
    }
  });

  it('награды — существующие предметы', () => {
    const ids = new Set(ITEMS.map((i: any) => i.id));
    for (const q of TUTORIAL_QUEST_DEFS) {
      expect(ids.has(q.rewardItem)).toBe(true);
      expect(q.rewardQty).toBeGreaterThan(0);
      expect(q.targetQty).toBeGreaterThan(0);
    }
  });
});

describe('ensureTutorialQuests', () => {
  it('дописывает недостающие 6 квестов Оуку и идемпотентно', () => {
    const npc = (NPC_DATA as any)['professor_tutorial'];
    expect(npc).toBeTruthy();
    const before = [...(npc.quests || [])].filter((q: any) => !String(q?.id || '').startsWith('tutorial_'));
    npc.quests = [...before];

    expect(ensureTutorialQuests()).toBe(true);
    const ids = npc.quests.map((q: any) => q.id);
    for (const tid of TUTORIAL_IDS) expect(ids).toContain(tid);

    const len = npc.quests.length;
    expect(ensureTutorialQuests()).toBe(true);
    expect(npc.quests.length).toBe(len);
  });
});

describe('applyTutorialCompletion / completeTutorialGate', () => {
  it('чистая функция: шаг 7, все 6 в сданных, прогресс вычищен', () => {
    const s: any = {
      tutorialStep: 1,
      completedNPCQuests: ['tutorial_1'],
      npcQuestProgress: { tutorial_2: 2, pw_trail: 5 },
    };
    applyTutorialCompletion(s);
    expect(s.tutorialStep).toBe(7);
    for (const tid of TUTORIAL_IDS) expect(s.completedNPCQuests).toContain(tid);
    expect(s.npcQuestProgress['tutorial_2']).toBeUndefined();
    expect(s.npcQuestProgress['pw_trail']).toBe(5);
  });

  it('мост на реальном state открывает гейт-условие (шаг > 6 + tutorial_6)', () => {
    state.tutorialStep = 1;
    state.completedNPCQuests = [];
    state.npcQuestProgress = { tutorial_1: 1 };
    completeTutorialGate();
    expect(state.tutorialStep).toBeGreaterThan(6);
    expect(state.completedNPCQuests).toContain('tutorial_6');
    expect(state.npcQuestProgress['tutorial_1']).toBeUndefined();
  });

  it('повторный вызов не дублирует сдачи', () => {
    state.tutorialStep = 7;
    state.completedNPCQuests = [...TUTORIAL_IDS];
    completeTutorialGate();
    expect(state.completedNPCQuests.filter((q: string) => q === 'tutorial_6')).toHaveLength(1);
  });
});
