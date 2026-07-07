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
        saveData.badges = [
          'Boulder Badge', 'Cascade Badge', 'Thunder Badge', 'Rainbow Badge',
          'Soul Badge', 'Marsh Badge', 'Volcano Badge', 'Earth Badge',
          'Zephyr Badge', 'Hive Badge', 'Plain Badge', 'Fog Badge',
          'Storm Badge', 'Mineral Badge', 'Glacier Badge', 'Rising Badge',
        ];
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


      // ── fix_levels ──
      case 'fix_levels': {
        if (!tgId) throw new Error('user required');
        const { saveData } = await getUserData(tgId);
        saveData.myTeam.forEach((m: any) => { m.baseLevel = 50; });
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

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
        const { saveData } = await getUserData(tgId);
        saveData.currentLocationId = loc;
        await saveUserData(tgId, saveData);
        await db.update(users).set({ location_id: loc }).where(eq(users.tg_id, tgId));
        res.json({ status: 'ok' });
        break;
      }

      // ── add_mon (полноценный спавн покемона через PokeAPI) ──
      case 'add_mon': {
        if (!tgId || !val) throw new Error('user and val required');
        let monData: any;
        try { monData = JSON.parse(val); } catch {
          res.status(400).json({ status: 'error', error: 'Invalid JSON in val' });
          return;
        }
        const species = monData.species || 'mewtwo';
        const level = monData.level || 50;
        const shiny = !!monData.shiny;
        const maxIV = !!monData.maxIV;
        const natureIdx = monData.natureIdx !== undefined && monData.natureIdx >= 0 ? monData.natureIdx : Math.floor(Math.random() * 25);
        const trainingStage = monData.trainingStage || 0;
        const target = monData.target || 'team';

        // Загружаем данные из PokeAPI
        let pokeData: any;
        try {
          const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${species}`);
          if (!pokeRes.ok) { res.status(400).json({ status: 'error', error: `PokeAPI: ${species} not found` }); return; }
          pokeData = await pokeRes.json();
        } catch (e) {
          res.status(502).json({ status: 'error', error: 'PokeAPI fetch failed' });
          return;
        }

        // Фильтруем атаки до level (только level-up, макс 4)
        const learnedMoves = pokeData.moves
          .filter((m: any) => m.version_group_details.some((v: any) => v.move_learn_method.name === 'level-up' && v.level_learned_at <= level))
          .slice(0, 4);
        if (learnedMoves.length === 0) learnedMoves.push({ move: { name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' } });
        pokeData.moves = learnedMoves;

        // Расчёт статов
        const exp = Math.pow(level, 3);
        const expToNext = Math.pow(level + 1, 3);
        const baseHp = pokeData.stats[0].base_stat;
        const iv = maxIV ? 31 : Math.floor(Math.random() * 16) + 15; // 15-30 или 31
        const maxHp = Math.floor(0.01 * (2 * baseHp + iv) * level) + level + 10;

        const newMon: any = {
          uid: `admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          originalTrainer: tgId.toString(),
          createdAt: Date.now(),
          caughtLocation: 'admin',
          apiData: pokeData,
          maxHp,
          currentHp: maxHp,
          ivs: maxIV
            ? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
            : { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
          evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
          baseLevel: level,
          exp,
          expToNext,
          candiesEaten: 0,
          vitaminsEaten: 0,
          training: null,
          trainingStage,
          trainingStat: null,
          happiness: 70,
          natureIdx,
          breedLetter: 'A',
          gender: Math.random() < 0.5 ? 'male' : 'female',
          status: null,
          sleepTurns: 0,
          movesPP: [],
          statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
          abilityName: pokeData.abilities?.[0]?.ability?.name || null,
          heldItem: null,
          berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
          learnableMoves: [],
          isShiny: shiny,
        };

        const { saveData } = await getUserData(tgId);
        if (target === 'pc') {
          if (!saveData.pcBoxes) saveData.pcBoxes = [[]];
          if (saveData.pcBoxes.length === 0) saveData.pcBoxes = [[]];
          saveData.pcBoxes[0].push(newMon);
        } else {
          if (!saveData.myTeam) saveData.myTeam = [];
          saveData.myTeam.push(newMon);
        }

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

      // ── get_save (редактор тренера) ──
      case 'get_save': {
        if (!tgId) throw new Error('user required');
        const row = (await db.select().from(users).where(eq(users.tg_id, tgId)).limit(1))[0];
        if (!row) { res.status(404).json({ status: 'error', error: 'User not found' }); return; }
        let saveData: any = {};
        try { saveData = JSON.parse(row.save_data || '{}'); } catch {}
        res.json({
          status: 'ok',
          saveData,
          meta: {
            nickname: row.nickname,
            money: row.money,
            badges_count: row.badges_count,
            pokemon_count: row.pokemon_count,
            registered: row.registered,
          },
        });
        break;
      }

      // ── edit_trainer (редактор тренера) ──
      case 'edit_trainer': {
        if (!tgId || !val) throw new Error('user and val required');
        let editorData: any;
        try { editorData = JSON.parse(val); } catch {
          res.status(400).json({ status: 'error', error: 'Invalid JSON in val' });
          return;
        }
        await saveUserData(tgId, editorData);
        const nicknameUpdate = editorData.trainerNickname || '';
        const locationUpdate = editorData.currentLocationId || 'goldenrodCity';
        await db.update(users).set({
          nickname: nicknameUpdate,
          location_id: locationUpdate,
        }).where(eq(users.tg_id, tgId));
        res.json({ status: 'ok' });
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
        saveData.badges = [
          'Boulder Badge', 'Cascade Badge', 'Thunder Badge', 'Rainbow Badge',
          'Soul Badge', 'Marsh Badge', 'Volcano Badge', 'Earth Badge',
          'Zephyr Badge', 'Hive Badge', 'Plain Badge', 'Fog Badge',
          'Storm Badge', 'Mineral Badge', 'Glacier Badge', 'Rising Badge',
        ];
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
        const { saveData } = await getUserData(tgId);
        saveData.currentLocationId = loc;
        await saveUserData(tgId, saveData);
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
        const species = monData.species || 'mewtwo';
        const level = monData.level || 50;
        const shiny = !!monData.shiny;
        const maxIV = !!monData.maxIV;
        const natureIdx = monData.natureIdx !== undefined && monData.natureIdx >= 0 ? monData.natureIdx : Math.floor(Math.random() * 25);
        const trainingStage = monData.trainingStage || 0;
        const target = monData.target || 'team';

        let pokeData: any;
        try {
          const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${species}`);
          if (!pokeRes.ok) { res.status(400).json({ status: 'error', error: `PokeAPI: ${species} not found` }); return; }
          pokeData = await pokeRes.json();
        } catch (e) {
          res.status(502).json({ status: 'error', error: 'PokeAPI fetch failed' });
          return;
        }

        const learnedMoves = pokeData.moves
          .filter((m: any) => m.version_group_details.some((v: any) => v.move_learn_method.name === 'level-up' && v.level_learned_at <= level))
          .slice(0, 4);
        if (learnedMoves.length === 0) learnedMoves.push({ move: { name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' } });
        pokeData.moves = learnedMoves;

        const exp = Math.pow(level, 3);
        const expToNext = Math.pow(level + 1, 3);
        const baseHp = pokeData.stats[0].base_stat;
        const iv = maxIV ? 31 : Math.floor(Math.random() * 16) + 15;
        const maxHp = Math.floor(0.01 * (2 * baseHp + iv) * level) + level + 10;

        const newMon: any = {
          uid: `admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          originalTrainer: tgId.toString(),
          createdAt: Date.now(),
          caughtLocation: 'admin',
          apiData: pokeData,
          maxHp,
          currentHp: maxHp,
          ivs: maxIV
            ? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
            : { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
          evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
          baseLevel: level,
          exp, expToNext,
          candiesEaten: 0, vitaminsEaten: 0,
          training: null, trainingStage, trainingStat: null,
          happiness: 70, natureIdx,
          breedLetter: 'A', gender: Math.random() < 0.5 ? 'male' : 'female',
          status: null, sleepTurns: 0, movesPP: [],
          statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
          abilityName: pokeData.abilities?.[0]?.ability?.name || null,
          heldItem: null,
          berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
          learnableMoves: [], isShiny: shiny,
        };

        const { saveData } = await getUserData(tgId);
        if (target === 'pc') {
          if (!saveData.pcBoxes) saveData.pcBoxes = [[]];
          if (saveData.pcBoxes.length === 0) saveData.pcBoxes = [[]];
          saveData.pcBoxes[0].push(newMon);
        } else {
          if (!saveData.myTeam) saveData.myTeam = [];
          saveData.myTeam.push(newMon);
        }
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

      // ── get_save (редактор тренера) ──
      case 'get_save': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const row = (await db.select().from(users).where(eq(users.tg_id, tgId)).limit(1))[0];
        if (!row) { res.status(404).json({ status: 'error', error: 'User not found' }); return; }
        let saveData: any = {};
        try { saveData = JSON.parse(row.save_data || '{}'); } catch {}
        res.json({
          status: 'ok',
          saveData,
          meta: {
            nickname: row.nickname,
            money: row.money,
            badges_count: row.badges_count,
            pokemon_count: row.pokemon_count,
            registered: row.registered,
          },
        });
        break;
      }

      // ── edit_trainer (редактор тренера) ──
      case 'edit_trainer': {
        if (!tgId || !val) {
          res.status(400).json({ status: 'error', error: 'user and val required' });
          return;
        }
        let editorData: any;
        try { editorData = JSON.parse(val); } catch {
          res.status(400).json({ status: 'error', error: 'Invalid JSON in val' });
          return;
        }
        await saveUserData(tgId, editorData);
        const nicknameUpdate = editorData.trainerNickname || '';
        const locationUpdate = editorData.currentLocationId || 'goldenrodCity';
        await db.update(users).set({
          nickname: nicknameUpdate,
          location_id: locationUpdate,
        }).where(eq(users.tg_id, tgId));
        res.json({ status: 'ok' });
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
