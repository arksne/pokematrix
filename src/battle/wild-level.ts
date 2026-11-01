/**
 * Уровень диких покемонов по локации (чистая функция, без DOM и состояния).
 *
 * Вынесено из battle/core.ts, чтобы это можно было покрыть юнит-тестами: сам
 * core.ts тянет половину UI-графа и в юнит-тестах не импортируется.
 *
 * ── Два бага, которые здесь починены ──────────────────────────────────
 *
 * 1. Идентификаторы маршрутов в данных — `route1`, `route12`, `seaRoute20`
 *    (без подчёркивания), а все ветки таблицы были написаны под `route_1`,
 *    `route_(1[1-6])` и т.п. Ни одна из них не срабатывала: КАЖДЫЙ маршрут
 *    проваливался в «Default Lv 10-20», хотя в комментарии к функции написаны
 *    совсем другие уровни. То есть у маршрутов был не тот уровень, что задуман.
 *
 * 2. Стартовый город Пьютер-Сити не попадал ни в одну ветку (там нет слов
 *    pallet/viridian/forest) и получал дефолт Lv 10-20. Новый тренер начинает
 *    игру именно в Пьютере с покемоном Lv 5 — и первой же встречей получал,
 *    например, STARLY Lv 14, который ваншотит стартера. Первый квест обучения
 *    («поймайте покемона») при этом выполнить почти нереально, а гейт обучения
 *    не пускает из города → игра для новичка фактически заблокирована.
 */

/** Минимум того, что нужно от локации. */
export interface WildLevelLocation {
  name?: string;
  wildMinLvl?: number;
  wildMaxLvl?: number;
}

/** Номер обычного/морского маршрута из id вида `route12`, `route_12`, `seaRoute20`. */
export function routeNumber(
  locId: string
): { num: number; sea: boolean } | null {
  if (!locId) return null;
  const m = /^(sea)?route_?(\d+)$/i.exec(locId.trim());
  if (!m) return null;
  const num = Number(m[2]);
  if (!Number.isFinite(num) || num <= 0) return null;
  return { num, sea: Boolean(m[1]) };
}

/** int в диапазоне [min, max] включительно. */
function roll(rand: () => number, min: number, max: number): number {
  const range = max - min + 1;
  return Math.floor(rand() * range) + min;
}

/**
 * Базовый уровень дикого покемона для локации (без бонуса этажа башни).
 *
 * @param locId id текущей локации (`GS.currentLocationId`)
 * @param loc   объект локации (может задавать wildMinLvl/wildMaxLvl напрямую)
 * @param rand  источник случайности (в тестах — детерминированный)
 */
export function baseWildLevelFor(
  locId: string,
  loc: WildLevelLocation | null | undefined,
  rand: () => number = Math.random
): number {
  const id = locId || '';

  // ── Локация задаёт min/max уровень напрямую — уважаем это ──
  if (loc && loc.wildMinLvl !== undefined && loc.wildMaxLvl !== undefined) {
    return roll(rand, loc.wildMinLvl, loc.wildMaxLvl);
  }

  // ── Johto: ранние маршруты ──
  if (
    id.includes('route29') ||
    id.includes('route30') ||
    id.includes('route31') ||
    id.includes('newBark') ||
    id.includes('cherrygrove')
  ) {
    return roll(rand, 5, 15);
  }
  // Goldenrod (кроме стадиона)
  if (id.includes('goldenrod') && !id.includes('stadium')) return roll(rand, 5, 10);
  // Johto: середина
  if (
    id.includes('route34') ||
    id.includes('route35') ||
    id.includes('route36') ||
    id.includes('route37') ||
    id.includes('route38') ||
    id.includes('route39') ||
    id.includes('ilex') ||
    id.includes('nationalPark')
  ) {
    return roll(rand, 15, 25);
  }
  // Ecruteak + Olivine
  if (id.includes('ecruteak') || id.includes('olivine') || id.includes('route42') || id.includes('lakeOfRage')) {
    return roll(rand, 25, 35);
  }
  // Blackthorn + Mt Silver
  if (id.includes('blackthorn') || id.includes('mtSilver') || id.includes('route45') || id.includes('icePath')) {
    return roll(rand, 35, 45);
  }
  // Victory Road / Indigo Plateau
  if (id.includes('victory') || id.includes('indigo')) return roll(rand, 40, 50);

  // ── Kanto: маршруты по номерам (см. routeNumber — ids без подчёркивания) ──
  const route = routeNumber(id);
  if (route) {
    // Морские маршруты 19-21 — поздние (сёрф после Купания).
    if (route.sea) return roll(rand, 30, 40);
    const n = route.num;
    if (n === 22) return roll(rand, 5, 12);          // объездная у Виридиана, ранняя
    if (n <= 2) return roll(rand, 5, 12);            // очень ранние
    if (n === 23) return roll(rand, 38, 45);         // путь к Victory Road
    if (n <= 5) return roll(rand, 8, 16);            // ранние
    if (n <= 10) return roll(rand, 12, 22);          // ранне-средние
    if (n <= 16) return roll(rand, 20, 30);          // середина
    if (n <= 21) return roll(rand, 30, 40);          // поздние
    if (n === 24 || n === 25) return roll(rand, 20, 26); // северные, за мостом
    return roll(rand, 10, 20);                        // неизвестный номер
  }

  // ── Kanto: поздние локации по имени ──
  if (id.includes('cerulean')) return roll(rand, 30, 40);
  // ── Kanto: середина ──
  if (id.includes('safari') || id.includes('fuchsia') || id.includes('lavender')) return roll(rand, 20, 30);
  // ── Kanto: ранне-средние города ──
  if (id.includes('saffron') || id.includes('celadon')) return roll(rand, 12, 22);
  // ── Kanto: ранние ──
  if (id.includes('viridian') || id.includes('forest')) return roll(rand, 5, 12);
  // ── Стартовая зона ──
  if (id.includes('pallet')) return roll(rand, 3, 8);
  // Пьютер-Сити — СТАРТОВЫЙ город: новый тренер приходит сюда с покемоном Lv 5.
  // Дикие должны быть слабее/на уровне стартера, иначе первый бой и первый квест
  // обучения («поймайте покемона») невыполнимы.
  if (id.includes('pewter')) return roll(rand, 3, 7);

  // ── Всё остальное ──
  return roll(rand, 10, 20);
}
