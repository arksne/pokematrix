// ─────────────────────────────────────────────────────────────
// ПОРЯДОК ЗНАЧКОВ И ГЕЙТ КВЕСТОВ ПО ПРОГРЕССИИ
// ─────────────────────────────────────────────────────────────
// Квесты больше не доступны все сразу: город N открывается после N-1 значка.
// Порядок городов = порядок гимов (уровни лидеров 40 → 100), и он совпадает
// в трёх местах: определение в data/gyms.ts, выдача в server/routes/economy.ts
// и docs/QUESTS-LADDER.md.
//
// ВАЖНО: в state.badges значки лежат в ПОРЯДКЕ ПОЛУЧЕНИЯ (push), а не
// каноническом. Поэтому индекс значка берём отсюда, а не из массива игрока.

/** Канонический порядок значков: индекс+1 = «сколько значков нужно». */
export const BADGE_ORDER: string[] = [
  'Boulder Badge', 'Cascade Badge', 'Thunder Badge', 'Rainbow Badge',
  'Soul Badge', 'Marsh Badge', 'Volcano Badge', 'Earth Badge',
  'Zephyr Badge', 'Hive Badge', 'Plain Badge', 'Fog Badge',
  'Storm Badge', 'Mineral Badge', 'Glacier Badge', 'Rising Badge',
];

/** Префикс id квеста → город. По нему и считаем гейт. */
export const CITY_PREFIXES: string[] = [
  'pw', 'cer', 'ver', 'cel', 'saf', 'fuc', 'cin', 'vir',
  'vio', 'aza', 'gol', 'ecr', 'cia', 'oli', 'mah', 'bla',
];

/**
 * Посылочные/караванные квесты гейтом НЕ закрываются.
 *
 * Почему: они сдаются в СЛЕДУЮЩЕМ городе (aza_courier → Голденрод,
 * gol_courier → Эйкрутик, bla_caravan → Плато Индиго). Если закрыть город
 * по значкам, игрок останется с посылкой в руках и без кнопки «Сдать».
 */
export function isCourierQuest(questId: string): boolean {
  const id = String(questId || '').toLowerCase();
  return id.includes('courier') || id.includes('caravan') || id === 'oli_potion';
}

/** Количество значков у игрока (только канонические). */
export function earnedBadgeCount(badges: unknown): number {
  if (!Array.isArray(badges)) return 0;
  const owned = new Set<string>(badges.filter((b) => typeof b === 'string'));
  return BADGE_ORDER.filter((b) => owned.has(b)).length;
}

/**
 * Сколько значков нужно, чтобы квест был открыт.
 * null = квест открыт всегда (обучение, посылки, неизвестный префикс).
 */
export function questRequiredBadges(questId: string): number | null {
  const id = String(questId || '').toLowerCase();
  // Обучение открыто всегда: tutorial_6 — единственный ключ к гейту карты.
  if (id.startsWith('tutorial_')) return null;
  if (isCourierQuest(id)) return null;
  const prefix = id.split('_')[0];
  const idx = CITY_PREFIXES.indexOf(prefix);
  if (idx < 0) return null;          // неизвестный префикс — не ломаем игру
  return idx;                          // город 1 (Пьютер) → 0 значков
}

/** Открыт ли квест при текущем числе значков. */
export function isQuestUnlocked(questId: string, badges: unknown): boolean {
  const need = questRequiredBadges(questId);
  if (need == null) return true;
  return earnedBadgeCount(badges) >= need;
}

/** Подсказка для закрытого квеста. */
export function questLockHint(questId: string, badges: unknown): string {
  const need = questRequiredBadges(questId);
  if (need == null) return '';
  const have = earnedBadgeCount(badges);
  if (have >= need) return '';
  const left = need - have;
  const plural = (n: number) => (n === 1 ? 'значок' : n < 5 ? 'значка' : 'значков');
  return `🔒 Нужно ${need} ${plural(need)}, осталось ${left} ${plural(left)}. Пройди залы!`;
}