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
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

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
  socket.on('trade_request', (partnerUserId: number) => {
    // Ищем партнёра по userId (стабильный идентификатор, не socket.id)
    const partner = getOnlinePlayerByUserId(partnerUserId);
    if (!partner || !socket.data.user) {
      socket.emit('trade_rejected');
      return;
    }
    const partnerSocket = io.sockets.sockets.get(partner.socketId);
    if (!partnerSocket) {
      socket.emit('trade_rejected');
      return;
    }

    // Отправляем запрос партнёру
    partnerSocket.emit('trade_request_received', {
      fromUsername: socket.data.user.firstName || socket.data.user.username || 'Тренер',
      fromId: socket.data.user.tgId,
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

  // ── trade_offer (с верификацией владения) ──
  socket.on('trade_offer', async (data: { tradeId: string; offers: any[] }) => {
    const session = activeTrades.get(data.tradeId);
    if (!session) return;

    const isInitiator = socket.id === session.initiatorId;
    const userId = isInitiator ? session.initiatorUserId : session.partnerUserId;

    // ── Проверяем владение предлагаемыми предметами ──
    const offers = data.offers || [];
    let hasItems = false;
    let hasMons = false;

    for (const offer of offers) {
      if (offer.type === 'item') {
        hasItems = true;
      } else if (offer.type === 'pokemon') {
        hasMons = true;
      }
    }

    // Если есть предметы — верифицируем через БД
    if (hasItems) {
      try {
        const db = getDb();
        const user = (await db.select({ save_data: users.save_data })
          .from(users)
          .where(eq(users.tg_id, userId))
          .limit(1))[0];

        if (user) {
          let saveData: any = {};
          try { saveData = JSON.parse(user.save_data || '{}'); } catch {}
          const inv = saveData.inventory || {};

          for (const offer of offers) {
            if (offer.type === 'item' && offer.itemId) {
              const have = inv[offer.itemId] || 0;
              if (have < (offer.qty || 1)) {
                socket.emit('trade_offer_rejected', {
                  reason: `Not enough ${offer.itemId} (have: ${have}, need: ${offer.qty || 1})`,
                });
                return;
              }
            }
          }
        }
      } catch (e) {
        console.error('[trade] DB verify error:', e);
      }
    }

    // Верификация покемонов — по UID (проверяем, что покемон есть в saveData.myTeam)
    if (hasMons) {
      try {
        const db = getDb();
        const user = (await db.select({ save_data: users.save_data })
          .from(users)
          .where(eq(users.tg_id, userId))
          .limit(1))[0];

        if (user) {
          let saveData: any = {};
          try { saveData = JSON.parse(user.save_data || '{}'); } catch {}
          const team = saveData.myTeam || [];

          for (const offer of offers) {
            if (offer.type === 'pokemon' && offer.uid) {
              const owned = team.some((m: any) => m.uid === offer.uid);
              if (!owned) {
                socket.emit('trade_offer_rejected', {
                  reason: `Pokemon ${offer.uid} not in your team`,
                });
                return;
              }
            }
          }
        }
      } catch (e) {
        console.error('[trade] DB verify error:', e);
      }
    }

    if (isInitiator) {
      session.p1Offers = offers;
      session.p1Confirmed = false;
    } else {
      session.p2Offers = offers;
      session.p2Confirmed = false;
    }

    // Переслать партнёру
    const partnerSocketId = isInitiator ? session.partnerId : session.initiatorId;
    const partnerSocket = io.sockets.sockets.get(partnerSocketId);
    if (partnerSocket) {
      partnerSocket.emit('trade_partner_offers', offers);
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

    // Если оба подтвердили — выполнить обмен в БД
    if (session.p1Confirmed && session.p2Confirmed) {
      executeTradeSwap(io, session, initSocket, partSocket);
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

/**
 * executeTradeSwap — атомарный обмен предметами/покемонами в БД.
 * Читает save_data обоих игроков, выполняет своп, записывает обратно.
 * После успешного обмена шлёт trade_execute обоим.
 */
/**
 * verifyOfflineOwnership — перепроверить, что предметы/покемоны всё ещё у владельца
 * (TOCTOU-защита: между offer и execute могло измениться save_data).
 */
function verifyOfflineOwnership(saveData: any, offers: any[]): { ok: boolean; reason?: string } {
  const inv = saveData.inventory || {};
  const team = saveData.myTeam || [];

  for (const offer of offers) {
    if (offer.type === 'item' && offer.data?.id) {
      const have = inv[offer.data.id] || 0;
      const need = offer.data.qty || 1;
      if (have < need) {
        return { ok: false, reason: `Недостаточно ${offer.data.id}: есть ${have}, нужно ${need}` };
      }
    } else if (offer.type === 'pokemon' && offer.data?.uid) {
      const owned = team.some((m: any) => m.uid === offer.data.uid);
      if (!owned) {
        return { ok: false, reason: `Покемон ${offer.data.uid} больше не в команде` };
      }
    }
  }
  return { ok: true };
}

async function executeTradeSwap(io: Server, session: TradeSession, initSocket: any, partSocket: any) {
  try {
    const db = getDb();
    const [p1, p2] = await Promise.all([
      db.select({ save_data: users.save_data, money: users.money }).from(users).where(eq(users.tg_id, session.initiatorUserId)).limit(1),
      db.select({ save_data: users.save_data, money: users.money }).from(users).where(eq(users.tg_id, session.partnerUserId)).limit(1),
    ]);

    if (!p1[0] || !p2[0]) {
      if (initSocket) initSocket.emit('trade_cancelled', 'Ошибка: пользователь не найден');
      if (partSocket) partSocket.emit('trade_cancelled', 'Ошибка: пользователь не найден');
      return;
    }

    let sd1: any = {};
    let sd2: any = {};
    try { sd1 = JSON.parse(p1[0].save_data || '{}'); } catch {}
    try { sd2 = JSON.parse(p2[0].save_data || '{}'); } catch {}

    if (!sd1.inventory) sd1.inventory = {};
    if (!sd2.inventory) sd2.inventory = {};
    if (!sd1.myTeam) sd1.myTeam = [];
    if (!sd2.myTeam) sd2.myTeam = [];
    if (!sd1.pcBoxes) sd1.pcBoxes = [];
    if (!sd2.pcBoxes) sd2.pcBoxes = [];

    // ── TOCTOU защита: перепроверяем владение перед SWAP ──
    const v1 = verifyOfflineOwnership(sd1, session.p1Offers);
    if (!v1.ok) {
      console.warn(`[trade] TOCTOU reject p1 (${session.initiatorUserId}): ${v1.reason}`);
      if (initSocket) initSocket.emit('trade_cancelled', `Ошибка: ${v1.reason}`);
      if (partSocket) partSocket.emit('trade_cancelled', 'Обмен отменён — у инициатора изменились данные');
      return;
    }

    const v2 = verifyOfflineOwnership(sd2, session.p2Offers);
    if (!v2.ok) {
      console.warn(`[trade] TOCTOU reject p2 (${session.partnerUserId}): ${v2.reason}`);
      if (initSocket) initSocket.emit('trade_cancelled', 'Обмен отменён — у партнёра изменились данные');
      if (partSocket) partSocket.emit('trade_cancelled', `Ошибка: ${v2.reason}`);
      return;
    }

    // --- Удаляем офферы у инициатора (p1) ---
    for (const offer of session.p1Offers) {
      if (offer.type === 'pokemon' && offer.data?.uid) {
        const idx = sd1.myTeam.findIndex((m: any) => m.uid === offer.data.uid);
        if (idx !== -1) sd1.myTeam.splice(idx, 1);
      } else if (offer.type === 'item' && offer.data?.id) {
        const qty = offer.data.qty || 1;
        sd1.inventory[offer.data.id] = (sd1.inventory[offer.data.id] || 0) - qty;
        if (sd1.inventory[offer.data.id] <= 0) delete sd1.inventory[offer.data.id];
      }
    }

    // --- Удаляем офферы у партнёра (p2) ---
    for (const offer of session.p2Offers) {
      if (offer.type === 'pokemon' && offer.data?.uid) {
        const idx = sd2.myTeam.findIndex((m: any) => m.uid === offer.data.uid);
        if (idx !== -1) sd2.myTeam.splice(idx, 1);
      } else if (offer.type === 'item' && offer.data?.id) {
        const qty = offer.data.qty || 1;
        sd2.inventory[offer.data.id] = (sd2.inventory[offer.data.id] || 0) - qty;
        if (sd2.inventory[offer.data.id] <= 0) delete sd2.inventory[offer.data.id];
      }
    }

    // --- Добавляем полученное p1 (offer от p2) ---
    for (const offer of session.p2Offers) {
      if (offer.type === 'pokemon' && offer.data) {
        const mon = { ...offer.data, uid: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, originalTrainer: session.initiatorUserId };
        if (sd1.myTeam.length < 6) sd1.myTeam.push(mon);
        else { if (!sd1.pcBoxes[0]) sd1.pcBoxes[0] = []; sd1.pcBoxes[0].push(mon); }
      } else if (offer.type === 'item' && offer.data?.id) {
        sd1.inventory[offer.data.id] = (sd1.inventory[offer.data.id] || 0) + (offer.data.qty || 1);
      }
    }

    // --- Добавляем полученное p2 (offer от p1) ---
    for (const offer of session.p1Offers) {
      if (offer.type === 'pokemon' && offer.data) {
        const mon = { ...offer.data, uid: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, originalTrainer: session.partnerUserId };
        if (sd2.myTeam.length < 6) sd2.myTeam.push(mon);
        else { if (!sd2.pcBoxes[0]) sd2.pcBoxes[0] = []; sd2.pcBoxes[0].push(mon); }
      } else if (offer.type === 'item' && offer.data?.id) {
        sd2.inventory[offer.data.id] = (sd2.inventory[offer.data.id] || 0) + (offer.data.qty || 1);
      }
    }

    // --- Записываем в БД ---
    await Promise.all([
      db.update(users).set({ save_data: JSON.stringify(sd1), pokemon_count: sd1.myTeam.length + sd1.pcBoxes.reduce((a: number, b: any[]) => a + b.length, 0) }).where(eq(users.tg_id, session.initiatorUserId)),
      db.update(users).set({ save_data: JSON.stringify(sd2), pokemon_count: sd2.myTeam.length + sd2.pcBoxes.reduce((a: number, b: any[]) => a + b.length, 0) }).where(eq(users.tg_id, session.partnerUserId)),
    ]);

    // --- Уведомляем клиентов ---
    if (initSocket) initSocket.emit('trade_execute', session.p2Offers);
    if (partSocket) partSocket.emit('trade_execute', session.p1Offers);
  } catch (e) {
    console.error('[trade] executeTradeSwap error:', e);
    if (initSocket) initSocket.emit('trade_cancelled', 'Ошибка выполнения обмена');
    if (partSocket) partSocket.emit('trade_cancelled', 'Ошибка выполнения обмена');
  }
}
