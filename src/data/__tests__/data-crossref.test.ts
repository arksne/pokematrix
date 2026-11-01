/**
 * Cross-reference целостность игровых данных.
 *
 * Каждый файл данных по отдельности «валиден» (TypeScript не поймает опечатку в
 * строковом id), но связки между ними ломаются молча:
 *   - квест просит `targetItem: 'pokeBalll'` → предмет не выдаётся/не считается,
 *     квест невыполним, игрок навсегда в тупике;
 *   - `prereqQuest` на квест, которого нет → квест никогда не появится у NPC;
 *   - `boss_win` с bossId, которого нет в gymLeaders → награда недостижима;
 *   - вид в команде зала или в энкаунтерах не резолвится в таблицу статов →
 *     бой/охота на «нулевом» покемоне (нет силы, странная редкость);
 *   - дубли `id` квестов → прогресс пишется не в тот квест.
 *
 * Тест сверяет данные между собой, а не переписывает их вручную: меняется
 * контент — тест показывает, что именно рассыпалось.
 */
import { describe, it, expect } from 'vitest';
import { NPC_DATA } from '../npc.js';
import { ITEMS } from '../items.js';
import { gymLeaders } from '../gyms.js';
import { REGIONS } from '../regions.js';
import { POKEMON_BST } from '../pokemon-power-table.js';
import { baseSpecies } from '../power.js';
import { allNPCQuests } from '../../game/quest-track.js';

/** Типы, которые реально обрабатывает движок прогресса (quest-track.ts / npcs.ts). */
const HANDLED_QUEST_TYPES = new Set([
  'defeat_x',
  'catch_x',
  'explore',
  'earn_money',
  'use_item',
  'hatch_x',
  'trade_x',
  'boss_win',
  'streak_x',
  'collect_items',
  'special',
]);

const ITEM_IDS = new Set((ITEMS as any[]).map((i) => i?.id).filter(Boolean));

/** Резолвится ли вид в таблицу BST (напрямую или через базовую форму). */
function speciesKnown(name: string): boolean {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  if (n in POKEMON_BST) return true;
  return baseSpecies(n) in POKEMON_BST;
}

function allQuests(): any[] {
  try {
    return allNPCQuests();
  } catch {
    // Страховка: если движок переедет, тест не должен молча «проходить».
    const out: any[] = [];
    for (const npc of Object.values(NPC_DATA as any)) {
      for (const q of (npc as any)?.quests || []) out.push(q);
    }
    return out;
  }
}

describe('квесты NPC: связки с предметами и другими квестами', () => {
  const quests = allQuests();

  it('у каждого квеста есть id и поддерживаемый движком тип', () => {
    expect(quests.length).toBeGreaterThan(100);
    const badType = quests.filter((q) => !HANDLED_QUEST_TYPES.has(String(q?.type)));
    expect(badType.map((q) => `${q?.id}: ${q?.type}`), 'неизвестный тип = квест никогда не засчитается').toEqual([]);
  });

  it('id квестов уникальны (иначе прогресс пишется не туда)', () => {
    const ids = quests.map((q) => q?.id).filter(Boolean);
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    }
    expect([...dupes]).toEqual([]);
  });

  it('targetItem и rewardItem существуют в ITEMS', () => {
    const bad: string[] = [];
    for (const q of quests) {
      for (const field of ['targetItem', 'rewardItem'] as const) {
        const id = q?.[field];
        if (id && !ITEM_IDS.has(id)) bad.push(`${q.id}.${field}=${id}`);
      }
      for (const extra of q?.rewardItems || []) {
        if (extra?.id && !ITEM_IDS.has(extra.id)) bad.push(`${q.id}.rewardItems=${extra.id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('количества целей и наград положительные', () => {
    const bad: string[] = [];
    for (const q of quests) {
      if (q?.targetQty != null && !(Number(q.targetQty) > 0)) bad.push(`${q.id}.targetQty=${q.targetQty}`);
      if (q?.rewardItem && !(Number(q.rewardQty) > 0)) bad.push(`${q.id}.rewardQty=${q.rewardQty}`);
      if (q?.rewardMoney != null && !(Number(q.rewardMoney) >= 0)) bad.push(`${q.id}.rewardMoney=${q.rewardMoney}`);
    }
    expect(bad).toEqual([]);
  });

  it('prereqQuest указывает на существующий квест (или на шаг обучения)', () => {
    const ids = new Set(quests.map((q) => q?.id).filter(Boolean));
    const bad: string[] = [];
    for (const q of quests) {
      const pre = q?.prereqQuest;
      if (!pre) continue;
      const isTutorial = String(pre).startsWith('tutorial_');
      if (!isTutorial && !ids.has(pre)) bad.push(`${q.id} → ${pre}`);
    }
    expect(bad).toEqual([]);
  });

  it('boss_win ссылается на существующего лидера/мини-босса', () => {
    const leaders = gymLeaders as Record<string, any>;
    const bad: string[] = [];
    for (const q of quests) {
      if (q?.type !== 'boss_win') continue;
      const bossId = q?.filter?.bossId;
      if (bossId && !leaders[bossId]) bad.push(`${q.id} → ${bossId}`);
    }
    expect(bad).toEqual([]);
  });

  it('у NPC с квестами заполнены тексты диалога (иначе пустые окна)', () => {
    const bad: string[] = [];
    for (const [npcId, npc] of Object.entries(NPC_DATA as any)) {
      const qs = (npc as any)?.quests || [];
      if (!qs.length) continue;
      const d = (npc as any)?.dialog || {};
      if (!String(d.greet || '').trim()) bad.push(`${npcId}.greet`);
      if (!String(d.quest_offer || '').trim()) bad.push(`${npcId}.quest_offer`);
    }
    expect(bad).toEqual([]);
  });
});

describe('покемоны в данных: команды залов и энкаунтеры резолвятся в таблицу статов', () => {
  it('все виды в командах лидеров/мини-боссов известны', () => {
    const bad: string[] = [];
    for (const [key, leader] of Object.entries(gymLeaders as Record<string, any>)) {
      for (const member of leader?.team || []) {
        if (!speciesKnown(member?.name)) bad.push(`${key}: ${member?.name}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('все виды в энкаунтерах локаций известны', () => {
    const bad: string[] = [];
    const unknown = new Set<string>();
    for (const region of Object.values(REGIONS as any)) {
      for (const [locId, loc] of Object.entries((region as any)?.locations || {})) {
        for (const name of (loc as any)?.encounters || []) {
          if (!speciesKnown(name)) unknown.add(`${locId}: ${name}`);
        }
      }
    }
    bad.push(...unknown);
    expect(bad).toEqual([]);
  });

  it('у каждого лидера зала (не мини-босса) есть бейдж, награда и непустая команда', () => {
    const bad: string[] = [];
    for (const [key, leader] of Object.entries(gymLeaders as Record<string, any>)) {
      if (leader?.friendly) continue;
      if (!String(leader?.badgeName || '').trim()) bad.push(`${key}.badgeName`);
      if (!(Number(leader?.moneyReward) > 0)) bad.push(`${key}.moneyReward`);
      if (!Array.isArray(leader?.team) || leader.team.length === 0) bad.push(`${key}.team`);
      if (!leader?.rewardItem || !ITEM_IDS.has(leader.rewardItem)) bad.push(`${key}.rewardItem=${leader?.rewardItem}`);
      if (!(Number(leader?.team?.[0]?.level) > 0)) bad.push(`${key}.team.level`);
    }
    expect(bad).toEqual([]);
  });
});
