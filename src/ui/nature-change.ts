// ─────────────────────────────────────────────────────────────
// nature-change.ts — СМЕНА ХАРАКТЕРА У СТИЛИСТА (без DOM, тестируемо)
// ─────────────────────────────────────────────────────────────
// Решение хозяина: минты убраны из игры; характер меняется только
// у NPC-стилиста за деньги. Статы нигде не хранятся — считаются
// формулой calculateStat, поэтому смена natureIdx мгновенна.
// ─────────────────────────────────────────────────────────────

/** Цена сеанса стилиста в кредитах. */
export const NATURE_CHANGE_PRICE = 100000;

/**
 * Сменить характер покемона. Возвращает true если сменился
 * (индекс валиден и отличается от текущего).
 */
export function applyNatureChange(mon: any, natureIdx: unknown, natureCount: number): boolean {
  const idx = Math.floor(Number(natureIdx));
  if (!mon || !Number.isFinite(idx) || idx < 0 || idx >= natureCount) return false;
  if (mon.natureIdx === idx) return false;
  mon.natureIdx = idx;
  return true;
}

/** Хватает ли кредитов на сеанс. */
export function canAffordNatureChange(credit: unknown): boolean {
  return (Number(credit) || 0) >= NATURE_CHANGE_PRICE;
}
