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
import { parseSaveStrict, stampSave } from '../db/save-json.js';
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, serverFeatures } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

/** Включена ли серверная фича (админка → toggle_feature). */
async function isFeatureOn(db: any, name: string): Promise<boolean> {
  try {
    const row = (await db.select().from(serverFeatures).where(eq(serverFeatures.feature, name)).limit(1))[0];
    return !!row?.enabled;
  } catch { return false; }
}

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
  { id: 'fullRestore', price: 3000 }, { id: 'rareCandy', price: 800000 },
  { id: 'vanillaCandy', price: 5000 }, { id: 'commonCandy', price: 10000 },
  { id: 'typeCandy', price: 15000 },
  { id: 'hpUp', price: 9800 }, { id: 'protein', price: 9800 },
  { id: 'iron', price: 9800 }, { id: 'calcium', price: 9800 },
  { id: 'zinc', price: 9800 }, { id: 'carbos', price: 9800 },
  { id: 'train', price: 500000 }, { id: 'weaken', price: 250000 },
  { id: 'evolutionStone', price: 0 }, { id: 'thunderStone', price: 2100 },
  { id: 'waterStone', price: 2100 }, { id: 'fireStone', price: 2100 },
  { id: 'leafStone', price: 2100 }, { id: 'moonStone', price: 2100 },
  { id: 'sunStone', price: 2100 }, { id: 'shinyStone', price: 2100 },
  { id: 'duskStone', price: 2100 }, { id: 'dawnStone', price: 2100 },
  { id: 'iceStone', price: 2100 },   { id: 'tm', price: 500 },
  { id: 'tmWeak', price: 200000 }, { id: 'tmMid', price: 2000000 },
  { id: 'tmTop', price: 20000000 },
  { id: 'sitrusBerry', price: 200 }, { id: 'oranBerry', price: 150 },
  { id: 'lumBerry', price: 300 }, { id: 'chestoBerry', price: 100 },
  { id: 'rawstBerry', price: 100 },   { id: 'oldRod', price: 500 },
  { id: 'goodRod', price: 2000 }, { id: 'superRod', price: 10000 },
  { id: 'ferryTicket', price: 300000 }, { id: 'trainTicket', price: 500000 },
  { id: 'craftersKit', price: 3000 }, { id: 'ether', price: 600 },
  { id: 'elixir', price: 1200 }, { id: 'ppUp', price: 6400 },
  { id: 'expShare', price: 0 }, { id: 'luckyEgg', price: 0 },
  // Скоба (EV +1/уровень): очень дорого (решение владельца: 25М)
  { id: 'evBrace', price: 25000000 },
];

const priceMap = new Map(ITEMS.map(i => [i.id, i.price]));

/** Экспорт для теста паритета цен (vitest): клиент обязан совпадать. */
export const SERVER_PRICE_MAP = priceMap;

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
  const saveData = parseSaveStrict(user.save_data, user.id)
  if (!saveData.inventory) saveData.inventory = {};
  return { user, saveData };
}

// ── POST /economy/buy ────────────────────────────────────────
router.post('/buy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId, qty } = req.body;
    if (!itemId || typeof qty !== 'number' || qty < 1 || !Number.isInteger(qty)) {
      res.status(400).json({ error: 'Invalid itemId or qty' });
      return;
    }

    const price = priceMap.get(itemId);
    if (!price || price <= 0) {
      res.status(400).json({ error: 'Item not available for purchase' });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;

    // Транзакция: read → check → write атомарно
    const result = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');
      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};

      const currentMoney = saveData.inventory['credit'] || 0;
      // free_shop (админка): магазин бесплатный — деньги не проверяем и не списываем
      const freeShop = await isFeatureOn(db, 'free_shop');
      const total = freeShop ? 0 : price * qty;

      if (currentMoney < total) {
        throw new Error('Not enough credits');
      }

      saveData.inventory['credit'] = currentMoney - total;
      saveData.inventory[itemId] = (saveData.inventory[itemId] || 0) + qty;

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
        money: saveData.inventory['credit'],
      }).where(eq(users.id, userId));

      return saveData.inventory['credit'];
    });

    res.json({ money: result });
  } catch (err: any) {
    if (err.message === 'Not enough credits') {
      res.status(400).json({ error: 'Not enough credits' });
      return;
    }
    console.error('[economy/buy]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /economy/sell ───────────────────────────────────────
router.post('/sell', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId, qty } = req.body;
    if (!itemId || typeof qty !== 'number' || qty < 1 || !Number.isInteger(qty) || itemId === 'credit') {
      res.status(400).json({ error: 'Invalid itemId or qty' });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;

    const result = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');
      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};

      const currentQty = saveData.inventory[itemId] || 0;
      if (currentQty < qty) throw new Error('Not enough items');

      const price = priceMap.get(itemId);
      if (!price) throw new Error('Item cannot be sold');
      const sellPrice = Math.floor(price / 2);
      const totalEarned = sellPrice * qty;

      saveData.inventory[itemId] -= qty;
      if (saveData.inventory[itemId] <= 0) delete saveData.inventory[itemId];
      saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + totalEarned;

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
        money: saveData.inventory['credit'],
      }).where(eq(users.id, userId));

      return { money: saveData.inventory['credit'] };
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === 'Not enough items') {
      res.status(400).json({ error: 'Not enough items' });
      return;
    }
    if (err.message === 'Item cannot be sold') {
      res.status(400).json({ error: 'Item cannot be sold' });
      return;
    }
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

    const db = getDb();
    const userId = req.user!.userId;

    const inventory = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');
      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};

      // Проверить ингредиенты
      for (const [ingId, ingQty] of Object.entries(recipe.ingredients)) {
        const have = saveData.inventory[ingId] || 0;
        if (have < ingQty) {
          throw new Error(`Not enough ${ingId}`);
        }
      }

      // Списать ингредиенты
      for (const [ingId, ingQty] of Object.entries(recipe.ingredients)) {
        saveData.inventory[ingId] -= ingQty;
        if (saveData.inventory[ingId] <= 0) delete saveData.inventory[ingId];
      }

      // Выдать результат
      saveData.inventory[recipe.result] = (saveData.inventory[recipe.result] || 0) + recipe.qty;

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
      }).where(eq(users.id, userId));

      return saveData.inventory;
    });

    // Клиент ожидает ВЕСЬ inventory
    res.json({ inventory });
  } catch (err: any) {
    if (err.message && err.message.startsWith('Not enough ')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[economy/craft]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /economy/reward ─────────────────────────────────────
router.post('/reward', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;

    const result = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');
      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};

      // Проверка кулдауна (24h) по серверной колонке, а не по клиентскому полю:
      // lastRewardTime в save_data затирался каждым обычным сохранением клиента.
      const now = Date.now();
      const cooldownMs = 24 * 60 * 60 * 1000; // 24 ч
      const lastRewardAt = Number(user.last_reward_at || 0);
      const timeSinceLastReward = now - lastRewardAt;
      if (timeSinceLastReward < cooldownMs) {
        const hoursLeft = Math.ceil((cooldownMs - timeSinceLastReward) / (60 * 60 * 1000));
        throw new Error(`Reward cooldown: ${hoursLeft}h remaining`);
      }

      // Что получить: 500 кред. + 5 покеболов + 3 аптечки
      const rewardMoney = 500;
      const rewardItems = { pokeBall: 5, potion: 3 };

      saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + rewardMoney;
      for (const [itemId, qty] of Object.entries(rewardItems)) {
        saveData.inventory[itemId] = (saveData.inventory[itemId] || 0) + qty;
      }

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
        money: saveData.inventory['credit'],
        last_reward_at: now,
      }).where(eq(users.id, userId));

      return { rewardMoney, rewardItems };
    });

    res.json({ ok: true, money: result.rewardMoney, items: result.rewardItems });
  } catch (err: any) {
    if (err.message && err.message.startsWith('Reward cooldown:')) {
      res.status(429).json({ error: err.message });
      return;
    }
    console.error('[economy/reward]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Данные лидеров залов для server-authoritative наград ──
const GYM_LEADERS: Record<string, { badgeName: string; moneyReward: number; rewardItem?: string; rewardQty?: number }> = {
  pewterStadium: { badgeName: 'Boulder Badge', moneyReward: 4000, rewardItem: 'fullRestore', rewardQty: 1 },
  ceruleanStadium: { badgeName: 'Cascade Badge', moneyReward: 5000, rewardItem: 'superPotion', rewardQty: 1 },
  vermilionStadium: { badgeName: 'Thunder Badge', moneyReward: 6000, rewardItem: 'elixir', rewardQty: 1 },
  celadonStadium: { badgeName: 'Rainbow Badge', moneyReward: 7000, rewardItem: 'hyperPotion', rewardQty: 1 },
  saffronPsychicStadium: { badgeName: 'Marsh Badge', moneyReward: 8000, rewardItem: 'maxPotion', rewardQty: 1 },
  fuchsiaPoisonStadium: { badgeName: 'Soul Badge', moneyReward: 9000, rewardItem: 'fullRestore', rewardQty: 2 },
  cinnabarStadium: { badgeName: 'Volcano Badge', moneyReward: 10000, rewardItem: 'fullRestore', rewardQty: 1 },
  viridianStadium: { badgeName: 'Earth Badge', moneyReward: 11000, rewardItem: 'fullRestore', rewardQty: 1 },
  violetStadium: { badgeName: 'Zephyr Badge', moneyReward: 12000, rewardItem: 'superPotion', rewardQty: 1 },
  azaleaStadium: { badgeName: 'Hive Badge', moneyReward: 13000, rewardItem: 'elixir', rewardQty: 1 },
  goldenrodStadium: { badgeName: 'Plain Badge', moneyReward: 14000, rewardItem: 'hyperPotion', rewardQty: 1 },
  ecruteakStadium: { badgeName: 'Fog Badge', moneyReward: 15000, rewardItem: 'fullHeal', rewardQty: 1 },
  cianwoodStadium: { badgeName: 'Storm Badge', moneyReward: 16000, rewardItem: 'maxPotion', rewardQty: 1 },
  olivineStadium: { badgeName: 'Mineral Badge', moneyReward: 17000, rewardItem: 'fullRestore', rewardQty: 1 },
  mahoganyStadium: { badgeName: 'Glacier Badge', moneyReward: 18000, rewardItem: 'fullRestore', rewardQty: 1 },
  blackthornStadium: { badgeName: 'Rising Badge', moneyReward: 20000, rewardItem: 'fullRestore', rewardQty: 1 },
};

/**
 * POST /economy/badge-reward — server-authoritative награда за победу над лидером зала.
 *
 * Тело запроса: { locId: string }
 * Сервер проверяет:
 *   1. locId — известный лидер зала
 *   2. Игрок ещё не получал этот бадж
 *   3. Выдаёт бадж + деньги + предмет в БД
 */
router.post('/badge-reward', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { locId } = req.body;
    if (!locId || !GYM_LEADERS[locId]) {
      res.status(400).json({ error: 'Invalid gym location' });
      return;
    }

    const leader = GYM_LEADERS[locId];
    const userId = req.user!.userId;
    const db = getDb();

    const result = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');

      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};
      if (!saveData.badges) saveData.badges = [];

      // ── Проверка: бадж уже есть? ──
      if (saveData.badges.includes(leader.badgeName)) {
        throw new Error(`Badge already awarded: ${leader.badgeName}`);
      }

      // ── Выдаём награду ──
      saveData.badges.push(leader.badgeName);
      saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + leader.moneyReward;

      if (leader.rewardItem) {
        saveData.inventory[leader.rewardItem] = (saveData.inventory[leader.rewardItem] || 0) + (leader.rewardQty || 1);
      }

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
        money: saveData.inventory['credit'],
        badges_count: saveData.badges.length,
      }).where(eq(users.id, userId));

      return {
        badgeName: leader.badgeName,
        moneyReward: leader.moneyReward,
        rewardItem: leader.rewardItem,
        rewardQty: leader.rewardQty,
      };
    });

    res.json({ ok: true, ...result });
  } catch (err: any) {
    if (err.message?.startsWith('Badge already awarded')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('[economy/badge-reward]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
