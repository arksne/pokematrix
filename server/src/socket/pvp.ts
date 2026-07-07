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

// Активные PvP-сессии: battleId → { playerA, playerB }
const activeBattles = new Map<string, { playerA: string; playerB: string }>();

export function initPvP(io: Server, socket: Socket) {
  // ── pvp_challenge ──
  socket.on('pvp_challenge', (partnerSocketId: string) => {
    const partnerSocket = io.sockets.sockets.get(partnerSocketId);
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
    challengerSocket.emit('pvp_start', { battleId, opponent: socket.data.user?.firstName || 'Оппонент', first: true });
    socket.emit('pvp_start', { battleId, opponent: socket.data.user?.firstName || 'Оппонент', first: false });
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

    const opponentSocketId = socket.id === battle.playerA ? battle.playerB : battle.playerA;
    const opponentSocket = io.sockets.sockets.get(opponentSocketId);
    if (opponentSocket) {
      opponentSocket.emit('pvp_opponent_action', data.action);
    }
  });

  // ── pvp_end ──
  socket.on('pvp_end', (data: { battleId: string; action: any }) => {
    const battle = activeBattles.get(data.battleId);
    if (!battle) return;

    // Пересылаем оппоненту
    const opponentSocketId = socket.id === battle.playerA ? battle.playerB : battle.playerA;
    const opponentSocket = io.sockets.sockets.get(opponentSocketId);
    if (opponentSocket) {
      opponentSocket.emit('pvp_opponent_action', data.action);
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
