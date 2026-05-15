import { Router } from 'express';
import { verifyTelegramInitData, parseTestUser } from '../auth.js';
import { getDB } from '../db.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

router.post('/tg', async (req, res) => {
  try {
    const { initData } = req.body;
    const botToken = process.env.BOT_TOKEN;
    const isDevMode = !botToken;
    const isRealInitData = initData && initData !== 'test';
    let tgUser;

    if (isRealInitData) {
      // Real Telegram initData received
      if (!botToken) {
        console.error('BOT_TOKEN is not set in environment variables!');
        return res.status(500).json({ error: 'Server misconfiguration: BOT_TOKEN not set' });
      }
      tgUser = verifyTelegramInitData(initData, botToken);
      if (!tgUser) {
        return res.status(403).json({ error: 'Invalid Telegram init data' });
      }
    } else {
      // No real initData — dev/test mode only
      if (!isDevMode) {
        // BOT_TOKEN is set but no initData — reject
        return res.status(403).json({ error: 'Missing Telegram init data' });
      }
      console.warn('⚠️  Using test user (dev mode — no BOT_TOKEN set)');
      tgUser = parseTestUser();
    }

    const db = getDB();
    const telegramId = String(tgUser.id);

    let user = await db.get('SELECT * FROM users WHERE telegram_id = ?', telegramId);

    if (!user) {
      const result = await db.run(
        'INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)',
        telegramId,
        tgUser.username || '',
        tgUser.first_name || ''
      );
      user = { id: result.lastID, telegram_id: telegramId, username: tgUser.username || '' };
    } else {
      await db.run(
        'UPDATE users SET username = ?, first_name = ? WHERE id = ?',
        tgUser.username || '',
        tgUser.first_name || '',
        user.id
      );
    }

    const token = generateToken(user.id, telegramId);

    res.json({
      token,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username
      }
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
