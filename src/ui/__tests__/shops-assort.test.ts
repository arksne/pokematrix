import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SHOP_STOCK, SHOP_TIERS } from '../../data/shops.js';
import { ITEMS } from '../../data/items.js';
import { REGIONS } from '../../data/regions.js';
import { getShopItems } from '../shop.js';
import {
  tmNumberFromItemId,
  resolveNumberedTMMove,
  applyNumberedTM,
} from '../tm.js';
import { fetchSiteLearnset } from '../../data/learnset.js';
import { clearSiteMoveCache } from '../../data/sitemove.js';
import { state } from '../../game/state.js';
import { store } from '../../game/store.js';

/**
 * M-23: разный товар по маркетам + механика номерных ТМ.
 * - у каждого города свой набор (ключи = реальные _pokemart из regions);
 * - поздние города содержат тир3 (tmTop только в тире 4);
 * - номерные ТМ маппятся на атаки из learnset (мок fetch);
 * - цены не тронуты (спот-чек).
 */

const CITIES = [
  'celadonCity', 'ceruleanCity', 'fuchsiaCity', 'palletTown',
  'vermilionCity', 'viridianCity', 'pewterCity', 'lavenderTown', 'saffronCity',
  'blackthornCity', 'cherrygroveCity', 'cianwoodCity', 'ecruteakCity',
  'newBarkTown', 'olivineCity', 'violetCity', 'azaleaTown', 'goldenrodCity',
  'mahoganyTown',
];
const LATE_CITIES = ['fuchsiaCity', 'mahoganyTown', 'blackthornCity'];

function martOf(city: string): string {
  return `${city}_pokemart`;
}

describe('M-23: ассортимент маркетов', () => {
  it('все реальные маркеты из regions есть в SHOP_STOCK', () => {
    const locs = {
      ...(REGIONS as any).kanto.locations,
      ...(REGIONS as any).johto.locations,
    };
    const realMarts = Object.keys(locs).filter(
      (id) => id === 'pokemart' || id.endsWith('_pokemart'),
    );
    expect(realMarts.length).toBeGreaterThan(0);
    for (const mart of realMarts) {
      expect(SHOP_STOCK[mart], mart).toBeDefined();
      expect(SHOP_STOCK[mart].length).toBeGreaterThan(0);
    }
  });

  it('у каждого города свой набор (попарно различаются)', () => {
    const marts = [...CITIES.map(martOf), 'pokemart'];
    const sets = marts.map((m) => new Set(SHOP_STOCK[m] as string[]));
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const a = [...sets[i]].sort().join(',');
        const b = [...sets[j]].sort().join(',');
        expect(a, `${marts[i]} vs ${marts[j]}`).not.toBe(b);
      }
    }
  });

  it('все продаваемые предметы (price>0 + implemented) есть хоть в одном маркете', () => {
    const union = new Set<string>();
    for (const stock of Object.values(SHOP_STOCK) as string[][]) {
      for (const id of stock) union.add(id);
    }
    const missing = ITEMS.filter(
      (it) => it.price > 0 && it.implemented && !union.has(it.id),
    ).map((it) => it.id);
    expect(missing).toEqual([]);
  });

  it('поздние города содержат тир3: tmTop только в тире 4', () => {
    for (const city of LATE_CITIES) {
      expect(SHOP_STOCK[martOf(city)]).toContain('tmTop');
    }
    for (const [mart, tier] of Object.entries(SHOP_TIERS)) {
      if (tier < 4) expect(SHOP_STOCK[mart], mart).not.toContain('tmTop');
    }
  });

  it('тиры дисков по прогрессу: tmWeak с тира 2, tmMid с тира 3', () => {
    const withWeak = Object.keys(SHOP_TIERS).filter((m) =>
      (SHOP_STOCK[m] as string[]).includes('tmWeak'),
    );
    const withMid = Object.keys(SHOP_TIERS).filter((m) =>
      (SHOP_STOCK[m] as string[]).includes('tmMid'),
    );
    expect(withWeak.length).toBeGreaterThan(0);
    expect(withMid.length).toBeGreaterThan(0);
    for (const m of withWeak) expect(SHOP_TIERS[m]).toBeGreaterThanOrEqual(2);
    for (const m of withMid) expect(SHOP_TIERS[m]).toBeGreaterThanOrEqual(3);
  });

  it('getShopItems различается по locId (не один общий)', () => {
    const a = getShopItems('palletTown_pokemart').map((i: any) => i.id).sort();
    const b = getShopItems('blackthornCity_pokemart').map((i: any) => i.id).sort();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toEqual(b);
    // Поздний маркет шире стартового и содержит tmTop, стартовый — нет
    expect(b.length).toBeGreaterThan(a.length);
    expect(b).toContain('tmTop');
    expect(a).not.toContain('tmTop');
  });

  it('getShopItems честно отражает SHOP_STOCK (фильтр price/implemented)', () => {
    const stock = new Set(SHOP_STOCK['celadonCity_pokemart'] as string[]);
    const shown = getShopItems('celadonCity_pokemart');
    for (const item of shown) {
      expect(stock.has(item.id)).toBe(true);
      const def = ITEMS.find((i) => i.id === item.id)!;
      expect(def.price).toBeGreaterThan(0);
      expect(def.implemented).toBe(true);
    }
    // Всё из стока, что продаваемо — на витрине
    const expected = ITEMS.filter(
      (it) => it.price > 0 && it.implemented && stock.has(it.id),
    ).map((it) => it.id).sort();
    expect(shown.map((i: any) => i.id).sort()).toEqual(expected);
  });

  it('цены не тронуты (спот-чек хозяина)', () => {
    const price = (id: string) => ITEMS.find((i) => i.id === id)!.price;
    expect(price('potion')).toBe(300);
    expect(price('superPotion')).toBe(700);
    expect(price('ultraBall')).toBe(1200);
    expect(price('rareCandy')).toBe(800000);
    expect(price('tm')).toBe(500);
    expect(price('tmWeak')).toBe(200000);
    expect(price('tmMid')).toBe(2000000);
    expect(price('tmTop')).toBe(20000000);
    expect(price('tm01')).toBe(40000);
    expect(price('tm02')).toBe(1000);
  });

  it('номерные ТМ включены (isUsable) и лежат в маркетах', () => {
    const tm01 = ITEMS.find((i) => i.id === 'tm01')!;
    expect(tm01.isUsable).toBe(true);
    const union = new Set<string>();
    for (const stock of Object.values(SHOP_STOCK) as string[][]) {
      for (const id of stock) union.add(id);
    }
    for (const n of ['tm01', 'tm25', 'tm100']) expect(union.has(n)).toBe(true);
  });
});

describe('M-23: номер диска → атака из learnset', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    clearSiteMoveCache();
    // store в бою получает ссылку на state один раз при старте. Без этого
    // applyNumberedTM читал бы количество через state, а сжигал диск через
    // store (пустой) — и всегда отвечал 'no-item'.
    store.setState(state);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllGlobals();
  });

  it('tmNumberFromItemId парсит номер', () => {
    expect(tmNumberFromItemId('tm01')).toBe(1);
    expect(tmNumberFromItemId('tm25')).toBe(25);
    expect(tmNumberFromItemId('tm100')).toBe(100);
    expect(tmNumberFromItemId('tm')).toBeNull();
    expect(tmNumberFromItemId('tmWeak')).toBeNull();
    expect(tmNumberFromItemId('tr01')).toBeNull();
    expect(tmNumberFromItemId('potion')).toBeNull();
  });

  it('fetchSiteLearnset отдаёт tm-поле, resolve маппит номер → атаку', async () => {
    globalThis.fetch = (async (url: any) => ({
      ok: true,
      json: async () => ({
        levelup: [],
        egg: [],
        tm: [[1, 'Thunder Punch'], [25, 'Thunderbolt']],
        tutor: [],
      }),
    })) as any;

    const ls = await fetchSiteLearnset('m23-testmon');
    expect(ls?.tm).toEqual([[1, 'Thunder Punch'], [25, 'Thunderbolt']]);
    expect(resolveNumberedTMMove(ls, 'tm01')).toBe('Thunder Punch');
    expect(resolveNumberedTMMove(ls, 'tm25')).toBe('Thunderbolt');
    // Диска с таким номером у вида нет — учить нечего
    expect(resolveNumberedTMMove(ls, 'tm99')).toBeNull();
    expect(resolveNumberedTMMove(null, 'tm01')).toBeNull();
  });

  it('applyNumberedTM одноразовый: учит, сжигает диск, повтор — отказ', () => {
    const saved = state.inventory;
    state.inventory = { credit: 0, tm01: 1 };
    try {
      const mon: any = {
        apiData: { name: 'pikachu', moves: [{ move: { name: 'tackle', url: '' } }] },
        movesPP: [{ current: 30, max: 30 }],
      };
      const moveData: any = { name: 'Thunder Punch', pp: 15 };
      const r1 = applyNumberedTM(mon, 'tm01', moveData, 1);
      expect(r1).toEqual({ ok: true });
      expect(mon.apiData.moves[1].move.name).toBe('Thunder Punch');
      expect(mon.movesPP[1]).toEqual({ current: 15, max: 15 });
      expect(state.inventory['tm01'] || 0).toBe(0);
      // Диск сгорел — повтор невозможен
      const r2 = applyNumberedTM(mon, 'tm01', moveData, 2);
      expect(r2.ok).toBe(false);
      expect(r2.reason).toBe('no-item');
    } finally {
      state.inventory = saved;
    }
  });

  it('applyNumberedTM не сжигает диск, если атаку уже знает', () => {
    const saved = state.inventory;
    state.inventory = { credit: 0, tm25: 1 };
    try {
      const mon: any = {
        apiData: {
          name: 'pikachu',
          moves: [{ move: { name: 'thunderbolt', url: '' } }],
        },
        movesPP: [{ current: 15, max: 15 }],
      };
      const r = applyNumberedTM(mon, 'tm25', { name: 'Thunderbolt', pp: 15 }, 1);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('known');
      expect(state.inventory['tm25']).toBe(1);
    } finally {
      state.inventory = saved;
    }
  });
});
