// ─────────────────────────────────────────────────────────────
// training.ts — СТАДИИ ТРЕНИРОВОК ПОКЕМОНОВ (канон лиги)
// ─────────────────────────────────────────────────────────────
// trainingStages — массив стадий тренировки покемона.
// Каждая стадия: { name, pct, color, chance, pity }
//   name   — название стадии
//   pct    — % бонуса к тренируемому стату (3 / 6 / 10 / 14 / 18 / 20)
//   color  — цвет для UI
//   chance — шанс успеха тренировки (0.9 / 0.55 / 0.1 / 0.06 / 0.03 / 0.01)
//   pity   — наборов для гарантированного успеха (2/4/10/20/40/80),
//            умножается на коэффициент категории силы (breedRarity:
//            common/uncommon ×1, rare ×2, legendary ×3)
//
// Канон: стадии строго по порядку, стат случайный (кроме HP),
// набор одноразовый (сгорает и при неудаче).
//
// Используется:
//   battle/stats.ts → trainingPercent() — бонус к характеристикам
//   battle/core.ts  → applyTraining() — бонус к характеристикам
//   ui/inventory.ts → useItem('train') — бросок тренировки
// ─────────────────────────────────────────────────────────────
export const trainingStages = [
  { name: 'Отсутствует', pct: 0, color: '#888', chance: 0, pity: 0 },
  { name: 'Начальная', pct: 3, color: '#8090E8', chance: 0.9, pity: 2 },
  { name: 'Расширенная', pct: 6, color: '#4088D0', chance: 0.55, pity: 4 },
  { name: 'Мастерская', pct: 10, color: '#18A8C8', chance: 0.1, pity: 10 },
  { name: 'Знаменитая', pct: 14, color: '#10C048', chance: 0.06, pity: 20 },
  { name: 'Легендарная', pct: 18, color: '#E0A800', chance: 0.03, pity: 40 },
  { name: 'Именная', pct: 20, color: '#E84000', chance: 0.01, pity: 80 }
];

/** Множитель гаранта по категории силы (канон лиги: верхние пределы
 * умножаются на коэффициент категории силы покемона). */
export function trainingPityMult(rarity: string): number {
  if (rarity === 'legendary') return 3;
  if (rarity === 'rare') return 2;
  return 1;
}

/**
 * Бросок тренировки (чистая, для тестов).
 * fails — прошлых неудач подряд на этой стадии; успех если попыток
 * набралось на гарант (fails+1 >= pityAt) или повезло (rand < chance).
 */
export function rollTraining(fails: number, chance: number, pityAt: number, rand: () => number = Math.random): boolean {
  return fails + 1 >= pityAt || rand() < chance;
}