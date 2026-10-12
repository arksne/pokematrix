import { describe, it, expect } from 'vitest';
import { NPC_DATA } from '../npc.js';
import { QUEST_TYPES } from '../quests.js';
import { rollQuestDrops } from '../quest-drops.js';

// ─────────────────────────────────────────────────────────────
// quests-content.test.ts — ЗАГЛУШКА (контент снесён, пишем заново)
// ─────────────────────────────────────────────────────────────
// Решение хозяина: все квесты удалены, система ждёт новый контент.
// Этот файл фиксирует пустое состояние и живость движка, чтобы
// висячие ссылки не пролезли молча. Когда начнём квесты заново —
// файл переписывается обратно под полный контент (было: I1, 30–40).
// ─────────────────────────────────────────────────────────────

const npcs = NPC_DATA as unknown as Record<string, { id: string; quests: unknown[] }>;
const allQuests = Object.values(npcs).flatMap((npc) => npc.quests ?? []);

describe('quests-content (контент снесён)', () => {
  it('список квестов пуст (решение: пишем заново)', () => {
    expect(allQuests).toEqual([]);
  });

  it('движок типов на месте (для будущих квестов)', () => {
    expect(Array.isArray(QUEST_TYPES)).toBe(true);
    expect((QUEST_TYPES as string[]).length).toBeGreaterThan(0);
  });

  it('без квестов дропов нет при любой удаче', () => {
    expect(rollQuestDrops(new Set(['anything']), {}, () => 0)).toEqual([]);
  });
});
