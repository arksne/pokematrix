// ─────────────────────────────────────────────────────────────
// shadow-items.ts — ТЕНЬ: убранные из игры предметы (решение хозяина)
// ─────────────────────────────────────────────────────────────
// Сюда переносятся предметы по команде «убери»: строка целиком из
// items.ts + откуда убран (маркет/дроп/цены). Из тени предмет можно
// достать обратно за минуту — данные не теряются.
//
// ПРАВИЛА:
//   - id из тени НЕ должен быть в ITEMS, SHOP_STOCK, drops.js,
//     серверных ценах (следит item-audit, проверка I-shadow);
//   - возврат: перенести строку обратно в items.ts + маркет/цены,
//     убрать id из SHADOW_IDS, прогнать аудит.
//
// История жёстких удалений (до введения тени) — в git, всё доставаемо:
//   valuable 44 ......... commit 809ed3c
//   balls 19 ............ commit 4970f4f
//   balls 5 ............. commit 3d180e4
//   berries 35 .......... commit 30775f1
//   berries 11 .......... commit cdf44c9
//   cooking 25 .......... commit b691140
//   mulch 8 ............. commit d97cc29
//   battle dead 8 ....... commit 16c97f5
//   battle shields 5 .... commit d32913e
//   battle mid 20 ....... commit e33c920
// ─────────────────────────────────────────────────────────────

/** ID предметов, лежащих в тени. Аудит следит, что их нет в игре. */
export const SHADOW_IDS: string[] = [
  'ironBall',
  'laggingTail',
  'lightClay',
  'smokeBall',
  'shedShell',
  'wideLens',
  'luckyPunch',
];

/** Полные дефы убранных предметов (копия строк из items.ts на момент уборки). */
export const SHADOW_ITEMS: Array<{
  id: string;
  def: string;
  removedFrom: string[];
  commit: string;
}> = [
  { id: 'ironBall', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'ironBall', nameRu: 'Железный Шар', category: 'battle', price: 4000, sellPrice: 2000, isUsable: false, implemented: true },` },
  { id: 'laggingTail', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'laggingTail', nameRu: 'Медлительный Хвост', category: 'battle', desc: 'Held: Holder moves last in its priority bracket.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'lightClay', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'lightClay', nameRu: 'Лёгкая Глина', category: 'battle', desc: 'Held: Light Screen and Reflect used by the holder last 8 rounds instead of 5.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'luckyPunch', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'luckyPunch', nameRu: 'Lucky Punch', category: 'battle', desc: 'Raises Chansey’s critical hit ratio by two stages.', price: 1000, sellPrice: 500, isUsable: true, implemented: true },` },
  { id: 'shedShell', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'shedShell', nameRu: 'Сброшенная Оболочка', category: 'battle', desc: 'Held: Holder can bypass all trapping effects and switch out.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'smokeBall', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'smokeBall', nameRu: 'Дымовой Шар', category: 'battle', desc: 'Held: Allows the Holder to escape from any wild battle.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'wideLens', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'wideLens', nameRu: 'Широкая Линза', category: 'battle', desc: 'Held: Provides a 1/10 (10%) boost in accuracy to the holder.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  // пример:
  // { id: 'pinkNectar', def: `{ id: 'pinkNectar', ... }`, removedFrom: ['items', 'shops', 'economy'], commit: '16c97f5' },
];

