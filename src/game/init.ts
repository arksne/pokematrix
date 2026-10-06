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

import { state, lsKey, generateUID } from './state.js';
import { store } from './store.js';
import { REGIONS } from '../data/regions.js';
import { battle, loadPokedexData, generateDailyQuests, startAutoHunt, stopAutoHunt, restoreBattleState, initEncounterEvents, initGymEvents, openQuests, checkQuestProgress } from '../battle/core.js';
import { loadGame, saveGame, cloudLoad, cloudSave, applyCloudSave, validateGameState, getFullSaveData, getLeaderboardData, getCloudAuthHeaders, autoSave, initCloudEvents, totalPokemonCountOf, totalPokemonCount, cloudUnreachable, clearLocalGameKeys } from './save.js';
import { authTelegram } from './auth.js';
import { initAppNav } from '../ui/nav.js';
import { renderTrainerCard } from '../ui/trainer-card.js';
import { getLocation, renderLocation, travelToRegion, updateTimeOfDay, updateMoneyDisplay, updateBadgeDisplay, fetchDropConfig, fetchServerFeatures, processMonsterDrop, updatePlayerLocation } from '../ui/location.js';
import { renderTeamGrid, initProfileEvents, initProfileUXEvents } from '../ui/profile.js';
import { updateInventoryDisplay, initInventoryEvents } from '../ui/inventory.js';
import { initShopEvents, initSellTab } from '../ui/shop.js';
import { initTrainersTab } from '../ui/trainers.js';
import { initDropTab } from '../ui/drop-log.js';
import { sendChatMessage } from '../ui/chat.js';
import { openPokedex } from '../ui/pokedex.js';
import { editNickname } from '../ui/nickname.js';
import { openNotifications, updateNotifBadge, addNotification } from '../ui/notifications.js';
import { giveStarter } from '../ui/starter.js';
import { startBreedingCheck } from '../ui/daycare.js';
import { openMap, setTravelCallback, setExploredLocs } from '../ui/map.js';
import { setBeforeRenderLocation } from '../ui/location.js';
import { startOnboarding, markLocationExplored, getExploredLocations, openHelp, isTutorialComplete } from '../ui/tutorial.js';
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
  initDropTab();

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

    // Кнопки Справка / Достижения / Туториал / PvP живут в шапке (index.html).
    // Раньше они создавались здесь — внутри блока `if (infoView)`, где
    // infoView = document.getElementById('view-info'), а такого элемента в
    // разметке нет: info-modal оформлен как .modal-overlay, а не как app-view.
    // Условие всегда было ложным, блок не выполнялся никогда, и кнопок
    // «Достижения», «Туториал», «PvP» и «Справка» в игре просто не
    // существовало — туториал было негде запустить вручную, а достижения и
    // PvP были доступны только из консоли.
    document.getElementById('btn-help-system')?.addEventListener('click', () => openHelp());
    // Квесты — ОДНА подписка (openQuests → quest-modal, ниже строка ~402).
    // Раньше здесь висел второй хендлер openQuestPanel() из ui/quests.js —
    // мёртвой параллельной системы (её questStates никто не заполняет):
    // по клику открывались сразу модалка с настоящими квестами И пустая
    // инлайн-панель «Нет активных квестов» под картой, которая потом пропадала
    // при следующем рендере локации. Симптом: «вкладка с квестами то есть то нет».
    document.getElementById('btn-achievements')?.addEventListener('click', () => openAchievements());
    document.getElementById('btn-tutorial')?.addEventListener('click', () => startOnboarding());
    document.getElementById('btn-pvp')?.addEventListener('click', async () => {
      const { showPvpPanel } = await import('../battle/pvp-core.js');
      showPvpPanel();
    });

    // ── 2. Авторизация ───────────────────────────────────────
    // Ждём пока пользователь залогинится через Telegram.
    // После этого: state.tgToken, state.tgUser, state.isAdmin.
    await authTelegram();

    // ── 3. Загрузка данных ────────────────────────────────────
    loadPokedexData();       // Все виды покемонов
    fetchDropConfig();       // Дроп-таблицы с сервера
    fetchServerFeatures();   // Фичи сервера (админка): double_exp/shiny_boost/free_shop/beta
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
    // Источник истины — ТОЛЬКО облако (спека 8.1). Локальный снапшот игры
    // больше не читается и не пишется: расхождение «локально vs облако» давало
    // молчаливые откаты. loadGame ниже — одноразовая миграция: если облако
    // пусто, а локально есть команда, выгружаем её наверх; дальше локальные
    // ключи стираются первым успешным синком (clearLocalGameKeys).
    // Если нигде нет — giveStarter() (новая игра).
    const localLoaded = await loadGame();
    const hadLocalTeam = localLoaded && state.myTeam.length > 0;
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
          // Решение видно в консоли: при двух устройствах важно понимать, какая
          // сторона победила. Раньше расхождение прогресса между телефоном и
          // ноутбуком было невозможно объяснить — обе стороны молча решали
          // по-своему.
          const appliedCloud = totalPokemonCountOf(cloudData) > 0;
          const localBefore = totalPokemonCountOf(state as any);
          console.log(
            `[save] облако принято: в облаке ${appliedCloud ? 'покемоны' : 'пусто'}, ` +
            `локально до этого ${localBefore}. lastSync=${state.lastCloudSync}`
          );
          if (state.myTeam.length > 0) { gameLoaded = true; }
          else if (cloudData.starterGiven) {
            gameLoaded = true;
            console.warn('Cloud save has starterGiven but empty myTeam');
          }
          // Локалка deprecated: чистим сразу, иначе мёртвые ключи снова начнут
          // участвовать в сверках. Несинкнутое (слияние уже в памяти) — наверх:
          // иначе оно живёт только до первого рефреша.
          clearLocalGameKeys();
          if (hadLocalTeam && totalPokemonCount() > totalPokemonCountOf(cloudData)) {
            state.gameLoaded = true;
            cloudSave();
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
      } else if (cloudUnreachable) {
        // Сеть недоступна, а источник один — облако. Стартер НЕ выдаём:
        // пустое состояние при появлении сети затёрло бы прогресс.
        // Локальный режим остаётся только без токена (dev), см. ниже.
        showOfflineGate();
        return;
      } else if (hadLocalTeam) {
        // Облако пусто, локально команда есть: одноразовая миграция наверх.
        // Сначала снимаем гейт, потом сохраняем (иначе cloudSave уйдёт в ранний
        // return и выгрузка потеряется на весь сеанс).
        gameLoaded = true;
        state.gameLoaded = true;
        cloudSave();
      }
    } else if (hadLocalTeam) {
      // Без токена облака нет по определению — остаётся прежний локальный режим.
      gameLoaded = true;
      state.gameLoaded = true;
    }
    // Оффлайн-заглушка (облако — единственный источник, спека 8.1): играть
    // не во что, а выдавать стартера нельзя — пустое состояние при появлении
    // сети затёрло бы прогресс. Блокируем и ждём сеть.
    function showOfflineGate() {
      let gate = document.getElementById('offline-gate');
      if (!gate) {
        gate = document.createElement('div');
        gate.id = 'offline-gate';
        gate.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:#0b1020;color:#fff;font-size:16px;padding:24px;text-align:center;';
        gate.innerHTML = '<div>☁️ Нет связи с сервером</div>' +
          '<div style="font-size:13px;opacity:0.7">Прогресс хранится в облаке — без сети продолжать нельзя, иначе данные разойдутся.</div>';
        const btn = document.createElement('button');
        btn.className = 'btn-use';
        btn.innerText = '🔄 Повторить';
        btn.onclick = () => location.reload();
        gate.appendChild(btn);
        document.body.appendChild(gate);
      } else {
        gate.style.display = 'flex';
      }
    }

    // Стартовик нельзя пропустить: пока модалка висит, init.ts стоит на
    // await giveStarter(). Раньше клик по фону просто скрывал её, и промис
    // никогда не резолвился — игра не доходила ни до рендера локации, ни до
    // восстановления состояния.
    //
    // Слушатель обязательно ставится ДО ветки с giveStarter(): раньше он был
    // зарегистрирован ниже по файлу, то есть уже после того, как промис
    // должен был разблокироваться, и событие закрытия приходило в никуда.
    // Игрок, закрывший модалку по фону, ждал 90 секунд до страховки.
    document.getElementById('starter-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        (e.currentTarget as HTMLElement).style.display = 'none';
        document.dispatchEvent(new CustomEvent('starter-modal:dismissed'));
      }
    });

    if (!gameLoaded) {
      // Настоящая новая игра: стартовика ещё не выдали, поэтому состояние пустое
      // законно. Снимаем гейт, иначе cloudSave() не сможет сохранить выбор.
      state.gameLoaded = true;
      // Стартовик больше НЕ блокирует инициализацию. Раньше здесь стоял
      // await giveStarter(), и это ломало всю игру для нового игрока: весь код
      // ниже — store.setState, renderLocation, renderTeamGrid, облачные события —
      // ждал выбора покемона. А giveStarter() ждёт либо клика, либо 90-секундной
      // страховки, а внутри ещё и ходит в PokeAPI за данными. Итог: игрок видел
      // статическую заглушку «Вермилион» из index.html — ни кнопок локации, ни
      // навигации, ни карты — и ошибки в консоли при этом не было, потому что
      // код просто стоял на await.
      //
      // Теперь стартовик выдаётся параллельно: модалка поверх игры, а мир
      // рендерится сразу. Ошибка выбора стартовика не должна отменять рендер.
      giveStarter().catch((e) => console.error('Выдача стартовика не удалась:', e));
      // giveStarterMon() уже вызвала store.emit('save') → autoSave() → cloudSave()
      // Дополнительное сохранение здесь не нужно — оно перезатрёт корректный
      // save пустым состоянием.
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
      const tutorialDone = isTutorialComplete();
      if (!tutorialDone && state.myTeam && state.myTeam.length > 0) {
        startOnboarding();
      }
    }, 500);

    initProfileEvents();
    initEncounterEvents();
    // ВАЖНО: restore ждём обязательно. Он асинхронный (дикий + вид + до 20 атак
    // из PokeAPI, секунды), а тик автоохоты стартует через 2-5с и проверяет бой
    // только по encounter-modal:flex. Без await охота вызывала startHunt() РАНЬШЕ,
    // чем рестор дорисовал старый бой: новый энкаунтер затирал S.activeWild и
    // перезаписывал battle_state — после F5 бой «сбрасывался» прямо на глазах.
    // Охоту поднимаем только если восстанавливать нечего: поднятый цикл сам
    // пропускает тики при открытом модале боя и подхватит гринд после его конца.
    const battleRestored = await restoreBattleState().catch((e) => {
      console.error('restoreBattleState failed:', e);
      return false;
    });

    if (!battleRestored && localStorage.getItem(lsKey('hunt_active')) === '1' && state.myTeam.some(m => m.currentHp > 0)) {
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
        document.querySelectorAll('.loc-tab-content').forEach(c => (c as HTMLElement).style.display = 'none');
        const target = document.getElementById('loc-tab-' + (tab as HTMLElement).dataset.tab);
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
      // Страховка от «облако ничего не знает»: если через 2 секунды ещё не было
      // ни одного успешного облачного сохранения, выкладываем текущее
      // состояние. Раньше проверки не было, и таймер срабатывал всегда — в том
      // числе до того, как загрузилась игра, выкладывая пустое состояние.
      setTimeout(() => {
        if (!state.lastCloudSync && state.gameLoaded) cloudSave();
      }, 2000);
    }

    document.getElementById('btn-close-trainer-profile')?.addEventListener('click', () => {
      document.getElementById('trainer-profile-modal').style.display = 'none';
    });

    document.getElementById('trainer-profile-modal')?.addEventListener('click', (e) => {
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
  // Облако — источник истины: выгружаем, только если есть несохранённые
  // изменения (флаг ставит autoSave, снимает успешный синк). Раньше решение
  // принималось по локальному save_ts — его больше нет.
  if (!state.saveDirty) return;
  try {
    validateGameState();
    const saveData = getFullSaveData();
    const lb = getLeaderboardData();
    const payload = JSON.stringify({ saveData, ...lb, saveVersion: state.saveVersion });
    // Один запрос на один уход со страницы. Telegram шлёт visibilitychange→hidden,
    // а потом pagehide, и раньше на каждый событие уходил свой fetch: первый
    // отменялся вторым, и в консоли появлялось «Failed to fetch» — то есть
    // последний сейв перед закрытием не доезжал.
    if (exitFlushSent) return;
    exitFlushSent = true;
    const res = fetch(`${API_BASE}/save`, {
      method: 'POST',
      headers: { ...getCloudAuthHeaders(), 'Content-Type': 'application/json' },
      body: payload,
      // keepalive ограничен браузером примерно 64 КБ. Команда с полными данными
      // Pokemon API в это не помещается, и запрос молча не уходит. navigator
      // .sendBeacon умеет больше, но не позволяет задать Authorization, поэтому
      // остаёмся на fetch и хотя бы сообщаем о неудаче.
      keepalive: true
    });
    res.catch((e) => console.warn('[save] не удалось сохранить при закрытии:', e));
  } catch (e) {
    console.warn('[save] сбой при сохранении на выходе:', e);
  }
}

/** Один сброс на уход со страницы; сбрасывается, когда игрок вернулся. */
let exitFlushSent = false;

window.addEventListener('pagehide', flushSaveOnExit);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushSaveOnExit();
  } else {
    exitFlushSent = false;
  }
});

export { state } from './state.js';
export { store } from './store.js';
export { showToast } from '../utils/dom.js';
export { renderTeamGrid } from '../ui/profile.js';
export { updateInventoryDisplay } from '../ui/inventory.js';
export { updateBadgeDisplay } from '../ui/location.js';
export { getTrainerId } from './state.js';

export function makeMon(apiData: any, trainerId: string, level: number): any {
  const baseHp = apiData.stats?.[0]?.base_stat ?? 50;
  const maxHp = Math.floor(0.01 * (2 * baseHp + 30) * level) + level + 10;
  return {
    uid: generateUID(),
    originalTrainer: trainerId,
    createdAt: Date.now(),
    apiData,
    maxHp,
    currentHp: maxHp,
    ivs: { hp: 31, attack: 31, defense: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, attack: 0, defense: 0, spa: 0, spd: 0, spe: 0 },
    baseLevel: level,
    exp: Math.pow(level, 3),
    expToNext: Math.pow(level + 1, 3),
    movesPP: [],
    statStages: { attack: 0, defense: 0, spa: 0, spd: 0, spe: 0 },
    learnableMoves: [],
    berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
    status: null,
    gender: 'male',
    natureIdx: 0,
    happiness: 0,
    heldItem: null,
  };
}
