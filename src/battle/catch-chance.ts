/**
 * Шанс поимки дикого покемона (броском шара).
 *
 * Раньше формула жила внутри обработчика кнопки в battle/core.ts и не была
 * покрыта тестами. При выносе нашёлся реальный баг: Мастер-Болл, по описанию
 * «Catches a wild Pokémon every time», давал максимум 95% — общий потолок
 * Math.min(0.95, …) применялся и к нему. Мастер-Болл — редчайшая награда
 * (арена, стрик 5+, дроп легенд 3%), и 1 шанс из 20 упустить покемона —
 * недопустимо. Теперь для него гарантия.
 *
 * Формула (как была в игре, без изменений для остальных шаров):
 *   rate = (3*maxHP - 2*curHP) / (3*maxHP) * speciesRate * ballMult
 *   rate *= статус (сон/заморозка ×2.5, яд/ожог/паралич ×1.5)
 *   rate *= спец-эффекты (quick ×5 на первом ходу, dusk ×3 ночью,
 *           timer ×(1 + 0.3·ход), love ×8 при противоположном поле,
 *           net ×3 по water/bug, nest ×(40−уровень)/10 (мин ×1),
 *           repeat ×3 по уже пойманному виду)
 *   chance = min(0.95, rate / 255)
 */

export interface CatchContext {
  /** Максимальное HP дикого. */
  wildMaxHp: number;
  /** Текущее HP дикого. */
  wildCurHp: number;
  /** capture_rate вида из PokeAPI (3–255). */
  speciesRate?: number | null;
  /** Множитель шара (PokeBall ×1, GreatBall ×1.5, UltraBall ×2, MasterBall 255). */
  ballMult?: number | null;
  /** id выбранного шара — для спец-эффектов и Мастер-Болла. */
  item?: string | null;
  /** Статус дикого: slp/frz/par/brn/psn/… */
  wildStatus?: string | null;
  /** Номер хода боя (Quick Ball — только первый). */
  battleRound?: number | null;
  /** День ли сейчас (Dusk Ball ×3 ночью). */
  isDaytime?: boolean | null;
  /** Love Ball: пол дикого и пол активного покемона игрока (если известны). */
  wildGender?: string | null;
  playerGender?: string | null;
  /** Типы дикого (Net Ball: ×3 для водных/жукоподобных). */
  wildTypes?: string[] | null;
  /** Уровень дикого (Nest Ball: сильнее на слабых). */
  wildLevel?: number | null;
  /** Вид уже ловили раньше — есть в Покедексе (Repeat Ball: ×3). */
  alreadyCaught?: boolean | null;
}

/** Потолок шанса для обычных шаров (как в исходной формуле). */
export const CATCH_CHANCE_CAP = 0.95;
/** Базовая константа формулы. */
const CATCH_RATE_DIVISOR = 255;

/**
 * Шанс поимки 0..1. Мастер-Болл — всегда 1 (гарантированная поимка).
 * Возвращает 0 при некорректных HP (бой ещё не инициализирован).
 */
export function catchChance(ctx: CatchContext): number {
  const maxHp = Number(ctx?.wildMaxHp);
  const curHp = Number(ctx?.wildCurHp);
  if (!Number.isFinite(maxHp) || maxHp <= 0) return 0;
  if (!Number.isFinite(curHp)) return 0;

  // Мастер-Болл: «ловит всегда». Ставим до общей формулы, иначе потолок 95%
  // (и шанс вида) режут гарантию.
  if (ctx.item === 'masterBall') return 1;

  const speciesRate = Number(ctx.speciesRate) > 0 ? Number(ctx.speciesRate) : 100;
  const ballMult = Number(ctx.ballMult) > 0 ? Number(ctx.ballMult) : 1;

  const hpFactor = (3 * maxHp - 2 * Math.max(0, curHp)) / (3 * maxHp);
  let rate = hpFactor * speciesRate * ballMult;

  // Статус: сон/заморозка лучший бонус, остальные — средний.
  if (ctx.wildStatus === 'slp' || ctx.wildStatus === 'frz') rate *= 2.5;
  else if (ctx.wildStatus === 'par' || ctx.wildStatus === 'brn' || ctx.wildStatus === 'psn') rate *= 1.5;

  // Спец-эффекты шаров.
  if (ctx.item === 'quickBall' && (ctx.battleRound ?? 0) < 1) rate *= 5;
  if (ctx.item === 'duskBall' && ctx.isDaytime === false) rate *= 3;
  if (ctx.item === 'timerBall') rate *= 1 + (ctx.battleRound ?? 0) * 0.3;
  if (ctx.item === 'loveBall' && ctx.wildGender && ctx.playerGender && ctx.wildGender !== ctx.playerGender) {
    rate *= 8;
  }

  // Net Ball: ×3 на водных и жуках (описание вида обещает именно это, а шар
  // продавался как обычный Поке-Болл).
  if (ctx.item === 'netBall') {
    const types = (ctx.wildTypes || []).map((t) => String(t || '').toLowerCase());
    if (types.includes('water') || types.includes('bug')) rate *= 3;
  }

  // Nest Ball: чем слабее дикий, тем лучше — (40 − уровень)/10, минимум ×1
  // (на Lv1 это ×3.9, как в описании).
  if (ctx.item === 'nestBall') {
    const level = Number(ctx.wildLevel);
    if (Number.isFinite(level)) rate *= Math.max(1, (40 - level) / 10);
  }

  // Repeat Ball: ×3 на вид, который уже ловили (есть в Покедексе).
  if (ctx.item === 'repeatBall' && ctx.alreadyCaught === true) rate *= 3;

  const chance = rate / CATCH_RATE_DIVISOR;
  if (!Number.isFinite(chance) || chance <= 0) return 0;
  return Math.min(CATCH_CHANCE_CAP, chance);
}
