/**
 * Admin routes:
 *   GET  /admin/api — админ-команды (12 шт, deprecated — используйте POST)
 *   POST /admin/api — админ-команды через JWT авторизацию
 *
 * Аутентификация:
 *   GET  — query parameter ?token=ADMIN_PASS (deprecated, будет удалён)
 *   POST — Authorization: Bearer <JWT> с is_admin=true
 *          или Authorization: Bearer <ADMIN_PASS> для обратной совместимости
 *
 * Все команды работают с save_data целевого пользователя.
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { users, serverFeatures } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// ── Хелпер: получить/обновить save_data ──────────────────────
async function getUserData(tgId: number) {
  const db = getDb();
  const user = (await db.select().from(users).where(eq(users.tg_id, tgId)).limit(1))[0];
  if (!user) throw new Error('User not found');
  let saveData: any = {};
  try { saveData = JSON.parse(user.save_data || '{}'); } catch {}
  if (!saveData.inventory) saveData.inventory = { credit: 500 };
  if (!saveData.myTeam) saveData.myTeam = [];
  if (!saveData.badges) saveData.badges = [];
  return { user, saveData };
}

async function saveUserData(tgId: number, saveData: any) {
  const db = getDb();
  const inv = saveData.inventory || {};
  await db.update(users).set({
    save_data: JSON.stringify(saveData),
    money: inv['credit'] || 0,
    badges_count: Array.isArray(saveData.badges) ? saveData.badges.length : 0,
    pokemon_count: Array.isArray(saveData.myTeam) ? saveData.myTeam.length : 0,
  }).where(eq(users.tg_id, tgId));
}

// ── Универсальный админ-эндпоинт ─────────────────────────────
router.get('/api', async (req: Request, res: Response) => {
  try {
    // Проверка токена
    const token = req.query.token as string;
    if (token !== config.adminPass) {
      res.status(403).json({ status: 'error', error: 'Invalid admin token' });
      return;
    }

    const cmd = req.query.cmd as string;
    const userParam = req.query.user as string;
    const val = req.query.val as string | undefined;

    if (!cmd) {
      res.status(400).json({ status: 'error', error: 'cmd required' });
      return;
    }

    const db = getDb();
    const tgId = parseInt(userParam, 10);

    switch (cmd) {
      // ── give_items ──
      case 'give_items': {
        if (!tgId || !val) throw new Error('user and val required');
        const { saveData } = await getUserData(tgId);
        let items: any;
        try { items = JSON.parse(val); } catch {
          res.status(400).json({ status: 'error', error: 'Invalid JSON in val' });
          return;
        }
        const itemId = items.itemId || 'ultraBall';
        const qty = items.qty || 999;
        saveData.inventory[itemId] = (saveData.inventory[itemId] || 0) + qty;
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      // ── give_money ──
      case 'give_money': {
        if (!tgId) throw new Error('user required');
        const { saveData } = await getUserData(tgId);
        const amount = parseInt(val || '100000');
        saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + amount;
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      // ── give_badges ──
      case 'give_badges': {
        if (!tgId) throw new Error('user required');
        const { saveData } = await getUserData(tgId);
        saveData.badges = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      // ── heal_team ──
      case 'heal_team': {
        if (!tgId) throw new Error('user required');
        const { saveData } = await getUserData(tgId);
        saveData.myTeam.forEach((m: any) => { m.currentHp = m.maxHp; });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      // ── max_iv ──
      case 'max_iv': {
        if (!tgId) throw new Error('user required');
        const { saveData } = await getUserData(tgId);
        const allStats = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'];
        saveData.myTeam.forEach((m: any) => {
          if (!m.ivs) m.ivs = {};
          allStats.forEach(s => { m.ivs[s] = 31; });
        });
        saveData.pcBoxes?.forEach((box: any[]) => box.forEach((m: any) => {
          if (!m.ivs) m.ivs = {};
          allStats.forEach(s => { m.ivs[s] = 31; });
        }));
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      // ── fix_levels ──
      case 'fix_levels': {
        if (!tgId) throw new Error('user required');
        const { saveData } = await getUserData(tgId);
        saveData.myTeam.forEach((m: any) => { m.baseLevel = 50; });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      // ── give_legendary ──
      case 'give_legendary': {
        if (!tgId) throw new Error('user required');
        const { saveData } = await getUserData(tgId);
        const legends = ['mewtwo', 'lugia', 'ho-oh', 'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'zekrom', 'reshiram'];
        const pick = legends[Math.floor(Math.random() * legends.length)];
        saveData.myTeam.push({
          uid: `admin_${Date.now()}`,
          apiData: { name: pick },
          baseLevel: 70,
          ivs: { hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 },
          currentHp: 999,
          maxHp: 999,
        });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      // ── reset_save ──
      case 'reset_save': {
        if (!tgId) throw new Error('user required');
        await db.update(users).set({
          save_data: '{}',
          money: 500,
          badges_count: 0,
          pokemon_count: 0,
        }).where(eq(users.tg_id, tgId));
        res.json({ status: 'ok' });
        break;
      }

      // ── teleport ──
      case 'teleport': {
        if (!tgId) throw new Error('user required');
        const loc = val || 'goldenrodCity';
        await db.update(users).set({ location_id: loc }).where(eq(users.tg_id, tgId));
        res.json({ status: 'ok' });
        break;
      }

      // ── add_mon (спавн покемона) ──
      case 'add_mon': {
        if (!tgId || !val) throw new Error('user and val required');
        let monData: any;
        try { monData = JSON.parse(val); } catch {
          res.status(400).json({ status: 'error', error: 'Invalid JSON in val' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        saveData.myTeam.push({
          uid: `admin_spawn_${Date.now()}`,
          apiData: { name: monData.species || 'mewtwo' },
          baseLevel: monData.level || 50,
          ivs: monData.maxIV
            ? { hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 }
            : { hp: 15, attack: 15, defense: 15, spAtk: 15, spDef: 15, speed: 15 },
          currentHp: 999,
          maxHp: 999,
        });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      // ── broadcast ──
      case 'broadcast': {
        const msg = val || 'announcement';
        const io = (req.app as any).get('io');
        if (io) {
          io.emit('save_updated');
        }
        res.json({ status: 'ok' });
        break;
      }

      // ── toggle_feature ──
      case 'toggle_feature': {
        const feature = val || 'double_exp';
        const existing = (await db.select()
          .from(serverFeatures)
          .where(eq(serverFeatures.feature, feature))
          .limit(1))[0];

        let enabled: number;
        if (existing) {
          enabled = existing.enabled ? 0 : 1;
          await db.update(serverFeatures)
            .set({ enabled })
            .where(eq(serverFeatures.feature, feature));
        } else {
          enabled = 1;
          await db.insert(serverFeatures).values({ feature, enabled });
        }

        res.json({ status: 'ok', enabled: !!enabled });
        break;
      }

      default:
        res.status(400).json({ status: 'error', error: `Unknown cmd: ${cmd}` });
    }
  } catch (err: any) {
    console.error('[admin/api]', err);
    res.json({ status: 'error', error: 'Admin API error' });
  }
});

// ── POST /admin/api (JWT-авторизованный) ─────────────────────────
// Безопасная альтернатива GET-эндпоинту.
// Аутентификация: Authorization: Bearer <JWT> + is_admin
// Или: Authorization: Bearer <ADMIN_PASS> (обратная совместимость)
router.post('/api', async (req: Request, res: Response) => {
  try {
    // ── Проверка авторизации ──
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ status: 'error', error: 'Authorization header required' });
      return;
    }
    const token = authHeader.slice(7);

    let isAuthorized = false;

    // Вариант 1: ADMIN_PASS (обратная совместимость)
    if (token === config.adminPass) {
      isAuthorized = true;
    }

    // Вариант 2: JWT с is_admin
    if (!isAuthorized) {
      try {
        const jwt = await import('jsonwebtoken');
        const payload = jwt.default.verify(token, config.jwtSecret) as any;
        if (payload.isAdmin) {
          isAuthorized = true;
        }
      } catch { /* не JWT — пробуем следующий вариант */ }
    }

    if (!isAuthorized) {
      res.status(403).json({ status: 'error', error: 'Invalid admin token' });
      return;
    }

    const { cmd, user: userParam, val } = req.body;
    if (!cmd) {
      res.status(400).json({ status: 'error', error: 'cmd required' });
      return;
    }

    const db = getDb();
    const tgId = parseInt(userParam, 10);

    // ── Тот же switch, что и в GET ──
    switch (cmd) {
      case 'give_items': {
        if (!tgId || !val) {
          res.status(400).json({ status: 'error', error: 'user and val required' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        let items: any;
        try { items = JSON.parse(val); } catch {
          res.status(400).json({ status: 'error', error: 'Invalid JSON in val' });
          return;
        }
        const itemId = items.itemId || 'ultraBall';
        const qty = items.qty || 999;
        saveData.inventory[itemId] = (saveData.inventory[itemId] || 0) + qty;
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'give_money': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        const amount = parseInt(val || '100000');
        saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + amount;
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'give_badges': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        saveData.badges = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'heal_team': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        saveData.myTeam.forEach((m: any) => { m.currentHp = m.maxHp; });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'max_iv': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        const allStats = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'];
        saveData.myTeam.forEach((m: any) => {
          if (!m.ivs) m.ivs = {};
          allStats.forEach(s => { m.ivs[s] = 31; });
        });
        saveData.pcBoxes?.forEach((box: any[]) => box.forEach((m: any) => {
          if (!m.ivs) m.ivs = {};
          allStats.forEach(s => { m.ivs[s] = 31; });
        }));
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'fix_levels': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        saveData.myTeam.forEach((m: any) => { m.baseLevel = 50; });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'give_legendary': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        const legends = ['mewtwo', 'lugia', 'ho-oh', 'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'zekrom', 'reshiram'];
        const pick = legends[Math.floor(Math.random() * legends.length)];
        saveData.myTeam.push({
          uid: `admin_${Date.now()}`,
          apiData: { name: pick },
          baseLevel: 70,
          ivs: { hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 },
          currentHp: 999,
          maxHp: 999,
        });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'reset_save': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        await db.update(users).set({
          save_data: '{}',
          money: 500,
          badges_count: 0,
          pokemon_count: 0,
        }).where(eq(users.tg_id, tgId));
        res.json({ status: 'ok' });
        break;
      }

      case 'teleport': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const loc = val || 'goldenrodCity';
        await db.update(users).set({ location_id: loc }).where(eq(users.tg_id, tgId));
        res.json({ status: 'ok' });
        break;
      }

      case 'add_mon': {
        if (!tgId || !val) {
          res.status(400).json({ status: 'error', error: 'user and val required' });
          return;
        }
        let monData: any;
        try { monData = JSON.parse(val); } catch {
          res.status(400).json({ status: 'error', error: 'Invalid JSON in val' });
          return;
        }
        const { saveData } = await getUserData(tgId);
        saveData.myTeam.push({
          uid: `admin_spawn_${Date.now()}`,
          apiData: { name: monData.species || 'mewtwo' },
          baseLevel: monData.level || 50,
          ivs: monData.maxIV
            ? { hp: 31, attack: 31, defense: 31, spAtk: 31, spDef: 31, speed: 31 }
            : { hp: 15, attack: 15, defense: 15, spAtk: 15, spDef: 15, speed: 15 },
          currentHp: 999,
          maxHp: 999,
        });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'broadcast': {
        const msg = val || 'announcement';
        const io = (req.app as any).get('io');
        if (io) {
          io.emit('save_updated');
        }
        res.json({ status: 'ok' });
        break;
      }

      case 'toggle_feature': {
        const feature = val || 'double_exp';
        const existing = (await db.select()
          .from(serverFeatures)
          .where(eq(serverFeatures.feature, feature))
          .limit(1))[0];

        let enabled: number;
        if (existing) {
          enabled = existing.enabled ? 0 : 1;
          await db.update(serverFeatures)
            .set({ enabled })
            .where(eq(serverFeatures.feature, feature));
        } else {
          enabled = 1;
          await db.insert(serverFeatures).values({ feature, enabled });
        }

        res.json({ status: 'ok', enabled: !!enabled });
        break;
      }

      default:
        res.status(400).json({ status: 'error', error: `Unknown cmd: ${cmd}` });
    }
  } catch (err: any) {
    console.error('[admin/api-post]', err);
    res.json({ status: 'error', error: 'Admin API error' });
  }
});

export default router;
