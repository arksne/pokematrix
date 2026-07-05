/**
 * ============================================================
 * actions.ts — ОПЕРАЦИИ С ПРЕДМЕТАМИ (FACADE)
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   Прослойка между UI/бизнес-логикой и store.ts.
 *   addItem/removeItem — делегируют store, добавляют autoSave.
 *   initInventory — инициализирует инвентарь (все предметы = 0).
 *   logItemHistory — логирует использование предметов.
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - ./state.js       → state, getItemQty, getTrainerId
 *   - ./store.js       → store (addItem, removeItem, emit)
 *   - ../data/items.js → ITEMS
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   - UI модули (inventory, shop, craft, battle)
 *   - npcs.ts (награды)
 *   - core.ts (лут, использование в бою)
 *
 * 🔹 ЭКСПОРТИРУЕТ:
 *   - addItem(itemId, qty)       → bool (добавить + автосохранение)
 *   - removeItem(itemId, qty)    → bool (убрать + автосохранение)
 *   - initInventory()             → инициализация инвентаря
 *   - logItemHistory(itemId, qty, source) → логирование
 * ============================================================
 */

import { state, getTrainerId } from './state.js';
import { store } from './store.js';
import { ITEMS } from '../data/items.js';

// ── История предметов ──────────────────────────────────────
// Добавляет запись в массив itemHistory при каждом получении/использовании.
// Хранит максимум 500 записей (обрезает старые).
export function logItemHistory(itemId: string, qty: number, source: string) {
  state.itemHistory.push({
    itemId, qty, source,
    timestamp: Date.now(),
    trainerId: getTrainerId()
  });
  if (state.itemHistory.length > 500) state.itemHistory = state.itemHistory.slice(-500);
}

// ── Инициализация инвентаря ────────────────────────────────
// Ставит количество каждого предмета в 0.
// Добавляет стартовые 500 кредитов (денег).
export function initInventory() {
  ITEMS.forEach((item: any) => {
    state.inventory[item.id] = 0;
  });
  if (!state.inventory['credit']) state.inventory['credit'] = 500;
}

// ── Операции с предметами ──────────────────────────────────
// Делегируют store.addItem/removeItem + автосохранение.
// 'inventory:changed' — эмитится store.addItem.
// save — эмитим здесь, чтобы autoSave сработал после операции.
export function addItem(itemId: string, qty = 1): boolean {
  const result = store.addItem(itemId, qty);
  if (result) store.emit('save');
  return result;
}

export function removeItem(itemId: string, qty = 1): boolean {
  const result = store.removeItem(itemId, qty);
  if (result) store.emit('save');
  return result;
}
