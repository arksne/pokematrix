import { describe, it, expect } from 'vitest';
import { formatLastSeen } from '../trainers.js';

/**
 * Время последнего визита — в часовом поясе устройства, а не UTC.
 * Баг: сервер отдаёт last_seen как UTC-ISO, клиент отрезал кусок строки —
 * для Бишкека время врало на −6 часов.
 */
describe('formatLastSeen', () => {
  it('пусто/мусор → пусто', () => {
    expect(formatLastSeen(null)).toBe('');
    expect(formatLastSeen('')).toBe('');
    expect(formatLastSeen('мусор')).toBe('');
  });

  it('свежее → относительно, без привязки к поясу', () => {
    expect(formatLastSeen(new Date().toISOString())).toBe('только что');
    const five = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatLastSeen(five)).toBe('5 мин назад');
  });

  it('UTC-ISO толкуется как UTC, показывает локальное время устройства', () => {
    // 2 часа назад по UTC: устройство покажет своё локальное время,
    // а не голый UTC-кусок. Проверяем через независимый расчёт.
    const stamp = new Date(Date.now() - 2 * 3600000);
    const out = formatLastSeen(stamp.toISOString());
    const expectedHm = stamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    expect(out).toContain(expectedHm);
    expect(out).not.toBe(stamp.toISOString().slice(0, 16).replace('T', ' '));
  });

  it('вчерашнее → с датой', () => {
    const stamp = new Date(Date.now() - 26 * 3600000);
    const out = formatLastSeen(stamp.toISOString());
    expect(out).toContain(stamp.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
  });
});
