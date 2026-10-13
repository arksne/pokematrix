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
  'typeCandy',
  'adamantMint',
  'boldMint',
  'braveMint',
  'calmMint',
  'carefulMint',
  'gentleMint',
  'hastyMint',
  'impishMint',
  'jollyMint',
  'laxMint',
  'lonelyMint',
  'mildMint',
  'modestMint',
  'naiveMint',
  'naughtyMint',
  'quietMint',
  'rashMint',
  'relaxedMint',
  'sassyMint',
  'seriousMint',
  'timidMint',
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
  { id: 'bugGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'bugGem', nameRu: 'Самоцвет Жука', category: 'battle', desc: 'Held: When the holder uses a damaging Bug-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/bug-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'darkGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'darkGem', nameRu: 'Самоцвет Тьмы', category: 'battle', desc: 'Held: When the holder uses a damaging Dark-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dark-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'dragonGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'dragonGem', nameRu: 'Самоцвет Дракона', category: 'battle', desc: 'Held: When the holder uses a damaging Dragon-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'electricGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'electricGem', nameRu: 'Самоцвет Электричества', category: 'battle', desc: 'Held: When the holder uses a damaging Electric-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/electric-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'fairyGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'fairyGem', nameRu: 'Самоцвет Феи', category: 'battle', desc: 'Held: When the holder uses a damaging Fairy move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fairy-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'fightingGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'fightingGem', nameRu: 'Самоцвет Боя', category: 'battle', desc: 'Held: When the holder uses a damaging Fighting-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fighting-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'fireGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'fireGem', nameRu: 'Самоцвет Огня', category: 'battle', desc: 'Held: When the holder uses a damaging Fire-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fire-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'flyingGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'flyingGem', nameRu: 'Самоцвет Птицы', category: 'battle', desc: 'Held: When the holder uses a damaging Flying-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/flying-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'ghostGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'ghostGem', nameRu: 'Самоцвет Призрака', category: 'battle', desc: 'Held: When the holder uses a damaging Ghost-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ghost-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'grassGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'grassGem', nameRu: 'Самоцвет Травы', category: 'battle', desc: 'Held: When the holder uses a damaging Grass-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/grass-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'groundGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'groundGem', nameRu: 'Самоцвет Земли', category: 'battle', desc: 'Held: When the holder uses a damaging Ground-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ground-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'iceGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'iceGem', nameRu: 'Самоцвет Льда', category: 'battle', desc: 'Held: When the holder uses a damaging Ice-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ice-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'normalGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'normalGem', nameRu: 'Самоцвет Нормала', category: 'battle', desc: 'Held: When the holder uses a damaging Normal-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/normal-gem.png', spriteType: 'pokeapi', price: 4000, sellPrice: 2000, isUsable: true, isBall: false, implemented: true },` },
  { id: 'poisonGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'poisonGem', nameRu: 'Самоцвет Яда', category: 'battle', desc: 'Held: When the holder uses a damaging Poison-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poison-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'psychicGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'psychicGem', nameRu: 'Самоцвет Психики', category: 'battle', desc: 'Held: When the holder uses a damaging Psychic-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/psychic-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'rockGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'rockGem', nameRu: 'Самоцвет Камня', category: 'battle', desc: 'Held: When the holder uses a damaging Rock-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rock-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'steelGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'steelGem', nameRu: 'Самоцвет Стали', category: 'battle', desc: 'Held: When the holder uses a damaging Steel-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/steel-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'waterGem', commit: '31f48b8', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'waterGem', nameRu: 'Самоцвет Воды', category: 'battle', desc: 'Held: When the holder uses a damaging Water-type move, the move has 1.5× power and this item is consumed.', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/water-gem.png', spriteType: 'pokeapi', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },` },
  { id: 'adamantMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'adamantMint', nameRu: 'Adamant Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/adamant-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'boldMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'boldMint', nameRu: 'Bold Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/bold-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'braveMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'braveMint', nameRu: 'Brave Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/brave-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'calmMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'calmMint', nameRu: 'Calm Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/calm-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'carefulMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'carefulMint', nameRu: 'Careful Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/careful-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'gentleMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'gentleMint', nameRu: 'Gentle Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/gentle-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'hastyMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'hastyMint', nameRu: 'Hasty Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/hasty-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'impishMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'impishMint', nameRu: 'Impish Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/impish-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'jollyMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'jollyMint', nameRu: 'Jolly Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/jolly-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'laxMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'laxMint', nameRu: 'Lax Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lax-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'lonelyMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'lonelyMint', nameRu: 'Lonely Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lonely-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'mildMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'mildMint', nameRu: 'Mild Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mild-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'modestMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'modestMint', nameRu: 'Modest Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/modest-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'naiveMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'naiveMint', nameRu: 'Naive Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/naive-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'naughtyMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'naughtyMint', nameRu: 'Naughty Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/naughty-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'quietMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'quietMint', nameRu: 'Quiet Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quiet-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'rashMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'rashMint', nameRu: 'Rash Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rash-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'relaxedMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'relaxedMint', nameRu: 'Relaxed Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/relaxed-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'sassyMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'sassyMint', nameRu: 'Sassy Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sassy-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'seriousMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'seriousMint', nameRu: 'Serious Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/serious-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'timidMint', commit: 'PENDING-MINTS', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'timidMint', nameRu: 'Timid Mint', category: 'other', desc: '', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/timid-mint.png', spriteType: 'pokeapi', price: 20, sellPrice: 10, isUsable: false, isBall: false, implemented: true },` },
  { id: 'typeCandy', commit: 'PENDING-TYPECANDY', removedFrom: ['items', 'shops', 'economy'], def: `{ id: 'typeCandy', nameRu: 'Типовая конфета', category: 'vitamins', desc: '+1 уровень, +3 EV в пул. Пока без ограничения по типу (TODO).', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/berry-juice.png', spriteType: 'pokeapi', price: 15000, sellPrice: 7500, isUsable: true, isBall: false, implemented: true },` },
  // пример:
  // { id: 'pinkNectar', def: `{ id: 'pinkNectar', ... }`, removedFrom: ['items', 'shops', 'economy'], commit: '16c97f5' },
];

