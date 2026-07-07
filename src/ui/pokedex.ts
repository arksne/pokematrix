// ─────────────────────────────────────────────────────────────
// pokedex.ts — ПОКЕДЕКС
// ─────────────────────────────────────────────────────────────
// Отображает список всех покемонов с фильтрацией (поколение, статус, поиск),
// детальной карточкой и эволюционными цепочками.
//
// ЗАВИСИМОСТИ:
//   state.ts      — getPowerStars, getRarityStars (рейтинг покемона)
//   getters.ts    — getPokedexState (POKEDEX_ALL, pokedexSeen, pokedexData)
//   sprite.ts     — getTypeColor, getTypeGradient (цвета типов)
//   evolution.ts  — getEvolutions (цепочки эволюции)
//   core.ts       — evolvesFromMap (карта эволюций)
//   gyms.ts       — gymLeaders (для отображения типов лидеров)
//   api.ts        — fetchPokeAPI (загрузка данных покемона)
//
// ИСПОЛЬЗУЕТСЯ В: init.ts (кнопка "Покедекс")
// ─────────────────────────────────────────────────────────────

// ── Импорты ───────────────────────────────────────────────

// getPowerStars — возвращает количество "звёзд мощи" покемона (на основе базовых статов)
// getRarityStars — возвращает количество "звёзд редкости" (на основе редкости в играх)
import { getPowerStars, getRarityStars } from '../utils/state.js';
// getPokedexState — возвращает объект состояния покедекса:
//   POKEDEX_ALL — массив всех видов покемонов (строки)
//   pokedexSeen — Set<String> — замеченные покемоны
//   pokedexCaught — Set<String> — пойманные покемоны
//   pokedexData — Record<speciesName, {method, location, pokeapiId}> — метаданные
//   pokedexTotal — общее количество видов в покедексе
import { getPokedexState } from '../game/getters.js';
// getTypeColor — возвращает HEX-цвет для типа покемона (например, 'fire' → '#FF4422')
// getTypeGradient — возвращает CSS gradient для фона карточки по типам покемона
import { getTypeColor, getTypeGradient } from '../utils/sprite.js';
// getEvolutions — асинхронно получает массив эволюций для вида покемона
//   Возвращает [{name, minLevel, trigger, item}, ...]
import { getEvolutions } from './evolution.js';
// evolvesFromMap — обратная карта эволюций: для каждого покемона хранит,
//   из кого он эволюционирует. Заполняется при загрузке эволюционных цепочек.
//   Формат: Record<speciesName, string[]> — например, "venusaur": ["bulbasaur", "ivysaur"]
import { evolvesFromMap } from '../battle/core.js';
// gymLeaders — данные лидеров залов: {leaderKey: {name, team: [{name, ...}], ...}}
import { gymLeaders } from '../data/gyms.js';
// fetchPokeAPI — HTTP-клиент для PokeAPI с кэшированием
//   Делает запрос через прокси /api/pokeapi/ чтобы обойти CORS
import { fetchPokeAPI } from '../utils/api.js';

// ── getPokedexId: получить номер покемона в покедексе ────
// Принимает speciesName — имя вида (например, 'pikachu')
// Возвращает 1-индексированный номер (#001, #025 и т.д.) или -1 если не найден
// Используется в profile.ts для отображения номера покемона
export function getPokedexId(speciesName) {
  // Получаем массив всех видов из состояния покедекса
  // POKEDEX_ALL — это массив строк, от A до Z, без форм (только базовые виды)
  const { POKEDEX_ALL } = getPokedexState();
  // Находим индекс вида в массиве (0-индексированный)
  const idx = POKEDEX_ALL.indexOf(speciesName);
  // Конвертируем в 1-индексированный (#001 = индекс 0 → номер 1)
  // Если вид не найден — возвращаем -1
  return idx >= 0 ? idx + 1 : -1;
}

// ── openPokedex: открыть модалку покедекса ────────────────
//
// ЧТО ДЕЛАЕТ:
//   1. Инициализирует UI: поиск, фильтры поколения/статуса, сетку
//   2. Рендерит сетку покемонов через renderGrid() с учётом фильтров
//   3. Переключает шайни-спрайты по localStorage флагу
//   4. Обрабатывает клик по покемону → showPokemonDetail()
//
// ГДЕ ВЫЗЫВАЕТСЯ: из init.ts при открытии покедекса
export function openPokedex() {
  // Деструктурируем всё состояние покедекса одним вызовом getPokedexState()
  const { pokedexSeen, pokedexCaught, POKEDEX_ALL, pokedexData, pokedexTotal } = getPokedexState();
  // Находим DOM-элемент модалки покедекса по ID
  const modal = document.getElementById('pokedex-modal');
  // Если модалка не найдена — выходим (защита от отсутствия элемента в DOM)
  if (!modal) return;
  // Показываем модалку (display: flex — видна)
  modal.style.display = 'flex';

  // Находим все ключевые DOM-элементы покедекса
  const grid = document.getElementById('pokedex-grid');           // Сетка с иконками покемонов
  const countEl = document.getElementById('pokedex-count');        // Счётчик "Поймано: X / Y"
  const searchEl = document.getElementById('pokedex-search');      // Поле поиска
  const detailEl = document.getElementById('pokedex-detail');      // Панель детальной информации
  const genFilter = document.getElementById('pokedex-gen-filter'); // Выпадающий список фильтра поколения
  const statusFilter = document.getElementById('pokedex-status-filter'); // Фильтр статуса (пойман/замечен/неизвестен)

  // Скрываем панель детальной информации (если была открыта ранее)
  if (detailEl) detailEl.style.display = 'none';
  // Очищаем поле поиска и показываем его
  if (searchEl) { (searchEl as HTMLInputElement).value = ''; searchEl.style.display = 'block'; }
  // Восстанавливаем сетку: display:grid, убираем absolute позиционирование,
  //   делаем видимой (при возврате из детальной карточки)
  if (grid) { grid.style.display = 'grid'; grid.style.visibility = 'visible'; grid.style.position = 'relative'; }
  // Сбрасываем фильтры на "все"
  if (genFilter) (genFilter as HTMLSelectElement).value = 'all';
  if (statusFilter) (statusFilter as HTMLSelectElement).value = 'all';

  // Читаем из localStorage флаг показа шайни-спрайтов в сетке
  // Формат: 'league17_pokedex_shiny' = '1' (шайни) или '0' (обычные)
  let showShinyList = localStorage.getItem('league17_pokedex_shiny') === '1';

  // ── getSpriteSrc: внутренняя функция получения URL спрайта ──
  // Принимает pokeapiId — ID покемона в PokeAPI (число)
  // Возвращает URL к официальному artwork (обычный или шайни)
  function getSpriteSrc(pokeapiId: number) {
    // Если включён режим шайни — берём shiny artwork
    if (showShinyList) {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${pokeapiId}.png`;
    }
    // Иначе — обычный artwork
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`;
  }

  // ── renderGrid: внутренняя функция отрисовки сетки покемонов ──
  // Применяет все активные фильтры (поиск, поколение, статус)
  function renderGrid() {
    // Очищаем сетку
    grid.innerHTML = '';
    // Берём текущие значения фильтров
    const searchTerm = (searchEl as HTMLInputElement)?.value.toLowerCase().trim() || '';   // Поисковый запрос (нижний регистр)
    const genVal = (genFilter as HTMLSelectElement)?.value || 'all';                        // Выбранное поколение
    const statusVal = (statusFilter as HTMLSelectElement)?.value || 'all';                  // Выбранный статус

    // Счётчик видимых покемонов (не используется, но вычисляется)
    let visible = 0;
    // Проходим по всем видам покемонов (POKEDEX_ALL — полный массив)
    POKEDEX_ALL.forEach((name, idx) => {
      // Получаем реальный PokeAPI ID из pokedexData (метаданные с сервера)
      // Если данных нет — используем индекс + 1 как запасной вариант
      // Это важно: формы покемонов могут иметь другой ID в PokeAPI
      const pokeapiId = pokedexData[name]?.pokeapiId || (idx + 1);

      // ── Фильтр по поколению ──
      // Поколения определяются по диапазонам PokeAPI ID:
      //   1: 1-151, 2: 152-251, 3: 252-386, 4: 387-493,
      //   5: 494-649, 6: 650-721, 7: 722-809, 8: 810-905, 9: 906+
      if (genVal !== 'all') {
        const gen = parseInt(genVal);
        if (gen === 1 && pokeapiId > 151) return;
        if (gen === 2 && (pokeapiId < 152 || pokeapiId > 251)) return;
        if (gen === 3 && (pokeapiId < 252 || pokeapiId > 386)) return;
        if (gen === 4 && (pokeapiId < 387 || pokeapiId > 493)) return;
        if (gen === 5 && (pokeapiId < 494 || pokeapiId > 649)) return;
        if (gen === 6 && (pokeapiId < 650 || pokeapiId > 721)) return;
        if (gen === 7 && (pokeapiId < 722 || pokeapiId > 809)) return;
        if (gen === 8 && (pokeapiId < 810 || pokeapiId > 905)) return;
        if (gen === 9 && pokeapiId < 906) return;
        // Каждый return выше — покемон не подходит под фильтр, пропускаем
      }

      // ── Фильтр по статусу ──
      // Статус: пойман (caught), замечен (seen), неизвестен (unknown)
      const isCaught = pokedexCaught.has(name);   // true если покемон пойман
      const isSeen = pokedexSeen.has(name);        // true если замечeн
      if (statusVal === 'caught' && !isCaught) return;    // Фильтр "Пойман" — показываем только пойманных
      if (statusVal === 'seen' && !isSeen) return;        // Фильтр "Замечен" — только замеченных
      if (statusVal === 'unknown' && (isCaught || isSeen)) return; // Фильтр "Неизвестен" — только тех, кого не видели

      // ── Поисковый фильтр ──
      // Если есть поисковый запрос — проверяем имя или ID
      if (searchTerm) {
        // Фильтр: имя содержит поисковую строку ИЛИ ID совпадает
        // includes проверяет частичное совпадение (например, "pika" найдёт "pikachu")
        if (!name.includes(searchTerm) && String(pokeapiId) !== searchTerm) return;
      }

      // Все фильтры пройдены — увеличиваем счётчик
      visible++;
      // Создаём DOM-ячейку для покемона
      const cell = document.createElement('div');
      cell.className = 'pokedex-cell';  // CSS класс для стилизации ячейки

      // Определяем CSS класс статуса для подсветки фона
      let statusClass = 'unknown';        // По умолчанию — неизвестен (тёмный фон)
      if (isCaught) statusClass = 'caught';    // Пойман — яркая подсветка
      else if (isSeen) statusClass = 'seen';    // Замечен — средняя подсветка

      // Добавляем класс статуса к ячейке (CSS изменит фон)
      cell.classList.add(statusClass);
      // Заполняем HTML ячейки:
      //   .dex-num — номер в покедексе (#001, #025 и т.д.)
      //   <img> — спрайт покемона (lazy loading — грузится когда виден)
      //   onerror — если спрайт не загрузился, делаем его полупрозрачным
      //   .poke-name — имя покемона
      cell.innerHTML = `
        <span class="dex-num">#${pokeapiId}</span>
        <img src="${getSpriteSrc(pokeapiId)}" alt="${name}" loading="lazy" onerror="this.style.opacity='0.3'">
        <span class="poke-name">${name}</span>
      `;
      // Добавляем ячейку в сетку DOM
      grid.appendChild(cell);
      // Вешаем обработчик клика — открывает детальную карточку покемона
      cell.addEventListener('click', () => showPokedexInfo(name));
    });

    // Обновляем счётчик: "Поймано: X / Y" (где Y — общее количество видов)
    countEl.innerText = `Поймано: ${pokedexCaught.size} / ${pokedexTotal}`;
  }

  // Вызываем первоначальный рендер сетки
  renderGrid();

  // ── Кнопка переключения шайни в сетке ──
  // Находим строку фильтров, куда добавим кнопку
  const filterRow = document.getElementById('pokedex-filters');
  // Добавляем кнопку только один раз (проверяем, нет ли уже)
  if (filterRow && !document.getElementById('btn-dex-shiny')) {
    const btnShiny = document.createElement('button');
    btnShiny.id = 'btn-dex-shiny';              // ID для проверки существования
    btnShiny.className = 'tma-btn';              // Стандартный класс кнопок TMA
    btnShiny.style.cssText = 'font-size:0.75rem;padding:2px 8px;margin-left:4px;';
    btnShiny.textContent = showShinyList ? '✨ Шайни' : '✨ Обычные';  // Текст зависит от режима
    // Обработчик клика: переключает showShinyList, сохраняет в localStorage и перерисовывает
    btnShiny.onclick = () => {
      showShinyList = !showShinyList;  // Инвертируем флаг
      // Сохраняем в localStorage для постоянства между сессиями
      localStorage.setItem('league17_pokedex_shiny', showShinyList ? '1' : '0');
      // Обновляем текст кнопки
      btnShiny.textContent = showShinyList ? '✨ Шайни' : '✨ Обычные';
      renderGrid();  // Перерисовываем сетку с новыми спрайтами
    };
    filterRow.appendChild(btnShiny);  // Добавляем кнопку в DOM
  }

  // ── Обработчики фильтров ──
  // Вешаем oninput на поиск — срабатывает при каждом вводе символа
  searchEl.oninput = renderGrid;
  // Вешаем onchange на фильтры — срабатывает при изменении выбора
  if (genFilter) genFilter.onchange = renderGrid;
  if (statusFilter) statusFilter.onchange = renderGrid;
}

// ── FORM_TO_POKEMON_MAP: маппинг форм для PokeAPI ────────
// Некоторые покемоны имеют несколько форм (Deoxys, Giratina, etc.)
// PokeAPI использует разные endpoint'ы для разных форм.
// Этот словарь маппит имя вида на конкретное имя формы для запроса.
// Например, speciesName='deoxys' → запрос к 'pokemon/deoxys-normal'
const FORM_TO_POKEMON_MAP = {
  deoxys: 'deoxys-normal',
  wormadam: 'wormadam-plant',
  giratina: 'giratina-altered',
  shaymin: 'shaymin-land',
  basculin: 'basculin-red-striped',
  darmanitan: 'darmanitan-standard',
  frillish: 'frillish-male',
  jellicent: 'jellicent-male',
  tornadus: 'tornadus-incarnate',
  thundurus: 'thundurus-incarnate',
  landorus: 'landorus-incarnate',
  keldeo: 'keldeo-ordinary',
  meloetta: 'meloetta-aria',
  pyroar: 'pyroar-male',
  meowstic: 'meowstic-male',
  aegislash: 'aegislash-shield',
  pumpkaboo: 'pumpkaboo-average',
  gourgeist: 'gourgeist-average',
  zygarde: 'zygarde-50',
};

// ── fetchPokemonData: получить данные покемона из PokeAPI ─
// Принимает speciesName — имя вида (например, 'deoxys')
// Возвращает Promise с полными данными покемона из PokeAPI
// Сначала пробует форму из FORM_TO_POKEMON_MAP, если есть
// Если не получилось — пробует оригинальное имя
// Если и это не получилось — пробрасывает ошибку наверх
async function fetchPokemonData(speciesName) {
  // Берём имя формы из словаря, если есть, иначе используем speciesName как есть
  const pokeName = FORM_TO_POKEMON_MAP[speciesName] || speciesName;
  try {
    // Пробуем запросить форму (например, 'pokemon/deoxys-normal')
    return await fetchPokeAPI(`pokemon/${pokeName}`);
  } catch (e) {
    // Если первая попытка не удалась и имя отличается от оригинального
    if (pokeName !== speciesName) {
      try {
        // Пробуем запросить оригинальное имя ('pokemon/deoxys')
        return await fetchPokeAPI(`pokemon/${speciesName}`);
      } catch (_) { /* молча игнорируем — ошибка будет проброшена ниже */ }
    }
    // Если обе попытки не удались — пробрасываем исходную ошибку
    throw e;
  }
}

// ── showPokedexInfo: показать детальную карточку покемона ─
// Принимает speciesName — имя вида покемона
// Это async функция: она загружает данные из PokeAPI
// Регистрируется глобально (window.showPokedexInfo) для onclick в HTML
export async function showPokedexInfo(speciesName) {
  // Получаем всё состояние покедекса
  const { pokedexSeen, pokedexCaught, POKEDEX_ALL, pokedexData, pokedexTotal } = getPokedexState();
  // Находим DOM-элементы
  const detailEl = document.getElementById('pokedex-detail');          // Панель деталей
  const gridEl = document.getElementById('pokedex-grid');              // Сетка покемонов
  const searchEl = document.getElementById('pokedex-search');          // Поиск
  const filtersEl = document.getElementById('pokedex-filters');        // Фильтры
  // Если деталь или сетка не найдены — выходим (защита)
  if (!detailEl || !gridEl) return;

  // ── Переключение UI: скрываем сетку, показываем детали ──
  // Прячем сетку (visibility hidden + position absolute чтобы не занимала место)
  gridEl.style.visibility = 'hidden';
  gridEl.style.position = 'absolute';
  // Прячем поиск и фильтры
  if (searchEl) searchEl.style.display = 'none';
  if (filtersEl) filtersEl.style.display = 'none';
  // Показываем панель деталей
  detailEl.style.display = 'flex';
  // Показываем "Загрузка..." пока ждём ответ от PokeAPI
  detailEl.innerHTML = '<div class="pokedex-detail-loading">Загрузка...</div>';

  try {
    // ── Загрузка данных из PokeAPI ──
    const data = await fetchPokemonData(speciesName);

    // ── Типы покемона ──
    // Извлекаем массив типов из PokeAPI ответа
    // data.types = [{slot: 1, type: {name: 'grass'}}, {slot: 2, type: {name: 'poison'}}]
    // Для каждого типа создаём span с цветом фона, соответствующим типу
    const types = data.types.map(t =>
      `<span class="type-badge" style="background-color:${getTypeColor(t.type.name)}">${t.type.name}</span>`
    ).join('');

    // ── Статус покемона (пойман/замечен/неизвестен) ──
    let statusText = '❓ Неизвестен';
    let statusClass = 'unknown';
    if (pokedexCaught.has(speciesName)) {
      statusText = '✅ Пойман';          // Зелёный текст
      statusClass = 'caught';
    } else if (pokedexSeen.has(speciesName)) {
      statusText = '👁️ Замечен';         // Синий текст
      statusClass = 'seen';
    }

    // ── Цвета для статов ──
    // Каждый стат имеет свой цвет (как в основных играх Pokémon)
    const statColors = {
      hp: '#ff3b30',                     // HP — красный
      attack: '#ff9500',                 // Атака — оранжевый
      defense: '#ffcc00',                // Защита — жёлтый
      'special-attack': '#5ac8fa',       // Спец. атака — голубой
      'special-defense': '#4cd964',      // Спец. защита — зелёный
      speed: '#007aff'                   // Скорость — синий
    };
    // Русские названия статов
    const statNames = {
      hp: 'HP',
      attack: 'Атк',
      defense: 'Защ',
      'special-attack': 'СпА',
      'special-defense': 'СпЗ',
      speed: 'Скор'
    };

    // ── Генерация HTML для статов ──
    // Проходим по массиву статов из PokeAPI
    // data.stats = [{base_stat: 45, stat: {name: 'hp'}}, ...]
    const statsHtml = data.stats.map(s => {
      const base = s.base_stat;                                     // Базовое значение стата (0-255)
      const pct = Math.min(100, (base / 255) * 100);                // Процент для ширины шкалы (макс 100%)
      const color = statColors[s.stat.name] || '#777';              // Цвет для этого стата (серый если не найден)
      // Возвращаем HTML строку: название + шкала + числовое значение
      return `<div class="pokedex-detail-stat">
        <span class="stat-label">${statNames[s.stat.name] || s.stat.name}</span>
        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="stat-value">${base}</span>
      </div>`;
    }).join('');  // Склеиваем массив в одну HTML-строку

    // ── URL спрайтов ──
    // Берём официальный artwork (HD картинка), если есть
    // Если нет — используем front_default (обычный спрайт 96×96)
    const spriteUrl = data.sprites?.other?.['official-artwork']?.front_default || data.sprites.front_default;
    const shinyUrl = data.sprites?.other?.['official-artwork']?.front_shiny || data.sprites.front_shiny;
    // CSS градиент для фона на основе типов покемона
    const detailTypeBg = getTypeGradient(data.types);

    // ── Поиск лидеров залов, использующих этого покемона ──
    // Проходим по всем gymLeaders (из data/gyms.ts)
    const gymUsers = [];
    for (const [key, leader] of Object.entries(gymLeaders)) {
      if (leader.team) {
        // Собираем все имена покемонов в команде лидера
        const names = leader.team.flatMap(m => m.name ? [m.name] : []);
        // Проверяем, есть ли наш покемон в команде
        // .replace('_2','') — убирает суффикс дубликатов (если лидер имеет двух одинаковых покемонов)
        if (names.some(n => n.replace('_2','') === speciesName)) gymUsers.push(leader.name);
      }
    }

    // ── Информация об эволюциях ──
    // Асинхронно получаем цепочку эволюций через getEvolutions()
    // getEvolutions возвращает массив: [{name, minLevel, trigger, item}, ...]
    const evolutions = await getEvolutions(speciesName);
    let evoHtml = '';
    if (evolutions.length > 0) {
      // Создаём блок с зелёной рамкой для эволюций
      evoHtml = `<div class="pokedex-detail-method" style="background:rgba(52,199,89,0.1);border-color:#34c759;">
        <div class="method-row"><b>🔮 Эволюции:</b></div>
        ${evolutions.map(evo => {
          // Определяем условие эволюции:
          //   — Если есть minLevel: "Ур.X"
          //   — Если триггер use-item: название предмета (камень) или "Камень"
          //   — Иначе: триггер или "Особая" (дружба, обмен, время суток и т.д.)
          const cond = evo.minLevel
            ? `Ур.${evo.minLevel}`
            : evo.trigger === 'use-item'
              ? (evo.item || 'Камень')
              : (evo.trigger || 'Особая');
          // Кликабельная строка → открывает покедекс эволюции
          return `<div class="method-row" style="cursor:pointer;color:var(--tma-primary);margin-top:3px;" onclick="showPokedexInfo('${evo.name}')">→ ${evo.name} (${cond})</div>`;
        }).join('')}
      </div>`;
    }

    // ── Пре-эволюции (из кого эволюционирует) ──
    // evolvesFromMap — обратная карта, заполняемая при загрузке эволюций
    // Например, evolvesFromMap['venusaur'] = ['bulbasaur', 'ivysaur']
    const evolvesFrom = evolvesFromMap[speciesName] || [];
    let prevoHtml = '';
    if (evolvesFrom.length > 0) {
      prevoHtml = `<div class="pokedex-detail-method" style="background:rgba(0,122,255,0.1);border-color:#007aff;">
        <div class="method-row"><b>Эволюция из:</b></div>
        ${evolvesFrom.map(name =>
          `<div class="method-row" style="cursor:pointer;color:var(--tma-primary);margin-top:3px;" onclick="showPokedexInfo('${name}')">← ${name}</div>`
        ).join('')}
      </div>`;
    }

    // ── Навигация: предыдущий/следующий покемон ──
    // Находим индекс текущего покемона в POKEDEX_ALL
    const curIdx = POKEDEX_ALL.indexOf(speciesName);
    // Берём имена соседей (если не на границе массива)
    const prevName = curIdx > 0 ? POKEDEX_ALL[curIdx - 1] : null;
    const nextName = curIdx < POKEDEX_ALL.length - 1 ? POKEDEX_ALL[curIdx + 1] : null;

    // ── Сборка всего HTML детальной карточки ──
    detailEl.innerHTML = `
      <!-- Кнопка "Назад" — возвращает к сетке -->
      <button class="pokedex-detail-back" id="pokedex-detail-back">← Назад</button>

      <!-- Навигация по соседям: предыдущий | следующий -->
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        ${prevName
          ? `<button class="pokedex-detail-back" style="flex:1;text-align:center;margin:0;padding:6px;" onclick="showPokedexInfo('${prevName}')">◀ ${prevName}</button>`
          : '<span style="flex:1;"></span>'}
        ${nextName
          ? `<button class="pokedex-detail-back" style="flex:1;text-align:center;margin:0;padding:6px;" onclick="showPokedexInfo('${nextName}')">${nextName} ▶</button>`
          : '<span style="flex:1;"></span>'}
      </div>

      <!-- Заголовок: спрайт + имя + номер + типы -->
      <div class="pokedex-detail-header">
        <div class="pokedex-detail-sprite-box" style="background:${detailTypeBg};" id="dex-sprite-box">
          <img class="pokedex-detail-sprite" id="dex-sprite" src="${spriteUrl}" alt="${data.name}">
        </div>
        <div class="pokedex-detail-title">
          <h2>${data.name}</h2>
          <span class="dex-number">#${String(data.id).padStart(3, '0')}</span>
          <div class="pokedex-detail-types">${types}</div>
          <button id="btn-shiny-toggle" style="margin-top:4px;padding:2px 8px;font-size:0.7rem;background:var(--tma-bg);border:1px solid var(--tma-border);color:var(--tma-text);border-radius:4px;cursor:pointer;">✨ Шайни</button>
        </div>
      </div>

      <!-- Статус: пойман/замечен/неизвестен (с цветовой подсветкой) -->
      <div class="pokedex-detail-status ${statusClass}">${statusText}</div>

      <!-- Звёзды мощи и редкости -->
      <div style="display:flex;justify-content:space-around;font-size:0.7rem;margin:4px 0;">
        <span>${getPowerStars({apiData:data})}★ мощи</span>
        <span>${getRarityStars({apiData:data})}✦ редкость</span>
      </div>

      <!-- Серверные данные: способ и место (если есть) -->
      ${pokedexData[speciesName] ? `
      <div class="pokedex-detail-method">
        <div class="method-row"><b>Способ:</b> ${pokedexData[speciesName].method}</div>
        <div class="method-row"><b>Где:</b> ${pokedexData[speciesName].location}</div>
      </div>` : ''}

      <!-- Лидеры залов, использующие этого покемона -->
      ${gymUsers.length > 0 ? `
      <div class="pokedex-detail-method" style="background:rgba(175,82,222,0.15);border-color:#af52de;">
        <div class="method-row"><b>⚔ Используется лидерами:</b> ${gymUsers.join(', ')}</div>
      </div>` : ''}

      <!-- Пре-эволюции (из кого произошёл) -->
      ${prevoHtml}

      <!-- Эволюции (в кого может превратиться) -->
      ${evoHtml}

      <!-- Базовые статы (шкалы) -->
      <div class="pokedex-detail-stats">
        <h4>Базовые статы</h4>
        ${statsHtml}
      </div>
    `;

    // ── Тоггл шайни в детальной карточке ──
    let showingShiny = false;  // Локальное состояние: показан шайни или нет
    document.getElementById('btn-shiny-toggle').addEventListener('click', () => {
      showingShiny = !showingShiny;  // Инвертируем
      // Меняем src спрайта на шайни/обычный (если шайни нет — fallback на обычный)
      (document.getElementById('dex-sprite') as HTMLImageElement).src = showingShiny ? (shinyUrl || spriteUrl) : spriteUrl;
      document.getElementById('btn-shiny-toggle').textContent = showingShiny ? '✨ Обычный' : '✨ Шайни';
      // Меняем фон спрайта: тёмный градиент для шайни, цвет типов для обычного
      if (showingShiny && shinyUrl) {
        document.getElementById('dex-sprite-box').style.background = 'radial-gradient(circle, #3a2a5a 0%, #1a1a3a 100%)';
      } else {
        document.getElementById('dex-sprite-box').style.background = detailTypeBg;
      }
    });

    // ── Кнопка "Назад" ──
    document.getElementById('pokedex-detail-back').addEventListener('click', () => {
      // Прячем детальную карточку
      detailEl.style.display = 'none';
      // Восстанавливаем сетку (видимая + relative позиционирование)
      gridEl.style.visibility = 'visible';
      gridEl.style.position = 'relative';
      // Показываем поиск и фильтры
      if (searchEl) searchEl.style.display = 'block';
      if (filtersEl) filtersEl.style.display = 'flex';
    });

  } catch (e) {
    // Если загрузка не удалась — показываем сообщение об ошибке
    detailEl.innerHTML = '<div class="pokedex-detail-loading">Ошибка загрузки</div>';
  }
}

// ── Глобальная регистрация для onclick-вызовов ────────────
// Регистрируем showPokedexInfo глобально (на window)
// Это нужно чтобы из HTML onclick="showPokedexInfo('pikachu')" работал
// Особенно для кликабельных эволюций и пре-эволюций
(window as any).showPokedexInfo = showPokedexInfo;
