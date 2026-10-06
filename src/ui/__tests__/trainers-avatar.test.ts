import { describe, it, expect } from 'vitest';
import { trainerAvatarHtml, trainerAvatarLabel } from '../trainers.js';

/**
 * Аватары тренеров: сервер хранит ID (trainer_m, gentleman), PNG лежат в
 * /avatars/<id>.png. Баг: проверка шла по форме ПУТИ, ID не подходил никогда,
 * и вместо картинки огромным текстом печатался сам ID.
 */

describe('trainerAvatarHtml', () => {
  it('известный ID: картинка, а не текст', () => {
    const html = trainerAvatarHtml('gentleman', 44);
    expect(html).toContain('/avatars/gentleman.png');
    expect(html).not.toContain('>gentleman<');
  });

  it('неизвестный ID: эмодзи, сырой текст не светится', () => {
    const html = trainerAvatarHtml('trainer_m', 44);
    expect(html).toContain('/avatars/trainer_m.png');
    const html2 = trainerAvatarHtml('nope', 44);
    expect(html2).toContain('👤');
    expect(html2).not.toContain('nope');
  });

  it('XSS в ID не проходит', () => {
    const evil = '/avatars/x" onerror="alert(1)';
    const html = trainerAvatarHtml(evil, 44);
    expect(html).not.toContain('onerror="alert(1)');
    expect(html).not.toContain(evil);
  });

  it('пусто/мусор: заглушка', () => {
    expect(trainerAvatarHtml('', 44)).toContain('👤');
    expect(trainerAvatarHtml(null, 44)).toContain('👤');
  });
});

describe('trainerAvatarLabel', () => {
  it('подпись с эмодзи', () => {
    expect(trainerAvatarLabel('gentleman')).toContain('🤵');
  });
});
