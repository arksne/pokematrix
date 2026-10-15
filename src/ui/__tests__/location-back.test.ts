import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Кнопка «Назад» в навигации локаций убрана (решение владельца: мешала).
 * Регресс-гард без DOM: проверяем исходники.
 *   - location.ts не создаёт #btn-back / btnBack;
 *   - lastLocation продолжает обновляться (совместимость: сейвы, крошки);
 *   - переходы идут прямыми кнопками через renderLocation(linkId);
 *   - index.html без статической кнопки назад для локаций
 *     (btn-back-team — вид команды, не трогаем).
 */

const here = dirname(fileURLToPath(import.meta.url));
const locationSrc = readFileSync(join(here, '..', 'location.ts'), 'utf8');
const indexHtml = readFileSync(join(here, '..', '..', '..', 'index.html'), 'utf8');

describe('кнопка Назад удалена, навигация жива', () => {
  it('location.ts не создаёт кнопку назад', () => {
    expect(locationSrc).not.toContain('btn-back');
    expect(locationSrc).not.toContain('btnBack');
  });

  it('lastLocation живёт для совместимости', () => {
    expect(locationSrc).toContain('state.lastLocation = state.currentLocationId');
  });

  it('прямые переходы на месте (кнопки «➔ Название»)', () => {
    expect(locationSrc).toContain('renderLocation(linkId)');
  });

  it('index.html без статической кнопки назад для локаций', () => {
    expect(indexHtml).not.toContain('id="btn-back"');
    // Вид команды не задет
    expect(indexHtml).toContain('btn-back-team');
  });
});
