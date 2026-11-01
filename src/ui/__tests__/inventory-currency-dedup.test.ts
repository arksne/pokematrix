/**
 * В рюкзаке было ДВА блока «Валюта».
 *
 * В разметке рюкзака сначала рисуется отдельный блок валюты («Валюта» →
 * «Кредиты x1000»), а потом общий цикл по категориям, где есть категория
 * `currency` с предметом `credit` — и он выводился ещё раз («Валюта» →
 * «Кредит 1000»). На скриншоте UI-тура это выглядело как дубль-баг.
 *
 * Тест фиксирует контракт: кредиты показывает только верхний блок, а цикл по
 * категориям предмет `credit` пропускает (проверка на уровне исходника — так
 * же, как CSS-тесты читают style.css).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/ui/inventory.ts', 'utf8');

describe('рюкзак: валюта показывается один раз', () => {
  it('верхний блок валюты на месте', () => {
    expect(src).toMatch(/textContent = 'Валюта'/);
  });

  it('цикл по категориям исключает предмет credit', () => {
    // Ищем именно фильтр категорий, а не любое место файла.
    const filterBlock = src.match(/const catItems = getInvState\(\)\.ITEMS\.filter\(([\s\S]{0,400}?)\);/);
    expect(filterBlock, 'должен быть фильтр catItems').toBeTruthy();
    expect(filterBlock![1]).toMatch(/item\.id !== 'credit'/);
  });

  it('категория currency остаётся в списке категорий (для других валют, если появятся)', () => {
    expect(src).toMatch(/currency:\s*'Валюта'/);
  });
});
