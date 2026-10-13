import { describe, it, expect } from 'vitest';
import { NPC_DATA } from '../npc.js';
import { ITEMS } from '../items.js';
import { QUEST_TYPES } from '../quests.js';
import { TITLES } from '../titles.js';

// ─────────────────────────────────────────────────────────────
// quests-content.test.ts — контент пачки Пьютера (10 гринд-квестов)
// ─────────────────────────────────────────────────────────────
// Проверяет:
//   1. Ровно 10 квестов pw_* (план хозяина).
//   2. id уникальны; prereq указывают на существующие.
//   3. type ∈ QUEST_TYPES; targetQty > 0; desc непустой.
//   4. rewardItem существует в ITEMS; rewardTitle — в TITLES.
//   5. targetItem (collect) существует; giveItem существует.
//   6. Локации NPC и verify.locs существуют в REGIONS.
// ─────────────────────────────────────────────────────────────
import { REGIONS } from '../regions.js';

type NpcQuest = {
  id: string;
  type: string;
  targetItem: string | null;
  targetQty: number;
  desc: string;
  rewardMoney: number;
  rewardItem: string;
  rewardQty: number;
  rewardTitle?: string;
  prereqQuest: string | null;
  giveItem?: string;
  verify?: any;
};

const npcs = NPC_DATA as unknown as Record<string, { id: string; location: string; quests: NpcQuest[] }>;
const allQuests: Array<NpcQuest & { npcId: string }> = Object.values(npcs).flatMap((npc) =>
  (npc.quests ?? []).map((q) => ({ ...q, npcId: npc.id })),
);
const byId = new Map(allQuests.map((q) => [q.id, q]));
const itemIds = new Set(ITEMS.map((i) => i.id));
const titleIds = new Set(TITLES.map((t) => t.id));
const locIds = new Set(
  Object.values(REGIONS as any).flatMap((r: any) => Object.keys(r.locations || {})),
);

describe('quests-content (пачка Пьютера)', () => {
  it('ровно 10 квестов pw_*', () => {
    const pw = allQuests.filter((q) => q.id.startsWith('pw_'));
    expect(pw.length).toBe(10);
    expect(allQuests.length).toBe(10);
  });

  it('id уникальны, prereq существуют', () => {
    const ids = allQuests.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of allQuests) {
      if (q.prereqQuest) expect(byId.has(q.prereqQuest), `${q.id} → ${q.prereqQuest}`).toBe(true);
    }
  });

  it('типы валидны, количества и описания в порядке', () => {
    expect(allQuests.length).toBeGreaterThan(0);
    for (const q of allQuests) {
      expect((QUEST_TYPES as string[]).includes(q.type), `${q.id}: type ${q.type}`).toBe(true);
      expect(Number.isInteger(q.targetQty) && q.targetQty > 0, `${q.id}: targetQty`).toBe(true);
      expect(typeof q.desc === 'string' && q.desc.trim().length > 0, `${q.id}: desc`).toBe(true);
      expect(Number.isInteger(q.rewardMoney) && q.rewardMoney >= 0, `${q.id}: rewardMoney`).toBe(true);
      expect(Number.isInteger(q.rewardQty) && q.rewardQty > 0, `${q.id}: rewardQty`).toBe(true);
    }
  });

  it('награды и цели — живые предметы и титулы', () => {
    for (const q of allQuests) {
      expect(itemIds.has(q.rewardItem), `${q.id}: rewardItem ${q.rewardItem}`).toBe(true);
      if (q.targetItem) expect(itemIds.has(q.targetItem), `${q.id}: targetItem ${q.targetItem}`).toBe(true);
      if (q.giveItem) expect(itemIds.has(q.giveItem), `${q.id}: giveItem ${q.giveItem}`).toBe(true);
      if (q.rewardTitle) expect(titleIds.has(q.rewardTitle), `${q.id}: rewardTitle ${q.rewardTitle}`).toBe(true);
    }
  });

  it('NPC и verify-локации существуют', () => {
    for (const [npcId, npc] of Object.entries(npcs)) {
      if ((npc.quests ?? []).length === 0) continue;
      expect(locIds.has(npc.location), `NPC ${npcId}: location ${npc.location}`).toBe(true);
    }
    for (const q of allQuests) {
      for (const l of q.verify?.locs || []) {
        expect(locIds.has(l), `${q.id}: verify loc ${l}`).toBe(true);
      }
    }
  });

  it('цепочки без циклов', () => {
    for (const q of allQuests) {
      const seen = new Set<string>();
      let cur: string | null = q.prereqQuest;
      while (cur) {
        expect(seen.has(cur), `цикл на ${cur}`).toBe(false);
        seen.add(cur);
        cur = byId.get(cur)?.prereqQuest || null;
      }
    }
  });
});
