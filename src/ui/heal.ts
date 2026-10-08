// ─────────────────────────────────────────────────────────────
// heal.ts — ПЛАТНОЕ ЛЕЧЕНИЕ В ПОКЕ-ЦЕНТРЕ (блок M-24)
// ─────────────────────────────────────────────────────────────
// Лечение всей команды у сестры Джой стоит фикс HEAL_PRICE.
// Без денег — отказ (тост), команда не лечится.
// Пути лечения:
//   location.ts healTeam (кнопка центра) — платно,
//   npcs.ts joy_pokecenter (медсестра Джой) — платно,
//   admin.ts admin-test-heal — БЕСПЛАТНО (админка, не трогаем).
// Без DOM — тестируемо в node (heal-price.test.ts).
//
// ЗАВИСИМОСТИ:
//   state — credit (state.inventory.credit)
//   store — события money:changed / inventory:changed
// ─────────────────────────────────────────────────────────────

import { state } from '../game/state.js';
import { store } from '../game/store.js';
import { calculateStat } from '../battle/stats.js';

// ── HEAL_PRICE: цена полного лечения команды ──
// potion стоит 300; полное восстановление до 6 покемонов (HP + статусы + PP)
// = potion × 5 = 1500. Дешевле шести fullRestore (18 000), но не халява.
export const HEAL_PRICE = 1500;

// Пересчёт maxHp по ЕДИНОЙ формуле из battle/stats.ts.
// Раньше здесь стояла своя копия `0.01 * (2*baseHp + iv + ...)`, где база
// бралась из `apiData.stats[0]` — то есть из ПЕРВОГО стата в массиве, а не из
// hp. У покемонов, у которых PokeAPI отдаёт статы в другом порядке, лечение
// выставляло неверный максимум HP (и «лечило» полностью здоровую команду).
// Теперь единственный источник истины — calculateStat, как в бою и профиле.
function calcMaxHp(mon: any): number {
  return calculateStat(mon, 'hp', { ignoreBattleOnly: true });
}

/** Нуждается ли хоть один покемон в лечении (HP/статус/PP). */
export function teamNeedsHeal(team: any[]): boolean {
  if (!team || team.length === 0) return false;
  return team.some((mon) => {
    if (!mon || !mon.apiData) return false;
    if ((mon.currentHp ?? 0) < calcMaxHp(mon)) return true;
    if (mon.status) return true;
    if ((mon.movesPP || []).some((pp: any) => pp && pp.current < pp.max)) return true;
    return false;
  });
}

/**
 * Вылечить всю команду: HP в макс, снять статусы/сон/стадии, восстановить PP.
 * Возвращает true, если хоть что-то реально изменилось.
 */
export function applyTeamHeal(team: any[]): boolean {
  let healed = false;
  (team || []).forEach((mon) => {
    if (!mon || !mon.apiData) return;
    const newMaxHp = calcMaxHp(mon);
    if (mon.currentHp < newMaxHp || mon.status || mon.maxHp !== newMaxHp) healed = true;
    mon.maxHp = newMaxHp;
    mon.currentHp = newMaxHp;
    mon.status = null;
    mon.sleepTurns = 0;
    mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (mon.movesPP) mon.movesPP.forEach((pp: any) => {
      if (pp && pp.current < pp.max) { pp.current = pp.max; healed = true; }
    });
  });
  return healed;
}

/** Хватает ли кредитов на лечение. */
export function canAffordHeal(): boolean {
  return (state.inventory?.credit || 0) >= HEAL_PRICE;
}

/**
 * Списать плату за лечение. true — списано, false — не хватает денег
 * (ничего не трогаем, лечить нельзя).
 */
export function tryChargeHeal(): boolean {
  const cur = state.inventory?.credit || 0;
  if (cur < HEAL_PRICE) return false;
  state.inventory.credit = cur - HEAL_PRICE;
  store.emit('money:changed');
  store.emit('inventory:changed', 'credit', -HEAL_PRICE);
  return true;
}
