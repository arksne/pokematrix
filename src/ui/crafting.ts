// ─────────────────────────────────────────────────────────────
// crafting.ts — КРАФТ (СИСТЕМА СОЗДАНИЯ ПРЕДМЕТОВ)
// ─────────────────────────────────────────────────────────────
// Отвечает за отображение модального окна крафта с группировкой
// рецептов по категориям (табы), проверку наличия ингредиентов
// и отправку запроса на сервер для выполнения крафта.
//
// ЗАВИСИМОСТИ:
//   state    — глобальное состояние (activeCraftCategory)
//   store    — event bus (emit 'save', 'inventory:changed')
//   config   — API_BASE (URL сервера)
//   save     — getCloudAuthHeaders, autoSave
//   getters  — getShopState (инвентарь после крафта)
//   state    — getItemQty (количество ингредиентов)
//   actions  — addItem, removeItem (запасные)
//   dom      — showToast (уведомления)
//   items    — ITEMS (названия предметов)
//
// ИСПОЛЬЗУЕТСЯ В: inventory.ts (крафтерский набор)
//
// ЭКСПОРТЫ:
//   openCrafting() — открывает/перерисовывает модальное окно крафта
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';            // Глобальное состояние
import { store } from '../game/store.js';              // Event-система
import { API_BASE } from '../game/config.js';          // URL сервера
import { getCloudAuthHeaders, autoSave } from '../game/save.js';  // Авторизация + сохранение
import { getItemQty } from '../game/state.js';          // Количество предметов в инвентаре
import { addItem, removeItem } from '../game/actions.js';  // Добавление/удаление предметов
import { showToast } from '../utils/dom.js';              // Уведомления
import { ITEMS } from '../data/items.js';                  // Справочник предметов

// ── CRAFTING_RECIPES: все доступные рецепты крафта ──────
// Каждый рецепт:
//   id         — уникальный ID рецепта
//   name       — название результата для отображения
//   category   — категория (для табов)
//   ingredients — { itemId: количество, ... }
//   result     — ID предмета-результата
//   qty        — сколько штук получается
const CRAFTING_RECIPES = [
  // ── Металлургия ──
  { id: 'metalIngot', name: 'Металлический слиток', category: 'Металлургия',
    ingredients: { 'ore': 3 }, result: 'metalIngot', qty: 1 },
  { id: 'glass', name: 'Стекло', category: 'Металлургия',
    ingredients: { 'mountainSand': 2, 'coal': 1 }, result: 'glass', qty: 1 },
  // ── Медицина ──
  { id: 'bandage', name: 'Бинт', category: 'Медицина',
    ingredients: { 'cotton': 3 }, result: 'bandage', qty: 1 },
  { id: 'healingPotionCraft', name: 'Лечебное зелье (Аптечка)', category: 'Медицина',
    ingredients: { 'healingHerbs': 2, 'wonderFlower': 1 }, result: 'potion', qty: 1 },
  // ── Алхимия ──
  { id: 'sparkles', name: 'Блёстки', category: 'Алхимия',
    ingredients: { 'shinyDust': 3, 'metalIngot': 1 }, result: 'sparkles', qty: 1 },
  { id: 'honeyJar', name: 'Баночка мёда', category: 'Алхимия',
    ingredients: { 'honeycomb': 2, 'woodenApricorn': 1 }, result: 'honeyJar', qty: 1 },
  // ── Окаменелости ──
  { id: 'fossilRevive', name: 'Оживить окаменелость', category: 'Окаменелости',
    ingredients: { 'suspiciousEgg': 1, 'ancientGenome': 1 }, result: 'fossil', qty: 1 },
  // ── Покеболы ──
  { id: 'craftPokeball', name: 'Покебол (x3)', category: 'Покеболы',
    ingredients: { 'woodenApricorn': 1, 'metalIngot': 1 }, result: 'pokeBall', qty: 3 },
  { id: 'craftGreatBall', name: 'Гритбол (x2)', category: 'Покеболы',
    ingredients: { 'woodenApricorn': 2, 'metalIngot': 1, 'shinyDust': 1 }, result: 'greatBall', qty: 2 },
  // ── Витамины ──
  { id: 'craftProtein', name: 'Протеин', category: 'Витамины',
    ingredients: { 'healingHerbs': 2, 'honeycomb': 1, 'ore': 1 }, result: 'protein', qty: 1 },
  { id: 'craftIron', name: 'Железо', category: 'Витамины',
    ingredients: { 'ore': 2, 'metalIngot': 1 }, result: 'iron', qty: 1 },
  // ── Ягоды ──
  { id: 'craftOran', name: 'Оран Ягода (x3)', category: 'Ягоды',
    ingredients: { 'cotton': 1, 'honeycomb': 1 }, result: 'oranBerry', qty: 3 },
  // ── Эликсиры (восстановление PP) ──
  { id: 'craftWeakElixir', name: 'Слабый эликсир', category: 'Эликсиры',
    ingredients: { 'healingHerbs': 2, 'wonderFlower': 1 }, result: 'ether', qty: 1 },
  { id: 'craftElixir', name: 'Эликсир', category: 'Эликсиры',
    ingredients: { 'healingHerbs': 3, 'wonderFlower': 2, 'honeycomb': 1 }, result: 'elixir', qty: 1 },
];  // 14 рецептов всего

// ── openCrafting: открытие модального окна крафта ────────
// Рендерит:
//   - Вкладки (табы) категорий (Металлургия, Медицина, ...)
//   - Список рецептов для активной категории
//   - Кнопки "Создать" (отключаются если не хватает ингредиентов)
export function openCrafting() {
  const modal = document.getElementById('crafting-modal');           // Модалка крафта
  const tabsContainer = document.getElementById('crafting-tabs');    // Контейнер вкладок
  const recipesContainer = document.getElementById('crafting-recipes');  // Список рецептов

  // Получаем уникальные названия категорий из всех рецептов
  const categories = [...new Set(CRAFTING_RECIPES.map(r => r.category))];

  // ── Рендер вкладок ──
  tabsContainer!.innerHTML = categories.map(cat =>
    `<span class="crafting-tab${state.activeCraftCategory === cat ? ' active' : ''}" data-cat="${cat}">${cat}</span>`
  ).join('');

  // ── Обработчики клика на вкладки ──
  tabsContainer!.querySelectorAll('.crafting-tab').forEach(tab => {
    (tab as HTMLElement).onclick = () => {
      // Устанавливаем активную категорию и перерисовываем
      state.activeCraftCategory = (tab as HTMLElement).dataset.cat;
      openCrafting();  // Рекурсивный вызов для перерисовки
    };
  });

  // ── Рендер рецептов ──
  const activeCat = state.activeCraftCategory || categories[0];  // Активная категория (или первая)
  const recipes = CRAFTING_RECIPES.filter(r => r.category === activeCat);  // Рецепты категории

  recipesContainer!.innerHTML = recipes.map(recipe => {
    // Проверяем, хватает ли всех ингредиентов для крафта
    const canCraft = Object.entries(recipe.ingredients)
      .every(([id, qty]) => getItemQty(id) >= qty);

    // Формируем текст ингредиентов: "Руда x3, Металл. слиток x1"
    const ingText = Object.entries(recipe.ingredients)
      .map(([id, qty]) => {
        const item = ITEMS.find(i => i.id === id);
        return `${item?.nameRu || id} x${qty}`;
      }).join(', ');

    // HTML карточки рецепта: название + ингредиенты + кнопка "Создать"
    return `<div class="crafting-recipe">
      <div class="crafting-recipe-info">
        <div class="crafting-recipe-name">${recipe.name}</div>
        <div class="crafting-recipe-ingredients">${ingText}</div>
      </div>
      <button class="crafting-recipe-btn" data-recipe="${recipe.id}" ${canCraft ? '' : 'disabled'}>Создать</button>
    </div>`;
  }).join('');

  // ── Обработчики кнопок "Создать" ──
  recipesContainer!.querySelectorAll('.crafting-recipe-btn').forEach(btn => {
    (btn as HTMLElement).onclick = () => craftItem((btn as HTMLElement).dataset.recipe);
  });

  // ── Кнопка закрытия ──
  const closeBtn = document.getElementById('btn-crafting-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal!.style.display = 'none';
      store.emit('save');
    };
  }

  // Показываем модалку
  modal!.style.display = 'flex';
}

// ── craftItem: HTTP-запрос крафта на сервер ──────────────
// Принимает recipeId — ID рецепта
// Отправляет POST /economy/craft, обновляет инвентарь из ответа
function craftItem(recipeId: string) {
  // Находим рецепт по ID
  const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;

  // Блокируем кнопку (чтобы не отправлять повторный запрос)
  const btnEl = document.querySelector(`.crafting-recipe-btn[data-recipe="${recipeId}"]`) as HTMLButtonElement;
  if (btnEl) btnEl.disabled = true;

  // Отправка запроса на сервер
  fetch(`${API_BASE}/economy/craft`, {
    method: 'POST',
    headers: { ...getCloudAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeId })
  })
  .then(r => r.json())
  .then(data => {
    if (btnEl) btnEl.disabled = false;  // Разблокируем кнопку
    if (data.error) return showToast('Ошибка крафта: ' + data.error, true);

    // Обновляем инвентарь из ответа сервера
    // Сохраняем credit, если сервер не вернул его в инвентаре
    const oldCredit = state.inventory?.credit || 0;
    state.inventory = data.inventory;
    if (state.inventory && !('credit' in state.inventory)) state.inventory['credit'] = oldCredit;

    // Показываем уведомление об успехе
    const resultItem = ITEMS.find(i => i.id === recipe.result);
    showToast(`Создано: ${resultItem?.nameRu || recipe.result} x${recipe.qty}!`, false);

    // Отправляем события и перерисовываем
    store.emit('inventory:changed');
    autoSave();
    openCrafting();  // Перерисовываем крафт (обновлённые количества)
  })
  .catch(e => {
    // Обработка сетевой ошибки
    if (btnEl) btnEl.disabled = false;
    showToast('Сетевая ошибка', true);
  });
}
