// ─────────────────────────────────────────────────────────────
// starter.ts — ВЫБОР СТАРТОВОГО ПОКЕМОНА
// ─────────────────────────────────────────────────────────────
// При начале игры предлагает выбрать стартового покемона из 3 генераций.
// Загружает данные из PokeAPI, создаёт объект покемона и добавляет в команду.
//
// ЗАВИСИМОСТИ:
//   state       — глобальное состояние (myTeam, pcBoxes, pokedexSeen)
//   store       — event-система (emit: location:render, team:render, save)
//   dom         — showToast (уведомления)
//   natures     — массив характеров (для случайного выбора)
//   starters    — GEN_STARTERS (массивы стартовых покемонов по поколениям)
//
// ИСПОЛЬЗУЕТСЯ В: init.ts (при первом запуске)
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';          // Глобальное состояние игры
import { store } from '../game/store.js';            // Event-система (emit)
import { generateUID, getTrainerId } from '../game/state.js';  // Генерация UID и ID тренера
import { showToast } from '../utils/dom.js';          // Всплывающие уведомления
import { natures } from '../data/natures.js';         // Массив характеров покемонов
// GEN_STARTERS — массив массивов: [
//   ['bulbasaur','charmander','squirtle'],          // Поколение 1
//   ['chikorita','cyndaquil','totodile'],            // Поколение 2
//   ['treecko','torchic','mudkip'],                  // Поколение 3
//   ...                                              // и т.д. до 9
// ]
import { GEN_STARTERS } from '../data/starters.js';

// ── giveStarterMon: создать и выдать стартового покемона ──
// Принимает pokemonName — имя покемона (например, 'charmander')
// Асинхронно:
//   1. Загружает данные покемона из PokeAPI
//   2. Фильтрует атаки (только до 5 уровня)
//   3. Создаёт объект покемона с IV 30-31, базовым уровнем 5
//   4. Добавляет в команду (или PC если команда полна)
//   5. Регистрирует как пойманного в покедексе
//   6. Отправляет запрос на сервер для регистрации
export async function giveStarterMon(pokemonName: string) {
  try {
    // ── 1. Загрузка данных из PokeAPI ──
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
    const starterData = await res.json();
    const baseLevel = 5;  // Стартовый уровень

    // ── 2. Фильтрация атак ──
    // Оставляем только те атаки, которые изучаются до 5 уровня (level-up)
    // Берём максимум 4 атаки (4 слота в бою)
    let learnedMoves = starterData.moves
      .filter((m: any) => {
        return m.version_group_details.some(
          (v: any) => v.move_learn_method.name === 'level-up' && v.level_learned_at <= baseLevel
        );
      })
      .slice(0, 4);

    // Если атак нет (защита от пустого списка) — добавляем Tackle (базовая атака)
    if (learnedMoves.length === 0) {
      learnedMoves.push({
        move: { name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' }
      });
    }
    starterData.moves = learnedMoves;

    // ── 3. Расчёт базовых характеристик ──
    // EXP = уровень³ (формула из Pokémon)
    const exp = Math.pow(baseLevel, 3);
    const expToNext = Math.pow(baseLevel + 1, 3);  // EXP до следующего уровня
    const baseHp = starterData.stats[0].base_stat;  // Базовый HP из PokeAPI
    // Начальный maxHp (без EV, IV=30, уровень=5)
    const maxHp = Math.floor(0.01 * (2 * baseHp + 30) * baseLevel) + baseLevel + 10;

    // ── 4. Создание объекта покемона ──
    const newMon: any = {
      uid: generateUID(),                           // Уникальный ID (16 символов)
      originalTrainer: getTrainerId(),               // ID тренера, который поймал
      createdAt: Date.now(),                         // Время создания
      caughtLocation: state.currentLocationId,       // Где пойман
      apiData: starterData,                          // Данные из PokeAPI (статы, типы, способности, спрайты)
      maxHp,                                         // Максимум HP
      currentHp: maxHp,                              // Текущий HP = полный
      // IV (индивидуальные значения): почти максимальные (30-31)
      ivs: { hp: 30, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      // EV (очки усилий): все 0
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      baseLevel: baseLevel,                          // Базовый уровень
      exp: exp,                                      // Текущий опыт
      expToNext: expToNext,                          // Опыт до следующего уровня
      candiesEaten: 0,                               // Съедено конфет
      vitaminsEaten: 0,                              // Съедено витаминов
      training: null,                                // Данные тренировки
      trainingStage: 0,                              // Стадия тренировки (0-6)
      trainingStat: null,                            // Какой стат тренируется
      happiness: 70,                                 // Счастье (изначально 70)
      natureIdx: Math.floor(Math.random() * natures.length), // Случайный характер
      breedLetter: 'A',                              // Буква разведения
      gender: Math.random() < 0.5 ? 'male' : 'female', // Случайный пол (50/50)
      status: null,                                  // Нет статуса
      sleepTurns: 0,                                 // Ходов сна
      movesPP: [],                                   // PP атак (заполняется позже)
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, // Стадии статов (0 = норма)
      abilityName: starterData.abilities[0]?.ability?.name || null, // Первая способность
      heldItem: null,                                // Нет удерживаемого предмета
      // Счётчики ягод (все 0)
      berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
      learnableMoves: []                             // Атаки в резерве (пока пусто)
    };

    // Пересчёт maxHp с учётом IV=30 и EV=0
    newMon.maxHp = Math.floor(
      0.01 * (2 * starterData.stats[0].base_stat + newMon.ivs.hp + Math.floor(0.25 * newMon.evs.hp)) * newMon.baseLevel
    ) + newMon.baseLevel + 10;
    newMon.currentHp = newMon.maxHp;

    // ── 5. Добавление в команду или PC ──
    if (state.myTeam.length < 6) {
      state.myTeam.push(newMon);              // Добавляем в команду
    } else {
      // Если команда заполнена — отправляем в PC (первый бокс)
      if (state.pcBoxes.length === 0) state.pcBoxes.push([]);
      state.pcBoxes[0].push(newMon);
    }

    // Регистрируем в покедексе
    state.pokedexSeen.add(pokemonName);
    state.pokedexCaught.add(pokemonName);

    // Отправляем события: перерисовать локацию, команду, сохранить
    store.emit('location:render', state.currentLocationId);
    store.emit('team:render');
    store.emit('save');

    // ── 6. Стартовые предметы ──
    state.inventory['pokeBall'] = (state.inventory['pokeBall'] || 0) + 5;
    state.inventory['potion'] = (state.inventory['potion'] || 0) + 3;
    state.inventory['credit'] = Math.max(state.inventory['credit'] || 0, 1000);

  } catch (e) {
    console.error('Failed to give starter', e);
  }
}

// ── giveStarter: показать интерфейс выбора стартового покемона ──
// Показывает модалку с N картами (по одной на поколение)
// При клике на карту — случайный покемон из этого поколения
// Если модалка не найдена — выдаёт Bulbasaur по умолчанию
export function giveStarter() {
  // Находим модалку и сетку (DOM-элементы)
  const modal = document.getElementById('starter-modal');
  const grid = document.getElementById('starter-grid');
  if (!modal || !grid) {
    // Если модалки нет — выдаём Bulbasaur (запасной вариант)
    giveStarterMon('bulbasaur');
    return;
  }

  // Очищаем сетку
  grid.innerHTML = '';
  // Устанавливаем заголовок
  const title = document.querySelector('#starter-modal h2');
  if (title) title.innerText = 'Выберите карту (Поколения 1-9)';

  // GEN_STARTERS — массив поколений, каждое поколение = массив имён
  GEN_STARTERS.forEach((gen: string[], idx: number) => {
    // Создаём карту для поколения
    const div = document.createElement('div');
    div.className = 'starter-option';
    // Стили: тёмно-синий градиент, белый текст, крупный знак вопроса
    div.style.background = 'linear-gradient(135deg, #2a5298, #1e3c72)';
    div.style.color = '#fff';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.fontSize = '3rem';
    div.style.fontWeight = 'bold';
    div.style.cursor = 'pointer';
    div.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
    div.style.borderRadius = '10px';
    div.style.height = '150px';
    div.style.transition = 'transform 0.2s';
    div.innerText = '?';  // Пока знак вопроса (сюрприз)

    // При наведении — масштабирование (анимация)
    div.addEventListener('mouseenter', () => div.style.transform = 'scale(1.05)');
    div.addEventListener('mouseleave', () => div.style.transform = 'scale(1)');

    // При клике — выбираем случайного покемона из этого поколения
    div.addEventListener('click', () => {
      const chosenStarter = gen[Math.floor(Math.random() * gen.length)];  // Случайный
      modal.style.display = 'none';   // Закрываем модалку
      giveStarterMon(chosenStarter);  // Создаём и выдаём покемона
      showToast(
        `Вам выпал покемон: ${chosenStarter.toUpperCase()}! (Gen ${idx + 1})`,
        false
      );
    });
    grid.appendChild(div);
  });

  // Показываем модалку
  modal.style.display = 'flex';
}
