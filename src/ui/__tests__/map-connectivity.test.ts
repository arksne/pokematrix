import { describe, it, expect } from 'vitest';
import { REGIONS } from '../../data/regions.js';
import { TRANSPORT_ROUTES } from '../../data/transport.js';
import { isServiceLoc } from '../map.js';

const allLocs: Record<string, any> = {
  ...(REGIONS as any).kanto.locations,
  ...(REGIONS as any).johto.locations,
};
const ids = Object.keys(allLocs);
/** Локации-исключения: рейсы (вход — по билету) и зоны блуждающих легенд. */
const NO_DOOR = ['trainRide', 'seaFerryRide'];
const isDoorless = (id: string) => NO_DOOR.includes(id) || allLocs[id]?.roaming === true;
const reverse = new Map<string, string[]>();
for (const id of ids) {
  for (const link of allLocs[id].links || []) {
    const list = reverse.get(link) || [];
    list.push(id);
    reverse.set(link, list);
  }
}
// Куда игрок может попасть по транспорту (рейсы и их конечные города)
const byTransport = new Set<string>();
for (const r of TRANSPORT_ROUTES) { byTransport.add(r.from); byTransport.add(r.to); }

describe('карта связная: нет локаций-тупиков', () => {
  it('у каждой локации есть выход (кроме рейсов и зон легенд)', () => {
    for (const id of ids) {
      if (isDoorless(id)) continue;
      expect((allLocs[id].links || []).length, `${id}: из локации некуда идти`).toBeGreaterThan(0);
    }
  });

  it('в каждую локацию можно войти (кроме стартовой и «без двери»)', () => {
    const START = 'goldenrodCity';
    const orphans: string[] = [];
    for (const id of ids) {
      if (id === START || isDoorless(id)) continue;
      if (byTransport.has(id)) continue;
      if (!(reverse.get(id) || []).length) orphans.push(id);
    }
    expect(orphans, 'локации без входа').toEqual([]);
  });

  it('все ссылки ведут в существующие локации (нет битых)', () => {
    const broken: string[] = [];
    for (const id of ids) {
      for (const link of allLocs[id].links || []) {
        if (!allLocs[link]) broken.push(`${id} → ${link}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('обратная связь симметрична: можно вернуться пешком', () => {
    // Вокзалы/причалы/магазины/центры — тупиковые подлокации внутри города,
    // они намеренно ведут только в свой город. Остальное — двустороннее.
    for (const id of ids) {
      if (isServiceLoc(id)) continue;
      for (const link of allLocs[id].links || []) {
        const back = allLocs[link]?.links || [];
        if (!allLocs[link] || isServiceLoc(link)) continue;
        expect(back, `${id} → ${link}, но не ${link} → ${id}`).toContain(id);
      }
    }
  });

  it('у локаций заявлен регион, и он совпадает с регионом карты', () => {
    for (const id of ids) {
      const expected = (REGIONS as any).kanto.locations[id] ? 'kanto' : 'johto';
      expect(allLocs[id].region, id).toBe(expected);
    }
  });

  it('id локаций не повторяются между регионами (иначе одна заслоняет другую)', () => {
    const kantoIds = Object.keys((REGIONS as any).kanto.locations);
    const johtoIds = Object.keys((REGIONS as any).johto.locations);
    const dup = kantoIds.filter((id) => johtoIds.includes(id));
    expect(dup, 'одинаковые id в обоих регионах').toEqual([]);
  });
});