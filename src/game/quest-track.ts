// ─────────────────────────────────────────────────────────────
// quest-track.ts — ТРЕКЕР NPC-КВЕСТОВ (гринд-пачка Пьютера)
// ─────────────────────────────────────────────────────────────
// Проблема: прогресс обычных NPC-квестов (defeat/catch/explore/earn)
// никто не двигал — работали только collect_items и туториал.
// Этот модуль — единая точка: trackNPCQuests вызывается из игровых
// событий, verifyQuest проверяет составные условия при сдаче.
//
// Типы прогресса:
//   defeat_x / catch_x / earn_money / explore / use_item / hatch_x —
//     инкремент (+amount, фильтры);
//   boss_win — сразу в цель (победа над именным противником);
//   streak_x — прогресс = текущий стрик (не сумма!);
//   verify — составные условия (уровень, коллекция, локации, EV),
//     проверяются при сдаче (и при взятии — сразу готов если выполнено).
//
// ЗАВИСИМОСТИ (листовые, циклов нет):
//   data/npc.js — NPC_DATA, data/regions.js — регионы для фильтров.
// ─────────────────────────────────────────────────────────────

import { NPC_DATA } from '../data/npc.js';
import { REGIONS } from '../data/regions.js';
import { state } from '../game/state.js';

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
 * Фильтры квеста (filter): { types?, species?, region?, locId?, itemId?, bossId? }.
 */
export function trackNPCQuests(type: string, info: TrackInfo = {}): void {
  const amount = info.amount === undefined ? 1 : info.amount;
  for (const q of allNPCQuests()) {
    if (q.type !== type || !isActive(q)) continue;
    const f = q.filter || {};
    if (type === 'defeat_x' || type === 'catch_x') {
      if (f.species && String(info.species || '').toLowerCase() !== String(f.species).toLowerCase()) continue;
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
 *   rockSpecies: поймано ≥ N видов из списка
 *   locs: посещены все из списка (visitedLocations)
 *   kantoLocs: посещено ≥ N локаций Канто
 *   evPool: суммарный EV-пул команды ≥ N
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
  if (v.rockSpecies) {
    const caught = state.pokedexCaught;
    const has = (s: string) => caught instanceof Set ? caught.has(s) : (caught || []).includes(s);
    const n = (v.rockSpecies as string[]).filter(has).length;
    if (n < v.rockCount) return { ok: false, missing: `каменных видов ${n}/${v.rockCount}` };
  }
  if (v.locs) {
    const visited: string[] = Array.isArray(state.visitedLocations)
      ? state.visitedLocations
      : [...(state.visitedLocations || [])];
    const missing = (v.locs as string[]).filter((l) => !visited.includes(l));
    if (missing.length) return { ok: false, missing: `не посещено: ${missing.length}` };
  }
  if (v.kantoLocs) {
    const kanto = Object.keys((REGIONS as any).kanto?.locations || {});
    const visited: string[] = Array.isArray(state.visitedLocations)
      ? state.visitedLocations
      : [...(state.visitedLocations || [])];
    const n = visited.filter((l) => kanto.includes(l)).length;
    if (n < v.kantoLocs) return { ok: false, missing: `локаций Канто ${n}/${v.kantoLocs}` };
  }
  if (v.evPool) {
    const sum = team.reduce((s, m) => s + (m.evPool || 0), 0);
    if (sum < v.evPool) return { ok: false, missing: `EV в пуле ${sum}/${v.evPool}` };
  }
  return { ok: true, missing: '' };
}
