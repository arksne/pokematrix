// ─────────────────────────────────────────────────────────────
// daycare.ts — ПИТОМНИК И РАЗВЕДЕНИЕ ПОКЕМОНОВ
// ─────────────────────────────────────────────────────────────
// Реализует два режима:
//   1) Питомник (Daycare) — временное хранение 2 покемонов из команды
//      с прокачкой уровней со временем и шансом получить яйцо.
//   2) Разведение (Breeding) — автоматическое спаривание покемонов
//      в PC-боксах по яйце-группам и полу с наследованием IV.
//
// ЗАВИСИМОСТИ:
//   state       — глобальное состояние (myTeam, pcBoxes, daycareMons, eggs)
//   store       — EventEmitter для сохранения и рендера UI
//   actions     — addItem (добавление яйца в инвентарь)
//   state (util) — generateUID, getTrainerId
//   dom         — showToast, showSelectionModal
//   core        — appendToLog, calculateStat
//   natures     — массив характеров
//
// ИСПОЛЬЗУЕТСЯ В:
//   init.ts     — startBreedingCheck
//   inventory.ts — hatchEgg
//   location.ts — checkDaycare, collectDaycareMons, collectDaycareEgg
//   npcs.ts     — openDaycareDeposit
//   pc.ts       — hatchEgg, checkBreeding, collectEgg
//
// ЭКСПОРТЫ:
//   EGG_TIME, EGG_BONUS_TIME     — константы времени
//   openDaycareDeposit           — депозит в питомник
//   checkDaycare                 — проверка прокачки и яиц
//   collectDaycareEgg            — забрать яйцо
//   collectDaycareMons           — забрать покемонов
//   checkBreeding                — проверка разведения в PC
//   startBreedingCheck           — запуск периодической проверки
//   hatchEgg                     — вылупление яйца
//   collectEgg                   — перемещение яйца из бокса в инвентарь
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';            // Глобальное состояние игры
import { store } from '../game/store.js';              // Event-система (emit)
import { addItem } from '../game/actions.js';          // Добавление предмета в инвентарь
import { generateUID, getTrainerId } from '../game/state.js';  // Генерация ID
import { showToast, showSelectionModal } from '../utils/dom.js';  // UI компоненты
import { appendToLog, calculateStat } from '../battle/core.js';  // Лог + расчёт HP
import { natures } from '../data/natures.js';          // Массив характеров

// ── КОНСТАНТЫ ────────────────────────────────────────────

export const EGG_TIME = 10 * 60 * 1000;         // 10 минут на производство яйца (питомник)
export const EGG_BONUS_TIME = 5 * 60 * 1000;     // 5 минут если характеры совпадают
const BREEDING_CHECK_INTERVAL = 60 * 1000;       // Проверка разведения каждую минуту

// randomHatchTime — случайное время вылупления: 3-8 дней (в миллисекундах)
function randomHatchTime() {
  return (3 + Math.floor(Math.random() * 6)) * 24 * 60 * 60 * 1000;
}

// ── ПИТОМНИК: Депозит ─────────────────────────────────────

// openDaycareDeposit — показать выбор покемонов для отправки в питомник
// Пользователь выбирает 2 покемонов из команды (должны быть живы)
// Они удаляются из команды и помещаются в state.daycareMons
export function openDaycareDeposit() {
  // Фильтруем только живых покемонов (currentHp > 0)
  const available = state.myTeam
    .map((m: any, i: number) => ({ m, i }))
    .filter(({ m }: any) => m.currentHp > 0);

  // Нужно минимум 2 покемона
  if (available.length < 2) {
    showToast('Нужно минимум 2 живых покемона!', true);
    return;
  }

  // Создаём список для выбора первого покемона
  const items = available.map(({ m }: any) => ({
    label: `Lv.${m.baseLevel + m.candiesEaten} ${m.nickname || m.apiData?.name}`,
    subtitle: `${m.apiData?.gender || '?'} | HP: ${m.currentHp}/${m.maxHp}`
  }));

  // Показываем модалку выбора ПЕРВОГО покемона
  showSelectionModal('Питомник — выберите ПЕРВОГО покемона', items, (i1: number) => {
    // Оставшиеся покемоны (исключая выбранного)
    const remaining = available.filter((_: any, i: number) => i !== i1);
    const items2 = remaining.map(({ m }: any) => ({
      label: `Lv.${m.baseLevel + m.candiesEaten} ${m.nickname || m.apiData?.name}`,
      subtitle: `${m.apiData?.gender || '?'} | HP: ${m.currentHp}/${m.maxHp}`
    }));

    // Показываем модалку выбора ВТОРОГО покемона
    showSelectionModal('Выберите ВТОРОГО покемона', items2, (i2: number) => {
      const mon1 = available[i1].m;
      const mon2 = remaining[i2].m;

      // Находим индексы в оригинальном массиве myTeam
      const idx1 = state.myTeam.indexOf(mon1);
      const idx2 = state.myTeam.indexOf(mon2);

      // Удаляем из команды (сначала больший индекс, чтобы не сбить порядок)
      const hi = Math.max(idx1, idx2);
      const lo = Math.min(idx1, idx2);
      const depositMon2 = state.myTeam.splice(hi, 1)[0];  // Удаляем второго
      const depositMon1 = state.myTeam.splice(lo, 1)[0];  // Удаляем первого

      // Добавляем в питомник с текущим временем
      state.daycareMons.push({ mon: depositMon2, depositTime: Date.now() });
      state.daycareMons.push({ mon: depositMon1, depositTime: Date.now() });

      // Логируем
      appendToLog(
        `${mon1.nickname || mon1.apiData?.name} и ${mon2.nickname || mon2.apiData?.name} оставлены в Питомнике!`,
        false, 'quest'
      );
      showToast('Покемоны оставлены в Питомнике!', false);
      store.emit('team:render');  // Перерисовываем команду
      store.emit('save');          // Сохраняем
    });
  });
}

// ── ПИТОМНИК: Проверка прокачки ─────────────────────────

// checkDaycare — вызывается при входе в покецентр
// Даёт покемонам в питомнике +1 уровень за каждый час
// Также проверяет шанс на яйцо (30% после 2 часов)
export function checkDaycare() {
  const now = Date.now();

  // ── Прокачка уровней ──
  state.daycareMons.forEach((entry: any) => {
    const hoursPassed = (now - entry.depositTime) / (1000 * 60 * 60);  // Часов прошло
    // Если прошёл хотя бы 1 час И покемон не достиг 100 уровня
    if (hoursPassed >= 1 && entry.mon.baseLevel + (entry.mon.candiesEaten || 0) < 100) {
      const levelsGained = Math.floor(hoursPassed);  // Сколько уровней заработал
      // Если есть новые уровни (с последней проверки) — применяем
      if (levelsGained > 0 && levelsGained > (entry._lastLevelsGained || 0)) {
        const newLevels = levelsGained - (entry._lastLevelsGained || 0);
        for (let i = 0; i < newLevels; i++) {
          entry.mon.baseLevel++;                          // Повышаем базовый уровень
          entry.mon.maxHp = calculateStat(entry.mon, 'hp', false);  // Пересчитываем HP
          entry.mon.currentHp = entry.mon.maxHp;          // Полное HP
        }
        entry._lastLevelsGained = levelsGained;  // Запоминаем последний уровень
      }
    }
  });

  // ── Проверка яйца ──
  // Если в питомнике 2+ покемона И яйца ещё нет
  if (state.daycareMons.length >= 2 && !state.daycareEgg) {
    // Берём минимальное время из двух (кто меньше пробыл)
    const hoursPassed = Math.min(
      (now - state.daycareMons[0].depositTime) / (1000 * 60 * 60),
      (now - state.daycareMons[1].depositTime) / (1000 * 60 * 60)
    );
    // После 2 часов — 30% шанс получить яйцо
    if (hoursPassed >= 2 && Math.random() < 0.3) {
      const parent = state.daycareMons[0].mon;  // Вид = вид первого родителя
      state.daycareEgg = {
        species: parent.apiData?.name || parent.name,  // Вид покемона
        readyTime: now + 1000 * 60 * 30,  // Яйцо готово через 30 минут
        parent1: state.daycareMons[0].mon,
        parent2: state.daycareMons[1].mon
      };
      appendToLog('🥚 В Питомнике появилось яйцо! Заберите его через 30 минут.', false, 'quest');
    }
  }
}

// ── ПИТОМНИК: Забрать яйцо ────────────────────────────

export function collectDaycareEgg() {
  if (!state.daycareEgg) return showToast('Яйца пока нет!', true);
  // Проверяем, готово ли яйцо
  if (Date.now() < state.daycareEgg.readyTime) {
    const minsLeft = Math.ceil((state.daycareEgg.readyTime - Date.now()) / 60000);
    return showToast(`Яйцо ещё не готово! Осталось ~${minsLeft} мин.`, true);
  }
  if (!addItem('suspiciousEgg')) {
    showToast('Рюкзак полон! Освободите место и попробуйте снова.', true);
    return;
  }
  state.daycareEgg = null;  // Сбрасываем (яйцо забрано)
  showToast('Вы получили яйцо! Оно добавлено в инвентарь.', false);
  store.emit('save');
}

// ── ПИТОМНИК: Забрать покемонов ──────────────────────

export function collectDaycareMons() {
  if (state.daycareMons.length === 0) return showToast('В Питомнике нет покемонов!', true);
  if (state.myTeam.length >= 6) return showToast('Команда полна! Освободите место.', true);

  checkDaycare();  // Сначала применяем накопленные уровни

  // Забираем первого покемона
  const entry = state.daycareMons.shift();
  state.myTeam.push(entry.mon);

  // Забираем второго (если есть место)
  if (state.daycareMons.length > 0 && state.myTeam.length < 6) {
    const entry2 = state.daycareMons.shift();
    state.myTeam.push(entry2.mon);
  }

  appendToLog('Покемоны возвращены из Питомника!', false, 'quest');
  store.emit('team:render');
  store.emit('save');
}

// ── РАЗВЕДЕНИЕ (Breeding) ───────────────────────────────

// ── Яйце-группы ──
// Кэш: speciesName → [eggGroupName, ...]
// Загружается из PokeAPI /pokemon-species/{name} → egg_groups
const eggGroupCache = new Map<string, string[]>();

// getMonEggGroups — получить яйце-группы покемона
// Загружает с PokeAPI, кэширует для ускорения
async function getMonEggGroups(mon: any): Promise<string[]> {
  const name = mon.apiData?.species?.name || mon.apiData?.name;
  if (!name) return [];
  if (eggGroupCache.has(name)) return eggGroupCache.get(name)!;  // Из кэша

  try {
    // URL вида: /api/v2/pokemon-species/pikachu
    const speciesUrl = mon.apiData?.species?.url ||
      `https://pokeapi.co/api/v2/pokemon-species/${name}`;
    const res = await fetch(speciesUrl);
    const data = await res.json();
    // Извлекаем имена групп: [{name: 'monster'}, {name: 'ground'}]
    const groups = (data.egg_groups || []).map((g: any) => g.name);
    eggGroupCache.set(name, groups);  // Кэшируем
    return groups;
  } catch(e) { return []; }
}

// getMonGender — получить пол покемона
function getMonGender(mon: any) {
  return mon.gender || mon.apiData?.wildGender || null;
}

// ── Проверка совместимости для разведения ──
// Условия:
//   (1) Разные покемоны (разные UID)
//   (2) Оба имеют пол
//   (3) Разные полы
//   (4) Общая яйце-группа ИЛИ один из них Ditto
function areBreedingCompatible(mon1: any, mon2: any, groups1: string[], groups2: string[]) {
  if (mon1.uid === mon2.uid) return false;           // Один и тот же покемон
  const g1 = getMonGender(mon1);
  const g2 = getMonGender(mon2);
  if (!g1 || !g2) return false;                       // Нет пола
  if (g1 === g2) return false;                        // Один пол
  const shared = groups1.filter(g => groups2.includes(g));  // Общие группы
  if (shared.length === 0 && !groups1.includes('ditto') && !groups2.includes('ditto')) return false;
  return true;
}

// ── Основной цикл разведения (PC Boxes) ──
// Проходит по всем боксам, проверяет совместимость пар,
// создаёт яйца при совместимости, проверяет готовность яиц
export async function checkBreeding() {
  if (state.hatching) return;  // Предотвращаем параллельные вызовы
  state.hatching = true;
  const now = Date.now();

  try {
    // Проходим по всем PC-боксам
    for (let boxIdx = 0; boxIdx < state.pcBoxes.length; boxIdx++) {
      const box = state.pcBoxes[boxIdx];
      if (box.length < 2) continue;  // Нужно минимум 2 покемона

      // Проверяем, есть ли уже активная пара в этом боксе
      const existingPair = state.breedingPairs.find((p: any) => p.boxIdx === boxIdx);

      // Если пара существует и время вышло — создаём яйцо
      if (existingPair && now >= existingPair.readyTime) {
        const m1 = box.find((m: any) => m.uid === existingPair.mon1Uid);
        const m2 = box.find((m: any) => m.uid === existingPair.mon2Uid);
        if (m1 && m2) {
          const eggUid = generateUID();
          const species = m1.apiData?.species?.name || m1.apiData?.name;
          const eggTypes = m1.apiData?.types || [{ type: { name: 'normal' } }];

          // Наследование IV: среднее родителей ± случайность 2
          const inheritIV = (parentVal: number) =>
            Math.min(31, Math.max(0, parentVal + (Math.random() < 0.5 ? 2 : -2)));
          const avgIV = (stat: string) => Math.round((m1.ivs[stat] + m2.ivs[stat]) / 2);

          const eggIvs = {
            hp: inheritIV(avgIV('hp')),
            atk: inheritIV(avgIV('atk')),
            def: inheritIV(avgIV('def')),
            spa: inheritIV(avgIV('spa')),
            spd: inheritIV(avgIV('spd')),
            spe: inheritIV(avgIV('spe'))
          };

          // Создаём объект яйца
          const egg = {
            uid: eggUid,
            species,
            types: eggTypes,
            ivs: eggIvs,
            readyTime: now + randomHatchTime(),  // Случайное время вылупления
            boxIdx,
            parent1Uid: existingPair.mon1Uid,
            parent2Uid: existingPair.mon2Uid
          };
          state.eggs.push(egg);  // Добавляем в список яиц

          // Уведомление и лог
          store.emit('notification:add', '🥚 Новое яйцо!',
            `В Боксе ${boxIdx + 1} появилось яйцо ${species}!`);
          appendToLog(`🥚 В Боксе ${boxIdx + 1} появилось яйцо! (${species})`, false, 'quest');
        }
        // Удаляем пару (яйцо создано)
        state.breedingPairs = state.breedingPairs.filter((p: any) => p !== existingPair);
      }

      // Если пары нет — ищем совместимую
      if (!state.breedingPairs.some((p: any) => p.boxIdx === boxIdx)) {
        for (let i = 0; i < box.length; i++) {
          for (let j = i + 1; j < box.length; j++) {
            const m1 = box[i], m2 = box[j];
            if (!m1.apiData || !m2.apiData) continue;

            // Загружаем яйце-группы
            const groups1 = await getMonEggGroups(m1);
            const groups2 = await getMonEggGroups(m2);

            // Проверяем совместимость
            if (areBreedingCompatible(m1, m2, groups1, groups2)) {
              const sameNature = m1.natureIdx === m2.natureIdx;
              const readyTime = now + (sameNature ? EGG_BONUS_TIME : EGG_TIME);
              state.breedingPairs.push({
                boxIdx,
                mon1Uid: m1.uid,
                mon2Uid: m2.uid,
                startTime: now,
                readyTime
              });
              const natureBonus = sameNature ? ' (быстро — одинаковый характер!)' : '';
              appendToLog(
                `💕 ${m1.apiData.name} и ${m2.apiData.name} в Боксе ${boxIdx + 1} нашли друг друга!${natureBonus}`,
                false, 'quest'
              );
              break;  // Выходим из внутреннего цикла
            }
          }
          if (state.breedingPairs.some((p: any) => p.boxIdx === boxIdx)) break;  // Выходим из внешнего
        }
      }
    }

    // ── Проверка готовых к вылуплению яиц ──
    for (const egg of state.eggs) {
      if (now >= egg.readyTime) {
        await hatchEgg(egg);
      }
    }

    // ── Очистка яиц из удалённых боксов ──
    state.eggs = state.eggs.filter(
      (e: any) => e.boxIdx !== undefined ? state.pcBoxes[e.boxIdx] !== undefined : true
    );

    store.emit('save');
  } finally {
    state.hatching = false;  // Всегда сбрасываем флаг, даже при ошибке
  }
}

// ── Периодическая проверка разведения ──
// Запускает интервал: каждую минуту проверяет, есть ли
// яйца или пары, и если да — вызывает checkBreeding()
export function startBreedingCheck() {
  setInterval(() => {
    if (state.eggs.length > 0 || state.breedingPairs.length > 0) checkBreeding();
  }, BREEDING_CHECK_INTERVAL);
}

// ── Вылупление яйца ──
// Загружает данные покемона из PokeAPI, создаёт объект покемона
// с наследованными IV от родителей, добавляет в команду или PC
export async function hatchEgg(egg: any) {
  // Проверяем, существует ли яйцо ещё
  if (!state.eggs.some((e: any) => e.uid === egg.uid)) return;

  const eggData = { ...egg };  // Копируем данные яйца (на случай если оригинал изменится)

  try {
    // Загружаем данные покемона из PokeAPI по имени вида
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${egg.species}`);
    if (!res.ok) {
      // Ошибка загрузки — яйцо утеряно
      state.eggs = state.eggs.filter((e: any) => e.uid !== egg.uid);
      store.emit('save');
      showToast(`Яйцо ${egg.species || 'неизвестного вида'} повреждено и утеряно`, true);
      return;
    }
    const pokeData = await res.json();

    // Удаляем яйцо из списка яиц и из команды (если было в команде)
    const eggIdx = state.myTeam.findIndex((m: any) => m.uid === egg.uid);
    if (eggIdx !== -1) state.myTeam.splice(eggIdx, 1);
    state.eggs = state.eggs.filter((e: any) => e.uid !== egg.uid);

    // Создаём нового покемона (уровень 1)
    const newMon = {
      uid: generateUID(),                    // Уникальный ID
      originalTrainer: getTrainerId(),        // ID тренера
      createdAt: Date.now(),
      caughtLocation: 'breeding',              // Получен разведением
      apiData: pokeData,                       // Данные из PokeAPI
      maxHp: 50, currentHp: 50,                // Начальное HP
      // IV: наследованные от родителей (или случайные)
      ivs: eggData.ivs || {
        hp: Math.floor(Math.random()*32), atk: Math.floor(Math.random()*32),
        def: Math.floor(Math.random()*32), spa: Math.floor(Math.random()*32),
        spd: Math.floor(Math.random()*32), spe: Math.floor(Math.random()*32)
      },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },  // EV = 0
      baseLevel: 1, exp: 0, expToNext: 8,                        // Уровень 1
      candiesEaten: 0, vitaminsEaten: 0,
      training: null, trainingStage: 0, trainingStat: null,
      happiness: 120,                            // Высокое счастье (только вылупился)
      natureIdx: Math.floor(Math.random() * natures.length),  // Случайный характер
      breedLetter: ['A','B','C','D'][Math.floor(Math.random()*4)],  // Буква разведения
      gender: Math.random() < 0.5 ? 'male' : 'female',  // 50/50
      status: null, sleepTurns: 0,
      movesPP: [],
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      abilityName: pokeData.abilities[0]?.ability?.name || null,
      heldItem: null,
      berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
      learnableMoves: [],
      isEgg: false,          // Уже не яйцо
      hasBred: false          // Ещё не разводился
    };

    // ── Наследование IV от родителей ──
    // Если есть оба родителя — берём по одному случайному IV от каждого
    if (eggData.parent1Uid && eggData.parent2Uid) {
      const allMons = [...state.myTeam, ...state.pcBoxes.flat()];
      const p1 = allMons.find((m: any) => m.uid === eggData.parent1Uid);
      const p2 = allMons.find((m: any) => m.uid === eggData.parent2Uid);
      if (p1) {
        const stats = ['hp','atk','def','spa','spd','spe'];
        const s1 = stats[Math.floor(Math.random()*stats.length)];  // Случайный стат от родителя 1
        const s2 = stats[Math.floor(Math.random()*stats.length)];  // Случайный стат от родителя 2
        if (p1.ivs) newMon.ivs[s1] = p1.ivs[s1];
        if (p2?.ivs) newMon.ivs[s2] = p2.ivs[s2];
      }
    }

    // Добавляем в команду или PC
    if (state.myTeam.length < 6) {
      state.myTeam.push(newMon);
      store.emit('notification:add', '🎉 Яйцо вылупилось!', `${pokeData.name} появился на свет!`);
      appendToLog(`🎉 Из яйца вылупился ${pokeData.name}!`, false, 'quest');
    } else {
      // Если команда полна — в первый бокс PC
      if (state.pcBoxes.length === 0) state.pcBoxes.push([]);
      state.pcBoxes[0].push(newMon);
      store.emit('notification:add', '🎉 Яйцо вылупилось!',
        `${pokeData.name} вылупился и отправлен в PC (команда полна).`);
      appendToLog(`🎉 Из яйца вылупился ${pokeData.name}! (отправлен в PC)`, false, 'quest');
    }

    store.emit('team:render');
    store.emit('save');
  } catch(e) {
    console.error('Hatch failed:', e);
    state.eggs = state.eggs.filter((e: any) => e.uid !== eggData.uid);
    store.emit('save');
    showToast('Ошибка вылупления, яйцо утеряно', true);
  }
}

// ── collectEgg: переместить яйцо из бокса в рюкзак ───────
// Убирает boxIdx — яйцо перестаёт быть привязано к боксу
export function collectEgg(eggUid: string) {
  const egg = state.eggs.find((e: any) => e.uid === eggUid);
  if (!egg) return;
  delete egg.boxIdx;  // Убираем привязку к боксу (теперь в рюкзаке)
  store.emit('save');
  showToast('🥚 Яйцо перемещено в рюкзак!', false);
}
