// ─────────────────────────────────────────────────────────────
// npcs.ts — ВЗАИМОДЕЙСТВИЕ С NPC (НЕИГРОВЫМИ ПЕРСОНАЖАМИ)
// ─────────────────────────────────────────────────────────────
// Отвечает за UI-диалоги с NPC: отображение списка квестов NPC
// в модальном окне, отслеживание прогресса по квестам (включая
// обучающие туториалы), а также специальные действия NPC
// (лечение покемонов, открытие PC, депозит в питомнике).
//
// ЗАВИСИМОСТИ:
//   state       — глобальное состояние (квесты, команда, инвентарь)
//   store       — event bus для сохранения и денег
//   itemDef     — название предмета по ID
//   actions     — addItem / removeItem
//   dom         — showToast
//   notifications — addNotification (колокольчик)
//   core        — appendToLog (боевой лог)
//   pc          — openPC
//   daycare     — openDaycareDeposit
//   NPC_DATA    — статические данные NPC
//
// ИСПОЛЬЗУЕТСЯ В: location.ts (клик по NPC на карте)
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';            // Глобальное состояние
import { store } from '../game/store.js';              // Event-система
import { itemDef } from '../game/state.js';            // Название предмета по ID
import { addItem, removeItem } from '../game/actions.js';  // Манипуляции с инвентарём
import { showToast } from '../utils/dom.js';              // Всплывающие уведомления
import { addNotification } from './notifications.js';      // Системные уведомления (колокольчик)
import { appendToLog } from '../battle/core.js';           // Запись в боевой лог
import { openPC } from './pc.js';                          // Открытие PC
import { openDaycareDeposit } from './daycare.js';          // Депозит в питомник
import { NPC_DATA } from '../data/npc.js';                  // Статические данные NPC

// ── renderNPCQuests: отрисовка списка квестов NPC ───────
// Принимает npc — объект NPC из NPC_DATA
// Показывает все доступные квесты с кнопками:
//   "Взять" — начать квест (ещё не активен)
//   "Сдать" — сдать выполненный квест (прогресс >= targetQty)
//   "..." (disabled) — квест взят, но ещё не выполнен
// Завершённые квесты отображаются с ✅
function renderNPCQuests(npc: any) {
  const container = document.getElementById('npc-quests')!;
  container.innerHTML = '';  // Очищаем контейнер

  // Проходим по всем квестам NPC
  npc.quests.forEach((q: any) => {
    // ── Квест уже выполнен — показываем ✅ ──
    if (state.completedNPCQuests.includes(q.id)) {
      const el = document.createElement('div');
      el.className = 'npc-quest-item';
      el.innerHTML = `<div class="npc-quest-info"><div class="npc-quest-name">✅ ${q.desc}</div></div>`;
      container.appendChild(el);
      return;
    }

    // ── Проверяем выполнен ли предварительный квест (prerequisite) ──
    const prereqMet = !q.prereqQuest || state.completedNPCQuests.includes(q.prereqQuest);
    if (!prereqMet) return;  // Предыдущий квест не выполнен — скрываем

    // ── Данные прогресса ──
    const progress = state.npcQuestProgress[q.id] || 0;       // Текущий прогресс
    const isActive = q.id in state.npcQuestProgress;            // Квест активен?
    const isReady = progress >= q.targetQty;                     // Выполнен?
    const pct = Math.min(100, Math.round((progress / q.targetQty) * 100));  // Процент

    // ── HTML карточки квеста ──
    const el = document.createElement('div');
    el.className = 'npc-quest-item';
    el.innerHTML = `
      <div class="npc-quest-info">
        <div class="npc-quest-name">${q.desc}</div>                    <!-- Описание квеста -->
        <div class="npc-quest-reward">Награда: ${q.rewardMoney}💰 + ${q.rewardQty}x ${itemDef(q.rewardItem).nameRu}</div>
        ${isActive ? `<div class="npc-quest-progress">${progress}/${q.targetQty}</div><div class="npc-quest-bar"><div class="npc-quest-bar-fill" style="width:${pct}%"></div></div>` : ''}
      </div>`;

    // ── Кнопка действия ──
    const btn = document.createElement('button');
    btn.className = 'tma-btn';
    btn.style.padding = '4px 8px';
    btn.style.fontSize = '0.8rem';

    if (!isActive) {
      // ── Квест ещё не взят — кнопка "Взять" ──
      btn.innerText = 'Взять';
      btn.onclick = () => {
        state.npcQuestProgress[q.id] = 0;  // Инициализируем прогресс
        document.getElementById('npc-dialog')!.innerText = npc.dialog.quest_incomplete;
        renderNPCQuests(npc);  // Перерисовываем
        store.emit('save');
        store.emit('tutorial:progress', 'take', 0);
      };
    } else if (isReady) {
      // ── Квест выполнен — кнопка "Сдать" ──
      btn.innerText = 'Сдать';
      btn.onclick = () => {
        if (q.id.startsWith('tutorial_')) {
          // ── Обучающий квест (tutorial_1, tutorial_2, ...) ──
          const step = parseInt(q.id.split('_')[1]);
          if (step === state.tutorialStep) {
            state.tutorialStep++;                     // Переходим к следующему шагу
            state.completedNPCQuests.push(q.id);       // Отмечаем как выполненный
            delete state.npcQuestProgress[q.id];       // Очищаем прогресс
            // Награда: деньги + предмет
            state.inventory['credit'] = (state.inventory['credit'] || 0) + q.rewardMoney;
            addItem(q.rewardItem, q.rewardQty);
            addNotification(
              '🎓 Обучение',
              `Шаг ${step} завершён! Награда: ${q.rewardMoney}💰 + ${q.rewardQty}x ${itemDef(q.rewardItem).nameRu}`
            );
            appendToLog(`Обучающий квест (шаг ${step}) выполнен!`, false, 'quest');
            store.emit('tutorial:progress', 'complete', step);
          }
        } else {
          // ── Обычный квест ──
          // Убираем target-предметы из инвентаря (по одному)
          for (let i = 0; i < q.targetQty; i++) removeItem(q.targetItem, 1);
          state.completedNPCQuests.push(q.id);   // Отмечаем выполненным
          delete state.npcQuestProgress[q.id];   // Очищаем прогресс
          // Награда: деньги + предмет
          state.inventory['credit'] = (state.inventory['credit'] || 0) + q.rewardMoney;
          addItem(q.rewardItem, q.rewardQty);
          appendToLog(`Квест "${q.desc}" выполнен!`, false, 'quest');
        }
        // Общий UI для обоих типов
        document.getElementById('npc-dialog')!.innerText = npc.dialog.quest_complete;
        store.emit('money:changed');
        renderNPCQuests(npc);
        store.emit('save');
      };
    } else {
      // ── Квест активен, но ещё не выполнен ──
      btn.innerText = '...';
      btn.disabled = true;
    }

    el.appendChild(btn);
    container.appendChild(el);
  });
}

// ── openNPCDialog: открыть модалку диалога с NPC ────────
// Принимает npcId — ID NPC из NPC_DATA
// Показывает: спрайт NPC, имя, текст диалога, список квестов,
//   и дополнительные кнопки (лечение, PC, питомник)
export function openNPCDialog(npcId: string) {
  // Находим данные NPC
  const npc = NPC_DATA[npcId];
  if (!npc) return;  // Защита от несуществующего ID

  // Находим DOM-элементы модалки
  const modal = document.getElementById('npc-modal')!;
  document.getElementById('npc-sprite')!.innerText = npc.sprite;  // Спрайт (эмодзи)
  document.getElementById('npc-name')!.innerText = npc.name;      // Имя NPC

  // ── Определяем доступные квесты ──
  // Фильтруем: невыполненные И (без предусловия ИЛИ предусловие выполнено)
  const availableQuests = npc.quests.filter((q: any) =>
    !state.completedNPCQuests.includes(q.id) &&
    (!q.prereqQuest || state.completedNPCQuests.includes(q.prereqQuest))
  );
  const allDone = npc.quests.every((q: any) => state.completedNPCQuests.includes(q.id));
  const activeQuest = npc.quests.find((q: any) =>
    !state.completedNPCQuests.includes(q.id) && q.id in state.npcQuestProgress
  );

  // ── Выбираем текст диалога ──
  let dialogText = npc.dialog.greet;  // Приветствие по умолчанию
  if (allDone && npc.quests.length > 0) {
    dialogText = npc.dialog.default;  // Все квесты выполнены — обычный текст
  } else if (activeQuest) {
    // Есть активный квест — показываем соответствующий диалог
    const progress = state.npcQuestProgress[activeQuest.id] || 0;
    dialogText = progress >= activeQuest.targetQty
      ? npc.dialog.quest_complete   // Квест выполнен
      : npc.dialog.quest_incomplete; // Квест в процессе
  } else if (availableQuests.length > 0) {
    // Есть доступный квест — показываем предложение
    const q = availableQuests[0];
    if (npc.dialog.quest_offer) {
      dialogText = npc.dialog.quest_offer
        .replace('{target}', q.targetQty);  // Подставляем количество
      if (q.targetItem) {
        dialogText = dialogText.replace('{item}', itemDef(q.targetItem).nameRu);  // Название предмета
      } else {
        dialogText = dialogText.replace('{item}', '').replace('  ', ' ').trim();
      }
    } else {
      dialogText = `${npc.dialog.greet} Есть задание: ${q.desc}`;
    }
  }

  // Отображаем диалог и список квестов
  document.getElementById('npc-dialog')!.innerText = dialogText;
  renderNPCQuests(npc);
  modal.style.display = 'flex';  // Показываем модалку

  // ── Дополнительные кнопки действий ──
  const actionsContainer = document.getElementById('npc-actions')!;
  // Удаляем старые дополнительные кнопки (чтобы не дублировались)
  actionsContainer.querySelectorAll('.npc-action-extra').forEach(b => b.remove());

  // ── NPC: Медсестра Джой (лечение) ──
  if (npcId === 'joy_pokecenter') {
    const btnHeal = document.createElement('button');
    btnHeal.className = 'tma-btn npc-action-extra';
    btnHeal.style.backgroundColor = '#34c759';  // Зелёная
    btnHeal.innerText = '🏥 Вылечить команду';
    btnHeal.onclick = () => {
      // Полное лечение всей команды
      state.myTeam.forEach((mon: any) => {
        const baseHp = mon.apiData.stats[0].base_stat;
        const curLvl = mon.baseLevel + mon.candiesEaten;
        mon.maxHp = Math.floor(0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl) + curLvl + 10;
        mon.currentHp = mon.maxHp;       // Полное HP
        mon.status = null;                // Снимаем статус
        mon.sleepTurns = 0;               // Сбрасываем сон
        mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };  // Сбрасываем стадии
        if (mon.movesPP) mon.movesPP.forEach((pp: any) => { if (pp) pp.current = pp.max; });  // Восстанавливаем PP
      });
      showToast('Ваша команда полностью вылечена!', false);
      modal.style.display = 'none';  // Закрываем модалку
      store.emit('save');
    };
    actionsContainer.insertBefore(btnHeal, document.getElementById('btn-close-npc'));
  }

  // ── NPC: Питомник (PC + депозит) ──
  if (npcId === 'daycare_pokecenter') {
    // Кнопка "Открыть PC"
    const btnDeposit = document.createElement('button');
    btnDeposit.className = 'tma-btn npc-action-extra';
    btnDeposit.style.backgroundColor = '#5856d6';  // Фиолетовая
    btnDeposit.innerText = '💻 Открыть PC';
    btnDeposit.onclick = () => {
      modal.style.display = 'none';
      openPC();  // Открываем PC-терминал
    };
    actionsContainer.insertBefore(btnDeposit, document.getElementById('btn-close-npc'));

    // Кнопка "Оставить в Питомнике"
    const btnDaycare = document.createElement('button');
    btnDaycare.className = 'tma-btn npc-action-extra';
    btnDaycare.style.backgroundColor = '#ff9500';  // Оранжевая
    btnDaycare.innerText = '🥚 Оставить в Питомнике';
    btnDaycare.onclick = () => {
      if (state.myTeam.length < 2) {
        showToast('Нужно минимум 2 покемона в команде!', true);
        return;
      }
      openDaycareDeposit();  // Открываем депозит питомника
      modal.style.display = 'none';
    };
    actionsContainer.insertBefore(btnDaycare, document.getElementById('btn-close-npc'));
  }
}

// ── checkTutorialProgress: обновление прогресса обучения ─
// Вызывается из разных мест игры (битва, инвентарь)
// Принимает:
//   type — тип действия ('catch', 'battle', 'heal', 'item')
//   amount — количество (обычно 1)
//   itemId — ID предмета (для квестов на сбор)
// Проверяет, соответствует ли действие текущему шагу туториала
export function checkTutorialProgress(type: string, amount: number, itemId?: string) {
  // Туториал имеет шаги 1-6
  if (state.tutorialStep < 1 || state.tutorialStep > 6) return;
  const questId = `tutorial_${state.tutorialStep}`;  // ID квеста: tutorial_1, tutorial_2, ...

  // Если квест уже выполнен — выходим
  if (state.completedNPCQuests.includes(questId)) return;

  // Находим квест туториала (у NPC professor_tutorial)
  const quest = NPC_DATA['professor_tutorial']?.quests?.find((q: any) => q.id === questId);
  if (!quest || quest.type !== type) return;  // Не наш тип — выходим

  // Обновляем прогресс
  if (!(questId in state.npcQuestProgress)) state.npcQuestProgress[questId] = 0;
  state.npcQuestProgress[questId] += amount;

  // Если квест выполнен — уведомляем игрока
  if (state.npcQuestProgress[questId] >= quest.targetQty) {
    state.npcQuestProgress[questId] = quest.targetQty;  // Не больше цели
    addNotification(
      '📋 Квест!',
      `Обучающий квест (шаг ${state.tutorialStep}): задание выполнено! Вернитесь к Профессору Оуку.`
    );
  }

  store.emit('save');
}

// ── getTutorialQuestInfo: получить данные активного квеста туториала ──
// Возвращает { quest, config, step, progress, targetQty, isActive, isReady, pct }
// или null если туториал завершён
export function getTutorialQuestInfo() {
  if (state.tutorialStep < 1 || state.tutorialStep > 6) return null;
  const step = state.tutorialStep;
  const questId = `tutorial_${step}`;
  const npc = NPC_DATA['professor_tutorial'];
  if (!npc) return null;
  const quest = npc.quests.find((q: any) => q.id === questId);
  if (!quest) return null;
  const prereqMet = !quest.prereqQuest || state.completedNPCQuests.includes(quest.prereqQuest);
  if (!prereqMet) return { step, quest, questId, progress: 0, targetQty: quest.targetQty, pct: 0, isActive: false, isReady: false, prereqMet: false };
  const progress = state.npcQuestProgress[questId] || 0;
  const isActive = questId in state.npcQuestProgress;
  const isReady = progress >= quest.targetQty;
  const pct = Math.min(100, Math.round((progress / quest.targetQty) * 100));
  return { step, quest, questId, progress, targetQty: quest.targetQty, pct, isActive, isReady, prereqMet };
}

// ── renderTutorialBar: перерисовать туториал-бар ──
// Вызывается из location.ts при рендере локации и из init.ts при прогрессе
export function renderTutorialBar() {
  const container = document.getElementById('tutorial-quest-bar');
  if (!container) return;
  const info = getTutorialQuestInfo();
  if (!info) { container.style.display = 'none'; return; }
  container.style.display = 'flex';

  const types: Record<string, string> = {
    catch_x: '🔴 Поймайте', defeat_x: '⚔️ Победите',
    use_item: '💊 Используйте', explore: '🗺️ Посетите', earn_money: '💰 Заработайте',
    collect_drop: '💎 Выбейте',
  };
  const typeText = types[info.quest.type] || info.quest.type;
  let desc = info.quest.desc;
  if (!info.prereqMet) desc = '🔒 Выполните предыдущий квест сначала';
  else if (!info.isActive) desc = `👨‍🔬 Поговорите с Профессором Оуком чтобы взять квест`;
  else if (info.isReady) desc = `✅ Квест выполнен! Вернитесь к Профессору Оуку за наградой`;
  else desc = `${typeText} ${info.progress}/${info.targetQty}`;

  let emoji = '📋';
  if (info.isReady) emoji = '✅';
  else if (info.isActive) emoji = '⏳';

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;width:100%;">
      <span>${emoji}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.7rem;font-weight:bold;display:flex;justify-content:space-between;">
          <span>🎓 Шаг ${info.step}/5: <span id="tut-bar-desc">${desc}</span></span>
          <span style="color:#888;">${info.isActive ? `${info.progress}/${info.targetQty}` : ''}</span>
        </div>
        ${info.isActive ? `
        <div style="margin-top:3px;height:6px;background:rgba(255,255,255,0.15);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${info.pct}%;background:${info.isReady ? '#34c759' : '#007aff'};border-radius:3px;transition:width 0.3s;"></div>
        </div>` : ''}
        ${info.isReady ? `<div style="font-size:0.65rem;color:#34c759;margin-top:2px;">🏆 Награда: ${info.quest.rewardMoney}💰 + ${info.quest.rewardQty}x ${itemDef(info.quest.rewardItem).nameRu}</div>` : ''}
      </div>
    </div>
  `;
}

// ── checkNPCQuestProgress: обновление прогресса квестов на сбор ──
// Вызывается при получении/трате предмета (из store или actions)
// Проходит по всем NPC и их квестам, ищет квесты типа 'collect_items'
// с совпадающим targetItem, и обновляет прогресс активных квестов
export function checkNPCQuestProgress(itemId: string, qty: number) {
  for (const [, npc] of Object.entries(NPC_DATA)) {
    for (const q of (npc as any).quests) {
      // Ищем квесты на сбор предметов с этим itemId
      if (q.type === 'collect_items' && q.targetItem === itemId) {
        // Если квест активен и не выполнен — добавляем прогресс
        if (!state.completedNPCQuests.includes(q.id) && q.id in state.npcQuestProgress) {
          state.npcQuestProgress[q.id] += qty;
        }
      }
    }
  }
}
