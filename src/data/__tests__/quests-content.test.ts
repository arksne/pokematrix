import { describe, it, expect } from 'vitest';
import { NPC_DATA } from '../npc.js';
import { ITEMS } from '../items.js';
import { QUEST_TYPES } from '../quests.js';

// ─────────────────────────────────────────────────────────────
// quests-content.test.ts — контент квестов NPC (блок I1)
// ─────────────────────────────────────────────────────────────
// Проверяет:
//   1. I1-блок существует и содержит 30–40 квестов.
//   2. id всех NPC-квестов уникальны (глобально).
//   3. Цепочки без висячих ссылок: каждый prereqQuest либо null,
//      либо указывает на существующий id; внутри I1 — без циклов,
//      цепочки self-contained (prereq тоже i1_ либо null).
//   4. У I1-квестов валидные type/reward/target:
//      type ∈ QUEST_TYPES, targetQty > 0, desc непустой,
//      rewardMoney ≥ 0, rewardItem существует в ITEMS,
//      rewardQty > 0, collect_items требует существующий
//      targetItem, остальные типы — targetItem null.
//   5. Покрытие: все 6 типов и все 8 тематик (битвы NPC, сбор,
//      прокачка, яйца/hatch, ловля видов, зал, торговля,
//      тренировки) представлены.
//   6. Награды адекватны прогрессии: деньги ≤ 100 000 за квест,
//      без топ-предметов за старт (masterBall/rareCandy/evBrace).
//
// NOTE: строгая проверка rewardItem/targetItem применяется только
// к I1 (id i1_*). Легаси-квесты файла используют плейсхолдеры
// ('candy', 'venonatHair', ...), которых нет в ITEMS — их тексты
// по условию задачи не трогаем, поэтому глобально проверяем
// только уникальность id и целостность цепочек, плюс допустимость
// type с учётом легаси 'collect_drop' (tutorial_6).
// ─────────────────────────────────────────────────────────────

type NpcQuest = {
  id: string;
  type: string;
  targetItem: string | null;
  targetQty: number;
  desc: string;
  rewardMoney: number;
  rewardItem: string;
  rewardQty: number;
  prereqQuest: string | null;
};

const npcs = NPC_DATA as unknown as Record<string, { id: string; quests: NpcQuest[] }>;
const allQuests: Array<NpcQuest & { npcId: string }> = Object.values(npcs).flatMap((npc) =>
  (npc.quests ?? []).map((q) => ({ ...q, npcId: npc.id })),
);
const byId = new Map(allQuests.map((q) => [q.id, q]));
const i1Quests = allQuests.filter((q) => q.id.startsWith('i1_'));
const itemIds = new Set(ITEMS.map((i) => i.id));
const LEGACY_EXTRA_TYPES = ['collect_drop'];
const allowedTypes = new Set([...(QUEST_TYPES as string[]), ...LEGACY_EXTRA_TYPES]);
const TOP_ITEMS = ['masterBall', 'rareCandy', 'evBrace'];

describe('quests-content (I1)', () => {
  it('блок I1 содержит 30–40 квестов', () => {
    expect(i1Quests.length).toBeGreaterThanOrEqual(30);
    expect(i1Quests.length).toBeLessThanOrEqual(40);
  });

  it('id всех NPC-квестов уникальны', () => {
    const ids = allQuests.map((q) => q.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `дубли id: ${[...new Set(dupes)].join(', ')}`).toEqual([]);
  });

  it('цепочки без висячих ссылок (глобально)', () => {
    const broken = allQuests.filter(
      (q) => q.prereqQuest !== null && q.prereqQuest !== undefined && !byId.has(q.prereqQuest),
    );
    expect(
      broken.map((q) => `${q.id} -> ${q.prereqQuest}`),
      'висячие prereqQuest',
    ).toEqual([]);
  });

  it('цепочки I1 self-contained и без циклов', () => {
    // prereq внутри I1 — только null или другой i1_* (цепочек наружу нет)
    const outside = i1Quests.filter(
      (q) => q.prereqQuest !== null && !q.prereqQuest.startsWith('i1_'),
    );
    expect(outside.map((q) => q.id), 'prereq I1 наружу блока').toEqual([]);
    // ацикличность: идём по prereq-цепочке, не должны вернуться
    for (const q of i1Quests) {
      const seen = new Set<string>();
      let cur: string | null = q.prereqQuest;
      while (cur) {
        expect(seen.has(cur), `цикл в цепочке квеста ${q.id} на ${cur}`).toBe(false);
        seen.add(cur);
        const next = byId.get(cur);
        cur = next ? next.prereqQuest : null;
      }
    }
    // у каждой цепочки есть голова (prereqQuest null)
    const heads = i1Quests.filter((q) => q.prereqQuest === null);
    expect(heads.length).toBeGreaterThanOrEqual(5);
  });

  it('у всех квестов допустимый type', () => {
    const bad = allQuests.filter((q) => !allowedTypes.has(q.type));
    expect(bad.map((q) => `${q.id}:${q.type}`)).toEqual([]);
  });

  it('у I1-квестов валидные type/reward/target', () => {
    expect(i1Quests.length).toBeGreaterThan(0);
    for (const q of i1Quests) {
      expect((QUEST_TYPES as string[]).includes(q.type), `${q.id}: type ${q.type}`).toBe(true);
      expect(
        Number.isInteger(q.targetQty) && q.targetQty > 0,
        `${q.id}: targetQty`,
      ).toBe(true);
      expect(typeof q.desc === 'string' && q.desc.trim().length > 0, `${q.id}: desc`).toBe(
        true,
      );
      expect(
        Number.isInteger(q.rewardMoney) && q.rewardMoney >= 0,
        `${q.id}: rewardMoney`,
      ).toBe(true);
      expect(itemIds.has(q.rewardItem), `${q.id}: rewardItem ${q.rewardItem}`).toBe(true);
      expect(
        Number.isInteger(q.rewardQty) && q.rewardQty > 0,
        `${q.id}: rewardQty`,
      ).toBe(true);
      if (q.type === 'collect_items') {
        expect(q.targetItem, `${q.id}: targetItem должен быть задан`).toBeTruthy();
        expect(itemIds.has(q.targetItem as string), `${q.id}: targetItem ${q.targetItem}`).toBe(
          true,
        );
      } else {
        expect(q.targetItem, `${q.id}: targetItem должен быть null`).toBeNull();
      }
    }
  });

  it('I1 покрывает все 6 типов квестов', () => {
    const types = new Set(i1Quests.map((q) => q.type));
    for (const t of QUEST_TYPES as string[]) {
      expect(types.has(t), `нет квестов типа ${t}`).toBe(true);
    }
  });

  it('I1 покрывает все 8 тематик', () => {
    const text = (q: NpcQuest) => `${q.desc}`;
    const has = (re: RegExp) => i1Quests.some((q) => re.test(text(q)));
    expect(has(/спарринг|претендент|пират/i), 'нет темы битв с NPC').toBe(true);
    expect(has(/Соберите|Подготовьте/i), 'нет темы сбора предметов').toBe(true);
    expect(has(/уровн|прокач/i), 'нет темы прокачки до уровня').toBe(true);
    expect(has(/яйц|инкубатор|малыш|питомник/i), 'нет темы выведения яйца').toBe(true);
    expect(has(/Поймайте/i), 'нет темы ловли видов').toBe(true);
    expect(has(/стадион/i), 'нет темы побед в зале').toBe(true);
    expect(has(/торгов|рынк|сделк/i), 'нет темы торговли').toBe(true);
    expect(has(/трениров/i), 'нет темы тренировок').toBe(true);
  });

  it('награды I1 адекватны прогрессии (без топа за старт)', () => {
    for (const q of i1Quests) {
      expect(q.rewardMoney, `${q.id}: rewardMoney`).toBeLessThanOrEqual(100000);
      expect(TOP_ITEMS.includes(q.rewardItem), `${q.id}: топ-предмет ${q.rewardItem}`).toBe(
        false,
      );
      if (q.type === 'collect_items') {
        expect(TOP_ITEMS.includes(q.targetItem as string)).toBe(false);
      }
    }
  });
});
