/**
 * Profile routes:
 *   POST /profile/location          — обновить локацию
 *   GET  /profile/trainers          — список тренеров на локации
 *   GET  /profile/trainers/all      — все тренеры
 *   GET  /profile/:userId           — профиль конкретного тренера
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// ── POST /profile/location ───────────────────────────────────
// Обновляет текущую локацию игрока.
// Через Socket.IO рассылает location_update всем на той же локации.
router.post('/location', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { locationId, region } = req.body;
    if (!locationId) {
      res.status(400).json({ error: 'locationId required' });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();
    await db.update(users).set({
      location_id: locationId,
      region: region || null,
      last_seen: now,
    }).where(eq(users.id, req.user!.userId));

    // Socket.IO: уведомить всех (клиент фильтрует по своей локации)
    const io = (req.app as any).get('io');
    if (io) {
      const user = (await db.select()
        .from(users)
        .where(eq(users.id, req.user!.userId))
        .limit(1))[0];

      io.emit('location_update', {
        locationId,
        userId: user.tg_id,
        firstName: user.first_name || '',
        username: user.username || '',
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[profile/location]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /profile/trainers?locationId=... ─────────────────────
// Список тренеров на конкретной локации.
router.get('/trainers', async (req: Request, res: Response) => {
  try {
    const locationId = req.query.locationId as string;
    if (!locationId) {
      res.status(400).json({ error: 'locationId query param required' });
      return;
    }

    const db = getDb();
    const trainers = await db.select({
      id: users.tg_id,
      first_name: users.first_name,
      username: users.username,
    }).from(users)
      .where(eq(users.location_id, locationId))
      .limit(20);

    res.json({ trainers });
  } catch (err: any) {
    console.error('[profile/trainers]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /profile/trainers/all ────────────────────────────────
// Все зарегистрированные тренеры.
router.get('/trainers/all', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const allUsers = await db.select({
      id: users.tg_id,
      nickname: users.nickname,
      first_name: users.first_name,
      username: users.username,
      avatar: users.avatar,
      badges: users.badges_count,
      teamSize: users.pokemon_count,
      region: users.region,
      lastSeen: users.last_seen,
      registered: users.registered,
    }).from(users).orderBy(users.last_seen);

    res.json({ users: allUsers });
  } catch (err: any) {
    console.error('[profile/trainers/all]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /profile/:userId ─────────────────────────────────────
// Профиль конкретного тренера по Telegram ID.
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const tgId = parseInt(String(req.params.userId), 10);
    if (isNaN(tgId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const db = getDb();
    const user = (await db.select()
      .from(users)
      .where(eq(users.tg_id, tgId))
      .limit(1))[0];

    if (!user) {
      res.status(404).json({ error: 'Trainer not found' });
      return;
    }

    // Парсим save_data чтобы получить команду
    let saveData: any = {};
    try { saveData = JSON.parse(user.save_data || '{}'); } catch {}

    const team = Array.isArray(saveData.myTeam)
      ? saveData.myTeam.slice(0, 6).map((mon: any) => ({
          sprite: mon.sprite || '',
          name: mon.apiData?.name || '???',
          nickname: mon.nickname || '',
          level: (mon.baseLevel || 1) + (mon.candiesEaten || 0),
        }))
      : [];

    res.json({
      profile: {
        id: user.tg_id,
        first_name: user.first_name || '',
        username: user.username || '',
        badges: user.badges_count,
        team,
      },
    });
  } catch (err: any) {
    console.error('[profile/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
