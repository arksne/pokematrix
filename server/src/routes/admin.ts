/**
 * Admin routes:
 *   POST /admin/api — админ-команды через JWT авторизацию
 *
 * Аутентификация:
 *   Authorization: Bearer <JWT> с is_admin=true
 *   или Authorization: Bearer <ADMIN_PASS> для обратной совместимости
 *
 * Все команды работают с save_data целевого пользователя.
 */
import { parseSaveStrict, countSavePokemon, stampSave } from '../db/save-json.js';
import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { users, serverFeatures, saveHistory } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { status: 'error', error: 'Too many admin requests' } });

const router = Router();

// ── Хелпер: получить/обновить save_data ──────────────────────
async function getUserData(tgId: number) {
  const db = getDb();
  const user = (await db.select().from(users).where(eq(users.tg_id, tgId)).limit(1))[0];
  if (!user) throw new Error('User not found');
  const saveData: any = parseSaveStrict(user.save_data, user.id)
  if (!saveData.inventory) saveData.inventory = { credit: 500 };
  if (!saveData.myTeam) saveData.myTeam = [];
  if (!saveData.badges) saveData.badges = [];
  return { user, saveData };
}

async function saveUserData(tgId: number, saveData: any, reason = 'admin') {
  const db = getDb();
  const inv = saveData.inventory || {};
  const existing = (await db.select({ id: users.id, save_data: users.save_data, save_version: users.save_version })
    .from(users).where(eq(users.tg_id, tgId)).limit(1))[0];

  // Бэкап прежнего сейва. Раньше админский редактор писал save_data целиком без
  // копии: пустой textarea в форме превращался в пятиключевой объект и стирал
  // прогресс игрока безвозвратно.
  if (existing?.save_data) {
    try {
      await db.insert(saveHistory).values({
        user_id: existing.id,
        save_data: existing.save_data,
        save_version: existing.save_version ?? 0,
        reason,
        created_at: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error(`[admin] не удалось сохранить бэкап для tg ${tgId}:`, e);
    }
  }

  await db.update(users).set({
    save_data: JSON.stringify(stampSave(saveData)),
    money: inv['credit'] || 0,
    badges_count: Array.isArray(saveData.badges) ? saveData.badges.length : 0,
    pokemon_count: countSavePokemon(saveData),
    save_version: (existing?.save_version ?? 0) + 1,
  }).where(eq(users.tg_id, tgId));
}

// ── Универсальный админ-эндпоинт (только POST) ──────────────

// ── POST /admin/api (JWT-авторизованный) ─────────────────────────
// Безопасная альтернатива GET-эндпоинту.
// Аутентификация: Authorization: Bearer <JWT> + is_admin
// Или: Authorization: Bearer <ADMIN_PASS> (обратная совместимость)
router.post('/api', adminLimiter, async (req: Request, res: Response) => {
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
    if (token.length === config.adminPass.length) {
      const crypto = await import('crypto');
      const a = Buffer.from(token);
      const b = Buffer.from(config.adminPass);
      if (crypto.timingSafeEqual(a, b)) {
        isAuthorized = true;
      }
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
        const amount = Math.min(parseInt(val || '100000'), 1000000);
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
          // Метка _resetAt: без неё клиент после перезагрузки брал свой
          // локальный сейв (localStorage цел) и выкладывал его обратно, отменяя
          // сброс. Клиент сверяется с этой меткой и не восстанавливает локальное
          // состояние, если reset свежее.
          const resetAt = new Date().toISOString();
          await db.update(users).set({
            save_data: JSON.stringify({ _ts: Date.now(), _resetAt: resetAt, starterGiven: false, myTeam: [], pcBoxes: [[]], badges: [], inventory: { credit: 500 } }),
            money: 500,
            badges_count: 0,
            pokemon_count: 0,
            save_version: 0,
          }).where(eq(users.tg_id, tgId));

        try {
          const io = (req.app as any).get('io');
          if (io) io.emit('save_reset', { userId: tgId });
        } catch (_) {}
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
        const level = Math.min(monData.level || 50, 100);
        const shiny = !!monData.shiny;
        const maxIV = !!monData.maxIV;
        const natureIdx = monData.natureIdx !== undefined && monData.natureIdx >= 0 ? monData.natureIdx : Math.floor(Math.random() * 25);
        const trainingStage = monData.trainingStage || 0;
        const target = monData.target || 'team';

        if (!/^[a-z0-9-]+$/i.test(species)) {
          res.status(400).json({ status: 'error', error: 'Invalid species name' });
          return;
        }
        let pokeData: any;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${species}`, { signal: controller.signal });
          clearTimeout(timeout);
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
        const iv = maxIV ? 31 : Math.floor(Math.random() * 32);
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
          if (saveData.myTeam.length >= 6) {
            if (!saveData.pcBoxes) saveData.pcBoxes = [[]];
            if (saveData.pcBoxes.length === 0) saveData.pcBoxes = [[]];
            saveData.pcBoxes[0].push(newMon);
          } else {
            saveData.myTeam.push(newMon);
          }
        }
        await saveUserData(tgId, saveData);
        res.json({ status: 'ok' });
        break;
      }

      case 'broadcast': {
        const msg = val || 'announcement';
        const io = (req.app as any).get('io');
        if (io) {
          io.emit('admin_announcement', { message: msg, timestamp: Date.now() });
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
        const saveData: any = parseSaveStrict(row.save_data, row.id)
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

        // Редактор собирает объект из textarea и четырёх полей формы. Если
        // textarea пуста или не содержит myTeam, результат — пять ключей без
        // покемонов, и такой сейв затирал прогресс игрока целиком. Поэтому
        // сверяем с тем, что уже лежит в базе, и отказываем при подозрении на
        // потерю. Намеренное обнуление — только через wipe или reset.
        const before = parseSaveStrict(
          (await db.select({ save_data: users.save_data })
            .from(users).where(eq(users.tg_id, tgId)).limit(1))[0]?.save_data,
          null
        );
        const beforeCount = countSavePokemon(before);
        const afterCount = countSavePokemon(editorData);
        if (afterCount === 0 && beforeCount > 0) {
          console.warn(
            `[admin] edit_trainer отклонён: tg ${tgId}, в базе ${beforeCount} покемонов, в редакторе 0.`,
          );
          res.status(422).json({
            status: 'error',
            error: 'Refusing to wipe a non-empty save',
            storedPokemon: beforeCount,
            hint: 'Load the trainer first, or use db:wipe for a deliberate reset',
          });
          return;
        }

        await saveUserData(tgId, editorData, 'admin_edit_trainer');
        const nicknameUpdate = editorData.trainerNickname || '';
        const locationUpdate = editorData.currentLocationId || 'goldenrodCity';
        await db.update(users).set({
          nickname: nicknameUpdate,
          location_id: locationUpdate,
        }).where(eq(users.tg_id, tgId));
        res.json({ status: 'ok' });
        break;
      }

      // ── save_history: список и восстановление копий ──
      // Бэкап бесполезен, если его нельзя вернуть. save_history наполняется
      // автоматически перед каждой перезаписью save_data.
      case 'save_history': {
        if (!tgId) {
          res.status(400).json({ status: 'error', error: 'user required' });
          return;
        }
        const target = (await db.select({ id: users.id })
          .from(users).where(eq(users.tg_id, tgId)).limit(1))[0];
        if (!target) {
          res.status(404).json({ status: 'error', error: 'User not found' });
          return;
        }
        const copies = (await db.select({
          id: saveHistory.id,
          save_version: saveHistory.save_version,
          reason: saveHistory.reason,
          created_at: saveHistory.created_at,
          save_data: saveHistory.save_data,
        })
          .from(saveHistory)
          .where(eq(saveHistory.user_id, target.id))
          .orderBy(desc(saveHistory.id))
          .limit(20));

        const currentRaw = (await db.select({ save_data: users.save_data })
          .from(users).where(eq(users.id, target.id)).limit(1))[0]?.save_data;
        // Текущий сейв может быть битым — и это ровно тот случай, когда список
        // копий нужнее всего. Поэтому здесь не strict: считаем что в нём есть,
        // и показываем пометку вместо того, чтобы упасть с ошибкой.
        let currentPokemon = 0;
        let currentBroken = false;
        try {
          currentPokemon = countSavePokemon(parseSaveStrict(currentRaw, target.id));
        } catch {
          currentBroken = true;
        }
        res.json({
          status: 'ok',
          currentPokemon,
          currentBroken,
          copies: copies.map((c: any) => ({
            id: c.id,
            saveVersion: c.save_version,
            reason: c.reason,
            createdAt: c.created_at,
            // Считаем через parseSaveStrict, чтобы битая копия не молча
            // показывалась как пустая.
            pokemon: (() => {
              try { return countSavePokemon(parseSaveStrict(c.save_data, target.id)); }
              catch { return -1; }
            })(),
          })),
        });
        break;
      }

      // ── restore_save: вернуть сохранение из save_history ──
      case 'restore_save': {
        if (!tgId || !val) {
          res.status(400).json({ status: 'error', error: 'user and historyId required' });
          return;
        }
        const historyId = parseInt(String(val), 10);
        if (!Number.isInteger(historyId)) {
          res.status(400).json({ status: 'error', error: 'historyId must be an integer' });
          return;
        }
        const target = (await db.select({ id: users.id })
          .from(users).where(eq(users.tg_id, tgId)).limit(1))[0];
        if (!target) {
          res.status(404).json({ status: 'error', error: 'User not found' });
          return;
        }
        const copy = (await db.select()
          .from(saveHistory)
          .where(and(eq(saveHistory.id, historyId), eq(saveHistory.user_id, target.id)))
          .limit(1))[0];
        if (!copy) {
          res.status(404).json({ status: 'error', error: 'History entry not found for this user' });
          return;
        }

        const restored = parseSaveStrict(copy.save_data, target.id);
        const pokemon = countSavePokemon(restored);

        // Тот же анти-затирающий барьер, что и в edit_trainer: восстановление
        // не должно молча обнулить прогресс игрока. История наполняется при
        // откатах, поэтому среди копий легко найти пустую, и её восстановление
        // выглядело бы как успех.
        const currentRaw = (await db.select({ save_data: users.save_data })
          .from(users).where(eq(users.id, target.id)).limit(1))[0]?.save_data;
        let currentCount = 0;
        try { currentCount = countSavePokemon(parseSaveStrict(currentRaw, target.id)); } catch { /* битый */ }
        if (pokemon === 0 && currentCount > 0) {
          res.status(422).json({
            status: 'error',
            error: 'Refusing to restore a copy with no pokemon over existing progress',
            storedPokemon: currentCount,
            hint: 'pick another history id',
          });
          return;
        }

        // Текущий сейв тоже сохраняем в историю, чтобы восстановление
        // можно было отменить.
        await saveUserData(tgId, restored, 'restore_rollback');
        console.warn(`[admin] restore_save: tg ${tgId}, копия ${historyId}, покемонов ${pokemon}`);
        res.json({ status: 'ok', restoredPokemon: pokemon });
        break;
      }

      default:
        res.status(400).json({ status: 'error', error: `Unknown cmd: ${cmd}` });
    }
  } catch (err: any) {
    console.error('[admin/api-post]', err);
    res.json({ status: 'error', error: 'Internal admin error' });
  }
});

export default router;
