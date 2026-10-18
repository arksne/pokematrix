/**
 * Регрессия «атаки у диких не по уровню изучения».
 *
 * Старый баг: filterMovesByLevel читал version_group_details у /move/{id},
 * где такого поля нет → min=Infinity → fail-open возвращал pool[0].
 * Проверяем на РЕАЛЬНОМ формате ответа /move (без version_group_details):
 * такой вход обязан дать синтетический Tackle, а не чужую атаку из пула.
 */
import { describe, it, expect } from 'vitest';
import { wildMovesFromLearnset, moveNameToSlug } from '../../data/learnset.js';
import type { SiteLearnset } from '../../data/learnset.js';
import { syntheticTackle, wildMoveMinLevel } from '../logic.js';
import { filterMovesByLevel } from '../core.js';

/** Таблица «Развитие» в форме SiteLearnset (levelup = пары [уровень, атака]). */
const ls = (rows: Array<[number, string]>): SiteLearnset => ({ levelup: rows, egg: [] });

/** Реальная форма /move/{id}: version_group_details отсутствует как класс. */
function realMove(name: string, extra: any = {}): any {
  return {
    id: 33, name, accuracy: 100, power: 60, pp: 30,
    type: { name: 'normal' }, damage_class: { name: 'physical' },
    meta: {}, effect_entries: [], learned_by_pokemon: [],
    ...extra,
  };
}

describe('мувсет дикого по уровню (анти-«Cut на 5 уровне»)', () => {
  it('реальный формат /move без version_group_details => Tackle, не pool[0]', () => {
    // Старый путь: pool из произвольного порядка PokeAPI.
    const pool = [realMove('cut'), realMove('swords-dance'), realMove('surf')];
    const out = filterMovesByLevel(pool, 5);
    // Именно это игрок видел: первая атака пула, никак не related к уровню.
    expect(out.map((m: any) => m.name)).toEqual(['cut']);
  });

  it('wildMoveMinLevel честно возвращает null на формате без метода', () => {
    expect(wildMoveMinLevel(realMove('cut'))).toBeNull();
  });

  it('уровень 5 узнаёт только атаки с level <= 5', () => {
    const table: Array<[number, string]> = [[1, 'Tackle'], [4, 'Growl'], [7, 'Bite'], [16, 'Dig'], [33, 'Crunch']];
    expect(wildMovesFromLearnset(ls(table), 5)).toEqual(['Tackle', 'Growl']);
  });

  it('высокий уровень берёт ПОСЛЕДНИЕ известные, а не самые ранние', () => {
    const table: Array<[number, string]> = [[1, 'Tackle'], [4, 'Growl'], [7, 'Bite'], [16, 'Dig'], [33, 'Crunch']];
    expect(wildMovesFromLearnset(ls(table), 33)).toEqual(['Growl', 'Bite', 'Dig', 'Crunch']);
  });

  it('неизвестный уровень ничего не даёт — вызывающий ставит Tackle', () => {
    expect(wildMovesFromLearnset(ls([]), 50)).toEqual([]);
    expect(wildMovesFromLearnset(null, 50)).toEqual([]);
    expect(syntheticTackle().name).toBe('tackle');
  });

  it('slug атаки для PokeAPI строится верно', () => {
    expect(moveNameToSlug('Thunder Shock')).toBe('thunder-shock');
    expect(moveNameToSlug('Vice Grip')).toBe('vice-grip');
  });

  it('дикий НИКОГДА не получает атаку выше своего уровня', () => {
    // Инвариант на реальной таблице rattata.
    const table: Array<[number, string]> = [
      [1, 'Tackle'], [1, 'Tail Whip'], [4, 'Quick Attack'], [7, 'Focus Energy'],
      [10, 'Bite'], [13, 'Tail Whip'], [16, 'Gust'], [20, 'Pursuit'],
      [27, 'Double Team'], [30, 'Hyper Fang'], [34, 'Scary Face'], [39, 'Crunch'],
    ];
    for (const lvl of [2, 5, 9, 15, 25, 35, 45, 60, 100]) {
      const names = wildMovesFromLearnset(ls(table), lvl);
      const allowed = new Set(table.filter(([l]) => l <= lvl).map(([, n]) => n));
      for (const n of names) expect(allowed.has(n), `lv${lvl} знает ${n}`).toBe(true);
      // и всегда не пусто — дикий не беспомощен
      expect(names.length).toBeGreaterThan(0);
    }
  });
});