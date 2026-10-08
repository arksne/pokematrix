// ─────────────────────────────────────────────────────────────
// special-moves.ts — ЧИСТЫЕ ХЕЛПЕРЫ ОСОБЫХ МЕХАНИК АТАК (L2/L5)
// ─────────────────────────────────────────────────────────────
// Аудит moves_db.json (741 атака) показал: часть особых механик движок
// читает из meta напрямую (priority, drain, healing, crit_rate,
// flinch_chance, min/max_hits — работают), а часть НЕ МОЖЕТ сработать:
//   - OHKO: движок ждал move.meta.ohko (boolean), в данных его нет —
//     метка лежит в meta.category.name === 'ohko' (4 атаки).
//   - Фикс. урон: движок ждал move.meta.damage, в данных его нет —
//     такие атаки опознаются только по имени (seismic-toss и др.).
//   - Чардж: движок ждал meta.category.name === 'charge', в данных такой
//     категории нет вообще — двухходовые атаки опознаются по имени.
//
// Здесь — только чистые функции (без DOM/S), обе стороны боя (игрок+враг)
// используют их одинаково через core.ts и logic.ts.
// ─────────────────────────────────────────────────────────────

/** Нормализовать имя атаки к слагу вида 'false-swipe'. */
export function normMoveName(name: unknown): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Двухходовые атаки (заряд → выпуск) ───────────────────────
// PokeAPI/meta не помечают чардж отдельной категорией, поэтому список
// конечный, как SOUND_MOVES в logic.ts. Только «зарядил → ударил»:
// fly/dig/dive/bounce (полунеуязвимость) и hyper-beam (перезарядка)
// сознательно НЕ входят — это отдельные механики, не «charge».
export const CHARGE_MOVES: ReadonlySet<string> = new Set([
  'solar-beam',
  'solar-blade',
  'razor-wind',
  'skull-bash',
  'sky-attack',
  'meteor-beam',
]);

/** Требует ли атака зарядки (ход 1 — заряд, ход 2 — выпуск). */
export function isChargeMove(move: any): boolean {
  if (!move) return false;
  if (move.meta?.category?.name === 'charge') return true;
  return CHARGE_MOVES.has(normMoveName(move.name));
}

// ── OHKO (мгновенное убийство) ───────────────────────────────
/** OHKO-атака: horn-drill, fissure, guillotine, sheer-cold. */
export function isOhkoMove(move: any): boolean {
  if (!move) return false;
  if (move.meta?.ohko === true) return true;
  return move.meta?.category?.name === 'ohko';
}

// ── Фиксированный урон ───────────────────────────────────────
// В moves_db.json поля meta.damage нет, поэтому таблица по именам.
// 'level' — урон равен уровню бьющего (seismic-toss, night-shade).
// 'half-hp' — половина текущего HP цели (super-fang).
// 'equalize' — HP цели минус HP бьющего (endeavor; null если не больше).
// Число — фиксированный урон (sonic-boom 20, dragon-rage 40 — их нет в
// базе лиги, но есть в PokeAPI-фолбэке, поэтому включены).
export const FIXED_DAMAGE: Readonly<Record<string, 'level' | 'half-hp' | 'equalize' | number>> = {
  'seismic-toss': 'level',
  'night-shade': 'level',
  'sonic-boom': 20,
  'dragon-rage': 40,
  'super-fang': 'half-hp',
  'endeavor': 'equalize',
};

export interface FixedDamageCtx {
  attackerLevel?: number;
  defenderCurrentHp?: number;
  attackerCurrentHp?: number;
}

/** Есть ли у атаки фиксированный урон (поле meta.damage или имя в таблице). */
export function hasFixedDamage(move: any): boolean {
  if (!move) return false;
  const m = move.meta?.damage;
  if (m !== undefined && m !== null) return true;
  return normMoveName(move.name) in FIXED_DAMAGE;
}

/**
 * Фиксированный урон атаки или null (обычная формула).
 * Возвращает null и когда атака не фиксированная, и когда она не может
 * сработать (endeavor в ничью/минус, неизвестный уровень).
 */
export function getFixedDamage(move: any, ctx: FixedDamageCtx = {}): number | null {
  if (!move) return null;
  const m = move.meta?.damage;
  if (m !== undefined && m !== null) return Math.max(1, Math.floor(Number(m) || 0));
  const kind = FIXED_DAMAGE[normMoveName(move.name)];
  if (kind === undefined) return null;
  if (typeof kind === 'number') return Math.max(1, Math.floor(kind));
  if (kind === 'level') {
    const lvl = Math.floor(Number(ctx.attackerLevel) || 0);
    return lvl > 0 ? lvl : null;
  }
  if (kind === 'half-hp') {
    const hp = Math.floor(Number(ctx.defenderCurrentHp) || 0);
    return hp > 0 ? Math.max(1, Math.floor(hp / 2)) : null;
  }
  // equalize (endeavor): бьёт только «в плюс», иначе провал.
  const def = Math.floor(Number(ctx.defenderCurrentHp) || 0);
  const atk = Math.floor(Number(ctx.attackerCurrentHp) || 0);
  return def > atk ? def - atk : null;
}

/**
 * Наносит ли атака урон (для выбора ветки «урон vs статус»).
 * power-null атаки с фикс. уроном или OHKO — дамажащие, остальные
 * power-null (growl, swords-dance, counter, bide...) — нет.
 */
export function moveDealsDamage(move: any): boolean {
  if (!move) return false;
  if (move.power) return true;
  if (isOhkoMove(move)) return true;
  return hasFixedDamage(move);
}

// ── Мультихиты ───────────────────────────────────────────────
// Распределение канона: 2 и 3 удара — по 3/8, 4 и 5 — по 1/8.
// rand инжектится для детерминированных тестов.
export function getMultiHitCount(move: any, rand: () => number = Math.random): number {
  const minH = move?.meta?.min_hits;
  const maxH = move?.meta?.max_hits;
  if (!minH || !maxH || minH < 2 || maxH < minH) return 1;
  if (minH === maxH) return minH;
  const r = rand();
  if (r < 3 / 8) return 2;
  if (r < 6 / 8) return 3;
  if (r < 7 / 8) return 4;
  return 5;
}

// ── Дрэйн / отдача / лечение ─────────────────────────────────
/** Лечение от дрэйна: % нанесённого урона, Big Root ×1.3. */
export function calcDrainHeal(hitDmg: number, drainPct: number, bigRoot = false): number {
  let heal = Math.floor(hitDmg * (drainPct / 100));
  if (bigRoot) heal = Math.floor(heal * 1.3);
  return heal;
}

/** Урон отдачи: % нанесённого урона, минимум 1. */
export function calcRecoilDamage(hitDmg: number, drainPct: number): number {
  return Math.max(1, Math.floor(hitDmg * (Math.abs(drainPct) / 100)));
}

/** Лечение статус-атакой: % максимального HP. */
export function calcHealAmount(maxHp: number, healPct: number): number {
  return Math.floor(maxHp * (healPct / 100));
}

/**
 * Цена HP (отрицательное healing, напр. clangorous-soul −33):
 * % максимального HP, минимум 1. В ноль не уводит — добить себя ценой
 * нельзя (как тик Семени Ужаса в core.ts).
 */
export function calcHpCost(maxHp: number, costPct: number): number {
  return Math.max(1, Math.floor(maxHp * (Math.abs(costPct) / 100)));
}

/** Шанс вторички с учётом Serene Grace (×2), потолок 100. */
export function effectiveSecondaryChance(baseChance: number | null | undefined, sereneGraceMult = 1): number {
  return Math.min(100, (baseChance ?? 0) * sereneGraceMult);
}

// ── Порядок хода ─────────────────────────────────────────────
// Чистое ядро playerMovesFirst из core.ts: приоритет важнее скорости,
// при равенстве всего — монетка. Абилки/статы считает core, сюда
// приходят готовые числа — поэтому функция тестируема без DOM/S.
export function decideMoveOrder(
  pPrio: number, pSpe: number, ePrio: number, eSpe: number,
  coin: () => number = Math.random,
): 'player' | 'enemy' {
  if (pPrio !== ePrio) return pPrio > ePrio ? 'player' : 'enemy';
  if (pSpe === eSpe) return coin() < 0.5 ? 'player' : 'enemy';
  return pSpe > eSpe ? 'player' : 'enemy';
}
