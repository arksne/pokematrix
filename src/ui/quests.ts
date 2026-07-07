// ─────────────────────────────────────────────────────────────
// quests.ts — UI КВЕСТОВ (отображение и получение наград)
// ─────────────────────────────────────────────────────────────
// Отображает панель активных квестов с прогресс-барами и
// кнопками получения наград. Квесты загружаются из data/quests.ts
// и синхронизируются с сервером через setQuestStates.
//
// ЗАВИСИМОСТИ:
//   data/quests — QUEST_CONFIGS (конфиги всех квестов)
//
// ИСПОЛЬЗУЕТСЯ В: game/init.ts (инициализация панели квестов)
//
// ЭКСПОРТЫ:
//   setQuestCallback(fn)   — установить callback получения награды
//   setQuestStates(states) — установить массив состояний квестов
//   openQuestPanel()       — открыть/создать панель квестов
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

// QUEST_CONFIGS — массив конфигов квестов:
//   [{ id, desc, target, rewardMoney, rewardItem, rewardQty }, ...]
import { QUEST_CONFIGS } from '../data/quests.js';

// ── ТИПЫ ─────────────────────────────────────────────────
type QuestState = {
  id: string;           // ID квеста (из QUEST_CONFIGS)
  progress: number;      // Текущий прогресс
  completed: boolean;    // Флаг выполнения (progress >= target)
  claimed: boolean;      // Награда получена
};

// ── СОСТОЯНИЕ МОДУЛЯ ─────────────────────────────────────
let questStates: QuestState[] = [];        // Все состояния квестов
let onClaimCallback: ((questId: string) => void) | null = null;  // Callback получения награды

// ── setQuestCallback: установка callback получения награды ──
// Вызывается из init.ts с функцией, которая отправляет запрос на сервер
export function setQuestCallback(fn: (questId: string) => void) {
  onClaimCallback = fn;
}

// ── setQuestStates: установка состояний квестов ──────────
// Принимает массив QuestState — обновляет локальное состояние
// и перерисовывает UI (вызывается после setQuestStates)
export function setQuestStates(states: QuestState[]) {
  questStates = states;
}

// ── openQuestPanel: открыть/создать панель квестов ──────
// Создаёт DOM-элемент панели квестов (если не существует)
// и вставляет его после карты (map-section) в view-world
export function openQuestPanel() {
  // Проверяем, существует ли уже контейнер
  const container = document.getElementById('quest-panel');
  if (!container) return;

  // Если контейнер не вставлен в DOM — создаём
  if (!container.parentElement) {
    const worldView = document.getElementById('view-world');
    if (!worldView) return;

    // Создаём панель с заголовком и списком
    const panel = document.createElement('div');
    panel.id = 'quest-panel';
    panel.className = 'quest-panel';
    panel.innerHTML = '<h3 style="margin:0 0 10px;font-size:0.95rem;">📋 Квесты</h3><div id="quest-list"></div>';

    // Вставляем после карты (map-section)
    const mapSection = worldView.querySelector('.map-section');
    if (mapSection) {
      mapSection.after(panel);
    } else {
      worldView.appendChild(panel);
    }
  }

  // Отрисовываем список квестов
  renderQuestList();
}

// ── renderQuestList: отрисовка списка квестов ───────────
// Для каждого квеста показывает:
//   - Описание (desc)
//   - Кнопку "Получить" (если можно забрать награду)
//   - ✅ Выполнено (если уже забрали)
//   - Прогресс X/Y (ещё не выполнен)
//   - Прогресс-бар (процент выполнения)
//   - Награду (деньги + предмет)
function renderQuestList() {
  const list = document.getElementById('quest-list');
  if (!list) return;

  // ── Нет квестов ──
  if (!questStates.length) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.3);font-size:0.82rem;">Нет активных квестов</div>';
    return;
  }

  // ── Рендер каждого квеста ──
  list.innerHTML = questStates.map(qs => {
    // Находим конфиг квеста по ID
    const config = QUEST_CONFIGS.find(q => q.id === qs.id);
    if (!config) return '';  // Пропускаем неизвестные квесты

    const target = config.target || 1;              // Целевое количество
    const pct = Math.min(100, Math.round((qs.progress / target) * 100));  // Процент
    const isDone = qs.progress >= target;             // Выполнен?
    const canClaim = isDone && !qs.claimed;            // Можно получить награду?

    // HTML карточки квеста
    return `
      <div class="quest-item">
        <div class="quest-header">
          <span class="quest-title">${config.desc}</span>
          ${canClaim
            ? `<button class="quest-claim-btn" data-quest="${qs.id}">Получить</button>`
            : qs.claimed
              ? '<span style="font-size:0.7rem;color:#34c759;">✅ Выполнено</span>'
              : `<span style="font-size:0.7rem;color:#999;">${qs.progress}/${target}</span>`
          }
        </div>
        <!-- Прогресс-бар -->
        <div class="quest-progress-bar">
          <div class="quest-progress-fill ${isDone ? 'complete' : ''}" style="width:${pct}%"></div>
        </div>
        <!-- Награда -->
        <div class="quest-reward">
          🏆 ${config.rewardMoney ? `¥${config.rewardMoney}` : ''}
          ${config.rewardItem ? `+ ${config.rewardItem} x${config.rewardQty || 1}` : ''}
        </div>
      </div>
    `;
  }).join('');

  // ── Обработчики кнопок "Получить" ──
  list.querySelectorAll('.quest-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = (btn as HTMLElement).dataset.quest;
      if (qid && onClaimCallback) onClaimCallback(qid);  // Вызываем callback
    });
  });
}
