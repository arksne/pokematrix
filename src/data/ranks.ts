// ─────────────────────────────────────────────────────────────
// ranks.ts — РАНГИ ТРЕНЕРА (витрина, не титулы)
// ─────────────────────────────────────────────────────────────
// Титулы (titles.ts) — за квесты, выбираются вручную.
// Ранги — автоматическая лестница по числу значков (16 залов:
// Канто 8 + Джото 8). Ранг считается чистой функцией от badges,
// поэтому одинаков на клиенте и в тестах; серверу считать не надо.
// Показывается в списке тренеров, своей карте и чужом профиле.
//
// Шкала (границы включительно):
//   0            🥚 Новичок
//   1–2          🌱 Ученик
//   3–4          🧭 Искатель
//   5–6          ⚔️ Боец
//   7–8          🛡️ Ветеран
//   9–10         🌟 Элита
//   11–13        👑 Мастер
//   14–15        🏆 Чемпион
//   16+          🌌 Легенда
// ─────────────────────────────────────────────────────────────

export interface RankDef {
  /** Машиночитаемый id. */
  id: string;
  /** Эмодзи ранга. */
  icon: string;
  /** Русское имя. */
  name: string;
  /** Минимум значков для ранга (включительно). */
  minBadges: number;
  /** Короткое описание для подсказки. */
  desc: string;
}

export const RANKS: RankDef[] = [
  { id: 'novice', icon: '🥚', name: 'Новичок', minBadges: 0, desc: 'Только начинает путь.' },
  { id: 'apprentice', icon: '🌱', name: 'Ученик', minBadges: 1, desc: 'Первые значки — 1–2.' },
  { id: 'seeker', icon: '🧭', name: 'Искатель', minBadges: 3, desc: 'Уверенно идёт по залам — 3–4.' },
  { id: 'fighter', icon: '⚔️', name: 'Боец', minBadges: 5, desc: 'Середина пути — 5–6.' },
  { id: 'veteran', icon: '🛡️', name: 'Ветеран', minBadges: 7, desc: 'Опытный тренер — 7–8.' },
  { id: 'elite', icon: '🌟', name: 'Элита', minBadges: 9, desc: 'Почти мастер — 9–10.' },
  { id: 'master', icon: '👑', name: 'Мастер', minBadges: 11, desc: 'Мастер залов — 11–13.' },
  { id: 'champion', icon: '🏆', name: 'Чемпион', minBadges: 14, desc: 'Почти все залы — 14–15.' },
  { id: 'legend', icon: '🌌', name: 'Легенда', minBadges: 16, desc: 'Все 16 значков Канто и Джото.' },
];

/** Ранг по числу значков. Мусор/отрицательное → Новичок. */
export function getRankByBadges(badges: unknown): RankDef {
  const n = typeof badges === 'number' && Number.isFinite(badges) ? Math.floor(badges) : 0;
  const b = n < 0 ? 0 : n;
  let cur = RANKS[0];
  for (const r of RANKS) {
    if (b >= r.minBadges) cur = r;
    else break;
  }
  return cur;
}

/** Короткая строка «иконка имя» для списков. */
export function rankLabel(badges: unknown): string {
  const r = getRankByBadges(badges);
  return `${r.icon} ${r.name}`;
}

/** Сколько значков не хватает до следующего ранга (0 — потолок). */
export function badgesToNextRank(badges: unknown): number {
  const n = typeof badges === 'number' && Number.isFinite(badges) ? Math.floor(badges) : 0;
  const b = n < 0 ? 0 : n;
  for (const r of RANKS) {
    if (b < r.minBadges) return r.minBadges - b;
  }
  return 0;
}
