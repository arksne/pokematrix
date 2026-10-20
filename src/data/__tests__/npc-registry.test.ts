/**
 * NPC-реестр: в нём не должно остаться NPC, которые никогда не появятся.
 *
 * Аудит нашёл NPC, чьи location отсутствуют в карте (целые несуществующие
 * регионы: flourence, warhall, il_de_far, sen_aspir…). NPC-панель фильтрует
 * строго по n.location === locId, поэтому такие NPC НИКОГДА не показывались —
 * мёртвый контент. Игрок решил их удалить.
 */
import { describe, it, expect } from 'vitest';
import { NPC_DATA, REMOVED_NPC_IDS, pruneDeadNpcs } from '../../data/npc.js';
import { REGIONS } from '../../data/regions.js';

function mapLocations(): Set<string> {
  const ids = new Set<string>();
  for (const region of Object.values(REGIONS) as any[]) {
    for (const id of Object.keys(region?.locations || {})) ids.add(id);
  }
  return ids;
}

describe('NPC-реестр без мёртвых записей', () => {
  it('все NPC указывают на существующие локации карты', () => {
    const known = mapLocations();
    const dead = Object.entries(NPC_DATA as Record<string, any>)
      .filter(([, npc]) => typeof npc?.location === 'string' && !known.has(npc.location))
      .map(([id]) => id);
    expect(dead, `NPC на несуществующих локациях: ${dead.join(', ')}`).toEqual([]);
  });

  it('удаление было идемпотентным — повторный прогон ничего не убирает', () => {
    const before = Object.keys(NPC_DATA).length;
    pruneDeadNpcs();
    expect(Object.keys(NPC_DATA).length).toBe(before);
  });

  it('список удалённых NPC непустой и фиксируется', () => {
    expect(Array.isArray(REMOVED_NPC_IDS)).toBe(true);
    expect(REMOVED_NPC_IDS.length).toBeGreaterThan(0);
    for (const id of REMOVED_NPC_IDS) {
      expect((NPC_DATA as any)[id], `${id} всё ещё в реестре`).toBeUndefined();
    }
  });

  it('живые NPC не потеряли квесты', () => {
    const withQuests = Object.values(NPC_DATA as Record<string, any>)
      .filter((n: any) => Array.isArray(n?.quests) && n.quests.length > 0);
    expect(withQuests.length).toBeGreaterThan(50);
  });

  it('профессор обучения и заводчица на месте (обучение не сломано)', () => {
    expect(NPC_DATA['professor_tutorial']).toBeTruthy();
    expect(NPC_DATA['pewter_breeder']).toBeTruthy();
    expect(NPC_DATA['daycare_pokecenter']).toBeTruthy();
  });
});