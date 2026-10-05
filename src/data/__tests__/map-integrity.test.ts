import { describe, it, expect } from 'vitest';
import { REGIONS } from '../regions.js';

/**
 * Проверка целостности карты.
 *
 * Симптом в игре: панель локации показывала «Вермилион» из статической разметки
 * index.html, кнопки действий и навигации пусты, карта не рендерится. Причина
 * была в том, что renderLocation не доходил, а данные карты тоже стоит
 * проверять отдельно — иначе следующая битая ссылка даст тот же пустой экран.
 */
type Loc = { name?: string; links?: string[] };
const regions = REGIONS as unknown as Record<string, { locations: Record<string, Loc> }>;

describe('карта', () => {
  it('в каждом регионе есть объект locations', () => {
    for (const [key, region] of Object.entries(regions)) {
      expect(typeof region.locations, `регион ${key} без locations`).toBe('object');
      expect(Object.keys(region.locations).length, `регион ${key}: локаций нет`).toBeGreaterThan(0);
    }
  });

  it('локация по умолчанию goldenrodCity существует', () => {
    expect(Object.values(regions).some((r) => r.locations['goldenrodCity'])).toBe(true);
  });

  it('все ссылки локаций ведут в существующие локации', () => {
    const ids = new Set(Object.values(regions).flatMap((r) => Object.keys(r.locations)));
    const broken: string[] = [];
    for (const locations of Object.values(regions)) {
      for (const [id, loc] of Object.entries(locations)) {
        const links: string[] = Array.isArray(loc.links) ? loc.links : [];
        for (const link of links) {
          if (!ids.has(link)) broken.push(`${id} -> ${link}`);
        }
      }
    }
    expect(broken, `битые ссылки: ${broken.slice(0, 20).join(', ')}`).toEqual([]);
  });

  it('у каждой локации есть имя и массив ссылок', () => {
    const bad: string[] = [];
    for (const [rk, region] of Object.entries(regions)) {
      for (const [id, loc] of Object.entries(region.locations)) {
        if (!loc.name) bad.push(`${rk}/${id}: нет name`);
        if (!Array.isArray(loc.links)) bad.push(`${rk}/${id}: links не массив`);
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('покемен-центры опознаются условием показа кнопки обмена', () => {
    const pokecenters = Object.values(regions)
      .flatMap((r) => Object.keys(r.locations))
      .filter((id) => id === 'pokecenter' || id.endsWith('_pokecenter'));
    expect(pokecenters.length).toBeGreaterThan(0);
  });
});