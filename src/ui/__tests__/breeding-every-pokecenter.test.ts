/**
 * Разведение доступно в каждом покецентре («везде должно быть в каждом пц»),
 * но ЕДИНСТВЕННЫЙ вход — вкладка «💕 Разведение» в ПК. Кнопок разведения в
 * диалогах NPC быть не должно: это был дубль одного и того же экрана.
 *
 * Что фиксирует:
 *  1. Кнопка разведения вешалась в диалоге NPC → в покецентре должен быть NPC.
 *     9 покецентов (Паллет, Нью-Барк, Лавандер, одиночные острова…) были вообще
 *     без NPC, и разведения там не существовало.
 *  2. Дублирование «развести» в NPC убрано — разведение живёт в ПК.
 */
import { describe, it, expect } from 'vitest';
import '../../data/pokecenter-npcs.js';
import { NPC_DATA } from '../../data/npc.js';
import { pokecenterLocations } from '../../data/pokecenter-npcs.js';
import { readFileSync } from 'node:fs';

const npcsSrc = readFileSync('src/ui/npcs.ts', 'utf8');

describe('разведение доступно в каждом покецентре', () => {
  it('в каждом покецентре игры есть хотя бы один NPC (через него открывается ПК)', () => {
    const locs = pokecenterLocations();
    expect(locs.length).toBeGreaterThan(10);
    const missing = locs.filter((loc) =>
      !Object.values(NPC_DATA).some((n: any) => n && n.location === loc));
    expect(missing, `покецентры без NPC: ${missing.join(', ')}`).toEqual([]);
  });

  it('в диалогах NPC кнопки разведения НЕТ — это дубль вкладки в ПК', () => {
    expect(npcsSrc).not.toMatch(/openBreedBoxes/);
    expect(npcsSrc).not.toMatch(/Боксы разведения/);
    // при этом терминал ПК в покецентре остаётся
    expect(npcsSrc).toMatch(/Открыть PC/);
  });

  it('условие кнопки ПК — по локации, а не по списку id', () => {
    expect(npcsSrc).toMatch(/_pokecenter\$/);
    expect(npcsSrc).toMatch(/inPokeCenter/);
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