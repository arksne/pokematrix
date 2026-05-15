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

    // Require valid Telegram initData for all access
    if (!isRealInitData) {
      return res.status(403).json({ error: 'Telegram authentication required' });
    }
    if (!botToken) {
      console.error('BOT_TOKEN is not set in environment variables!');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    tgUser = verifyTelegramInitData(initData, botToken);
    if (!tgUser) {
      return res.status(403).json({ error: 'Invalid Telegram init data' });
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
      user = { id: result.lastID, telegram_id: telegramId, username: tgUser.username || '', registered: 0 };
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
        username: user.username,
        registered: user.registered || 0,
        nickname: user.nickname || '',
        avatar: user.avatar || '👤',
        starter_pokemon: user.starter_pokemon || ''
      }
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register / complete profile
import { authMiddleware } from '../middleware/auth.js';
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const { nickname, avatar, starterPokemon } = req.body;
    const db = getDB();
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.run(
      `UPDATE users SET nickname = ?, avatar = ?, starter_pokemon = ?, registered = 1, registered_at = datetime('now')
       WHERE id = ?`,
      nickname || user.first_name || '',
      avatar || '👤',
      starterPokemon || '',
      req.userId
    );

    res.json({ success: true, user: { ...user, nickname: nickname || user.first_name, avatar: avatar || '👤', registered: 1 } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
