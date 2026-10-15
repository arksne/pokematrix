import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { state } from '../../game/state.js';
import { trackNPCQuests, verifyQuest, questRewards, questHowTo, noteLocationVisit, findQuestHolder, allNPCQuests } from '../quest-track.js';
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

// ─────────────────────────────────────────────────────────────
// МАТРИЦА расширения (владелец: +40–60 тестов по всем механикам).
// Типы × фильтры/verify/границы/дабл-тейк/ретраи. Без DOM, на реальных
// pw_* и синтетическом __test_npc (как выше).
// ─────────────────────────────────────────────────────────────

describe('matrix: defeat/catch фильтры', () => {
  afterEach(() => { delete (NPC_DATA as any)['__test_npc']; });

  it('defeat: species точное, регистр не важен', () => {
    putTestQuests([{ id: '__m_sp', type: 'defeat_x', targetQty: 3, filter: { species: 'Geodude' } }]);
    take('__m_sp');
    trackNPCQuests('defeat_x', { species: 'geodude' });
    trackNPCQuests('defeat_x', { species: 'GEODUDE' });
    expect(state.npcQuestProgress['__m_sp']).toBe(2);
    trackNPCQuests('defeat_x', { species: 'onix' });
    expect(state.npcQuestProgress['__m_sp']).toBe(2);
  });

  it('defeat: speciesList any-of, чужой вид мимо', () => {
    putTestQuests([{ id: '__m_sl', type: 'defeat_x', targetQty: 5, filter: { speciesList: ['machop', 'machoke'] } }]);
    take('__m_sl');
    trackNPCQuests('defeat_x', { species: 'machoke' });
    trackNPCQuests('defeat_x', { species: 'abra' });
    expect(state.npcQuestProgress['__m_sl']).toBe(1);
  });

  it('defeat: types any-of (регистр типов не важен)', () => {
    putTestQuests([{ id: '__m_ty', type: 'defeat_x', targetQty: 5, filter: { types: ['Fire'] } }]);
    take('__m_ty');
    trackNPCQuests('defeat_x', { species: 'x', types: ['FIRE'] });
    trackNPCQuests('defeat_x', { species: 'x', types: ['water'] });
    expect(state.npcQuestProgress['__m_ty']).toBe(1);
  });

  it('defeat: без species в событии — species-фильтр не проходит', () => {
    putTestQuests([{ id: '__m_nosp', type: 'defeat_x', targetQty: 5, filter: { species: 'pikachu' } }]);
    take('__m_nosp');
    trackNPCQuests('defeat_x', {});
    expect(state.npcQuestProgress['__m_nosp']).toBe(0);
  });

  it('catch: speciesList + ночь комбо', () => {
    putTestQuests([{ id: '__m_cn', type: 'catch_x', targetQty: 4, filter: { speciesList: ['hoothoot', 'gastly'], time: 'night' } }]);
    take('__m_cn');
    state.isDaytime = true;
    trackNPCQuests('catch_x', { species: 'gastly' });
    expect(state.npcQuestProgress['__m_cn']).toBe(0);
    state.isDaytime = false;
    trackNPCQuests('catch_x', { species: 'GASTLY' });
    trackNPCQuests('catch_x', { species: 'pikachu' });
    expect(state.npcQuestProgress['__m_cn']).toBe(1);
  });

  it('catch: amount >1 суммируется и режется целью', () => {
    putTestQuests([{ id: '__m_amt', type: 'catch_x', targetQty: 3, filter: { species: 'eevee' } }]);
    take('__m_amt');
    trackNPCQuests('catch_x', { species: 'eevee', amount: 5 });
    expect(state.npcQuestProgress['__m_amt']).toBe(3);
  });
});

describe('matrix: earn/explore/use/hatch границы', () => {
  afterEach(() => { delete (NPC_DATA as any)['__test_npc']; });

  it('earn: ноль и крупная сумма, кап целью', () => {
    take('pw_money');
    trackNPCQuests('earn_money', { amount: 0 });
    expect(state.npcQuestProgress['pw_money']).toBe(0);
    trackNPCQuests('earn_money', { amount: 200000 });
    expect(state.npcQuestProgress['pw_money']).toBe(100000);
  });

  it('earn: без amount считается +1', () => {
    putTestQuests([{ id: '__m_earn1', type: 'earn_money', targetQty: 5 }]);
    take('__m_earn1');
    trackNPCQuests('earn_money', {});
    expect(state.npcQuestProgress['__m_earn1']).toBe(1);
  });

  it('explore: locId-фильтр точный', () => {
    putTestQuests([{ id: '__m_exloc', type: 'explore', targetQty: 3, filter: { locId: 'safariZone' } }]);
    take('__m_exloc');
    trackNPCQuests('explore', { locId: 'safariZone' });
    trackNPCQuests('explore', { locId: 'pewterCity' });
    expect(state.npcQuestProgress['__m_exloc']).toBe(1);
  });

  it('explore: регион чужой не считается, свой дважды считается', () => {
    take('pw_wanderer');
    trackNPCQuests('explore', { locId: 'goldenrodCity' });
    expect(state.npcQuestProgress['pw_wanderer']).toBe(0);
    trackNPCQuests('explore', { locId: 'pewterCity' });
    trackNPCQuests('explore', { locId: 'pewterCity' });
    expect(state.npcQuestProgress['pw_wanderer']).toBe(2);
  });

  it('use_item: свой предмет да, чужой нет, кап', () => {
    putTestQuests([{ id: '__m_use', type: 'use_item', targetQty: 2, filter: { itemId: 'superRepel' } }]);
    take('__m_use');
    trackNPCQuests('use_item', { itemId: 'repel' });
    expect(state.npcQuestProgress['__m_use']).toBe(0);
    trackNPCQuests('use_item', { itemId: 'superRepel' });
    trackNPCQuests('use_item', { itemId: 'superRepel', amount: 5 });
    expect(state.npcQuestProgress['__m_use']).toBe(2);
  });

  it('use_item: без фильтра любой предмет считается', () => {
    putTestQuests([{ id: '__m_useany', type: 'use_item', targetQty: 2 }]);
    take('__m_useany');
    trackNPCQuests('use_item', { itemId: 'whatever' });
    expect(state.npcQuestProgress['__m_useany']).toBe(1);
  });

  it('hatch: суммируется и режется целью', () => {
    putTestQuests([{ id: '__m_hatch', type: 'hatch_x', targetQty: 2 }]);
    take('__m_hatch');
    trackNPCQuests('hatch_x', { amount: 5 });
    expect(state.npcQuestProgress['__m_hatch']).toBe(2);
  });
});

describe('matrix: boss/streak/trade границы', () => {
  afterEach(() => { delete (NPC_DATA as any)['__test_npc']; });

  it('boss: чужой id мимо, свой сразу в цель даже при targetQty>1', () => {
    putTestQuests([{ id: '__m_boss5', type: 'boss_win', targetQty: 5, filter: { bossId: 'pewterBully' } }]);
    take('__m_boss5');
    trackNPCQuests('boss_win', { bossId: 'nope' });
    expect(state.npcQuestProgress['__m_boss5']).toBe(0);
    trackNPCQuests('boss_win', { bossId: 'pewterBully' });
    expect(state.npcQuestProgress['__m_boss5']).toBe(5);
  });

  it('boss: без фильтра любая победа считается', () => {
    putTestQuests([{ id: '__m_bossany', type: 'boss_win', targetQty: 1 }]);
    take('__m_bossany');
    trackNPCQuests('boss_win', {});
    expect(state.npcQuestProgress['__m_bossany']).toBe(1);
  });

  it('streak: растёт и падает вместе с серией, кап целью', () => {
    putTestQuests([{ id: '__m_streak', type: 'streak_x', targetQty: 10 }]);
    take('__m_streak');
    trackNPCQuests('streak_x', { streak: 4 });
    expect(state.npcQuestProgress['__m_streak']).toBe(4);
    trackNPCQuests('streak_x', { streak: 99 });
    expect(state.npcQuestProgress['__m_streak']).toBe(10);
    trackNPCQuests('streak_x', { streak: 0 });
    expect(state.npcQuestProgress['__m_streak']).toBe(0);
  });

  it('streak: без streak в событии сбрасывается в 0', () => {
    putTestQuests([{ id: '__m_streak0', type: 'streak_x', targetQty: 10 }]);
    take('__m_streak0');
    trackNPCQuests('streak_x', { streak: 5 });
    trackNPCQuests('streak_x', {});
    expect(state.npcQuestProgress['__m_streak0']).toBe(0);
  });

  it('trade: суммируется и режется целью', () => {
    putTestQuests([{ id: '__m_trade', type: 'trade_x', targetQty: 2 }]);
    take('__m_trade');
    trackNPCQuests('trade_x', {});
    trackNPCQuests('trade_x', { amount: 5 });
    expect(state.npcQuestProgress['__m_trade']).toBe(2);
  });

  it('неизвестный тип события ничего не двигает', () => {
    take('pw_trail');
    take('pw_money');
    trackNPCQuests('wat_type', { amount: 100 });
    expect(state.npcQuestProgress['pw_trail']).toBe(0);
    expect(state.npcQuestProgress['pw_money']).toBe(0);
  });
});

describe('matrix: verify границы и ретраи', () => {
  it('avgLevel: ровно порог проходит, чуть ниже нет', () => {
    state.myTeam = [{ baseLevel: 10, candiesEaten: 0 }, { baseLevel: 20, candiesEaten: 0 }];
    expect(verifyQuest({ verify: { avgLevel: 15 } }).ok).toBe(true);
    expect(verifyQuest({ verify: { avgLevel: 15.1 } }).ok).toBe(false);
  });

  it('maxLevel: candiesEaten входят в эффективный уровень', () => {
    state.myTeam = [{ baseLevel: 20, candiesEaten: 5 }];
    expect(verifyQuest({ verify: { maxLevel: 25 } }).ok).toBe(true);
    expect(verifyQuest({ verify: { maxLevel: 26 } }).ok).toBe(false);
  });

  it('maxLevel: пустая команда не проходит', () => {
    state.myTeam = [];
    const r = verifyQuest({ verify: { maxLevel: 1 } });
    expect(r.ok).toBe(false);
  });

  it('locs: одна непосещённая роняет, визит чинит (ретрай)', () => {
    state.visitedLocations = new Set(['a']);
    expect(verifyQuest({ verify: { locs: ['a', 'b'] } }).ok).toBe(false);
    state.visitedLocations = new Set(['a', 'b']);
    expect(verifyQuest({ verify: { locs: ['a', 'b'] } }).ok).toBe(true);
  });

  it('locs: visited массивом тоже считается', () => {
    state.visitedLocations = ['a', 'b'] as any;
    expect(verifyQuest({ verify: { locs: ['a', 'b'] } }).ok).toBe(true);
    expect(verifyQuest({ verify: { locs: ['a', 'c'] } }).ok).toBe(false);
  });

  it('evPool: ровно порог проходит', () => {
    state.myTeam = [{ evPool: 50 }, { evPool: 50 }];
    expect(verifyQuest({ verify: { evPool: 100 } }).ok).toBe(true);
    expect(verifyQuest({ verify: { evPool: 101 } }).ok).toBe(false);
  });

  it('dexCount: пустой декс не проходит малый порог', () => {
    state.pokedexCaught = new Set<string>();
    expect(verifyQuest({ verify: { dexCount: 1 } }).ok).toBe(false);
    expect(verifyQuest({ verify: { dexCount: 1 } }).missing).toContain('0/1');
  });

  it('verify без условий всегда ok (пустой объект)', () => {
    expect(verifyQuest({ verify: {} }).ok).toBe(true);
    expect(verifyQuest({}).ok).toBe(true);
  });
});

describe('matrix: questRewards/questHowTo/findQuestHolder краевые', () => {
  it('questRewards: нулевые количества отбрасываются', () => {
    expect(questRewards({ rewardItem: 'x', rewardQty: 0 })).toEqual([]);
    expect(questRewards({ rewardItems: [{ id: 'y', qty: 0 }] })).toEqual([]);
  });

  it('questHowTo: explore с регионом и без', () => {
    expect(questHowTo({ type: 'explore', filter: { region: 'kanto' } })).toContain('Канто');
    expect(questHowTo({ type: 'explore' })).toContain('Посещай');
  });

  it('questHowTo: special и trade не пустые', () => {
    expect(questHowTo({ type: 'special' }).length).toBeGreaterThan(0);
    expect(questHowTo({ type: 'trade_x' }).length).toBeGreaterThan(0);
  });

  it('questHowTo: verify-условия перечисляются', () => {
    const s = questHowTo({ type: 'special', verify: { maxLevel: 25, dexCount: 10, evPool: 50 } });
    expect(s).toContain('25');
    expect(s).toContain('10');
    expect(s).toContain('50');
  });

  it('noteLocationVisit: массив visited пополняется', () => {
    state.currentLocationId = 'a';
    state.visitedLocations = ['a'] as any;
    expect(noteLocationVisit('b')).toBe(true);
    expect((state.visitedLocations as any).includes('b')).toBe(true);
    // Переход засчитан — игрок теперь в 'b', повторная отрисовка той же локи не счёт
    state.currentLocationId = 'b';
    expect(noteLocationVisit('b')).toBe(false);
  });

  it('findQuestHolder: курьер держится у курьера Пьютера', () => {
    const h = findQuestHolder('pw_courier');
    expect(h).not.toBeNull();
    expect(h!.npcId).toBe('pewter_courier');
  });
});

describe('quest descriptions sanity (anti-garble)', () => {
  it('all 160 NPC quests: non-empty desc + non-empty howTo without ???', () => {
    const all = allNPCQuests();
    expect(all.length).toBe(160);
    for (const q of all) {
      expect(typeof q.desc === 'string' && q.desc.trim().length > 0, `${q.id}: desc`).toBe(true);
      const how = questHowTo(q);
      expect(how.length > 0, `${q.id}: empty howTo`).toBe(true);
      expect(how.includes('???'), `${q.id}: howTo has ???: ${how}`).toBe(false);
      expect(how.includes('undefined'), `${q.id}: howTo has undefined`).toBe(false);
    }
  });

  it('counter numbers in desc match targetQty (qty>1)', () => {
    for (const q of allNPCQuests()) {
      if (!['defeat_x', 'catch_x', 'earn_money', 'explore', 'use_item', 'hatch_x', 'streak_x'].includes(q.type)) continue;
      if (q.targetQty === 1) continue;
      const nums = (q.desc.match(/\d[\d ]*/g) || []).map((x: string) => parseInt(x.replace(/ /g, ''), 10));
      expect(nums.includes(q.targetQty), `${q.id}: target ${q.targetQty} missing in desc`).toBe(true);
    }
  });

  it('route lists are shown in full, never cut as "+ N more"', () => {
    for (const q of allNPCQuests()) {
      const how = questHowTo(q);
      expect(how.includes('+ ещё'), `${q.id}: route cut`).toBe(false);
    }
  });
});
