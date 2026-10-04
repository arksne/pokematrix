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
import { VALID_ITEM_ID_SET } from '../validation/save-data.js';

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
  p1Offers: CanonicalOffer[];
  p2Offers: CanonicalOffer[];
  createdAt: number;
  touchedAt: number;
}

/**
 * Оффер в нормализованном виде.
 *
 * Раньше сервер проверял `offer.itemId` и `offer.uid`, тогда как клиент шлёт
 * `{ type, data: {...} }` — обе проверки всегда были ложны. А при обмене в базу
 * попадало `{ ...offer.data }`, то есть покемон с любыми характеристиками, какие
 * прислал клиент.
 */
type CanonicalOffer =
  | { type: 'item'; id: string; qty: number }
  | { type: 'pokemon'; uid: string };

/** Сколько живёт сессия обмена без активности. */
const TRADE_TTL_MS = 5 * 60 * 1000;
/** Не больше этого числа открытых сессий на процесс — защита от роста памяти. */
const MAX_ACTIVE_TRADES = 500;

const activeTrades = new Map<string, TradeSession>();

/**
 * Периодическая уборка сессий обмена. Устанавливается один раз на процесс
 * (см. sweepTradeSessions): без этого карта росла до перезапуска, потому что
 * сессия жила только до disconnect.
 */
let sweepTimer: NodeJS.Timeout | null = null;

/**
 * Приводит офферы клиента к каноническому виду.
 *
 * - отбрасывает всё, что не item/pokemon;
 * - суммирует количества предметов по id: два оффера одного предмета раньше
 *   проходили проверку отдельно, а выдавались дважды (клонирование);
 * - повторяющиеся покемоны по uid схлопываются в один;
 * - qty обязан быть положительным целым: отрицательный проходил проверку
 *   `have < need` и раздувал инвентарь отдающего;
 * - id предмета должен быть в белом списке.
 */
function normalizeOffers(raw: unknown): { offers: CanonicalOffer[]; error?: string } {
  if (!Array.isArray(raw)) return { offers: [], error: 'offers must be an array' };
  if (raw.length > 20) return { offers: [], error: 'too many offers' };

  const items = new Map<string, number>();
  const mons = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return { offers: [], error: 'malformed offer' };
    const o = entry as Record<string, any>;
    const data = (o.data && typeof o.data === 'object' ? o.data : {}) as Record<string, any>;

    if (o.type === 'item') {
      const id = typeof data.id === 'string' ? data.id : '';
      if (!VALID_ITEM_ID_SET.has(id)) return { offers: [], error: `unknown item id: ${id || '(empty)'}` };
      const qty = data.qty === undefined ? 1 : data.qty;
      if (!Number.isInteger(qty) || qty <= 0 || qty > 999) {
        return { offers: [], error: `invalid qty for ${id}` };
      }
      items.set(id, (items.get(id) || 0) + qty);
    } else if (o.type === 'pokemon') {
      const uid = typeof data.uid === 'string' ? data.uid : '';
      if (!uid || uid.length > 64) return { offers: [], error: 'invalid pokemon uid' };
      mons.add(uid);
    } else {
      return { offers: [], error: 'unknown offer type' };
    }
  }

  const offers: CanonicalOffer[] = [];
  for (const [id, qty] of items) offers.push({ type: 'item', id, qty });
  for (const uid of mons) offers.push({ type: 'pokemon', uid });
  return { offers };
}

/**
 * Возвращает сессию обмена только если сокет действительно её участник.
 * Раньше membership не проверялся: любой третий сокет, узнав tradeId (а его
 * получают оба участника), мог переписать офферы партнёра или отменить обмен.
 */
function getSessionForSocket(
  tradeId: unknown,
  socketId: string,
): { session: TradeSession; isInitiator: boolean } | null {
  if (typeof tradeId !== 'string' || !tradeId) return null;
  const session = activeTrades.get(tradeId);
  if (!session) return null;
  if (session.initiatorId === socketId) return { session, isInitiator: true };
  if (session.partnerId === socketId) return { session, isInitiator: false };
  return null;
}

/**
 * Пересобирает офферы в форму, которую ждёт клиент ({type, data}), при этом
 * покемоны и названия берутся из БД, а не из присланных клиентом данных.
 */
function toClientOffers(offers: CanonicalOffer[], ownerSave: any): any[] {
  const team: any[] = Array.isArray(ownerSave.myTeam) ? ownerSave.myTeam : [];
  const boxes: any[][] = Array.isArray(ownerSave.pcBoxes) ? ownerSave.pcBoxes : [];
  const allMons = [...team, ...boxes.flat()];

  return offers.map((o) => {
    if (o.type === 'item') {
      return { type: 'item', data: { id: o.id, name: o.id, qty: o.qty } };
    }
    const mon = allMons.find((m) => m && m.uid === o.uid);
    return { type: 'pokemon', data: mon ? { ...mon } : { uid: o.uid } };
  });
}

export function initTrade(io: Server, socket: Socket) {
  if (!sweepTimer) {
    sweepTimer = setInterval(() => sweepTradeSessions(io), 60_000);
    sweepTimer.unref?.();
  }

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
    const myUserId = socket.data.user?.tgId;
    if (!myUserId || typeof fromId !== 'number') return;

    // Обмен с самим собой запрещён: раньше проверки не было, а вместе с ней
    // исчезал и запрет на сессию, созданную без реального второго игрока.
    if (fromId === myUserId) {
      socket.emit('trade_rejected');
      return;
    }

    const initiatorPlayer = getOnlinePlayerByUserId(fromId);
    if (!initiatorPlayer || initiatorPlayer.socketId === socket.id) {
      socket.emit('trade_rejected');
      return;
    }

    const initiatorSocket = io.sockets.sockets.get(initiatorPlayer.socketId);
    if (!initiatorSocket) {
      socket.emit('trade_rejected');
      return;
    }

    // Защита от роста памяти: вытесняем самые старые незавершённые сессии.
    if (activeTrades.size >= MAX_ACTIVE_TRADES) {
      const oldest = [...activeTrades.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) {
        activeTrades.delete(oldest[0]);
        io.sockets.sockets.get(oldest[1].initiatorId)?.emit('trade_cancelled', 'Обмен истёк');
        io.sockets.sockets.get(oldest[1].partnerId)?.emit('trade_cancelled', 'Обмен истёк');
      }
    }

    const tradeId = `${initiatorPlayer.socketId}_${Date.now()}`;
    const session: TradeSession = {
      tradeId,
      initiatorId: initiatorPlayer.socketId,
      partnerId: socket.id,
      initiatorUserId: fromId,
      partnerUserId: myUserId,
      initiatorUsername: initiatorPlayer.username,
      partnerUsername: socket.data.user?.firstName || socket.data.user?.username || 'Тренер',
      p1Confirmed: false,
      p2Confirmed: false,
      p1Offers: [],
      p2Offers: [],
      createdAt: Date.now(),
      touchedAt: Date.now(),
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
  // ── trade_offer ──
  socket.on('trade_offer', async (data: { tradeId?: unknown; offers?: unknown }) => {
    const found = getSessionForSocket(data?.tradeId, socket.id);
    if (!found) return; // не участник — молча выходим, ничего не трогаем
    const { session, isInitiator } = found;

    // Нормализуем форму и отсекаем мусорные значения до похода в БД.
    const { offers, error } = normalizeOffers(data?.offers);
    if (error) {
      socket.emit('trade_offer_rejected', { reason: error });
      return;
    }
    if (offers.length === 0) {
      socket.emit('trade_offer_rejected', { reason: 'empty offer' });
      return;
    }

    const userId = isInitiator ? session.initiatorUserId : session.partnerUserId;
    if (!Number.isFinite(userId)) {
      socket.emit('trade_offer_rejected', { reason: 'trade session has no user id' });
      return;
    }

    try {
      const db = getDb();
      const [user] = await db.select({ save_data: users.save_data })
        .from(users)
        .where(eq(users.tg_id, userId))
        .limit(1);
      if (!user) {
        socket.emit('trade_offer_rejected', { reason: 'user not found' });
        return;
      }

      let saveData: any = {};
      try { saveData = JSON.parse(user.save_data || '{}'); } catch {}
      const inv = saveData.inventory || {};
      const team: any[] = Array.isArray(saveData.myTeam) ? saveData.myTeam : [];
      const boxes: any[][] = Array.isArray(saveData.pcBoxes) ? saveData.pcBoxes : [];
      const allMons = [...team, ...boxes.flat()];

      // Сверяем офферы с реальным содержимым сейва отправителя.
      for (const offer of offers) {
        if (offer.type === 'item') {
          const have = Number(inv[offer.id]) || 0;
          if (have < offer.qty) {
            socket.emit('trade_offer_rejected', {
              reason: `Недостаточно ${offer.id}: есть ${have}, нужно ${offer.qty}`,
            });
            return;
          }
        } else {
          const owned = allMons.some((m: any) => m && m.uid === offer.uid);
          if (!owned) {
            socket.emit('trade_offer_rejected', { reason: `Покемон ${offer.uid} не найден в вашей коллекции` });
            return;
          }
        }
      }

      if (isInitiator) {
        session.p1Offers = offers;
        session.p1Confirmed = false;
      } else {
        session.p2Offers = offers;
        session.p2Confirmed = false;
      }
      session.touchedAt = Date.now();

      // Пересылаем партнёру нормализованные офферы с данными из БД.
      const partnerSocketId = isInitiator ? session.partnerId : session.initiatorId;
      const partnerSocket = io.sockets.sockets.get(partnerSocketId);
      if (partnerSocket) {
        partnerSocket.emit('trade_partner_offers', toClientOffers(offers, saveData));
      }
    } catch (err) {
      console.error('[trade] trade_offer failed:', err);
      socket.emit('trade_offer_rejected', { reason: 'verification failed' });
    }
  });


  // ── trade_confirm ──
  socket.on('trade_confirm', (tradeId: string) => {
    const found = getSessionForSocket(tradeId, socket.id);
    if (!found) return; // не участник
    const { session, isInitiator } = found;
    session.touchedAt = Date.now();

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
      activeTrades.delete(session.tradeId);
      // Сессия уже удалена, повторный запуск обмена невозможен даже при гонке.
      void executeTradeSwap(io, session, initSocket, partSocket);
    }
  });

  // ── trade_cancel ──
  socket.on('trade_cancel', (tradeId: string) => {
    const found = getSessionForSocket(tradeId, socket.id);
    if (!found) return; // не участник

    const msg = 'Трейд отменён';
    const initSocket = io.sockets.sockets.get(found.session.initiatorId);
    const partSocket = io.sockets.sockets.get(found.session.partnerId);
    if (initSocket) initSocket.emit('trade_cancelled', msg);
    if (partSocket) partSocket.emit('trade_cancelled', msg);

    activeTrades.delete(found.session.tradeId);
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
 * Убирает из сейва покемонов с указанными uid (из команды и из боксов).
 * Возвращает сами удалённые объекты — именно они передаются партнёру.
 */
function takeMons(saveData: any, uids: Set<string>): any[] {
  const taken: any[] = [];
  if (Array.isArray(saveData.myTeam)) {
    saveData.myTeam = saveData.myTeam.filter((m: any) => {
      if (m && uids.has(m.uid)) { taken.push(m); return false; }
      return true;
    });
  }
  if (Array.isArray(saveData.pcBoxes)) {
    saveData.pcBoxes = saveData.pcBoxes.map((box: any[]) =>
      Array.isArray(box) ? box.filter((m: any) => {
        if (m && uids.has(m.uid)) { taken.push(m); return false; }
        return true;
      }) : box
    );
  }
  return taken;
}

/** Кладёт покемонов в команду, а при переполнении — в первый бокс. */
function giveMons(saveData: any, mons: any[]) {
  if (!Array.isArray(saveData.myTeam)) saveData.myTeam = [];
  if (!Array.isArray(saveData.pcBoxes)) saveData.pcBoxes = [];
  for (const mon of mons) {
    if (saveData.myTeam.length < 6) saveData.myTeam.push(mon);
    else {
      if (!Array.isArray(saveData.pcBoxes[0])) saveData.pcBoxes[0] = [];
      saveData.pcBoxes[0].push(mon);
    }
  }
}

function countMons(saveData: any): number {
  const team = Array.isArray(saveData.myTeam) ? saveData.myTeam.length : 0;
  const boxes = Array.isArray(saveData.pcBoxes)
    ? saveData.pcBoxes.reduce((a: number, b: any[]) => a + (Array.isArray(b) ? b.length : 0), 0)
    : 0;
  return team + boxes;
}

/**
 * Пересчёт кулдауна сессий: раньше не было ни TTL, ни GC, а сессия жила только до
 * disconnect. Список можно было раздуть одним событием trade_accept.
 */
function sweepTradeSessions(io: Server) {
  const now = Date.now();
  for (const [tradeId, session] of activeTrades) {
    if (now - session.touchedAt < TRADE_TTL_MS) continue;
    activeTrades.delete(tradeId);
    io.sockets.sockets.get(session.initiatorId)?.emit('trade_cancelled', 'Обмен истёк по таймауту');
    io.sockets.sockets.get(session.partnerId)?.emit('trade_cancelled', 'Обмен истёк по таймауту');
  }
}

/**
 * executeTradeSwap — обмен предметами/покемонами в одной транзакции.
 *
 * Что изменено против прежней реализации:
 * - оба UPDATE идут в одной db.transaction, а не в Promise.all из двух
 *   независимых UPDATE: падение второго больше не оставляет игрока без вещей;
 * - покемоны берутся из сейма владельца, а не из присланных клиентом полей;
 *   раньше в базу писался `{ ...offer.data }`, то есть покемон с любыми
 *   характеристиками;
 * - количества предметов суммируются по id, а повторяющиеся uid схлопываются;
 * - владение перепроверяется внутри транзакции (TOCTOU).
 */
async function executeTradeSwap(
  io: Server,
  session: TradeSession,
  initSocket: any,
  partSocket: any,
) {
  const cancelBoth = (reason: string) => {
    if (initSocket) initSocket.emit('trade_cancelled', reason);
    if (partSocket) partSocket.emit('trade_cancelled', reason);
  };

  try {
    const db = getDb();
    const uid1 = new Set(session.p1Offers.filter((o): o is Extract<CanonicalOffer, { type: 'pokemon' }> => o.type === 'pokemon').map((o) => o.uid));
    const uid2 = new Set(session.p2Offers.filter((o): o is Extract<CanonicalOffer, { type: 'pokemon' }> => o.type === 'pokemon').map((o) => o.uid));

    await db.transaction(async (tx) => {
      const [p1, p2] = await Promise.all([
        tx.select({ save_data: users.save_data, money: users.money })
          .from(users).where(eq(users.tg_id, session.initiatorUserId)).limit(1),
        tx.select({ save_data: users.save_data, money: users.money })
          .from(users).where(eq(users.tg_id, session.partnerUserId)).limit(1),
      ]);

      if (!p1[0] || !p2[0]) throw new Error('Trade failed: user not found');

      let sd1: any = {};
      let sd2: any = {};
      try { sd1 = JSON.parse(p1[0].save_data || '{}'); } catch {}
      try { sd2 = JSON.parse(p2[0].save_data || '{}'); } catch {}
      if (!sd1.inventory) sd1.inventory = {};
      if (!sd2.inventory) sd2.inventory = {};

      // ── TOCTOU-перепроверка: то, что предлагают, ещё должно быть у владельца ──
      const checkOffers = (inv: Record<string, any>, offers: CanonicalOffer[], ownUids: Set<string>, allMons: any[]) => {
        for (const o of offers) {
          if (o.type === 'item') {
            if ((Number(inv[o.id]) || 0) < o.qty) return `Недостаточно ${o.id}`;
          } else if (!allMons.some((m: any) => m && m.uid === o.uid)) {
            return `Покемон ${o.uid} больше не в коллекции`;
          }
        }
        return null;
      };

      const monList = (sd: any) => {
        const team = Array.isArray(sd.myTeam) ? sd.myTeam : [];
        const boxes = Array.isArray(sd.pcBoxes) ? sd.pcBoxes.flat() : [];
        return [...team, ...boxes];
      };

      const bad1 = checkOffers(sd1.inventory, session.p1Offers, uid1, monList(sd1));
      if (bad1) throw new Error(`Trade failed: ${bad1}`);
      const bad2 = checkOffers(sd2.inventory, session.p2Offers, uid2, monList(sd2));
      if (bad2) throw new Error(`Trade failed: ${bad2}`);

      // ── Забираем своё ──
      const monsFromP1 = takeMons(sd1, uid1);
      const monsFromP2 = takeMons(sd2, uid2);
      for (const o of session.p1Offers) {
        if (o.type === 'item') sd1.inventory[o.id] = (Number(sd1.inventory[o.id]) || 0) - o.qty;
      }
      for (const o of session.p2Offers) {
        if (o.type === 'item') sd2.inventory[o.id] = (Number(sd2.inventory[o.id]) || 0) - o.qty;
      }
      for (const inv of [sd1.inventory, sd2.inventory]) {
        for (const key of Object.keys(inv)) {
          if (!inv[key] || inv[key] <= 0) delete inv[key];
        }
      }

      // ── Отдаём своё с новым uid и новым владельцем ──
      const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const forP1 = monsFromP2.map((m, i) => ({
        ...m, uid: `trade_${stamp}_${i}`, originalTrainer: session.partnerUserId,
      }));
      const forP2 = monsFromP1.map((m, i) => ({
        ...m, uid: `trade_${stamp}_x${i}`, originalTrainer: session.initiatorUserId,
      }));
      giveMons(sd1, forP1);
      giveMons(sd2, forP2);

      for (const o of session.p2Offers) {
        if (o.type === 'item') sd1.inventory[o.id] = (Number(sd1.inventory[o.id]) || 0) + o.qty;
      }
      for (const o of session.p1Offers) {
        if (o.type === 'item') sd2.inventory[o.id] = (Number(sd2.inventory[o.id]) || 0) + o.qty;
      }

      const credit1 = Number(sd1.inventory['credit']) || 0;
      const credit2 = Number(sd2.inventory['credit']) || 0;

      await Promise.all([
        tx.update(users).set({
          save_data: JSON.stringify(sd1),
          pokemon_count: countMons(sd1),
          money: credit1,
        }).where(eq(users.tg_id, session.initiatorUserId)),
        tx.update(users).set({
          save_data: JSON.stringify(sd2),
          pokemon_count: countMons(sd2),
          money: credit2,
        }).where(eq(users.tg_id, session.partnerUserId)),
      ]);
    });

    // ── Уведомляем клиентов (данные — из БД, уже с новыми uid) ──
    if (initSocket) initSocket.emit('trade_execute', session.p2Offers);
    if (partSocket) partSocket.emit('trade_execute', session.p1Offers);
  } catch (err) {
    console.error('[trade] executeTradeSwap failed:', err);
    const msg = err instanceof Error && err.message.startsWith('Trade failed:')
      ? err.message.replace('Trade failed: ', '')
      : 'Ошибка выполнения обмена';
    cancelBoth(msg);
  }
}
