import { describe, it, expect } from 'vitest';
import {
  areBreedingCompatible, breedRarity, isDoublePerfect, pairRarityKey,
  pickStarterMoves, pickRandomAbility, randomSympathy, isLegendaryMon, isStarterMon,
} from '../daycare.js';

/**
 * Совместимость пар (канон лиги): один вид + разный пол + одинаковая
 * буква симпатии A/T/G; легенды/стартеры/повторное спаривание — запрет.
 * Дитто — кросс-видовое исключение.
 */

const mon = (over: any = {}) => ({
  uid: 'x',
  gender: 'male',
  breedLetter: 'A',
  apiData: { name: 'pikachu', species: { name: 'pikachu' } },
  hasBred: false,
  ...over,
});
const species = (name: string) => ({ name, species: { name } });

describe('areBreedingCompatible', () => {
  it('один вид + разные полы + одна буква: ок', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'female', apiData: species('pikachu') })),
    ).toBe(true);
  });

  it('тот же покемон: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a' }), mon({ uid: 'a', gender: 'female' })),
    ).toBe(false);
  });

  it('уже спаривался (любой из пары): нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male', hasBred: true }), mon({ uid: 'b', gender: 'female' })),
    ).toBe(false);
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'female', hasBred: true })),
    ).toBe(false);
  });

  it('один пол: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'male' })),
    ).toBe(false);
  });

  it('разные виды без Ditto: нет', () => {
    expect(
      areBreedingCompatible(
        mon({ uid: 'a', gender: 'male', apiData: species('pikachu') }),
        mon({ uid: 'b', gender: 'female', apiData: species('bulbasaur') }),
      ),
    ).toBe(false);
  });

  it('разные буквы симпатии: нет', () => {
    expect(
      areBreedingCompatible(
        mon({ uid: 'a', gender: 'male', breedLetter: 'A' }),
        mon({ uid: 'b', gender: 'female', breedLetter: 'T' }),
      ),
    ).toBe(false);
  });

  it('Ditto + другой вид: ок', () => {
    expect(
      areBreedingCompatible(
        mon({ uid: 'a', gender: null, apiData: species('ditto') }),
        mon({ uid: 'b', gender: 'female', apiData: species('pikachu') }),
      ),
    ).toBe(true);
  });

  it('бесполый без Ditto: нет', () => {
    expect(
      areBreedingCompatible(
        mon({ uid: 'a', gender: null, apiData: species('magnemite') }),
        mon({ uid: 'b', gender: 'female', apiData: species('magnemite') }),
      ),
    ).toBe(false);
  });

  it('легенда: нет', () => {
    expect(
      areBreedingCompatible(
        mon({ uid: 'a', gender: 'male', apiData: species('mewtwo') }),
        mon({ uid: 'b', gender: 'female', apiData: species('mewtwo') }),
      ),
    ).toBe(false);
  });

  it('стартер: нет', () => {
    expect(
      areBreedingCompatible(
        mon({ uid: 'a', gender: 'male', apiData: species('bulbasaur') }),
        mon({ uid: 'b', gender: 'female', apiData: species('bulbasaur') }),
      ),
    ).toBe(false);
  });
});

describe('sympathy/flags', () => {
  it('randomSympathy только A/T/G', () => {
    for (let i = 0; i < 30; i++) expect(['A', 'T', 'G']).toContain(randomSympathy());
  });

  it('isLegendaryMon / isStarterMon', () => {
    expect(isLegendaryMon(mon({ apiData: species('mewtwo') }))).toBe(true);
    expect(isLegendaryMon(mon())).toBe(false);
    expect(isStarterMon(mon({ apiData: species('charmander') }))).toBe(true);
    expect(isStarterMon(mon())).toBe(false);
  });
});

const withStats = (total: number, name = 'pikachu') => {
  const per = Math.floor(total / 6);
  return {
    apiData: {
      name,
      species: { name },
      stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed']
        .map((s) => ({ base_stat: per, stat: { name: s } })),
    },
  };
};

describe('breedRarity', () => {
  it('BST<400: common', () => {
    expect(breedRarity(withStats(300))).toBe('common');
  });

  it('BST 400-499: uncommon', () => {
    expect(breedRarity(withStats(450))).toBe('uncommon');
  });

  it('BST 500+: rare', () => {
    expect(breedRarity(withStats(600))).toBe('rare');
  });

  it('легенда из LEGENDARY_SET: legendary', () => {
    expect(breedRarity(withStats(300, 'mewtwo'))).toBe('legendary');
  });

  it('пара берётся по высшей редкости', () => {
    expect(pairRarityKey(withStats(300), withStats(600))).toBe('rare');
    expect(pairRarityKey(withStats(600), withStats(300))).toBe('rare');
    expect(pairRarityKey(withStats(300), withStats(300))).toBe('common');
  });
});

describe('isDoublePerfect', () => {
  const perfect = () => ({ ivs: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 } });
  it('двойной перфект: true', () => {
    expect(isDoublePerfect(perfect(), perfect())).toBe(true);
  });
  it('один не перфект: false', () => {
    const almost = perfect();
    almost.ivs.atk = 49;
    expect(isDoublePerfect(perfect(), almost)).toBe(false);
  });
  it('без ivs: false, без падения', () => {
    expect(isDoublePerfect({}, {})).toBe(false);
  });
});

describe('pickStarterMoves (Я12)', () => {
  const poke = (moves: any[]) => ({ moves });
  const lvl = (name: string, at: number) => ({
    move: { name, url: 'https://pokeapi.co/api/v2/move/1/' },
    version_group_details: [{ move_learn_method: { name: 'level-up' }, level_learned_at: at }],
  });
  const tm = (name: string) => ({
    move: { name, url: 'https://pokeapi.co/api/v2/move/2/' },
    version_group_details: [{ move_learn_method: { name: 'machine' }, level_learned_at: 0 }],
  });

  it('только level-up <= 1, максимум 4', () => {
    const got = pickStarterMoves(poke([lvl('a', 1), lvl('b', 1), lvl('c', 5), tm('d'), lvl('e', 1), lvl('f', 1), lvl('g', 1)]));
    expect(got.map((m: any) => m.move.name)).toEqual(['a', 'b', 'e', 'f']);
  });

  it('пусто — fallback tackle', () => {
    const got = pickStarterMoves(poke([tm('x'), lvl('y', 9)]));
    expect(got).toHaveLength(1);
    expect(got[0].move.name).toBe('tackle');
  });

  it('без moves — fallback tackle, без падения', () => {
    expect(pickStarterMoves({})[0].move.name).toBe('tackle');
  });
});

describe('pickRandomAbility (Я7)', () => {
  it('скрытая исключена', () => {
    const p = { abilities: [
      { ability: { name: 'static' }, is_hidden: false },
      { ability: { name: 'lightning-rod' }, is_hidden: true },
    ] };
    for (let i = 0; i < 20; i++) expect(pickRandomAbility(p)).toBe('static');
  });

  it('все скрытые — берём из всех', () => {
    const p = { abilities: [{ ability: { name: 'wonder-guard' }, is_hidden: true }] };
    expect(pickRandomAbility(p)).toBe('wonder-guard');
  });

  it('нет способностей — null', () => {
    expect(pickRandomAbility({ abilities: [] })).toBeNull();
    expect(pickRandomAbility({})).toBeNull();
  });
});
