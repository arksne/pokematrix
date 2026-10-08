// ─────────────────────────────────────────────────────────────
// quest-drops.ts — ДРОП ТОЛЬКО В КВЕСТЕ (I3)
// ─────────────────────────────────────────────────────────────
// Особые (квестовые) предметы падают с диких ТОЛЬКО пока взят нужный квест.
// Источник истины — сами квесты: collect_items с targetItem в NPC_DATA.
// Ручного маппинга нет: таблица строится автодеривом, всегда синхронна.
//
// Использование:
//   processMonsterDrop (location.ts) → rollQuestDrops(activeIds, rand)
//   isQuestActive (ниже) — квест взят и не сдан (NPC + обычные).
// ─────────────────────────────────────────────────────────────
import { state } from '../game/state.js';
import { NPC_DATA } from './npc.js';

/** Шанс квестового дропа с одного дикого (пока квест активен). */
export const QUEST_DROP_CHANCE = 0.08;

/** itemId → questId[] (из collect_items квестов). */
let cache: Record<string, string[]> | null = null;

export function questItemSources(): Record<string, string[]> {
  if (cache) return cache;
  const map: Record<string, string[]> = {};
  const npcs: any = NPC_DATA || {};
  for (const npc of Object.values(npcs) as any[]) {
    for (const q of (npc?.quests || []) as any[]) {
      if (q?.type === 'collect_items' && q?.targetItem && q?.id) {
        const list = (map[q.targetItem] = map[q.targetItem] || []);
        if (!list.includes(q.id)) list.push(q.id);
      }
    }
  }
  cache = map;
  return map;
}

/** Квест активен = взят и не сдан (NPC- и обычные ветки). */
export function isQuestActive(questId: string): boolean {
  if (!questId) return false;
  if ((state.completedNPCQuests || []).includes(questId)) return false;
  if ((state.completedQuests || []).some((c: any) => (c?.id ?? c) === questId)) return false;
  const main = (state.quests || []).find((q: any) => q?.id === questId);
  if (main) return !main.completed;
  if (state.npcQuestProgress && questId in state.npcQuestProgress) return true;
  if (state.questProgress && questId in state.questProgress) return true;
  return false;
}

/** Активные id квестов (для ролла дропа). */
export function activeQuestIds(): Set<string> {
  const out = new Set<string>();
  for (const q of (state.quests || []) as any[]) {
    if (q?.id && !q.completed) out.add(q.id);
  }
  for (const id of Object.keys(state.questProgress || {})) {
    if (!state.completedQuests?.some((c: any) => (c?.id ?? c) === id)) out.add(id);
  }
  for (const id of Object.keys(state.npcQuestProgress || {})) {
    if (!state.completedNPCQuests?.includes(id)) out.add(id);
  }
  return out;
}

/**
 * Ролл квестового дропа (чистая, для тестов).
 * Для каждого квестового предмета, чей ХОТЯ БЫ ОДИН квест активен — один
 * бросок шанса. Возвращает [{item, qty}].
 */
export function rollQuestDrops(
  activeIds: Set<string>,
  sources: Record<string, string[]> | null = null,
  rand: () => number = Math.random,
): Array<{ item: string; qty: number }> {
  const out: Array<{ item: string; qty: number }> = [];
  const table = sources ?? questItemSources();
  for (const [item, questIds] of Object.entries(table)) {
    if (!questIds.some((id) => activeIds.has(id))) continue;
    if (rand() < QUEST_DROP_CHANCE) out.push({ item, qty: 1 });
  }
  return out;
}
