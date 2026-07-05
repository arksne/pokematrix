/**
 * ============================================================
 * drops.ts — ТАБЛИЦА ДРОПА ПОКЕМОНОВ
 * ============================================================
 * 🔹 Формат: MONSTER_DROP_TABLE[pokemonId] = [{ item, chance, qty }]
 * 🔹 Используется: core.ts (получение лута после победы)
 * ============================================================
 */
export const MONSTER_DROP_TABLE: Record<string, Array<{item: string, chance: number, qty: number}>> = {
  abomasnow: [{ item: 'neverMeltIce', chance: 0.05, qty: 1 }],
  abra: [{ item: 'twistedSpoon', chance: 0.05, qty: 1 }],
  // ... ~1300 entries
};
