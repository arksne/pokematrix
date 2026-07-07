/**
 * Chat routes:
 *   GET  /chat/messages   — загрузка истории сообщений
 *   POST /chat/send       — отправка сообщения
 */
import { Router, Request, Response } from 'express';
import { gt, asc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { chatMessages, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';

const router = Router();

// ── GET /chat/messages ───────────────────────────────────────
// Без since — все сообщения. С since — только новые.
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const since = req.query.since as string | undefined;

    const messages = await db.select({
      id: chatMessages.id,
      user_id: chatMessages.user_id,
      text: chatMessages.text,
      created_at: chatMessages.created_at,
    }).from(chatMessages)
      .where(since ? gt(chatMessages.created_at, since) : undefined as any)
      .orderBy(asc(chatMessages.id))
      .limit(50);

    // Обогащаем сообщения именами пользователей
    const enriched = await Promise.all(messages.map(async (msg) => {
      const user = (await db.select()
        .from(users)
        .where(eq(users.tg_id, msg.user_id))
        .limit(1))[0];
      return {
        ...msg,
        first_name: user?.first_name || '',
        username: user?.username || '',
      };
    }));

    res.json({ messages: enriched });
  } catch (err: any) {
    console.error('[chat/messages]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /chat/send ─────────────────────────────────────────
router.post('/send', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();
    const result = await db.insert(chatMessages).values({
      user_id: req.user!.tgId,
      text: text.trim().slice(0, 500),
      created_at: now,
    }).returning();

    const message = result[0];

    // Реальное время через Socket.IO (если сокет подключён)
    const io = (req.app as any).get('io');
    if (io) {
      const user = (await db.select()
        .from(users)
        .where(eq(users.id, req.user!.userId))
        .limit(1))[0];

      io.emit('chat_message', {
        id: message.id,
        user_id: message.user_id,
        text: message.text,
        first_name: user?.first_name || '',
        username: user?.username || '',
        created_at: message.created_at,
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[chat/send]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
