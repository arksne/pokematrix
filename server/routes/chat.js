import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDB } from '../db.js';
import { getIO } from '../socket.js';

const router = Router();

// Claude AI bot helpers
const CLAUDE_ID = 0;
const CLAUDE_USERNAME = 'Claude_AI';
const CLAUDE_NAME = 'Claude AI';

async function sendClaudeMessage(text, io, db) {
  const msg = {
    id: Date.now(),
    user_id: CLAUDE_ID,
    username: CLAUDE_USERNAME,
    first_name: CLAUDE_NAME,
    text,
    created_at: new Date().toISOString()
  };
  // Store in DB
  try {
    await db.run('INSERT INTO chat_messages (user_id, username, first_name, text) VALUES (?, ?, ?, ?)',
      CLAUDE_ID, CLAUDE_USERNAME, CLAUDE_NAME, text);
  } catch(e) { /* ignore */ }
  // Broadcast
  if (io) io.emit('chat_message', msg);
  return msg;
}

async function claudeAutoReply(userText, io, db) {
  const t = userText.toLowerCase();
  let reply = null;

  if (t.includes('привет') || t.includes('здаров') || t.includes('ку') || t.includes('hello') || t.includes('hi')) {
    reply = 'Привет, тренер! 🤖 Я Claude — ИИ-помощник. Спроси меня о покемонах, битвах или игре!';
  } else if (t.includes('как дела') || t.includes('как ты')) {
    reply = 'Я в порядке! Мониторю сервер, смотрю за игроками. Всё работает стабильно!';
  } else if (t.includes('спасибо') || t.includes('спс') || t.includes('thx')) {
    reply = 'Всегда пожалуйста! Обращайся в любое время 🫡';
  } else if (t.includes('claude') || t.includes('клод') || t.includes('помощь') || t.includes('хелп') || t.includes('help')) {
    reply = 'Я здесь! Чем могу помочь? Могу рассказать о: локациях, гим-лидерах, покемонах, эволюциях, тренировках, PvP, обменах.';
  } else if (t.includes('где') && (t.includes('найти') || t.includes('покемон') || t.includes('легендар'))) {
    reply = 'Легендарные покемоны водятся в особых местах: Острова Морской Пены (Артикуно), Сафари Зона (редкие), Плато Индиго (после 8 значков).';
  } else if (t.includes('эволюц') || t.includes('эволюция')) {
    reply = 'Эволюция происходит через: уровень (конфеты), камни эволюции (в магазине), тренировку. Камни: Огненный, Водный, Лиственный, Громовой, Лунный, Солнечный.';
  } else if (t.includes('гим') || t.includes('лидер') || t.includes('значок')) {
    reply = '8 гим-лидеров Канто: Брок (Пьютер), Мисти (Церулин), Сёрдж (Вермилион), Эрика (Селадон), Сабрина (Шаффран), Кога (Фуксия), Блейн (Синнабар), Джованни (Виридиан). И 8 в Джото!';
  } else if (t.includes('pvp') || t.includes('битва') || t.includes('бой')) {
    reply = 'PvP бои доступны в Обменнике (Покецентр). Нажми ⚔ рядом с именем тренера чтобы вызвать на бой!';
  } else if (t.includes('обмен') || t.includes('трейд') || t.includes('trade')) {
    reply = 'Обмен доступен в Покецентре → Обменник. Можно обменивать покемонов и предметы. Односторонний обмен тоже работает!';

  // Admin commands
  } else if (t.startsWith('!items') || t.startsWith('!предметы')) {
    const targetUser = await db.get('SELECT id FROM users WHERE username = ?', t.split(' ')[1] || '');
    reply = 'Укажи username: !items DjafarAdjarov';
  } else if (t.startsWith('!status') || t.startsWith('!статус')) {
    const users = await db.all('SELECT COUNT(*) as c FROM users');
    const saves = await db.all('SELECT COUNT(*) as c FROM game_saves');
    const msgs = await db.all('SELECT COUNT(*) as c FROM chat_messages');
    reply = `📊 Сервер: ${users[0].c} игроков, ${saves[0].c} сохранений, ${msgs[0].c} сообщений. Онлайн: работает!`;
  }

  if (reply) {
    setTimeout(() => sendClaudeMessage(reply, io, db), 500 + Math.random() * 1000);
  }
}

// Send a chat message (auth required)
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 chars)' });
    }

    const db = getDB();

    // Get user info
    const user = await db.get('SELECT username, first_name FROM users WHERE id = ?', req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await db.run(
      `INSERT INTO chat_messages (user_id, username, first_name, text) VALUES (?, ?, ?, ?)`,
      req.userId,
      user.username || '',
      user.first_name || '',
      text.trim()
    );

    // Broadcast to all connected clients via Socket.IO
    const msg = {
      id: result.lastID,
      user_id: req.userId,
      username: user.username || '',
      first_name: user.first_name || '',
      text: text.trim(),
      created_at: new Date().toISOString()
    };
    const io = getIO();
    if (io) io.emit('chat_message', msg);

    // Claude AI auto-reply
    claudeAutoReply(text.trim(), io, db);

    res.json({ success: true });
  } catch (err) {
    console.error('Chat send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get chat messages (public, no auth required for reading)
router.get('/messages', async (req, res) => {
  try {
    const db = getDB();
    const since = req.query.since;

    let messages;
    if (since) {
      messages = await db.all(
        `SELECT id, user_id, username, first_name, text, created_at
         FROM chat_messages
         WHERE created_at > ?
         ORDER BY created_at ASC
         LIMIT 50`,
        since
      );
    } else {
      messages = await db.all(
        `SELECT id, user_id, username, first_name, text, created_at
         FROM chat_messages
         ORDER BY created_at DESC
         LIMIT 50`
      );
      messages.reverse();
    }

    res.json({ messages });
  } catch (err) {
    console.error('Chat messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bot endpoint — Claude can send messages
router.post('/bot', async (req, res) => {
  const { text, token } = req.body;
  if (token !== 'claude-admin-2026') return res.status(401).json({ error: 'Unauthorized' });
  if (!text) return res.status(400).json({ error: 'Text required' });
  const db = getDB();
  const io = getIO();
  const msg = await sendClaudeMessage(text, io, db);
  res.json({ success: true, msg });
});

export { sendClaudeMessage, CLAUDE_USERNAME, CLAUDE_NAME, CLAUDE_ID };
export default router;
