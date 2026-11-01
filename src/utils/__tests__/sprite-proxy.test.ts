import { describe, it, expect } from 'vitest';
import { proxySpriteUrl, getSpriteUrl } from '../sprite.js';

/**
 * Спрайты идут через наш прокси (/api/sprite/*), а не напрямую с GitHub:
 * GitHub отдаёт их с max-age=300 (перекачка каждые 5 минут), а в части
 * регионов raw.githubusercontent.com недоступен — в бою были «сломанные
 * картинки». Тесты фиксируют: ссылки PokeAPI переписываются, всё остальное
 * остаётся как есть.
 */

const GH = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/';

describe('proxySpriteUrl', () => {
  it('переписывает official-artwork на /api/sprite', () => {
    expect(proxySpriteUrl(`${GH}pokemon/other/official-artwork/25.png`)).toBe(
      '/api/sprite/pokemon/other/official-artwork/25.png'
    );
  });

  it('переписывает обычные спрайты и другие каталоги', () => {
    expect(proxySpriteUrl(`${GH}pokemon/1.png`)).toBe('/api/sprite/pokemon/1.png');
    expect(proxySpriteUrl(`${GH}items/poke-ball.png`)).toBe('/api/sprite/items/poke-ball.png');
  });

  it('оставляет относительные и чужие URL как есть', () => {
    expect(proxySpriteUrl('/assets/items/poke-ball.png')).toBe('/assets/items/poke-ball.png');
    expect(proxySpriteUrl('https://example.com/sprite.png')).toBe('https://example.com/sprite.png');
    expect(proxySpriteUrl('')).toBe('');
  });

  it('не переписывает не-png файлы', () => {
    expect(proxySpriteUrl(`${GH}pokemon/25.gif`)).toBe(`${GH}pokemon/25.gif`);
  });
});

describe('getSpriteUrl через прокси', () => {
  it('обычный покемон -> наш домен', () => {
    const mon = {
      apiData: {
        sprites: {
          other: { 'official-artwork': { front_default: `${GH}pokemon/other/official-artwork/1.png` } },
          front_default: `${GH}pokemon/1.png`,
        },
      },
    };
    expect(getSpriteUrl(mon)).toBe('/api/sprite/pokemon/other/official-artwork/1.png');
  });

  it('шайни берёт shiny-арт (и тоже через прокси)', () => {
    const mon = {
      isShiny: true,
      apiData: {
        sprites: {
          other: { 'official-artwork': { front_shiny: `${GH}pokemon/other/official-artwork/shiny/1.png` } },
        },
      },
    };
    expect(getSpriteUrl(mon)).toBe('/api/sprite/pokemon/other/official-artwork/shiny/1.png');
  });

  it('нет спрайтов — пустая строка, без «undefined»', () => {
    expect(getSpriteUrl({ apiData: {} })).toBe('');
    expect(getSpriteUrl({ apiData: { sprites: {} } })).toBe('');
  });
});
