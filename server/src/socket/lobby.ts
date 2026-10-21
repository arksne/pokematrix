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

let sweepTimer: NodeJS.Timeout | null = null;

/**
 * Чистка онлайна по живости сокетов. disconnect не всегда доходит до
 * сервера (обрыв сети, замороженный WebView, падение клиента): запись
 * висела в карте вечно, и офлайн-тренеры светились зелёным. Раз в минуту
 * выкидываем записи с мёртвым сокетом и переиздаём список, если он изменился.
 * Живые сокеты не трогаем — старые клиенты без пингов не страдают.
 */
function sweepPresence(io: Server) {
  let changed = false;
  for (const [sockId] of onlinePlayers) {
    const s = io.sockets.sockets.get(sockId);
    if (!s?.connected) {
      onlinePlayers.delete(sockId);
      changed = true;
    }
  }
  if (changed) io.emit('online_players', Array.from(onlinePlayers.values()));
}

/**
 * Инициализация lobby-событий для сокета.
 */
export function initLobby(io: Server, socket: Socket) {
  if (!sweepTimer) {
    sweepTimer = setInterval(() => sweepPresence(io), 60_000);
    sweepTimer.unref?.();
  }
  const userId = socket.data.user?.tgId;
  const username = socket.data.user?.username || socket.data.user?.firstName || 'Тренер';

  // ── join_lobby ──
  socket.on('join_lobby', async (_data: any) => {
    // ⚠️ ВАЖНО: Игнорируем userId от клиента — используем только из JWT
    const name = username;
    const id = userId;

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
