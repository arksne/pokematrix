/**
 * Economy routes:
 *   POST /economy/buy     — покупка предмета
 *   POST /economy/sell    — продажа предмета
 *   POST /economy/craft   — крафт предмета
 *   POST /economy/reward  — ежедневная награда
 *
 * save_data.inventory — { itemId: quantity, ... }
 * Инвентарь хранится в JSON-колонке users.save_data.
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// ── Данные предметов ─────────────────────────────────────────
// Копия нужных полей из src/data/items.ts для валидации на сервере
interface ItemDef {
  id: string;
  price: number;
  category?: string;
}

const ITEMS: ItemDef[] = [
  { id: 'pokeBall', price: 200 }, { id: 'greatBall', price: 600 },
  { id: 'ultraBall', price: 1200 }, { id: 'masterBall', price: 0 },
  { id: 'potion', price: 300 }, { id: 'superPotion', price: 700 },
  { id: 'fullRestore', price: 3000 }, { id: 'rareCandy', price: 0 },
  { id: 'hpUp', price: 9800 }, { id: 'protein', price: 9800 },
  { id: 'iron', price: 9800 }, { id: 'calcium', price: 9800 },
  { id: 'zinc', price: 9800 }, { id: 'carbos', price: 9800 },
  { id: 'train', price: 0 }, { id: 'weaken', price: 0 },
  { id: 'evolutionStone', price: 0 }, { id: 'thunderStone', price: 2100 },
  { id: 'waterStone', price: 2100 }, { id: 'fireStone', price: 2100 },
  { id: 'leafStone', price: 2100 }, { id: 'moonStone', price: 2100 },
  { id: 'sunStone', price: 2100 }, { id: 'shinyStone', price: 2100 },
  { id: 'duskStone', price: 2100 }, { id: 'dawnStone', price: 2100 },
  { id: 'iceStone', price: 2100 }, { id: 'tm', price: 500 },
  { id: 'sitrusBerry', price: 200 }, { id: 'oranBerry', price: 150 },
  { id: 'lumBerry', price: 300 }, { id: 'chestoBerry', price: 100 },
  { id: 'rawstBerry', price: 100 }, { id: 'oldRod', price: 500 },
  { id: 'goodRod', price: 2000 }, { id: 'superRod', price: 10000 },
  { id: 'craftingKit', price: 3000 }, { id: 'ether', price: 600 },
  { id: 'elixir', price: 1200 }, { id: 'ppUp', price: 6400 },
  { id: 'expShare', price: 0 }, { id: 'luckyEgg', price: 0 },
];

const priceMap = new Map(ITEMS.map(i => [i.id, i.price]));

// ── Рецепты крафта (14 штук) ─────────────────────────────────
interface Recipe {
  id: string; ingredients: Record<string, number>; result: string; qty: number;
}
const CRAFTING_RECIPES: Recipe[] = [
  { id: 'metalIngot', ingredients: { 'ore': 3 }, result: 'metalIngot', qty: 1 },
  { id: 'glass', ingredients: { 'mountainSand': 2, 'coal': 1 }, result: 'glass', qty: 1 },
  { id: 'bandage', ingredients: { 'cotton': 3 }, result: 'bandage', qty: 1 },
  { id: 'healingPotionCraft', ingredients: { 'healingHerbs': 2, 'wonderFlower': 1 }, result: 'potion', qty: 1 },
  { id: 'sparkles', ingredients: { 'shinyDust': 3, 'metalIngot': 1 }, result: 'sparkles', qty: 1 },
  { id: 'honeyJar', ingredients: { 'honeycomb': 2, 'woodenApricorn': 1 }, result: 'honeyJar', qty: 1 },
  { id: 'fossilRevive', ingredients: { 'suspiciousEgg': 1, 'ancientGenome': 1 }, result: 'fossil', qty: 1 },
  { id: 'craftPokeball', ingredients: { 'woodenApricorn': 1, 'metalIngot': 1 }, result: 'pokeBall', qty: 3 },
  { id: 'craftGreatBall', ingredients: { 'woodenApricorn': 2, 'metalIngot': 1, 'shinyDust': 1 }, result: 'greatBall', qty: 2 },
  { id: 'craftProtein', ingredients: { 'healingHerbs': 2, 'honeycomb': 1, 'ore': 1 }, result: 'protein', qty: 1 },
  { id: 'craftIron', ingredients: { 'ore': 2, 'metalIngot': 1 }, result: 'iron', qty: 1 },
  { id: 'craftOran', ingredients: { 'cotton': 1, 'honeycomb': 1 }, result: 'oranBerry', qty: 3 },
  { id: 'craftWeakElixir', ingredients: { 'healingHerbs': 2, 'wonderFlower': 1 }, result: 'ether', qty: 1 },
  { id: 'craftElixir', ingredients: { 'healingHerbs': 3, 'wonderFlower': 2, 'honeycomb': 1 }, result: 'elixir', qty: 1 },
];

// ── Хелпер: получить save_data пользователя ──────────────────
async function getUserData(userId: number) {
  const db = getDb();
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) throw new Error('User not found');
  let saveData: any = {};
  try { saveData = JSON.parse(user.save_data || '{}'); } catch {}
  if (!saveData.inventory) saveData.inventory = {};
  return { user, saveData };
}

// ── POST /economy/buy ────────────────────────────────────────
router.post('/buy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId, qty } = req.body;
    if (!itemId || !qty || qty < 1) {
      res.status(400).json({ error: 'Invalid itemId or qty' });
      return;
    }

    const price = priceMap.get(itemId);
    if (!price || price <= 0) {
      res.status(400).json({ error: 'Item not available for purchase' });
      return;
    }

    const total = price * qty;
    const { saveData } = await getUserData(req.user!.userId);
    const currentMoney = saveData.inventory['credit'] || 0;

    if (currentMoney < total) {
      res.status(400).json({ error: 'Not enough credits' });
      return;
    }

    // Списать деньги
    saveData.inventory['credit'] = currentMoney - total;
    // Добавить предмет
    saveData.inventory[itemId] = (saveData.inventory[itemId] || 0) + qty;

    const db = getDb();
    await db.update(users).set({
      save_data: JSON.stringify(saveData),
      money: saveData.inventory['credit'],
    }).where(eq(users.id, req.user!.userId));

    res.json({ money: saveData.inventory['credit'] });
  } catch (err: any) {
    console.error('[economy/buy]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /economy/sell ───────────────────────────────────────
router.post('/sell', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId, qty } = req.body;
    if (!itemId || !qty || qty < 1 || itemId === 'credit') {
      res.status(400).json({ error: 'Invalid itemId or qty' });
      return;
    }

    const { saveData } = await getUserData(req.user!.userId);
    const currentQty = saveData.inventory[itemId] || 0;

    if (currentQty < qty) {
      res.status(400).json({ error: 'Not enough items' });
      return;
    }

    const price = priceMap.get(itemId) || 100;
    const sellPrice = Math.floor(price / 2);
    const totalEarned = sellPrice * qty;

    // Списать предмет
    saveData.inventory[itemId] -= qty;
    if (saveData.inventory[itemId] <= 0) delete saveData.inventory[itemId];
    // Начислить деньги
    saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + totalEarned;

    const db = getDb();
    await db.update(users).set({
      save_data: JSON.stringify(saveData),
      money: saveData.inventory['credit'],
    }).where(eq(users.id, req.user!.userId));

    res.json({ money: saveData.inventory['credit'] });
  } catch (err: any) {
    console.error('[economy/sell]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /economy/craft ──────────────────────────────────────
router.post('/craft', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.body;
    const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) {
      res.status(400).json({ error: 'Unknown recipe' });
      return;
    }

    const { saveData } = await getUserData(req.user!.userId);

    // Проверить ингредиенты
    for (const [ingId, ingQty] of Object.entries(recipe.ingredients)) {
      const have = saveData.inventory[ingId] || 0;
      if (have < ingQty) {
        res.status(400).json({ error: `Not enough ${ingId}` });
        return;
      }
    }

    // Списать ингредиенты
    for (const [ingId, ingQty] of Object.entries(recipe.ingredients)) {
      saveData.inventory[ingId] -= ingQty;
      if (saveData.inventory[ingId] <= 0) delete saveData.inventory[ingId];
    }

    // Выдать результат
    saveData.inventory[recipe.result] = (saveData.inventory[recipe.result] || 0) + recipe.qty;

    const db = getDb();
    await db.update(users).set({
      save_data: JSON.stringify(saveData),
    }).where(eq(users.id, req.user!.userId));

    // Клиент ожидает ВЕСЬ inventory
    res.json({ inventory: saveData.inventory });
  } catch (err: any) {
    console.error('[economy/craft]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /economy/reward ─────────────────────────────────────
router.post('/reward', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { money, items } = req.body;
    if (!money && !items) {
      res.status(400).json({ error: 'money or items required' });
      return;
    }

    const { saveData } = await getUserData(req.user!.userId);

    if (money) {
      saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + money;
    }
    if (Array.isArray(items)) {
      for (const item of items) {
        saveData.inventory[item.id] = (saveData.inventory[item.id] || 0) + (item.qty || 1);
      }
    }

    const db = getDb();
    await db.update(users).set({
      save_data: JSON.stringify(saveData),
      money: saveData.inventory['credit'],
    }).where(eq(users.id, req.user!.userId));

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[economy/reward]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
