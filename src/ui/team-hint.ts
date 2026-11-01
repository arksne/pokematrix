/**
 * Почему бой/охота недоступны: команда пустая или вся без сознания.
 *
 * Раньше на «всю команду выбили» игра отвечала сухим «Вам нужен хотя бы один
 * живой покемон!» — без подсказки, что делать. После первого проигранного боя
 * (а новичок в стартовом городе вполне может проиграть дикому Lv5–7 со
 * стартером Lv5) это тупик: игрок не может ни ловить, ни драться и не знает,
 * что лечение есть в Поке-центре за копейки (1 кредит за HP).
 *
 * Сообщения вынесены в чистую функцию: формулировка — часть UX-контракта,
 * её проверяют тесты, а используют и core.ts (старт боя), и init.ts (тумблер
 * охоты).
 */

export type TeamBattleStatus = 'ok' | 'no-team' | 'all-fainted';

/** Состояние команды для боя/охоты. */
export function teamBattleStatus(team: ReadonlyArray<{ currentHp?: number } | null | undefined> | null | undefined): TeamBattleStatus {
  const list = Array.isArray(team) ? team : [];
  if (list.length === 0) return 'no-team';
  const hasAlive = list.some((mon) => mon && (mon.currentHp ?? 0) > 0);
  return hasAlive ? 'ok' : 'all-fainted';
}

/** Что показать игроку, если бой/охота недоступны (null — всё в порядке). */
export function teamBlockedMessage(status: TeamBattleStatus): string | null {
  switch (status) {
    case 'no-team':
      return 'У вас нет покемонов!';
    case 'all-fainted':
      return 'Вся команда без сознания — вылечите её в Поке-центре!';
    default:
      return null;
  }
}

/** Готовое сообщение по команде (или null, если можно драться). */
export function teamBlockedToast(
  team: ReadonlyArray<{ currentHp?: number } | null | undefined> | null | undefined
): string | null {
  return teamBlockedMessage(teamBattleStatus(team));
}

/** Есть ли в команде хоть один боеспособный покемон. */
export function hasAliveTeam(
  team: ReadonlyArray<{ currentHp?: number } | null | undefined> | null | undefined
): boolean {
  return teamBattleStatus(team) === 'ok';
}
