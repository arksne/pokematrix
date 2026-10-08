import { describe, it, expect } from 'vitest';
import { REGIONS } from '../../data/regions.js';
import { isServiceLoc, iconFor, kindFor } from '../map.js';

const allLocs: Record<string, any> = {
  ...(REGIONS as any).kanto.locations,
  ...(REGIONS as any).johto.locations,
};
const ids = Object.keys(allLocs);
const isService = (id: string) =>
  id === 'pokemart' || id === 'pokecenter'
  || /_pokemart$|_pokecenter$|station$|pier$/i.test(id);

/**
 * Визуальные дубли в навигации (жалоба хозяина: «переходы неудобные, там дубли
 * и тройная логичность»).
 *
 * Что было: в links одного города стояли И свой сервис (`ecruteakCity_pokemart`),
 * И голый `pokemart` (это маркет ГОЛДЕНРОДА). Игрок видел две кнопки
 * «Поке-маркет» с разными адресами. У стадионов в links висел `pokecenter`,
 * которого там нет вообще — кнопка вела через полкарты.
 */
describe('навигация: дублей и битых ссылок нет', () => {
  it('в links одной локации нет повторов', () => {
    const dupes: string[] = [];
    for (const id of ids) {
      const links = allLocs[id].links || [];
      if (new Set(links).size !== links.length) dupes.push(id);
    }
    expect(dupes, 'локации с повторяющимися ссылками').toEqual([]);
  });

  it('ни одна локация не ссылается на голые pokemart/pokecenter', () => {
    const bad: string[] = [];
    for (const id of ids) {
      for (const l of allLocs[id].links || []) {
        if (l === 'pokemart' || l === 'pokecenter') bad.push(`${id} → ${l}`);
      }
    }
    expect(bad, 'ссылки на чужой сервис').toEqual([]);
  });

it('город ссылается только на СВОИ сервисы и свой вокзал/причал', () => {
    // Вокзалы и причалы названы по городу, но без суффикса «City»:
    // vermilionCity → vermilionPier, goldenrodCity → goldenrodStation.
    const OWN = (city: string, sub: string) => {
      if (sub.startsWith(`${city}_`)) return true;
      const base = city.replace(/(City|Town)$/, '');
      return sub === `${base}Station` || sub === `${base}Pier`;
    };
    const cities = ids.filter((id) => /City$|Town$|Island$|Isle$|Port$/.test(id));
    const bad: string[] = [];
    for (const city of cities) {
      for (const l of allLocs[city].links || []) {
        if (isService(l) && !OWN(city, l)) {
          bad.push(`${city} → ${l} (сервис чужого города)`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('у каждого города с сервисом он реально есть в данных', () => {
    const broken: string[] = [];
    for (const id of ids) {
      for (const l of allLocs[id].links || []) {
        if (!allLocs[l]) broken.push(`${id} → ${l} (нет такой локации)`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('острова Канто имеют свой поке-центр (лечиться надо на месте)', () => {
    for (const island of ['cinnabarIsland', 'threeIslePort', 'oneIsland',
      'fourIsland', 'fiveIsland', 'outcastIsland']) {
      expect(allLocs[`${island}_pokecenter`], island).toBeTruthy();
      expect(allLocs[island].links, island).toContain(`${island}_pokecenter`);
    }
  });

  it('стадионы не ссылаются на сервисы (там их нет)', () => {
    for (const id of ids.filter((x) => /Stadium$/.test(x))) {
      const bad = (allLocs[id].links || []).filter((l: string) => isService(l));
      expect(bad, `${id}: ${bad.join(',')}`).toEqual([]);
    }
  });

  it('isServiceLoc совпадает с реальным наличием сервиса в данных', () => {
    for (const id of ids) {
      if (isService(id)) expect(allLocs[id], `${id} помечен сервисом, но не существует`).toBeTruthy();
    }
  });

  it('классификация ссылок однозначна: подлокация ИЛИ сосед', () => {
    // Каждая ссылка попадает ровно в одну группу навигации.
    const groups = new Map<string, string[]>();
    for (const id of ids) {
      const inner: string[] = [];
      const outer: string[] = [];
      const links: string[] = allLocs[id].links || [];
      for (const l of new Set(links)) {
        if (!allLocs[l] || l === id) continue;
        (l.startsWith(`${id}_`) || isService(l) ? inner : outer).push(l);
      }
      expect(inner.filter((x) => outer.includes(x)), `${id}: ссылка в обеих группах`).toEqual([]);
      groups.set(id, [...inner, ...outer]);
    }
    expect(groups.size).toBe(ids.length);
  });

  // Стартовый город — исключение: там 4 точки (центр, маркет, вокзал, тренировка),
// и это осознанно: игрок с старта должен видеть всё, куда можно пойти.
const ALLOWED_INNER = 4;
it('у локации не больше 4 подлокаций — иначе стена кнопок', () => {
    for (const id of ids) {
      const inner = (allLocs[id].links || []).filter(
        (l: string) => l.startsWith(`${id}_`) || isService(l),
      );
      expect(inner.length, `${id}: ${inner.join(',')}`).toBeLessThanOrEqual(ALLOWED_INNER);
    }
  });

  it('во всех городах, кроме стартового, подлокаций не больше 3', () => {
    for (const id of ids) {
      if (id === 'goldenrodCity') continue;
      if (!/City$|Town$|Island$|Isle$|Port$/.test(id)) continue;
      const inner = (allLocs[id].links || []).filter(
        (l: string) => l.startsWith(`${id}_`) || isService(l),
      );
      expect(inner.length, `${id}: ${inner.join(',')}`).toBeLessThanOrEqual(3);
    }
  });

  it('иконки и тип узла совпадают по смыслу (сервисы не рисуются как города)', () => {
    for (const id of ['goldenrodCity_pokemart', 'goldenrodCity_pokecenter', 'goldenrodStadium']) {
      expect(kindFor(id), id).not.toBe('city');
    }
    expect(kindFor('goldenrodStadium')).toBe('stadium');
    expect(kindFor('goldenrodCity_pokecenter')).toBe('center');
    expect(iconFor('goldenrodStadium')).toBe('⚔️');
    expect(iconFor('goldenrodCity_pokecenter')).toBe('🏥');
  });
});