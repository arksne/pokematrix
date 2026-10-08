import { describe, it, expect } from 'vitest';
import { npcSpots, npcSpot, hashId } from '../npc-anchors.js';
import { NPC_DATA } from '../../data/npc.js';

const X_MIN = 7;
const X_MAX = 93;
const Y_MIN = 55;
const Y_MAX = 90;
const MIN_GAP = 10;

/** id → точка для набора NPC одной локации. */
function map(ids: string[]): Record<string, { x: number; y: number }> {
  const spots = npcSpots(ids);
  const out: Record<string, { x: number; y: number }> = {};
  ids.forEach((id, i) => { out[id] = spots[i]; });
  return out;
}

/** Все NPC по локациям: id → [id...] */
function npcsByLocation(): Map<string, string[]> {
  const byLoc = new Map<string, string[]>();
  for (const n of Object.values(NPC_DATA as any) as any[]) {
    const list = byLoc.get(n.location) || [];
    list.push(n.id);
    byLoc.set(n.location, list);
  }
  return byLoc;
}

describe('M-10: NPC в фиксированных точках', () => {
  it('хэш стабилен и в диапазоне uint32', () => {
    expect(hashId('goldenrod_barman')).toBe(hashId('goldenrod_barman'));
    expect(hashId('a')).not.toBe(hashId('b'));
    const h = hashId('медсестра Джой');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('точка NPC не зависит от порядка в данных', () => {
    const ids = ['goldenrod_barman', 'goldenrod_officer', 'goldenrod_phill'];
    expect(map(ids)).toEqual(map([...ids].reverse()));
    expect(map([...ids].sort())).toEqual(map(ids));
  });

  it('два рендера подряд дают те же координаты', () => {
    const ids = Object.values(NPC_DATA as any).slice(0, 20).map((n: any) => n.id);
    expect(npcSpots(ids)).toEqual(npcSpots(ids));
  });

  it('все точки в пределах картинки, ниже горизонта', () => {
    for (const [, ids] of npcsByLocation()) {
      for (const s of npcSpots(ids)) {
        expect(s.x, 'x').toBeGreaterThanOrEqual(X_MIN);
        expect(s.x, 'x').toBeLessThanOrEqual(X_MAX);
        expect(s.y, 'y').toBeGreaterThanOrEqual(Y_MIN);
        expect(s.y, 'y').toBeLessThanOrEqual(Y_MAX);
      }
    }
  });

  it('NPC одной локации никогда не слипаются', () => {
    let crowded = 0;
    for (const [loc, ids] of npcsByLocation()) {
      const spots = npcSpots(ids);
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const tooClose = Math.abs(spots[i].x - spots[j].x) < MIN_GAP
            && Math.abs(spots[i].y - spots[j].y) < MIN_GAP;
          expect(tooClose, `${loc}: ${ids[i]} и ${ids[j]} слишком близко`).toBe(false);
        }
      }
      if (ids.length >= 5) crowded++;
    }
    expect(crowded, 'локаций с 5+ NPC').toBeGreaterThan(3);
  });

  it('раскладка не зависит от порядка NPC в данных (по-настоящему)', () => {
    for (const [loc, ids] of npcsByLocation()) {
      if (ids.length < 2) continue;
      const a = map(ids);
      const b = map([...ids].reverse());
      for (const id of ids) {
        expect(a[id], `${loc}/${id} сдвинулся при перестановке`).toEqual(b[id]);
      }
    }
  });

  it('у одиночного NPC точка по центру-зоне, а не угол', () => {
    const s = npcSpot('goldenrod_barman');
    expect(s.x).toBeGreaterThan(X_MIN);
    expect(s.x).toBeLessThan(X_MAX);
    expect(s.y).toBeGreaterThan(Y_MIN);
    expect(s.y).toBeLessThan(Y_MAX);
    expect(s).toEqual(npcSpots(['goldenrod_barman'])[0]);
  });

  it('у каждого NPC в локации своя уникальная точка', () => {
    for (const [, ids] of npcsByLocation()) {
      const keys = npcSpots(ids).map((s) => `${s.x},${s.y}`);
      expect(new Set(keys).size, `${keys.length} точек`).toBe(keys.length);
    }
  });
});