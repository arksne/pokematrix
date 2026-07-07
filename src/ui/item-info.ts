// ─────────────────────────────────────────────────────────────
// item-info.ts — МОДАЛЬНОЕ ОКНО ИНФОРМАЦИИ О ПРЕДМЕТЕ
// ─────────────────────────────────────────────────────────────
// Показывает детальную информацию о предмете: название (nameRu),
// описание (desc), количество в инвентаре, цену покупки/продажи.
// Закрывается по кнопке или клику на затемнённый фон.
//
// ЗАВИСИМОСТИ:
//   DOM — document.createElement, document.body.appendChild
//   CSS — .modal-overlay, .item-info-card, .tma-btn (из style.css)
//
// ИСПОЛЬЗУЕТСЯ В: inventory.ts (клик по предмету в инвентаре)
//
// ЭКСПОРТЫ:
//   showItemInfoModal(item, qty) — отрисовывает модалку
// ─────────────────────────────────────────────────────────────

// ── showItemInfoModal: показать информацию о предмете ────
// Принимает:
//   item — объект предмета { nameRu, desc, price, sellPrice }
//   qty  — количество в инвентаре
//
// Создаёт модальное окно с:
//   - Иконка 📦 + название
//   - Описание
//   - Количество, цена покупки, цена продажи
//   - Кнопка "Закрыть"
//   - Закрытие по клику на фон (overlay)
export function showItemInfoModal(item, qty) {
  // Защита: если предмет не передан — ничего не делаем
  if (!item) return;

  // ── Форматирование строки цены ──
  // Показываем цену покупки (price) и продажи (sellPrice), если они > 0
  // toLocaleString() — форматирует число с разделителями разрядов (1 000, 10 000)
  const priceInfo = item.price > 0
    ? `\n💰 Цена: ${item.price.toLocaleString()} кр.`
    : '';
  const sellInfo = item.sellPrice > 0
    ? `\n🏷️ Продажа: ${item.sellPrice.toLocaleString()} кр.`
    : '';

  // ── Создание DOM-элемента модалки ──
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';      // Затемнённый фон
  modal.style.display = 'flex';           // Показываем (flex для центрирования)

  // HTML содержимое карточки предмета
  modal.innerHTML = `
    <div class="item-info-card">
      <h3>📦 ${item.nameRu}</h3>                <!-- Название с иконкой -->
      <p>📝 ${item.desc}</p>                     <!-- Описание -->
      <div class="item-info-details">📊 Кол-во: ${qty}${priceInfo}${sellInfo}</div>  <!-- Детали -->
      <button class="tma-btn w-full mt-12" id="btn-item-info-close">Закрыть</button>
    </div>
  `;

  // ── Вставка модалки в DOM ──
  document.body.appendChild(modal);

  // ── Обработчики закрытия ──
  // cleanup — удаляет модалку и снимает обработчики (чтобы не было мусора)
  const cleanup = () => {
    document.getElementById('btn-item-info-close').removeEventListener('click', cleanup);
    modal.removeEventListener('click', onOverlay);
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  };

  // onOverlay — закрытие по клику на затемнённый фон (e.target === modal)
  const onOverlay = (e: MouseEvent) => {
    if (e.target === modal) cleanup();
  };

  // ── Регистрация событий ──
  document.getElementById('btn-item-info-close').addEventListener('click', cleanup);
  modal.addEventListener('click', onOverlay);
}
