// ─────────────────────────────────────────────────────────────
// map.ts — ИНТЕРАКТИВНАЯ КАРТА РЕГИОНОВ (SVG-граф, L3/F2)
// ─────────────────────────────────────────────────────────────
// Регионы рисуются РАЗДЕЛЬНО (вкладки Канто/Джото). Локации — узлы
// SVG-графа по связям links, позиции — детерминированная BFS-раскладка
// слоями от стартового города (без внешних библиотек). Связи — линии
// со стрелками. На узле: иконка типа, имя, бейдж гейта туториала,
// клик — переход (через onTravelTo, заданный в game/init.ts).
//
// ЗАВИСИМОСТИ:
//   data/regions  — REGIONS (все регионы, локации, связи)
//   game/state    — state (текущая локация/регион, гейт туториала)
//   utils/dom     — showToast
//
// ИСПОЛЬЗУЕТСЯ В:
//   game/init.ts  — инициализация openMap, setTravelCallback, setExploredLocs
//
// КЛЮЧЕВЫЕ ЭКСПОРТЫ:
//   openMap()           — открывает контейнер с картой и рендерит весь интерфейс
//   closeMap()          — скрывает контейнер карты
//   showRegionMap(key)  — отображает карту для указанного региона
//   showLocationInfo(id)— показывает модальное окно с информацией о локации
//   updateLocList(key)  — обновляет список-индекс локаций под графом
//   setTravelCallback() — устанавливает колбэк перехода к локации
//   setExploredLocs()   — задаёт список исследованных локаций
//   computeLayout(key)  — чистая BFS-раскладка региона (для тестов)
//   onTravelTo          — экспортированная переменная-колбэк путешествия
//
// DOM-СЕЛЕКТОРЫ (используются tools/verify/world-render.test.mjs — не ломать):
//   .map-region-tab[data-region] — вкладки регионов
//   .map-loc-item[data-loc]      — элементы списка-индекса локаций
//   .map-node[data-loc]          — узлы SVG-графа
//   .map-edge[data-from][data-to]— связи графа
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────
import { REGIONS } from '../data/regions.js';
import { state } from '../game/state.js';
import { isQuestActive } from '../data/quest-drops.js';
import { showToast } from '../utils/dom.js';

// ── СОСТОЯНИЕ МОДУЛЯ И CALLBACK'И ────────────────────────
let selectedRegion: string | null = null;                      // Выбранный регион (kanto, johto...)
let selectedLoc: string | null = null;                         // Выбранная локация (для подсветки)

// Исследованные локации (Set для быстрой проверки)
let exploredLocs = new Set<string>();

// Колбэк: вызывается при клике "перейти" (регистрируется в game/init.ts)
export let onTravelTo: ((locId: string) => void) | null = null;

// ── Установка колбэков ──
export function setTravelCallback(fn: (locId: string) => void) { onTravelTo = fn; }
export function setExploredLocs(locs: string[]) { exploredLocs = new Set(locs); }

// ── REGION_META: метаданные регионов для UI ─────────────
const REGION_META: Record<string, { name: string; icon: string; color: string }> = {
  kanto: { name: 'Канто', icon: '🗺️', color: '#4a9eff' },
  johto: { name: 'Джото', icon: '🗺️', color: '#facc15' },
};

// Стартовый город региона — корень BFS-раскладки
const REGION_START: Record<string, string> = {
  kanto: 'palletTown',
  johto: 'goldenrodCity',
};

// ── Гейт туториала (зеркало ui/location.ts: isTutorialGateOpen + STARTER_AREA) ──
// Дальше стартовой зоны — только после сдачи обучения (tutorial_6).
// Дублируется здесь, чтобы map.ts не тянул тяжёлый location.ts (циклы импорта).
const STARTER_AREA = new Set([
  'goldenrodCity', 'pokemart', 'pokecenter',
  'goldenrodStadium', 'goldenrodCity_trainingGrounds',
]);
function isGateOpen(): boolean {
  if ((state.tutorialStep || 0) > 6) return true;
  return (state.completedNPCQuests || []).includes('tutorial_6');
}
export function isMapLocked(locId: string): boolean {
  return !isGateOpen() && !STARTER_AREA.has(locId);
}

// ── Иконка и тип узла по id ─────────────────────────────
// ── isServiceLoc: сервисная подлокация (маркет/центр) ──
// Сервисы НЕ рисуются узлами графа (иначе каша из 40+ точек): они доступны
// кнопками внутри города (инфо-модалка + навигация локации).
export function isServiceLoc(locId: string): boolean {
  if (!locId) return false;
  return locId === 'pokemart' || locId === 'pokecenter'
    || locId.endsWith('_pokemart') || locId.endsWith('_pokecenter');
}

// ── serviceSubsOf: подлокации-сервисы города ──
export function serviceSubsOf(allLocs: Record<string, any>, cityId: string): string[] {
  return [`${cityId}_pokemart`, `${cityId}_pokecenter`].filter((id) => !!allLocs?.[id]);
}

export function iconFor(locId: string): string {
  const l = locId.toLowerCase();
  if (l.includes('stadium')) return '⚔️';                        // Стадион
  if (l.includes('pokecenter')) return '🏥';                      // Поке-центр
  if (l.includes('pokemart') || l.includes('pokemarket')
    || l.includes('shop') || l.includes('supermarket')) return '🛒'; // Маркет
  if (l.startsWith('route') || l.startsWith('sea')) return '🛤️'; // Маршрут
  return '🏙️';                                                     // Город / прочее
}
export function kindFor(locId: string): string {
  const l = locId.toLowerCase();
  if (l.includes('stadium')) return 'stadium';
  if (l.includes('pokecenter')) return 'center';
  if (l.includes('pokemart') || l.includes('pokemarket')
    || l.includes('shop') || l.includes('supermarket')) return 'market';
  if (l.startsWith('route') || l.startsWith('sea')) return 'route';
  return 'city';
}

// ── computeLayout: BFS-раскладка региона слоями ─────────
// Чистая функция (без DOM): корень — стартовый город региона,
// слой N — соседи слоя N−1 (рёбра считаются неориентированными,
// рисуются — по направленным links). Недостижимые компоненты
// докладываются следующими слоями, чтобы ни один узел не потерялся.
// Детерминирована: соседи обходятся в алфавитном порядке id.
export interface MapNodePos { x: number; y: number; layer: number }
export interface MapLayout {
  positions: Record<string, MapNodePos>;
  layers: string[][];
  edges: Array<{ from: string; to: string }>;
  width: number;
  height: number;
}
const H_SPACING = 230;
const V_SPACING = 84;
const PAD_X = 100;
const PAD_Y = 56;

export function computeLayout(regionKey: string): MapLayout {
  const locs: Record<string, any> = (REGIONS as any)[regionKey]?.locations ?? {};
  // Сервисы — не узлы: иначе граф тонет в маркетах/центрах
  const ids = Object.keys(locs).filter((id) => !isServiceLoc(id));

  // Неориентированная смежность (только внутри региона) + направленные рёбра
  const adj: Record<string, Set<string>> = {};
  ids.forEach(id => { adj[id] = new Set(); });
  const edges: Array<{ from: string; to: string }> = [];
  for (const id of ids) {
    const links: string[] = Array.isArray(locs[id]?.links) ? locs[id].links : [];
    for (const link of links) {
      if (!locs[link]) continue;              // Кросс-региональный сервис (pokecenter и т.п.) — не рисуем чужое
      if (isServiceLoc(link)) continue;       // Сервисы — не узлы графа
      adj[id].add(link);
      adj[link].add(id);
      edges.push({ from: id, to: link });
    }
  }

  // BFS: сначала от стартового города, затем — остатки (другими компонентами)
  const visited = new Set<string>();
  const layers: string[][] = [];
  const startOrder = [
    REGION_START[regionKey],
    ...[...ids].sort(),
  ].filter((id, i, arr) => id && locs[id] && arr.indexOf(id) === i);
  for (const start of startOrder) {
    if (visited.has(start)) continue;
    // Новая компонента — продолжает нумерацию слоёв
    let frontier = [start];
    visited.add(start);
    while (frontier.length > 0) {
      layers.push(frontier);
      const next: string[] = [];
      for (const id of frontier) {
        const neighbours = [...adj[id]].sort().filter(n => !visited.has(n));
        for (const n of neighbours) { visited.add(n); next.push(n); }
      }
      frontier = next;
    }
  }

  // Координаты: слой → колонка, внутри слоя — центрирование по вертикали
  const maxCount = Math.max(1, ...layers.map(l => l.length));
  const height = maxCount * V_SPACING + PAD_Y * 2;
  const width = Math.max(1, layers.length) * H_SPACING + PAD_X * 2;
  const positions: Record<string, MapNodePos> = {};
  layers.forEach((layerIds, layer) => {
    const x = PAD_X + layer * H_SPACING;
    layerIds.forEach((id, i) => {
      positions[id] = {
        x,
        y: height / 2 + (i - (layerIds.length - 1) / 2) * V_SPACING,
        layer,
      };
    });
  });
  return { positions, layers, edges, width, height };
}

// ── travelToLoc: клик по узлу/строке — переход ──────────
// Магии нет: идти можно только в СВЯЗАННУЮ локацию (links текущей).
// Далекая точка — инфо-модалка + подсказка идти по связям.
function travelToLoc(locId: string) {
  if (isMapLocked(locId)) {
    showToast('Сначала пройдите обучение у Профессора Оука!', true);
    return;
  }
  const current = state.currentLocationId as string | null;
  if (current && current !== locId && !canTravelTo(current, locId)) {
    showToast('Слишком далеко — идите по связям от текущей локации.', true);
    showLocationInfo(locId);
    return;
  }
  // Квест-гейт: точка открывается только взятым/пройденным квестом
  {
    const gate = findLocField(locId, 'requiresQuest');
    if (gate && !isQuestActive(gate)) {
      showToast('Сюда пускают только по квесту. Ищите квестодателя!', true);
      showLocationInfo(locId);
      return;
    }
  }
  selectedLoc = locId;
  exploredLocs.add(locId);
  try { onTravelTo?.(locId); }
  catch (e) { console.error('[map] переход не удался:', e); }
  refreshGraphState();
}

function findLocLinks(locId: string): string[] {
  for (const region of Object.values(REGIONS) as any[]) {
    if (region.locations?.[locId]) return region.locations[locId].links || [];
  }
  return [];
}

function findLocField(locId: string, field: string): any {
  for (const region of Object.values(REGIONS) as any[]) {
    if (region.locations?.[locId]) return region.locations[locId]?.[field];
  }
  return undefined;
}

/** Чистая проверка: можно ли идти из current в target (только по связям). */
export function canTravelTo(currentId: string | null, targetId: string): boolean {
  if (!currentId || currentId === targetId) return true;
  return findLocLinks(currentId).includes(targetId);
}

// ── refreshGraphState: лёгкое обновление подсветки ──────
// Без перестройки графа: текущая локация, гейт-бейджи, список-индекс.
function refreshGraphState() {
  const current = state.currentLocationId as string | null;
  document.querySelectorAll('.map-node').forEach(el => {
    const id = (el as SVGGElement).dataset.loc;
    el.classList.toggle('current', !!id && id === current);
    const circle = el.querySelector('circle');
    if (circle) circle.setAttribute('fill', nodeFill(id ?? '', id === current));
  });
  if (selectedRegion) updateLocList(selectedRegion);
}

function nodeFill(locId: string, isCurrent: boolean): string {
  if (isCurrent) return '#ff9500';
  if (isMapLocked(locId)) return 'rgba(120,120,140,0.5)';
  if (exploredLocs.has(locId)) return '#4a9eff';
  return 'rgba(255,255,255,0.22)';
}

// ── renderGraph: построение SVG-графа региона ───────────
function renderGraph(regionKey: string) {
  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap) return;
  const locs: Record<string, any> = (REGIONS as any)[regionKey]?.locations ?? {};
  const layout = computeLayout(regionKey);
  const current = state.currentLocationId as string | null;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('class', 'map-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Карта региона ${(REGIONS as any)[regionKey]?.name ?? regionKey}`);
  (svg as any).style.cssText = 'min-width:760px;height:auto;display:block;background:rgba(0,0,0,0.3);border-radius:12px;';

  // Маркер стрелки для направленных связей
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(255,255,255,0.35)"></path>
    </marker>
    <marker id="map-arrow-exp" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(74,158,255,0.8)"></path>
    </marker>`;
  svg.appendChild(defs);

  // ── Рёбра (под узлами) ──
  const R = 19; // радиус узла + запас под стрелку
  for (const { from, to } of layout.edges) {
    const a = layout.positions[from];
    const b = layout.positions[to];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(a.x + (dx / len) * R));
    line.setAttribute('y1', String(a.y + (dy / len) * R));
    line.setAttribute('x2', String(b.x - (dx / len) * (R + 4)));
    line.setAttribute('y2', String(b.y - (dy / len) * (R + 4)));
    const bothExplored = exploredLocs.has(from) && exploredLocs.has(to);
    line.setAttribute('class', `map-edge${bothExplored ? ' explored' : ''}`);
    line.setAttribute('data-from', from);
    line.setAttribute('data-to', to);
    line.setAttribute('stroke', bothExplored ? 'rgba(74,158,255,0.8)' : 'rgba(255,255,255,0.25)');
    line.setAttribute('stroke-width', bothExplored ? '2.5' : '1.5');
    line.setAttribute('marker-end', bothExplored ? 'url(#map-arrow-exp)' : 'url(#map-arrow)');
    svg.appendChild(line);
  }

  // ── Узлы ──
  for (const id of Object.keys(layout.positions)) {
    const p = layout.positions[id];
    const loc = locs[id];
    if (!loc) continue;
    const isCurrent = id === current;
    const locked = isMapLocked(id);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', `map-node kind-${kindFor(id)}${exploredLocs.has(id) ? ' explored' : ''}${isCurrent ? ' current' : ''}${locked ? ' locked' : ''}`);
    (g as any).dataset.loc = id;
    g.setAttribute('transform', `translate(${p.x},${p.y})`);
    (g as any).style.cursor = locked ? 'not-allowed' : 'pointer';

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('r', '17');
    circle.setAttribute('fill', nodeFill(id, isCurrent));
    circle.setAttribute('stroke', isCurrent ? '#fff' : 'rgba(255,255,255,0.35)');
    circle.setAttribute('stroke-width', isCurrent ? '3' : '1.5');
    if (locked) circle.setAttribute('stroke-dasharray', '4 3');
    g.appendChild(circle);

    const icon = document.createElementNS(NS, 'text');
    icon.setAttribute('y', '6');
    icon.setAttribute('text-anchor', 'middle');
    icon.setAttribute('font-size', '15');
    icon.textContent = iconFor(id);
    g.appendChild(icon);

    // Бейдж гейта туториала
    if (locked) {
      const lock = document.createElementNS(NS, 'text');
      lock.setAttribute('x', '13');
      lock.setAttribute('y', '-11');
      lock.setAttribute('font-size', '12');
      lock.setAttribute('class', 'map-node-lock');
      lock.textContent = '🔒';
      g.appendChild(lock);
    }
    // Маркер текущей позиции
    if (isCurrent) {
      const here = document.createElementNS(NS, 'text');
      here.setAttribute('x', '13');
      here.setAttribute('y', '-11');
      here.setAttribute('font-size', '12');
      here.textContent = '📍';
      g.appendChild(here);
    }

    const label = document.createElementNS(NS, 'text');
    label.setAttribute('y', '34');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '11');
    label.setAttribute('fill', isCurrent ? '#ffb84d' : (exploredLocs.has(id) ? '#ddd' : 'rgba(255,255,255,0.55)'));
    const short = loc.name.length > 18 ? loc.name.slice(0, 16) + '…' : loc.name;
    label.textContent = short;
    g.appendChild(label);

    // Бейдж сервисов: город с маркетом/центром внутри (сами сервисы не узлы)
    const subs = serviceSubsOf(locs, id);
    if (subs.length > 0) {
      const svc = document.createElementNS(NS, 'text');
      svc.setAttribute('y', '46');
      svc.setAttribute('text-anchor', 'middle');
      svc.setAttribute('font-size', '10');
      svc.textContent = '🛒🏥';
      const svcTitle = document.createElementNS(NS, 'title');
      svcTitle.textContent = 'Внутри: маркет и центр (кнопки — в навигации локации)';
      svc.appendChild(svcTitle);
      g.appendChild(svc);
    }

    const title = document.createElementNS(NS, 'title');
    const linksCount = (loc.links || []).length;
    const encCount = loc.encounters?.length || 0;
    title.textContent = `${loc.name}${locked ? ' (🔒 пройдите обучение)' : ''}${isCurrent ? ' (вы здесь)' : ''} — ${encCount} видов, связей: ${linksCount}. Клик — перейти, двойной клик — информация.`;
    g.appendChild(title);

    g.addEventListener('click', () => travelToLoc(id));
    g.addEventListener('dblclick', () => showLocationInfo(id));
    svg.appendChild(g);
  }

  wrap.innerHTML = '';
  wrap.appendChild(svg);
}

// ── updateLocList: список-индекс локаций под графом ─────
// Класс .map-loc-item + data-loc — селекторы verify-теста (не менять).
// Сортировка: текущая → исследованные → остальные. Клик — переход.
export function updateLocList(regionKey: string) {
  const listEl = document.getElementById('map-loc-list');
  if (!listEl) return;
  const locs: Record<string, any> = (REGIONS as any)[regionKey]?.locations ?? {};
  const current = state.currentLocationId as string | null;

  const rank = (id: string) =>
    id === current ? 0 : (exploredLocs.has(id) ? 1 : 2);

  listEl.innerHTML = Object.entries(locs)
    .sort(([a], [b]) => rank(a) - rank(b) || String(locs[a].name).localeCompare(String(locs[b].name), 'ru'))
    .map(([id, loc]: [string, any]) => {
      const locked = isMapLocked(id);
      const badge = locked ? ' 🔒' : (id === current ? ' 📍' : (exploredLocs.has(id) ? '' : ' ❓'));
      return `<div class="map-loc-item kind-${kindFor(id)}${exploredLocs.has(id) ? ' explored' : ''}${id === current ? ' active' : ''}${locked ? ' locked' : ''}"
            data-loc="${id}" title="${escapeHtml(loc.name)}${locked ? ' — пройдите обучение' : ''}">
        <span style="color:${id === current ? '#ffb84d' : (exploredLocs.has(id) ? '#4a9eff' : 'rgba(255,255,255,0.4)')}">${iconFor(id)} ${escapeHtml(loc.name)}${badge}</span>
      </div>`;
    }).join('');

  listEl.querySelectorAll('.map-loc-item').forEach(el => {
    el.addEventListener('click', () => {
      const locId = (el as HTMLElement).dataset.loc;
      if (locId) travelToLoc(locId);
    });
    el.addEventListener('dblclick', () => {
      const locId = (el as HTMLElement).dataset.loc;
      if (locId) showLocationInfo(locId);
    });
  });
}

// ── showLocationInfo: модалка информации о локации ──────
// Ищет локацию по всем регионам (узел может быть из любого).
// Двойной клик по узлу/строке; переход — одинарный клик.
export function showLocationInfo(locId: string) {
  let loc: any = null;
  let regionLocs: Record<string, any> = {};
  for (const region of Object.values(REGIONS) as any[]) {
    if (region.locations?.[locId]) { loc = region.locations[locId]; regionLocs = region.locations; break; }
  }
  if (!loc) return;

  const oldModal = document.getElementById('map-info-modal');
  if (oldModal) oldModal.remove();

  const imgPath = loc.image || '';
  const linkNames = (loc.links || [])
    .map((id: string) => {
      for (const region of Object.values(REGIONS) as any[]) {
        if (region.locations?.[id]) return region.locations[id].name;
      }
      return id;
    })
    .join(', ');

  const modal = document.createElement('div');
  modal.id = 'map-info-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);';

  modal.innerHTML = `
    <div style="background:var(--tma-bg,#1a1a2e);border:1px solid var(--tma-border,rgba(255,255,255,0.1));border-radius:16px;max-width:380px;width:90%;max-height:85vh;overflow-y:auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.5);">
      ${imgPath
        ? `<img src="${imgPath}" alt="${escapeHtml(loc.name)}" style="width:100%;height:160px;object-fit:cover;border-radius:16px 16px 0 0;display:block;" onerror="this.style.display='none'">`
        : ''
      }
      <div style="padding:16px 18px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <h3 style="margin:0;font-size:1.1rem;color:#fff;">${iconFor(locId)} ${escapeHtml(loc.name)}</h3>
          <button id="map-info-close" style="background:none;border:none;color:#999;font-size:1.4rem;cursor:pointer;padding:0 4px;line-height:1;">✕</button>
        </div>
        <p style="margin:0 0 12px;font-size:0.85rem;color:#bbb;line-height:1.5;">${escapeHtml(loc.desc || 'Нет описания.')}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          <span style="background:rgba(74,158,255,0.15);color:#4a9eff;padding:3px 10px;border-radius:20px;font-size:0.7rem;">👾 ${(loc.encounters?.length || 0)} видов</span>
          ${isMapLocked(locId) ? '<span style="background:rgba(255,149,0,0.15);color:#ff9500;padding:3px 10px;border-radius:20px;font-size:0.7rem;">🔒 Пройдите обучение</span>' : ''}
          ${loc.hasHeal ? '<span style="background:rgba(52,199,89,0.15);color:#34c759;padding:3px 10px;border-radius:20px;font-size:0.7rem;">✅ Покецентр</span>' : ''}
          ${loc.hasWater ? '<span style="background:rgba(90,200,250,0.15);color:#5ac8fa;padding:3px 10px;border-radius:20px;font-size:0.7rem;">🌊 Вода</span>' : ''}
        </div>
        ${linkNames ? `<div style="font-size:0.75rem;color:#888;"><span style="color:#666;">🔗 Связано с:</span> ${escapeHtml(linkNames)}</div>` : ''}
        <div id="map-info-services" style="display:flex;gap:6px;margin-top:10px;"></div>
        <button id="map-info-go" style="margin-top:8px;width:100%;padding:9px;border-radius:10px;border:none;background:#4a9eff;color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer;">➔ Перейти: ${escapeHtml(loc.name)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = document.getElementById('map-info-close');
  if (closeBtn) closeBtn.onclick = () => modal.remove();
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  const goBtn = document.getElementById('map-info-go');
  if (goBtn) goBtn.onclick = () => { modal.remove(); travelToLoc(locId); };
  // Сервисы города — быстрые кнопки (сами они не узлы графа)
  const svcBox = document.getElementById('map-info-services');
  if (svcBox) {
    for (const subId of serviceSubsOf(regionLocs, locId)) {
      const sub = regionLocs[subId];
      const b = document.createElement('button');
      b.style.cssText = 'flex:1;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#fff;font-size:0.8rem;cursor:pointer;';
      b.textContent = `${iconFor(subId)} ${sub?.name || subId}`;
      b.onclick = () => { modal.remove(); travelToLoc(subId); };
      svcBox.appendChild(b);
    }
    if (!svcBox.hasChildNodes()) svcBox.remove();
  }
}

// ── showRegionMap: отобразить карту для региона ─────────
export function showRegionMap(regionKey: string) {
  selectedRegion = regionKey;
  selectedLoc = state.currentLocationId ?? null;
  renderGraph(regionKey);
  updateLocList(regionKey);
  // Подсветка активной вкладки
  document.querySelectorAll('.map-region-tab').forEach(b => {
    const on = (b as HTMLElement).dataset.region === regionKey;
    (b as HTMLElement).style.opacity = on ? '1' : '0.5';
  });
}

// ── openMap: открыть контейнер карты ───────────────────
// Вкладки регионов (счётчики локаций) → SVG-граф → список-индекс.
export function openMap() {
  const container = document.getElementById('map-container');
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML = '';

  // ── Вкладки выбора региона ──
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;';
  tabs.innerHTML = Object.entries(REGION_META).map(([key, meta]) => {
    const count = Object.keys((REGIONS as any)[key]?.locations ?? {}).length;
    return `<button class="map-region-tab" data-region="${key}"
      style="padding:7px 12px;border-radius:8px;border:none;background:${meta.color};color:#fff;font-weight:600;font-size:0.8rem;cursor:pointer;opacity:0.5;transition:opacity 0.2s;">
      ${meta.icon} ${meta.name} · ${count}
    </button>`;
  }).join('');
  container.appendChild(tabs);

  tabs.querySelectorAll('.map-region-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const region = (btn as HTMLElement).dataset.region;
      if (region) showRegionMap(region);
    });
  });

  // ── Граф региона (SVG) ──
  // Горизонтальный скролл вместо ужатия: иначе 90+ узлов сплющиваются
  // в нечитаемую кашу. Узлы фиксированного размера, подписи читаемы.
  const graphWrap = document.createElement('div');
  graphWrap.id = 'map-canvas-wrap';
  graphWrap.style.cssText = 'overflow-x:auto;overflow-y:hidden;max-width:100%;';
  container.appendChild(graphWrap);

  // ── Список-индекс локаций ──
  const locList = document.createElement('div');
  locList.id = 'map-loc-list';
  locList.style.cssText = 'margin-top:8px;max-height:260px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px;';
  container.appendChild(locList);

  // ── По умолчанию — регион текущей позиции игрока ──
  const currentRegion = state.currentRegion as string;
  const initial = (currentRegion && (REGIONS as any)[currentRegion])
    ? currentRegion
    : ((tabs.querySelector('.map-region-tab') as HTMLElement)?.dataset.region ?? 'kanto');
  showRegionMap(initial);
}

// ── closeMap: скрыть контейнер карты ───────────────────
export function closeMap() {
  const c = document.getElementById('map-container');
  if (c) c.style.display = 'none';
}

function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
