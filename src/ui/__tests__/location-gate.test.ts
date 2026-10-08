import { describe, it, expect } from 'vitest';
import { locationGateReason, isLocationOpen, questActive } from '../location-gate.js';
import { REGIONS } from '../../data/regions.js';

const allLocs: Record<string, any> = {
  ...(REGIONS as any).kanto.locations,
  ...(REGIONS as any).johto.locations,
};
const SECRET_SPOTS = ['ceruleanCave', 'mtSilver', 'darkCave'];

describe('M-17: гейт открытия локации', () => {
  it('локация без требований открыта всегда', () => {
    expect(locationGateReason(allLocs.goldenrodCity, { activeQuests: null, badges: 0 })).toBeNull();
    expect(isLocationOpen(allLocs.goldenrodCity, { activeQuests: null, badges: 0 })).toBe(true);
    expect(locationGateReason(undefined, { activeQuests: null, badges: 0 })).toBeNull();
  });

  it('бейджи: мало — закрыто, хватает — открыто', () => {
    const loc = { requiresBadges: 8 };
    expect(isLocationOpen(loc, { activeQuests: null, badges: 0 })).toBe(false);
    expect(isLocationOpen(loc, { activeQuests: null, badges: 7 })).toBe(false);
    expect(isLocationOpen(loc, { activeQuests: null, badges: 8 })).toBe(true);
    expect(isLocationOpen(loc, { activeQuests: null, badges: 12 })).toBe(true);
  });

  it('сообщение про значки называет нужное и имеющееся число', () => {
    const r = locationGateReason({ requiresBadges: 8 }, { activeQuests: null, badges: 3 })!;
    expect(r).toContain('8');
    expect(r).toContain('3');
  });

  it('квест: не взят — закрыто; взят ИЛИ сдан — открыто', () => {
    const loc = { requiresQuest: 'saffron_1' };
    expect(isLocationOpen(loc, { activeQuests: new Set<string>(), badges: 8 })).toBe(false);
    expect(isLocationOpen(loc, { activeQuests: new Set(['saffron_1']), badges: 8 })).toBe(true);
    expect(isLocationOpen(loc, { activeQuests: ['saffron_1'], badges: 8 })).toBe(true);
    expect(isLocationOpen(loc, { activeQuests: null, badges: 8 })).toBe(false);
  });

  it('оба требования проверяются: бейдж И квест', () => {
    const loc = { requiresBadges: 8, requiresQuest: 'saffron_1' };
    expect(isLocationOpen(loc, { activeQuests: ['saffron_1'], badges: 4 })).toBe(false);
    expect(isLocationOpen(loc, { activeQuests: [], badges: 8 })).toBe(false);
    expect(isLocationOpen(loc, { activeQuests: ['saffron_1'], badges: 8 })).toBe(true);
  });

  it('questActive: пустой id и неизвестный набор — false', () => {
    expect(questActive('', new Set(['a']))).toBe(false);
    expect(questActive('a', null)).toBe(false);
    expect(questActive('a', undefined)).toBe(false);
    expect(questActive('a', ['b'])).toBe(false);
  });

  it('секретные места силы закрыты новичку и открыты после 8 значков', () => {
    for (const id of SECRET_SPOTS) {
      const loc = allLocs[id];
      expect(loc, id).toBeTruthy();
      expect(loc.requiresBadges, `${id}: требуется значков`).toBe(8);
      expect(loc.noCatch, `${id}: ловить нельзя`).toBe(true);
      expect(loc.bossLvl, `${id}: босс 100`).toBe(100);
      expect(isLocationOpen(loc, { activeQuests: null, badges: 0 }), `${id} новичку`).toBe(false);
      expect(isLocationOpen(loc, { activeQuests: null, badges: 7 }), `${id} с 7`).toBe(false);
      expect(isLocationOpen(loc, { activeQuests: null, badges: 8 }), `${id} с 8`).toBe(true);
    }
  });

  it('в гейт попадает легенда, а не обычный энкаунтер места', () => {
    for (const id of SECRET_SPOTS) {
      const loc = allLocs[id];
      expect(loc.encounters.some((m: string) =>
        ['mewtwo', 'moltres', 'darkrai', 'lugia', 'zapdos', 'articuno'].includes(m)),
        `${id}: легенда в энкаунтерах`).toBe(true);
    }
  });

  it('обычные города/маршруты не под гейтом', () => {
    for (const id of ['goldenrodCity', 'route1', 'palletTown', 'newBarkTown', 'saffronCity']) {
      expect(allLocs[id].requiresBadges, id).toBeUndefined();
      expect(allLocs[id].requiresQuest, id).toBeUndefined();
    }
  });
});