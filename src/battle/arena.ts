// ─────────────────────────────────────────────────────────────
// arena.ts — PvP-АРЕНА: ЧИСТАЯ ЛОГИКА (без DOM, без сокетов)
// ─────────────────────────────────────────────────────────────
// Решение интервью M-18 (блок M, п.18): участники покупают жетоны,
// призы за победы нарастают со стриком.
//
// Этот модуль — единственный источник цифр арены. Сервер
// (server/src/socket/pvp.ts) держит зеркальную копию таблицы
// ARENA_STREAK_REWARDS: протокол требует, чтобы награда считалась
// сервером, а клиент только отображает. При смене цифр менять ОБА
// места + economy.test.mjs (E6).
//
// ЭКСПОРТЫ:
//   ARENA_TOKEN_ID / ARENA_TOKEN_PRICE — жетон участия
//   arenaRewardForStreak(streak) — приз за победу при данном стрике
//   hasArenaToken(inventory) — гейт входа (есть ли жетон)
//   nextArenaStreak(won, cur) — следующий стрик
//   sortArenaLeaders(a, b) — сортировка таблицы лидеров арены
// ─────────────────────────────────────────────────────────────

/** ID предмета-жетона участия в арене (см. src/data/items.ts). */
export const ARENA_TOKEN_ID = 'arenaToken';

/** Цена жетона в маркете (паритет с server/src/routes/economy.ts). */
export const ARENA_TOKEN_PRICE = 100000;

/** Цена продажи жетона (половина покупки, как везде). */
export const ARENA_TOKEN_SELL = 50000;

/**
 * Утешительный приз проигравшему бой на арене (10% цены жетона).
 * Стрик при этом сбрасывается. Выдаёт сервер вместе с pvp_arena_update.
 */
export const ARENA_LOSS_CONSOLATION = 10000;

export interface ArenaRewardItem {
  id: string;
  qty: number;
}

export interface ArenaReward {
  money: number;
  items: ArenaRewardItem[];
}

/**
 * Приз за победу при текущем стрике (стрик уже увеличен за этот бой).
 *
 * Экономика привязана к цене жетона (100 000): оба бойца сжигают по
 * жетону (банк боя 200 000), победитель забирает приз, проигравший —
 * утешительные 10 000. Максимальная выдача 175 000 + 10 000 = 185 000
 * < 200 000: арена всегда в плюсе минимум на 15 000, деньги не печатаются.
 *
 * Таблица (деньги + предметы, выдаёт сервер через pvp_reward):
 *   стрик 1: 115 000 + superPotion×1
 *   стрик 2: 130 000 + greatBall×2
 *   стрик 3: 145 000 + ultraBall×2
 *   стрик 4: 160 000 + rareCandy×1
 *   стрик 5+: 175 000 + masterBall×1
 */
export function arenaRewardForStreak(streak: unknown): ArenaReward {
  const s = Math.floor(Number(streak));
  const tier = !Number.isFinite(s) || s < 1 ? 1 : Math.min(5, s);
  const money = ARENA_TOKEN_PRICE + 15000 * tier;
  switch (tier) {
    case 1:
      return { money, items: [{ id: 'superPotion', qty: 1 }] };
    case 2:
      return { money, items: [{ id: 'greatBall', qty: 2 }] };
    case 3:
      return { money, items: [{ id: 'ultraBall', qty: 2 }] };
    case 4:
      return { money, items: [{ id: 'rareCandy', qty: 1 }] };
    default:
      return { money, items: [{ id: 'masterBall', qty: 1 }] };
  }
}

/**
 * Гейт входа на арену: в инвентаре должен лежать хотя бы один жетон.
 * Сервер проверяет то же самое перед списанием (доверять клиенту нельзя).
 */
export function hasArenaToken(inventory: unknown): boolean {
  if (!inventory || typeof inventory !== 'object') return false;
  const qty = (inventory as Record<string, unknown>)[ARENA_TOKEN_ID];
  return typeof qty === 'number' && Number.isFinite(qty) && qty >= 1;
}

/**
 * Следующий стрик: победа +1, поражение/сдача сбрасывает в 0.
 * AFK-финал стрик не трогает (там своя логика без денег).
 */
export function nextArenaStreak(won: boolean, cur: unknown): number {
  if (!won) return 0;
  const n = Math.floor(Number(cur));
  return (!Number.isFinite(n) || n < 0 ? 0 : n) + 1;
}

export interface ArenaLeaderEntry {
  userId: number;
  wins: number;
  best: number;
}

/**
 * Сортировка таблицы лидеров арены: победы ↓, затем лучший стрик ↓.
 * Чистая функция — сервер сортирует SQL, клиент досортировывает так же.
 */
export function sortArenaLeaders(
  a: ArenaLeaderEntry,
  b: ArenaLeaderEntry,
): number {
  const dw = (b.wins || 0) - (a.wins || 0);
  if (dw !== 0) return dw;
  return (b.best || 0) - (a.best || 0);
}
