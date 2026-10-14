import { describe, it, expect } from 'vitest';
import { QUEST_CONFIGS, QUEST_TYPES } from '../quests.js';
import { ITEMS } from '../items.js';
import { MONSTER_DROP_TABLE } from '../drops.js';
import { SHADOW_IDS } from '../shadow-items.js';

// Регрессия «ежедневки сломаны»: 7 collect-квестов ссылались на
// призрачные targetItem (venonatHair, cuboneBone, coals, lavaCore,
// crystalShard, plantSample, seviperVenom), которых нет ни в ITEMS,
// ни в дропах. Квест выпадал в ротации (~70% дней), а выполнить его
// было невозможно — предмет никогда не падал в инвентарь.

const itemIds = new Set(ITEMS.map((i) => i.id));
const shadow = new Set(SHADOW_IDS || []);
const dropItems = new Set(
  Object.values(MONSTER_DROP_TABLE as Record<string, Array<{ item: string }>>).flatMap(
    (arr) => (arr || []).map((e) => e.item),
  ),
);

describe('daily QUEST_CONFIGS — валидность', () => {
  it('id уникальны, типы/цели/описания/награды в порядке', () => {
    const ids = QUEST_CONFIGS.map((q: any) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUEST_CONFIGS as any[]) {
      expect((QUEST_TYPES as string[]).includes(q.type), `${q.id}: type ${q.type}`).toBe(true);
      expect(Number.isInteger(q.target) && q.target > 0, `${q.id}: target`).toBe(true);
      expect(typeof q.desc === 'string' && q.desc.trim().length > 0, `${q.id}: desc`).toBe(true);
      expect(Number.isInteger(q.rewardMoney) && q.rewardMoney >= 0, `${q.id}: rewardMoney`).toBe(true);
      expect(Number.isInteger(q.rewardQty) && q.rewardQty > 0, `${q.id}: rewardQty`).toBe(true);
    }
  });

  it('rewardItem жив в ITEMS и не в тени', () => {
    for (const q of QUEST_CONFIGS as any[]) {
      expect(itemIds.has(q.rewardItem), `${q.id}: rewardItem ${q.rewardItem}`).toBe(true);
      expect(shadow.has(q.rewardItem), `${q.id}: rewardItem в тени`).toBe(false);
    }
  });

  it('collect targetItem жив в ITEMS, не в тени и падает в дропах', () => {
    const collect = (QUEST_CONFIGS as any[]).filter((q) => q.type === 'collect_items');
    expect(collect.length).toBeGreaterThan(0);
    for (const q of collect) {
      expect(itemIds.has(q.targetItem), `${q.id}: targetItem ${q.targetItem} нет в ITEMS`).toBe(true);
      expect(shadow.has(q.targetItem), `${q.id}: targetItem в тени`).toBe(false);
      expect(
        dropItems.has(q.targetItem),
        `${q.id}: targetItem ${q.targetItem} не падает ни с одного покемона (drops.js)`,
      ).toBe(true);
    }
  });

  it('призрачные предметы прошлого больше не используются', () => {
    const ghosts = ['venonatHair', 'cuboneBone', 'coals', 'lavaCore', 'crystalShard', 'plantSample', 'seviperVenom'];
    const used = new Set<string>();
    for (const q of QUEST_CONFIGS as any[]) {
      if (q.targetItem) used.add(q.targetItem);
      if (q.rewardItem) used.add(q.rewardItem);
    }
    for (const g of ghosts) {
      expect(used.has(g), `призрак ${g} всё ещё в конфигах`).toBe(false);
      expect(itemIds.has(g), `призрак ${g} внезапно появился в ITEMS`).toBe(false);
    }
  });
});
