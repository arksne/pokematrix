/**
 * КАРТА: все локации достижимы.
 *
 * Аудит нашёл 47 локаций, отрезанных от карты НУЛЁМ связей: весь архипелаг
 * Sevii, Грёзное Ущелье, Сафари-зона Джото, каньон Севолт и зона блуждания.
 * Контент этих локаций (энкаунтеры, NPC, точки квестов) был недостижим
 * целиком. Ни у одной из них не было даже одной связи с достижимой картой.
 *
 * Связи добавлены по канону:
 *   oneIsland      ← palletTown      (Олеана/парс от Паллет)
 *   liptooChamber  ← burnedTower     (Грёзное Ущелье под башней)
 *   route47        ← route43         (заповедник с 43-го маршрута)
 *   canyonEntrance ← route42         (каньон у Вайолета)
 *   roamingJohto   ← blackthornCity  (роуминг = пост-игровые легендарки)
 *   fourIsland     ← threeIslePort   (паром между островами)
 *
 * Гейт по значкам — контент поздний, чтобы игрок не попал в Sevii на 1-м значке.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { REGIONS } from '../../data/regions.js';
import { TRANSPORT_ROUTES } from '../../data/transport.js';

const src = readFileSync('src/data/regions.ts', 'utf-8');

/** Все локации карты: id -> links. */
function allLocations(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const region of Object.values(REGIONS) as any[]) {
    for (const [id, loc] of Object.entries(region?.locations || {}) as any[]) {
      map.set(id, (loc?.links || []).filter((l: string) => typeof l === 'string'));
    }
  }
  return map;
}

/** Локации «в пути» — по ним нельзя идти пешком, и не надо. */
const TRANSIT_LOCS = new Set(['trainRide', 'seaFerryRide']);

describe('карта: достижимость', () => {
  it('все локации достижимы из Пьютера (по связям и транспорту)', () => {
    const locs = allLocations();
    const transport = new Map<string, string>();
    for (const r of TRANSPORT_ROUTES) transport.set(r.from, r.to);

    const seen = new Set<string>();
    const queue = ['pewterCity'];
    while (queue.length) {
      const cur = queue.shift()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const next = [...(locs.get(cur) || [])];
      if (transport.has(cur)) next.push(transport.get(cur)!);
      for (const l of next) if (locs.has(l) && !seen.has(l)) queue.push(l);
    }

    const unreachable = [...locs.keys()]
      .filter((id) => !seen.has(id) && !TRANSIT_LOCS.has(id));
    expect(unreachable, `недостижимые локации: ${unreachable.join(', ')}`).toEqual([]);
  });

  it('связи ведут только на существующие локации', () => {
    const locs = allLocations();
    const broken: string[] = [];
    for (const [id, links] of locs) {
      for (const l of links) if (!locs.has(l)) broken.push(`${id} -> ${l}`);
    }
    expect(broken, broken.join('\n')).toEqual([]);
  });

  it('все 18 гейм-локаций (зоны легендарок) закрыты по значкам', () => {
    for (const region of Object.values(REGIONS) as any[]) {
      for (const [id, loc] of Object.entries(region?.locations || {}) as any[]) {
        if (loc?.noCatch && loc?.bossLvl) {
          expect(loc.requiresBadges, `${id}: зона босса без гейта`).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });

  it('новые группы островов/пещер закрыты гейтом по значкам', () => {
    const expectGate: Record<string, number> = {
      oneIsland: 16, liptooChamber: 11, route47: 12,
      canyonEntrance: 10, roamingJohto: 16,
    };
    const locs = allLocations();
    const regions = REGIONS as any;
    for (const [id, need] of Object.entries(expectGate)) {
      const loc = Object.values(regions).flatMap((r: any) => Object.values(r.locations || {}))
        .find((l: any) => l && (l as any).__id === id);
      // ищем по структуре: id === ключ
      let found: any = null;
      for (const r of Object.values(regions) as any[]) {
        for (const [lid, l] of Object.entries(r.locations || {}) as any[]) {
          if (lid === id) found = l;
        }
      }
      expect(found, `${id} не найдена`).toBeTruthy();
      expect(found.requiresBadges, `${id} без гейта по значкам`).toBe(need);
    }
  });

  it('остров Sevii и роуминг — только после всех 16 значков', () => {
    expect(src).toMatch(/oneIsland[\s\S]{0,400}requiresBadges: 16/);
    expect(src).toMatch(/roamingJohto[\s\S]{0,400}requiresBadges: 16/);
  });

  it('связи добавлены с обоих концов (карта двусторонняя)', () => {
    expect(src).toMatch(/palletTown[\s\S]{0,600}'oneIsland'/);
    expect(src).toMatch(/burnedTower[\s\S]{0,600}'liptooChamber'/);
    expect(src).toMatch(/route43[\s\S]{0,600}'route47'/);
  });
});