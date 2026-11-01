import { describe, it, expect } from 'vitest';
import { encodeForDb, decodeFromDb, isCompressed, GZ_PREFIX, COMPRESS_MIN_LENGTH } from '../cache-codec.js';

/**
 * Формат кэша в Neon — не косметика: именно распакованные PokeAPI-дампы
 * (по 220 КБ на запись) съели 5 ГБ трафика и остановили прод. Здесь проверяем
 * контракт формата: сжатие реально уменьшает объём, данные переживают
 * round-trip байт-в-байт, старые строки продолжают читаться, битая строка не
 * роняет запрос.
 */
describe('cache-codec: формат хранения PokeAPI-кэша', () => {
  // Похоже на реальный дамп: повторяющиеся ключи из PokeAPI отлично жмутся.
  const bigJson = JSON.stringify({
    id: 25,
    name: 'pikachu',
    moves: Array.from({ length: 120 }, (_, i) => ({
      move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i}/` },
      version_group_details: [{ level_learned_at: i, move_learn_method: { name: 'level-up' } }],
    })),
  });

  it('большой JSON сжимается в разы и переживает round-trip', () => {
    const stored = encodeForDb(bigJson);
    expect(isCompressed(stored)).toBe(true);
    expect(stored.startsWith(GZ_PREFIX)).toBe(true);
    // В базе строка заметно меньше исходника — иначе смысла в формате нет.
    expect(stored.length).toBeLessThan(bigJson.length / 3);
    expect(decodeFromDb(stored)).toBe(bigJson);
  });

  it('мелкие ответы не сжимаются (base64 дороже выигрыша)', () => {
    const small = JSON.stringify({ id: 1, name: 'bulbasaur' });
    expect(small.length).toBeLessThan(COMPRESS_MIN_LENGTH);
    expect(encodeForDb(small)).toBe(small);
    expect(decodeFromDb(small)).toBe(small);
    expect(isCompressed(small)).toBe(false);
  });

  it('legacy-строка (без префикса) читается как обычный JSON', () => {
    expect(decodeFromDb(bigJson)).toBe(bigJson);
  });

  it('битая gzip-строка не бросает исключение, а даёт промах кэша', () => {
    expect(decodeFromDb(`${GZ_PREFIX}это не base64`)).toBe('');
    expect(decodeFromDb(`${GZ_PREFIX}AAAA`)).toBe('');
  });
});
