import { describe, it, expect } from 'vitest';
import { moveNameToSlug, siteMoveEntry, siteStarterMoves, rollEggMove } from '../learnset.js';
import { siteLevelMoves } from '../../ui/levelup_moves.js';

const LS = {
  levelup: [
    [1, 'Charm'],
    [1, 'Growl'],
    [1, 'Nasty Plot'],
    [1, 'Thunder Shock'],
    [4, 'Thunder Wave'],
  ] as Array<[number, string]>,
  egg: ['Flail', 'Thunder Shock'],
};

describe('moveNameToSlug', () => {
  it('Thunder Shock → thunder-shock', () => {
    expect(moveNameToSlug('Thunder Shock')).toBe('thunder-shock');
  });
});

describe('siteStarterMoves', () => {
  it('первые 4 в порядке сайта, level <= 1', () => {
    const got = siteStarterMoves(LS, 1, 4);
    expect(got.map((m: any) => m.move.name)).toEqual(['charm', 'growl', 'nasty-plot', 'thunder-shock']);
  });

  it('порядок сайта, не PokeAPI-id: ударные в хвосте', () => {
    const got = siteStarterMoves(LS, 1, 2);
    expect(got.map((m: any) => m.move.name)).toEqual(['charm', 'growl']);
  });

  it('уровень 5 добирает Thunder Wave', () => {
    const got = siteStarterMoves(LS, 5, 4);
    expect(got.map((m: any) => m.move.name)).toEqual(['charm', 'growl', 'nasty-plot', 'thunder-shock']);
    const got5 = siteStarterMoves(LS, 5, 5);
    expect(got5[4].move.name).toBe('thunder-wave');
  });

  it('пусто → tackle, URL валиден для прокси', () => {
    const got = siteStarterMoves({ levelup: [], egg: [] }, 1, 4);
    expect(got).toHaveLength(1);
    expect(got[0].move.name).toBe('tackle');
    expect(got[0].move.url).toContain('/move/33/');
  });

  it('null → tackle без падения', () => {
    expect(siteStarterMoves(null, 1, 4)[0].move.name).toBe('tackle');
  });

  it('записи резолвятся через /move/:name', () => {
    const got = siteStarterMoves(LS, 1, 1);
    expect(got[0].move.url).toBe('https://pokeapi.co/api/v2/move/charm/');
  });
});

describe('rollEggMove (30% по канону лиги)', () => {
  it('rand >= 0.3 → null (нет ролла)', () => {
    expect(rollEggMove(LS.egg, ['charm'], () => 0.5)).toBeNull();
    expect(rollEggMove(LS.egg, ['charm'], () => 0.3)).toBeNull();
  });

  it('ролл прошёл → яйцевая атака, уже известная исключена', () => {
    // Thunder Shock уже известен → единственный кандидат Flail
    const got = rollEggMove(LS.egg, ['thunder-shock'], () => 0.1);
    expect(got?.move?.name).toBe('flail');
  });

  it('все яйцевые уже известны → null', () => {
    expect(rollEggMove(LS.egg, ['flail', 'thunder-shock'], () => 0.0)).toBeNull();
  });

  it('нет списка → null, без падения', () => {
    expect(rollEggMove(undefined, [], () => 0.0)).toBeNull();
    expect(rollEggMove([], [], () => 0.0)).toBeNull();
  });
});

describe('siteLevelMoves (уровни строго по сайту)', () => {
  const LS2 = {
    levelup: [[1, 'Tackle'], [3, 'Vine Whip'], [6, 'Growth'], [9, 'Leech Seed']] as Array<[number, string]>,
    egg: [],
  };

  it('только (prev, new], в порядке сайта', () => {
    const got = siteLevelMoves(LS2, 1, 9, new Set());
    expect(got.map((m) => m.name)).toEqual(['vine-whip', 'growth', 'leech-seed']);
  });

  it('известные исключаются (сравнение по слагу)', () => {
    const got = siteLevelMoves(LS2, 1, 9, new Set(['vine-whip']));
    expect(got.map((m) => m.name)).toEqual(['growth', 'leech-seed']);
  });

  it('граница prev включительно-не: level == prev не берётся', () => {
    const got = siteLevelMoves(LS2, 3, 6, new Set());
    expect(got.map((m) => m.name)).toEqual(['growth']);
  });

  it('записи — {name slug, url} для sitemove', () => {
    const got = siteLevelMoves(LS2, 1, 3, new Set());
    expect(got).toEqual([{ name: 'vine-whip', url: 'https://pokeapi.co/api/v2/move/vine-whip/' }]);
  });

  it('null → пусто без падения', () => {
    expect(siteLevelMoves(null, 1, 9, new Set())).toEqual([]);
  });
});
