// ────────────────────────────────────────────��────────────────
// location-gate.ts — ОТКРЫТИЕ ЛОКАЦИИ (интервью M, п.17)
// ─────────────────────────────────────────────────────────────
// «Все локации видно, но есть локи, открывающиеся только в квест».
// Значит гейт нужен в двух независимых видах:
//
//   requiresQuest  — id квеста (взят ИЛИ сдан; isQuestActive умеет и то,
//                    и то). Честно привязываем только там, где привязка
//                    не выдумывается.
//   requiresBadges — сколько нужно значков. Для «сильных мест» (Церулинская
//                    пещера, Серебряная гора, Тёмная пещера) это и есть
//                    настоящий гейт: легенда 100 уровня не должна
//                    встретиться новичку. Раньше эти три локации были
//                    открыты сразу — легенда падалась в руки игроку без
//                    единого бейджа.
//
// Файл чистый (без DOM), потому что гейт проверяется и в location.ts,
// и в map.ts, и в тестах. Одна реализация вместо трёх копий условий.
// ─────────────────────────────────────────────────────────────

export interface GateContext {
  /** Активные (взятые или сданные) id квестов. */
  activeQuests: Set<string> | string[] | null | undefined;
  /** Сколько значков есть у игрока. */
  badges: number;
}

export interface GateLoc {
  requiresQuest?: string | null;
  requiresBadges?: number | null;
  [k: string]: any;
}

/** Проверка «квест взят или сдан» — та же семантика, что в quest-drops.ts. */
export function questActive(id: string, active: GateContext['activeQuests']): boolean {
  if (!id || !active) return false;
  return active instanceof Set ? active.has(id) : Array.isArray(active) && active.includes(id);
}

/**
 * Открыта ли локация. Возвращает null, если открыта, иначе — причину
 * (её показывают игроку и пишут в тост).
 */
export function locationGateReason(loc: GateLoc | null | undefined, ctx: GateContext): string | null {
  if (!loc) return null;
  if (loc.requiresBadges != null && (ctx.badges || 0) < loc.requiresBadges) {
    const need = loc.requiresBadges;
    return `Нужно ${need} значк${need === 1 ? '' : need < 5 ? 'а' : 'ов'} (есть ${ctx.badges || 0}). Сначала пройди залы.`;
  }
  if (loc.requiresQuest && !questActive(loc.requiresQuest, ctx.activeQuests)) {
    return 'Сюда пускают только по квесту. Ищи квестодателя!';
  }
  return null;
}

/** Короткая версия для UI. */
export function isLocationOpen(loc: GateLoc | null | undefined, ctx: GateContext): boolean {
  return locationGateReason(loc, ctx) === null;
}