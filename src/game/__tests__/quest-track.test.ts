import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../../game/state.js';
import { trackNPCQuests, verifyQuest, questRewards } from '../quest-track.js';

/**
 * Трекер гринд-квестов: фильтры и verify без DOM.
 * Квесты настоящие (пачка Пьютера из NPC_DATA).
 */

beforeEach(() => {
  state.npcQuestProgress = {};
  state.completedNPCQuests = [];
  state.myTeam = [];
  state.pokedexCaught = new Set<string>();
  state.visitedLocations = new Set<string>();
  state.currentLocationId = 'pewterCity';
  state.isDaytime = true;
});

function take(id: string) {
  state.npcQuestProgress[id] = 0;
}

describe('trackNPCQuests: фильтры', () => {
  it('defeat: камень/земля считается, остальное нет', () => {
    take('pw_trail');
    trackNPCQuests('defeat_x', { species: 'geodude', types: ['rock', 'ground'] });
    trackNPCQuests('defeat_x', { species: 'geodude', types: ['rock'] });
    expect(state.npcQuestProgress['pw_trail']).toBe(2);
    trackNPCQuests('defeat_x', { species: 'pidgey', types: ['normal', 'flying'] });
    expect(state.npcQuestProgress['pw_trail']).toBe(2);
  });

  it('catch: только аэродактиль', () => {
    take('pw_sky');
    trackNPCQuests('catch_x', { species: 'pidgey' });
    expect(state.npcQuestProgress['pw_sky']).toBe(0);
    trackNPCQuests('catch_x', { species: 'Aerodactyl' });
    expect(state.npcQuestProgress['pw_sky']).toBe(1);
  });

  it('earn: суммируется', () => {
    take('pw_money');
    trackNPCQuests('earn_money', { amount: 40000 });
    trackNPCQuests('earn_money', { amount: 60000 });
    expect(state.npcQuestProgress['pw_money']).toBe(100000);
  });

  it('explore: только Канто', () => {
    take('pw_wanderer');
    trackNPCQuests('explore', { locId: 'pewterCity' });
    trackNPCQuests('explore', { locId: 'goldenrodCity' });
    expect(state.npcQuestProgress['pw_wanderer']).toBe(1);
  });

  it('boss_win: сразу в цель', () => {
    take('pw_fist');
    trackNPCQuests('boss_win', { bossId: 'wrong' });
    expect(state.npcQuestProgress['pw_fist']).toBe(0);
    trackNPCQuests('boss_win', { bossId: 'pewterBully' });
    expect(state.npcQuestProgress['pw_fist']).toBe(1);
  });

  it('streak: значение, не сумма', () => {
    take('pw_undefeated');
    trackNPCQuests('streak_x', { streak: 7 });
    expect(state.npcQuestProgress['pw_undefeated']).toBe(7);
    trackNPCQuests('streak_x', { streak: 3 });
    expect(state.npcQuestProgress['pw_undefeated']).toBe(3);
  });

  it('hatch: +1', () => {
    take('pw_breed');
    trackNPCQuests('hatch_x', {});
    expect(state.npcQuestProgress['pw_breed']).toBe(1);
  });

  it('сданные и невзятые не двигаются', () => {
    state.completedNPCQuests = ['pw_trail'];
    trackNPCQuests('defeat_x', { species: 'geodude', types: ['rock'] });
    expect(state.npcQuestProgress['pw_trail']).toBeUndefined();
    trackNPCQuests('defeat_x', { species: 'onix', types: ['rock'] });
    expect(state.npcQuestProgress['pw_sky']).toBeUndefined();
  });

  it('прогресс режется целью', () => {
    take('pw_sky');
    trackNPCQuests('catch_x', { species: 'aerodactyl' });
    trackNPCQuests('catch_x', { species: 'aerodactyl' });
    expect(state.npcQuestProgress['pw_sky']).toBe(1);
  });
});

describe('questRewards', () => {
  it('основная + дополнительные, мусор отбрасывается', () => {
    expect(questRewards({ rewardItem: 'tm28', rewardQty: 1 })).toEqual([{ id: 'tm28', qty: 1 }]);
    expect(questRewards({
      rewardItem: 'tm28', rewardQty: 1,
      rewardItems: [{ id: 'superPotion', qty: 3 }, { id: 'x', qty: 0 }, null],
    })).toEqual([{ id: 'tm28', qty: 1 }, { id: 'superPotion', qty: 3 }]);
    expect(questRewards({})).toEqual([]);
    expect(questRewards(null)).toEqual([]);
  });
});

describe('verifyQuest', () => {
  it('без verify — ок', () => {
    expect(verifyQuest({ id: 'x' })).toEqual({ ok: true, missing: '' });
  });

  it('avgLevel/maxLevel', () => {
    state.myTeam = [{ baseLevel: 10, candiesEaten: 0 }, { baseLevel: 20, candiesEaten: 0 }];
    expect(verifyQuest({ verify: { avgLevel: 15 } }).ok).toBe(true);
    expect(verifyQuest({ verify: { avgLevel: 16 } }).ok).toBe(false);
    expect(verifyQuest({ verify: { maxLevel: 25 } }).ok).toBe(false);
    expect(verifyQuest({ verify: { maxLevel: 20 } }).ok).toBe(true);
    state.myTeam = [];
    expect(verifyQuest({ verify: { avgLevel: 5 } }).ok).toBe(false);
    expect(verifyQuest({ verify: { avgLevel: 5 } }).missing).toBe('нужна команда');
  });

  it('rockSpecies по покедексу', () => {
    state.pokedexCaught = new Set(['geodude', 'onix', 'pikachu']);
    const q = { verify: { rockSpecies: ['geodude', 'onix', 'rhyhorn'], rockCount: 2 } };
    expect(verifyQuest(q).ok).toBe(true);
    expect(verifyQuest({ verify: { rockSpecies: ['geodude', 'onix'], rockCount: 3 } }).ok).toBe(false);
  });

  it('locs и kantoLocs по visited', () => {
    state.visitedLocations = new Set(['pewterCity', 'route3']);
    expect(verifyQuest({ verify: { locs: ['pewterCity', 'route3'] } }).ok).toBe(true);
    expect(verifyQuest({ verify: { locs: ['pewterCity', 'mtMoon'] } }).ok).toBe(false);
    expect(verifyQuest({ verify: { kantoLocs: 2 } }).ok).toBe(true);
    expect(verifyQuest({ verify: { kantoLocs: 3 } }).ok).toBe(false);
  });

  it('evPool суммой', () => {
    state.myTeam = [{ evPool: 60 }, { evPool: 50 }];
    expect(verifyQuest({ verify: { evPool: 100 } }).ok).toBe(true);
    expect(verifyQuest({ verify: { evPool: 200 } }).ok).toBe(false);
  });
});
