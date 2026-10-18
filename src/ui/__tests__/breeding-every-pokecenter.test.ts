/**
 * Разведение должно быть в КАЖДОМ покецентре («везде должно быть в каждом пц»).
 *
 * Что фиксирует:
 *  1. Кнопка разведения вешается в диалоге NPC → в покецентре должен быть NPC.
 *     9 покецентов (Паллет, Нью-Барк, Лавандер, одиночные острова…) были вообще
 *     без NPC, и разведения там не существовало.
 *  2. Условие кнопки — по локации NPC (`_pokecenter`), а не по его id.
 *     Списком id разведение жило только в двух местах.
 */
import { describe, it, expect } from 'vitest';
import '../../data/pokecenter-npcs.js';
import { NPC_DATA } from '../../data/npc.js';
import { pokecenterLocations } from '../../data/pokecenter-npcs.js';
import { readFileSync } from 'node:fs';

const npcsSrc = readFileSync('src/ui/npcs.ts', 'utf8');

describe('разведение доступно в каждом покецентре', () => {
  it('в каждом покецентре игры есть хотя бы один NPC', () => {
    const locs = pokecenterLocations();
    expect(locs.length).toBeGreaterThan(10);
    const missing = locs.filter((loc) =>
      !Object.values(NPC_DATA).some((n: any) => n && n.location === loc));
    expect(missing, `покецентры без NPC: ${missing.join(', ')}`).toEqual([]);
  });

  it('условие кнопки разведения — по локации, а не по списку id', () => {
    expect(npcsSrc).toMatch(/_pokecenter\$/);
    expect(npcsSrc).toMatch(/inPokeCenter/);
    // Список конкретных NPC-id, у которых раньше жила кнопка, убран
    expect(npcsSrc).not.toMatch(/npcId === 'pewter_breeder'/);
  });

  it('досоздание NPC идемпотентно — повторный вызов не плодит дубли', async () => {
    const { ensurePokecenterNpcs } = await import('../../data/pokecenter-npcs.js');
    const before = Object.keys(NPC_DATA).length;
    ensurePokecenterNpcs();
    ensurePokecenterNpcs();
    expect(Object.keys(NPC_DATA).length).toBe(before);
  });

  it('все NPC реально существуют в реестре (без мёртвых id в коде)', () => {
    const ids = [...npcsSrc.matchAll(/npcId === '([a-z0-9_]+)'/g)].map((m) => m[1]);
    for (const id of ids) {
      expect(NPC_DATA[id], `npcId '${id}' есть в коде, но нет в NPC_DATA`).toBeTruthy();
    }
  });
});