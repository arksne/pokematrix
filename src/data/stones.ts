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
};