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

// Активные PvP-сессии: battleId → { playerA, playerB }
const activeBattles = new Map<string, { playerA: string; playerB: string }>();

export function initPvP(io: Server, socket: Socket) {
  // ── pvp_challenge ──
  socket.on('pvp_challenge', (partnerUserId: number) => {
    // Ищем по userId (стабильный идентификатор, не socket.id)
    const partner = getOnlinePlayerByUserId(partnerUserId);
    if (!partner) return;
    const partnerSocket = io.sockets.sockets.get(partner.socketId);
    if (!partnerSocket) return;

    partnerSocket.emit('pvp_challenge_received', {
      fromName: socket.data.user?.firstName || socket.data.user?.username || 'Тренер',
      fromId: socket.data.user?.tgId,
    });
  });

  // ── pvp_accept ──
  socket.on('pvp_accept', (fromId: number) => {
    const challenger = getOnlinePlayerByUserId(fromId);
    if (!challenger) return;

    const challengerSocket = io.sockets.sockets.get(challenger.socketId);
    if (!challengerSocket) return;

    const battleId = `pvp_${socket.id}_${challenger.socketId}_${Date.now()}`;
    activeBattles.set(battleId, { playerA: challenger.socketId, playerB: socket.id });

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
  socket.on('pvp_action', (data: { battleId: string; action: any }) => {
    const battle = activeBattles.get(data.battleId);
    if (!battle) return;

    // ── Server-authoritative damage validation ──
    if (data.action?.type === 'attack' && data.action.dmg !== undefined) {
      const lvl = data.action.level || 50;
      const atk = data.action.atk || 60;
      const power = data.action.power || 60;

      // Та же формула, что на клиенте: ((lvl * power * (atk / 100)) / 15) * random(0.85-1.15)
      const minDmg = Math.floor(((lvl * power * (atk / 100)) / 15) * 0.85);
      const maxDmg = Math.floor(((lvl * power * (atk / 100)) / 15) * 1.15);
      const critBonus = data.action.crit ? 1.5 : 1;
      const maxAllowed = Math.floor(maxDmg * critBonus);

      if (data.action.dmg < 0 || data.action.dmg > maxAllowed + 5) {
        console.warn(`[pvp] INVALID DAMAGE from ${socket.id}: ${data.action.dmg}, expected range ${Math.floor(minDmg * (critBonus || 1))}-${maxAllowed}`);
        socket.emit('pvp_action_rejected', { reason: 'Invalid damage value' });
        return;
      }
    }

    // ── Валидация типа действия ──
    const validTypes = ['attack', 'switch', 'surrender', 'mon_data', 'fainted'];
    if (data.action?.type && !validTypes.includes(data.action.type)) {
      console.warn(`[pvp] Invalid action type from ${socket.id}: ${data.action.type}`);
      return;
    }

    const opponentSocketId = socket.id === battle.playerA ? battle.playerB : battle.playerA;
    const opponentSocket = io.sockets.sockets.get(opponentSocketId);
    if (opponentSocket) {
      opponentSocket.emit('pvp_opponent_action', { ...data.action, dmg: data.action?.dmg ?? undefined });
    }
  });

  // ── pvp_end ──
  socket.on('pvp_end', async (data: { battleId: string; action: any }) => {
    const battle = activeBattles.get(data.battleId);
    if (!battle) return;

    const isSenderWin = data.action?.type === 'win' || data.action?.type === 'surrender';

    const opponentSocketId = socket.id === battle.playerA ? battle.playerB : battle.playerA;
    const opponentSocket = io.sockets.sockets.get(opponentSocketId);

    // Пересылаем оппоненту
    if (opponentSocket) {
      opponentSocket.emit('pvp_opponent_action', data.action);
    }

    try {
      const db = getDb();
      const senderUserId = socket.data.user?.userId;
      const oppUserId = opponentSocket?.data.user?.userId;

      if (senderUserId) {
        // ── Server-authoritative рейтинг ──
        const senderWon = isSenderWin;
        const senderDelta = senderWon ? 10 : -5;
        await updateOrCreateRating(db, senderUserId, senderDelta, senderWon);

        if (oppUserId) {
          const oppWon = !senderWon;
          const oppDelta = oppWon ? 10 : -5;
          await updateOrCreateRating(db, oppUserId, oppDelta, oppWon);
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

    activeBattles.delete(data.battleId);
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
