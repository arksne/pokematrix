// ─────────────────────────────────────────────────────────────
// nickname.ts — РЕДАКТИРОВАНИЕ ПРОЗВИЩ ПОКЕМОНОВ
// ─────────────────────────────────────────────────────────────
// Открывает модальное окно для изменения никнейма текущего
// выбранного покемона, после чего обновляет профиль и
// автоматически сохраняет игру.
//
// ЗАВИСИМОСТИ:
//   getters  — getTeamState (текущий покемон)
//   profile  — refreshProfileUI (обновление UI профиля)
//   save     — autoSave
//   dom      — showToast, showTextInputModal (ввод текста)
//
// ИСПОЛЬЗУЕТСЯ В: init.ts (привязка к кнопке переименования)
//
// ЭКСПОРТЫ:
//   editNickname() → void — открывает диалог смены прозвища
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { getTeamState } from '../game/getters.js';    // Состояние команды
import { refreshProfileUI } from './profile.js';        // Обновление профиля
import { autoSave } from '../game/save.js';              // Автосохранение
import { showToast, showTextInputModal } from '../utils/dom.js';  // UI

// ── editNickname: открыть диалог смены прозвища ────────
// Проверяет, выбран ли покемон, затем показывает модалку
// ввода текста с текущим ником (или пустым полем)
export function editNickname() {
  // Проверка: выбран ли покемон?
  if (getTeamState().currentPokemonIndex === null) {
    return showToast('Сначала выберите покемона!', true);
  }

  // Получаем текущего покемона
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];

  // Показываем модалку ввода текста
  showTextInputModal(
    'Новое прозвище',               // Заголовок
    mon.nickname || '',              // Текущее значение (или пусто)
    (newName) => {                   // Callback при сохранении
      mon.nickname = newName;        // Устанавливаем новое прозвище
      refreshProfileUI();             // Обновляем UI профиля
      autoSave();                     // Сохраняем
    }
  );
}
