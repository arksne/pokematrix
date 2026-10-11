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
export const FIXED_DAMAGE: Readonly<Record<string, 'level' | 'half-hp' | 'equalize' | 'counter' | number>> = {
  'seismic-toss': 'level',
  'night-shade': 'level',
  'sonic-boom': 20,
  'dragon-rage': 40,
  'super-fang': 'half-hp',
  'endeavor': 'equalize',
  // Контратаки: урон считается от входящего (см. counterDamage).
  'counter': 'counter',
  'mirror-coat': 'counter',
  'metal-burst': 'counter',
};

export interface FixedDamageCtx {
  attackerLevel?: number;
  defenderCurrentHp?: number;
  attackerCurrentHp?: number;
  /** Урон, полученный атакующим с прошлого хода (для counter/mirror-coat/metal-burst). */
  lastTakenDmg?: number;
  /** Категория входящего урона: 'physical' | 'special'. */
  lastTakenCat?: string;
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
  if (kind === 'counter') {
    return counterDamage(move.name, ctx.lastTakenDmg, ctx.lastTakenCat);
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

// ── Контратаки: counter / mirror-coat / metal-burst (L2-остаток) ──
// Канон: возвращают часть урона, полученного с ПРОШЛОГО хода.
// counter — только физический, mirror-coat — только специальный,
// metal-burst — любой, но ×1.5. Не было входящего урона (или не та
// категория) — провал (null), а не «0 урона».
export const COUNTER_MULT: Record<string, { mult: number; cat: 'physical' | 'special' | 'any' }> = {
  'counter': { mult: 2, cat: 'physical' },
  'mirror-coat': { mult: 2, cat: 'special' },
  'metal-burst': { mult: 1.5, cat: 'any' },
};

/** Урон контратаки или null (нечем ответить). */
export function counterDamage(
  moveName: unknown,
  lastTakenDmg: unknown,
  lastTakenCat: unknown,
): number | null {
  const spec = COUNTER_MULT[normMoveName(moveName)];
  if (!spec) return null;
  const dmg = Math.floor(Number(lastTakenDmg) || 0);
  if (dmg <= 0) return null;
  const cat = String(lastTakenCat || '');
  if (spec.cat !== 'any' && cat !== spec.cat) return null;
  return Math.max(1, Math.floor(dmg * spec.mult));
}

// ── Урон от веса: low-kick / grass-knot (L2-остаток) ──────────
// Канон по весу цели (кг): ≤10 → 20, ≤25 → 40, ≤50 → 60,
// ≤100 → 80, ≤200 → 100, тяжелее → 120.
export function weightPowerKg(weightKg: unknown): number {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return 40;
  if (w <= 10) return 20;
  if (w <= 25) return 40;
  if (w <= 50) return 60;
  if (w <= 100) return 80;
  if (w <= 200) return 100;
  return 120;
}

// ── Урон от веса: heavy-slam / heat-crash (L2-остаток) ────────
// Канон по отношению своего веса к весу цели: ≤0.2 → 120, ≤0.25 → 100,
// ≤1/3 → 80, ≤0.5 → 60, иначе 40.
export function heavySlamPower(userKg: unknown, targetKg: unknown): number {
  const u = Number(userKg);
  const t = Number(targetKg);
  if (!Number.isFinite(u) || !Number.isFinite(t) || u <= 0 || t <= 0) return 40;
  const r = u / t;
  if (r <= 0.2) return 120;
  if (r <= 0.25) return 100;
  if (r <= 1 / 3) return 80;
  if (r <= 0.5) return 60;
  return 40;
}

/** Вес PokeAPI (гектограммы) → кг. */
export function pokeWeightKg(weightHg: unknown): number {
  const w = Number(weightHg);
  return Number.isFinite(w) && w > 0 ? w / 10 : 0;
}

// ── Урон от скорости: gyro-ball / electro-ball (L2-остаток) ───
/** Gyro Ball: min(150, floor(25 × скоростьЦели / скоростьСебя) + 1). */
export function gyroBallPower(userSpe: unknown, targetSpe: unknown): number {
  const u = Math.floor(Number(userSpe) || 0);
  const t = Math.floor(Number(targetSpe) || 0);
  if (u <= 0 || t < 0) return 1;
  return Math.min(150, Math.floor((25 * t) / u) + 1);
}

/** Electro Ball по отношению своей скорости к скорости цели. */
export function electroBallPower(userSpe: unknown, targetSpe: unknown): number {
  const u = Math.floor(Number(userSpe) || 0);
  const t = Math.floor(Number(targetSpe) || 0);
  if (u <= 0 || t <= 0) return 40;
  const r = u / t;
  if (r >= 4) return 150;
  if (r >= 3) return 120;
  if (r >= 2) return 80;
  if (r >= 1) return 60;
  return 40;
}

// ── Beat Up (L2-остаток) ──────────────────────────────────────
// Канон: бьёт каждый здоровый член команды без статуса; сила удара —
// floor(базоваяАтака / 10) + 5 по виду бьющего.
export function beatUpHits(party: any[]): number {
  if (!Array.isArray(party)) return 0;
  return party.filter((m) => m && (m.currentHp ?? 1) > 0 && !m.status).length;
}

/** Сила одного удара Beat Up по базовой атаке вида. */
export function beatUpPower(baseAttack: unknown): number {
  const a = Math.floor(Number(baseAttack) || 0);
  return Math.max(1, Math.floor(a / 10) + 5);
}

// ── Полунеуязвимость: fly / dig / dive / bounce / shadow-force (L2-остаток)
// Ход 1 — спрятался (по нему не попасть), ход 2 — удар. Отдельная механика,
// не «charge»: заряд бьёт сразу на выпуске без пряток.
export const SEMI_INVULN: ReadonlySet<string> = new Set([
  'fly', 'dig', 'dive', 'bounce', 'shadow-force', 'sky-drop',
]);

/** Прячется ли атака на первом ходу. */
export function isSemiInvuln(move: any): boolean {
  if (!move) return false;
  return SEMI_INVULN.has(normMoveName(move.name));
}

/** Какие атаки достают спрятавшегося (канон): */
const HITS_FLY: ReadonlySet<string> = new Set(['thunder', 'hurricane', 'smack-down', 'thousand-arrows']);
const HITS_DIG: ReadonlySet<string> = new Set(['earthquake', 'magnitude']);
const HITS_DIVE: ReadonlySet<string> = new Set(['surf', 'whirlpool']);

/** Глагол пряток для лога (что делает покемон на первом ходу). */
export function hideVerb(moveName: unknown): string {
  switch (normMoveName(moveName)) {
    case 'fly': return 'взлетает в небо!';
    case 'dig': return 'зарывается под землю!';
    case 'dive': return 'ныряет глубоко!';
    case 'bounce': return 'подпрыгивает высоко!';
    case 'shadow-force': return 'растворяется в тени!';
    case 'sky-drop': return 'хватает противника и взмывает ввысь!';
    default: return 'прячется!';
  }
}

/** Достаёт ли атака цель, спрятавшуюся в hidden ('fly' | 'dig' | 'dive' | ...). */
export function canHitHidden(moveName: unknown, hiddenIn: unknown): boolean {
  const h = String(hiddenIn || '');
  if (!h) return true;
  const m = normMoveName(moveName);
  if (h === 'fly' || h === 'bounce') return HITS_FLY.has(m);
  if (h === 'dig') return HITS_DIG.has(m);
  if (h === 'dive') return HITS_DIVE.has(m);
  // shadow-force / sky-drop: недосягаемы ничем обычным
  return false;
}

// ── Перезарядка: hyper-beam и семья (L2-остаток) ───────────────
// После удара — пропуск следующего хода. Промах (0 ударов) — без перезарядки.
export const RECHARGE_MOVES: ReadonlySet<string> = new Set([
  'hyper-beam', 'giga-impact', 'rock-wrecker', 'roar-of-time',
  'blast-burn', 'frenzy-plant', 'hydro-cannon',
  'meteor-assault', 'eternabeam',
]);

/** Требует ли атака перезарядки после удара. */
export function needsRecharge(move: any): boolean {
  if (!move) return false;
  return RECHARGE_MOVES.has(normMoveName(move.name));
}

// ── Heal Pulse (L2-остаток) ────────────────────────────────────
// Канон: лечит ЦЕЛЬ на 50% максимума (в диком бою — дикого же).
// Выглядит как «лечит врага», поэтому core обязан писать внятный лог.
export function healPulseAmount(targetMaxHp: unknown): number {
  const m = Math.floor(Number(targetMaxHp) || 0);
  return m > 0 ? Math.floor(m / 2) : 0;
}

// ── Bide (L2-остаток) ──────────────────────────────────────────
// Два хода терпит (урон копится), на третий бьёт удвоенным накопленным.
export const BIDE_TURNS = 2;

/** Урон выпуска Bide по накопленному или null (терпеть было нечего). */
export function bideRelease(storedDmg: unknown): number | null {
  const d = Math.floor(Number(storedDmg) || 0);
  return d > 0 ? d * 2 : null;
}

// ── Эффективная сила вес/скорость-атак (L2-остаток, для core.ts) ──
// low-kick / grass-knot / gyro-ball / electro-ball / heavy-slam / heat-crash
// и beat-up в данных идут с power=null — без этого они падали в
// «Но ничего не произошло...». Возвращает атаку с подставленной силой
// (копию, кэш moves_db не трогаем) или ту же атаку, если обычная.
/** Базовая атака вида (дикий — .stats, свой — .apiData.stats). */
export function baseAttackOf(mon: any, isWild: boolean): number {
  const arr = isWild ? mon?.stats : mon?.apiData?.stats;
  const o = Array.isArray(arr) ? arr.find((s: any) => s?.stat?.name === 'attack') : undefined;
  const v = Math.floor(Number(o?.base_stat) || 0);
  return v > 0 ? v : 50;
}

export function effectivePowerMove(
  move: any, attacker: any, defender: any,
  attackerSpe: number, defenderSpe: number, isWildAttacker: boolean,
): any {
  if (!move) return move;
  const slug = normMoveName(move.name);
  let p: number | null = null;
  if (slug === 'grass-knot' || slug === 'low-kick') {
    p = weightPowerKg(pokeWeightKg(defender?.apiData?.weight ?? defender?.weight));
  } else if (slug === 'heavy-slam' || slug === 'heat-crash') {
    p = heavySlamPower(
      pokeWeightKg(attacker?.apiData?.weight ?? attacker?.weight),
      pokeWeightKg(defender?.apiData?.weight ?? defender?.weight),
    );
  } else if (slug === 'gyro-ball') {
    p = gyroBallPower(attackerSpe, defenderSpe);
  } else if (slug === 'electro-ball') {
    p = electroBallPower(attackerSpe, defenderSpe);
  } else if (slug === 'beat-up') {
    // Сила ударов Beat Up считается отдельно по каждому бьющему
    // (см. beatUpPower в core.ts); здесь — заглушка, чтобы атака пошла
    // в ветку урона, а не в «ничего не произошло».
    p = 10;
  }
  if (p == null) return move;
  return { ...move, power: p };
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
