/**
 * ============================================================
 * transport.ts — ТРАНСПОРТНЫЕ УЗЛЫ (паромы)
 * ============================================================
 * 🔹 TRANSPORT_HUBS[locationId] = [{ label, targetRegion, targetLoc }]
 * 🔹 Используется: map.ts (путешествия между регионами)
 * 🔹 Зависит: ничего
 * ============================================================
 */
export const TRANSPORT_HUBS = {
  'olivineCity': [
    { label: '🚢 Паром в Канто (Вермилион)', targetRegion: 'kanto', targetLoc: 'vermilionCity' },
  ],
  'vermilionCity': [
    { label: '🚢 Паром в Джото (Оливин)', targetRegion: 'johto', targetLoc: 'olivineCity' },
  ],
  'goldenrodCity': [
    { label: '🚂 Поезд в Канто (Шаффран)', targetRegion: 'kanto', targetLoc: 'saffronCity' },
  ],
  'saffronCity': [
    { label: '🚂 Поезд в Джото (Голденрод)', targetRegion: 'johto', targetLoc: 'goldenrodCity' },
  ],
};
