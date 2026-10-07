// ─────────────────────────────────────────────────────────────
// shops.ts — МАГАЗИНЫ В ЛОКАЦИЯХ
// ─────────────────────────────────────────────────────────────
// SHOP_STOCK — словарь: ID локации → список предметов на продаже.
// Если локация не указана — продаются ВСЕ предметы с price > 0.
// Если указана — только эти (ограниченный ассортимент).
//
// pokemonMarts — массив ID локаций, где есть маркет (Poke Mart).
// buyPrices — множители цен покупки (стандарт).
// sellPrices — множители цен продажи.
//
// Используется:
//   shop.ts     → отображение магазина в UI
//   getters.ts  → getShopState() — данные для UI магазина
//   items.ts    → price/sellPrice для каждого предмета
// ─────────────────────────────────────────────────────────────
// Add only locations that should have RESTRICTED stock.
//
export const SHOP_STOCK = {
  // ── Kanto ──
  'cerulean_pokemarket': [
    'pokeBall', 'greatBall', 'potion', 'superPotion',
    'antidote', 'paralyzeHeal', 'awakening', 'burnHeal', 'antiSputin',
    'oranBerry', 'chestoBerry', 'rawstBerry', 'sitrusBerry',
    'xAttack', 'xDefense', 'xSpeed',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'vermilion_pokemarket': [
    'pokeBall', 'greatBall', 'potion', 'superPotion',
    'antidote', 'paralyzeHeal',
    'oranBerry', 'chestoBerry', 'rawstBerry',
    'xAttack', 'xDefense',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  // Стартовый магазин у Goldenrod: шары и база. Без этой записи витрина
  // показывала бы все ~100 ценников, а кнопки «Магазин» тут не было вовсе.
  'pokemart': [
    'pokeBall', 'greatBall', 'ultraBall',
    'potion', 'superPotion',
    'vanillaCandy', 'commonCandy', 'typeCandy', 'rareCandy',
    'antidote', 'paralyzeHeal', 'awakening', 'burnHeal',
    'oranBerry', 'chestoBerry', 'rawstBerry', 'sitrusBerry',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'lavender_pokemarket': [
    'pokeBall', 'greatBall', 'ultraBall', 'potion', 'superPotion', 'fullRestore',
    'antidote', 'paralyzeHeal', 'awakening', 'burnHeal', 'antiSputin',
    'oranBerry', 'chestoBerry', 'rawstBerry', 'sitrusBerry', 'persimBerry', 'lumBerry',
    'xAttack', 'xDefense', 'xSpDef', 'xSpAtk', 'xSpeed', 'xAccuracy',
    'ether', 'maxElixir',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'saffron_west_pokemarket': [
    'pokeBall', 'greatBall', 'ultraBall',
    'potion', 'superPotion', 'fullRestore',
    'antidote', 'paralyzeHeal', 'awakening', 'burnHeal', 'antiSputin',
    'oranBerry', 'chestoBerry', 'rawstBerry', 'sitrusBerry', 'persimBerry', 'lumBerry',
    'xAttack', 'xDefense', 'xSpDef', 'xSpAtk', 'xSpeed', 'xAccuracy',
    'ether', 'elixir', 'maxElixir',
    'fireStone', 'waterStone', 'leafStone', 'thunderStone', 'moonStone', 'sunStone',
    'hpUp', 'protein', 'iron', 'calcium', 'zinc', 'carbos', 'iodine',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'fuchsia_pokemarket': [
    'pokeBall', 'greatBall', 'ultraBall',
    'potion', 'superPotion', 'fullRestore',
    'antidote', 'paralyzeHeal', 'awakening', 'burnHeal', 'antiSputin',
    'oranBerry', 'chestoBerry', 'rawstBerry', 'sitrusBerry', 'persimBerry', 'lumBerry',
    'xAttack', 'xDefense', 'xSpDef', 'xSpAtk', 'xSpeed', 'xAccuracy',
    'ether', 'maxElixir',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  // ── Johto ──
  'goldenrod_supermarket': [
    'pokeBall', 'greatBall', 'ultraBall', 'quickBall', 'friendBall', 'loveBall', 'darkBall', 'superDarkBall',
    'potion', 'superPotion', 'fullRestore',
    'vanillaCandy', 'commonCandy', 'typeCandy', 'rareCandy',
    'antidote', 'paralyzeHeal', 'awakening', 'burnHeal', 'antiSputin',
    'oranBerry', 'chestoBerry', 'rawstBerry', 'aspearBerry', 'sitrusBerry', 'persimBerry', 'lumBerry',
    'leppaBerry',
    'xAttack', 'xDefense', 'xSpDef', 'xSpAtk', 'xSpeed', 'xAccuracy',
    'ether', 'elixir', 'maxElixir',
    'fireStone', 'waterStone', 'leafStone', 'thunderStone', 'moonStone', 'sunStone', 'evolutionStone',
    'hpUp', 'protein', 'iron', 'calcium', 'zinc', 'carbos', 'iodine',
    'train', 'weaken', 'evBrace',
    'tmWeak', 'tmMid', 'tmTop', 'craftersKit',
    'skiGear', 'waterSupply', 'bigWaterSupply',
  ],
  'olivine_shop': [
    'pokeBall', 'greatBall', 'potion', 'superPotion',
    'antidote', 'paralyzeHeal',
    'oranBerry', 'chestoBerry', 'rawstBerry',
    'xAttack', 'xDefense',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'flourence_tech_shop': [
    'tmWeak', 'tmMid', 'tmTop', 'craftersKit',
    'ether', 'elixir', 'maxElixir',
    'fireStone', 'waterStone', 'leafStone', 'thunderStone', 'moonStone', 'sunStone',
    'metalCoat', 'dragonFang', 'blackGlasses', 'softSand', 'twistedSpoon', 'spellTag',
    'sharpBeak', 'hardStone', 'whiteHerb', 'metalCoat',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'warhall_bill_shop': [
    'pokeBall', 'greatBall', 'ultraBall',
    'potion', 'superPotion', 'fullRestore',
    'antidote', 'paralyzeHeal', 'awakening', 'burnHeal', 'antiSputin',
    'oranBerry', 'chestoBerry', 'rawstBerry', 'sitrusBerry', 'persimBerry', 'lumBerry',
    'ether', 'maxElixir',
    'fireStone', 'waterStone', 'leafStone', 'thunderStone', 'moonStone', 'sunStone',
    'xAttack', 'xDefense', 'xSpDef', 'xSpAtk', 'xSpeed', 'xAccuracy',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'alston_shop': [
    'pokeBall', 'greatBall',
    'potion', 'superPotion',
    'antidote', 'paralyzeHeal',
    'oranBerry', 'chestoBerry',
    'xAttack',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'summer_pokemarket': [
    'pokeBall', 'greatBall', 'ultraBall',
    'potion', 'superPotion', 'fullRestore',
    'antidote', 'paralyzeHeal', 'awakening', 'burnHeal', 'antiSputin',
    'oranBerry', 'chestoBerry', 'rawstBerry', 'sitrusBerry', 'persimBerry', 'lumBerry',
    'xAttack', 'xDefense', 'xSpDef', 'xSpAtk', 'xSpeed', 'xAccuracy',
    'ether', 'maxElixir',
    'fireStone', 'waterStone', 'leafStone', 'thunderStone',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
  'melen_craig_shop': [
    'pokeBall', 'greatBall',
    'potion', 'superPotion',
    'antidote', 'paralyzeHeal',
    'oranBerry', 'chestoBerry',
    'xAttack',
    'waterSupply', 'bigWaterSupply',
    'evBrace',
    'ferryTicket', 'trainTicket',
  ],
};
