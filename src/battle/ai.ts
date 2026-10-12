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
  banned,
}: {
  moves: any[];
  movesPP: any[];
  attacker: any;
  defender: any;
  isTrainer: boolean;
  getTypeMultiplier: (type: string, defenderTypes: any[]) => number;
  /** Запрещённые слаги (imprison): ИИ их не выбирает, берёт другое. */
  banned?: string[];
}) {
  if (!moves || moves.length === 0) return null; // Нет атак — возвращаем null
  // Imprison: выкидываем запрещённые из пула (с сохранением индексов)
  let pool = moves.map((m, i) => ({ m, i }));
  if (Array.isArray(banned) && banned.length > 0) {
    const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const rest = pool.filter(({ m }) => !banned.includes(norm(m?.name)));
    if (rest.length > 0) pool = rest;
    // Все запрещены — бьём чем есть (не стоим столбом)
  }

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
    for (const { m, i } of pool) {
      if (!m) continue;
      const hasPP = movesPP && movesPP[i] && movesPP[i].current > 0;
      if (!hasPP) continue; // Пропускаем атаки без PP
      const power = m.power || 1;
      // STAB: если тип атаки совпадает с одним из типов покемона
      const stab = (attacker.types || []).some(t => t.type?.name === m.type?.name) ? 1.5 : 1.0;
      // Type effectiveness против защищающегося
      const mult = getTypeMultiplier(m.type.name, defender.apiData?.types || defender.types || []);
      // Статус-атаки (без power): self-target (Swords Dance) — 80, debuff (Growl) — 60
      const score = m.power ? power * stab * mult : (m.target?.name === 'user' ? 80 : 60);
      if (score > bestScore) { bestScore = score; chosenMove = m; chosenIdx = i; }
    }
  } else {
    // ═══ WILD AI (случайный выбор) ═══
    // Просто выбирает случайную атаку с PP > 0
    // Делает до 20 попыток чтобы не зациклиться
    for (let attempt = 0; attempt < 20; attempt++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!pick) continue;
      const { m, i: idx } = pick;
      if (m) {
        if (movesPP && movesPP[idx] && movesPP[idx].current <= 0) continue; // Нет PP — пропускаем
        chosenMove = m;
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
