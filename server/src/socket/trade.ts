/**
 * Socket.IO Trade handler.
 * Полный lifecycle обмена покемонами/предметами.
 *
 * Поток:
 *   A -> trade_request(B)
 *   B -> trade_accept/decline
 *   if accept: trade_started(A, B)
 *   A/B -> trade_offer { tradeId, offers }
 *   A/B -> trade_confirm { tradeId }
 *   if both confirmed: trade_execute
 *   A/B -> trade_cancel / disconnect -> trade_cancelled
 */
import type { Server, Socket } from 'socket.io';
import { getOnlinePlayerByUserId } from './lobby.js';

interface TradeSession {
  tradeId: string;
  initiatorId: string;        // socket.id инициатора
  partnerId: string;          // socket.id партнёра
  initiatorUserId: number;    // Telegram user ID инициатора
  partnerUserId: number;      // Telegram user ID партнёра
  initiatorUsername: string;
  partnerUsername: string;
  p1Confirmed: boolean;
  p2Confirmed: boolean;
  p1Offers: any[];
  p2Offers: any[];
}

const activeTrades = new Map<string, TradeSession>();

export function initTrade(io: Server, socket: Socket) {
  // ── trade_request ──
  socket.on('trade_request', (partnerSocketId: string) => {
    const initiator = getOnlinePlayerByUserId(socket.data.user?.tgId);
    const partner = getOnlinePlayerByUserId(
      // partnerSocketId может быть userId или socketId
      parseInt(partnerSocketId) ? parseInt(partnerSocketId) : (socket.data.user?.tgId)
    );

    // Ищем партнёра по socket.id
    const partnerSocket = io.sockets.sockets.get(partnerSocketId);
    if (!partnerSocket) {
      socket.emit('trade_rejected');
      return;
    }

    // Отправляем запрос партнёру
    partnerSocket.emit('trade_request_received', {
      fromUsername: socket.data.user?.firstName || socket.data.user?.username || 'Тренер',
      fromId: socket.data.user?.tgId,
    });
  });

  // ── trade_accept ──
  socket.on('trade_accept', (fromId: number) => {
    const initiatorPlayer = getOnlinePlayerByUserId(fromId);
    if (!initiatorPlayer) return;

    const initiatorSocket = io.sockets.sockets.get(initiatorPlayer.socketId);
    if (!initiatorSocket) return;

    const tradeId = `${initiatorPlayer.socketId}_${Date.now()}`;
    const session: TradeSession = {
      tradeId,
      initiatorId: initiatorPlayer.socketId,
      partnerId: socket.id,
      initiatorUserId: fromId,
      partnerUserId: socket.data.user?.tgId,
      initiatorUsername: initiatorPlayer.username,
      partnerUsername: socket.data.user?.firstName || socket.data.user?.username || 'Тренер',
      p1Confirmed: false,
      p2Confirmed: false,
      p1Offers: [],
      p2Offers: [],
    };

    activeTrades.set(tradeId, session);

    // Уведомить обоих
    initiatorSocket.emit('trade_started', { tradeId, partnerUsername: session.partnerUsername });
    socket.emit('trade_started', { tradeId, partnerUsername: session.initiatorUsername });
  });

  // ── trade_reject ──
  socket.on('trade_reject', (fromId: number) => {
    const initiatorPlayer = getOnlinePlayerByUserId(fromId);
    if (!initiatorPlayer) return;
    const initiatorSocket = io.sockets.sockets.get(initiatorPlayer.socketId);
    if (initiatorSocket) {
      initiatorSocket.emit('trade_rejected');
    }
  });

  // ── trade_offer ──
  socket.on('trade_offer', (data: { tradeId: string; offers: any[] }) => {
    const session = activeTrades.get(data.tradeId);
    if (!session) return;

    const isInitiator = socket.id === session.initiatorId;
    if (isInitiator) {
      session.p1Offers = data.offers || [];
      session.p1Confirmed = false; // сброс подтверждения при новом оффере
    } else {
      session.p2Offers = data.offers || [];
      session.p2Confirmed = false;
    }

    // Переслать партнёру
    const partnerSocketId = isInitiator ? session.partnerId : session.initiatorId;
    const partnerSocket = io.sockets.sockets.get(partnerSocketId);
    if (partnerSocket) {
      partnerSocket.emit('trade_partner_offers', data.offers);
    }
  });

  // ── trade_confirm ──
  socket.on('trade_confirm', (tradeId: string) => {
    const session = activeTrades.get(tradeId);
    if (!session) return;

    const isInitiator = socket.id === session.initiatorId;
    if (isInitiator) session.p1Confirmed = true;
    else session.p2Confirmed = true;

    // Обновить UI обоих
    const status = { p1: session.p1Confirmed, p2: session.p2Confirmed };
    const initSocket = io.sockets.sockets.get(session.initiatorId);
    const partSocket = io.sockets.sockets.get(session.partnerId);
    if (initSocket) initSocket.emit('trade_confirm_status', status);
    if (partSocket) partSocket.emit('trade_confirm_status', status);

    // Если оба подтвердили — выполнить обмен
    if (session.p1Confirmed && session.p2Confirmed) {
      // Отправляем офферы обратно (принимающая сторона получает то, что предлагали)
      if (initSocket) initSocket.emit('trade_execute', session.p2Offers);
      if (partSocket) partSocket.emit('trade_execute', session.p1Offers);
      activeTrades.delete(tradeId);
    }
  });

  // ── trade_cancel ──
  socket.on('trade_cancel', (tradeId: string) => {
    const session = activeTrades.get(tradeId);
    if (!session) return;

    const msg = 'Трейд отменён';
    const initSocket = io.sockets.sockets.get(session.initiatorId);
    const partSocket = io.sockets.sockets.get(session.partnerId);
    if (initSocket) initSocket.emit('trade_cancelled', msg);
    if (partSocket) partSocket.emit('trade_cancelled', msg);

    activeTrades.delete(tradeId);
  });

  // ── disconnect → очистка трейдов ──
  socket.on('disconnect', () => {
    for (const [tradeId, session] of activeTrades) {
      if (session.initiatorId === socket.id || session.partnerId === socket.id) {
        const otherSocketId = session.initiatorId === socket.id ? session.partnerId : session.initiatorId;
        const otherSocket = io.sockets.sockets.get(otherSocketId);
        if (otherSocket) otherSocket.emit('trade_cancelled', 'Собеседник отключился');
        activeTrades.delete(tradeId);
      }
    }
  });
}
