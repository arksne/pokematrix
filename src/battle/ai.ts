// ─────────────────────────────────────────────────────────────
// ai.ts — ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ ПРОТИВНИКА
// ─────────────────────────────────────────────────────────────
// Выбор атаки для врага (чистая функция — без сайд-эффектов).
//
// Два режима:
//   Trainer (isTrainer = true):  умный AI — выбирает атаку с макс. уроном
//     Считает score = power × STAB × typeMultiplier
//     Status-атаки: score = 60 × typeMultiplier
//   Wild (isTrainer = false): случайная атака с доступным PP
//
// ИСПОЛЬЗУЕТСЯ В: core.ts → enemyTurn() — для выбора атаки врага
// ЗАВИСИМОСТИ: getTypeMultiplier из logic.ts (передаётся параметром)
// ─────────────────────────────────────────────────────────────

/**
 * selectEnemyMove — выбрать атаку для врага на основе ситуации.
 *
 * ЧТО ДЕЛАЕТ:
 *   Для trainer (Gym/Elite): выбирает атаку с максимальным score.
 *     Score = power × STAB (1.5 если тип совпадает) × type multiplier (0-4)
 *     Для статус-атак без power: score = 60 × typeMult (базовый приоритет)
 *   Для wild: случайная атака из доступных (с PP > 0)
 *
 * ЧТО ПРИНИМАЕТ:
 *   moves — массив MoveData (из PokeAPI, через S.wildMovesDetailed)
 *   movesPP — массив { current, max } для проверки PP
 *   attacker — объект дикого покемона (для определения типов)
 *   defender — объект покемона игрока (для типов защиты)
 *   isTrainer — true для gym/elite AI, false для wild
 *   getTypeMultiplier — функция из logic.ts
 *
 * ЧТО ВОЗВРАЩАЕТ:
 *   { move: MoveData, index: number } | null
 *   Если не выбрал — fallback атака с power: 30
 *
 * ИСПОЛЬЗУЕТСЯ В: core.ts enemyTurn() строка ~1855
 */
export function selectEnemyMove({
  moves,
  movesPP,
  attacker,
  defender,
  isTrainer,
  getTypeMultiplier,
}) {
  if (!moves || moves.length === 0) return null; // Нет атак — возвращаем null

  let chosenMove = null;
  let chosenIdx = -1;

  if (isTrainer) {
    // ═══ SMART AI (Gym/Elite/Champion) ═══
    // Выбирает атаку с максимальным score:
    //   Для атак с уроном: score = power × STAB × typeEffectiveness
    //   Для статус-атак: score = 60 × typeEffectiveness
    // STAB (Same-Type Attack Bonus): ×1.5 если тип атаки совпадает с типом покемона
    // typeEffectiveness: ×0, ×0.5, ×1, ×2, ×4 (из TYPE_CHART)
    let bestScore = -1;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (!m) continue;
      const hasPP = movesPP && movesPP[i] && movesPP[i].current > 0;
      if (!hasPP) continue; // Пропускаем атаки без PP
      const power = m.power || 1;
      // STAB: если тип атаки совпадает с одним из типов покемона
      const stab = (attacker.types || []).some(t => t.type?.name === m.type?.name) ? 1.5 : 1.0;
      // Type effectiveness против защищающегося
      const mult = getTypeMultiplier(m.type.name, defender.apiData?.types || defender.types || []);
      // Статус-атаки (без power) имеют базовый score 60 × effectiveness
      const score = m.power ? power * stab * mult : 60 * mult;
      if (score > bestScore) { bestScore = score; chosenMove = m; chosenIdx = i; }
    }
  } else {
    // ═══ WILD AI (случайный выбор) ═══
    // Просто выбирает случайную атаку с PP > 0
    // Делает до 20 попыток чтобы не зациклиться
    for (let attempt = 0; attempt < 20; attempt++) {
      const idx = Math.floor(Math.random() * moves.length);
      if (moves[idx]) {
        if (movesPP && movesPP[idx] && movesPP[idx].current <= 0) continue; // Нет PP — пропускаем
        chosenMove = moves[idx];
        chosenIdx = idx;
        break;
      }
    }
  }

  // Fallback: если AI не выбрал атаку — используем базовую "Атаку" (Struggle)
  if (!chosenMove) {
    chosenMove = { power: 30, damage_class: { name: 'physical' }, type: { name: 'normal' }, name: 'Атака' };
  }

  return { move: chosenMove, index: chosenIdx };
}
