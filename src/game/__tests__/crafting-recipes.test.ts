import { describe, it, expect } from 'vitest';
import { ITEMS } from '../../data/items.js';
import { CRAFTING_RECIPES } from '../../ui/crafting.js';
import { CRAFTING_RECIPES as SERVER_CRAFTING_RECIPES } from '../../../server/src/routes/economy.js';

/**
 * Крафт: рецепты обязаны ссылаться на живые предметы ITEMS, а клиент и сервер —
 * держать одну и ту же таблицу.
 *
 * Регрессия: 17 id (ore, mountainSand, coal, cotton, healingHerbs,
 * wonderFlower, shinyDust, metalIngot, honeycomb, woodenApricorn,
 * suspiciousEgg, ancientGenome + результаты metalIngot/glass/bandage/
 * sparkles/honeyJar/fossil) отсутствовали в items.ts. Все 14 рецептов были
 * недоступны игроку (кнопка «Создать» вечно disabled), item-audit падал на
 * I-craft-res / I-craft-ing. Тест страхует оба класса поломки:
 *   1) «мёртвый» id ингредиента или результата (нет в ITEMS / не implemented);
 *   2) дрейф клиентской таблицы от серверной (id/ингредиенты/результат/qty).
 */

interface RecipeShape {
  id: string;
  ingredients: Record<string, number>;
  result: string;
  qty: number;
}

const itemById = new Map(ITEMS.map((i) => [i.id, i]));

/** Нормализация рецепта для сверки клиент ↔ сервер (name/category есть только на клиенте). */
function normalize(recipes: ReadonlyArray<RecipeShape>) {
  return recipes
    .map((r) => ({
      id: r.id,
      ingredients: Object.fromEntries(
        Object.entries(r.ingredients).sort(([a], [b]) => a.localeCompare(b)),
      ),
      result: r.result,
      qty: r.qty,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe('crafting recipes: живые предметы и паритет клиент/сервер', () => {
  it('каждый ингредиент и результат рецепта есть в ITEMS и implemented', () => {
    const broken: string[] = [];
    for (const recipe of CRAFTING_RECIPES) {
      for (const id of Object.keys(recipe.ingredients)) {
        const item = itemById.get(id);
        if (!item) broken.push(`${recipe.id}: ингредиент ${id} нет в ITEMS`);
        else if (!item.implemented) broken.push(`${recipe.id}: ингредиент ${id} не implemented`);
      }
      const result = itemById.get(recipe.result);
      if (!result) broken.push(`${recipe.id}: результат ${recipe.result} нет в ITEMS`);
      else if (!result.implemented) broken.push(`${recipe.id}: результат ${recipe.result} не implemented`);
    }
    expect(broken, 'мёртвые ссылки крафта').toEqual([]);
  });

  it('у каждого рецепта есть ингредиенты, а qty положительный', () => {
    expect(CRAFTING_RECIPES.length).toBeGreaterThan(0);
    for (const recipe of CRAFTING_RECIPES) {
      expect(Object.keys(recipe.ingredients).length, `${recipe.id}: нет ингредиентов`).toBeGreaterThan(0);
      expect(recipe.qty, `${recipe.id}: qty`).toBeGreaterThan(0);
    }
  });

  it('клиент и сервер держат одинаковую таблицу рецептов', () => {
    // Любое расхождение = «Создать» на клиенте обещает одно, сервер списывает другое.
    expect(normalize(CRAFTING_RECIPES)).toEqual(normalize(SERVER_CRAFTING_RECIPES));
  });
});
