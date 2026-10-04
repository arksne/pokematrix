import { describe, it, expect } from 'vitest';
import { slimApiData } from '../save.js';
import { calculateStat } from '../../battle/stats.js';

/**
 * Совместимость сохранений: у реальных игроков в базе лежат сейвы,
 * созданные до обрезки apiData — с полным ответом PokeAPI.
 *
 * Проверяем ключевое свойство: после прохождения через slimApiData (то есть
 * при первом же сохранении после обновления) все значения, на которых держится
 * игра, остаются прежними. Если это не так — игрок теряет прогресс молча,
 * без ошибки в логах.
 */

/** Полный ответ PokeAPI для Gyarados, как он лежал в старых сейвах. */
function legacyApiData() {
  const moveCount = 120;
  return {
    abilities: [
      { is_hidden: false, slot: 1, ability: { name: 'intimidate', url: 'https://pokeapi.co/api/v2/ability/5/' } },
      { is_hidden: true, slot: 3, ability: { name: 'mold-breaker', url: 'https://pokeapi.co/api/v2/ability/150/' } },
    ],
    base_experience: 214,
    cries: { latest: 'https://x/cry.ogg', legacy: 'https://x/legacy.ogg' },
    forms: [{ name: 'gyarados', url: 'u' }],
    game_indices: Array.from({ length: 20 }, (_, i) => ({ game_index: i, version: { name: `red-blue-${i}` } })),
    height: 130,
    held_items: [],
    id: 130,
    is_default: true,
    location_area_encounters: '/123/1/0/1',
    moves: Array.from({ length: moveCount }, (_, i) => ({
      move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i}/` },
      version_group_details: [
        {
          level_learned_at: i,
          move_learn_method: { name: 'level-up', id: 1 },
          version_group: { name: 'red-blue', url: 'u' },
        },
      ],
    })),
    name: 'gyarados',
    order: 90,
    past_abilities: [],
    past_stats: [],
    past_types: [],
    species: { name: 'gyarados', url: 'https://pokeapi.co/api/v2/pokemon-species/130/' },
    sprites: {
      back_default: 'https://x/bd.png',
      back_shiny: 'https://x/bs.png',
      front_default: 'https://x/fd.png',
      front_shiny: 'https://x/fs.png',
      other: {
        'official-artwork': {
          front_default: 'https://x/oad.png',
          front_shiny: 'https://x/oas.png',
        },
        dream_world: { front_default: 'https://x/dd.png', front_shiny: 'https://x/ds.png' },
        home: { front_default: 'https://x/hd.png', front_shiny: 'https://x/hs.png' },
        'official-artwork-shiny': { front_default: 'https://x/oas2.png' },
      },
    },
    stats: [
      { base_stat: 95, effort: 0, stat: { name: 'hp', url: 'u' }, statId: 1 },
      { base_stat: 125, effort: 0, stat: { name: 'attack', url: 'u' }, statId: 2 },
      { base_stat: 79, effort: 0, stat: { name: 'defense', url: 'u' }, statId: 3 },
      { base_stat: 60, effort: 0, stat: { name: 'special-attack', url: 'u' }, statId: 4 },
      { base_stat: 100, effort: 0, stat: { name: 'special-defense', url: 'u' }, statId: 5 },
      { base_stat: 81, effort: 0, stat: { name: 'speed', url: 'u' }, statId: 6 },
    ],
    types: [{ slot: 1, type: { name: 'water', url: 'u' } }, { slot: 2, type: { name: 'flying', url: 'u' } }],
    weight: 235,
    // Поля, которые клиент дописывает внутрь apiData при поимке дикого.
    // isShiny нет в белом списке монстра — здесь единственное место, где он хранится.
    isShiny: true,
    captureRate: 45,
    wildGender: 'female',
    speciesData: { capture_rate: 45, names: Array.from({ length: 20 }, (_, i) => ({ name: `n${i}` })) },
    statStages: {},
    heldItem: 'leftovers',
    berries: {},
    wildIVs: { hp: 12, atk: 30, def: 5, spa: 0, spd: 0, spe: 20 },
  };
}

/** Покемон команды в старом формате. */
function legacyMon(over = {}) {
  return {
    uid: 'legacy-1',
    originalTrainer: 777000111,
    createdAt: 1700000000000,
    caughtLocation: 'viridianCity',
    apiData: legacyApiData(),
    maxHp: 0,
    currentHp: 0,
    ivs: { hp: 31, atk: 31, def: 20, spa: 10, spd: 15, spe: 25 },
    evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 },
    baseLevel: 55,
    exp: 12000,
    expToNext: 20000,
    candiesEaten: 3,
    vitaminsEaten: 2,
    training: 'train',
    trainingStage: 4,
    trainingStat: 'atk',
    happiness: 140,
    natureIdx: 3,
    breedLetter: 'A',
    gender: 'female',
    status: null,
    sleepTurns: 0,
    movesPP: [
      { current: 18, max: 25 }, { current: 10, max: 15 },
      { current: 30, max: 30 }, { current: 0, max: 10 },
    ],
    statStages: { atk: 1 },
    abilityName: 'intimidate',
    heldItem: 'leftovers',
    berries: {},
    learnableMoves: [
      { name: 'bite', url: 'https://pokeapi.co/api/v2/move/318/', power: 60, type: { name: 'dark' } },
    ],
    lastMoveCheckLevel: 55,
    ...over,
  };
}

describe('совместимость со старыми сохранениями', () => {
  it('характеристики не меняются после обрезки apiData', () => {
    const before = legacyMon();
    const after = { ...before, apiData: slimApiData(before.apiData) };

    for (const stat of ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed']) {
      expect(calculateStat(after, stat, { isWild: false }))
        .toBe(calculateStat(before, stat, { isWild: false }));
    }
  });

  it('тренировка применяется и до, и после обрезки одинаково', () => {
    const before = legacyMon();
    const after = { ...before, apiData: slimApiData(before.apiData) };
    expect(calculateStat(after, 'attack'))
      .toBe(calculateStat(before, 'attack'));
    // sanity: тренировка действительно что-то даёт
    expect(calculateStat(after, 'attack')).toBeGreaterThan(
      calculateStat({ ...after, trainingStage: 0 }, 'attack')
    );
  });

  it('четыре экипированные атаки сохраняются вместе с url', () => {
    const before = legacyMon();
    const api = slimApiData(before.apiData);
    expect(api.moves).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      // core.ts проверяет именно url: слот без url молча выпадает из боя
      expect(api.moves[i].move.url).toBe(before.apiData.moves[i].move.url);
      expect(api.moves[i].move.name).toBe(before.apiData.moves[i].move.name);
    }
  });

  it('спрайты, которые читает getSpriteUrl, сохраняются', () => {
    const api = slimApiData(legacyApiData());
    expect(api.sprites.front_default).toBe('https://x/fd.png');
    expect(api.sprites.front_shiny).toBe('https://x/fs.png');
    expect(api.sprites.other['official-artwork'].front_default).toBe('https://x/oad.png');
    expect(api.sprites.other['official-artwork'].front_shiny).toBe('https://x/oas.png');
  });

  it('шайни, редкость и пол сохраняются — они лежат только в apiData', () => {
    const api = slimApiData(legacyApiData());
    // У полевого монстра isShiny/captureRate/wildGender пишутся внутрь apiData,
    // а в белом списке монстра их нет: убрав их, потеряли бы шайни у всех диких.
    expect(api.isShiny).toBe(true);
    expect(api.captureRate).toBe(45);
    expect(api.wildGender).toBe('female');
    // species нужен и для сравнения строк (cubone/marowak, легенды), и для
    // реального fetch в питомнике
    expect(api.species.name).toBe('gyarados');
    expect(api.species.url).toContain('pokemon-species/130');
  });

  it('способность и типы сохраняются в нужном виде', () => {
    const api = slimApiData(legacyApiData());
    expect(api.abilities[0].ability.name).toBe('intimidate');
    // types[0] — основной тип (градиент спрайта, тера-тип)
    expect(api.types[0].type.name).toBe('water');
    expect(api.types[1].type.name).toBe('flying');
  });

  it('база и порядок stats сохраняются — иначе ломается расчёт', () => {
    const api = slimApiData(legacyApiData());
    expect(api.stats.map((s: any) => s.stat.name)).toEqual([
      'hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed',
    ]);
    expect(api.stats[1].base_stat).toBe(125);
  });

  it('learnableMoves не трогается — это отдельное поле сейва', () => {
    const before = legacyMon();
    // learnableMoves лежит рядом с apiData, но не внутри него
    expect(before.learnableMoves).toHaveLength(1);
    const api = slimApiData(before.apiData);
    expect(api.learnableMoves).toBeUndefined();
  });

  it('обрезка заметно уменьшает сейв', () => {
    const before = JSON.stringify(legacyMon());
    const after = JSON.stringify({ ...legacyMon(), apiData: slimApiData(legacyApiData()) });
    // Эта фикстура — нижняя граница: у неё 120 атак с одним
    // version_group_details на атаку, тогда как в реальном ответе PokeAPI их
    // 3-5, а самих атак у поздних покемонов бывает 167. На реальных данных
    // выходит около 100x, здесь — единицы раз, поэтому проверяем умеренную
    // границу и отдельным тестом считаем на реалистичном объёме.
    expect(after.length).toBeLessThan(before.length / 10);
  });

  it('на реалистичном объёме version_group_details сжатие большое', () => {
    const realistic = legacyApiData();
    // 167 атак (как у Mewtwo) × 4 группы версий
    realistic.moves = Array.from({ length: 167 }, (_, i) => ({
      move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i}/` },
      version_group_details: Array.from({ length: 4 }, (_, g) => ({
        level_learned_at: i,
        move_learn_method: { name: 'level-up', id: 1 },
        version_group: { name: 'vg', url: 'u' },
      })),
    }));
    const before = JSON.stringify(realistic);
    const after = JSON.stringify(slimApiData(realistic));
    expect(after.length).toBeLessThan(before.length / 50);
  });

  it('повторная обрезка ничего не ломает (сейв может пересохраняться много раз)', () => {
    const once = slimApiData(legacyApiData());
    const twice = slimApiData(once);
    expect(twice).toEqual(once);
  });
});
