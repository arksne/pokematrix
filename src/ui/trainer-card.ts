// ─────────────────────────────────────────────────────────────
// trainer-card.ts — КАРТОЧКА ТРЕНЕРА
// ─────────────────────────────────────────────────────────────
// Отображает карточку профиля текущего игрока: имя, бейджи,
// количество пойманных покемонов, PvP статистику, локацию.
// Позволяет сменить никнейм через showTextInputModal.
//
// ЗАВИСИМОСТИ:
//   state           — глобальное состояние
//   dom             — showTextInputModal (ввод текста)
//   save            — autoSave
//   core            — pokedexTotal (общее количество видов)
//   trainer-profile — loadLocationTrainers, renderOnlinePlayers
//
// ИСПОЛЬЗУЕТСЯ В: nav.ts (вкладка "Чат" → карточка тренера)
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';              // Глобальное состояние
// showTextInputModal — показывает модалку с полем ввода текста
// Отличается от showSelectionModal — пользователь вводит текст, а не выбирает
import { showTextInputModal } from '../utils/dom.js';
import { autoSave } from '../game/save.js';              // Автосохранение
// pokedexTotal — общее количество видов покемонов в покедексе
// Экспортируется из battle/core, вычисляется как длина POKEDEX_ALL
import { pokedexTotal } from '../battle/core.js';
// loadLocationTrainers — загружает список тренеров в той же локации
// renderOnlinePlayers — показывает список онлайн-игроков
import { loadLocationTrainers, renderOnlinePlayers } from '../social/trainer-profile.js';

// ── renderTrainerCard: отрисовка карточки тренера ───────
// Заполняет DOM-элементы: имя, количество значков, пойманные покемоны
// Также запускает загрузку списка тренеров в локации и онлайн-игроков
export function renderTrainerCard() {
  // Находим DOM-элементы карточки
  const nameEl = document.getElementById('trainer-name');    // Имя тренера
  const badgesEl = document.getElementById('trainer-badges'); // Количество значков
  const caughtEl = document.getElementById('trainer-caught'); // Поймано покемонов

  // Если элементов нет — выходим (страница не загружена или другая вкладка)
  if (!nameEl || !badgesEl || !caughtEl) return;

  // ── Установка имени тренера ──
  // Приоритет: trainerNickname (установленный) → Telegram first_name → username → ID → '---'
  if (state.trainerNickname) {
    nameEl.textContent = state.trainerNickname;
  } else if (state.tgUser) {
    nameEl.textContent = state.tgUser.first_name || state.tgUser.username || `ID:${state.tgUser.id}`;
  } else {
    nameEl.textContent = '---';
  }

  // При клике на имя — открываем модалку смены прозвища
  nameEl.style.cursor = 'pointer';  // Курсор-рука
  nameEl.title = 'Нажмите чтобы изменить прозвище';
  nameEl.onclick = () => {
    showTextInputModal(
      'Прозвище тренера',                            // Заголовок
      state.trainerNickname || state.tgUser?.first_name || '',  // Значение по умолчанию
      (newName) => {                                  // Callback при сохранении
        state.trainerNickname = newName;  // Сохраняем в глобальное состояние
        renderTrainerCard();              // Перерисовываем карточку
        autoSave();                       // Сохраняем игру
      }
    );
  };

  // ── Количество значков ──
  badgesEl.textContent = String(state.badges.length);

  // ── Пойманные покемоны ──
  // Формат: "45/151" (поймано / всего видов)
  caughtEl.textContent = `${state.pokedexCaught.size}/${pokedexTotal || 151}`;

  // ── Загрузка дополнительных данных ──
  loadLocationTrainers();  // Тренеры в текущей локации
  renderOnlinePlayers();   // Онлайн-игроки (из Socket.IO)
}
