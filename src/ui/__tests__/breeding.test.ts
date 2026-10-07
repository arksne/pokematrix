import { describe, it, expect } from 'vitest';
import { areBreedingCompatible, breedRarity, isDoublePerfect, pairRarityKey, pickStarterMoves, pickRandomAbility } from '../daycare.js';

/**
 * Совместимость пар: один раз и всё (hasBred), половой контроль,
 * бесполые только через Ditto.
 */

const mon = (over: any = {}) => ({
  uid: 'x',
  gender: 'male',
  apiData: {},
  hasBred: false,
  ...over,
});

describe('areBreedingCompatible', () => {
  it('разные полы + общая группа: ок', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'female' }), ['monster'], ['monster']),
    ).toBe(true);
  });

  it('тот же покемон: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a' }), mon({ uid: 'a', gender: 'female' }), ['monster'], ['monster']),
    ).toBe(false);
  });

  it('уже спаривался (любой из пары): нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male', hasBred: true }), mon({ uid: 'b', gender: 'female' }), ['monster'], ['monster']),
    ).toBe(false);
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'female', hasBred: true }), ['monster'], ['monster']),
    ).toBe(false);
  });

  it('один пол: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'male' }), ['monster'], ['monster']),
    ).toBe(false);
  });

  it('бесполый без Ditto: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: null }), mon({ uid: 'b', gender: 'female' }), ['mineral'], ['monster']),
    ).toBe(false);
  });

  it('бесполый + Ditto: ок', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: null }), mon({ uid: 'b', gender: 'male' }), ['mineral'], ['ditto']),
    ).toBe(true);
  });

  it('нет общей группы и нет Ditto: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'female' }), ['mineral'], ['monster']),
    ).toBe(false);
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
  const perfect = () => ({ ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } });
  it('двойной перфект: true', () => {
    expect(isDoublePerfect(perfect(), perfect())).toBe(true);
  });
  it('один не перфект: false', () => {
    const almost = perfect();
    almost.ivs.atk = 30;
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
