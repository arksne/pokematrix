import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rollQuestDrops, isQuestActive, activeQuestIds, QUEST_DROP_CHANCE } from '../quest-drops.js';
import { state } from '../../game/state.js';
import { REGIONS } from '../regions.js';

const SOURCES = {
  venonatHair: ['oak_research_1'],
  rockSample: ['war_1', 'academy_lab_assist'],
};

describe('rollQuestDrops (I3)', () => {
  it('без активных квестов — пусто даже при удаче', () => {
    expect(rollQuestDrops(new Set(), SOURCES, () => 0)).toEqual([]);
  });

  it('активный квест + удача — предмет падает', () => {
    const got = rollQuestDrops(new Set(['oak_research_1']), SOURCES, () => 0);
    expect(got).toEqual([{ item: 'venonatHair', qty: 1 }]);
  });

  it('активный квест + неудача — пусто', () => {
    expect(rollQuestDrops(new Set(['oak_research_1']), SOURCES, () => 0.999)).toEqual([]);
  });

  it('один активный из двух — падает только его', () => {
    const got = rollQuestDrops(new Set(['war_1']), SOURCES, () => 0);
    expect(got).toEqual([{ item: 'rockSample', qty: 1 }]);
  });

  it('шанс в разумных пределах', () => {
    expect(QUEST_DROP_CHANCE).toBeGreaterThan(0);
    expect(QUEST_DROP_CHANCE).toBeLessThanOrEqual(0.2);
  });
});

describe('isQuestActive', () => {
  beforeEach(() => {
    state.npcQuestProgress = {};
    state.completedNPCQuests = [];
    state.quests = [];
    state.questProgress = {};
    state.completedQuests = [];
  });

  it('взят NPC-квест — активен', () => {
    state.npcQuestProgress = { oak_research_1: 1 };
    expect(isQuestActive('oak_research_1')).toBe(true);
  });

  it('сданный — не активен', () => {
    state.npcQuestProgress = { oak_research_1: 2 };
    state.completedNPCQuests = ['oak_research_1'];
    expect(isQuestActive('oak_research_1')).toBe(false);
  });

  it('невзятый — не активен', () => {
    expect(isQuestActive('oak_research_1')).toBe(false);
  });

  it('активные id собираются из обеих веток', () => {
    state.npcQuestProgress = { a: 0 };
    state.questProgress = { b: 1 };
    state.completedNPCQuests = [];
    state.completedQuests = [];
    expect(activeQuestIds()).toEqual(new Set(['a', 'b']));
  });
});

describe('секретные места силы (неловимые боссы 100)', () => {
  const findLoc = (id: string) =>
    (REGIONS as any).kanto.locations[id] || (REGIONS as any).johto.locations[id];

  it('3 точки: пещера Церулина, Серебряная гора, Тёмная пещера', () => {
    for (const id of ['ceruleanCave', 'mtSilver', 'darkCave']) {
      const loc = findLoc(id);
      expect(loc, id).toBeTruthy();
      expect(loc.noCatch, `${id} noCatch`).toBe(true);
      expect(loc.bossLvl, `${id} bossLvl`).toBe(100);
    }
  });

  it('в точках живут легенды (mewtwo/moltres/darkrai)', () => {
    expect(findLoc('ceruleanCave').encounters).toContain('mewtwo');
    expect(findLoc('mtSilver').encounters).toContain('moltres');
    expect(findLoc('darkCave').encounters).toContain('darkrai');
  });
});
