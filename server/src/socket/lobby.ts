/**
 * Socket.IO Lobby handler.
 * Управляет списком онлайн-игроков и рассылает обновления.
 */
import type { Server, Socket } from 'socket.io';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

interface OnlinePlayer {
  id: string;       // socket.id
  socketId: string; // то же, для совместимости
  username: string;
  userId: number;   // Telegram user ID
}

// Карта подключённых игроков
const onlinePlayers = new Map<string, OnlinePlayer>();

/**
 * Инициализация lobby-событий для сокета.
 */
export function initLobby(io: Server, socket: Socket) {
  const userId = socket.data.user?.tgId;
  const username = socket.data.user?.username || socket.data.user?.firstName || 'Тренер';

  // ── join_lobby ──
  socket.on('join_lobby', async (data: { username?: string; userId?: number }) => {
    const name = data?.username || username;
    const id = data?.userId || userId;

    onlinePlayers.set(socket.id, {
      id: socket.id,
      socketId: socket.id,
      username: name,
      userId: id,
    });

    // Уведомить всех
    io.emit('online_players', Array.from(onlinePlayers.values()));

    // Обновить last_seen в БД
    try {
      const db = getDb();
      await db.update(users).set({
        last_seen: new Date().toISOString(),
      }).where(eq(users.tg_id, id));
    } catch {}
  });

  // ── disconnect ──
  socket.on('disconnect', () => {
    onlinePlayers.delete(socket.id);
    io.emit('online_players', Array.from(onlinePlayers.values()));
  });
}

/**
 * Получить OnlinePlayer по socket.id.
 */
export function getOnlinePlayer(socketId: string): OnlinePlayer | undefined {
  return onlinePlayers.get(socketId);
}

/**
 * Получить OnlinePlayer по Telegram user ID.
 */
export function getOnlinePlayerByUserId(userId: number): OnlinePlayer | undefined {
  for (const player of onlinePlayers.values()) {
    if (player.userId === userId) return player;
  }
  return undefined;
}
