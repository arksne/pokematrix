/**
 * Условия входа в зал лидера (спека game-spec.md §2, п.1):
 *   - 4+ живых покемона,
 *   - уникальные основные типы в команде,
 *   - уровень не выше максимального уровня покемона лидера.
 *
 * Зачем отдельный модуль:
 *   1) Раньше условия проверялись только тостами ПОСЛЕ нажатия «Сразиться!» —
 *      игрок видел «нельзя» без объяснения заранее. Спека требует понятности,
 *      поэтому те же правила теперь выводятся в модалке зала.
 *   2) Проверка была размазана по core.ts и не покрыта тестами. Здесь чистая
 *      функция, одинаковая для текста в модалке и для валидации старта боя.
 */

export interface GymMemberLike {
  level: number;
}

export interface GymLeaderLike {
  team: GymMemberLike[];
}

export interface GymTeamMemberLike {
  currentHp?: number;
  baseLevel?: number;
  candiesEaten?: number;
  nickname?: string;
  apiData?: { name?: string; types?: Array<{ type?: { name?: string } }> } | null;
}

/** Минимум живых покемонов для боя с лидером. */
export const GYM_MIN_ALIVE = 4;

/** Максимальный уровень покемонов лидера (планка входа). */
export function gymMaxLevel(leader: GymLeaderLike): number {
  const levels = (leader?.team || []).map((m) => Number(m?.level)).filter((n) => Number.isFinite(n) && n > 0);
  return levels.length ? Math.max(...levels) : 0;
}

/** Строка условий для модалки зала: что нужно, чтобы войти. */
export function gymEntryRequirements(leader: GymLeaderLike): string {
  const maxLevel = gymMaxLevel(leader);
  const parts = [
    `${GYM_MIN_ALIVE}+ живых покемона`,
    'уникальные типы в команде',
    maxLevel > 0 ? `уровень ≤ ${maxLevel}` : 'уровень не выше лидера',
  ];
  return `Условия входа: ${parts.join(' · ')}`;
}

export interface GymEntryCheck {
  ok: boolean;
  /** Готовое сообщение для тоста (или null, если можно входить). */
  error: string | null;
}

/**
 * Проверить команду перед боем с лидером.
 * Возвращает те же формулировки, что и раньше показывались тостами, поэтому
 * поведение для игрока не меняется — добавляется только текст в модалке.
 */
export function checkGymEntry(team: GymTeamMemberLike[] | null | undefined, leader: GymLeaderLike): GymEntryCheck {
  const alive = (Array.isArray(team) ? team : []).filter((m) => m && (m.currentHp ?? 0) > 0);
  if (alive.length < GYM_MIN_ALIVE) {
    return {
      ok: false,
      error: 'У вас должно быть минимум 4 живых покемона для битвы с лидером!',
    };
  }

  const maxGymLvl = gymMaxLevel(leader);
  const overleveled = alive.filter((m) => (Number(m.baseLevel) || 0) + (Number(m.candiesEaten) || 0) > maxGymLvl);
  if (overleveled.length > 0) {
    const names = overleveled.map((m) => m.nickname || m.apiData?.name || '?').join(', ');
    return {
      ok: false,
      error: `Ваши покемоны выше уровнем, чем лидер! Уберите: ${names} (макс ${maxGymLvl} лв)`,
    };
  }

  const primaryTypes = alive
    .map((m) => m.apiData?.types?.[0]?.type?.name)
    .filter((t): t is string => Boolean(t));
  const dupes = primaryTypes.filter((t, i) => primaryTypes.indexOf(t) !== i);
  if (dupes.length > 0) {
    const uniqueDupes = [...new Set(dupes)].join(', ');
    return {
      ok: false,
      error: `В команде есть повторяющиеся типы: ${uniqueDupes}. Смените покемонов!`,
    };
  }

  return { ok: true, error: null };
}
