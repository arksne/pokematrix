import { describe, it, expect } from 'vitest';
import { slimApiData } from '../save.js';

/**
 * Полный ответ PokeAPI для покемона: ~90% объёма — moves[].version_group_details.
 * Именно из-за него квота localStorage в 5 МБ исчерпывалась примерно на 6 покемонах.
 */
function makeFullPokeApi(moveCount = 120) {
  return {
    id: 94,
    name: 'pikachu',
    height: 4,
    weight: 60,
    base_experience: 112,
    is_default: true,
    order: 21,
    cries: { latest: 'https://x/c.ogg', legacy: 'https://x/l.ogg' },
    game_indices: Array.from({ length: 20 }, (_, i) => ({ game_index: i, version: { name: `v${i}` } })),
    held_items: [],
    past_abilities: [],
    past_stats: [],
    past_types: [],
    forms: [{ name: 'normal' }],
    location_area_encounters: '/',
    speciesData: { names: Array.from({ length: 30 }, (_, i) => ({ name: `n${i}` })), flavor_text_entries: [] },
    stats: [
      { base_stat: 35, effort: 0, stat: { name: 'hp', url: 'u' }, statId: 1 },
      { base_stat: 55, effort: 0, stat: { name: 'attack', url: 'u' }, statId: 2 },
      { base_stat: 40, effort: 0, stat: { name: 'defense', url: 'u' }, statId: 3 },
      { base_stat: 50, effort: 0, stat: { name: 'special-attack', url: 'u' }, statId: 4 },
      { base_stat: 50, effort: 0, stat: { name: 'special-defense', url: 'u' }, statId: 5 },
      { base_stat: 90, effort: 0, stat: { name: 'speed', url: 'u' }, statId: 6 },
    ],
    types: [
      { slot: 1, type: { name: 'electric', url: 'u' } },
    ],
    abilities: [
      { is_hidden: false, slot: 1, ability: { name: 'static', url: 'u' } },
      { is_hidden: true, slot: 3, ability: { name: 'lightning-rod', url: 'u' } },
    ],
    species: { name: 'pikachu', url: 'https://pokeapi.co/api/v2/pokemon-species/25/' },
    sprites: {
      front_default: 'https://x/fd.png',
      front_shiny: 'https://x/fs.png',
      other: {
        'official-artwork': { front_default: 'https://x/od.png', front_shiny: 'https://x/os.png' },
        dream_world: { front_default: 'https://x/dd.png' },
        home: { front_default: 'https://x/hd.png' },
      },
    },
    // покемон, пойманный диким: клиент дописывает свои поля внутрь apiData
    isShiny: true,
    captureRate: 190,
    wildGender: 'female',
    moves: Array.from({ length: moveCount }, (_, i) => ({
      move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i}/` },
      version_group_details: Array.from({ length: 5 }, (_, g) => ({
        level_learned_at: g * 10,
        move_learn_method: { name: 'level-up' },
        version_group: { name: `vg${g}` },
      })),
    })),
  };
}

describe('slimApiData — сжатие apiData для сейва', () => {
  it('сильно уменьшает объём', () => {
    const full = makeFullPokeApi();
    const slim = slimApiData(full);
    const fullSize = JSON.stringify(full).length;
    const slimSize = JSON.stringify(slim).length;
    // Проверено на реальных ответах PokeAPI: 200–435 КБ → ~2 КБ
    expect(slimSize).toBeLessThan(fullSize / 20);
    expect(slimSize).toBeLessThan(4000);
  });

  it('сохраняет поля, без которых ломается игра', () => {
    const slim = slimApiData(makeFullPokeApi());
    // id — ключ перезагрузки с PokeAPI (levelup_moves, tm)
    expect(slim.id).toBe(94);
    expect(slim.name).toBe('pikachu');
    // stats: порядок PokeAPI и stat.name обязательны (logic.ts ищет по имени,
    // inventory.ts читает по индексу)
    expect(slim.stats).toHaveLength(6);
    expect(slim.stats[0].stat.name).toBe('hp');
    expect(slim.stats[1].stat.name).toBe('attack');
    expect(slim.stats[5].stat.name).toBe('speed');
    expect(slim.stats[0].base_stat).toBe(35);
    // types: types[0] — основной тип (tera-type, градиент спрайта)
    expect(slim.types[0].type.name).toBe('electric');
    // abilities[0].ability.name
    expect(slim.abilities[0].ability.name).toBe('static');
    // species.name сравнивается со строками, species.url используется в fetch
    expect(slim.species.name).toBe('pikachu');
    expect(slim.species.url).toBe('https://pokeapi.co/api/v2/pokemon-species/25/');
    // ровно 4 спрайта, которые читает getSpriteUrl
    expect(slim.sprites.front_default).toBe('https://x/fd.png');
    expect(slim.sprites.front_shiny).toBe('https://x/fs.png');
    expect(slim.sprites.other['official-artwork'].front_default).toBe('https://x/od.png');
    expect(slim.sprites.other['official-artwork'].front_shiny).toBe('https://x/os.png');
  });

  it('сохраняет собственные поля, которые пишет клиент внутрь apiData', () => {
    const slim = slimApiData(makeFullPokeApi());
    // isShiny нет в белом списке монстра — без него шайни теряются при сохранении
    expect(slim.isShiny).toBe(true);
    expect(slim.captureRate).toBe(190);
    expect(slim.wildGender).toBe('female');
  });

  it('оставляет только 4 боевых слота и обязательно хранит move.url', () => {
    const slim = slimApiData(makeFullPokeApi());
    expect(slim.moves).toHaveLength(4);
    for (const slot of slim.moves) {
      // core.ts проверяет именно url: слот без url молча выпадает из боя
      expect(slot).not.toBeNull();
      expect(slot.move.url).toBeTruthy();
      expect(slot.move.name).toBeTruthy();
    }
    // version_group_details больше не тащатся в сейв
    expect(slim.moves[0].version_group_details).toBeUndefined();
  });

  it('пустой слот сохраняется как null, а не {}', () => {
    // проверки вида `if (mon.apiData.moves[i])` истинны для {}, и следующее
    // чтение .move.name упало бы с TypeError
    const api = makeFullPokeApi(6);
    api.moves[2] = {};
    const slim = slimApiData(api);
    expect(slim.moves[2]).toBeNull();
    expect(slim.moves[3]).not.toBeNull();
  });

  it('не падает на неполных или отсутствующих данных', () => {
    expect(slimApiData(null)).toBeNull();
    expect(slimApiData(undefined)).toBeUndefined();
    expect(slimApiData({})).toEqual({});
    const partial = slimApiData({ id: 1, name: 'x' });
    expect(partial.id).toBe(1);
    expect(partial.moves).toBeUndefined();
  });

  it('не мутирует исходный объект', () => {
    const full = makeFullPokeApi(10);
    slimApiData(full);
    expect(full.moves).toHaveLength(10);
    expect(full.moves[0].version_group_details).toBeDefined();
    expect(full.height).toBe(4);
  });
});
