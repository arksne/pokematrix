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
  'bugGem',
  'darkGem',
  'dragonGem',
  'electricGem',
  'fairyGem',
  'fightingGem',
  'fireGem',
  'flyingGem',
  'ghostGem',
  'grassGem',
  'groundGem',
  'iceGem',
  'normalGem',
  'poisonGem',
  'psychicGem',
  'rockGem',
  'steelGem',
  'waterGem',
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
}>= [
  { id: 'ironBall', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'ironBall', nameRu: 'Железный Шар', category: 'battle', price: 4000, sellPrice: 2000, isUsable: false, implemented: true },` },
  { id: 'laggingTail', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'laggingTail', nameRu: 'Медлительный Хвост', category: 'battle', desc: 'Held: Holder moves last in its priority bracket.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'lightClay', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'lightClay', nameRu: 'Лёгкая Глина', category: 'battle', desc: 'Held: Light Screen and Reflect used by the holder last 8 rounds instead of 5.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'luckyPunch', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'luckyPunch', nameRu: 'Lucky Punch', category: 'battle', desc: 'Raises Chansey’s critical hit ratio by two stages.', price: 1000, sellPrice: 500, isUsable: true, implemented: true },` },
  { id: 'shedShell', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'shedShell', nameRu: 'Сброшенная Оболочка', category: 'battle', desc: 'Held: Holder can bypass all trapping effects and switch out.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'smokeBall', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'smokeBall', nameRu: 'Дымовой Шар', category: 'battle', desc: 'Held: Allows the Holder to escape from any wild battle.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'wideLens', commit: 'af108bd', removedFrom: ['items', 'shops', 'economy', 'drops'], def: `{ id: 'wideLens', nameRu: 'Широкая Линза', category: 'battle', desc: 'Held: Provides a 1/10 (10%) boost in accuracy to the holder.', price: 4000, sellPrice: 2000, isUsable: true, implemented: true },` },
  { id: 'bugGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'bugGem', nameRu: 'Самоцвет Жука', category: 'battle', desc: 'Held: When the holder uses a damaging Bug-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/bug-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'darkGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'darkGem', nameRu: 'Самоцвет Тьмы', category: 'battle', desc: 'Held: When the holder uses a damaging Dark-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dark-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'dragonGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'dragonGem', nameRu: 'Самоцвет Дракона', category: 'battle', desc: 'Held: When the holder uses a damaging Dragon-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'electricGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'electricGem', nameRu: 'Самоцвет Электричества', category: 'battle', desc: 'Held: When the holder uses a damaging Electric-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/electric-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'fairyGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'fairyGem', nameRu: 'Самоцвет Феи', category: 'battle', desc: 'Held: When the holder uses a damaging Fairy move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fairy-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'fightingGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'fightingGem', nameRu: 'Самоцвет Боя', category: 'battle', desc: 'Held: When the holder uses a damaging Fighting-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fighting-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'fireGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'fireGem', nameRu: 'Самоцвет Огня', category: 'battle', desc: 'Held: When the holder uses a damaging Fire-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fire-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'flyingGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'flyingGem', nameRu: 'Самоцвет Птицы', category: 'battle', desc: 'Held: When the holder uses a damaging Flying-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/flying-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'ghostGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'ghostGem', nameRu: 'Самоцвет Призрака', category: 'battle', desc: 'Held: When the holder uses a damaging Ghost-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ghost-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'grassGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'grassGem', nameRu: 'Самоцвет Травы', category: 'battle', desc: 'Held: When the holder uses a damaging Grass-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/grass-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'groundGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'groundGem', nameRu: 'Самоцвет Земли', category: 'battle', desc: 'Held: When the holder uses a damaging Ground-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ground-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'iceGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'iceGem', nameRu: 'Самоцвет Льда', category: 'battle', desc: 'Held: When the holder uses a damaging Ice-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ice-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'normalGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'normalGem', nameRu: 'Самоцвет Нормала', category: 'battle', desc: 'Held: When the holder uses a damaging Normal-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/normal-gem.png', spriteType: 'pokeapi', price: 4000, sellPrice: 2000, isUsable: true, isBall: false, implemented: true },` },
  { id: 'poisonGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'poisonGem', nameRu: 'Самоцвет Яда', category: 'battle', desc: 'Held: When the holder uses a damaging Poison-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poison-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'psychicGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'psychicGem', nameRu: 'Самоцвет Психики', category: 'battle', desc: 'Held: When the holder uses a damaging Psychic-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/psychic-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'rockGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'rockGem', nameRu: 'Самоцвет Камня', category: 'battle', desc: 'Held: When the holder uses a damaging Rock-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rock-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'steelGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'steelGem', nameRu: 'Самоцвет Стали', category: 'battle', desc: 'Held: When the holder uses a damaging Steel-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/steel-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'waterGem', commit: 'PENDING-GEMS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'waterGem', nameRu: 'Самоцвет Воды', category: 'battle', desc: 'Held: When the holder uses a damaging Water-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/water-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  // пример:
  // { id: 'pinkNectar', def: `{ id: 'pinkNectar', ... }`, removedFrom: ['items', 'shops', 'economy'], commit: '16c97f5' },
];

