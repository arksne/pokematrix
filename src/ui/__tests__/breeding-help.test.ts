/**
 * Справка по разведению ДОЛЖНА совпадать с кодом. Раньше игрок читал в ❓ и 📚
 * про «ячейку питомника», «общую яичную группу», «одинаковый характер = 2 раза
 * быстрее», «7 дней» и «наследует 2 случайных IV» — система, которой в коде
 * нет вообще. Игрок делал ровно по инструкции и получал ничего.
 *
 * Тест фиксирует реальные правила разведения и требует, чтобы они были
 * описаны в обоих местах справки.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { areBreedingCompatible } from '../daycare.js';

const html = readFileSync('index.html', 'utf8');
const tutorialSrc = readFileSync('src/ui/tutorial.ts', 'utf8');
/** Обе справки: пособие в index.html и справка ❓ в tutorial.ts. */
const help = html + '\n' + tutorialSrc;

describe('справка по разведению соответствует коду', () => {
  it('называет настоящие места входа (оба бокса, а не «ячейка питомника»)', () => {
    expect(help).toMatch(/Боксы разведения/);
    expect(help).toMatch(/Пьютер/i);
    expect(help).toMatch(/Голденрод/i);
    // Удалённая механика не должна упоминаться как инструкция
    expect(help).not.toMatch(/общая яичная группа/i);
    expect(help).not.toMatch(/в одной ячейке питомника/i);
    expect(help).not.toMatch(/вкладка ПК\s*→\s*Питомник/i);
  });

  it('описывает настоящие сроки: 5–9 дней вылупления, 10 мин – 8 ч яйца', () => {
    expect(help).toMatch(/5\s*[–-]\s*9\s*(дн|дней)/i);
    expect(help).toMatch(/10\s*мин/i);
    expect(help).toMatch(/8\s*(ч|час)/i);
    expect(help).not.toMatch(/7\s*дн/i);
    expect(help).not.toMatch(/3\s*[-–]\s*8\s*дн/i);
  });

  it('описывает настоящее наследование IV (лучший из родителей ±1-2)', () => {
    expect(help).toMatch(/±\s*1\s*[–-]\s*2/);
    expect(help).not.toMatch(/среднее IV/i);
    expect(help).not.toMatch(/2 случайных IV/i);
  });

  it('не обещает фантомный бонус за «одинаковый характер»', () => {
    expect(help).not.toMatch(/одинаковый характер/i);
    expect(help).not.toMatch(/2 раза быстрее/i);
  });

  it('объясняет букву симпатии A/T/G — самую частую причину отказа', () => {
    expect(help).toMatch(/симпатии/i);
    expect(help).toMatch(/A\/T\/G|\[A\]/);
  });

  it('справка про IV говорит 0–31, а не 0–50', () => {
    expect(help).toMatch(/0-31/);
    expect(help).not.toMatch(/IV<\/strong>\s*\(0-50/);
  });

  it('правила из справки действительно такие в коде', () => {
    // Разный вид без Ditto — нельзя (справка: «один вид, кросс через Ditto»).
    const mk = (name: string, extra: any = {}) => ({
      uid: name + Math.random(), apiData: { name }, breedLetter: 'A',
      gender: 'male', ...extra,
    });
    expect(areBreedingCompatible(mk('pikachu'), mk('eevee') as any)).toBe(false);
    // Ditto + любой вид — можно.
    expect(areBreedingCompatible(mk('ditto') as any, mk('pikachu') as any)).toBe(true);
    // Разный пол — можно.
    expect(areBreedingCompatible(mk('pikachu'), mk('pikachu', { gender: 'female', uid: 'f1' }))).toBe(true);
    // Разные буквы симпатии — нельзя (справка: «одинаковая буква»).
    expect(areBreedingCompatible(mk('pikachu'), mk('pikachu', { gender: 'female', uid: 'f2', breedLetter: 'T' }))).toBe(false);
    // Уже разводившийся — нельзя (справка: «hasBred, второй раз не участвует»).
    expect(areBreedingCompatible(mk('pikachu', { hasBred: true }), mk('pikachu', { gender: 'female', uid: 'f3' }))).toBe(false);
  });
});