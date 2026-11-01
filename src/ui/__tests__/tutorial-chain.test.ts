import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../../game/state.js';
import { store } from '../../game/store.js';
import { NPC_DATA } from '../../data/npc.js';
import { ensureTutorialQuests } from '../tutorial.js';

// ─────────────────────────────────────────────────────────────
// tutorial-chain.test.ts — цепочка обучения Профессора Оука (6 шагов).
//
// Это самый хрупкий путь игры: пока не сданы все 6 шагов, гейт не выпускает
// из стартового города. Если прогресс не двигается или кнопка «Сдать» не
// появляется — новый игрок навсегда заперт на старте (такие затыки уже были:
// у Оука не было квестов вообще, прогресс никто не двигал).
//
// Проверяем без браузера, на стабах DOM (как npcs.test.ts): продвижение
// прогресса, кап по цели, изоляцию шагов и сдачу шага с наградой.
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
    appendChild(c: any) {
      this.children.push(c);
      c.parentNode = this;
      return c;
    },
    insertBefore(c: any) {
      this.children.unshift(c);
      return c;
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  return el;
}

function installDom() {
  const els: Record<string, any> = {};
  const body = makeEl('body');
  (globalThis as any).document = {
    getElementById: (id: string) => {
      if (els[id]) return els[id];
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

/** Собрать все «кнопки» из разметки квестов (в стабе DOM — это вложенные элементы). */
function questButtons(): any[] {
  const container = (globalThis as any).document.getElementById('npc-quests');
  const out: any[] = [];
  for (const child of container.children || []) {
    for (const c of child.children || []) {
      if (typeof c.onclick === 'function' || c.innerText) out.push(c);
    }
  }
  return out;
}

function buttonByText(text: string): any | undefined {
  return questButtons().find((b) => (b.innerText || '').trim() === text);
}

function tutorialNpc() {
  const npc = NPC_DATA['professor_tutorial'] as any;
  npc.dialog = {
    greet: 'Приветствую, молодой тренер!',
    default: 'Продолжай тренироваться.',
    quest_offer: 'Вот задание: {target} {item}. Справишься?',
    quest_complete: 'Превосходно!',
    quest_incomplete: 'Возвращайся, когда выполнишь.',
  };
  return npc;
}

beforeEach(() => {
  installDom();
  store.setState(state);
  ensureTutorialQuests(); // гарантирует, что у Оука есть все 6 квестов
  state.tutorialStep = 1;
  state.npcQuestProgress = {};
  state.completedNPCQuests = [];
  state.inventory = { credit: 1000, pokeBall: 0, potion: 0, superPotion: 0, paralyzeHeal: 0, rareCandy: 0, ultraBall: 0 };
  state.myTeam = [];
  state.pokedexCaught = new Set<string>();
  state.visitedLocations = new Set<string>(['pewterCity']);
  state.currentLocationId = 'pewterCity';
  state.isDaytime = true;
  state.badges = [];
});

describe('прогресс обучения двигается от игровых событий', () => {
  it('шаг 1 (поймать 1): поимка закрывает прогресс и не переполняет цель', async () => {
    const { checkTutorialProgress } = await import('../npcs.js');
    checkTutorialProgress('catch_x', 1);
    expect(state.npcQuestProgress['tutorial_1']).toBe(1);
    // Повторная поимка не делает «2/1»
    checkTutorialProgress('catch_x', 1);
    expect(state.npcQuestProgress['tutorial_1']).toBe(1);
  });

  it('чужой тип события не двигает текущий шаг', async () => {
    const { checkTutorialProgress } = await import('../npcs.js');
    checkTutorialProgress('defeat_x', 1); // шаг 1 ждёт catch_x
    expect(state.npcQuestProgress['tutorial_1']).toBeUndefined();
    expect(state.npcQuestProgress['tutorial_2']).toBeUndefined();
  });

  it('шаг 2 (победить 3): три победы закрывают цель ровно в 3', async () => {
    const { checkTutorialProgress } = await import('../npcs.js');
    state.tutorialStep = 2;
    checkTutorialProgress('defeat_x', 1);
    checkTutorialProgress('defeat_x', 1);
    expect(state.npcQuestProgress['tutorial_2']).toBe(2);
    checkTutorialProgress('defeat_x', 1);
    expect(state.npcQuestProgress['tutorial_2']).toBe(3);
    checkTutorialProgress('defeat_x', 1);
    expect(state.npcQuestProgress['tutorial_2']).toBe(3);
  });

  it('после обучения (шаг > 6) прогресс не копится', async () => {
    const { checkTutorialProgress } = await import('../npcs.js');
    state.tutorialStep = 7;
    checkTutorialProgress('catch_x', 1);
    expect(state.npcQuestProgress).toEqual({});
  });

  it('уже сданный шаг повторно не двигается', async () => {
    const { checkTutorialProgress } = await import('../npcs.js');
    state.completedNPCQuests = ['tutorial_1'];
    checkTutorialProgress('catch_x', 1);
    expect(state.npcQuestProgress['tutorial_1']).toBeUndefined();
  });
});

describe('сдача шага у Оука: кнопки и награда', () => {
  it('пока прогресс не закрыт — кнопка «Взять», после закрытия — «Сдать»', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const npc = tutorialNpc();
    renderNPCQuests(npc);
    expect(buttonByText('Взять')).toBeTruthy();
    expect(buttonByText('Сдать')).toBeFalsy();

    // Взяли квест → прогресс открылся, задание выполнено
    buttonByText('Взять')!.onclick();
    expect(state.npcQuestProgress['tutorial_1']).toBe(0);
    state.npcQuestProgress['tutorial_1'] = 1;
    renderNPCQuests(npc);
    expect(buttonByText('Сдать')).toBeTruthy();
  });

  it('«Сдать» на шаге 1: tutorialStep → 2, награда начислена, прогресс очищен', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const npc = tutorialNpc();
    state.npcQuestProgress['tutorial_1'] = 1;
    renderNPCQuests(npc);
    const creditBefore = state.inventory['credit'];
    buttonByText('Сдать')!.onclick();
    expect(state.tutorialStep).toBe(2);
    expect(state.completedNPCQuests).toContain('tutorial_1');
    expect(state.npcQuestProgress['tutorial_1']).toBeUndefined();
    expect(state.inventory['credit']).toBe(creditBefore + 500); // награда шага 1
    expect(state.inventory['pokeBall']).toBe(5); // 5 покеболов
  });

  it('сдача шага 6 открывает гейт (tutorialStep > 6)', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const { isTutorialGateOpen } = await import('../location.js');
    const npc = tutorialNpc();
    state.tutorialStep = 6;
    // К шагу 6 игрок уже сдал предыдущие пять — иначе квест закрыт prereq-ом.
    state.completedNPCQuests = ['tutorial_1', 'tutorial_2', 'tutorial_3', 'tutorial_4', 'tutorial_5'];
    state.npcQuestProgress['tutorial_6'] = 1;
    renderNPCQuests(npc);
    buttonByText('Сдать')!.onclick();
    expect(state.tutorialStep).toBe(7);
    expect(isTutorialGateOpen()).toBe(true);
  });

  it('двойной клик по «Сдать» не выдаёт награду дважды', async () => {
    const { renderNPCQuests } = await import('../npcs.js');
    const npc = tutorialNpc();
    state.npcQuestProgress['tutorial_1'] = 1;
    renderNPCQuests(npc);
    const creditBefore = state.inventory['credit'];
    const btn = buttonByText('Сдать')!;
    btn.onclick();
    // Кнопка могла остаться в разметке — повторный клик должен быть no-op
    btn.onclick();
    expect(state.inventory['credit']).toBe(creditBefore + 500);
    expect(state.completedNPCQuests.filter((id: string) => id === 'tutorial_1')).toHaveLength(1);
  });
});
