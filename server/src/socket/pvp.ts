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
import { parseSaveStrict, stampSave } from '../db/save-json.js';
import { getOnlinePlayerByUserId, getOnlinePlayersByUserId } from './lobby.js';
import { audit } from './audit.js';
import { getDb } from '../db/index.js';
import { users, battleRatings, arenaStats } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

/** Ограничивает число целым значением в диапазоне [min, max]. */
function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
// Активные PvP-сессии: battleId → { playerA, playerB }
// arena=true — бой с PvP-Арены (M-18): награда со стриком, а не базовые 500.
// st — засташенные статы сторон из mon_data {A:{lvl,atk,def},B:{...}} для
// валидации урона (иначе проверяем по полям самой атаки — слабее).
export interface PvPBattle {
  playerA: string; playerB: string; userA: number; userB: number;
  startedAt: number; lastActivityAt: number; lastActorSocketId: string | null;
  arena: boolean;
  st: {
    A: { lvl: number; patk: number; pdef: number; satk: number; sdef: number } | null;
    B: { lvl: number; patk: number; pdef: number; satk: number; sdef: number } | null;
  } | null;
}
const activeBattles = new Map<string, PvPBattle>();

/** Вызов без ответа: через столько считаем оппонента AFK. */
const CHALLENGE_TTL_MS = 60 * 1000;
/** Без ходов столько: AFK-сторона проигрывает ( было: висело до 10-мин TTL ). */
const INACTIVITY_TTL_MS = 90 * 1000;
/** Ожидающие вызовы: socketId вызывающего → { кому, когда, арена ли }. */
const pendingChallenges = new Map<string, { partnerUserId: number; challengerUserId: number; at: number; arena: boolean }>();

// ── M-18: PvP-Арена ──────────────────────────────────────────
// Участники арены: socket.id → { tgId, имя, когда вошёл }.
// Вход — только с жетоном arenaToken (сгорает при входе, списывает сервер).
// Бои арены идут по тому же протоколу challenge/accept/start/action/end.
const arenaMembers = new Map<number, { socketId: string; username: string; joinedAt: number }>();

/** Участник арены по tgId (а не по socket.id — переподключение не должно
 *  выкидывать с арены и заставлять платить жетон заново). */
function inArena(userId: number): boolean {
  return arenaMembers.has(userId);
}

/** ID жетона участия (паритет с src/battle/arena.ts). */
const ARENA_TOKEN_ID = 'arenaToken';

/**
 * Приз за победу при данном стрике.
 * ЗЕРКАЛО src/battle/arena.ts (arenaRewardForStreak): цифры менять в обоих
 * местах. Привязка к цене жетона 100 000: победа = 100 000 + 15 000 × тир,
 * поражение = утешительные ARENA_LOSS_CONSOLATION. Макс. выдача за бой
 * 175 000 + 10 000 < 200 000 (два сожжённых жетона): деньги не печатаются.
 */
const ARENA_TOKEN_PRICE = 100000;
const ARENA_LOSS_CONSOLATION = 10000;
function arenaRewardForStreak(streak: number): { money: number; items: Array<{ id: string; qty: number }> } {
  const tier = !Number.isFinite(streak) || streak < 1 ? 1 : Math.min(5, Math.floor(streak));
  const money = ARENA_TOKEN_PRICE + 15000 * tier;
  switch (tier) {
    case 1: return { money, items: [{ id: 'superPotion', qty: 1 }] };
    case 2: return { money, items: [{ id: 'greatBall', qty: 2 }] };
    case 3: return { money, items: [{ id: 'ultraBall', qty: 2 }] };
    case 4: return { money, items: [{ id: 'rareCandy', qty: 1 }] };
    default: return { money, items: [{ id: 'masterBall', qty: 1 }] };
  }
}

/** Снимок лобби арены: кто ждёт, кто дерётся. */
function arenaLobbyList() {
  const inBattleUsers = new Set<number>();
  for (const b of activeBattles.values()) {
    if (b.arena) { inBattleUsers.add(b.userA); inBattleUsers.add(b.userB); }
  }
  return [...arenaMembers.entries()].map(([userId, m]) => ({
    userId,
    username: m.username,
    inBattle: inBattleUsers.has(userId),
  }));
}

/** Разослать лобби всем (вход/выход/старт/конец боя меняют флаги). */
function broadcastArenaLobby(io: Server) {
  if (arenaMembers.size === 0) return;
  io.emit('arena_lobby', arenaLobbyList());
}

/** Прочитать или создать строку статистики арены (внутри транзакции). */
async function readOrCreateArenaRow(tx: any, userId: number) {
  const existing = (await tx.select().from(arenaStats).where(eq(arenaStats.user_id, userId)).limit(1))[0];
  if (existing) return existing;
  await tx.insert(arenaStats).values({
    user_id: userId, wins: 0, streak: 0, best: 0, updated_at: new Date().toISOString(),
  });
  return { user_id: userId, wins: 0, streak: 0, best: 0 };
}
/** Потолок одновременных боёв на процесс — защита от роста памяти. */
const MAX_ACTIVE_BATTLES = 300;

let sweepTimer: NodeJS.Timeout | null = null;

/**
 * Свежая save_version пользователя: клиент принимает её, чтобы его
 * следующий автосейв не 409ил после серверной записи (сжигание жетона,
 * награда PvP). Без этого — ложный конфликт и applyCloudSave посреди боя.
 */
async function freshSaveVersion(db: any, userId: number): Promise<number | undefined> {
  try {
    const r = await db.select({ v: users.save_version }).from(users).where(eq(users.id, userId)).limit(1);
    return typeof r[0]?.v === 'number' ? r[0].v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Возвращает бой только если сокет — его участник.
 * Раньше проверки не было: по угаданному battleId посторонний сокет мог внедрять
 * ходы в чужой бой и завершать его, получая +500 кредитов и +10 рейтинга.
 */
function getBattleForSocket(
  battleId: unknown,
  socketId: string,
): { battle: PvPBattle; isPlayerA: boolean } | null {
  if (typeof battleId !== 'string' || !battleId) return null;
  const battle = activeBattles.get(battleId);
  if (!battle) return null;
  if (battle.playerA === socketId) return { battle, isPlayerA: true };
  if (battle.playerB === socketId) return { battle, isPlayerA: false };
  return null;
}

/** Сокет уже дерётся (любой из живых боёв). */
function isSocketInBattle(socketId: string): boolean {
  for (const b of activeBattles.values()) {
    if (b.playerA === socketId || b.playerB === socketId) return true;
  }
  return false;
}

/**
 * Бой для сокета: сначала строго по socket.id, затем — переподключение.
 *
 * Мобильный клиент (Telegram WebView) при обрыве сети переподключается с
 * НОВЫМ socket.id: старый код молча отбрасывал все его ходы (не участник),
 * реле оппонента уходило в мёртвый сокет, и через 90с AFK-таймаут выкидывал
 * игрока из боя без единой ошибки в логах. Теперь узнаём своего по tgId
 * (из JWT, подделать нельзя) и перепривязываем сокет на лету; обе стороны
 * получают pvp_rejoin и пересинхронизируют HP через mon_data.
 */
function getBattleForSocketOrUser(
  io: Server,
  battleId: unknown,
  socket: Socket,
): { battle: PvPBattle; isPlayerA: boolean } | null {
  if (typeof battleId !== 'string' || !battleId) return null;
  const battle = activeBattles.get(battleId);
  if (!battle) return null;
  if (battle.playerA === socket.id) return { battle, isPlayerA: true };
  if (battle.playerB === socket.id) return { battle, isPlayerA: false };
  const tg = socket.data.user?.tgId;
  if (typeof tg !== 'number') return null;
  if (tg === battle.userA || tg === battle.userB) {
    const isA = tg === battle.userA;
    if (isA) battle.playerA = socket.id; else battle.playerB = socket.id;
    battle.lastActivityAt = Date.now();
    const otherId = isA ? battle.playerB : battle.playerA;
    io.sockets.sockets.get(otherId)?.emit('pvp_rejoin', { battleId });
    socket.emit('pvp_rejoin', { battleId });
    console.log(`[pvp] reattach battleId=${battleId} user=${tg}`);
    audit({ kind: 'pvp_reattach', sessionId: battleId, actorTg: tg, detail: {} });
    return { battle, isPlayerA: isA };
  }
  return null;
}

/** Пользователь уже дерётся (с любого своего сокета). */
function isUserInBattle(userId: number): boolean {
  for (const b of activeBattles.values()) {
    if (b.userA === userId || b.userB === userId) return true;
  }
  return false;
}

/**
 * Живой сокет пользователя: сначала свежий онлайн-словник, иначе записанный
 * в бою/вызове. Уведомления о сеттле (pvp_reward, pvp_arena_update, rejoin)
 * ДОЛЖНЫ доходить: если слать их в мёртвый socket.id, клиент не примет версию,
 * его отложенный сейв уйдёт со старой версией → 409 + тост «более новая
 * версия» ровно в конце боя. Старый id — только фолбэк.
 */
export function liveSocketFor(io: Server, userTg: number, fallbackId?: string | null) {
  // Перебираем ВСЕ сокеты юзера от свежего: первый может быть умирающим
  // (disconnect ещё в обработке, connected уже false — пропускаем).
  for (const online of getOnlinePlayersByUserId(userTg)) {
    const s = io.sockets.sockets.get(online.socketId);
    if (s?.connected) return s;
  }
  if (fallbackId) {
    const old = io.sockets.sockets.get(fallbackId);
    if (old?.connected) return old;
  }
  return undefined;
}
/** Уборка боёв по TTL. Без неё карта жила до перезапуска процесса. */
async function sweepBattles(io: Server) {
  const now = Date.now();
  // Протухшие вызовы: вызывающий ждал в AFK — отпускаем с уведомлением
  for (const [sockId, ch] of [...pendingChallenges]) {
    if (now - ch.at < CHALLENGE_TTL_MS) continue;
    pendingChallenges.delete(sockId);
    liveSocketFor(io, ch.challengerUserId, sockId)?.emit('pvp_challenge_timeout', {});
  }
  for (const [battleId, b] of [...activeBattles]) {
    // Удаляем только по тишине 90с: лимит общего времени убивал длинные
    // честные бои («Бой прерван» без наград при активной рубке).
    if (now - b.lastActivityAt < INACTIVITY_TTL_MS) continue;
    activeBattles.delete(battleId);
    const timedOut = now - b.lastActivityAt >= INACTIVITY_TTL_MS;
    if (timedOut && b.lastActorSocketId) {
      // AFK-проигрыш: победитель — активная сторона. Рейтинг — да, деньги —
      // нет (иначе вызов альта + AFK = печатный станок).
      await settleTimeoutWin(io, b);
    } else {
      liveSocketFor(io, b.userA, b.playerA)?.emit('pvp_opponent_left', 'Бой прерван');
      liveSocketFor(io, b.userB, b.playerB)?.emit('pvp_opponent_left', 'Бой прерван');
    }
  }
  // Арена: флаги inBattle могли измениться — обновить лобби.
  // AFK-финал стрик не трогает (рейтинг без денег, как раньше).
  broadcastArenaLobby(io);
}

/** AFK-победа активной стороне: рейтинг без денег. */
async function settleTimeoutWin(io: Server, b: PvPBattle & { arena?: boolean }) {
  const winnerSockId = b.lastActorSocketId!;
  const winnerIsA = winnerSockId === b.playerA;
  const winnerTg = winnerIsA ? b.userA : b.userB;
  const loserTg = winnerIsA ? b.userB : b.userA;
  try {
    const db = getDb();
    const rows = await db.select({ id: users.id, tg: users.tg_id }).from(users);
    const byTg = new Map(rows.map((r: any) => [r.tg, r.id]));
    const wId = byTg.get(winnerTg);
    const lId = byTg.get(loserTg);
    if (wId) await updateOrCreateRating(db, wId, 10, true);
    if (lId) await updateOrCreateRating(db, lId, -5, false);
    // Арена: AFK — это поражение неактивной стороны: стрик сгорает (иначе
    // выгодно уходить в AFK вместо поражения, сохраняя стрик). Денег нет
    // обеим (антифарм альтов), утешительных тоже.
    if (b.arena && lId) {
      try {
        await db.update(arenaStats).set({ streak: 0, updated_at: new Date().toISOString() })
          .where(eq(arenaStats.user_id, lId));
      } catch { /* ignore */ }
    }
  } catch (e) {
    console.error('[pvp] timeout rating error:', e);
  }
  liveSocketFor(io, winnerTg, winnerSockId)?.emit('pvp_timeout', { won: true });
  liveSocketFor(io, loserTg, winnerIsA ? b.playerB : b.playerA)?.emit('pvp_timeout', { won: false });
}

export function initPvP(io: Server, socket: Socket) {
  if (!sweepTimer) {
    sweepTimer = setInterval(() => sweepBattles(io), 30_000);
    sweepTimer.unref?.();
  }

  // ── pvp_challenge ──
  // M-18: вызов с арены — { userId, arena: true }. Число (старый клиент,
  // E-тесты) — обычный бой вне арены.
  socket.on('pvp_challenge', (raw: number | { userId?: unknown; arena?: unknown }) => {
    const partnerUserId = typeof raw === 'number' ? raw : Number((raw as any)?.userId);
    const wantArena = typeof raw === 'object' && raw !== null && (raw as any).arena === true;
    const myUserId = socket.data.user?.tgId;
    if (!myUserId || !Number.isFinite(partnerUserId) || partnerUserId === myUserId) return; // не вызываем себя

    // Второй параллельный бой: два живых боя между той же парой давали
    // задвоенные атаки в одном окне (клиент не различает потоки) и рвали
    // версии/сеттл. Вызывающий или партнёр уже в бою — вызов отклоняется.
    if (isSocketInBattle(socket.id) || isUserInBattle(partnerUserId)) {
      socket.emit('pvp_challenge_rejected', { reason: 'IN_BATTLE' });
      return;
    }

    // Бой с арены — только между участниками арены (оба вошли по жетону).
    if (wantArena) {
      const partnerInArena = inArena(partnerUserId);
      if (!inArena(myUserId) || !partnerInArena) {
        socket.emit('pvp_challenge_rejected', { reason: 'NOT_IN_ARENA' });
        return;
      }
    }

    // Ищем по userId (стабильный идентификатор, не socket.id)
    const partner = getOnlinePlayerByUserId(partnerUserId);
    if (!partner || partner.socketId === socket.id) return;
    const partnerSocket = io.sockets.sockets.get(partner.socketId);
    if (!partnerSocket) return;

    partnerSocket.emit('pvp_challenge_received', {
      fromName: socket.data.user?.firstName || socket.data.user?.username || 'Тренер',
      fromId: socket.data.user?.tgId,
      ...(wantArena ? { arena: true } : {}),
    });
    // Вызов висит максимум минуту: без ответа вызывающий не ждёт в AFK вечно
    pendingChallenges.set(socket.id, { partnerUserId, challengerUserId: myUserId, at: Date.now(), arena: wantArena });
  });

  // ── pvp_accept ──
  // M-18: принятие боя с арены — { fromId, arena: true } (число = старый формат).
  socket.on('pvp_accept', (raw: number | { fromId?: unknown; arena?: unknown }) => {
    const fromId = typeof raw === 'number' ? raw : Number((raw as any)?.fromId);
    const acceptArena = typeof raw === 'object' && raw !== null && (raw as any).arena === true;
    const myUserId = socket.data.user?.tgId;
    if (!myUserId || !Number.isFinite(fromId)) return;

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

    // Принятие, когда кто-то из пары уже дерётся (встречные вызовы, дабл-тап):
    // второй бой ломал бы первый (см. pvp_challenge). Отклоняем обе стороны,
    // чтобы вызывающий не висел до таймаута.
    if (isSocketInBattle(socket.id) || isSocketInBattle(challenger.socketId)) {
      socket.emit('pvp_challenge_rejected', { reason: 'IN_BATTLE' });
      challengerSocket.emit('pvp_challenge_rejected', { reason: 'IN_BATTLE' });
      return;
    }

    if (activeBattles.size >= MAX_ACTIVE_BATTLES) {
      const oldest = [...activeBattles.entries()].sort((a, b) => a[1].startedAt - b[1].startedAt)[0];
      if (oldest) activeBattles.delete(oldest[0]);
    }

    // M-18: бой аренный, только если вызов был с арены (с любой стороны
    // флаг) И оба до сих пор на арене (участники — по tgId, переживают реконнект).
    const pendingArena = [...pendingChallenges.values()].some(
      (p) => p.arena && (p.partnerUserId === myUserId || p.partnerUserId === challengerUserId),
    );
    const arena = (acceptArena || pendingArena)
      && inArena(challengerUserId)
      && inArena(myUserId);

    const battleId = `pvp_${socket.id}_${challenger.socketId}_${Date.now()}`;
    activeBattles.set(battleId, {
      playerA: challenger.socketId,
      playerB: socket.id,
      userA: challengerUserId,
      userB: myUserId,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      lastActorSocketId: null,
      arena,
      st: null,
    });
    pendingChallenges.delete(socket.id);
    pendingChallenges.delete(challenger.socketId);
    console.log(`[pvp] start battleId=${battleId} arena=${arena} A=${challengerUserId} B=${myUserId}`);
    audit({ kind: 'pvp_start', sessionId: battleId, actorTg: challengerUserId, detail: { arena, a: challengerUserId, b: myUserId } });

    // Обоим: кто первый ходит (инициатор = first)
    const challengerName = challengerSocket.data.user?.firstName || challengerSocket.data.user?.username || 'Оппонент';
    const acceptorName = socket.data.user?.firstName || socket.data.user?.username || 'Оппонент';
    challengerSocket.emit('pvp_start', { battleId, opponent: acceptorName, first: true, ...(arena ? { arena: true } : {}) });
    socket.emit('pvp_start', { battleId, opponent: challengerName, first: false, ...(arena ? { arena: true } : {}) });
    if (arena) broadcastArenaLobby(io);
  });

  // ── M-18: вход/выход с арены ──
  // Жетон arenaToken сгорает ПРИ ВХОДЕ (1 жетон = 1 сессия, бои внутри
  // бесплатны). Проверка и списание — в транзакции: два параллельных
  // arena_join с одним жетоном дают ровно один вход.
  socket.on('arena_join', async () => {
    const tgId = socket.data.user?.tgId;
    if (!tgId) return;
    if (inArena(tgId)) {
      // Вдогонку — свежая версия: если клиент когда-то разошёлся с сервером,
      // повторный вход молча чинит рассинхрон вместо грядущего 409.
      // Версия — приятное дополнение, не причина ронять вход.
      // Жетон НЕ сжигаем повторно: участник уже внутри (иначе дабл-клик
      // съедал второй жетон на 100k). Сокет обновляем (переподключение).
      const m = arenaMembers.get(tgId)!;
      m.socketId = socket.id;
      let sv: number | undefined;
      try {
        const db = getDb();
        const me = (await db.select({ id: users.id })
          .from(users).where(eq(users.tg_id, tgId)).limit(1))[0];
        if (me) sv = await freshSaveVersion(db, me.id);
      } catch { /* ignore */ }
      socket.emit('arena_joined', { ok: true, already: true, saveVersion: sv });
      return;
    }
    try {
      const db = getDb();
      const joinedUserId = await db.transaction(async (tx) => {
        const row = (await tx.select({ id: users.id, save_data: users.save_data })
          .from(users)
          .where(eq(users.tg_id, tgId))
          .for('update')
          .limit(1))[0];
        if (!row) return 0;
        const sd: any = parseSaveStrict(row.save_data, row.id);
        if (!sd.inventory) sd.inventory = {};
        if ((sd.inventory[ARENA_TOKEN_ID] || 0) < 1) return 0;
        sd.inventory[ARENA_TOKEN_ID] -= 1;
        if (sd.inventory[ARENA_TOKEN_ID] <= 0) delete sd.inventory[ARENA_TOKEN_ID];
        await tx.update(users)
          .set({
            save_data: JSON.stringify(stampSave(sd)),
            money: sd.inventory.credit || 0,
            save_version: sql`${users.save_version} + 1`,
          })
          .where(eq(users.id, row.id));
        return row.id;
      });
      if (!joinedUserId) {
        // E7: без жетона на арену нельзя.
        socket.emit('arena_join_rejected', { reason: 'NO_TOKEN' });
        return;
      }
      arenaMembers.set(tgId, {
        socketId: socket.id,
        username: socket.data.user?.firstName || socket.data.user?.username || 'Тренер',
        joinedAt: Date.now(),
      });
      socket.emit('arena_joined', { ok: true, saveVersion: await freshSaveVersion(db, joinedUserId) });
      audit({ kind: 'arena_join', actorTg: tgId });
      broadcastArenaLobby(io);
    } catch (e) {
      console.error('[pvp] arena_join error:', e);
      socket.emit('arena_join_rejected', { reason: 'ERROR' });
    }
  });

  socket.on('arena_leave', () => {
    const tgId = socket.data.user?.tgId;
    if (typeof tgId === 'number' && arenaMembers.get(tgId)?.socketId === socket.id) {
      arenaMembers.delete(tgId);
      broadcastArenaLobby(io);
    }
  });

  // Текущий снимок лобби по запросу (клиент спрашивает при открытии вкладки).
  socket.on('arena_lobby_request', () => {
    socket.emit('arena_lobby', arenaLobbyList());
  });

  // ── pvp_decline ──
  socket.on('pvp_decline', (fromId: number) => {
    // Чистим запись ВЫЗЫВАВШЕГО (ключ — его socket.id): раньше удалялся ключ
    // отклонившего (пустой), и вызывавший через 60с получал ложный timeout
    // поверх «отклонил».
    const myId = socket.data.user?.tgId;
    for (const [key, ch] of [...pendingChallenges]) {
      if (ch.partnerUserId === myId && Number(fromId) === ch.challengerUserId) {
        pendingChallenges.delete(key);
      }
    }
    const challenger = getOnlinePlayerByUserId(fromId);
    if (!challenger) return;
    const challengerSocket = io.sockets.sockets.get(challenger.socketId);
    if (challengerSocket) {
      challengerSocket.emit('pvp_declined', { fromName: socket.data.user?.firstName || 'Оппонент' });
    }
  });

  // ── pvp_action ──
  socket.on('pvp_action', (data: { battleId?: unknown; action?: any }) => {
    const found = getBattleForSocketOrUser(io, data?.battleId, socket);
    if (!found) return; // не участник боя
    const { battle } = found;
    battle.lastActivityAt = Date.now();
    // AFK-атрибуция — только волевые ходы (атака/смена/сдача): автоответы
    // hp_update/mon_data её не трогают, иначе победителем становился автор
    // последней автоотбивки, а не тот, кто реально ходит.
    if (data.action?.type === 'attack' || data.action?.type === 'switch' || data.action?.type === 'surrender') {
      battle.lastActorSocketId = socket.id;
    }

    // Stash статов из mon_data для валидации урона: уровень и посчитанные
    // клиентом атака/защита (физ/спец). Дальше cap считается по stash, а не
    // по полям каждой атаки (их легко раздуть).
    if (data.action?.type === 'mon_data') {
      const c = data.action?.calc;
      const num = (v: unknown) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) ? Math.min(600, Math.max(1, n)) : 50;
      };
      const st = {
        lvl: clampInt(data.action?.lvl, 1, 100),
        patk: num(c?.patk), pdef: num(c?.pdef),
        satk: num(c?.satk), sdef: num(c?.sdef),
      };
      if (!battle.st) battle.st = { A: null, B: null };
      if (found.isPlayerA) battle.st.A = st; else battle.st.B = st;
    }

    // ── Валидация типа действия ──
    const validTypes = ['attack', 'switch', 'surrender', 'mon_data', 'fainted', 'hp_update'];
    if (data.action?.type && !validTypes.includes(data.action.type)) {
      console.warn(`[pvp] Invalid action type from ${socket.id}: ${data.action.type}`);
      // Неизвестный тип НЕ дропаем молча: клиент уже переключил ход
      // (pvpMyTurn=false) и зависнет до sweep без этого ответа.
      socket.emit('pvp_action_rejected', { reason: 'Unknown action type' });
      return;
    }

    // ── Проверка урона: честная формула дикого боя + запас ──
    // Stash из mon_data (уровень + посчитанные атака/защита) — основа кэпа.
    // Без stash (старый клиент, боящийся мон) — прежняя формула по полям атаки.
    const action = data.action;
    if (action?.type === 'attack' && typeof action.dmg === 'number') {
      const myUserId = socket.data.user?.tgId;
      // Клиент шлёт `lvl` (pvp-core.ts doPvPAttack); читаем оба имени, иначе
      // уровень падал в 1 и ЛЮБОЙ урон >6 отбивался как читерский — настоящие
      // бои висли: оппонент не получал ход, оба ждали «хода противника».
      const myLevel = clampInt(action.lvl ?? action.level, 1, 100);
      const power = clampInt(action.power, 1, 250);
      // Потолок 600 — щедрый реальный максимум стата на 100 уровне; 1000 дарил
      // читерам двукратный урон поверх формулы.
      const atkClaimed = clampInt(action.atk, 1, 600);
      if (!Number.isFinite(myUserId) || myLevel < 1 || power < 1 || atkClaimed < 1) {
        socket.emit('pvp_action_rejected', { reason: 'Invalid attack data' });
        return;
      }

      const st = found.isPlayerA ? battle.st?.A : battle.st?.B;
      let maxAllowed: number;
      if (st) {
        // Физ/спец пара по классу урона; неизвестный класс — пара с большим кэпом
        // (никаких ложных отклонений честных ударов).
        const phys = (action.damageClass || 'physical') !== 'special';
        const A = phys ? st.patk : st.satk;
        const D = phys ? st.pdef : st.sdef;
        const base = (((2 * myLevel / 5 + 2) * power * (A / Math.max(1, D))) / 50) + 2;
        // Запас ×20 покрывает STAB 1.5 × эффективность 4 × крит 1.5 × стадии.
        // Это backstop против абсурда (99999), а не точная валидация: точную
        // даёт stash (статы зафиксированы на бой, раздуть посреди боя нельзя).
        // Пол 700 — OHKO и мелкие базы не упираются в кэп.
        maxAllowed = Math.max(Math.floor(base * 1.15 * 20) + 8, 700);
      } else {
        const base = ((myLevel * power * (atkClaimed / 100)) / 15);
        maxAllowed = Math.floor(base * 1.15 * (action.crit ? 1.5 : 1));
      }
      if (!Number.isFinite(action.dmg) || action.dmg < 0 || action.dmg > maxAllowed + 5) {
        console.warn(`[pvp] INVALID DAMAGE from ${socket.id}: ${action.dmg}, max ${maxAllowed}`);
        socket.emit('pvp_action_rejected', { reason: 'Invalid damage value' });
        return;
      }
    }

    const opponentSocketId = socket.id === battle.playerA ? battle.playerB : battle.playerA;
    const opponentTg = socket.id === battle.playerA ? battle.userB : battle.userA;
    const opponentSocket = liveSocketFor(io, opponentTg, opponentSocketId);
    if (opponentSocket) {
      // battleId в релее: клиент отбрасывает чужие потоки (два живых боя между
      // той же парой давали задвоенные атаки в одном окне).
      opponentSocket.emit('pvp_opponent_action', { ...data.action, dmg: data.action?.dmg ?? undefined, battleId: data?.battleId });
    }
  });

  // ── pvp_end ──
  // Сеттлит ОБЕ стороны по ПЕРВОМУ pvp_end (бой уже удалён выше, повторный
  // pvp_end второго участника никого не найдёт и молча выйдет — двойных
  // наград нет).
  //
  // Раньше награждался только отправитель 'win', а 'lose' проигравшего никого
  // не награждал: победитель, добивший оппонента, не узнавал о конце боя
  // (HP не синхронизировались) и вечно ждал чужого хода, а награда не приходила.
  // Теперь: 'win' → победитель отправитель; 'lose'/'surrender' → победитель
  // оппонент. Рейтинг пишется обоим, +500 и pvp_reward — победителю.
  socket.on('pvp_end', async (data: { battleId?: unknown; action?: any }) => {
    const battleId = data?.battleId;
    const found = getBattleForSocketOrUser(io, battleId, socket);
    if (!found || typeof battleId !== 'string') return; // не участник боя
    const { battle } = found;

    // Удаляем бой ДО любых await: между get и delete раньше было четыре await,
    // поэтому десяток параллельных pvp_end проходил проверку и начислял
    // десять наград по 500 кредитов.
    activeBattles.delete(battleId);

    const actionType = data?.action?.type;
    // surrender/lose — это ПОРАЖЕНИЕ отправителя (победитель — оппонент).
    // Раньше surrender трактовался как победа наравне с 'win', то есть можно
    // было сдаться и получить +500 кредитов.
    const senderWon = actionType === 'win';
    const winnerIsSender = senderWon;
    console.log(`[pvp] end battleId=${battleId} action=${actionType} sender=${socket.data.user?.tgId} arena=${battle.arena}`);
    audit({ kind: 'pvp_end', sessionId: battleId, actorTg: socket.data.user?.tgId, detail: { action: actionType, arena: battle.arena } });

    const opponentSocketId = socket.id === battle.playerA ? battle.playerB : battle.playerA;
    const opponentTg = socket.id === battle.playerA ? battle.userB : battle.userA;
    const opponentSocket = liveSocketFor(io, opponentTg, opponentSocketId);

    // Пересылаем оппоненту (с battleId — клиент отбрасывает чужие потоки).
    if (opponentSocket) {
      opponentSocket.emit('pvp_opponent_action', { ...data?.action, battleId });
    }

    try {
      const db = getDb();
      // tgId обоих — из боя (сокет оппонента мог уже отвалиться).
      const senderTg = socket.data.user?.tgId;
      const oppTg = battle.userA === senderTg ? battle.userB : battle.userA;
      const winnerTg = winnerIsSender ? senderTg : oppTg;
      const loserTg = winnerIsSender ? oppTg : senderTg;

      const rows = await db.select({ id: users.id, tg: users.tg_id }).from(users);
      const byTg = new Map(rows.map((r: any) => [r.tg, r.id]));
      const wId = winnerTg ? byTg.get(winnerTg) : undefined;
      const lId = loserTg ? byTg.get(loserTg) : undefined;

      // ── M-18: финал боя С АРЕНЫ: стрик + нарастающий приз ──
      // Протокол тот же (E6), но pvp_reward расширен: { money, items, streak,
      // best, wins, arena: true }. Обычные бои (в т.ч. E5) идут старым путём.
      if (battle.arena && wId && lId) {
        const settled = await db.transaction(async (tx) => {
          // Рейтинг обоим — как в обычном бою.
          await updateOrCreateRating(tx, wId, 10, true);
          await updateOrCreateRating(tx, lId, -5, false);

          // Стрик победителя +1, лучший/всего — вверх.
          const wSt: any = await readOrCreateArenaRow(tx, wId);
          const streak = (Number(wSt.streak) || 0) + 1;
          const best = Math.max(Number(wSt.best) || 0, streak);
          const wins = (Number(wSt.wins) || 0) + 1;
          await tx.update(arenaStats).set({
            wins, streak, best, updated_at: new Date().toISOString(),
          }).where(eq(arenaStats.user_id, wId));
          const reward = arenaRewardForStreak(streak);

          // Деньги + предметы победителю.
          const wRow = (await tx.select({ id: users.id, save_data: users.save_data })
            .from(users)
            .where(eq(users.id, wId))
            .for('update')
            .limit(1))[0];
          if (wRow) {
            const sd: any = parseSaveStrict(wRow.save_data, wId);
            if (!sd.inventory) sd.inventory = {};
            sd.inventory.credit = (sd.inventory.credit || 0) + reward.money;
            for (const item of reward.items) {
              sd.inventory[item.id] = (sd.inventory[item.id] || 0) + item.qty;
            }
            await tx.update(users)
              .set({
                save_data: JSON.stringify(stampSave(sd)),
                money: sd.inventory.credit || 0,
                save_version: sql`${users.save_version} + 1`,
              })
              .where(eq(users.id, wId));
          }

          // Стрик проигравшего сбрасывается (поражение/сдача = 0),
          // утешительные ARENA_LOSS_CONSOLATION — в тот же сейв.
          const lSt: any = await readOrCreateArenaRow(tx, lId);
          if ((Number(lSt.streak) || 0) !== 0) {
            await tx.update(arenaStats).set({
              streak: 0, updated_at: new Date().toISOString(),
            }).where(eq(arenaStats.user_id, lId));
          }
          const lRow = (await tx.select({ id: users.id, save_data: users.save_data })
            .from(users)
            .where(eq(users.id, lId))
            .for('update')
            .limit(1))[0];
          if (lRow) {
            const lsd: any = parseSaveStrict(lRow.save_data, lId);
            if (!lsd.inventory) lsd.inventory = {};
            lsd.inventory.credit = (lsd.inventory.credit || 0) + ARENA_LOSS_CONSOLATION;
            await tx.update(users)
              .set({
                save_data: JSON.stringify(stampSave(lsd)),
                money: lsd.inventory.credit || 0,
                save_version: sql`${users.save_version} + 1`,
              })
              .where(eq(users.id, lId));
          }
          return { reward, streak, best, wins };
        });

        // Награду шлём на ЖИВОЙ сокет победителя (по tgId): после реконнекта
        // записанный в бою socket.id может быть мёртв — иначе клиент не примет
        // версию и его отложенный сейв даст 409 + тост «более новая версия».
        const winnerSock = liveSocketFor(io, winnerTg, winnerIsSender ? socket.id : opponentSocketId);
        winnerSock?.emit('pvp_reward', {
          money: settled.reward.money,
          items: settled.reward.items,
          streak: settled.streak,
          best: settled.best,
          wins: settled.wins,
          arena: true,
          saveVersion: await freshSaveVersion(db, wId),
        });
        // Проигравший узнаёт о сбросе стрика и утешительных
        // (клиент обновит счётчик и покажет тост). Тоже живой сокет.
        // loserTg уже посчитан выше (winnerIsSender ? oppTg : senderTg).
        const loserSock = liveSocketFor(io, loserTg, winnerIsSender ? opponentSocketId : socket.id);
        loserSock?.emit('pvp_arena_update', {
          streak: 0, arena: true, consolation: ARENA_LOSS_CONSOLATION,
          saveVersion: await freshSaveVersion(db, lId),
        });
        console.log(`[pvp] settle battleId=${battleId} arena winner=${winnerTg} streak=${settled.streak} money=${settled.reward.money}`);
        audit({ kind: 'pvp_settle', sessionId: battleId, actorTg: winnerTg, detail: { arena: true, money: settled.reward.money, items: settled.reward.items, streak: settled.streak, best: settled.best } });
        broadcastArenaLobby(io);
        return;
      }

      // ── Server-authoritative рейтинг обоим ──
      if (wId) await updateOrCreateRating(db, wId, 10, true);
      if (lId) await updateOrCreateRating(db, lId, -5, false);

      // ── Server-authoritative награда (+500 победителю) ──
      if (wId) {
        // Раньше чтение и запись save_data шли без транзакции: два
        // одновременных pvp_end перечитывали один и тот же сейв, и вторая
        // запись затирала первую вместе с её кредитами. Строка пользователя
        // теперь блокируется на всё время транзакции, и economy делает то же
        // самое, поэтому клиентский POST /save между чтением и записью тоже
        // не может потеряться.
        const rewarded = await db.transaction(async (tx) => {
          const userRow = (await tx.select({ id: users.id, save_data: users.save_data })
            .from(users)
            .where(eq(users.id, wId))
            .for('update')
            .limit(1))[0];

          if (!userRow) return false;

          const sd: any = parseSaveStrict(userRow.save_data, wId);
          if (!sd.inventory) sd.inventory = {};
          sd.inventory.credit = (sd.inventory.credit || 0) + 500;

          await tx.update(users)
            .set({
              save_data: JSON.stringify(stampSave(sd)),
              money: sd.inventory.credit || 0,
              save_version: sql`${users.save_version} + 1`,
            })
            .where(eq(users.id, wId));
          return true;
        });

        // Уведомляем победителя о награде (если онлайн).
        // Версию читаем ПОСЛЕ коммита: внутри транзакции её ещё не видно.
        // Сокет — живой (по tgId): награда с версией обязана дойти, иначе
        // отложенный сейв клиента даст 409 + тост «более новая версия».
        if (rewarded) {
          const winnerSock = liveSocketFor(io, winnerTg, winnerIsSender ? socket.id : opponentSocketId);
          winnerSock?.emit('pvp_reward', { money: 500, saveVersion: await freshSaveVersion(db, wId) });
          audit({ kind: 'pvp_settle', sessionId: battleId, actorTg: winnerTg, detail: { arena: false, money: 500 } });
        }
      }
    } catch (e) {
      console.error('[pvp] rating/reward save error:', e);
    }
  });

  // ── disconnect → очистка PvP ──
  // Переподключение (новый socket.id) НЕ должно убивать бой: сначала ищем
  // другой живой сокет того же юзера и перепривязываем бой на него. Иначе
  // реконнект посреди боя удалял бой + слал оппоненту фейковое 'surrender',
  // а вернувшийся игрок упирался в удалённый бой (вечный фриз → «вылет»).
  // Тест-ловушка: PC18/E10 закрывают второй сокет при живом первом.
  socket.on('disconnect', () => {
    pendingChallenges.delete(socket.id);
    const tg = socket.data.user?.tgId;
    // Арена — по tgId: удаляем только свою запись и только если сокет тот же
    // (чужой живой сокет того же юзера — не трогаем). Переподключение с арены
    // не выкидывает и жетон не требует заново.
    if (typeof tg === 'number') {
      const m = arenaMembers.get(tg);
      if (m && m.socketId === socket.id) {
        const live = liveSocketFor(io, tg, null);
        if (live) m.socketId = live.id;
        else { arenaMembers.delete(tg); broadcastArenaLobby(io); }
      }
    }
    let replacement: string | null = null;
    if (typeof tg === 'number') {
      for (const [sid, s] of io.sockets.sockets) {
        if (sid !== socket.id && s.connected && (s.data.user as any)?.tgId === tg) {
          replacement = sid;
          break;
        }
      }
    }
    for (const [battleId, battle] of activeBattles) {
      if (battle.playerA === socket.id || battle.playerB === socket.id) {
        if (replacement) {
          if (battle.playerA === socket.id) battle.playerA = replacement;
          if (battle.playerB === socket.id) battle.playerB = replacement;
          battle.lastActivityAt = Date.now();
          console.log(`[pvp] reattach-on-disconnect battleId=${battleId} user=${tg}`);
          continue;
        }
        // Честный маркер вместо фейкового 'surrender': награды не было,
        // клиент показывает «отключился», а не «сдался».
        const otherSocketId = battle.playerA === socket.id ? battle.playerB : battle.playerA;
        const otherSocket = liveSocketFor(io,
          battle.playerA === socket.id ? battle.userB : battle.userA, otherSocketId);
        if (otherSocket) {
          otherSocket.emit('pvp_opponent_action', { type: 'opponent_left', battleId });
        }
        activeBattles.delete(battleId);
      }
    }
    // Арена: вышедший мог драться — обновить флаги inBattle в лобби.
    broadcastArenaLobby(io);
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
