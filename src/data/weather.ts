// ─────────────────────────────────────────────────────────────
// weather.ts — ПОГОДА И ЕЁ ВЛИЯНИЕ НА БОЙ
// ─────────────────────────────────────────────────────────────
// WEATHERS — все типы погоды: clear, rain, sun, sandstorm, hail
//
// weatherEffects — словарь: тип погоды → её эффекты:
//   boosts: [type]    — типы атак, которые получают ×1.5 урона
//   hinders: [type]   — типы атак, которые получают ×0.5 урона
//   moveChanges: {...} — изменения атак (напр. Thunder → 100% accuracy в rain)
//   statusChance: n   — шанс наложения статуса (sandstorm → none?)
//   damagePerTurn: n  — урон каждый ход (hail → 1/16 HP)
//
// Используется:
//   battle/logic.ts — getWeatherDamageMultiplier(), applyWeatherEffects()
//   location.ts     — updateTimeOfDay(), генерация погоды
//   battle/core.ts  — применение эффектов погоды каждый ход
// ─────────────────────────────────────────────────────────────

export const WEATHERS = ['clear', 'rain', 'sun', 'sandstorm', 'hail'] as const;
export type WeatherType = (typeof WEATHERS)[number];

export const WEATHER_ICONS: Record<string, string> = {
  clear: '☀️', rain: '🌧️', sun: '☀️', sandstorm: '🌪️', hail: '❄️',
};

export const WEATHER_NAMES: Record<string, string> = {
  clear: 'Ясно', rain: 'Дождь', sun: 'Солнце', sandstorm: 'Песчаная буря', hail: 'Град',
};

/** Deterministic daily weather based on date + location */
export function getDailyWeather(locId: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  let hash = 0;
  const str = dateStr + locId;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = (Math.abs(hash || 0) || 0) % WEATHERS.length;
  return WEATHERS[idx];
}

/** Weather damage modifier for a move type */
export function getWeatherMultiplier(moveType: string, weather: string): number {
  if (weather === 'rain') {
    if (moveType === 'water') return 1.5;
    if (moveType === 'fire') return 0.5;
  }
  if (weather === 'sun') {
    if (moveType === 'fire') return 1.5;
    if (moveType === 'water') return 0.5;
  }
  if (weather === 'sandstorm' && moveType === 'rock') return 1.5;
  if (weather === 'hail' && moveType === 'ice') return 1.5;
  return 1.0;
}
