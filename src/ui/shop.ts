// ─────────────────────────────────────────────────────────────
// shop.ts — МАГАЗИН (Poke Mart)
// ─────────────────────────────────────────────────────────────
// Отображает и управляет магазином предметов в локациях.
// Показывает список доступных предметов (с учётом SHOP_STOCK),
// цены, позволяет покупать в разных количествах.
// Поддерживает серверную синхронизацию (лимиты покупок).
//
// ЗАВИСИМОСТИ:
//   state      — глобальное состояние
//   getters    — getShopState (ассортимент), modifyMoney
//   actions    — addItem, removeItem
//   inventory  — updateInventoryDisplay (обновление инвентаря после покупки)
//   location   — updateMoneyDisplay (обновление денег)
//   save       — autoSave, getCloudAuthHeaders (серверные запросы)
//   config     — API_BASE (URL сервера для синхронизации)
//   dom        — showToast, showConfirmModal
//   sprite     — getItemSpriteImg (иконки предметов)
//   items      — ITEMS (массив всех предметов)
//
// ИСПОЛЬЗУЕТСЯ В: location.ts (кнопка "Магазин")
// ─────────────────────────────────────────────────────────────

// ── Импорты ───────────────────────────────────────────────

// state — глобальный объект состояния игры (inventory, money и т.д.)
import { state } from '../game/state.js';
// getShopState — возвращает объект магазина из глобального состояния (деньги, инвентарь, ассортимент)
// modifyMoney — изменяет количество кредитов у игрока (через store)
import { getShopState, modifyMoney } from '../game/getters.js';
// addItem/removeItem — добавляет/удаляет предмет в/из инвентаря игрока (через store)
import { addItem, removeItem } from '../game/actions.js';
// updateInventoryDisplay — перерисовывает панель инвентаря после покупки/продажи
import { updateInventoryDisplay } from './inventory.js';
// updateMoneyDisplay — обновляет отображение денег в интерфейсе локации
import { updateMoneyDisplay } from './location.js';
// autoSave — сохраняет игру в localStorage и на сервер
// getCloudAuthHeaders — возвращает заголовки авторизации для запросов к серверу (Bearer token)
import { autoSave, getCloudAuthHeaders } from '../game/save.js';
// API_BASE — базовый URL сервера (например, https://api.pokematrix.com)
import { API_BASE } from '../game/config.js';
// showToast — показывает всплывающее уведомление (зелёное/красное)
// showConfirmModal — показывает модальное окно подтверждения с callback'ом
import { showToast, showConfirmModal } from '../utils/dom.js';
// getItemSpriteImg — возвращает HTML строку с картинкой предмета указанного размера
import { getItemSpriteImg } from '../utils/sprite.js';
// ITEMS — массив ВСЕХ предметов игры (ItemDef[]), 1300+ штук
import { ITEMS } from '../data/items.js';

// ── shopPrices: словарь цен предметов ──────────────────────
// Создаём пустой объект, где ключ = item.id, значение = item.price
// Это нужно для быстрого поиска цены по ID без перебора всего массива ITEMS
const shopPrices = {};
// Проходим по всем предметам игры
ITEMS.forEach(item => {
  // Если у предмета есть цена (> 0), записываем её в словарь
  if (item.price > 0) shopPrices[item.id] = item.price;
});

// ── getShopItems: получение списка товаров для локации ────
// Принимает locId — ID локации (например, 'pallet-town', 'viridian-city')
// Возвращает массив объектов с id, icon, name, price для отображения в магазине
function getShopItems(locId) {
  // Получаем состояние магазина из глобального состояния
  // locationShopStock — объект вида { locId: ['pokeball', 'potion', ...] }
  // Это ассортимент, который сервер устанавливает для каждой локации
  const shopStock = (getShopState() as any).locationShopStock || {};
  // Берём список ID предметов для данной локации (если есть)
  const stockList = shopStock[locId];

  // Фильтруем ВСЕ предметы игры по трём условиям:
  return ITEMS
    .filter(item =>
      item.price > 0 &&                    // (1) предмет продаётся (цена > 0)
      item.implemented &&                   // (2) предмет реализован в игре
      (!stockList || stockList.includes(item.id))  // (3) если есть сток-лист — предмет должен быть в нём
    )
    // Преобразуем отфильтрованные ItemDef в компактный формат для рендера
    .map(item => ({
      id: item.id,                          // ID предмета (например, 'pokeball')
      icon: getItemSpriteImg(item.id, 28),  // HTML строкa с <img> спрайта 28×28
      name: item.nameRu,                     // Русское название предмета
      price: item.price,                     // Цена в игровых кредитах (¥)
    }));
}

// ── openShop: открыть модалку магазина ────────────────────
// Принимает locId — ID локации (необязательный, берётся из dataset модалки)
// Эта функция вызывается из location.ts при клике на кнопку "Магазин"
export function openShop(locId?) {
  // Находим DOM-элемент модалки магазина по ID
  const modal = document.getElementById('shop-modal');
  // Сохраняем ID локации в dataset модалки — он понадобится при переключении вкладок
  modal.dataset.shopLocId = locId || '';
  // Находим контейнер, куда будем вставлять список предметов
  const itemsContainer = document.getElementById('shop-items');
  // Очищаем контейнер перед заполнением (убираем старые товары)
  itemsContainer.innerHTML = '';

  // Получаем список товаров для этой локации и для каждого создаём DOM-элемент
  getShopItems(locId).forEach(item => {
    // Создаём div-карточку одного товара
    const div = document.createElement('div');
    div.className = 'shop-item';  // CSS класс для стилизации

    // Заполняем HTML карточки:
    //   shop-item-icon  — иконка предмета (спрайт 28×28)
    //   shop-item-info  — блок с названием и ценой
    //   shop-qty-wrap   — блок с input количества и кнопкой "Купить"
    //   shop-qty-input  — числовой input, значение по умолчанию 1, макс 99
    //   shop-buy-btn    — кнопка покупки, data-item хранит ID предмета
    div.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-price">¥${item.price}</div>
      </div>
      <div class="shop-qty-wrap">
        <input type="number" class="shop-qty-input" value="1" min="1" max="99" data-item="${item.id}">
        <button class="btn-use shop-buy-btn" data-item="${item.id}">Купить</button>
      </div>
    `;
    // Добавляем карточку в контейнер
    itemsContainer.appendChild(div);
  });

  // Обновляем отображение денег — берём текущее значение из getShopState()
  document.getElementById('shop-money-display').innerText = String(getShopState().money);
  // Показываем модалку (меняем display с 'none' на 'flex')
  modal.style.display = 'flex';
}

// ── initShopEvents: инициализация событий магазина ────────
// Вешает обработчики на кнопки закрытия и покупки
// Вызывается один раз при старте игры (в main.ts или init.ts)
export function initShopEvents() {
  // ── Кнопка закрытия магазина ──
  // Находим кнопку "btn-close-shop" и вешаем на click скрытие модалки
  document.getElementById('btn-close-shop').addEventListener('click', () => {
    // Скрываем модалку (display: none)
    document.getElementById('shop-modal').style.display = 'none';
  });

  // ── Делегирование кликов на кнопки "Купить" ──
  // Вешаем один обработчик на родительский контейнер shop-items
  // Это делегирование событий — не нужно вешать обработчик на каждую кнопку отдельно
  document.getElementById('shop-items').addEventListener('click', (e) => {
    // Ищем ближайший элемент с классом .shop-buy-btn от места клика
    // closest идёт вверх по DOM-дереву, так что клик может быть по кнопке или по её ребёнку
    const btn = (e.target as HTMLElement).closest('.shop-buy-btn');
    // Если кликнули не по кнопке покупки — выходим
    if (!btn) return;

    // Получаем ID предмета из data-атрибута кнопки
    const itemId = btn.getAttribute('data-item');
    // Защита: нельзя купить кредиты (они не продаются)
    if (itemId === 'credit') return showToast('Нельзя купить кредиты!', true);
    // Получаем цену предмета из словаря shopPrices
    const price = shopPrices[itemId];
    // Если цена не найдена — предмет недоступен (может быть убран из ассортимента)
    if (!price) return showToast('Товар недоступен!', true);
    // Находим input количества для этого предмета (по data-item)
    const qtyInput = document.querySelector(`.shop-qty-input[data-item="${itemId}"]`);
    // Берём значение из input, приводим к числу, ограничиваем мин 1, макс 99
    // Если значение невалидно (NaN), используем 1
    const qty = Math.max(1, Math.min(99, parseInt((qtyInput as HTMLInputElement)?.value) || 1));
    // Считаем общую стоимость: цена × количество
    const total = price * qty;

    // Проверяем, хватает ли денег у игрока
    if (getShopState().money < total) return showToast('Недостаточно кредитов!', true);

    // Блокируем кнопку, чтобы избежать двойного клика
    const btnEl = btn as HTMLButtonElement;
    btnEl.disabled = true;

    // ── Отправка запроса на сервер ──
    // POST /economy/buy — покупка предмета
    fetch(`${API_BASE}/economy/buy`, {
      method: 'POST',
      // Заголовки: авторизация (Bearer token) + тип контента JSON
      headers: { ...getCloudAuthHeaders(), 'Content-Type': 'application/json' },
      // Тело запроса: ID предмета и количество
      body: JSON.stringify({ itemId, qty })
    })
    // Парсим ответ сервера как JSON
    .then(r => r.json())
    .then(data => {
      // Разблокируем кнопку после ответа
      btnEl.disabled = false;
      // Если сервер вернул ошибку — показываем toast с сообщением об ошибке
      if (data.error) return showToast('Ошибка покупки: ' + data.error, true);

      // Успешная покупка!
      // Обновляем количество кредитов в глобальном состоянии
      // Сервер возвращает новый баланс в data.money
      state.inventory['credit'] = data.money;
      // Добавляем купленный предмет в локальный инвентарь
      state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;

      // Обновляем отображение денег в модалке магазина
      document.getElementById('shop-money-display').innerText = String(data.money);
      // Перерисовываем панель инвентаря (чтобы показать новый предмет)
      updateInventoryDisplay();
      // Обновляем отображение денег в интерфейсе локации
      updateMoneyDisplay();
      // Сохраняем игру (localStorage + сервер)
      autoSave();

      // Показываем уведомление об успешной покупке
      // Если купили больше 1 — пишем количество, иначе просто "Куплено!"
      showToast(
        qty > 1
          ? `Куплено ${qty}x! Осталось: ¥${data.money}`
          : `Куплено! Осталось: ¥${data.money}`,
        false                                         // false = зелёный toast (успех)
      );
    })
    // Обработка сетевой ошибки (нет интернета, сервер не отвечает и т.д.)
    .catch(e => {
      // Разблокируем кнопку
      btnEl.disabled = false;
      // Показываем красный toast об ошибке сети
      showToast('Сетевая ошибка', true);
    });
  });
}

// ── initSellTab: инициализация вкладки продажи ────────────
// Создаёт переключение между вкладками "Купить" и "Продать"
// Обрабатывает клики по кнопкам продажи
export function initSellTab() {
  // Находим DOM-элементы вкладок: "Продать" (shop-sell-tab) и "Купить" (shop-buy-tab)
  const sellTab = document.getElementById('shop-sell-tab');
  const buyTab = document.getElementById('shop-buy-tab');
  // Если вкладок нет в DOM — выходим (магазин без продажи, старая версия)
  if (!sellTab || !buyTab) return;

  // ── renderSell: внутренняя функция отрисовки списка продаваемых предметов ──
  // Замыкает sellTab/buyTab, вызывается при активации вкладки "Продать"
  const renderSell = () => {
    // Находим контейнер списка предметов
    const container = document.getElementById('shop-items');
    // Очищаем контейнер
    container.innerHTML = '';

    // Фильтруем предметы: исключаем кредиты, оставляем только те, что есть в инвентаре
    // getShopState().inventory — объект вида { itemId: quantity, ... }
    const sellables = ITEMS
      // Фильтр: не кредиты И количество в инвентаре > 0
      .filter(item => item.id !== 'credit' && (getShopState().inventory[item.id] || 0) > 0)
      // Преобразуем в формат для рендера
      .map(item => ({
        id: item.id,                                  // ID предмета
        icon: getItemSpriteImg(item.id, 24),          // Иконка 24×24
        name: item.nameRu,                             // Русское название
        qty: getShopState().inventory[item.id],        // Количество в инвентаре
      }));

    // Для каждого продаваемого предмета создаём DOM-карточку
    sellables.forEach(item => {
      const div = document.createElement('div');
      div.className = 'shop-item';
      // Цена продажи = половина цены покупки (округляем вниз)
      // Если цена не найдена в shopPrices — берём 100 ¥ как запасную
      const sellPrice = Math.floor((shopPrices[item.id] || 100) / 2);
      // Заполняем HTML:
      //   shop-qty-input   — input количества (макс = количество в инвентаре)
      //   shop-sell-btn    — кнопка "Продать", отключена если предметов 0
      div.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name} (x${item.qty})</div>
          <div class="shop-item-price">Продажа: ¥${sellPrice}/шт</div>
        </div>
        <div class="shop-qty-wrap">
          <input type="number" class="shop-qty-input shop-sell-qty" value="1" min="1" max="${item.qty}" data-item="${item.id}">
          <button class="btn-use shop-sell-btn" data-item="${item.id}" ${item.qty <= 0 ? 'disabled' : ''}>Продать</button>
        </div>
      `;
      container.appendChild(div);
    });
  };

  // ── Переключение на вкладку "Продать" ──
  sellTab.addEventListener('click', () => {
    // Убираем класс active с вкладки "Купить"
    buyTab.classList.remove('active');
    // Добавляем класс active на вкладку "Продать"
    sellTab.classList.add('active');
    // Отрисовываем список продаваемых предметов
    renderSell();
  });

  // ── Переключение на вкладку "Купить" ──
  buyTab.addEventListener('click', () => {
    // Убираем active с продажи
    sellTab.classList.remove('active');
    // Добавляем active на покупку
    buyTab.classList.add('active');
    // Обновляем отображение денег
    document.getElementById('shop-money-display').innerText = String(getShopState().money);
    // Находим контейнер и очищаем
    const container = document.getElementById('shop-items');
    container.innerHTML = '';
    // Берём ID локации из dataset модалки (сохранён при openShop)
    const locId = document.getElementById('shop-modal').dataset.shopLocId;
    // Получаем товары для этой локации и создаём карточки (без input количества)
    getShopItems(locId).forEach(item => {
      const div = document.createElement('div');
      div.className = 'shop-item';
      // В режиме покупки карточка проще: иконка + название + цена + кнопка "Купить"
      div.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-price">¥${item.price}</div>
        </div>
        <button class="btn-use shop-buy-btn" data-item="${item.id}">Купить</button>
      `;
      container.appendChild(div);
    });
  });

  // ── Делегирование кликов на кнопки "Продать" ──
  // Вешаем обработчик на контейнер shop-items
  document.getElementById('shop-items').addEventListener('click', (e) => {
    // Ищем ближайшую кнопку продажи .shop-sell-btn
    const btn = (e.target as HTMLElement).closest('.shop-sell-btn');
    // Если не по кнопке продажи или кнопка отключена — выходим
    if (!btn || (btn as HTMLButtonElement).disabled) return;

    // Получаем ID предмета из data-атрибута
    const itemId = btn.getAttribute('data-item');
    // Цена продажи = половина цены покупки (с запасным значением 100 ¥)
    const sellPrice = Math.floor((shopPrices[itemId] || 100) / 2);
    // Находим данные предмета в ITEMS (для названия в подтверждении)
    const itemData = ITEMS.find(i => i.id === itemId);
    // Находим input количества для этого предмета
    const qtyInput = document.querySelector(`.shop-sell-qty[data-item="${itemId}"]`);
    // Количество: берём из input, ограничиваем 1..(сколько есть в инвентаре)
    const qty = Math.max(
      1,
      Math.min(
        getShopState().inventory[itemId] || 1,       // максимум = сколько есть
        parseInt((qtyInput as HTMLInputElement)?.value) || 1  // введённое значение
      )
    );
    // Общая выручка: цена продажи × количество
    const total = sellPrice * qty;

    // Показываем модалку подтверждения перед продажей
    showConfirmModal(
      'Продать предмет?',                                         // заголовок
      `Продать ${qty}x ${itemData ? itemData.nameRu : itemId} за ¥${total.toLocaleString()}?`,  // текст
      () => {  // callback при подтверждении
        const btnEl = btn as HTMLButtonElement;
        btnEl.disabled = true;  // Блокируем кнопку от повторного клика

        // ── Отправка запроса на сервер ──
        // POST /economy/sell — продажа предмета
        fetch(`${API_BASE}/economy/sell`, {
          method: 'POST',
          headers: { ...getCloudAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, qty })  // ID предмета и количество
        })
        .then(r => r.json())  // Парсим JSON-ответ
        .then(data => {
          btnEl.disabled = false;  // Разблокируем кнопку
          // Если сервер вернул ошибку — показываем её
          if (data.error) return showToast('Ошибка продажи: ' + data.error, true);

          // Успешная продажа!
          // Обновляем баланс кредитов в глобальном состоянии
          state.inventory['credit'] = data.money;
          // Удаляем проданный предмет из локального инвентаря
          if (state.inventory[itemId] !== undefined) {
            state.inventory[itemId] -= qty;
            if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
          }

          // Обновляем отображение денег
          document.getElementById('shop-money-display').innerText = String(data.money);
          // Перерисовываем инвентарь
          updateInventoryDisplay();
          // Обновляем деньги в интерфейсе локации
          updateMoneyDisplay();
          // Сохраняем игру
          autoSave();
          // Перерисовываем список продаваемых предметов (обновляются количества)
          renderSell();
          // Показываем уведомление об успешной продаже
          showToast(`Продано ${qty}x! +¥${sellPrice * qty}`, false);
        })
        // Обработка сетевой ошибки
        .catch(e => {
          btnEl.disabled = false;
          showToast('Сетевая ошибка', true);
        });
      }
    );
  });
}
