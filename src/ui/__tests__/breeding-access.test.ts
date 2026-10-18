/**
 * Разведение должно быть НАЙДИМО. Жалоба игрока: «нигде нет разведения,
 * они должны были быть в ПК».
 *
 * Реальная причина, которую это фиксирует:
 *   1. Кнопка у NPC стояла под id `pw_breeder`, а NPC называется
 *      `pewter_breeder` → условие не срабатывало НИКОГДА, кнопка мертвая.
 *   2. В ПК не было ни одного входа в разведение вообще.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NPC_DATA } from '../../data/npc.js';

const npcsSrc = readFileSync('src/ui/npcs.ts', 'utf8');
const pcSrc = readFileSync('src/ui/pc.ts', 'utf8');

describe('разведение доступно игроку', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('NPC-заводчица в стартовом городе реально существует под этим id', () => {
    // Если id в условии не совпадёт с ключом NPC_DATA — кнопка мёртвая,
    // и это ровно тот баг, из-за которого разведения «нигде не было».
    expect(NPC_DATA['pewter_breeder']).toBeTruthy();
    expect(String((NPC_DATA['pewter_breeder'] as any).location))
      .toContain('pewterCity');
  });

  it('кнопка разведения привязана к СУЩЕСТВУЮЩЕМУ id NPC', () => {
    const ids = [...npcsSrc.matchAll(/npcId === '([a-z0-9_]+)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    // Каждый id, на котором висит NPC-логика, обязан существовать в данных.
    for (const id of ids) {
      expect(NPC_DATA[id], `npcId '${id}' есть в коде, но нет в NPC_DATA`).toBeTruthy();
    }
  });

  it('в ПК есть вкладка «Разведение» с обработчиком', () => {
    expect(pcSrc).toMatch(/btn-pc-breed/);
    expect(pcSrc).toMatch(/Разведение/);
    // Обработчик зовёт openBreedBoxes — реальный экран боксов
    expect(pcSrc).toMatch(/openBreedBoxes/);
  });

  it('в ПК разведение импортировано (иначе вкладка — пустая)', () => {
    expect(pcSrc).toMatch(/import \{[^}]*openBreedBoxes[^}]*\} from '\.\/daycare\.js'/);
  });

  it('иконка ❤️ считается по реальным боксам, а не по мёртвому breedingPairs', () => {
    expect(pcSrc).not.toMatch(/state\.breedingPairs/);
    expect(pcSrc).toMatch(/breedBoxes/);
  });
});