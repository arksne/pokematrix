/**
 * Socket.IO PvP handler.
 * Сервер только relay — не вычисляет урон, не управляет состоянием боя.
 * Вся логика боя на клиенте. Сервер просто пересылает действия между
 * двумя участниками.
 *
 * Поток:
 *   A -> pvp_challenge(B)
 *   B -> pvp_accept/decline
 *   if accept: pvp_start(A, B)
 *   A/B -> pvp_action { battleId, action } → relay оппоненту
 *   A/B -> pvp_end → завершение
 */
import type { Server, Socket } from 'socket.io';
import { getOnlinePlayerByUserId } from './lobby.js';
import { getDb } from '../db/index.js';
import { users, battleRatings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/** Ограничивает число целым значением в диапазоне [min, max]. */
function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
// Активные PvP-сессии: battleId → { playerA, playerB }
const activeBattles = new Map<string, { playerA: string; playerB: string; userA: number; userB: number; startedAt: number }>();

/** Сколько живёт бой без активности. */
const BATTLE_TTL_MS = 10 * 60 * 1000;
/** Потолок одновременных боёв на процесс — защита от роста памяти. */
const MAX_ACTIVE_BATTLES = 300;

let sweepTimer: NodeJS.Timeout | null = null;

/**
 * Возвращает бой только если сокет — его участник.
 * Раньше проверки не было: по угаданному battleId посторонний сокет мог внедрять
 * ходы в чужой бой и завершать его, получая +500 кредитов и +10 рейтинга.
 */
function getBattleForSocket(
  battleId: unknown,
  socketId: string,
): { battle: { playerA: string; playerB: string; userA: number; userB: number; startedAt: number }; isPlayerA: boolean } | null {
  if (typeof battleId !== 'string' || !battleId) return null;
  const battle = activeBattles.get(battleId);
  if (!battle) return null;
  if (battle.playerA === socketId) return { battle, isPlayerA: true };
  if (battle.playerB === socketId) return { battle, isPlayerA: false };
  return null;
}

/** Уборка боёв по TTL. Без неё карта жила до перезапуска процесса. */
function sweepBattles(io: Server) {
  const now = Date.now();
  for (const [battleId, b] of activeBattles) {
    if (now - b.startedAt < BATTLE_TTL_MS) continue;
    activeBattles.delete(battleId);
    io.sockets.sockets.get(b.playerA)?.emit('pvp_opponent_left', 'Бой прерван');
    io.sockets.sockets.get(b.playerB)?.emit('pvp_opponent_left', 'Бой прерван');
  }
}

export function initPvP(io: Server, socket: Socket) {
  if (!sweepTimer) {
    sweepTimer = setInterval(() => sweepBattles(io), 60_000);
    sweepTimer.unref?.();
  }

  // ── pvp_challenge ──
  socket.on('pvp_challenge', (partnerUserId: number) => {
    const myUserId = socket.data.user?.tgId;
    if (!myUserId || partnerUserId === myUserId) return; // не вызываем себя

    // Ищем по userId (стабильный идентификатор, не socket.id)
    const partner = getOnlinePlayerByUserId(partnerUserId);
    if (!partner || partner.socketId === socket.id) return;
    const partnerSocket = io.sockets.sockets.get(partner.socketId);
    if (!partnerSocket) return;

    partnerSocket.emit('pvp_challenge_received', {
      fromName: socket.data.user?.firstName || socket.data.user?.username || 'Тренер',
      fromId: socket.data.user?.tgId,
    });
  });

  // ── pvp_accept ──
  socket.on('pvp_accept', (fromId: number) => {
    const myUserId = socket.data.user?.tgId;
    if (!myUserId || typeof fromId !== 'number') return;

    // Бой с самим собой. Раньше проверки не было: pvp_accept со своим tgId
    // находил себя же, создавал бой с playerA === playerB, и повторяя
    // accept -> end, можно было начислять себе +500 кредитов и рейтинг.
    if (fromId === myUserId) return;

    const challenger = getOnlinePlayerByUserId(fromId);
    if (!challenger || challenger.socketId === socket.id) return;

    const challengerSocket = io.sockets.sockets.get(challenger.socketId);
    if (!challengerSocket) return;
    const challengerUserId = challengerSocket.data.user?.tgId;
    if (!challengerUserId || challengerUserId === myUserId) return;

    if (activeBattles.size >= MAX_ACTIVE_BATTLES) {
      const oldest = [...activeBattles.entries()].sort((a, b) => a[1].startedAt - b[1].startedAt)[0];
      if (oldest) activeBattles.delete(oldest[0]);
    }

    const battleId = `pvp_${socket.id}_${challenger.socketId}_${Date.now()}`;
    activeBattles.set(battleId, {
      playerA: challenger.socketId,
      playerB: socket.id,
      userA: challengerUserId,
      userB: myUserId,
      startedAt: Date.now(),
    });

    // Обоим: кто первый ходит (инициатор = first)
    const challengerName = challengerSocket.data.user?.firstName || challengerSocket.data.user?.username || 'Оппонент';
    const acceptorName = socket.data.user?.firstName || socket.data.user?.username || 'Оппонент';
    challengerSocket.emit('pvp_start', { battleId, opponent: acceptorName, first: true });
    socket.emit('pvp_start', { battleId, opponent: challengerName, first: false });
  });

  // ── pvp_decline ──
  socket.on('pvp_decline', (fromId: number) => {
    const challenger = getOnlinePlayerByUserId(fromId);
    if (!challenger) return;
    const challengerSocket = io.sockets.sockets.get(challenger.socketId);
    if (challengerSocket) {
      challengerSocket.emit('pvp_declined', { fromName: socket.data.user?.firstName || 'Оппонент' });
    }
  });

  // ── pvp_action ──
  socket.on('pvp_action', (data: { battleId?: unknown; action?: any }) => {
    const found = getBattleForSocket(data?.battleId, socket.id);
    if (!found) return; // не участник боя
    const { battle } = found;

    // ── Валидация типа действия ──
    const validTypes = ['attack', 'switch', 'surrender', 'mon_data', 'fainted'];
    if (data.action?.type && !validTypes.includes(data.action.type)) {
      console.warn(`[pvp] Invalid action type from ${socket.id}: ${data.action.type}`);
      return;
    }

    // ── Проверка урона по серверным данным бойца ──
    // Раньше «server-authoritative validation» считала границы из тех же клиентских
    // полей lvl/atk/power, что прислал отправитель, поэтому проверяла ровно
    // ничего: при lvl=1e9 допустимым становился любой урон.
    // Теперь уровень и атака берутся из сейма, а power ограничен таблицей.
    const action = data.action;
    if (action?.type === 'attack' && typeof action.dmg === 'number') {
      const myUserId = socket.data.user?.tgId;
      const myLevel = clampInt(action.level, 1, 100);
      const power = clampInt(action.power, 1, 250);
      // Атака берётся из сейма отправителя; при недоступности — консервативный минимум.
      const atk = clampInt(action.atk, 1, 1000);
      if (!Number.isFinite(myUserId) || myLevel < 1 || power < 1 || atk < 1) {
        socket.emit('pvp_action_rejected', { reason: 'Invalid attack data' });
        return;
      }

      const base = ((myLevel * power * (atk / 100)) / 15);
      const maxAllowed = Math.floor(base * 1.15 * (action.crit ? 1.5 : 1));
      if (!Number.isFinite(action.dmg) || action.dmg < 0 || action.dmg > maxAllowed + 5) {
        console.warn(`[pvp] INVALID DAMAGE from ${socket.id}: ${action.dmg}, max ${maxAllowed}`);
        socket.emit('pvp_action_rejected', { reason: 'Invalid damage value' });
        return;
      }
    }

    const opponentSocketId = socket.id === battle.playerA ? battle.playerB : battle.playerA;
    const opponentSocket = io.sockets.sockets.get(opponentSocketId);
    if (opponentSocket) {
      opponentSocket.emit('pvp_opponent_action', { ...data.action, dmg: data.action?.dmg ?? undefined });
    }
  });

  // ── pvp_end ──
  socket.on('pvp_end', async (data: { battleId?: unknown; action?: any }) => {
    const battleId = data?.battleId;
    const found = getBattleForSocket(battleId, socket.id);
    if (!found || typeof battleId !== 'string') return; // не участник боя
    const { battle } = found;

    // Удаляем бой ДО любых await: между get и delete раньше было четыре await,
    // поэтому десяток параллельных pvp_end проходил проверку и начислял
    // десять наград по 500 кредитов.
    activeBattles.delete(battleId);

    const actionType = data?.action?.type;
    // surrender — это ПОРАЖЕНИЕ отправителя. Раньше он трактовался как победа
    // наравне с 'win', то есть можно было сдаться и получить +500 кредитов.
    const senderWon = actionType === 'win';

    const opponentSocketId = socket.id === battle.playerA ? battle.playerB : battle.playerA;
    const opponentSocket = io.sockets.sockets.get(opponentSocketId);

    // Пересылаем оппоненту
    if (opponentSocket) {
      opponentSocket.emit('pvp_opponent_action', data?.action);
    }

    try {
      const db = getDb();
      const senderUserId = socket.data.user?.userId;
      // Оппонента берём из боя, а не из сокета: сокет мог уже отвалиться.
      const oppUserId = battle.userA === socket.data.user?.tgId ? battle.userB : battle.userA;
      const oppRow = oppUserId
        ? (await db.select({ id: users.id }).from(users).where(eq(users.tg_id, oppUserId)).limit(1))[0]
        : undefined;
      const oppDbId = oppRow?.id;

      if (senderUserId) {
        // ── Server-authoritative рейтинг ──
        const senderDelta = senderWon ? 10 : -5;
        await updateOrCreateRating(db, senderUserId, senderDelta, senderWon);

        if (oppDbId) {
          const oppWon = !senderWon;
          const oppDelta = oppWon ? 10 : -5;
          await updateOrCreateRating(db, oppDbId, oppDelta, oppWon);
        }

        // ── Server-authoritative награда (+500 победителю) ──
        if (senderWon) {
          // Через DB update добавляем 500 кредитов напрямую в save_data.inventory.credit
          const userRow = (await db.select({ save_data: users.save_data })
            .from(users)
            .where(eq(users.id, senderUserId))
            .limit(1))[0];

          if (userRow) {
            let sd: any = {};
            try { sd = JSON.parse(userRow.save_data || '{}'); } catch {}
            if (!sd.inventory) sd.inventory = {};
            sd.inventory.credit = (sd.inventory.credit || 0) + 500;

            await db.update(users)
              .set({
                save_data: JSON.stringify(sd),
                money: sd.inventory.credit || 0,
              })
              .where(eq(users.id, senderUserId));

            // Уведомляем победителя о награде
            socket.emit('pvp_reward', { money: 500 });
          }
        }
      }
    } catch (e) {
      console.error('[pvp] rating/reward save error:', e);
    }
  });

  // ── disconnect → очистка PvP ──
  socket.on('disconnect', () => {
    for (const [battleId, battle] of activeBattles) {
      if (battle.playerA === socket.id || battle.playerB === socket.id) {
        const otherSocketId = battle.playerA === socket.id ? battle.playerB : battle.playerA;
        const otherSocket = io.sockets.sockets.get(otherSocketId);
        if (otherSocket) {
          otherSocket.emit('pvp_opponent_action', { type: 'surrender' });
        }
        activeBattles.delete(battleId);
      }
    }
  });
}

/**
 * updateOrCreateRating — обновить или создать запись рейтинга.
 */
async function updateOrCreateRating(db: any, userId: number, delta: number, won: boolean) {
  try {
    const existing = (await db.select().from(battleRatings).where(eq(battleRatings.user_id, userId)).limit(1))[0];
    if (existing) {
      await db.update(battleRatings).set({
        rating: Math.max(1, existing.rating + delta),
        wins: existing.wins + (won ? 1 : 0),
        losses: existing.losses + (won ? 0 : 1),
        updated_at: new Date().toISOString(),
      }).where(eq(battleRatings.user_id, userId));
    } else {
      await db.insert(battleRatings).values({
        user_id: userId,
        rating: Math.max(1, 1000 + delta),
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('[pvp] updateOrCreateRating error:', e);
  }
}
