// ─────────────────────────────────────────────────────────────
// map.ts — ИНТЕРАКТИВНАЯ КАРТА РЕГИОНОВ
// ─────────────────────────────────────────────────────────────
// Создаёт Canvas-карту с узлами-локациями, которые можно выбирать,
// просматривать информацию через всплывающие модальные окна
// и путешествовать между ними. Поддерживает панорамирование (drag),
// hover-тултипы и боковой список локаций с сортировкой по исследованности.
//
// ЗАВИСИМОСТИ:
//   data/regions  — REGIONS (все регионы, локации, связи)
//
// ИСПОЛЬЗУЕТСЯ В:
//   game/init.ts  — инициализация openMap, setTravelCallback, setExploredLocs
//
// КЛЮЧЕВЫЕ ЭКСПОРТЫ:
//   openMap()           — открывает контейнер с картой и рендерит весь интерфейс
//   closeMap()          — скрывает контейнер карты
//   showRegionMap(key)  — отображает карту для указанного региона
//   showLocationInfo(id)— показывает модальное окно с информацией о локации
//   updateLocList(key)  — обновляет боковой список локаций
//   setTravelCallback() — устанавливает колбэк для телепорта к локации
//   setExploredLocs()   — задаёт список исследованных локаций
//   onTravelTo          — экспортированная переменная-колбэк путешествия
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────
// REGIONS — объект всех регионов: { kanto: { name, locations: { locId: {...} } }, ... }
import { REGIONS } from '../data/regions.js';

// ── СОСТОЯНИЕ МОДУЛЯ И CALLBACK'И ────────────────────────
let mapCanvas: HTMLCanvasElement | null = null;               // Canvas-элемент карты
let mapCtx: CanvasRenderingContext2D | null = null;            // 2D контекст отрисовки
let selectedRegion: string | null = null;                      // Выбранный регион (kanto, johto...)
let selectedLoc: string | null = null;                         // Выбранная локация (для подсветки)
let nodePositions: Record<string, { x: number; y: number }> = {};  // Позиции узлов на карте
let hoveredNode: string | null = null;                         // Локация под курсором

// Панорамирование (drag)
let offsetX = 0, offsetY = 0;                // Смещение canvas
let isPanning = false;                        // Флаг: сейчас перетаскивание
let panStartX = 0, panStartY = 0;             // Начальная позиция панорамирования
let mapScale = 1;                              // Масштаб (пока не используется для зума)

// Исследованные локации (Set для быстрой проверки)
let exploredLocs = new Set<string>();

// Колбэк: вызывается при клике "Телепортироваться" (если зарегистрирован)
export let onTravelTo: ((locId: string) => void) | null = null;

// ── Установка колбэков ──
export function setTravelCallback(fn: (locId: string) => void) { onTravelTo = fn; }
export function setExploredLocs(locs: string[]) { exploredLocs = new Set(locs); }

// ── showLocationInfo: показать модалку информации о локации ──
// Принимает locId — ID локации
// Создаёт всплывающее окно с: картинкой, названием, описанием,
//   статистикой (виды покемонов, покецентр, вода), список связей
// Это чисто информационная модалка (без телепорта)
export function showLocationInfo(locId: string) {
  if (!selectedRegion) return;
  // Получаем все локации региона
  const locs = (REGIONS as any)[selectedRegion]?.locations;
  if (!locs || !locs[locId]) return;
  const loc = locs[locId];

  // Удаляем предыдущую модалку (если есть) — чтобы не накапливались
  const oldModal = document.getElementById('map-info-modal');
  if (oldModal) oldModal.remove();

  const imgPath = loc.image || '';  // URL картинки локации

  // Имена связанных локаций (для отображения)
  const linkNames = (loc.links || [])
    .map((id: string) => locs[id]?.name || id)  // Берём русские названия
    .join(', ');

  // Создаём модальное окно
  const modal = document.createElement('div');
  modal.id = 'map-info-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);';

  // Внутреннее содержимое:
  //   — Картинка (если есть)
  //   — Заголовок с именем
  //   — Кнопка закрытия
  //   — Описание
  //   — Бейджи: количество видов, покецентр, вода
  //   — Список связанных локаций
  modal.innerHTML = `
    <div style="background:var(--tma-bg,#1a1a2e);border:1px solid var(--tma-border,rgba(255,255,255,0.1));border-radius:16px;max-width:380px;width:90%;max-height:85vh;overflow-y:auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.5);">
      ${imgPath
        ? `<img src="${imgPath}" alt="${loc.name}" style="width:100%;height:160px;object-fit:cover;border-radius:16px 16px 0 0;display:block;" onerror="this.style.display='none'">`
        : ''
      }
      <div style="padding:16px 18px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <h3 style="margin:0;font-size:1.1rem;color:#fff;">${loc.name}</h3>
          <button id="map-info-close" style="background:none;border:none;color:#999;font-size:1.4rem;cursor:pointer;padding:0 4px;line-height:1;">✕</button>
        </div>
        <p style="margin:0 0 12px;font-size:0.85rem;color:#bbb;line-height:1.5;">${loc.desc || 'Нет описания.'}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          <span style="background:rgba(74,158,255,0.15);color:#4a9eff;padding:3px 10px;border-radius:20px;font-size:0.7rem;">👾 ${(loc.encounters?.length || 0)} видов</span>
          ${loc.hasHeal ? '<span style="background:rgba(52,199,89,0.15);color:#34c759;padding:3px 10px;border-radius:20px;font-size:0.7rem;">✅ Покецентр</span>' : ''}
          ${loc.hasWater ? '<span style="background:rgba(90,200,250,0.15);color:#5ac8fa;padding:3px 10px;border-radius:20px;font-size:0.7rem;">🌊 Вода</span>' : ''}
        </div>
        ${linkNames ? `<div style="font-size:0.75rem;color:#888;"><span style="color:#666;">🔗 Связано с:</span> ${linkNames}</div>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ── Обработчики закрытия ──
  const closeBtn = document.getElementById('map-info-close');
  if (closeBtn) closeBtn.onclick = () => modal.remove();  // Кнопка ✕
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();  // Клик по затемнённому фону
  });
}

// ── REGION_META: метаданные регионов для UI ─────────────
// name — русское название, icon — иконка, color — цвет кнопки
const REGION_META: Record<string, { name: string; icon: string; color: string }> = {
  kanto: { name: 'Канто', icon: '🗺️', color: '#4a9eff' },
  johto: { name: 'Джото', icon: '🗺️', color: '#facc15' },
};

// ── generatePositions: генерация позиций узлов на карте ──
// Принимает regionKey — ключ региона
// Возвращает { locId: {x, y} } — координаты для каждой локации
// Алгоритм: сначала размещает города (hasHeal) по сетке,
//   затем размещает остальные рядом со связанными городами
function generatePositions(regionKey: string): Record<string, { x: number; y: number }> {
  const locs = (REGIONS as any)[regionKey]?.locations;
  if (!locs) return {};
  const ids = Object.keys(locs);
  const positions: Record<string, { x: number; y: number }> = {};
  const cols = Math.max(4, Math.ceil(Math.sqrt(ids.length)));  // Колонки сетки
  const spacing = 130;  // Расстояние между узлами

  // Разделяем на города (хабы) и не-города
  const hubs = ids.filter(id => locs[id].hasHeal);      // Города с покецентром
  const nonHubs = ids.filter(id => !locs[id].hasHeal);   // Маршруты, пещеры и т.д.

  // Размещаем города по сетке
  hubs.forEach((id, i) => {
    positions[id] = {
      x: (i % cols) * spacing + 80,                     // Колонка
      y: Math.floor(i / cols) * spacing + 80              // Строка
    };
  });

  // Размещаем остальные локации рядом со связанными городами
  nonHubs.forEach(id => {
    const links = locs[id].links || [];
    let px = 300 + Math.random() * 200;
    let py = 300 + Math.random() * 200;
    // Если есть связь с уже размещённой локацией — размещаем рядом
    for (const link of links) {
      if (positions[link]) {
        px = positions[link].x + (Math.random() - 0.5) * 80;  // Случайное смещение
        py = positions[link].y + (Math.random() - 0.5) * 80;
        break;
      }
    }
    // Ограничиваем границы (30-700)
    positions[id] = {
      x: Math.max(30, Math.min(700, px)),
      y: Math.max(30, Math.min(700, py))
    };
  });

  return positions;
}

// ── updateLocList: обновление бокового списка локаций ───
// Показывает все локации региона, сортируя: исследованные сверху
// Исследованные — синие с 📍, неисследованные — серые с ❓
export function updateLocList(regionKey: string) {
  const listEl = document.getElementById('map-loc-list');
  if (!listEl) return;
  const locs = (REGIONS as any)[regionKey]?.locations;
  if (!locs) return;

  // Сортируем: исследованные (true) → вверх, неисследованные → вниз
  listEl.innerHTML = Object.entries(locs)
    .sort(([a], [b]) => Number(exploredLocs.has(b)) - Number(exploredLocs.has(a)))
    .map(([id, loc]: [string, any]) =>
      `<div class="map-loc-item ${exploredLocs.has(id) ? 'explored' : ''} ${selectedLoc === id ? 'active' : ''}"
            data-loc="${id}">
        <span style="color:${exploredLocs.has(id) ? '#4a9eff' : 'rgba(255,255,255,0.4)'}">
          ${exploredLocs.has(id) ? '📍' : '❓'} ${loc.name}
        </span>
      </div>`
    ).join('');

  // При клике на элемент списка — показываем информацию о локации
  listEl.querySelectorAll('.map-loc-item').forEach(el => {
    el.addEventListener('click', () => {
      const locId = (el as HTMLElement).dataset.loc;
      if (locId) showLocationInfo(locId);
    });
  });
}

// ── drawMap: отрисовка canvas карты ─────────────────────
// Рисует:
//   1. Линии связей (неисследованные — пунктир, исследованные — сплошные синие)
//   2. Узлы (круги: города = 11px, остальные = 7px)
//   3. Подписи локаций
//   4. Тултип при наведении (hover)
function drawMap() {
  if (!mapCtx || !mapCanvas || !selectedRegion) return;
  const canvas = mapCanvas;
  const ctx = mapCtx;
  const W = canvas.width;
  const H = canvas.height;

  // Очищаем canvas и применяем трансформацию (панорамирование + масштаб)
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(mapScale, mapScale);

  const locs = (REGIONS as any)[selectedRegion]?.locations;
  if (!locs) { ctx.restore(); return; }
  const ids = Object.keys(locs);

  // ── 1. Линии связей (неисследованные) ──
  // Серые пунктирные линии для всех маршрутов (независимо от исследования)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);  // Пунктир
  ids.forEach(id => {
    const from = nodePositions[id];
    if (!from) return;
    (locs[id].links || []).forEach((linkId: string) => {
      const to = nodePositions[linkId];
      if (!to || id >= linkId) return;  // Рисуем каждое соединение только 1 раз
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
  });
  ctx.setLineDash([]);  // Сбрасываем пунктир

  // ── 2. Линии связей (исследованные) ──
  // Синие, более яркие и толстые линии между исследованными локациями
  ctx.strokeStyle = 'rgba(74, 158, 255, 0.35)';
  ctx.lineWidth = 2.5;
  ids.forEach(id => {
    if (!exploredLocs.has(id)) return;
    const from = nodePositions[id];
    if (!from) return;
    (locs[id].links || []).forEach((linkId: string) => {
      if (!exploredLocs.has(linkId)) return;
      const to = nodePositions[linkId];
      if (!to || id >= linkId) return;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
  });

  // ── 3. Узлы (круги) ──
  ids.forEach(id => {
    const pos = nodePositions[id];
    if (!pos) return;
    const loc = locs[id];
    const isCity = loc.hasHeal;                   // Город = больший круг
    const isHovered = hoveredNode === id;          // Под курсором
    const isExplored = exploredLocs.has(id);       // Исследована
    const isSel = selectedLoc === id;              // Выбрана
    const radius = isCity ? 11 : 7;                // Радиус: город 11px, остальное 7px

    // ── Свечение для исследованных ──
    if (isExplored) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
      ctx.fill();
    }

    // ── Круг узла ──
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isHovered
      ? '#fff'                                    // Белый (хoвер)
      : (isExplored ? '#4a9eff' : 'rgba(255,255,255,0.25)');  // Синий или серый
    ctx.fill();

    // ── Обводка ──
    if (isSel) {
      ctx.strokeStyle = '#ff9500';  // Оранжевый для выбранного
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (isHovered) {
      ctx.strokeStyle = '#fff';     // Белый для ховера
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // ── Подпись ──
    const label = loc.name.length > 18 ? loc.name.slice(0, 16) + '…' : loc.name;
    ctx.fillStyle = isHovered ? '#fff' : (isExplored ? '#ccc' : 'rgba(255,255,255,0.4)');
    ctx.font = isHovered ? 'bold 11px sans-serif' : '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, pos.x, pos.y + radius + 13);  // Подпись под кругом
  });

  ctx.restore();  // Восстанавливаем трансформацию

  // ── 4. Тултип при наведении ──
  // Рисуется ПОСЛЕ restore(), в экранных координатах
  if (hoveredNode && locs[hoveredNode]) {
    const pos = nodePositions[hoveredNode];
    if (pos) {
      const loc = locs[hoveredNode];
      // Вычисляем позицию тултипа (рядом с узлом)
      const tx = Math.min(pos.x * mapScale + offsetX + 15, W - 200);  // Не выходит за правый край
      const ty = Math.max(pos.y * mapScale + offsetY - 50, 10);         // Не выходит за верх

      ctx.save();
      // Фон тултипа (тёмный полупрозрачный)
      ctx.fillStyle = 'rgba(15,15,25,0.93)';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      roundRect(ctx, tx, ty, 190, 65, 8);  // Скруглённый прямоугольник
      ctx.fill();
      ctx.stroke();

      // Текст: название, количество видов, покецентр
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(loc.name, tx + 10, ty + 18);

      ctx.fillStyle = '#999';
      ctx.font = '9px sans-serif';
      ctx.fillText(`👾 ${(loc.encounters?.length || 0)} диких видов`, tx + 10, ty + 35);

      if (loc.hasHeal) {
        ctx.fillStyle = '#4a9eff';
        ctx.fillText('✅ Покецентр', tx + 10, ty + 52);
      }
      ctx.restore();
    }
  }
}

// ── roundRect: вспомогательная функция — скруглённый прямоугольник ──
// Рисует путь (path) скруглённого прямоугольника на canvas
// Используется для тултипа и других элементов интерфейса
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);                      // Верхний левый угол (отступ от края)
  ctx.lineTo(x + w - r, y);                  // Верхняя сторона
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);   // Верхний правый угол
  ctx.lineTo(x + w, y + h - r);              // Правая сторона
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); // Нижний правый угол
  ctx.lineTo(x + r, y + h);                  // Нижняя сторона
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);   // Нижний левый угол
  ctx.lineTo(x, y + r);                      // Левая сторона
  ctx.quadraticCurveTo(x, y, x + r, y);      // Верхний левый угол
  ctx.closePath();
}

// ── setupCanvas: настройка canvas и событий ──────────────
// Создаёт canvas-элемент и вешает обработчики мыши/тача:
//   mousemove — ховер (подсветка узла)
//   click — выбор локации
//   mousedown/mouseup — панорамирование (drag)
//   touch — поддержка тач-устройств
function setupCanvas() {
  if (mapCanvas) return;  // Уже создан — выходим
  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap) return;

  // Создаём canvas
  mapCanvas = document.createElement('canvas');
  mapCanvas.id = 'map-canvas';
  mapCanvas.style.cssText = 'width:100%;height:380px;border-radius:12px;background:rgba(0,0,0,0.3);cursor:grab;display:block;';
  wrap.appendChild(mapCanvas);
  mapCtx = mapCanvas.getContext('2d')!;

  // ── Mouse: движение — поиск ближайшего узла ──
  mapCanvas.addEventListener('mousemove', (e) => {
    const rect = mapCanvas!.getBoundingClientRect();
    // Преобразуем координаты мыши в координаты canvas (с учётом DPI)
    const mx = (e.clientX - rect.left) * (mapCanvas!.width / rect.width);
    const my = (e.clientY - rect.top) * (mapCanvas!.height / rect.height);

    // Ищем ближайший узел в радиусе 18px
    let closest: string | null = null;
    let closestDist = 18;
    for (const [id, pos] of Object.entries(nodePositions)) {
      const sx = pos.x * mapScale + offsetX;   // Трансформированные координаты
      const sy = pos.y * mapScale + offsetY;
      const d = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
      if (d < closestDist) { closestDist = d; closest = id; }
    }
    hoveredNode = closest;  // Запоминаем
    mapCanvas!.style.cursor = closest ? 'pointer' : 'grab';  // Меняем курсор
    if (!isPanning) drawMap();  // Перерисовываем (если не панорамируем)
  });

  // ── Mouse: клик — выбор локации ──
  mapCanvas.addEventListener('click', () => {
    if (!hoveredNode || !selectedRegion) return;
    selectedLoc = hoveredNode;
    drawMap();
    updateLocList(selectedRegion);
    showLocationInfo(hoveredNode);  // Показываем инфо
  });

  // ── Mouse: начало панорамирования ──
  mapCanvas.addEventListener('mousedown', (e) => {
    if (hoveredNode) return;  // Если наведено на узел — не панорамируем
    isPanning = true;
    panStartX = e.clientX - offsetX;
    panStartY = e.clientY - offsetY;
    mapCanvas!.style.cursor = 'grabbing';
  });

  // ── Mouse: панорамирование ──
  mapCanvas.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    offsetX = e.clientX - panStartX;
    offsetY = e.clientY - panStartY;
    drawMap();
  });

  // ── Mouse: остановка панорамирования ──
  const stopPan = () => {
    isPanning = false;
    if (mapCanvas) mapCanvas.style.cursor = 'grab';
  };
  mapCanvas.addEventListener('mouseup', stopPan);
  mapCanvas.addEventListener('mouseleave', stopPan);

  // ── Touch: начало касания ──
  let touchStartX = 0, touchStartY = 0;
  mapCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      panStartX = offsetX;
      panStartY = offsetY;
    }
  }, { passive: true });

  // ── Touch: перемещение (панорамирование) ──
  mapCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      offsetX = panStartX + dx * 2;  // Умножаем на 2 для более быстрого панорамирования
      offsetY = panStartY + dy * 2;
      drawMap();
    }
  }, { passive: true });

  // ── Touch: конец касания (проверяем был ли тап) ──
  mapCanvas.addEventListener('touchend', (e) => {
    if (mapCanvas) {
      const touch = e.changedTouches[0];
      if (touch) {
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);
        if (dx < 10 && dy < 10) {
          // Это был тап (а не панорамирование) — ищем ближайший узел
          const rect = mapCanvas.getBoundingClientRect();
          const mx = (touch.clientX - rect.left) * (mapCanvas.width / rect.width);
          const my = (touch.clientY - rect.top) * (mapCanvas.height / rect.height);
          let closest: string | null = null;
          let closestDist = 25;  // Больше чем для мыши (толще пальцы)
          for (const [id, pos] of Object.entries(nodePositions)) {
            const sx = pos.x * mapScale + offsetX;
            const sy = pos.y * mapScale + offsetY;
            const d = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
            if (d < closestDist) { closestDist = d; closest = id; }
          }
          if (closest && selectedRegion) {
            selectedLoc = closest;
            drawMap();
            updateLocList(selectedRegion);
            showLocationInfo(closest);
          }
        }
      }
    }
  }, { passive: true });
}

// ── showRegionMap: отобразить карту для региона ─────────
// Принимает regionKey — ключ региона (kanto, johto)
// Генерирует позиции узлов, создаёт canvas, рисует карту
export function showRegionMap(regionKey: string) {
  selectedRegion = regionKey;                    // Запоминаем выбранный регион
  selectedLoc = null;                             // Сбрасываем выбранную локацию
  nodePositions = generatePositions(regionKey);   // Генерируем позиции узлов
  offsetX = 0; offsetY = 0; mapScale = 1;         // Сбрасываем трансформации

  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap) return;

  // Пересоздаём canvas (чистый лист)
  wrap.innerHTML = '';
  mapCanvas = null;
  mapCtx = null;
  setupCanvas();

  if (mapCanvas) {
    const cw = wrap.clientWidth || 400;
    mapCanvas.width = cw * 2;    // ×2 для retina/высокого DPI
    mapCanvas.height = 760;
    drawMap();                    // Отрисовываем карту
  }
  updateLocList(regionKey);       // Обновляем список локаций
}

// ── openMap: открыть контейнер карты ───────────────────
// Создаёт весь интерфейс карты: вкладки регионов, canvas, список локаций
export function openMap() {
  const container = document.getElementById('map-container');
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML = '';  // Очищаем

  // ── Вкладки выбора региона ──
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;';
  tabs.innerHTML = Object.entries(REGION_META).map(([key, meta]) =>
    `<button class="map-region-tab" data-region="${key}"
      style="padding:7px 12px;border-radius:8px;border:none;background:${meta.color};color:#fff;font-weight:600;font-size:0.8rem;cursor:pointer;opacity:0.5;transition:opacity 0.2s;">
      ${meta.icon} ${meta.name}
    </button>`
  ).join('');
  container.appendChild(tabs);

  // При клике на вкладку — переключаем регион
  tabs.querySelectorAll('.map-region-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      // Сбрасываем opacity всех вкладок
      tabs.querySelectorAll('.map-region-tab').forEach(b => (b as HTMLElement).style.opacity = '0.5');
      (btn as HTMLElement).style.opacity = '1';  // Выделяем выбранную
      const region = (btn as HTMLElement).dataset.region;
      if (region) showRegionMap(region);
    });
  });

  // ── Список локаций (сетка) ──
  const locList = document.createElement('div');
  locList.id = 'map-loc-list';
  locList.style.cssText = 'margin-top:8px;max-height:260px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px;';
  container.appendChild(locList);

  // ── Контейнер для canvas ──
  const canvasWrap = document.createElement('div');
  canvasWrap.id = 'map-canvas-wrap';
  container.appendChild(canvasWrap);

  // ── Показываем первый регион по умолчанию ──
  const first = tabs.querySelector('.map-region-tab') as HTMLElement;
  if (first) {
    first.style.opacity = '1';
    const r = first.dataset.region;
    if (r) showRegionMap(r);
  }
}

// ── closeMap: скрыть контейнер карты ───────────────────
export function closeMap() {
  const c = document.getElementById('map-container');
  if (c) c.style.display = 'none';
}
