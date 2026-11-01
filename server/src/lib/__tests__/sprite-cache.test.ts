import { describe, it, expect } from 'vitest';
import { SpriteCache, isAllowedSpritePath, loadSprite, spriteEtag, SPRITE_CACHE_MAX_ENTRIES } from '../sprite-cache.js';

/**
 * Раздача спрайтов через наш сервер. Тесты фиксируют три вещи, из-за которых
 * это вообще делалось: 1) путь нельзя подсунуть произвольный (SSRF);
 * 2) кэш ограничен по памяти и вытесняет давние картинки; 3) в кэш не попадает
 * мусор вместо PNG (GitHub/прокси могут вернуть HTML с кодом 200).
 */

function png(bytes = 64): Buffer {
  const buf = Buffer.alloc(bytes);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47; // PNG signature
  return buf;
}

function fakeFetch(handler: (url: string) => any): typeof fetch {
  return (async (url: any) => handler(String(url))) as unknown as typeof fetch;
}

describe('isAllowedSpritePath', () => {
  it('пропускает нормальные пути спрайтов', () => {
    expect(isAllowedSpritePath('pokemon/other/official-artwork/25.png')).toBe(true);
    expect(isAllowedSpritePath('pokemon/1.png')).toBe(true);
    expect(isAllowedSpritePath('items/poke-ball.png')).toBe(true);
  });

  it('режет SSRF-попытки и мусор', () => {
    expect(isAllowedSpritePath('')).toBe(false);
    expect(isAllowedSpritePath('/etc/passwd')).toBe(false);
    expect(isAllowedSpritePath('../../secrets.png')).toBe(false);
    expect(isAllowedSpritePath('pokemon/../../x.png')).toBe(false);
    expect(isAllowedSpritePath('pokemon//x.png')).toBe(false);
    expect(isAllowedSpritePath('pokemon/25.json')).toBe(false);
    expect(isAllowedSpritePath('pokemon/25.png?x=1')).toBe(false);
    expect(isAllowedSpritePath('pokemon/оя.png')).toBe(false);
    expect(isAllowedSpritePath('a/'.repeat(150) + 'x.png')).toBe(false);
  });
});

describe('SpriteCache (LRU по байтам)', () => {
  it('хранит и достаёт', () => {
    const cache = new SpriteCache(1024, 10);
    const entry = { body: png(100), contentType: 'image/png', etag: '"a"' };
    cache.set('pokemon/1.png', entry);
    expect(cache.get('pokemon/1.png')).toBe(entry);
    expect(cache.size).toBe(1);
    expect(cache.totalBytes).toBe(100);
  });

  it('вытесняет давние записи, когда упирается в лимит байт', () => {
    const cache = new SpriteCache(250, 10);
    cache.set('a.png', { body: png(100), contentType: 'image/png', etag: '"a"' });
    cache.set('b.png', { body: png(100), contentType: 'image/png', etag: '"b"' });
    // Обращение к a.png делает его свежим -> вытеснится b.png
    expect(cache.get('a.png')).toBeTruthy();
    cache.set('c.png', { body: png(100), contentType: 'image/png', etag: '"c"' });
    expect(cache.get('a.png')).toBeTruthy();
    expect(cache.get('b.png')).toBeUndefined();
    expect(cache.get('c.png')).toBeTruthy();
    expect(cache.totalBytes).toBeLessThanOrEqual(250);
  });

  it('уважает лимит записей', () => {
    const cache = new SpriteCache(1_000_000, 3);
    for (let i = 0; i < 5; i++) {
      cache.set(`p/${i}.png`, { body: png(10), contentType: 'image/png', etag: `"${i}"` });
    }
    expect(cache.size).toBe(3);
    expect(SPRITE_CACHE_MAX_ENTRIES).toBeGreaterThan(3);
  });

  it('повторная вставка заменяет и не удваивает байты', () => {
    const cache = new SpriteCache(1024, 10);
    cache.set('x.png', { body: png(100), contentType: 'image/png', etag: '"1"' });
    cache.set('x.png', { body: png(40), contentType: 'image/png', etag: '"2"' });
    expect(cache.totalBytes).toBe(40);
    expect(cache.get('x.png')?.etag).toBe('"2"');
  });
});

describe('spriteEtag', () => {
  it('стабилен для одинаковых данных и разный для разных', () => {
    const a = png(64);
    expect(spriteEtag(a)).toBe(spriteEtag(Buffer.from(a)));
    const b = png(64);
    b[10] = 7;
    expect(spriteEtag(a)).not.toBe(spriteEtag(b));
  });
});

describe('loadSprite', () => {
  it('качает PNG и считает etag', async () => {
    const fetchImpl = fakeFetch(() => ({
      ok: true,
      headers: { get: (h: string) => (h === 'content-type' ? 'image/png' : null) },
      arrayBuffer: async () => png(128),
    }));
    const entry = await loadSprite('pokemon/25.png', { fetchImpl });
    expect(entry).not.toBeNull();
    expect(entry!.body.length).toBe(128);
    expect(entry!.contentType).toBe('image/png');
    expect(entry!.etag).toMatch(/^"/);
  });

  it('не кэширует HTML вместо PNG (несмотря на 200)', async () => {
    const html = Buffer.from('<html>not a sprite</html>');
    const fetchImpl = fakeFetch(() => ({
      ok: true,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => html,
    }));
    expect(await loadSprite('pokemon/25.png', { fetchImpl })).toBeNull();
  });

  it('возвращает null на 404 и на сетевую ошибку', async () => {
    expect(await loadSprite('pokemon/25.png', { fetchImpl: fakeFetch(() => ({ ok: false, status: 404 })) })).toBeNull();
    expect(
      await loadSprite('pokemon/25.png', {
        fetchImpl: fakeFetch(() => {
          throw new Error('network down');
        }),
      })
    ).toBeNull();
  });

  it('не ходит в сеть по недопустимому пути', async () => {
    let called = false;
    const fetchImpl = fakeFetch(() => {
      called = true;
      return { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => png() };
    });
    expect(await loadSprite('../etc/passwd.png', { fetchImpl })).toBeNull();
    expect(called).toBe(false);
  });
});
