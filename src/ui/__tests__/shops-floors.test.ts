import { describe, it, expect } from 'vitest';
import { SHOP_FLOORS, floorOfCategory, groupShopItemsForFloors, getShopItems } from '../shop.js';
import { ITEMS } from '../../data/items.js';

/** N2: этажи магазина вместо простыни из 1000+ товаров. */
describe('N2: этажи магазина', () => {
  it('этажей ровно 5, метки понятные', () => {
    expect(SHOP_FLOORS.map((f) => f.id)).toEqual(['battle', 'growth', 'moves', 'carry', 'misc']);
    for (const f of SHOP_FLOORS) expect(f.label.length, f.id).toBeGreaterThan(2);
  });

  it('все продаваемые категории покрыты этажами', () => {
    const cats = new Set(
      ITEMS.filter((i) => i.price > 0 && i.implemented).map((i) => i.category),
    );
    const covered: Set<string> = new Set(SHOP_FLOORS.flatMap((f) => [...f.cats]));
    for (const c of cats) expect(covered.has(c), `категория ${c} без этажа`).toBe(true);
  });

  it('floorOfCategory: известные — свой этаж, мусор — в Разное', () => {
    expect(floorOfCategory('balls')).toBe('battle');
    expect(floorOfCategory('tm')).toBe('moves');
    expect(floorOfCategory('vitamins')).toBe('growth');
    expect(floorOfCategory('berries')).toBe('carry');
    expect(floorOfCategory('other')).toBe('misc');
    expect(floorOfCategory('неизвестно')).toBe('misc');
    expect(floorOfCategory(null)).toBe('misc');
    expect(floorOfCategory(undefined)).toBe('misc');
  });

  it('каждый товар ровно на одном этаже, порядок этажей фиксирован', () => {
    const goods = [
      { id: 'a', category: 'balls' },
      { id: 'b', category: 'tm' },
      { id: 'c', category: 'other' },
      { id: 'd', category: 'balls' },
    ];
    const groups = groupShopItemsForFloors(goods as any);
    expect(groups.map((g) => g.floor)).toEqual(['battle', 'moves', 'misc']);
    expect(groups[0].items.map((i: any) => i.id)).toEqual(['a', 'd']);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(goods.length);
  });

  it('пустые этажи не показываются', () => {
    const groups = groupShopItemsForFloors([{ id: 'x', category: 'tm' }] as any);
    expect(groups).toHaveLength(1);
    expect(groups[0].floor).toBe('moves');
    expect(groupShopItemsForFloors([])).toEqual([]);
  });

  it('витрина реального маркета бьётся на этажи без потерь', () => {
    const goods = getShopItems('celadonCity_pokemart');
    expect(goods.length).toBeGreaterThan(0);
    const byId = new Map(ITEMS.map((i: any) => [i.id, i.category]));
    const withCat = goods.map((g: any) => ({ ...g, category: byId.get(g.id) }));
    const groups = groupShopItemsForFloors(withCat);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(goods.length);
    // Боевой этаж у большого маркета не пуст (мячи и лечилки там)
    const battle = groups.find((g) => g.floor === 'battle');
    expect(battle && battle.items.length > 0).toBe(true);
  });
});
