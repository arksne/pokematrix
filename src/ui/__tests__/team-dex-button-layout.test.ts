/**
 * Иконка покедекса в карточке команды налезала на стрелку переноса монстра.
 *
 * Две причины, обе были в CSS:
 *  1. У `.team-slot` не было `position: relative`, а `.team-dex-btn` —
 *     `position: absolute`. Кнопка искала ближайшего позиционированного
 *     предка и уезжала из карточки.
 *  2. Два конфликтующих правила `.team-dex-btn`: первое ставило `right: 6px`,
 *     второе `left: 2px`. Второе не сбрасывало `right`, и кнопка получала
 *     обе позиции сразу.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('style.css', 'utf8');

function rulesFor(selector: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'gm');
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) out.push(m[2]);
  return out;
}

describe('иконка покедекса в карточке команды', () => {
  it('правило кнопки ровно одно — конфликта left/right быть не может', () => {
    expect(rulesFor('.team-dex-btn')).toHaveLength(1);
  });

  it('карточка — позиционированный контекст', () => {
    const slot = rulesFor('.team-slot').join('\n');
    expect(slot).toMatch(/position:\s*relative/);
  });

  it('кнопка НЕ в верхнем ряду, где живут стрелки переноса', () => {
    const rule = rulesFor('.team-dex-btn')[0];
    expect(rule).toMatch(/bottom:\s*6px/);
    expect(rule).toMatch(/right:\s*6px/);
    expect(rule).not.toMatch(/\btop:/);
    expect(rule).not.toMatch(/\bleft:/);
  });

  it('кнопка не накрывает имя монстра', () => {
    expect(css).toMatch(/\.team-row-info\s*\{[^}]*padding-right:\s*26px/);
  });

  it('кнопка осталась кликабельной (z-index и размер на месте)', () => {
    const rule = rulesFor('.team-dex-btn')[0];
    expect(rule).toMatch(/z-index:\s*2/);
    expect(rule).toMatch(/width:\s*22px/);
    expect(rule).toMatch(/cursor:\s*pointer/);
  });

  it('стрелки переноса остались в своём ряду', () => {
    expect(css).toMatch(/\.team-reorder\s*\{[^}]*display:\s*flex/);
  });
});