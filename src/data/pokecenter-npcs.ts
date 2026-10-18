// ─────────────────────────────────────────────────────────────
// ГАРАНТИЯ: разведение доступно в КАЖДОМ покецентре
// ─────────────────────────────────────────────────────────────
// Разведение вешается кнопкой в диалоге NPC, значит в покецентре должен быть
// хоть какой-то NPC. Часть покецентов (Паллет, Нью-Барк, Лавандер, одиночные
// острова) остались вообще без NPC — там разведения не было.
//
// Список локаций НЕ выдумываем, а берём из REGIONS (источник истины) и
// досоздаём дежурную медсестру только там, где NPC ещё нет. Идемпотентно,
// без квестов: задача — точка входа к ПК и боксам разведения.
// ─────────────────────────────────────────────────────────────

import { REGIONS } from './regions.js';
import { NPC_DATA } from './npc.js';

/**
 * Все локации-покецентры по данным карты.
 * REGIONS вложен в три уровня: { kanto: { name, color, locations: {...} } }.
 * Обход верхних уровней даёт либо 2 ключа (регионы), либо 6 (name/color/
 * locations) — покецентры лежат только в locations.
 */
export function pokecenterLocations(): string[] {
  const out: string[] = [];
  for (const region of Object.values(REGIONS) as any[]) {
    for (const id of Object.keys(region?.locations || {})) {
      if (id.endsWith('_pokecenter')) out.push(id);
    }
  }
  return out;
}

/**
 * Для каждого покецентра без NPC заводим дежурную медсестру.
 * Возвращает число добавленных NPC (для тестов и логов).
 */
export function ensurePokecenterNpcs(): number {
  let added = 0;
  for (const loc of pokecenterLocations()) {
    const hasNpc = Object.values(NPC_DATA).some((n: any) => n && n.location === loc);
    if (hasNpc) continue;
    const id = `${loc}_nurse`;
    (NPC_DATA as any)[id] = {
      id,
      name: 'Дежурная медсестра',
      sprite: '👩‍⚕️',
      location: loc,
      dialog: {
        greet: 'Здравствуйте! Покемоны восстановлены, боксы разведения свободны.',
        default: 'Здесь лечат покемонов, а ещё здесь ПК и боксы разведения.',
        quest_offer: '',
        quest_progress: '',
        quest_complete: '',
        quest_incomplete: '',
      },
      quests: [],
    };
    added++;
  }
  return added;
}

ensurePokecenterNpcs();