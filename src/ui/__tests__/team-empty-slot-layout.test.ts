/**
 * Пустые слоты команды не должны растягивать экран.
 *
 * На скриншоте боевого прода (tools/prod-ops/ui-tour.mjs) у нового игрока один
 * покемон и пять заглушек по ~250px каждая: чтобы дойти до низа вкладки, надо
 * было проскроллить почти два экрана пустоты. Слот-заглушка — это подсказка,
 * а не карточка монстра, поэтому она компактная и по центру.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('style.css', 'utf8');

function ruleFor(selector: string): string {
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'gm');
  const m = re.exec(css);
  return m ? m[2] : '';
}

describe('пустой слот команды', () => {
  const rule = ruleFor('.team-slot.empty');

  it('правило существует', () => {
    expect(rule).not.toBe('');
  });

  it('компактный: не выше 72px — иначе экран команды уходит в пустоту', () => {
    const m = rule.match(/min-height:\s*(\d+)px/);
    expect(m, 'min-height должен быть задан явно').toBeTruthy();
    expect(Number(m![1])).toBeLessThanOrEqual(72);
  });

  it('содержимое по центру и без «нажимаемости»', () => {
    expect(rule).toMatch(/align-items:\s*center/);
    expect(rule).toMatch(/justify-content:\s*center/);
    expect(rule).toMatch(/cursor:\s*default/);
    expect(rule).toMatch(/border:\s*2px dashed/);
  });

  it('размер шрифта подписи не крупнее обычного текста', () => {
    const m = rule.match(/font-size:\s*([\d.]+)rem/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeLessThanOrEqual(0.8);
  });
});
