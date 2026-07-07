// ─────────────────────────────────────────────────────────────
// nav.ts — НАВИГАЦИЯ ПРИЛОЖЕНИЯ
// ─────────────────────────────────────────────────────────────
// Обрабатывает переключение между экранами (вкладками) и
// привязывает боковые кнопки (инфо, сброс игры, закрытие модалок).
//
// ЗАВИСИМОСТИ:
//   REGIONS       — для динамического заголовка текущего региона
//   state          — глобальное состояние (currentRegion)
//   profile        — renderTeamGrid (сетка команды)
//   inventory      — renderInventory (рендер инвентаря)
//   trainers       — loadAllTrainers (загрузка списка тренеров)
//   chat           — loadChatMessages, startChatPolling, stopChatPolling
//   save           — resetGame (полный сброс прогресса)
//   socket         — initTradeSocket (инициализация сокета для торговли)
//   trainer-card   — renderTrainerCard (карточка тренера)
//
// ИСПОЛЬЗУЕТСЯ В:
//   game/init.ts   — import { initAppNav } from '../ui/nav.js'
//
// ЭКСПОРТЫ:
//   initAppNav()   — инициализирует все обработчики событий навигации и кнопок
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { REGIONS } from '../data/regions.js';          // Все регионы (для названия в заголовке)
import { state } from '../game/state.js';                // Глобальное состояние
import { renderTeamGrid } from './profile.js';           // Отрисовка сетки команды
import { renderInventory } from './inventory.js';         // Отрисовка инвентаря
import { loadAllTrainers } from './trainers.js';          // Загрузка списка тренеров
// Чат: загрузка сообщений + старт/стоп опроса новых сообщений
import { loadChatMessages, startChatPolling, stopChatPolling } from './chat.js';
import { resetGame } from '../game/save.js';               // Сброс всей игры
import { initTradeSocket } from '../network/socket.js';    // Инициализация сокета торговли
import { renderTrainerCard } from './trainer-card.js';     // Рендер карточки тренера

// ── initAppNav: инициализация навигации ─────────────────
// Вешает обработчики на все кнопки навигации, вызывается один раз при старте
export function initAppNav() {
  // ── ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ ──
  // Все элементы навигации (кнопки внизу экрана)
  const navItems = document.querySelectorAll('.nav-item');
  // Все экраны (панели) приложения
  const views = document.querySelectorAll('.app-view');
  // Заголовок в шапке
  const headerTitle = document.getElementById('header-title');

  // ── КАРТА ЗАГОЛОВКОВ ДЛЯ КАЖДОГО ЭКРАНА ──
  // Каждому ID экрана соответствует заголовок, который отображается в шапке
  const titles: Record<string, string> = {
    'view-world': 'Мир',                    // Карта/локация
    'view-backpack': 'Рюкзак',              // Инвентарь
    'view-team': 'Команда Покемонов',        // Команда
    'view-chat': 'Чат',                     // Чат
    'view-trainers': 'Тренеры'              // Список тренеров
  };

  // ── ОБРАБОТЧИК КЛИКА ПО КНОПКАМ НАВИГАЦИИ ──
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Снимаем 'active' со всех кнопок навигации
      navItems.forEach(n => n.classList.remove('active'));
      // Скрываем все экраны
      views.forEach(v => v.classList.remove('active-view'));

      // Активируем текущую кнопку
      item.classList.add('active');
      // Получаем ID целевого экрана из data-атрибута
      const targetId = item.getAttribute('data-target');
      // Показываем целевой экран
      document.getElementById(targetId).classList.add('active-view');
      // Устанавливаем заголовок шапки
      headerTitle.innerText = titles[targetId];

      // ── СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ НЕКОТОРЫХ ЭКРАНОВ ──

      // Экран "Мир": добавляем название региона к заголовку
      if (targetId === 'view-world') {
        headerTitle.innerText = `Мир (${REGIONS[state.currentRegion]?.name || ''})`;
      }

      // Экран "Рюкзак": отрисовываем инвентарь
      if (targetId === 'view-backpack') {
        renderInventory();
      }

      // Экран "Команда": отрисовываем сетку и показываем ростера
      if (targetId === 'view-team') {
        renderTeamGrid();
        // Показываем список команды, скрываем детальный профиль
        document.getElementById('team-roster').style.display = 'block';
        document.getElementById('pokedex-display').style.display = 'none';
      }

      // Экран "Тренеры": загружаем список всех тренеров
      if (targetId === 'view-trainers') {
        loadAllTrainers();
      }

      // Экран "Чат": загружаем сообщения, стартуем опрос
      if (targetId === 'view-chat') {
        loadChatMessages();        // Загружаем историю чата
        renderTrainerCard();       // Отображаем карточку тренера (ник, аватар)
        startChatPolling();        // Запускаем периодический опрос новых сообщений
        initTradeSocket();         // Инициализируем сокет для торговли (получение запросов)
      } else {
        // Если не в чате — останавливаем опрос (чтобы не тратить ресурсы)
        stopChatPolling();
      }
    });
  });

  // ── КНОПКА "ИНФО" (открыть модалку) ──
  document.getElementById('btn-info').addEventListener('click', () => {
    document.getElementById('info-modal').style.display = 'flex';
  });

  // ── КНОПКА ЗАКРЫТИЯ ИНФО ──
  document.getElementById('btn-close-info').addEventListener('click', () => {
    document.getElementById('info-modal').style.display = 'none';
  });

  // ── КЛИК ПО ФОНУ МОДАЛКИ (закрыть) ──
  document.getElementById('info-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('info-modal')) {
      document.getElementById('info-modal').style.display = 'none';
    }
  });

  // ── КНОПКА "НАЗАД" В ПРОФИЛЕ ПОКЕМОНА ──
  // Возвращает из детальной карточки к списку команды
  document.getElementById('btn-back-team').addEventListener('click', () => {
    document.getElementById('pokedex-display').style.display = 'none';
    document.getElementById('team-roster').style.display = 'block';
    renderTeamGrid();  // Перерисовываем сетку (на случай изменений)
  });

  // ── КНОПКА "СБРОС ИГРЫ" ──
  // Полностью сбрасывает весь прогресс (предупреждение в save.ts)
  document.getElementById('btn-reset-game').addEventListener('click', resetGame);

  // ── КНОПКА ЗАКРЫТИЯ NPC (модалка диалога) ──
  document.getElementById('btn-close-npc').addEventListener('click', () => {
    document.getElementById('npc-modal').style.display = 'none';
  });
}
