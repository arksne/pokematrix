// ─────────────────────────────────────────────────────────────
// evolution.ts — ЭВОЛЮЦИЯ ПОКЕМОНОВ
// ─────────────────────────────────────────────────────────────
// Управляет эволюцией покемонов: загружает цепочки эволюций из PokeAPI,
// проверяет условия (уровень, камень эволюции) и запускает анимацию
// трансформации с визуальными эффектами и обновлением характеристик.
//
// ЗАВИСИМОСТИ:
//   state.js     — getPowerStars (расчёт звёзд силы покемона)
//   sprite.js    — getTypeGradient, getSpriteUrl (спрайты, градиенты фона)
//   api.js       — fetchPokeAPI (HTTP-клиент к PokeAPI с кэшированием)
//   stones.js    — STONE_ITEM_MAP (маппинг ID предмета камня → имя в PokeAPI)
//   core.js      — evolutionCache, evolvesFromMap (ленивый импорт)
//
// ИСПОЛЬЗУЕТСЯ В:
//   core.ts     — при повышении уровня в бою
//   profile.ts  — кнопка эволюции через камень
//   pokedex.ts  — отображение цепочек эволюции
//   inventory.ts — при использовании камня
//
// КЛЮЧЕВЫЕ ЭКСПОРТЫ:
//   fetchEvolutionChain(name)   — загружает цепочку эволюций
//   getEvolutions(name)          — возвращает массив эволюций с условиями
//   checkEvolution(pokemon, ...) — проверяет, может ли покемон эволюционировать
//   triggerEvolution(pokemon, targetName) — запускает анимацию эволюции
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { getPowerStars } from '../utils/state.js';     // Звёзды мощи (на основе BST)
import { getTypeGradient, getSpriteUrl } from '../utils/sprite.js';  // Градиент типов и URL спрайта
import { fetchPokeAPI } from '../utils/api.js';          // HTTP-клиент для PokeAPI с кэшированием
// STONE_ITEM_MAP — маппинг: ID предмета камня (из items.ts) → имя в PokeAPI
// Например: 'fireStone' → 'fire-stone'
import { STONE_ITEM_MAP } from '../data/stones.js';

// ── ЛЕНИВЫЙ ИМПОРТ (циклическая зависимость core.ts ↔ evolution.ts) ──
// core.ts импортирует evolution.ts (checkEvolution, triggerEvolution)
// Если evolution.ts импортирует core.ts напрямую — цикл!
// Решение: динамический import() для получения эволюционного кэша
let _evolutionCache: Record<string, any> | null = null;
let _evolvesFromMap: Record<string, any> | null = null;

// getEvolutionData — лениво загружает core.ts и извлекает evolutionCache и evolvesFromMap
async function getEvolutionData() {
  if (!_evolutionCache) {
    const m = await import('../battle/core.js');
    _evolutionCache = m.evolutionCache;        // Кэш: { speciesName: [{species, evolution_details}] }
    _evolvesFromMap = m.evolvesFromMap;        // Обратная карта: { childName: [parentName, ...] }
  }
  return { evolutionCache: _evolutionCache, evolvesFromMap: _evolvesFromMap };
}

// ── SPECIES_NAME_MAP: маппинг форм → базовый вид ─────────
// Некоторые покемоны имеют множество форм (Mimikyu, Toxtricity, Morpeko и т.д.)
// Эти формы не существуют в PokeAPI как pokemon-species (только как pokemon)
// Этот словарь нормализует их к базовому виду, чтобы запрос pokemon-species/{name} не вернул 404
const SPECIES_NAME_MAP: Record<string, string> = {
  'wishiwashi-solo': 'wishiwashi',
  'minior-red-meteor': 'minior',
  'minior-orange': 'minior',
  'minior-yellow': 'minior',
  'minior-green': 'minior',
  'minior-blue': 'minior',
  'minior-indigo': 'minior',
  'minior-violet': 'minior',
  'mimikyu-disguised': 'mimikyu',
  'mimikyu-busted': 'mimikyu',
  'toxtricity-amped': 'toxtricity',
  'toxtricity-low-key': 'toxtricity',
  'morpeko-full-belly': 'morpeko',
  'morpeko-hangry': 'morpeko',
  'urshifu-single-strike': 'urshifu',
  'urshifu-rapid-strike': 'urshifu',
  'maushold-family-of-four': 'maushold',
  'maushold-family-of-three': 'maushold',
  'squawkabilly-green-plumage': 'squawkabilly',
  'squawkabilly-blue-plumage': 'squawkabilly',
  'squawkabilly-yellow-plumage': 'squawkabilly',
  'squawkabilly-white-plumage': 'squawkabilly',
  'palafin-zero': 'palafin',
  'palafin-hero': 'palafin',
  'tatsugiri-curly': 'tatsugiri',
  'tatsugiri-droopy': 'tatsugiri',
  'tatsugiri-stretchy': 'tatsugiri',
  'dudunsparce-two-segment': 'dudunsparce',
  'dudunsparce-three-segment': 'dudunsparce',
};  // 28 записей — формы которые маппятся на базовый вид

// ── fetchEvolutionChain: загрузка цепочки эволюций из PokeAPI ──
// Принимает pokemonName — имя вида (например, 'charmander')
// Асинхронно:
//   1. Запрашивает pokemon-species/{name} → получает URL evolution_chain
//   2. Запрашивает эволюционную цепочку
//   3. Обходит дерево эволюций (BFS)
//   4. Заполняет evolutionCache (вперёд) и evolvesFromMap (назад)
//   5. Использует SPECIES_NAME_MAP для форм
//   6. Fallback: обрезает всё после первого дефиса (например, 'pikachu-gmax' → 'pikachu')
// Возвращает массив evolves_to для запрошенного покемона
export async function fetchEvolutionChain(pokemonName) {
  const { evolutionCache, evolvesFromMap } = await getEvolutionData();

  // Внутренняя функция: загрузка и обход цепочки
  async function trySpecies(name) {
    // Шаг 1: получаем данные вида (содержит URL цепочки эволюций)
    const speciesData = await fetchPokeAPI(`pokemon-species/${name}`);
    // Шаг 2: загружаем цепочку эволюций
    const chainData = await fetchPokeAPI(speciesData.evolution_chain.url);
    let chain = chainData.chain;  // Корневой узел цепочки (базовая форма)

    // Шаг 3: BFS-обход дерева эволюций
    // chain = { species: {name}, evolves_to: [{ species: {...}, evolves_to: [...] }] }
    const queue = [chain];
    while (queue.length > 0) {
      const node = queue.shift();       // Берём узел из очереди
      const curName = node.species.name; // Имя покемона в этом узле
      // Кэшируем: для curName → его evolves_to (следующие эволюции)
      if (!evolutionCache[curName]) evolutionCache[curName] = node.evolves_to;

      // Для каждого ребёнка: добавляем обратную связь (кто в кого эволюционирует)
      for (const child of node.evolves_to) {
        const childName = child.species.name;
        // evolvesFromMap — обратная карта: ребёнок → [родители]
        if (!evolvesFromMap[childName]) evolvesFromMap[childName] = [];
        if (!evolvesFromMap[childName].includes(curName)) {
          evolvesFromMap[childName].push(curName);  // Например: 'charizard' ← ['charmeleon']
        }
        queue.push(child);  // Добавляем ребёнка в очередь для дальнейшего обхода
      }
    }

    // Возвращаем evolves_to для исходного покемона
    return evolutionCache[pokemonName] || [];
  }

  // ── Использование SPECIES_NAME_MAP для избежания 404 ──
  const speciesName = SPECIES_NAME_MAP[pokemonName] || pokemonName;

  try {
    const result = await trySpecies(speciesName);
    // Если использовали маппинг — копируем кэш для оригинального имени
    if (speciesName !== pokemonName) {
      evolutionCache[pokemonName] = evolutionCache[speciesName] || [];
    }
    return result;
  } catch (e) {
    // ── Fallback: обрезаем всё после первого дефиса ──
    // Например: 'pikachu-gmax' → 'pikachu'
    if (pokemonName.includes('-') && speciesName === pokemonName) {
      const baseName = pokemonName.split('-')[0];
      if (baseName !== pokemonName) {
        try {
          const result = await trySpecies(baseName);
          evolutionCache[pokemonName] = evolutionCache[baseName] || [];
          return result;
        } catch (_) {}
      }
    }
    console.warn('Evolution fetch failed for', pokemonName, e);
    evolutionCache[pokemonName] = [];  // Пустой массив = нет эволюций
    return [];
  }
}

// ── getEvolutions: получение списка возможных эволюций ──
// Принимает pokemonName — имя вида
// Возвращает массив: [{ name, minLevel, trigger, item }, ...]
// Сначала проверяет кэш, если нет — загружает цепочку
// Каждая эволюция содержит:
//   name — имя следующей формы
//   minLevel — минимальный уровень (null если не по уровню)
//   trigger — триггер ('level-up', 'use-item', 'trade', 'shed' и т.д.)
//   item — предмет для 'use-item' (например, 'fire-stone')
export async function getEvolutions(pokemonName) {
  const { evolutionCache, evolvesFromMap } = await getEvolutionData();

  // Если данные уже в кэше — используем их
  if (evolutionCache[pokemonName] !== undefined) {
    // Проверяем, заполнена ли обратная карта (если нет — догружаем)
    if (evolvesFromMap[pokemonName] === undefined) {
      await fetchEvolutionChain(pokemonName);
    }
    // Преобразуем из формата PokeAPI в упрощённый
    return evolutionCache[pokemonName].map(evo => {
      // evolution_details — массив деталей (обычно 1 элемент)
      const d = evo.evolution_details && evo.evolution_details[0]
        ? evo.evolution_details[0]
        : {};
      return {
        name: evo.species.name,          // Имя следующей эволюции
        minLevel: d.min_level || null,    // Минимальный уровень (null если не level-up)
        trigger: d.trigger ? d.trigger.name : null,  // Тип триггера
        item: d.item ? d.item.name : null              // Предмет (для камней)
      };
    });
  }

  // Если нет в кэше — загружаем цепочку
  const chain = await fetchEvolutionChain(pokemonName);
  // Преобразуем так же как выше
  return chain.map(evo => {
    const d = evo.evolution_details && evo.evolution_details[0]
      ? evo.evolution_details[0]
      : {};
    return {
      name: evo.species.name,
      minLevel: d.min_level || null,
      trigger: d.trigger ? d.trigger.name : null,
      item: d.item ? d.item.name : null
    };
  });
}

// ── checkEvolution: проверка, может ли покемон эволюционировать ──
// Принимает:
//   pokemon — объект покемона
//   useStone — true если используется камень (force-эволюция)
//   stoneItem — ID предмета камня (например, 'fireStone')
// Возвращает:
//   объект эволюции {name, minLevel, trigger, item} или null
// Логика:
//   — Если useStone=false: проверяет effectiveLevel >= minLevel
//   — Если useStone=true: проверяет trigger='use-item' и сопоставляет stoneItem
export async function checkEvolution(pokemon, useStone = false, stoneItem = null) {
  // Получаем список эволюций для этого покемона
  const evos = await getEvolutions(pokemon.apiData.name);
  // Эффективный уровень = базовый + конфеты
  const effectiveLevel = pokemon.baseLevel + (pokemon.candiesEaten || 0);

  for (const evo of evos) {
    // ── Эволюция по уровню ──
    if (evo.minLevel && effectiveLevel >= evo.minLevel) {
      return evo;  // Подходит по уровню
    }

    // ── Эволюция через камень ──
    if (useStone && evo.trigger === 'use-item') {
      if (stoneItem && STONE_ITEM_MAP[stoneItem]) {
        // evo.item — имя в PokeAPI ('fire-stone'), stoneItem — ID предмета ('fireStone')
        // STONE_ITEM_MAP[stoneItem] — маппинг ID → PokeAPI имя
        if (evo.item && evo.item === STONE_ITEM_MAP[stoneItem]) {
          return evo;  // Камень подходит
        }
      } else {
        // Если камень не указан — возвращаем первую эволюцию по камню
        return evo;
      }
    }
  }

  return null;  // Нет подходящей эволюции
}

// ── triggerEvolution: анимация и применение эволюции ────
// Принимает:
//   pokemon — объект покемона (будет изменён)
//   targetName — имя целевой эволюции (например, 'charizard')
//
// Анимация состоит из 5 этапов:
//   1. "Что?!" — старый спрайт + тряска (2.2 сек)
//   2. Вспышки яркости (1.6 сек)
//   3. Загрузка новой формы + обновление данных (асинхронно)
//   4. Показ нового спрайта (1.8 сек)
//   5. Финальная статистика (3 сек)
//
// После завершения — скрытие оверлея и очистка эффектов
export async function triggerEvolution(pokemon, targetName) {
  // DOM-элементы анимации
  const overlay = document.getElementById('evolution-overlay');  // Затемнённый фон
  const evoSprite = document.getElementById('evo-sprite') as HTMLImageElement;  // Спрайт
  const evoText = document.getElementById('evo-text');            // Текст

  if (!overlay) return;  // Если нет оверлея — выходим (нет поддержки анимации)

  // Вспомогательная функция: ожидание N миллисекунд
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Сохраняем старые данные для анимации
  const oldName = pokemon.apiData.name;
  const oldSprite = getSpriteUrl(pokemon);
  const evoBox = evoSprite.closest('.evo-sprite-box') as HTMLElement | null;

  // Показываем оверлей
  overlay.style.display = 'flex';

  // ── ЭТАП 1: "Что?!" + тряска ──
  evoText.innerHTML = `<span class="evo-shake">Что?!</span><br><small>${oldName} эволюционирует!</small>`;
  evoSprite.src = oldSprite;  // Старый спрайт
  if (evoBox) {
    evoBox.style.background = getTypeGradient(pokemon.apiData.types);  // Фон по типу
    evoBox.classList.add('evo-flash');  // CSS-анимация вспышки
  }
  await wait(2200);

  // ── ЭТАП 2: Вспышки яркости ──
  evoText.innerHTML = '✨ <span class="evo-glowing">Эволюция!</span> ✨';
  evoSprite.style.filter = 'brightness(3)';  // Ярко
  await wait(700);
  evoSprite.style.filter = 'brightness(0.3)';  // Темно
  await wait(400);
  evoSprite.style.filter = 'brightness(2.5)';  // Снова ярко
  await wait(500);
  evoSprite.style.filter = 'brightness(1)';    // Нормально

  // ── ЭТАП 3: Загрузка новой формы + обновление данных ──
  try {
    // Загружаем данные новой формы из PokeAPI
    const newData = await fetchPokeAPI(`pokemon/${targetName}`);

    // ── Сохраняем текущие атаки (эволюция НЕ должна их сбрасывать) ──
    const oldMoves = pokemon.apiData.moves ? [...pokemon.apiData.moves] : [];
    const oldPP = pokemon.movesPP ? [...pokemon.movesPP] : [];
    const oldLearnable = pokemon.learnableMoves ? [...pokemon.learnableMoves] : [];
    const oldLastCheckLevel = pokemon.lastMoveCheckLevel;

    // Обновляем apiData на новую форму
    pokemon.apiData = newData;

    // Восстанавливаем старые атаки (4 слота)
    if (oldMoves.length > 0) pokemon.apiData.moves = oldMoves;
    if (oldPP.length > 0) pokemon.movesPP = oldPP;
    if (oldLearnable.length > 0) pokemon.learnableMoves = oldLearnable;
    pokemon.lastMoveCheckLevel = oldLastCheckLevel || 1;

    // ── Автоматическое добавление новых атак в резерв ──
    // Проверяем атаки, которые новая форма изучает по уровню
    const curLvl = pokemon.baseLevel + (pokemon.candiesEaten || 0);
    const knownMoveNames = new Set();
    for (let i = 0; i < 4; i++) {
      if (pokemon.apiData.moves[i]?.move?.name) knownMoveNames.add(pokemon.apiData.moves[i].move.name);
    }
    if (!pokemon.learnableMoves) pokemon.learnableMoves = [];
    const reserveNames = new Set(pokemon.learnableMoves.map(m => m.name));

    // Проходим по всем атакам новой формы
    for (const entry of (newData.moves || [])) {
      for (const detail of entry.version_group_details) {
        // Если атака изучается по уровню ≤ текущего
        if (detail.move_learn_method.name === 'level-up' && detail.level_learned_at <= curLvl) {
          // И она ещё не изучена и не в резерве — добавляем
          if (!knownMoveNames.has(entry.move.name) && !reserveNames.has(entry.move.name)) {
            pokemon.learnableMoves.push({
              name: entry.move.name, url: entry.move.url, power: 0, type: 'normal'
            });
          }
          break;
        }
      }
    }

    // ── Пересчёт HP ──
    const baseHp = newData.stats[0].base_stat;
    const newMaxHp = Math.floor(
      0.01 * (2 * baseHp + pokemon.ivs.hp + Math.floor(0.25 * pokemon.evs.hp)) * curLvl
    ) + curLvl + 10;
    const oldMaxHp = pokemon.maxHp;
    pokemon.maxHp = newMaxHp;
    pokemon.currentHp = Math.min(pokemon.currentHp + (newMaxHp - oldMaxHp), newMaxHp);

    // ── ЭТАП 4: Показ нового спрайта ──
    evoSprite.src = getSpriteUrl(pokemon);  // apiData уже обновлён, isShiny сохранён
    if (evoBox) evoBox.style.background = getTypeGradient(newData.types);
    evoText.innerHTML = `<b>${targetName.toUpperCase()}!</b>`;
    evoSprite.style.filter = 'brightness(1.3) drop-shadow(0 0 20px gold)';  // Золотое свечение
    evoBox?.classList.remove('evo-flash');
    evoBox?.classList.add('evo-reveal');  // CSS-анимация появления
    await wait(1800);

    // ── ЭТАП 5: Финальная статистика ──
    const newStars = getPowerStars(pokemon);  // Звёзды мощи (0-10)
    const bst = newData.stats.reduce((s, st) => s + st.base_stat, 0);  // BST (сумма базовых статов)
    const types = newData.types.map(t => t.type.name).join(', ');  // Типы
    evoText.innerHTML = `
      <b>${targetName.toUpperCase()}</b><br>
      <small style="color:#aaa">${types} | BST: ${bst}</small><br>
      <span style="color:#ff9500;font-size:1rem;">${'★'.repeat(newStars)}${'☆'.repeat(10 - newStars)}</span><br>
      <small style="color:#5af">HP: ${oldMaxHp} → ${newMaxHp}</small>
    `;
    evoBox?.classList.remove('evo-reveal');
    await wait(3000);

  } catch (e) {
    // Ошибка загрузки PokeAPI
    console.warn('Evolution fetch failed for', targetName, e);
    evoText.innerHTML = 'Ошибка эволюции...';
    await wait(2000);
  }

  // ── Очистка ──
  evoSprite.style.filter = '';  // Сбрасываем фильтры
  evoBox?.classList.remove('evo-flash', 'evo-reveal');  // Убираем CSS-классы
  overlay.style.display = 'none';  // Прячем оверлей
}
