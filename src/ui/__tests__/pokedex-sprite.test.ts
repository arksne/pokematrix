import { describe, it, expect } from 'vitest';
import { pokedexGridSprite, pokedexDetailSprite } from '../pokedex-sprite.js';

/**
 * Вес картинок в Покедексе. Замер на проде: ячейка сетки тянула официальный
 * арт — 99 КБ на покемона; видимый экран это ~15 ячеек = ~1.5 МБ на экран
 * прокрутки. Для мобильного интернета это дорого, а у невиданных покемонов
 * картинка затемнена в силуэт — крупный арт там бесполезен.
 *
 * Контракт: в сетке крупный арт только у пойманных, остальные — маленький
 * спрайт 96px (~10 КБ). Детальная карточка — всегда арт.
 */
describe('pokedexGridSprite', () => {
  it('пойманный покемон — крупный официальный арт', () => {
    expect(pokedexGridSprite(1, { caught: true })).toBe('/api/sprite/pokemon/other/official-artwork/1.png');
  });

  it('непойманный — маленький спрайт (а не 100 КБ арт)', () => {
    const url = pokedexGridSprite(816, { caught: false });
    expect(url).toBe('/api/sprite/pokemon/816.png');
    expect(url).not.toContain('official-artwork');
  });

  it('шайни-вариант и для арта, и для маленького спрайта', () => {
    expect(pokedexGridSprite(25, { caught: true, shiny: true })).toBe(
      '/api/sprite/pokemon/other/official-artwork/shiny/25.png'
    );
    expect(pokedexGridSprite(25, { caught: false, shiny: true })).toBe('/api/sprite/pokemon/shiny/25.png');
  });

  it('по умолчанию (без флага caught) — маленький спрайт', () => {
    expect(pokedexGridSprite(150)).toBe('/api/sprite/pokemon/150.png');
  });

  it('невалидный id — пустая строка, а не битый URL', () => {
    expect(pokedexGridSprite(0)).toBe('');
    expect(pokedexGridSprite(-5)).toBe('');
    expect(pokedexGridSprite(Number.NaN)).toBe('');
  });

  it('все URL идут через наш прокси /api/sprite (без внешних доменов)', () => {
    for (const url of [
      pokedexGridSprite(1, { caught: true }),
      pokedexGridSprite(1, { caught: false }),
      pokedexGridSprite(1, { caught: true, shiny: true }),
      pokedexDetailSprite(1),
    ]) {
      expect(url.startsWith('/api/sprite/')).toBe(true);
      expect(url).not.toMatch(/^https?:/);
    }
  });
});

describe('pokedexDetailSprite', () => {
  it('в детальной карточке всегда арт (даже если не пойман)', () => {
    expect(pokedexDetailSprite(151)).toBe('/api/sprite/pokemon/other/official-artwork/151.png');
    expect(pokedexDetailSprite(151, { shiny: true })).toBe(
      '/api/sprite/pokemon/other/official-artwork/shiny/151.png'
    );
  });

  it('невалидный id — пустая строка', () => {
    expect(pokedexDetailSprite(0)).toBe('');
  });
});
