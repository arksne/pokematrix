// ─────────────────────────────────────────────────────────────
// item-effects.ts — ТАБЛИЦЫ ЭФФЕКТОВ ПРЕДМЕТОВ (аудит итемов)
// ─────────────────────────────────────────────────────────────
// Листовой модуль (зависимостей нет): его тянут и inventory.ts (рюкзак),
// и battle/core.ts (бой) без циклов импорта. Значения — канон из desc.
// Тесты покрытия: src/ui/__tests__/items-coverage.test.ts.
// ─────────────────────────────────────────────────────────────

/** Лечилки HP: id → HP (число) или 'full' */
export const HEAL_HP: Record<string, number | 'full'> = {
  potion: 20,
  superPotion: 50,
  hyperPotion: 200,
  maxPotion: 'full',
  freshWater: 50,
  sodaPop: 60,
  lemonade: 80,
  moomooMilk: 100,
  energyPowder: 60,
  energyRoot: 200,
  berryJuice: 20,
  sweetHeart: 20,
};

/** Одиночные лечилки статуса: id → код статуса */
export const CURE_ONE: Record<string, string> = {
  antidote: 'psn',
  paralyzeHeal: 'par',
  awakening: 'slp',
  burnHeal: 'brn',
  iceHeal: 'frz',
  cheriBerry: 'par',
  chestoBerry: 'slp',
  pechaBerry: 'psn',
  rawstBerry: 'brn',
  aspearBerry: 'frz',
};

/** Лечилки всех статусов разом */
export const CURE_ALL: string[] = [
  'fullHeal', 'healPowder', 'lavaCookie', 'bigMalasada', 'casteliacone',
  'lumioseGalette', 'oldGateau', 'pewterCrunchies', 'shalourSable',
  'healingHerb', 'lumBerry',
];

/** EXP-конфеты: id → опыт (канон) */
export const EXP_CANDY_XP: Record<string, number> = {
};

/** Крылья: id → EV-стат (+1, канон) */
export const WING_EV: Record<string, string> = {
  healthWing: 'hp',
  muscleWing: 'atk',
  resistWing: 'def',
  geniusWing: 'spa',
  cleverWing: 'spd',
  swiftWing: 'spe',
};

/** Ягоды с немедленным эффектом при ручной выдаче (остальные — только held) */
export const BERRY_MANUAL: string[] = [
  'sitrusBerry', 'oranBerry', 'lumBerry', 'chestoBerry', 'rawstBerry',
  'cheriBerry', 'pechaBerry', 'aspearBerry', 'leppaBerry',
];

/** Воскрешение: id → 'half' | 'full' | 'team' */
export const REVIVE_MODE: Record<string, 'half' | 'full' | 'team'> = {
  revive: 'half',
  revivalHerb: 'half',
  maxRevive: 'full',
  maxHoney: 'full',
  sacredAsh: 'team',
};
