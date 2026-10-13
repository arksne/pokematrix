import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { state } from '../../game/state.js';
import { trackNPCQuests, verifyQuest, questRewards, questHowTo, noteLocationVisit, findQuestHolder } from '../quest-track.js';
import { NPC_DATA } from '../../data/npc.js';
import { QUEST_TYPES } from '../../data/quests.js';

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

  it('typeSpecies: вода (новый ключ)', () => {
    state.pokedexCaught = new Set(['squirtle', 'psyduck', 'pikachu']);
    expect(verifyQuest({ verify: { typeSpecies: ['squirtle', 'psyduck', 'staryu'], typeCount: 2 } }).ok).toBe(true);
    const fail = verifyQuest({ verify: { typeSpecies: ['squirtle', 'psyduck', 'staryu'], typeCount: 3 } });
    expect(fail.ok).toBe(false);
    expect(fail.missing).toBe('видов 2/3');
  });

  it('region/regionLocs: Джото (новый ключ)', () => {
    state.visitedLocations = new Set(['blackthornCity', 'cherrygroveCity', 'pewterCity']);
    expect(verifyQuest({ verify: { region: 'johto', regionLocs: 2 } }).ok).toBe(true);
    const fail = verifyQuest({ verify: { region: 'johto', regionLocs: 3 } });
    expect(fail.ok).toBe(false);
    expect(fail.missing).toBe('локаций johto 2/3');
  });

  it('алиас rockSpecies работает как раньше', () => {
    state.pokedexCaught = new Set(['geodude', 'onix']);
    expect(verifyQuest({ verify: { rockSpecies: ['geodude', 'onix', 'rhyhorn'], rockCount: 2 } }).ok).toBe(true);
    const fail = verifyQuest({ verify: { rockSpecies: ['geodude', 'onix', 'rhyhorn'], rockCount: 3 } });
    expect(fail.ok).toBe(false);
    expect(fail.missing).toBe('каменных видов 2/3');
  });

  it('алиас kantoLocs работает как раньше', () => {
    state.visitedLocations = new Set(['pewterCity', 'route3']);
    expect(verifyQuest({ verify: { kantoLocs: 2 } }).ok).toBe(true);
    const fail = verifyQuest({ verify: { kantoLocs: 3 } });
    expect(fail.ok).toBe(false);
    expect(fail.missing).toBe('локаций Канто 2/3');
  });

  it('dexCount: абсолютное число видов (Set и массив)', () => {
    state.pokedexCaught = new Set(['geodude', 'onix', 'pikachu']);
    expect(verifyQuest({ verify: { dexCount: 3 } }).ok).toBe(true);
    const fail = verifyQuest({ verify: { dexCount: 4 } });
    expect(fail.ok).toBe(false);
    expect(fail.missing).toBe('видов в покедексе 3/4');
    // Массив вместо Set — тоже считается
    state.pokedexCaught = ['geodude', 'onix'] as any;
    expect(verifyQuest({ verify: { dexCount: 2 } }).ok).toBe(true);
    expect(verifyQuest({ verify: { dexCount: 3 } }).ok).toBe(false);
  });
});

// Синтетический NPC для фильтров без привязки к контенту пачек
function putTestQuests(quests: any[]) {
  (NPC_DATA as any)['__test_npc'] = {
    id: '__test_npc', name: 'Тест', sprite: '🧪', location: 'pewterCity',
    dialog: { greet: '', default: '', quest_offer: '', quest_complete: '', quest_incomplete: '' },
    quests,
  };
}

describe('speciesList (any-of)', () => {
  afterEach(() => { delete (NPC_DATA as any)['__test_npc']; });

  it('match: вид из списка считается (регистр не важен)', () => {
    putTestQuests([{ id: '__t_list', type: 'defeat_x', targetQty: 5, filter: { speciesList: ['voltorb', 'electrode'] } }]);
    take('__t_list');
    trackNPCQuests('defeat_x', { species: 'Voltorb' });
    trackNPCQuests('defeat_x', { species: 'ELECTRODE' });
    expect(state.npcQuestProgress['__t_list']).toBe(2);
  });

  it('mismatch: чужой вид не считается; пустой список не фильтрует', () => {
    putTestQuests([
      { id: '__t_list2', type: 'defeat_x', targetQty: 5, filter: { speciesList: ['voltorb', 'electrode'] } },
      { id: '__t_list3', type: 'defeat_x', targetQty: 5, filter: { speciesList: [] } },
    ]);
    take('__t_list2');
    take('__t_list3');
    trackNPCQuests('defeat_x', { species: 'pikachu' });
    expect(state.npcQuestProgress['__t_list2']).toBe(0);
    // Пустой speciesList — фильтр выключен, событие засчиталось
    expect(state.npcQuestProgress['__t_list3']).toBe(1);
  });
});

describe('filter.time (день/ночь через state.isDaytime)', () => {
  afterEach(() => { delete (NPC_DATA as any)['__test_npc']; });

  it('night: только ночью', () => {
    putTestQuests([{ id: '__t_night', type: 'catch_x', targetQty: 5, filter: { species: 'hoothoot', time: 'night' } }]);
    take('__t_night');
    state.isDaytime = true;
    trackNPCQuests('catch_x', { species: 'hoothoot' });
    expect(state.npcQuestProgress['__t_night']).toBe(0);
    state.isDaytime = false;
    trackNPCQuests('catch_x', { species: 'Hoothoot' });
    expect(state.npcQuestProgress['__t_night']).toBe(1);
  });

  it('day: только днём', () => {
    putTestQuests([{ id: '__t_day', type: 'defeat_x', targetQty: 5, filter: { time: 'day' } }]);
    take('__t_day');
    state.isDaytime = false;
    trackNPCQuests('defeat_x', { species: 'pidgey' });
    expect(state.npcQuestProgress['__t_day']).toBe(0);
    state.isDaytime = true;
    trackNPCQuests('defeat_x', { species: 'pidgey' });
    expect(state.npcQuestProgress['__t_day']).toBe(1);
  });
});

describe('trade_x', () => {
  afterEach(() => { delete (NPC_DATA as any)['__test_npc']; });

  it('QUEST_TYPES содержит trade_x', () => {
    expect((QUEST_TYPES as string[]).includes('trade_x')).toBe(true);
  });

  it("вызов trackNPCQuests('trade_x') не падает и двигает квест", () => {
    expect(() => trackNPCQuests('trade_x', { amount: 1 })).not.toThrow();
    putTestQuests([{ id: '__t_trade', type: 'trade_x', targetQty: 3 }]);
    take('__t_trade');
    expect(() => trackNPCQuests('trade_x', { amount: 1 })).not.toThrow();
    expect(state.npcQuestProgress['__t_trade']).toBe(1);
    trackNPCQuests('trade_x', { amount: 2 });
    expect(state.npcQuestProgress['__t_trade']).toBe(3);
  });
});

describe('questHowTo: человеческое объяснение', () => {
  it('defeat с типами — по-русски', () => {
    const s = questHowTo({ type: 'defeat_x', targetQty: 40, filter: { types: ['water'] } });
    expect(s).toContain('Побеждай');
    expect(s).toContain('водных');
  });

  it('catch с видом и ночью', () => {
    const s = questHowTo({ type: 'catch_x', targetQty: 3, filter: { species: 'hoothoot', time: 'night' } });
    expect(s).toContain('Hoothoot');
    expect(s).toContain('ночью');
  });

  it('catch со списком видов', () => {
    const s = questHowTo({ type: 'catch_x', targetQty: 26, filter: { speciesList: ['unown'] } });
    expect(s).toContain('Unown');
  });

  it('use_item называет предмет', () => {
    const s = questHowTo({ type: 'use_item', targetQty: 6, filter: { itemId: 'superRepel' } });
    expect(s).toContain('Супер');
  });

  it('boss называет противника', () => {
    const s = questHowTo({ type: 'boss_win', targetQty: 1, filter: { bossId: 'pewterBully' } });
    expect(s).toContain('Бруно');
    expect(s).toContain('Реванши');
  });

  it('streak/hatch/earn/collect/trade объясняют механику', () => {
    expect(questHowTo({ type: 'streak_x', targetQty: 10 })).toContain('подряд');
    expect(questHowTo({ type: 'hatch_x', targetQty: 1 })).toContain('боксах');
    expect(questHowTo({ type: 'earn_money', targetQty: 1 })).toContain('Зарабатывай');
    expect(questHowTo({ type: 'collect_items', targetQty: 1, targetItem: 'courierParcel' })).toContain('Посылка');
    expect(questHowTo({ type: 'trade_x', targetQty: 3 })).toContain('трейд');
  });

  it('verify превращается в условия сдачи', () => {
    const s = questHowTo({ type: 'special', targetQty: 1,
      verify: { avgLevel: 20, locs: ['pewterCity'], evPool: 100 } });
    expect(s).toContain('Условия сдачи');
    expect(s).toContain('20');
    expect(s).toContain('100');
  });

  it('пустой квест — пустая строка', () => {
    expect(questHowTo(null)).toBe('');
    expect(questHowTo({ type: 'wat' })).toBe('');
  });
});

describe('noteLocationVisit: каждый реальный заход', () => {
  it('та же локация — false, счёт не идёт', () => {
    state.currentLocationId = 'pewterCity';
    state.visitedLocations = new Set<string>(['pewterCity']);
    expect(noteLocationVisit('pewterCity')).toBe(false);
  });

  it('новая локация — true + в visited', () => {
    state.currentLocationId = 'pewterCity';
    state.visitedLocations = new Set<string>(['pewterCity']);
    expect(noteLocationVisit('route3')).toBe(true);
    expect(state.visitedLocations.has('route3')).toBe(true);
  });

  it('пустой locId — false', () => {
    state.currentLocationId = 'pewterCity';
    expect(noteLocationVisit('')).toBe(false);
  });
});

describe('explore: повторные визиты считаются', () => {
  it('один и тот же канто-город дважды — прогресс 2', () => {
    take('pw_wanderer');
    trackNPCQuests('explore', { locId: 'pewterCity' });
    trackNPCQuests('explore', { locId: 'pewterCity' });
    expect(state.npcQuestProgress['pw_wanderer']).toBe(2);
  });
});

describe('findQuestHolder: где сдавать', () => {
  it('pw_trail держит исследователь музея', () => {
    const h = findQuestHolder('pw_trail');
    expect(h).not.toBeNull();
    expect(h!.npcId).toBe('pewter_researcher');
    expect(h!.location).toBe('pewterCity');
  });

  it('неизвестный квест — null', () => {
    expect(findQuestHolder('nope_nope')).toBeNull();
  });
});
