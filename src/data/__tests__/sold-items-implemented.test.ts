/**
 * Проданный предмет обязан что-то делать.
 *
 * Аудит нашёл три боевых предмета, которые лежали на полке магазина по ¥4000, а
 * код про них не знал: brightPowder, absorbBulb, adrenalineOrb. Игрок платил и
 * получал пустышку. Невидимый баг: ни тесты, ни браузерная проверка его не
 * ловят — предмет просто «есть в рюкзаке».
 *
 * Тест сканирует исходники: если предмет категории battle продаётся (price > 0
 * и он есть в ассортименте магазинов), его id должен встречаться в коде логики
 * вне таблиц данных. Иначе — либо реализуйте эффект, либо уберите из продажи.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ITEMS } from '../items.js';
import { SHOP_STOCK } from '../shops.js';

type Item = { id: string; category?: string; price?: number };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (['node_modules', '__tests__', '.state'].includes(name)) continue;
      walk(p, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(p);
    }
  }
  return out;
}

const repoRoot = process.cwd();
const srcDir = path.join(repoRoot, 'src');
const dataOnly = new Set(['items.ts', 'shops.ts', 'sprite.ts']);

/** Файлы логики: всё, кроме таблиц данных и самих предметов. */
function logicSources(): string[] {
  return walk(srcDir).filter((f) => {
    const base = path.basename(f);
    if (dataOnly.has(base)) return false;
    return true;
  });
}

/** Все id из ассортимента магазинов. */
function shopItemIds(): Set<string> {
  const ids = new Set<string>();
  const stock = SHOP_STOCK as Record<string, string[]>;
  for (const list of Object.values(stock)) {
    for (const id of list || []) ids.add(id);
  }
  return ids;
}

describe('предметы в продаже: эффект реализован', () => {
  const sold = shopItemIds();
  const sources = logicSources();
  const joined = sources.map((f) => readFileSync(f, 'utf8')).join('\n');

  it('сканирование исходников работает (иначе тест был бы пустым)', () => {
    expect(sources.length).toBeGreaterThan(50);
    expect(joined.length).toBeGreaterThan(100_000);
    expect(sold.size).toBeGreaterThan(20);
  });

  it('боевые предметы из магазинов упоминаются в коде', () => {
    const missing: string[] = [];
    for (const item of ITEMS as Item[]) {
      if (!item?.id || item.category !== 'battle') continue;
      if (!(Number(item.price) > 0)) continue;
      if (!sold.has(item.id)) continue;
      if (!joined.includes(item.id)) missing.push(`${item.id} (¥${item.price})`);
    }
    expect(missing, 'предмет продаётся, но код о нём не знает').toEqual([]);
  });
});
