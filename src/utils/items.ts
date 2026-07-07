// ═══════════════════════════════════════════════════════════════
// items.ts — Утилиты для работы с предметами
// ═══════════════════════════════════════════════════════════════
//
// 1. ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ
//    Содержит вспомогательные функции для получения данных
//    о предметах по их ID. Не содержит игровой логики —
//    только lookup-запросы к массиву ITEMS.
//
// 2. ЗАВИСИМОСТИ (импорты и глобальное состояние)
//    - ITEMS (import из '../data/items.js') — статический
//      массив всех предметов игры (ItemDef[]), определённый
//      в src/data/items.ts (1318 предметов). Не зависит от
//      глобального состояния (state, store) и от core.js.
//
// 3. ГДЕ ИСПОЛЬЗУЕТСЯ (файлы, которые импортируют из него)
//    Прямой импорт:
//      - src/battle/core.ts        — itemDef(), itemCategory()
//      - src/ui/inventory.ts       — itemDef()
//    Реэкспорт через src/game/state.ts:
//      - src/ui/npcs.ts            — itemDef() (через state.ts)
//      - src/ui/gym-reward.ts      — itemDef() (через state.ts)
//      - src/game/__tests__/state.test.ts  — itemDef(), itemCategory()
//    Реэкспорт в state.ts (строка 110):
//      export { itemDef, itemCategory } from '../utils/items.js';
//
// 4. КЛЮЧЕВЫЕ ЭКСПОРТЫ
//    itemDef(itemId)       — возвращает полное определение предмета
//                            (ItemDef) или fallback-заглушку
//    itemCategory(itemId)  — возвращает строку категории предмета
//                            (напр. 'balls', 'healing', 'battle')
//
// ═══════════════════════════════════════════════════════════════

// Item/Inventory utilities — no dependency on main.js or core.js

import { ITEMS } from '../data/items.js';

export function itemDef(itemId) {
  if (!itemId) return { id: null, nameRu: '???', category: 'other', desc: 'Неизвестный предмет' };
  return ITEMS.find(i => i.id === itemId) || { id: null, nameRu: '???', category: 'other', desc: 'Неизвестный предмет' };
}

export function itemCategory(itemId) {
  if (!itemId) return 'other';
  return (ITEMS.find(i => i.id === itemId) || {}).category || 'other';
}
