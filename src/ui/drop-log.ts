/**
 * Журнал дропа — что выпало с покемонов.
 *
 * Раньше дроп жил одной строкой в логе боя («Выпало: 2x Поке-Болл»), которая
 * исчезала вместе с боем. Отдельного списка не было: предметы попадали в
 * рюкзак молча, и если игрок закрыл бой или свайпнул дальше, увидеть выпавшее
 * уже было нельзя. Теперь дроп попадает в список, который переживает бой и
 * перезагрузку страницы.
 *
 * Записи хранятся в сейве, поэтому журнал синхронизируется между устройствами
 * вместе с остальным прогрессом.
 */
import { state } from '../game/state.js';
import { itemDef } from '../utils/items.js';

/** Максимум записей, чтобы сейв не разрастался бесконечно. */
const MAX_ENTRIES = 60;

export interface DropEntry {
  /** Имя побеждённого покемона. */
  name: string;
  /** Уровень, с которого выпало. */
  level: number;
  /** Предметы: id и количество. */
  items: { id: string; qty: number }[];
  /** Метка времени для отображения. */
  at: string;
}

/**
 * Возвращает журнал, создавая его при первом обращении.
 *
 * Хранится прямо в игровом состоянии, поэтому записи переживают и перезагрузку,
 * и применение облачного сейва: последний синхронизированный список приедет на
 * другое устройство вместе с остальным прогрессом.
 */
export function getDropLog(): DropEntry[] {
  if (!Array.isArray(state.dropLog)) state.dropLog = [];
  return state.dropLog;
}

/**
 * Записывает выпавшее в журнал.
 *
 * Порог в один предмет — не украшение: пустые записи засоряли бы вкладку после
 * каждого боя, где дроп не выпал.
 */
export function recordDrop(name: string, level: number, items: { id: string; qty: number }[]): void {
  if (!items || items.length === 0) return;
  const log = getDropLog();
  log.unshift({
    name: name || 'Неизвестно',
    level: level || 1,
    items,
    at: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  });
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
}

/** Суммирует количество конкретного предмета по всему журналу. */
export function dropTotalFor(itemId: string): number {
  let total = 0;
  for (const entry of getDropLog()) {
    for (const item of entry.items) {
      if (item.id === itemId) total += item.qty;
    }
  }
  return total;
}

/**
 * Очищает журнал и сразу перерисовывает вкладку.
 *
 * Пустой массив, а не удаление поля: если бы поле пропало, старый сейв с
 * отброшенным журналом выглядел бы как «ещё не загружалось».
 */
export function clearDropLog(): void {
  state.dropLog = [];
  renderDropLog();
  renderDropSummary();
}

/**
 * Сводка над списком: сколько всего боёв и предметов в журнале.
 *
 * Считается по журналу, а не по рюкзаку, иначе в сумму попадали бы вещи,
 * купленные в магазине, и цифра вводила бы в заблуждение.
 */
export function renderDropSummary(): void {
  const box = document.getElementById('drop-summary');
  if (!box) return;
  const log = getDropLog();
  if (log.length === 0) { box.textContent = 'Журнал пуст'; return; }
  let items = 0;
  for (const entry of log) items += entry.items.reduce((sum, i) => sum + (i.qty || 0), 0);
  box.textContent = `Боёв: ${log.length} · предметов: ${items}`;
}

/** Инициализация вкладки: сводка и кнопка очистки. */
export function initDropTab(): void {
  const button = document.getElementById('btn-clear-drop');
  if (button && !button.dataset.bound) {
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      if (getDropLog().length === 0) return;
      clearDropLog();
    });
  }
}

/**
 * Рисует журнал во вкладке.
 *
 * Названия предметов берутся из itemDef, чтобы совпадать с подписями в
 * рюкзаке: id вроде 'pokeball' пользователю ничего не говорит.
 */
export function renderDropLog(): void {
  const container = document.getElementById('drop-list');
  if (!container) return;
  const log = getDropLog();

  if (log.length === 0) {
    container.innerHTML = '<div class="drop-empty">Пока ничего не выпало. Победите покемона в бою.</div>';
    return;
  }

  container.innerHTML = log
    .map(entry => {
      const chips = entry.items
        .map(item => `<span class="drop-chip">${escapeHtml(itemDef(item.id).nameRu)} ×${item.qty}</span>`)
        .join('');
      return `<div class="drop-row">
        <div class="drop-head">
          <span class="drop-mon">${escapeHtml(entry.name)} ур.${entry.level}</span>
          <span class="drop-time">${escapeHtml(entry.at)}</span>
        </div>
        <div class="drop-items">${chips}</div>
      </div>`;
    })
    .join('');
}

/**
 * Экранирует текст перед вставкой в innerHTML.
 *
 * Имя покемона приходит из сейва, который игрок мог отредактировать в
 * localStorage, поэтому подстановка без экранирования — готовая XSS-дыра.
 */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}