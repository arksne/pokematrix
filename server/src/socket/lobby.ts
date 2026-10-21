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
  lastPing: number; // последний признак жизни (join_lobby / lobby_ping)
}

// Карта подключённых игроков
const onlinePlayers = new Map<string, OnlinePlayer>();

let sweepTimer: NodeJS.Timeout | null = null;

/**
 * Чистка онлайна. Два условия удаления: мёртвый сокет ИЛИ тишина дольше
 * 150с (протухший зомби: disconnect потерян, а TCP ещё кажется живым —
 * именно такие дубли висели в списке рядом с живым сокетом, и награды
 * уходили в мёртвый). Живые сокеты со свежими пингами не трогаем.
 */
function sweepPresence(io: Server) {
  const now = Date.now();
  let changed = false;
  for (const [sockId, p] of onlinePlayers) {
    const s = io.sockets.sockets.get(sockId);
    if (!s?.connected || now - (p.lastPing || 0) > 150_000) {
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
      lastPing: Date.now(),
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

  // ── lobby_ping ──
  // Признак жизни каждые 30с: без него нельзя отличить живой сокет от зомби
  // (disconnect потерян, TCP ещё дышит). Зомби-двойники уводили награды и
  // вызовы в мёртвый сокет. Sweep чистит тишину старше 150с.
  socket.on('lobby_ping', () => {
    const p = onlinePlayers.get(socket.id);
    if (p) p.lastPing = Date.now();
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
 * При дублях (реконнект, две вкладки) — САМЫЙ СВЕЖИЙ: награды и вызовы
 * должны идти в живой сокет, а не в зомби, иначе клиент не примет версию
 * сеттла и получит 409 + тост «более новая версия» в конце боя.
 */
export function getOnlinePlayerByUserId(userId: number): OnlinePlayer | undefined {
  return getOnlinePlayersByUserId(userId)[0];
}

/** Все сокеты юзера, свежие первыми (для перебора живых). */
export function getOnlinePlayersByUserId(userId: number): OnlinePlayer[] {
  return [...onlinePlayers.values()]
    .filter((p) => p.userId === userId)
    .sort((a, b) => (b.lastPing || 0) - (a.lastPing || 0));
}
