// ─────────────────────────────────────────────────────────────
// quest-track.ts — ТРЕКЕР NPC-КВЕСТОВ (гринд-пачка Пьютера)
// ─────────────────────────────────────────────────────────────
// Проблема: прогресс обычных NPC-квестов (defeat/catch/explore/earn)
// никто не двигал — работали только collect_items и туториал.
// Этот модуль — единая точка: trackNPCQuests вызывается из игровых
// событий, verifyQuest проверяет составные условия при сдаче.
//
// Типы прогресса:
//   defeat_x / catch_x / earn_money / explore / use_item / hatch_x / trade_x —
//     инкремент (+amount, фильтры);
//   boss_win — сразу в цель (победа над именным противником);
//   streak_x — прогресс = текущий стрик (не сумма!);
//   verify — составные условия (уровень, коллекция, локации, EV, декс),
//     проверяются при сдаче (и при взятии — сразу готов если выполнено).
//
// ЗАВИСИМОСТИ (листовые, циклов нет):
//   data/npc.js — NPC_DATA, data/regions.js — регионы для фильтров.
// ─────────────────────────────────────────────────────────────

import { NPC_DATA } from '../data/npc.js';
import { REGIONS } from '../data/regions.js';
import { state } from '../game/state.js';
import { gymLeaders } from '../data/gyms.js';
import { itemDef } from '../utils/items.js';

export interface TrackInfo {
  amount?: number;
  species?: string;      // вид побеждённого/пойманного
  types?: string[];      // типы противника
  locId?: string;        // локация события
  itemId?: string;       // предмет (use_item)
  bossId?: string;       // id мини-босса
  streak?: number;       // текущий стрик (для streak_x)
}

/** Все квесты всех NPC одним списком. */
export function allNPCQuests(): Array<any> {
  const out: Array<any> = [];
  for (const npc of Object.values((NPC_DATA as any) || {})) {
    for (const q of ((npc as any).quests || [])) out.push(q);
  }
  return out;
}

/**
 * findQuestHolder — у какого NPC лежит квест (для вкладки «Активные»).
 * Возвращает { npcId, name, location } или null. Чисто по данным.
 */
export function findQuestHolder(questId: string): { npcId: string; name: string; location: string } | null {
  try {
    for (const [npcId, npc] of Object.entries((NPC_DATA as any) || {})) {
      const qs: any[] = (npc as any)?.quests || [];
      if (qs.some((q) => q && q.id === questId)) {
        return {
          npcId: String(npcId),
          name: String((npc as any)?.name || '???'),
          location: String((npc as any)?.location || ''),
        };
      }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * noteLocationVisit — отметить заход в локацию для квестов исследования.
 * Возвращает true если это РЕАЛЬНЫЙ переход (локация сменилась) — тогда
 * вызывающий двигает explore-прогресс. Перерисовка той же локи и рестор
 * при загрузке (currentLocationId уже равен) возвращают false и ничего
 * не считают. visitedLocations пополняется здесь же (идемпотентно).
 */
export function noteLocationVisit(locId: string): boolean {
  try {
    if (!locId || (state as any).currentLocationId === locId) return false;
    const v = (state as any).visitedLocations;
    if (v instanceof Set) v.add(locId);
    else if (Array.isArray(v) && !v.includes(locId)) v.push(locId);
    return true;
  } catch {
    return false;
  }
}

function isActive(q: any): boolean {
  return !!q
    && !state.completedNPCQuests.includes(q.id)
    && q.id in (state.npcQuestProgress || {});
}

function bump(q: any, amount: number): void {
  const cur = state.npcQuestProgress[q.id] || 0;
  state.npcQuestProgress[q.id] = Math.min(q.targetQty, cur + amount);
}

/**
 * trackNPCQuests — продвинуть подходящие активные квесты.
 * Фильтры квеста (filter): { types?, species?, speciesList?, time?, region?, locId?, itemId?, bossId? }.
 *   species — один вид (case-insensitive); speciesList — любой-из списка (case-insensitive).
 *   time — 'day'|'night' для defeat_x/catch_x (сверка с state.isDaytime, день 6–17).
 */
export function trackNPCQuests(type: string, info: TrackInfo = {}): void {
  const amount = info.amount === undefined ? 1 : info.amount;
  for (const q of allNPCQuests()) {
    if (q.type !== type || !isActive(q)) continue;
    const f = q.filter || {};
    if (type === 'defeat_x' || type === 'catch_x') {
      if (f.species && String(info.species || '').toLowerCase() !== String(f.species).toLowerCase()) continue;
      // Любой-из списка: событие засчитывается когда вид есть в speciesList (регистр не важен)
      if (Array.isArray(f.speciesList) && f.speciesList.length > 0) {
        const cur = String(info.species || '').toLowerCase();
        if (!f.speciesList.some((s: string) => String(s).toLowerCase() === cur)) continue;
      }
      // Время суток: готовый флаг state.isDaytime (ставит updateTimeOfDay, день 6–17), новых систем нет
      if (f.time === 'day' || f.time === 'night') {
        const isDay = state.isDaytime !== false;
        if (f.time === 'day' && !isDay) continue;
        if (f.time === 'night' && isDay) continue;
      }
      if (Array.isArray(f.types) && f.types.length > 0) {
        const foe = (info.types || []).map((t) => String(t).toLowerCase());
        if (!f.types.some((t: string) => foe.includes(String(t).toLowerCase()))) continue;
      }
      bump(q, amount);
    } else if (type === 'explore') {
      if (f.region) {
        const locs = (REGIONS as any)[f.region]?.locations || {};
        if (!locs[info.locId || '']) continue;
      }
      if (f.locId && info.locId !== f.locId) continue;
      bump(q, amount);
    } else if (type === 'earn_money') {
      bump(q, amount);
    } else if (type === 'use_item') {
      if (f.itemId && info.itemId !== f.itemId) continue;
      bump(q, amount);
    } else if (type === 'hatch_x') {
      bump(q, amount);
    } else if (type === 'trade_x') {
      bump(q, amount); // обмен завершён (socket trade_execute) — просто +1
    } else if (type === 'boss_win') {
      if (f.bossId && info.bossId !== f.bossId) continue;
      state.npcQuestProgress[q.id] = q.targetQty; // победа одна — сразу готов
    } else if (type === 'streak_x') {
      state.npcQuestProgress[q.id] = Math.min(q.targetQty, info.streak || 0);
    }
  }
}

/**
 * questRewards — полный список предметных наград квеста:
 * основная (rewardItem × rewardQty) + дополнительные (rewardItems[]).
 * Пустые/нулевые записи отбрасываются.
 */
export function questRewards(q: any): Array<{ id: string; qty: number }> {
  const out: Array<{ id: string; qty: number }> = [];
  if (q && q.rewardItem && (q.rewardQty || 0) > 0) out.push({ id: q.rewardItem, qty: q.rewardQty });
  for (const r of q?.rewardItems || []) {
    if (r && r.id && (r.qty || 0) > 0) out.push({ id: r.id, qty: r.qty });
  }
  return out;
}

export interface VerifyResult { ok: boolean; missing: string }

/**
 * verifyQuest — составные условия сдачи (q.verify).
 *   avgLevel: средний эффективный уровень команды ≥ N
 *   maxLevel: хоть один покемон ≥ N
 *   typeSpecies/typeCount: поймано ≥ N видов из списка
 *     (rockSpecies/rockCount — алиас для обратной совместимости)
 *   locs: посещены все из списка (visitedLocations)
 *   region/regionLocs: посещено ≥ N локаций региона (ключ из REGIONS)
 *     (kantoLocs — алиас region='kanto' для обратной совместимости)
 *   evPool: суммарный EV-пул команды ≥ N
 *   dexCount: поймано видов всего (pokedexCaught Set|массив) ≥ N
 *     (абсолютное число; проценты не считаем — нужен только state, без battle/core во избежание цикла)
 */
export function verifyQuest(q: any): VerifyResult {
  const v = q?.verify;
  if (!v) return { ok: true, missing: '' };
  const team: any[] = state.myTeam || [];
  const eff = (m: any) => (m.baseLevel || 0) + (m.candiesEaten || 0);
  if (v.avgLevel) {
    if (team.length === 0) return { ok: false, missing: 'нужна команда' };
    const avg = team.reduce((s, m) => s + eff(m), 0) / team.length;
    if (avg < v.avgLevel) return { ok: false, missing: `средний уровень ${avg.toFixed(1)} < ${v.avgLevel}` };
  }
  if (v.maxLevel) {
    const mx = team.reduce((s, m) => Math.max(s, eff(m)), 0);
    if (mx < v.maxLevel) return { ok: false, missing: `максимум ${mx} < ${v.maxLevel}` };
  }
  const speciesList: string[] | undefined = v.typeSpecies ?? v.rockSpecies;
  if (speciesList) {
    const need = v.typeSpecies ? v.typeCount : v.rockCount;
    const caught = state.pokedexCaught;
    const has = (s: string) => caught instanceof Set ? caught.has(s) : (caught || []).includes(s);
    const n = (speciesList as string[]).filter(has).length;
    if (n < need) {
      if (v.typeSpecies) return { ok: false, missing: `видов ${n}/${v.typeCount}` };
      return { ok: false, missing: `каменных видов ${n}/${v.rockCount}` };
    }
  }
  if (v.locs) {
    const visited: string[] = Array.isArray(state.visitedLocations)
      ? state.visitedLocations
      : [...(state.visitedLocations || [])];
    const missing = (v.locs as string[]).filter((l) => !visited.includes(l));
    if (missing.length) return { ok: false, missing: `не посещено: ${missing.length}` };
  }
  const regionKey: string | undefined = v.region ?? (v.kantoLocs ? 'kanto' : undefined);
  if (regionKey) {
    const need = v.region ? v.regionLocs : v.kantoLocs;
    const locs = Object.keys((REGIONS as any)[regionKey]?.locations || {});
    const visited: string[] = Array.isArray(state.visitedLocations)
      ? state.visitedLocations
      : [...(state.visitedLocations || [])];
    const n = visited.filter((l) => locs.includes(l)).length;
    if (n < need) {
      if (v.region) return { ok: false, missing: `локаций ${v.region} ${n}/${v.regionLocs}` };
      return { ok: false, missing: `локаций Канто ${n}/${v.kantoLocs}` };
    }
  }
  if (v.evPool) {
    const sum = team.reduce((s, m) => s + (m.evPool || 0), 0);
    if (sum < v.evPool) return { ok: false, missing: `EV в пуле ${sum}/${v.evPool}` };
  }
  if (v.dexCount) {
    // Абсолютное число пойманных видов; только state (без battle/core — там импорт quest-track, будет цикл)
    const caught = state.pokedexCaught;
    const n = caught instanceof Set ? caught.size : (caught || []).length;
    if (n < v.dexCount) return { ok: false, missing: `видов в покедексе ${n}/${v.dexCount}` };
  }
  return { ok: true, missing: '' };
}

// ─────────────────────────────────────────────────────────────
// questHowTo — ЧЕЛОВЕЧЕСКОЕ ОБЪЯСНЕНИЕ КВЕСТА (для клиента)
// ─────────────────────────────────────────────────────────────
// Чистая функция: по типу/фильтрам/verify собирает строку «как выполнять».
// Рисуется в карточке квеста у NPC (npcs.ts). Никакого DOM, только данные:
// имена предметов — через itemDef, локаций — через REGIONS, боссов — gymLeaders.
// ─────────────────────────────────────────────────────────────

const TYPE_RU: Record<string, string> = {
  normal: 'обычных', fire: 'огненных', water: 'водных', electric: 'электрических',
  grass: 'травяных', ice: 'ледяных', fighting: 'бойцов', poison: 'ядовитых',
  ground: 'земляных', flying: 'летающих', psychic: 'психических', bug: 'жуков',
  rock: 'каменных', ghost: 'призрачных', dragon: 'драконьих', dark: 'тёмных',
  steel: 'стальных', fairy: 'сказочных', stellar: 'звёздных',
};

const REGION_RU: Record<string, string> = { kanto: 'Канто', johto: 'Джото' };

/** Русское имя локации по id (фолбэк — сам id). Экспортирована для модалки квестов. */
export function locName(id: string): string {
  try {
    for (const r of Object.values((REGIONS as any) || {})) {
      const nm = (r as any)?.locations?.[id]?.name;
      if (nm) return String(nm);
    }
  } catch { /* ignore */ }
  return String(id);
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** «a, b, c + ещё N» — длинные списки режем, счёт показываем. */
function shortList(names: string[], max = 5): string {
  if (names.length <= max) return names.join(', ');
  return names.slice(0, max).join(', ') + ` + ещё ${names.length - max}`;
}

function whoText(f: any): string {
  if (!f) return '';
  if (Array.isArray(f.speciesList) && f.speciesList.length > 0) {
    return `Виды: ${shortList(f.speciesList.map((s: string) => cap(String(s))), 4)}`;
  }
  if (f.species) return `Вид: ${cap(String(f.species))}`;
  if (Array.isArray(f.types) && f.types.length > 0) {
    return `Типы: ${f.types.map((t: string) => TYPE_RU[String(t).toLowerCase()] || String(t)).join(', ')}`;
  }
  return '';
}

function verifyText(v: any): string {
  if (!v) return '';
  const parts: string[] = [];
  if (v.avgLevel) parts.push(`средний уровень команды ${v.avgLevel}+`);
  if (v.maxLevel) parts.push(`один покемон ${v.maxLevel}+`);
  const sp = v.typeSpecies ?? v.rockSpecies;
  if (sp) parts.push(`поймано видов: ${v.typeCount ?? v.rockCount} (см. декс)`);
  if (v.locs) parts.push(`маршрут: ${shortList((v.locs as string[]).map(locName), 6)}`);
  if (v.region || v.kantoLocs) {
    const r = v.region ? (REGION_RU[v.region] || v.region) : 'Канто';
    parts.push(`локаций ${r}: ${v.regionLocs ?? v.kantoLocs} (повторы считаются)`);
  }
  if (v.evPool) parts.push(`EV в пуле команды: ${v.evPool}`);
  if (v.dexCount) parts.push(`видов в покедексе: ${v.dexCount}`);
  return parts.length ? `Условия сдачи: ${parts.join('; ')}.` : '';
}

/**
 * questHowTo — одна-две строки «как выполнять» для карточки квеста.
 * Пустая строка = объяснять нечего (не показывать).
 */
export function questHowTo(q: any): string {
  if (!q) return '';
  const f = q.filter || {};
  const how: string[] = [];
  switch (q.type) {
    case 'defeat_x': {
      let s = 'Побеждай диких покемонов в бою';
      const who = whoText(f);
      if (who) s += ` — ${who.charAt(0).toLowerCase() + who.slice(1)}`;
      how.push(s + '.');
      break;
    }
    case 'catch_x': {
      let s = 'Лови покеболами (ослабь сначала — шанс выше)';
      const who = f.species
        ? `Нужен: ${cap(String(f.species))}`
        : (Array.isArray(f.speciesList) && f.speciesList.length > 0
          ? `Подойдёт любой: ${shortList(f.speciesList.map((x: string) => cap(String(x))), 4)}`
          : whoText(f));
      if (who) s += `. ${who}`;
      if (f.time === 'night') s += '. Только ночью (18:00–6:00)';
      if (f.time === 'day') s += '. Только днём (6:00–18:00)';
      how.push(s + '.');
      break;
    }
    case 'earn_money':
      how.push('Зарабатывай суммарно: бои, продажа, награды. Тратить можно — считается заработок.');
      break;
    case 'explore': {
      const r = f.region ? (REGION_RU[f.region] || f.region) : '';
      how.push(r
        ? `Заглядывай в локации региона ${r} (повторные визиты считаются).`
        : 'Посещай новые локации (повторные визиты считаются).');
      break;
    }
    case 'use_item': {
      const nm = f.itemId ? itemDef(f.itemId).nameRu : 'предметы';
      how.push(`Трать «${nm}» по назначению (из рюкзака или в бою). Продажа и выброс не считаются.`);
      break;
    }
    case 'hatch_x':
      how.push('Яйца — в боксах разведения при покецентре. Вылупляется кнопкой по готовности.');
      break;
    case 'boss_win': {
      const boss = (gymLeaders as any)?.[f.bossId];
      const nm = boss?.name || 'именного противника';
      how.push(`Жми кнопку боя у NPC (${nm}). Реванши бесконечные, засчитывается победа.`);
      break;
    }
    case 'streak_x':
      how.push('Побеждай подряд: поражение или побег обнуляют серию.');
      break;
    case 'collect_items': {
      const nm = q.targetItem ? itemDef(q.targetItem).nameRu : 'предметы';
      how.push(`Добудь «${nm}»: выдаёт NPC по кнопке или падает с диких (8%), пока квест взят.`);
      break;
    }
    case 'trade_x':
      how.push('Обменивайся с игроками через трейд-центр (обмен должен завершиться).');
      break;
    case 'special':
      how.push('Составной квест — выполни условия ниже, потом жми «Сдать».');
      break;
    default:
      break;
  }
  const ver = verifyText(q.verify);
  if (ver) how.push(ver);
  return how.join(' ');
}
