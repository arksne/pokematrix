// ─────────────────────────────────────────────────────────────
// location.ts — ЛОКАЦИИ (рендеринг и взаимодействие)
// ─────────────────────────────────────────────────────────────
// Отвечает за рендеринг и взаимодействие с локациями игрового мира.
// Строит карточку локации (название, описание, погода, время суток),
// генерирует кнопки действий (гим, магазин, покецентр), навигацию
// между локациями, панель NPC и информацию о диких покемонах.
// Также содержит систему дропов (конфигурация с сервера, расчёт выпадения).
//
// ЗАВИСИМОСТИ:
//   state       — глобальное состояние (myTeam, currentLocationId, etc.)
//   data/*.ts   — регионы, гимы, NPC, дропы, предметы, транспорт, погода
//   ui/*.ts     — daycare, pc, shop, npcs
//   utils/dom   — showToast
//   game/save   — autoSave
//   game/config — API_BASE
//
// КЛЮЧЕВЫЕ ЭКСПОРТЫ:
//   renderLocation(locId)       — главная функция рендеринга локации
//   getLocation(locId)          — поиск локации по ID во всех регионах
//   travelToRegion(target, loc) — межрегиональное путешествие
//   healTeam()                  — лечение всей команды в покецентре
//   fetchDropConfig()           — загрузка конфигурации дропов с сервера
//   processMonsterDrop(name)    — расчёт выпавших предметов с покемона
//   updateBadgeDisplay()        — обновление отображения значков
//   updateMoneyDisplay()        — обновление отображения денег
//   updateTimeOfDay()           — переключение дня/ночи
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';
import { store } from '../game/store.js';
import { checkAchievement } from './achievements.js';          // Глобальное состояние
import { apiFetch } from '../game/apiClient.js';     // fetch с авторизацией и обновлением токена игры
import { REGIONS } from '../data/regions.js';       // Все регионы с локациями
// gymLeaders — объект { locId: { name, title, badgeName, badgeIcon, team, ... } }
import { gymLeaders } from '../data/gyms.js';
// NPC_DATA — объект { npcId: { name, sprite, location, dialog, ... } }
import { NPC_DATA } from '../data/npc.js';
import { activeQuestIds, rollQuestDrops, isQuestActive } from '../data/quest-drops.js';  // I3: дроп и гейты по квестам
// MONSTER_DROP_TABLE — таблица дропов: { speciesName: [{item, chance, qty}, ...] }
import { MONSTER_DROP_TABLE } from '../data/drops.js';
// ITEMS — массив всех предметов игры
import { ITEMS } from '../data/items.js';
// TRANSPORT_HUBS — хабы транспорта: { locId: [{targetRegion, targetLoc, label, ticket}, ...] }
import { TRANSPORT_HUBS } from '../data/transport.js';
// Погода: getDailyWeather(локация) → 'sunny'/'rain'/'fog'/etc.
//         WEATHER_ICONS — иконки погоды
//         WEATHER_NAMES — названия погоды
import { getDailyWeather, WEATHER_ICONS, WEATHER_NAMES } from '../data/weather.js';
// checkDaycare — проверяет состояние питомника
// collectDaycareMons — забирает покемонов из питомника
import { checkDaycare, collectDaycareMons } from './daycare.js';
import { openPC } from './pc.js';                   // Открыть PC-терминал
import { openShop } from './shop.js';                // Открыть магазин
// openNPCDialog — открыть диалог с NPC
// checkNPCQuestProgress — проверить прогресс квеста у NPC
// checkTutorialProgress — проверить прогресс туториала
import { openNPCDialog, checkNPCQuestProgress, checkTutorialProgress } from './npcs.js';
import { showToast } from '../utils/dom.js';          // Всплывающие уведомления
import { autoSave } from '../game/save.js';            // Автосохранение
import { API_BASE } from '../game/config.js';          // Базовый URL сервера
// Платное лечение (M-24): цена + проверка денег + сам хил
import { HEAL_PRICE, teamNeedsHeal, applyTeamHeal, tryChargeHeal } from './heal.js';

// ── ЛЕНИВЫЙ ИМПОРТ (циклические зависимости) ────────────

// profile.ts загружается лениво — он импортирует location.ts (через inventory → ...)
let profileModule: any = null;
async function getProfileModule() {
  if (!profileModule) profileModule = await import('./profile.js');
  return profileModule;
}

// Модули, которые нельзя импортировать статически: trade-center тянет за собой
// network/socket, а тот — обратно location. Цикл разрешается ESM, но полагаться
// на него не стоит, поэтому оба подключаются лениво и уже в момент клика.
//
// Раньше здесь стоял вызов main.js: якобы «main.ts глобально регистрирует
// openTradeCenter». Экспортов у main.ts нет вообще, поэтому mm.openTradeCenter
// был undefined, и кнопка обмена молча не делала ничего — обмен нельзя было
// начать ни из одного места.
let tradeCenterModule: any = null;
async function getTradeCenterModule() {
  if (!tradeCenterModule) tradeCenterModule = await import('./trade-center.js');
  return tradeCenterModule;
}

// battle/core.ts — для openGymModal, openEliteModal, checkQuestProgress
let battleCoreModule: any = null;
async function getBattleCore() {
  if (!battleCoreModule) battleCoreModule = await import('../battle/core.js');
  return battleCoreModule;
}

// ── КОНСТАНТЫ ────────────────────────────────────────────
// Ключ для sessionStorage, где кэшируется конфигурация дропов с сервера
export const DROP_CONFIG_CACHE_KEY = 'pokematrix_drop_config_cache';

// ── navStep: чистая история навигации ←/→ (для тестов и renderLocation) ──
export function navStep(
  current: string | null, last: string | null, fwd: string | null,
  target: string, via?: 'back' | 'forward',
): { current: string; last: string | null; fwd: string | null } {
  if (via === 'back') return { current: target, last, fwd: current };
  if (via === 'forward') return { current: target, last, fwd };
  if (current && current !== target) return { current: target, last: current, fwd: null };
  return { current: target, last, fwd };
}

// ── getLocation: поиск локации по ID во всех регионах ───
// Принимает locId — строковый ID локации (например, 'pallet-town')
// Возвращает объект локации или null если не найдена
// Проходит по всем регионам (kanto, johto, etc.) и ищет в их locations
export function getLocation(locId: string) {
  for (const region of Object.values(REGIONS)) {
    // REGIONS[region].locations — { locId: {name, desc, links, encounters, ...} }
    if (region.locations[locId]) return region.locations[locId];
  }
  return null;  // Локация не найдена
}

// ── getEncounterRate: шанс энкаунтера на локации (H1) ──
// Реализация в листовом src/data/encounter.ts (без циклов импорта);
// здесь реэкспорт для совместимости.
export { getEncounterRate } from '../data/encounter.js';

// ── getRegionOfLocation: получить регион локации ────────
// Принимает locId, возвращает ключ региона (kanto, johto,...)
// Если не найден — возвращает 'kanto' (по умолчанию)
export function getRegionOfLocation(locId: string) {
  for (const [key, region] of Object.entries(REGIONS)) {
    if (region.locations[locId]) return key;
  }
  return 'kanto';
}

// ── updatePlayerLocation: синхронизация локации с сервером ──
// Отправляет POST /profile/location с текущими state.currentLocationId и state.currentRegion
// Нужно чтобы другие игроки видели, где вы находитесь
export async function updatePlayerLocation() {
  if (!state.tgToken) return;
  try {
    // apiFetch, а не голый fetch: он сам добавляет Bearer и, главное, обновляет
    // токен при 401. Раньше здесь собирались заголовки вручную, поэтому после
    // истечения 15 минут запрос уходил с мёртвым токеном, а catch был пустым —
    // другие игроки просто переставали видеть ваши перемещения.
    const res = await apiFetch('/profile/location', {
      method: 'POST',
      body: JSON.stringify({
        locationId: state.currentLocationId,
        region: state.currentRegion
      })
    });
    if (!res.ok) console.warn(`[location] не отправили локацию: HTTP ${res.status}`);
  } catch (e) {
    // Сервер недоступен или сеть отвалилась — локация обновится при следующем
    // перемещении, но молчать нельзя: молчание и скрывало проблему.
    console.warn('[location] не удалось обновить локацию на сервере:', e);
  }
}

// ── travelToRegion: межрегиональное путешествие ─────────
// Принимает:
//   targetRegion — регион назначения (kanto, johto, ...)
//   targetLoc — ID локации в регионе назначения
//   ticketItemId — ID предмета-билета (если задан — требуется и сгорает, E1)
// Используется: из TRANSPORT_HUBS (кнопки транспорта)
export function travelToRegion(targetRegion: string, targetLoc: string, ticketItemId?: string) {
  // Гейт туториала (G1): дальше стартовой зоны — только после сдачи обучения
  if (!isTutorialGateOpen() && !STARTER_AREA.has(targetLoc)) {
    showToast('Сначала пройдите обучение у Профессора Оука!', true);
    return;
  }
  // E1: без билета не пускаем (если рейс/хаб его требует)
  if (ticketItemId) {
    if ((state.inventory?.[ticketItemId] || 0) <= 0) {
      showToast('Нужен билет! Купи в маркете.', true);
      return;
    }
    store.removeItem(ticketItemId);
  }
  state.currentRegion = targetRegion;  // Меняем текущий регион
  // Логируем в боевой лог (используем battle core)
  getBattleCore().then(bc => {
    bc.appendToLog(`Вы отправились в регион ${REGIONS[targetRegion].name}!`, false, 'quest');
  });
  renderLocation(targetLoc);  // Отрисовываем новую локацию
}

// ── Туториал-гейт (G1): карта дальше стартовой зоны закрыта, пока не сданы
// все 6 шагов обучения (tutorial_6 в сданных). Стартовый город и его
// сервисы доступны всегда.
const STARTER_AREA = new Set([
  'goldenrodCity', 'pokemart', 'pokecenter',
  'goldenrodStadium', 'goldenrodCity_trainingGrounds',
]);
export function isTutorialGateOpen(): boolean {
  if ((state.tutorialStep || 0) > 6) return true;
  return (state.completedNPCQuests || []).includes('tutorial_6');
}

/**
 * Ветеран для миграции: виден реальный прогресс (бейджи / 6+ локаций /
 * мон 10+ уровня), а гейт закрыт — таким засчитываем обучение сразу,
 * иначе тестеры со старыми сейвами застряли бы на старте навсегда.
 * Чистая функция ради тестов.
 */
export function isVeteranForTutorial(
  team: any[], badges: any[], visitedCount: number,
): boolean {
  const maxLvl = (team || []).reduce(
    (mx: number, m: any) => Math.max(mx, (m?.baseLevel || 1) + (m?.candiesEaten || 0)), 0);
  return (badges?.length || 0) > 0 || visitedCount > 5 || maxLvl > 10;
}
function tutorialGateToast(): boolean {
  showToast('Сначала пройдите обучение у Профессора Оука!', true);
  return false;
}

// ── Транспорт C3: паром 3ч/300к, поезд 2ч/500к ────────────
// Билет сгорает при посадке. Поезд и паром — отдельные локи без выходов:
// сильные энкаунтеры, дроп и редкие виды. Состояние в state.transport,
// переживает рефреши через сейв.
const TRANSPORTS = {
  train: { ticket: 'trainTicket', rideLoc: 'trainRide', to: 'ecruteakCity', ms: 2 * 3600 * 1000, label: 'поезд' },
  ferry: { ticket: 'ferryTicket', rideLoc: 'seaFerryRide', to: 'cianwoodCity', ms: 3 * 3600 * 1000, label: 'паром' },
};

/** Чистый статус рейса (для UI и тестов): none aboard arrived. */
export function transportStatus(tr: any, now = Date.now()) {
  if (!tr || !tr.arriveAt || !TRANSPORTS[tr.vehicle]) return { phase: 'none', msLeft: 0 };
  if (now >= tr.arriveAt) return { phase: 'arrived', msLeft: 0 };
  return { phase: 'aboard', msLeft: tr.arriveAt - now };
}

export function boardTransport(vehicle: 'train' | 'ferry') {
  const t = TRANSPORTS[vehicle];
  if (!t) return;
  if ((state.inventory?.[t.ticket] || 0) <= 0) {
    showToast('Нужен билет! Купи в маркете.', true);
    return;
  }
  store.removeItem(t.ticket);
  const now = Date.now();
  state.transport = {
    vehicle, from: state.currentLocationId, to: t.to,
    departAt: now, arriveAt: now + t.ms,
  };
  renderLocation(t.rideLoc);
  autoSave();
  showToast(`Ты сел на ${t.label}! В пути лови сильных покемонов.`, false);
}

export function arriveTransport() {
  const st = transportStatus(state.transport, Date.now());
  if (st.phase !== 'arrived') {
    const mins = Math.max(1, Math.ceil(st.msLeft / 60000));
    showToast(`Ещё в пути (~${mins} мин).`, true);
    return;
  }
  const to = state.transport.to;
  state.transport = null;
  travelToRegion('johto', to);
  autoSave();
  showToast('Прибыли!', false);
}

// ── healTeam: лечение всей команды в покецентре (M-24: ПЛАТНО) ──
// Стоит фикс HEAL_PRICE (см. heal.ts). Здоровая команда — бесплатно
// (лечить нечего, деньги не трогаем). Без денег — отказ тостом, не лечит.
export function healTeam() {
  if (state.myTeam.length === 0) { showToast('У вас нет покемонов!', true); return; }

  // Лечить нечего — бесплатно, как раньше
  if (!teamNeedsHeal(state.myTeam)) {
    const msg = 'Все покемоны уже здоровы!';
    const descEl = document.getElementById('loc-desc');
    const oldText = descEl.innerText;
    descEl.innerText = msg;
    descEl.style.color = 'var(--tma-accent)';
    setTimeout(() => {
      descEl.innerText = oldText;
      descEl.style.color = '';
    }, 2000);
    return;
  }

  // Деньги вперёд: не хватает — не лечим
  if (!tryChargeHeal()) {
    showToast(`Лечение стоит ¥${HEAL_PRICE.toLocaleString()}! Не хватает кредитов.`, true);
    return;
  }

  applyTeamHeal(state.myTeam);

  // Сообщение в зависимости от того, было ли лечение
  const msg = `Сестра Джой вылечила всю команду! (−¥${HEAL_PRICE.toLocaleString()})`;
  // Временно меняем текст описания локации (меняем на 2 секунды)
  const descEl = document.getElementById('loc-desc');
  const oldText = descEl.innerText;
  descEl.innerText = msg;
  descEl.style.color = 'var(--tma-accent)';       // Акцентный цвет
  setTimeout(() => {
    descEl.innerText = oldText;                      // Возвращаем оригинальный текст
    descEl.style.color = '';                          // Сбрасываем цвет
  }, 2000);

  autoSave();  // Сохраняем игру

  // Обновляем UI: деньги (списали HEAL_PRICE), сетка команды и профиль
  updateMoneyDisplay();
  getProfileModule().then(pm => pm.renderTeamGrid());
  getProfileModule().then(pm => pm.refreshProfileUI());
}

// ── updateTimeOfDay: обновление времени суток ──────────
// Проверяет текущее время: день (6:00-17:59) или ночь (18:00-5:59)
// Добавляет/убирает CSS-класс 'night' на .location-card
export function updateTimeOfDay() {
  const hour = new Date().getHours();                // Текущий час (0-23)
  state.isDaytime = hour >= 6 && hour < 18;           // День: 6-17, ночь: 18-5
  const card = document.querySelector('.location-card');
  if (card) {
    if (state.isDaytime) {
      card.classList.remove('night');  // Убираем ночной класс
    } else {
      card.classList.add('night');     // Добавляем ночной класс (тёмный фон)
    }
  }
}

// ── setBeforeRenderLocation: хук перед рендером локации ─
// Позволяет main.ts зарегистрировать callback, который вызывается
// ПЕРЕД renderLocation. Нужен для отслеживания исследования (checkQuestProgress)
let _beforeRenderLocation: ((locId: string) => void) | null = null;
export function setBeforeRenderLocation(fn: (locId: string) => void) {
  _beforeRenderLocation = fn;
}

// ── renderLocation: главная функция рендеринга локации ──
// Строит всю панель локации: фон, описание, погода, кнопки действий,
// NPC, навигация, транспорт, дикие покемоны
// Принимает locId — ID локации
export let renderLocation = function(locId: any, via?: 'back' | 'forward') {
  // ── Гейт: тренировочная зона только для новичков ──
  //
  // Раньше здесь стоял просто `return`. Из-за этого игрок, чей покемон дорог
  // 15 уровня, оказывался заперт: последняя сохранённая локация была
  // тренировочной зоной, renderLocation выходил до отрисовки всего — и карта,
  // навигация и кнопки оставались статической заглушкой из index.html
  // («Вермилион»). Выйти было нечем: все переходы тоже ведут в renderLocation,
  // то есть снова в этот return. Только ручная правка сейва.
  //
  // Теперь гейт отправляет игрока в обычную локацию и говорит почему.
  // Уровень считается ЭФФЕКТИВНЫЙ (baseLevel + candiesEaten) — как везде в UI:
  // иначе покемон 15+2 конфеты (17 на экране) проходил в зону новичков.
  if (locId === 'goldenrodCity_trainingGrounds' && state.myTeam.length > 0) {
    const maxLvl = Math.max(...state.myTeam.map((m: any) => (m.baseLevel || 0) + (m.candiesEaten || 0)));
    if (maxLvl > 15) {
      state.currentLocationId = 'goldenrodCity';
      locId = 'goldenrodCity';
      showToast('Тренировочная зона только для новичков (покемоны до 15 уровня) — вы в Голденроде', true);
    }
  }

  // ── Квест-гейт: локация открывается только взятым/пройденным квестом ──
  {
    const gate = (getLocation(locId) as any)?.requiresQuest;
    if (gate && !isQuestActive(gate)) {
      showToast('Сюда пускают только по квесту. Ищите квестодателя!', true);
      return state.currentLocationId;
    }
  }

  // ── Пре-рендер хук (если зарегистрирован) ──
  if (_beforeRenderLocation) _beforeRenderLocation(locId);

  // ── История навигации: ← слева (назад), → справа (вперёд) ──
  // Обычный переход: назад = откуда пришли, вперёд сбрасывается.
  // «Назад»: вперёд = где были, lastLocation не трогаем.
  // «Вперёд»: ничего не трогаем (возврат по уже записанному).
  const nav = navStep(state.currentLocationId, state.lastLocation, (state as any).locForward, locId, via);
  state.lastLocation = nav.last;
  (state as any).locForward = nav.fwd;
  state.currentLocationId = nav.current;   // Устанавливаем текущую локацию

  const loc = getLocation(locId);             // Получаем данные локации
  if (!loc) return;                           // Если локация не найдена — выходим
  state.currentRegion = getRegionOfLocation(locId);  // Определяем регион

  // Порядок важен: updatePlayerLocation() отправляет на сервер currentLocationId
  // вместе с currentRegion. Раньше вызов стоял между присваиванием локации и
  // региона, поэтому сервер получал новую локацию со старым регионом — в базе
  // копился region: johto при currentRegion: kanto в save_data.
  updatePlayerLocation();

  // ── Обновляем заголовок интерфейса ──
  const headerTitle = document.getElementById('header-title');
  if (headerTitle && headerTitle.innerText.startsWith('Мир')) {
    headerTitle.innerText = `Мир (${REGIONS[state.currentRegion]?.name || ''})`;
  }

  // ── Основная информация локации ──
  document.getElementById('loc-name').innerText = loc.name;     // Название
  document.getElementById('loc-desc').innerText = loc.desc;     // Описание

  // ── Туториал-бар ──
  let tutBar = document.getElementById('tutorial-quest-bar');
  if (!tutBar) {
    tutBar = document.createElement('div');
    tutBar.id = 'tutorial-quest-bar';
    tutBar.style.cssText = 'display:none;flex-direction:column;gap:4px;margin:8px 0;padding:8px 10px;background:rgba(0,122,255,0.12);border:1px solid rgba(0,122,255,0.3);border-radius:8px;';
    document.getElementById('loc-desc')!.after(tutBar);
  }
  import('./npcs.js').then(m => m.renderTutorialBar());

  // ── Фоновое изображение ──
  const img = loc.image;
  const locImgEl = document.getElementById('loc-image');
  if (locImgEl) {
    if (img && img.length > 0) {
      // Определяем URL: http/https → прямой, иначе — добавляем слеш
      const imgUrl = img.startsWith('http') ? img : (img.startsWith('/') ? img : '/' + img);
      locImgEl.style.backgroundImage = `url('${imgUrl}')`;
      locImgEl.style.setProperty('--loc-bg', `url('${imgUrl}')`);  // CSS-переменная для анимаций
    } else {
      locImgEl.style.backgroundImage = 'none';  // Нет картинки
    }
  }

  // ── Отображение региона ──
  const regionEl = document.getElementById('loc-region');
  if (regionEl) regionEl.innerText = REGIONS[state.currentRegion]?.name || '';

  // ── Погода ──
  const weather = getDailyWeather(locId);  // Погода на сегодня для этой локации
  const weatherEl = document.getElementById('loc-weather');
  if (weatherEl) {
    weatherEl.innerText = `${WEATHER_ICONS[weather]} ${WEATHER_NAMES[weather]}`;
  }

  // ── Время суток (день/ночь) ──
  updateTimeOfDay();
  const locNameEl = document.getElementById('loc-name');
  locNameEl.innerText = `${state.isDaytime ? '☀️' : '🌙'} ${loc.name}`;

  // ── КОНТЕЙНЕР ДЕЙСТВИЙ ──
  const actionsContainer = document.getElementById('loc-actions');
  actionsContainer.innerHTML = '';
  actionsContainer.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px';

  // ── Кнопка магазина ──
  // Если локация заканчивается на _pokemarket, _supermarket или _shop
  if (locId.endsWith('_pokemarket') || locId === 'pokemarket' ||
      locId.endsWith('_pokemart') || locId === 'pokemart' ||
      locId.endsWith('_supermarket') || locId.endsWith('_shop')) {
    const btnShop = document.createElement('button');
    btnShop.className = 'btn-use';
    btnShop.style.backgroundColor = '#ff9500';  // Оранжевый
    btnShop.innerText = '🛒 Магазин';
    btnShop.onclick = () => openShop(locId);     // Открыть магазин с ассортиментом этой локации
    actionsContainer.appendChild(btnShop);
  }

  // ── Транспорт C3: посадка и прибытие ──
  // Вокзал/причал: кнопка посадки (съедает билет). Рейс: обратный отсчёт
  // + кнопка прибытия (активна по истечении 2ч поезд / 3ч паром).
  if (locId === 'goldenrodStation' || locId === 'olivinePier') {
    const isTrain = locId === 'goldenrodStation';
    const btnBoard = document.createElement('button');
    btnBoard.className = 'btn-use';
    btnBoard.style.backgroundColor = '#5856d6';
    btnBoard.innerText = isTrain ? '🚂 Сесть на поезд (Голденрод → Экрутик)' : '⛴ Сесть на паром (Оливин → Цианвуд)';
    btnBoard.onclick = () => boardTransport(isTrain ? 'train' : 'ferry');
    actionsContainer.appendChild(btnBoard);
  }
  if (locId === 'trainRide' || locId === 'seaFerryRide') {
    const st = transportStatus(state.transport, Date.now());
    const rideDiv = document.createElement('div');
    rideDiv.style.cssText = 'grid-column:1/-1;text-align:center;padding:8px;border:1px solid var(--tma-border);border-radius:8px;';
    if (st.phase === 'arrived') {
      rideDiv.innerHTML = '<div>🏁 Прибыли! Можно сходить.</div>';
      const btnArrive = document.createElement('button');
      btnArrive.className = 'btn-use';
      btnArrive.style.backgroundColor = '#34c759';
      btnArrive.style.marginTop = '6px';
      btnArrive.innerText = '🚪 Сойти';
      btnArrive.onclick = () => arriveTransport();
      rideDiv.appendChild(btnArrive);
    } else {
      const mins = Math.max(1, Math.ceil(st.msLeft / 60000));
      const h = Math.floor(mins / 60), m = mins % 60;
      rideDiv.innerHTML = `<div>🛤️ В пути… прибытие через ${h > 0 ? h + ' ч ' : ''}${m} мин</div><div style="font-size:0.7rem;opacity:0.7;">По пути сильные покемоны — охоться!</div>`;
    }
    actionsContainer.appendChild(rideDiv);
  }

  // ── ПокеЦентр ──
  if (locId === 'pokecenter' || locId.endsWith('_pokecenter')) {
    checkDaycare();  // Проверяем питомник (обновляем статус)

    // Кнопка "Обменник (Игроки)"
    const btnTrade = document.createElement('button');
    btnTrade.className = 'btn-use';
    btnTrade.style.backgroundColor = '#007aff';
    btnTrade.innerText = '🤝 Обменник (Игроки)';
    btnTrade.onclick = () => {
    getTradeCenterModule()
      .then(tc => tc.openTradeCenter())
      .catch((e) => console.error('[trade] торговый центр не открылся', e));
  };
    actionsContainer.appendChild(btnTrade);

    // Кнопка "PvP-Арена" (M-18): жетон участия + призы за серию побед.
    // Раньше модуль арены существовал, но был НИКУДА не подключён — игрок
    // не мог на неё попасть. Отдельная кнопка, не внутри «Обменника»: трейд
    // живёт в Поке-Центре, арена — везде, где есть жетон.
    const btnArena = document.createElement('button');
    btnArena.className = 'btn-use';
    btnArena.style.backgroundColor = '#ff3b30';
    btnArena.innerText = '⚔️ PvP-Арена';
    btnArena.onclick = () => {
      import('./pvp-arena.js')
        .then(pa => pa.openPvpArenaLobby())
        .catch((e) => console.error('[arena] арена не открылась', e));
    };
    actionsContainer.appendChild(btnArena);

    // Кнопка "Вылечить команду" (M-24: платно — цена в подписи)
    const btnHeal = document.createElement('button');
    btnHeal.className = 'btn-use';
    btnHeal.style.backgroundColor = '#34c759';  // Зелёный
    btnHeal.innerText = `🏥 Вылечить команду (¥${HEAL_PRICE.toLocaleString()})`;
    btnHeal.onclick = () => healTeam();
    actionsContainer.appendChild(btnHeal);

    // Кнопка "Терминал PC"
    const btnPC = document.createElement('button');
    btnPC.className = 'btn-use';
    btnPC.style.backgroundColor = '#5856d6';  // Фиолетовый
    btnPC.innerText = '💻 Терминал PC';
    btnPC.onclick = () => openPC();
    actionsContainer.appendChild(btnPC);

    // Кнопка "Забрать из Питомника" (если есть покемоны в питомнике)
    if (state.daycareMons.length > 0) {
      const btnCollect = document.createElement('button');
      btnCollect.className = 'btn-use';
      btnCollect.style.backgroundColor = '#ff9500';
      btnCollect.innerText = `🐣 Забрать из Питомника (${state.daycareMons.length})`;
      btnCollect.onclick = () => collectDaycareMons();
      actionsContainer.appendChild(btnCollect);
    }

    // Я15: старого пути daycareEgg больше нет — яйца только из боксов,
    // сразу видны в рюкзаке (Я1), вылупление кнопкой (Я3).
  }

  // ── Кнопка лидера зала (гим) ──
  // Показываем ТОЛЬКО в стадионах (не в городах).
  // В городе есть навигация → стадион, а на стадионе — кнопка битвы.
  // Проверяем: есть ли прямо лидер для этого locId (gymLeaders ключи = stadiumId)
  const gymKey = gymLeaders[locId] ? locId : null;
  if (gymKey && !state.badges.includes(gymLeaders[gymKey].badgeName)) {
    const btnGym = document.createElement('button');
    btnGym.className = 'btn-use';
    btnGym.style.backgroundColor = '#af52de';  // Пурпурный
    btnGym.innerText = `⚔ ${gymLeaders[gymKey].name} (${gymLeaders[gymKey].title})`;
    btnGym.onclick = () => getBattleCore().then(bc => bc.openGymModal(gymKey));
    actionsContainer.appendChild(btnGym);
  }

  // ── Кнопка Элитной Четвёрки ──
  // Только в Goldenrod Stadium И если собрано 8 значков
  if (locId === 'goldenrodStadium' && state.badges.length >= 8) {
    const btnElite = document.createElement('button');
    btnElite.className = 'btn-use';
    btnElite.style.backgroundColor = '#ff3b30';  // Красный
    btnElite.innerText = '🏆 Элитная Четверка';
    btnElite.onclick = () => getBattleCore().then(bc => bc.openEliteModal());
    actionsContainer.appendChild(btnElite);
  }

  // ── Энкаунтеры (дикие покемоны) ──
  // Приоритет: dayEncounters (день) > nightEncounters (ночь) > encounters (всегда)
  let huntEncounters = loc.encounters;
  if (loc.dayEncounters && state.isDaytime) huntEncounters = loc.dayEncounters;
  else if (loc.nightEncounters && !state.isDaytime) huntEncounters = loc.nightEncounters;

  // ── Панель NPC ──
  const npcPanel = document.getElementById('npc-panel');
  const npcButtons = document.getElementById('npc-buttons');
  npcButtons.innerHTML = '';
  npcButtons.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px';

  // Находим всех NPC для этой локации
  let npcsHere = Object.values(NPC_DATA).filter(n => n.location === locId);
  if (npcsHere.length > 0) {
    npcPanel.style.display = 'block';  // Показываем панель NPC
    npcsHere.forEach(npc => {
      const npcBtn = document.createElement('button');
      npcBtn.className = 'btn-nav';
      npcBtn.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px';
      npcBtn.innerHTML = `<span>${npc.sprite} ${npc.name}</span>`;
      npcBtn.onclick = () => openNPCDialog(npc.id);  // Открыть диалог
      npcButtons.appendChild(npcBtn);
    });
  } else {
    npcPanel.style.display = 'none';  // Нет NPC — прячем панель
  }

  // ── НАВИГАЦИОННЫЕ КНОПКИ ──
  const navContainer = document.getElementById('nav-buttons');
  navContainer.innerHTML = '';
  navContainer.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px';

  // Разделяем ссылки на внешние и под-локации
  // subLinks — начинаются с locId + '_' (например, 'pallet-town_shop')
  // extLinks — всё остальное (соседние города, маршруты)
  const subLinks: Array<{id: string, loc: any}> = [];
  const extLinks: Array<{id: string, loc: any}> = [];
  loc.links.forEach(linkId => {
    const linkLoc = getLocation(linkId);
    if (!linkLoc) return;
    if (linkId.startsWith(locId + '_')) subLinks.push({ id: linkId, loc: linkLoc });
    else extLinks.push({ id: linkId, loc: linkLoc });
  });

  // ── Внешние ссылки (соседние города/маршруты) ──
  extLinks.forEach(({ id: linkId, loc: linkLoc }) => {
    const btn = document.createElement('button');
    btn.className = 'btn-nav';
    btn.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px';
    btn.innerHTML = `<span>➔ ${linkLoc.name}</span>`;
    btn.onclick = () => {
      // Отслеживание исследования: если локация новая — проверяем квест
      if (!isTutorialGateOpen() && !STARTER_AREA.has(linkId)) return tutorialGateToast();
      if (!state.visitedLocations.has(linkId)) {
        state.visitedLocations.add(linkId);
        getBattleCore().then(bc => bc.checkQuestProgress('explore'));
        if (state.visitedLocations.size >= 20) checkAchievement('explorer');
      }
      renderLocation(linkId);  // Переходим в новую локацию
    };
    navContainer.appendChild(btn);
  });

  // ── Под-локации (внутри города) ──
  if (subLinks.length > 0) {
    // Разделитель
    const sep = document.createElement('div');
    sep.style.cssText = 'grid-column:1/-1;font-size:11px;color:#888;text-align:center;padding:4px 0 2px';
    sep.innerText = '🏙 В городе';
    navContainer.appendChild(sep);

    subLinks.forEach(({ id: linkId, loc: linkLoc }) => {
      const btn = document.createElement('button');
      btn.className = 'btn-nav';
      const isTraining = linkId.includes('trainingGrounds');
      btn.style.cssText = `flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px;border-color:${isTraining ? '#34c759' : '#555'}`;
      const icon = isTraining ? '🥋' : '🏠';
      // Имя ПОДЛОКАЦИИ, а не текущего города (иначе все кнопки «Голденрод-Сити»)
      const label = isTraining ? `${linkLoc.name} (до 15 ур.)` : linkLoc.name;
      btn.innerHTML = `<span>${icon} ${label}</span>`;
      btn.onclick = () => {
        if (!isTutorialGateOpen() && !STARTER_AREA.has(linkId)) return tutorialGateToast();
        if (!state.visitedLocations.has(linkId)) {
          state.visitedLocations.add(linkId);
          getBattleCore().then(bc => bc.checkQuestProgress('explore'));
          if (state.visitedLocations.size >= 20) checkAchievement('explorer');
        }
        renderLocation(linkId);
      };
      navContainer.appendChild(btn);
    });
  }

  // ── Информация о диких покемонах (вкладка "Дикие") ──
  const wildTab = document.getElementById('loc-tab-wild');
  const wildlifeEl = document.getElementById('loc-wildlife');
  const wildlifeDetail = document.getElementById('loc-wildlife-detail');
  const wildlifeEmpty = document.getElementById('loc-wildlife-empty');

  if (huntEncounters && huntEncounters.length > 0) {
    // Фильтруем только строки (имена покемонов)
    const huntFiltered: string[] = huntEncounters.filter(n => typeof n === 'string');
    const uniqueMons = [...new Set(huntFiltered)];  // Убираем дубликаты

    if (uniqueMons.length > 0) {
      // Показываем первые 10 имён, если больше — добавляем '...'
      const monList = uniqueMons.slice(0, 10).join(', ') + (uniqueMons.length > 10 ? '...' : '');

      wildlifeDetail.innerHTML = `
        <div class="mb-6"><b>🐾 Покемоны (${uniqueMons.length}):</b><br>${monList}</div>
        <div class="mb-6 fs-085 text-muted"><b>🎒 Дроп:</b><br>${getLocationDropString(uniqueMons)}</div>
      `;
      wildlifeEl.style.display = 'block';
      wildlifeEmpty.style.display = 'none';
    } else {
      wildlifeEl.style.display = 'none';
      wildlifeEmpty.style.display = 'block';
    }
  } else {
    wildlifeEl.style.display = 'none';
    wildlifeEmpty.style.display = 'block';  // "Здесь нет диких покемонов"
  }

  // ── Сброс вкладок — показываем вкладку описания ──
  document.querySelectorAll('.loc-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.loc-tab[data-tab="desc"]')?.classList.add('active');
  const descTab = document.getElementById('loc-tab-desc');
  if (descTab) descTab.style.display = 'block';

  // ── Хлебные крошки текущей позиции (F3) ──
  // Показывают, где игрок: регион › локация (+ откуда пришёл).
  // Элемент создаётся один раз и обновляется при каждом рендере.
  {
    let crumbs = document.getElementById('loc-breadcrumbs');
    if (!crumbs) {
      crumbs = document.createElement('div');
      crumbs.id = 'loc-breadcrumbs';
      crumbs.style.cssText = 'font-size:0.75rem;color:#888;margin-bottom:4px;';
      const anchor = document.getElementById('loc-name');
      if (anchor?.parentElement) anchor.parentElement.insertBefore(crumbs, anchor);
    }
    crumbs.innerHTML = '';
    const regionSpan = document.createElement('span');
    regionSpan.textContent = `🗺️ ${REGIONS[state.currentRegion]?.name || state.currentRegion}`;
    const sep = document.createElement('span');
    sep.textContent = ' › ';
    sep.style.color = '#555';
    const cur = document.createElement('strong');
    cur.textContent = loc.name;
    cur.style.color = '#fff';
    crumbs.append(regionSpan, sep, cur);
    if (state.lastLocation && state.lastLocation !== locId) {
      const prevLoc = getLocation(state.lastLocation);
      if (prevLoc) {
        const sep2 = document.createElement('span');
        sep2.textContent = ' · ↩ ';
        sep2.style.color = '#555';
        const back = document.createElement('span');
        back.textContent = prevLoc.name;
        crumbs.append(sep2, back);
      }
    }
  }

  // ── Навигация ←/→: прошедшая слева, вперёд справа ──
  // Вместо одной кнопки «Назад»: две стрелки по краям.
  {
    const row = document.createElement('div');
    row.style.cssText = 'grid-column:1/-1;display:flex;gap:4px;';
    const mkBtn = (label: string, target: string | null, dir: 'back' | 'forward') => {
      const b = document.createElement('button');
      b.className = 'btn-nav';
      b.style.cssText = 'flex:1;min-width:fit-content;padding:6px 10px;font-size:13px;';
      b.textContent = label;
      if (!target) { (b as HTMLButtonElement).disabled = true; b.style.opacity = '0.4'; }
      else b.onclick = () => { renderLocation(target, dir); };
      return b;
    };
    const backId = (state.lastLocation && state.lastLocation !== locId) ? state.lastLocation : null;
    const backLoc = backId ? getLocation(backId) : null;
    const fwdId = (state as any).locForward || null;
    const fwdLoc = fwdId ? getLocation(fwdId) : null;
    row.appendChild(mkBtn(backLoc ? `← ${backLoc.name}` : '←', backId, 'back'));
    row.appendChild(mkBtn(fwdLoc ? `${fwdLoc.name} →` : '→', fwdId, 'forward'));
    navContainer.prepend(row);
  }

  // ── Кнопки транспорта (межрегиональные хаб) ──
  const hubs = TRANSPORT_HUBS[locId];
  if (hubs) {
    hubs.forEach(hub => {
      const btn = document.createElement('button');
      btn.className = 'btn-nav';
      btn.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px;border-color:var(--tma-accent)';
      btn.innerHTML = `<span>🎫 ${hub.label}</span>`;
      btn.onclick = () => travelToRegion(hub.targetRegion, hub.targetLoc, hub.ticket);
      navContainer.appendChild(btn);
    });
  }

  autoSave();  // Сохраняем игру (новая локация)
};

// ── getLocationDropString: строка дропов для локации ────
// Принимает массив уникальных имён покемонов
// Возвращает строку с русскими названиями предметов дропа
// Используется в wildlifeDetail для отображения "🎒 Дроп: ..."
export function getLocationDropString(uniqueMons: string[]) {
  // Приоритет: серверная конфигурация → локальная таблица
  const monsterTable = state.serverDropConfig?.monsterDrops ?? MONSTER_DROP_TABLE;
  const serverUniv = state.serverDropConfig?.universalDrops;
  const univDrops = (Array.isArray(serverUniv) && serverUniv.length > 0) ? serverUniv : UNIVERSAL_DROPS;

  // Собираем все возможные дропы
  const dropSet = new Set<string>();
  uniqueMons.forEach(name => {
    (monsterTable[name] || []).forEach(d => dropSet.add(d.item));  // Дроп с конкретных покемонов
  });
  univDrops.forEach(d => dropSet.add(d.item));  // Универсальные дропы

  // Берём первые 8, находим русские названия, склеиваем
  const items = [...dropSet].slice(0, 8).map(id => {
    const def = ITEMS.find(i => i.id === id);
    return def ? def.nameRu : id;
  }).join(', ');

  return items || '—';  // Если нет дропов — прочерк
}

// ── UNIVERSAL_DROPS: базовые универсальные дропы ────────
// D4: оставлен ТОЛЬКО самородок (2%). Крыло и кусок звезды убраны.
const UNIVERSAL_DROPS = [
  { item: 'nugget', chance: 0.02, qty: 1 },         // 2% — Самородок
];

// ── fetchDropConfig: загрузка конфигурации дропов с сервера ──
// Вызывается при старте игры
// Сохраняет в state.serverDropConfig и кэширует в sessionStorage
export async function fetchDropConfig() {
  try {
    const res = await fetch('/api/drops');
    if (res.ok) {
      state.serverDropConfig = await res.json();
      // Кэшируем в sessionStorage (на время сессии браузера)
      try { sessionStorage.setItem(DROP_CONFIG_CACHE_KEY, JSON.stringify(state.serverDropConfig)); } catch(e) {}
      return;
    }
  } catch (e) {
    // Сервер недоступен — ничего не делаем
  }
  // Если сервер не ответил — пробуем загрузить из sessionStorage
  try {
    const cached = sessionStorage.getItem(DROP_CONFIG_CACHE_KEY);
    if (cached) {
      state.serverDropConfig = JSON.parse(cached);
    }
  } catch(e) {}
}

// ── fetchServerFeatures: включённые фичи сервера (админка → toggle_feature) ──
// Публичный эндпоинт, читается при старте. Применяются: double_exp (×2 EXP),
// shiny_boost (шанс шайни ×10), free_shop (покупки за 0 — и сервер тоже),
// beta_mode (бейдж в шапке, на механики не влияет).
export async function fetchServerFeatures() {
  try {
    const res = await fetch('/api/features');
    if (res.ok) {
      const data = await res.json();
      state.serverFeatures = data.features || {};
    }
  } catch (e) { /* сервер недоступен — играем без фич */ }
  if (!state.serverFeatures) state.serverFeatures = {};
  if (state.serverFeatures.beta_mode && !document.getElementById('beta-badge')) {
    const badge = document.createElement('span');
    badge.id = 'beta-badge';
    badge.innerText = 'BETA';
    badge.style.cssText = 'font-size:0.6rem;background:#af52de;color:#fff;border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:middle;';
    const header = document.getElementById('loc-name') || document.querySelector('header');
    if (header) header.appendChild(badge);
  }
}

// ── processMonsterDrop: расчёт дропа с покемона ────────
// Принимает pokemonName — имя вида
// Возвращает массив {item, qty} — выпавшие предметы
// Используется в битве (core.ts) при победе над диким покемоном
export function processMonsterDrop(pokemonName: string) {
  const drops: Array<{item: string, qty: number}> = [];
  // Приоритет: серверная конфигурация → локальная таблица
  const monsterTable = state.serverDropConfig?.monsterDrops ?? MONSTER_DROP_TABLE;
  const serverUniv = state.serverDropConfig?.universalDrops;
  const univDrops = (Array.isArray(serverUniv) && serverUniv.length > 0) ? serverUniv : UNIVERSAL_DROPS;

  // Таблица дропа для этого конкретного покемона
  const speciesTable = monsterTable[pokemonName] || [];

  // 🔧 DEBUG: pokematrix_drop_100 — все дропы падают с 100% шансом
  const drop100 = import.meta.env.DEV
    && typeof localStorage !== 'undefined'
    && localStorage.getItem('pokematrix_drop_100') === '1';

  // Проверяем дропы с покемона
  for (const entry of speciesTable) {
    if (drop100 || Math.random() < entry.chance) {
      drops.push({ item: entry.item, qty: entry.qty });
    }
  }

  // Проверяем универсальные дропы
  for (const entry of univDrops) {
    if (drop100 || Math.random() < entry.chance) {
      drops.push({ item: entry.item, qty: entry.qty });
    }
  }

  // I3: квестовые предметы — только пока взят нужный квест
  for (const qd of rollQuestDrops(activeQuestIds(), null, drop100 ? () => 0 : Math.random)) {
    drops.push(qd);
  }

  return drops;
}

// ── updateMoneyDisplay: обновление отображения денег ────
// Раньше показывало деньги в заголовке, теперь только в инвентаре
// Функция сохранена для обратной совместимости (вызывается из других модулей)
export function updateMoneyDisplay() {
  const el = document.getElementById('money-display');
  if (el) el.textContent = '¥' + ((state.inventory?.credit || 0).toLocaleString());
  // Ачивка «Богач»: баланс достигал ¥100,000 (разовая, назад не отбирается)
  if ((state.inventory?.credit || 0) >= 100000) checkAchievement('money_100k');
}

// ── updateBadgeDisplay: обновление отображения значков ──
// Показывает количество собранных значков и их иконки
// Формат: "Значки (4/8): 🏅🏅🏅🏅"
export function updateBadgeDisplay() {
  const el = document.getElementById('badge-display');
  if (el) {
    // Маппим названия значков на иконки лидеров
    const icons = state.badges.map(b => {
      const leader = Object.values(gymLeaders).find(l => l.badgeName === b);
      return leader?.badgeIcon || '🏅';  // Если иконки нет — используем 🏅
    });
    el.innerText = `Значки (${state.badges.length}/${Object.keys(gymLeaders).length}): ${icons.join(' ')}`;
  }
}
