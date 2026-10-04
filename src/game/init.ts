/**
 * ============================================================
 * init.ts — ГЛАВНЫЙ ИНИЦИАЛИЗАТОР ИГРЫ
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   DOMContentLoaded → полная инициализация игры:
 *   1. Настраивает store (query handlers, event listeners)
 *   2. authTelegram() — логин через Telegram
 *   3. Загружает данные (Pokedex, DropConfig, карточка тренера)
 *   4. Настраивает колбэки (travel, explored locations)
 *   5. Загружает сохранение (localStorage → сравнение с cloud)
 *   6. Если сохранения нет → giveStarter()
 *   7. Рендерит локацию, команду, инвентарь, деньги
 *   8. Инициализирует события (encounter, battle, inventory, shop...)
 *   9. Запускает циклы (timeOfDay, autoSave, breeding)
 *   10. Загружает админ-панель (лениво)
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - ./state.js, ./store.js, ./save.js, ./auth.js
 *   - ../battle/core.js         → вся боевая система
 *   - ../data/regions.js        → регионы/локации
 *   - Все UI модули (30+ файлов) → рендеринг
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   main.ts (первый import, запускает DOMContentLoaded)
 * ============================================================
 */

import { state, lsKey } from './state.js';
import { store } from './store.js';
import { REGIONS } from '../data/regions.js';
import { battle, loadPokedexData, generateDailyQuests, startAutoHunt, stopAutoHunt, restoreBattleState, initEncounterEvents, initGymEvents, openQuests, checkQuestProgress } from '../battle/core.js';
import { loadGame, saveGame, cloudLoad, cloudSave, applyCloudSave, validateGameState, getFullSaveData, getLeaderboardData, getCloudAuthHeaders, autoSave, initCloudEvents, totalPokemonCountOf } from './save.js';
import { authTelegram } from './auth.js';
import { initAppNav } from '../ui/nav.js';
import { renderTrainerCard } from '../ui/trainer-card.js';
import { getLocation, renderLocation, travelToRegion, updateTimeOfDay, updateMoneyDisplay, updateBadgeDisplay, fetchDropConfig, processMonsterDrop, updatePlayerLocation } from '../ui/location.js';
import { renderTeamGrid, initProfileEvents, initProfileUXEvents } from '../ui/profile.js';
import { updateInventoryDisplay, initInventoryEvents } from '../ui/inventory.js';
import { initShopEvents, initSellTab } from '../ui/shop.js';
import { initTrainersTab } from '../ui/trainers.js';
import { sendChatMessage } from '../ui/chat.js';
import { openPokedex } from '../ui/pokedex.js';
import { editNickname } from '../ui/nickname.js';
import { openNotifications, updateNotifBadge, addNotification } from '../ui/notifications.js';
import { giveStarter } from '../ui/starter.js';
import { startBreedingCheck } from '../ui/daycare.js';
import { openMap, setTravelCallback, setExploredLocs } from '../ui/map.js';
import { setBeforeRenderLocation } from '../ui/location.js';
import { startOnboarding, markLocationExplored, getExploredLocations, openHelp } from '../ui/tutorial.js';
import { openQuestPanel } from '../ui/quests.js';
import { openAchievements } from '../ui/achievements.js';
import { showToast } from '../utils/dom.js';
import { checkTutorialProgress } from '../ui/npcs.js';
import { renderTutorialBar } from '../ui/npcs.js';
import { checkNPCQuestProgress } from '../ui/npcs.js';
import { logItemHistory } from '../game/actions.js';
import { showGymRewardSelection } from '../ui/gym-reward.js';
import { API_BASE } from './config.js';

// ── ТОЧКА ВХОДА ────────────────────────────────────────────
// Всё начинается здесь.
// ⚠️ ВНИМАНИЕ: скрипт грузится как <script type="module"> — он деферный.
// DOMContentLoaded уже произошёл к моменту исполнения этого кода.
// Поэтому НЕ используем addEventListener('DOMContentLoaded', ...), а
// запускаем init немедленно.
(async () => {
  try {
    // ── 1. Настройка store (query handlers + event listeners) ──
    // Query handlers: функции, которые возвращают значение (не event-based).
    // Event listeners: UI обновления при мутациях state.
    store.setQuery('lsKey', (name) => lsKey(name));
    store.setQuery('getLocation', (locId) => getLocation(locId));
    store.setQuery('processMonsterDrop', (name) => processMonsterDrop(name));
    store.on('money:changed', () => updateMoneyDisplay());
    store.on('inventory:changed', (itemId, delta) => {
      updateInventoryDisplay();
      if (delta > 0) {
        checkQuestProgress('collect_items', delta, itemId);
        checkNPCQuestProgress(itemId, delta);
        logItemHistory(itemId, delta, 'add');
      }
    });
    store.on('save', () => autoSave());
    store.on('team:render', () => renderTeamGrid());
    store.on('location:render', (locId) => renderLocation(locId));
    store.on('notification:add', (title, text) => addNotification(title, text));
    store.on('tutorial:progress', (type, amount, itemId) => {
      checkTutorialProgress(type, amount, itemId);
      renderTutorialBar();
    });
    store.on('gym:reward', (locId) => showGymRewardSelection(locId));
    store.on('toast', (msg, isErr) => showToast(msg, isErr));

    initAppNav();
    initShopEvents();
    initGymEvents();
    initTrainersTab();

    const mapHeader = document.getElementById('map-header');
    const mapContainer = document.getElementById('map-container');
    if (mapHeader && mapContainer) {
      mapHeader.addEventListener('click', () => {
        if (mapContainer.style.display === 'none') {
          openMap();
        } else {
          mapContainer.style.display = 'none';
        }
      });
    }

    const infoView = document.getElementById('view-info');
    if (infoView) {
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;';
      btnRow.innerHTML = `
        <button class="tma-btn nav-btn" id="btn-help-system">📖 Справка</button>
        <button class="tma-btn nav-btn" id="btn-quests">📋 Квесты</button>
        <button class="tma-btn nav-btn" id="btn-achievements">🏆 Достижения</button>
        <button class="tma-btn nav-btn" id="btn-tutorial">🎓 Туториал</button>
        <button class="tma-btn nav-btn" id="btn-pvp">⚡ PvP</button>
      `;
      infoView.insertBefore(btnRow, infoView.firstChild);

      document.getElementById('btn-help-system')?.addEventListener('click', () => openHelp());
      document.getElementById('btn-quests')?.addEventListener('click', () => openQuestPanel());
      document.getElementById('btn-achievements')?.addEventListener('click', () => openAchievements());
      document.getElementById('btn-tutorial')?.addEventListener('click', () => startOnboarding());
      document.getElementById('btn-pvp')?.addEventListener('click', async () => {
        const { showPvpPanel } = await import('../battle/pvp-core.js');
        showPvpPanel();
      });
    }

    // ── 2. Авторизация ───────────────────────────────────────
    // Ждём пока пользователь залогинится через Telegram.
    // После этого: state.tgToken, state.tgUser, state.isAdmin.
    await authTelegram();

    // ── 3. Загрузка данных ────────────────────────────────────
    loadPokedexData();       // Все виды покемонов
    fetchDropConfig();       // Дроп-таблицы с сервера
    renderTrainerCard();     // Карточка тренера

    // ── 4. Настройка колбэков ────────────────────────────────
    // travel callback: при клике на локацию на карте
    setTravelCallback((locId) => {
      const locs = REGIONS[state.currentRegion]?.locations;
      if (locs && locs[locId] && state.currentLocationId !== locId) {
        renderLocation(locId);
        return;
      }
      for (const [rk, region] of Object.entries(REGIONS)) {
        if (region.locations && region.locations[locId]) {
          travelToRegion(rk, locId);
          return;
        }
      }
    });
    // Исследованные локации (для карты)
    setExploredLocs(getExploredLocations());
    setBeforeRenderLocation((locId) => {
      if (locId) markLocationExplored(locId);
    });
    if (state.currentLocationId) markLocationExplored(state.currentLocationId);

    // ── 5. Админ-панель (лениво, только для админов) ────────
    const resetBtn = document.getElementById('btn-reset-game');
    if (resetBtn) resetBtn.style.display = 'none';
    import('../ui/admin.js').then(m => m.initAdminPanel()).catch(e => console.warn('Admin panel init failed', e));

    // ── 6. Загрузка сохранения (localStorage → cloud) ──────
    // Приоритет: cloud (сервер) > local storage.
    // Если нигде нет — giveStarter() (новая игра).
    const localLoaded = await loadGame();
    let gameLoaded = false;
    if (state.tgToken) {
      const cloudData = await cloudLoad();
      if (cloudData) {
        // Сколько покемонов было в облаке — запоминаем ДО применения, чтобы
        // знать, что именно нельзя затирать пустым состоянием.
        state.lastCloudHadTeam = totalPokemonCountOf(cloudData) > 0;
        if (cloudData.myTeam || cloudData.starterGiven) {
          // await обязателен. applyCloudSave — async, и его первый await стоит
          // на getLocationLazy() ДО присваивания state.myTeam. Без await код
          // ниже продолжал работать с пустой командой, считал игру незагруженной
          // и выкладывал в облако состояние без покемонов поверх реального.
          await applyCloudSave(cloudData);
          if (state.myTeam.length > 0) { gameLoaded = true; }
          else if (cloudData.starterGiven) {
            gameLoaded = true;
            console.warn('Cloud save has starterGiven but empty myTeam');
          }
        } else {
          // Раньше этот случай просто молча уходил в giveStarter(), и игрок
          // видел новую стартовую игру вместо своего облачного сейва, не понимая
          // почему. Сейчас предупреждение есть, а решение — восстанавливать ли
          // сейв без команды — оставлено за владельцем продукта: бездумное
          // применение такого сейва затрёт локальный прогресс.
          console.warn(
            '[save] облачный сейв отброшен: нет ни myTeam, ни starterGiven.',
            'Ключи сейва:', Object.keys(cloudData).join(', ') || '(пусто)',
          );
        }
      }
    }
    if (!gameLoaded) {
      if (localLoaded && state.myTeam.length > 0) {
        gameLoaded = true;
        if (state.tgToken) cloudSave();
      }
    }
    if (!gameLoaded) {
      // Настоящая новая игра: стартовика ещё не выдали, поэтому состояние пустое
      // законно. Снимаем гейт, иначе cloudSave() не сможет сохранить выбор.
      state.gameLoaded = true;
      await giveStarter();   // ждём пока пользователь выберет покемона
      // giveStarterMon() уже вызвала store.emit('save') → autoSave() → cloudSave()
      // Дополнительное сохранение не нужно — оно перезатрёт корректный save пустым
    } else {
      state.gameLoaded = true;
      if (state.tgToken) {
        // Синхронизация: если локальная запись свежее последнего УСПЕШНОГО
        // облачного сохранения — выкладываем её. Сравнение идёт с save_sync,
        // а не с save_ts, иначе ветка срабатывала на каждом старте.
        const localTs = parseInt(localStorage.getItem(lsKey('save_ts')) || '0');
        const cloudTs = state.lastCloudSync || 0;
        if (localTs > cloudTs + 5000) { cloudSave(); }
      }
    }

    // Sync store._state with the actual game state so store.getItemQty() works
    store.setState(state);

    try { renderLocation(state.currentLocationId); } catch(e) { console.error('renderLocation failed:', e); showToast('Ошибка загрузки локации. Нажмите кнопку сброса.', true); }

    // Сейв загрузился только что, поэтому currentLocationId и currentRegion теперь
    // настоящие. renderTrainerCard() выше отработал раньше, когда ещё стояли
    // значения по умолчанию, и список тренеров ушёл в запрос по goldenrodCity.
    // Обновляем колонку локации на сервере и перерисовываем карточку уже с
    // реальной локацией.
    updatePlayerLocation();
    renderTrainerCard();

    renderTeamGrid();
    updateInventoryDisplay();
    updateMoneyDisplay();
    updateBadgeDisplay();

    // ── Запуск туториала (после загрузки сохранения и рендера UI) ──
    setTimeout(() => {
      const tutorialDone = localStorage.getItem('league17_tutorial') === 'complete';
      if (!tutorialDone && state.myTeam && state.myTeam.length > 0) {
        startOnboarding();
      }
    }, 500);

    initProfileEvents();
    initEncounterEvents();
    restoreBattleState();

    if (localStorage.getItem(lsKey('hunt_active')) === '1' && state.myTeam.some(m => m.currentHp > 0)) {
      startAutoHunt();
    }

    initInventoryEvents();
    initProfileUXEvents();
    initCloudEvents();

    updateTimeOfDay();
    setInterval(updateTimeOfDay, 30000);

    startBreedingCheck();

    document.getElementById('btn-notifications').addEventListener('click', openNotifications);
    document.getElementById('btn-close-notif').addEventListener('click', () => { document.getElementById('notif-modal').style.display = 'none'; });
    document.getElementById('notif-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) (e.currentTarget as HTMLElement).style.display = 'none'; });
    updateNotifBadge();

    const btnOpenPokedex = document.getElementById('btn-open-pokedex');
    if (btnOpenPokedex) btnOpenPokedex.addEventListener('click', openPokedex);
    const btnClosePokedex = document.getElementById('btn-close-pokedex');
    if (btnClosePokedex) btnClosePokedex.addEventListener('click', () => {
      document.getElementById('pokedex-modal').style.display = 'none';
    });

    const btnCloseTM = document.getElementById('btn-close-tm');
    if (btnCloseTM) btnCloseTM.addEventListener('click', () => {
      document.getElementById('tm-modal').style.display = 'none';
    });

    const pokeNameEl = document.getElementById('poke-name');
    if (pokeNameEl) pokeNameEl.addEventListener('click', editNickname);

    initSellTab();

    document.querySelectorAll('.loc-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.loc-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.loc-tab-content').forEach(c => c.style.display = 'none');
        const target = document.getElementById('loc-tab-' + tab.dataset.tab);
        if (target) target.style.display = 'block';
      });
    });

    generateDailyQuests();

    const btnQuests = document.getElementById('btn-quests');
    if (btnQuests) btnQuests.addEventListener('click', openQuests);

    const btnCloseQuests = document.getElementById('btn-close-quests');
    if (btnCloseQuests) btnCloseQuests.addEventListener('click', () => {
      document.getElementById('quest-modal').style.display = 'none';
    });

    const themeToggle = document.getElementById('btn-theme-toggle');
    if (themeToggle) {
      const savedTheme = localStorage.getItem(lsKey('theme'));
      if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.innerText = '☀️';
      }
      themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
          document.documentElement.removeAttribute('data-theme');
          localStorage.setItem(lsKey('theme'), 'light');
          themeToggle.innerText = '🌙';
        } else {
          document.documentElement.setAttribute('data-theme', 'dark');
          localStorage.setItem(lsKey('theme'), 'dark');
          themeToggle.innerText = '☀️';
        }
      });
    }

    const huntToggleBtn = document.getElementById('btn-hunt-toggle');
    if (huntToggleBtn) {
      huntToggleBtn.addEventListener('click', () => {
        if (battle.state.huntActive) {
          stopAutoHunt();
        } else {
          if (!state.myTeam.some(m => m.currentHp > 0)) {
            showToast('Вам нужен хотя бы один живой покемон!', true);
            return;
          }
          startAutoHunt();
        }
      });
    }

    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    if (chatSendBtn && chatInput) {
      chatSendBtn.addEventListener('click', sendChatMessage);
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChatMessage();
      });
    }

    if (state.tgToken) {
      setTimeout(() => cloudSave(), 2000);
    }

    document.getElementById('btn-close-trainer-profile')?.addEventListener('click', () => {
      document.getElementById('trainer-profile-modal').style.display = 'none';
    });

    document.getElementById('trainer-profile-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        (e.currentTarget as HTMLElement).style.display = 'none';
      }
    });

    document.getElementById('starter-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        (e.currentTarget as HTMLElement).style.display = 'none';
      }
    });

    // Close modals by clicking overlay background (exclude encounter/battle — has own flow)
    const modalsForOverlayClose = [
      'quest-modal', 'shop-modal', 'gym-modal', 'elite-modal',
      'leaderboard-modal', 'pc-modal', 'crafting-modal', 'pokedex-modal',
      'tm-modal', 'npc-modal'
    ];
    for (const id of modalsForOverlayClose) {
      document.getElementById(id)?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }
      });
    }
  } catch(e) { document.body.innerHTML += '<div class="error-bar" style="font-size:14px;padding:15px;white-space:pre-wrap"><b>INIT ERROR:</b> '+e.message+'<br><small>'+e.stack+'</small></div>'; console.error(e); }
})();

/**
 * Последний шанс сохранить прогресс при закрытии Mini App.
 *
 * Раньше здесь стоял fetch с пустым catch и без try вокруг сборки сейва: любой
 * сбой — и прогресс молча терялся, а игрок уже видел «сохранено» от предыдущего
 * успешного цикла. Добавлен visibilitychange: Telegram закрывает Mini App не
 * всегда через pagehide, и без него хвост прогресса уходил.
 */
function flushSaveOnExit() {
  if (!state.tgToken) return;
  // Не выкладываем состояние, которое ещё не загружено, — иначе закрытие вкладки
  // во время старта затрёт реальный облачный сейв пустым.
  if (!state.gameLoaded) return;
  if (state.cloudSaveTimer) {
    clearTimeout(state.cloudSaveTimer);
    state.cloudSaveTimer = null;
  }
  const localTs = parseInt(localStorage.getItem(lsKey('save_ts')) || '0');
  if (localTs <= state.lastCloudSync + 2000) return;
  try {
    validateGameState();
    const saveData = getFullSaveData();
    const lb = getLeaderboardData();
    const res = fetch(`${API_BASE}/save`, {
      method: 'POST',
      headers: { ...getCloudAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveData, ...lb, saveVersion: state.saveVersion }),
      // keepalive ограничен браузером примерно 64 КБ. Команда с полными данными
      // Pokemon API в это не помещается, и запрос молча не уходит. navigator
      // .sendBeacon умеет больше, но не показывает ответ — поэтому шлём через
      // fetch и хотя бы логируем неудачу.
      keepalive: true
    });
    res.catch((e) => console.warn('[save] не удалось сохранить при закрытии:', e));
  } catch (e) {
    console.warn('[save] сбой при сохранении на выходе:', e);
  }
}

window.addEventListener('pagehide', flushSaveOnExit);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSaveOnExit();
});

export { state } from './state.js';
export { store } from './store.js';
export { showToast } from '../utils/dom.js';
export { renderTeamGrid } from '../ui/profile.js';
export { updateInventoryDisplay } from '../ui/inventory.js';
export { updateBadgeDisplay } from '../ui/location.js';
export { getTrainerId } from './state.js';
