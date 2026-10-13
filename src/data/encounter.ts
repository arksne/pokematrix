// ─────────────────────────────────────────────────────────────
// encounter.ts — ЧАСТОТА ДИКИХ ЭНКАУНТЕРОВ (H1)
// ─────────────────────────────────────────────────────────────
// Листовой модуль (без циклов): state + REGIONS.
// Приоритет ставки: кастом админки (state.customEncounterRates) →
// encounterRate в данных локи → дефолт 0.20.
//
// Используется:
//   battle/core.ts → startAutoHunt (каждый тик)
//   ui/location.ts → реэкспорт для совместимости
//   ui/admin.ts    → редактор ставок по локам
// ─────────────────────────────────────────────────────────────
import { state } from '../game/state.js';
import { REGIONS } from './regions.js';

export function findLocation(locId: string): any | null {
  for (const region of Object.values(REGIONS) as any[]) {
    if (region?.locations?.[locId]) return region.locations[locId];
  }
  return null;
}

export function listLocations(): Array<{ id: string; name: string; region: string }> {
  const out: Array<{ id: string; name: string; region: string }> = [];
  for (const [regionKey, region] of Object.entries(REGIONS) as any[]) {
    for (const [locId, loc] of Object.entries(region?.locations || {}) as any[]) {
      out.push({ id: locId, name: loc?.name || locId, region: regionKey });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function getEncounterRate(locId: string | null | undefined): number {
  if (locId && state.customEncounterRates && typeof state.customEncounterRates[locId] === 'number') {
    const v = state.customEncounterRates[locId];
    if (v >= 0 && v <= 1) return v;
  }
  const loc = locId ? findLocation(locId) : null;
  const dataRate = loc?.encounterRate;
  if (typeof dataRate === 'number' && dataRate >= 0 && dataRate <= 1) return dataRate;
  return 0.20;
}

/**
 * effectiveEncounterRate — шанс с учётом расходников:
 * репеллент глушит встречи в ноль, приманка/флейта умножают.
 * Чисто от мира, но читает счётчики state (тесты подменяют объект).
 */
export function effectiveEncounterRate(base: number, st: { repelHunts?: number; lureHunts?: number; lureMult?: number } = state): number {
  if ((st.repelHunts || 0) > 0) return 0;
  if ((st.lureHunts || 0) > 0) return Math.min(1, base * (st.lureMult || 1));
  return base;
}

/** tickEncounterCounters — одна попытка охоты съедает заряд. */
export function tickEncounterCounters(st: { repelHunts?: number; lureHunts?: number; lureMult?: number } = state): void {
  if ((st.repelHunts || 0) > 0) st.repelHunts!--;
  else if ((st.lureHunts || 0) > 0) {
    st.lureHunts!--;
    if (st.lureHunts! <= 0) st.lureMult = 1;
  }
}
