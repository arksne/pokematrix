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

import { state } from '../game/state.js';          // Глобальное состояние игры
import { REGIONS } from '../data/regions.js';       // Все регионы с локациями
// gymLeaders — объект { locId: { name, title, badgeName, badgeIcon, team, ... } }
import { gymLeaders } from '../data/gyms.js';
// NPC_DATA — объект { npcId: { name, sprite, location, dialog, ... } }
import { NPC_DATA } from '../data/npc.js';
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
// collectDaycareEgg — забирает яйцо из питомника
import { checkDaycare, collectDaycareMons, collectDaycareEgg } from './daycare.js';
import { openPC } from './pc.js';                   // Открыть PC-терминал
import { openShop } from './shop.js';                // Открыть магазин
// openNPCDialog — открыть диалог с NPC
// checkNPCQuestProgress — проверить прогресс квеста у NPC
// checkTutorialProgress — проверить прогресс туториала
import { openNPCDialog, checkNPCQuestProgress, checkTutorialProgress } from './npcs.js';
import { showToast } from '../utils/dom.js';          // Всплывающие уведомления
import { autoSave } from '../game/save.js';            // Автосохранение
import { API_BASE } from '../game/config.js';          // Базовый URL сервера

// ── ЛЕНИВЫЙ ИМПОРТ (циклические зависимости) ────────────

// profile.ts загружается лениво — он импортирует location.ts (через inventory → ...)
let profileModule: any = null;
async function getProfileModule() {
  if (!profileModule) profileModule = await import('./profile.js');
  return profileModule;
}

// main.ts глобально регистрирует openTradeCenter
let mainModule: any = null;
async function getMainModule() {
  if (!mainModule) mainModule = await import('../../main.js');
  return mainModule;
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
  // Подготавливаем заголовки: Content-Type + Bearer token (если авторизованы)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(state.tgToken ? { 'Authorization': `Bearer ${state.tgToken}` } : {})
  };
  // Если нет токена — выходим (неавторизованный запрос)
  if (!headers.Authorization) return;
  try {
    await fetch(`${API_BASE}/profile/location`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId: state.currentLocationId,
        region: state.currentRegion
      })
    });
  } catch (e) {
    // Сервер может быть недоступен — молча игнорируем ошибку
  }
}

// ── travelToRegion: межрегиональное путешествие ─────────
// Принимает:
//   targetRegion — регион назначения (kanto, johto, ...)
//   targetLoc — ID локации в регионе назначения
//   ticketItemId — ID предмета-билета (необязательно)
// Используется: из TRANSPORT_HUBS (кнопки транспорта)
export function travelToRegion(targetRegion: string, targetLoc: string, ticketItemId?: string) {
  state.currentRegion = targetRegion;  // Меняем текущий регион
  // Логируем в боевой лог (используем battle core)
  getBattleCore().then(bc => {
    bc.appendToLog(`Вы отправились в регион ${REGIONS[targetRegion].name}!`, false, 'quest');
  });
  renderLocation(targetLoc);  // Отрисовываем новую локацию
}

// ── healTeam: лечение всей команды в покецентре ─────────
// Восстанавливает HP, снимает статусы, восстанавливает PP
// Вызывается кнопкой "🏥 Вылечить команду"
export function healTeam() {
  if (state.myTeam.length === 0) { showToast('У вас нет покемонов!', true); return; }

  let healed = false;  // Флаг: был ли хотя бы один покемон вылечен
  state.myTeam.forEach(mon => {
    if (!mon || !mon.apiData) return;  // Пропускаем невалидных

    // Пересчитываем maxHp по текущим данным
    const baseHp = mon.apiData.stats[0].base_stat;
    const curLvl = mon.baseLevel + mon.candiesEaten;
    const newMaxHp = Math.floor(
      0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl
    ) + curLvl + 10;

    // Если хоть что-то изменилось — ставим флаг healed
    if (mon.currentHp < newMaxHp || mon.status || mon.maxHp !== newMaxHp) healed = true;

    mon.maxHp = newMaxHp;       // Обновляем макс HP
    mon.currentHp = newMaxHp;   // Полное HP
    mon.status = null;           // Снимаем статус
    mon.sleepTurns = 0;          // Сбрасываем счётчик сна
    mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };  // Сбрасываем стадии статов

    // Восстанавливаем PP всех атак
    if (mon.movesPP) mon.movesPP.forEach(pp => {
      if (pp && pp.current < pp.max) { pp.current = pp.max; healed = true; }
    });
  });

  // Сообщение в зависимости от того, было ли лечение
  const msg = healed ? 'Сестра Джой вылечила всю команду!' : 'Все покемоны уже здоровы!';
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

  // Обновляем UI: перерисовываем сетку команды и профиль
  getProfileModule().then(pm => pm.renderTeamGrid());
  getMainModule().then(mm => mm.refreshProfileUI());
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
export let renderLocation = function(locId: any) {
  // ── Пре-рендер хук (если зарегистрирован) ──
  if (_beforeRenderLocation) _beforeRenderLocation(locId);

  // ── Сохраняем предыдущую локацию для навигации "Назад" ──
  if (state.currentLocationId && state.currentLocationId !== locId) {
    state.lastLocation = state.currentLocationId;
  }
  state.currentLocationId = locId;           // Устанавливаем текущую локацию
  updatePlayerLocation();                     // Синхронизируем с сервером

  const loc = getLocation(locId);             // Получаем данные локации
  if (!loc) return;                           // Если локация не найдена — выходим
  state.currentRegion = getRegionOfLocation(locId);  // Определяем регион

  // ── Обновляем заголовок интерфейса ──
  const headerTitle = document.getElementById('header-title');
  if (headerTitle && headerTitle.innerText.startsWith('Мир')) {
    headerTitle.innerText = `Мир (${REGIONS[state.currentRegion]?.name || ''})`;
  }

  // ── Основная информация локации ──
  document.getElementById('loc-name').innerText = loc.name;     // Название
  document.getElementById('loc-desc').innerText = loc.desc;     // Описание

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
      locId.endsWith('_supermarket') || locId.endsWith('_shop')) {
    const btnShop = document.createElement('button');
    btnShop.className = 'btn-use';
    btnShop.style.backgroundColor = '#ff9500';  // Оранжевый
    btnShop.innerText = '🛒 Магазин';
    btnShop.onclick = () => openShop(locId);     // Открыть магазин с ассортиментом этой локации
    actionsContainer.appendChild(btnShop);
  }

  // ── ПокеЦентр ──
  if (locId === 'pokecenter' || locId.endsWith('_pokecenter')) {
    checkDaycare();  // Проверяем питомник (обновляем статус)

    // Кнопка "Обменник (Игроки)"
    const btnTrade = document.createElement('button');
    btnTrade.className = 'btn-use';
    btnTrade.style.backgroundColor = '#007aff';
    btnTrade.innerText = '🤝 Обменник (Игроки)';
    btnTrade.onclick = () => getMainModule().then(mm => mm.openTradeCenter());
    actionsContainer.appendChild(btnTrade);

    // Кнопка "Вылечить команду"
    const btnHeal = document.createElement('button');
    btnHeal.className = 'btn-use';
    btnHeal.style.backgroundColor = '#34c759';  // Зелёный
    btnHeal.innerText = '🏥 Вылечить команду';
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

    // Кнопка "Забрать яйцо" (если готово)
    if (state.daycareEgg && Date.now() >= state.daycareEgg.readyTime) {
      const btnEgg = document.createElement('button');
      btnEgg.className = 'btn-use';
      btnEgg.style.backgroundColor = '#ffcc00';
      btnEgg.style.color = '#000';
      btnEgg.innerText = '🥚 Забрать яйцо!';
      btnEgg.onclick = () => collectDaycareEgg();
      actionsContainer.appendChild(btnEgg);
    }
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
      if (!state.visitedLocations.has(linkId)) {
        state.visitedLocations.add(linkId);
        getBattleCore().then(bc => bc.checkQuestProgress('explore'));
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
      btn.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px;border-color:#555';
      btn.innerHTML = `<span>🏠 ${linkLoc.name}</span>`;
      btn.onclick = () => {
        if (!state.visitedLocations.has(linkId)) {
          state.visitedLocations.add(linkId);
          getBattleCore().then(bc => bc.checkQuestProgress('explore'));
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

  // ── Кнопка "Назад" из сервисных локаций (покецентр, магазин) ──
  const isServiceLoc = locId === 'pokecenter' || locId.endsWith('_pokecenter')
    || locId === 'pokemart' || locId.endsWith('_pokemart')
    || locId === 'pokemarket' || locId.endsWith('_pokemarket')
    || locId.endsWith('_supermarket') || locId.endsWith('_shop');
  if (isServiceLoc && state.lastLocation) {
    const backLoc = getLocation(state.lastLocation);
    if (backLoc) {
      const btnBack = document.createElement('button');
      btnBack.className = 'btn-nav';
      btnBack.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px;border-color:var(--tma-accent)';
      btnBack.innerHTML = `<span>↩ ${backLoc.name}</span>`;
      btnBack.onclick = () => {
        renderLocation(state.lastLocation);  // Возвращаемся
        state.lastLocation = null;            // Сбрасываем
      };
      navContainer.appendChild(btnBack);
    }
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
// Используются если сервер не предоставил свою конфигурацию
// Каждый предмет: {item, chance (0-1), qty}
const UNIVERSAL_DROPS = [
  { item: 'prettyWing', chance: 0.04, qty: 1 },   // 4% — Красивое крыло
  { item: 'nugget', chance: 0.02, qty: 1 },         // 2% — Самородок
  { item: 'starPiece', chance: 0.01, qty: 1 },      // 1% — Кусок звезды
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
  const drop100 = typeof localStorage !== 'undefined' && localStorage.getItem('pokematrix_drop_100') === '1';

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

  return drops;
}

// ── updateMoneyDisplay: обновление отображения денег ────
// Раньше показывало деньги в заголовке, теперь только в инвентаре
// Функция сохранена для обратной совместимости (вызывается из других модулей)
export function updateMoneyDisplay() {
  // Пусто — отображение денег убрано из заголовка
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
