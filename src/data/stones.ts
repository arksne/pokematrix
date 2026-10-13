// ─────────────────────────────────────────────────────────────
// stones.ts — КАМНИ ЭВОЛЮЦИИ
// ─────────────────────────────────────────────────────────────
// STONE_ITEM_MAP — словарь: ID предмета (из items.ts) → категория камня.
// Используется в evolution.ts для определения эволюции по камню.
// null = универсальный камень (evolutionStone).
// ─────────────────────────────────────────────────────────────
export const STONE_ITEM_MAP = {
  'evolutionStone': null,
  'fireStone': 'fire-stone',
  'waterStone': 'water-stone',
  'leafStone': 'leaf-stone',
  'thunderStone': 'thunder-stone',
  'moonStone': 'moon-stone',
  'sunStone': 'sun-stone',
  'shinyStone': 'shiny-stone',
  'duskStone': 'dusk-stone',
  'iceStone': 'ice-stone',
  'dawnStone': 'dawn-stone',
  // ── Особые эволюции (аудит итемов): ID → имя в PokeAPI ──
  // Срабатывают только если данные эволюции вида содержат trigger use-item
  // с тем же именем; иначе checkEvolution честно отказывает.
  'linkingCord': 'linking-cord',
  'dragonScale': 'dragon-scale',
  'upGrade': 'up-grade',
  'ovalStone': 'oval-stone',
  'protector': 'protector',
  'electirizer': 'electirizer',
  'magmarizer': 'magmarizer',
  'reaperCloth': 'reaper-cloth',
  'dubiousDisc': 'dubious-disc',
  'prismScale': 'prism-scale',
  'sachet': 'sachet',
  'whippedDream': 'whipped-dream',
  // ── Починка (аудит): эволь через эти предметы не было — маппинга не было
  'metalCoat': 'metal-coat',
  'deepSeaScale': 'deep-sea-scale',
  'deepSeaTooth': 'deep-sea-tooth',
  'peatBlock': 'peat-block',
  'blackAugurite': 'black-augurite',
  'berrySweet': 'berry-sweet',
  'chippedPot': 'chipped-pot',
  'crackedPot': 'cracked-pot',
  'strawberrySweet': 'strawberry-sweet',
  'loveSweet': 'love-sweet',
  'starSweet': 'star-sweet',
  'ribbonSweet': 'ribbon-sweet',
  'flowerSweet': 'flower-sweet',
  'cloverSweet': 'clover-sweet',
  'tartApple': 'tart-apple',
  'sweetApple': 'sweet-apple',
  'syrupyApple': 'syrupy-apple',
  'unremarkableTeacup': 'unremarkable-teacup',
  'masterpieceTeacup': 'masterpiece-teacup',
  'metalAlloy': 'metal-alloy',
  'maliciousArmor': 'malicious-armor',
};