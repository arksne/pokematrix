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
export const FIXED_DAMAGE: Readonly<Record<string, 'level' | 'half-hp' | 'equalize' | 'counter' | 'hp120' | 'flail' | 'gambit' | 'spitup' | number>> = {
  'seismic-toss': 'level',
  'night-shade': 'level',
  'sonic-boom': 20,
  'dragon-rage': 40,
  'super-fang': 'half-hp',
  'natures-madness': 'half-hp',
  'ruination': 'half-hp',
  'endeavor': 'equalize',
  // Контратаки: урон считается от входящего (см. counterDamage).
  'counter': 'counter',
  'mirror-coat': 'counter',
  'metal-burst': 'counter',
  'comeuppance': 'counter',
  // Сила от HP: crush-grip/wring-out (цель), flail/reversal (сам).
  'crush-grip': 'hp120',
  'wring-out': 'hp120',
  'flail': 'flail',
  'reversal': 'flail',
  // Final Gambit: урон = своё HP (сам падает — core делает отдельно).
  'final-gambit': 'gambit',
  // Spit Up: 100 × заряды stockpile (0 — провал).
  'spit-up': 'spitup',
};

export interface FixedDamageCtx {
  attackerLevel?: number;
  defenderCurrentHp?: number;
  defenderMaxHp?: number;
  attackerCurrentHp?: number;
  attackerMaxHp?: number;
  /** Заряды stockpile атакующего (для spit-up). */
  stock?: number;
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
  if (kind === 'hp120') {
    const cur = Math.floor(Number(ctx.defenderCurrentHp) || 0);
    const max = Math.floor(Number(ctx.defenderMaxHp) || 0);
    if (max <= 0 || cur <= 0) return 1;
    return Math.max(1, Math.floor((120 * cur) / max));
  }
  if (kind === 'flail') {
    return flailPower(ctx.attackerCurrentHp, ctx.attackerMaxHp);
  }
  if (kind === 'gambit') {
    return Math.max(0, Math.floor(Number(ctx.attackerCurrentHp) || 0)) || null;
  }
  if (kind === 'spitup') {
    return spitUpPower(ctx.stock);
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
  // Comeuppance: точный канон движку недоступен из данных (power null,
  // meta пустое) — задокументированное упрощение: как metal-burst.
  'comeuppance': { mult: 1.5, cat: 'any' },
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
  // shadow-force / 'sky-drop': недосягаемы ничем обычным
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

// ── Переменная сила: crush-grip / wring-out (проход-741) ─────
// Канон: 120 × текущееHP / максHP цели (полная — 120, на исходе — 1).
export function crushGripPower(targetCur: unknown, targetMax: unknown): number {
  const cur = Math.floor(Number(targetCur) || 0);
  const max = Math.floor(Number(targetMax) || 0);
  if (max <= 0 || cur <= 0) return 1;
  return Math.max(1, Math.floor((120 * cur) / max));
}

// ── Переменная сила: flail / reversal (проход-741) ────────────
// Канон по доле своего HP: ≥70% → 20, ≥35% → 40, ≥20% → 80,
// ≥10% → 100, ≥5% → 150, иначе 200.
export function flailPower(userCur: unknown, userMax: unknown): number {
  const cur = Math.floor(Number(userCur) || 0);
  const max = Math.floor(Number(userMax) || 0);
  if (max <= 0) return 20;
  const frac = cur / max;
  if (frac >= 0.7) return 20;
  if (frac >= 0.35) return 40;
  if (frac >= 0.2) return 80;
  if (frac >= 0.1) return 100;
  if (frac >= 0.05) return 150;
  return 200;
}

// ── Final Gambit (проход-741) ─────────────────────────────────
// Урон = текущее HP применившего, сам падает в обморок.
export function finalGambitDmg(userCurHp: unknown): number {
  return Math.max(0, Math.floor(Number(userCurHp) || 0));
}

// ── Fling (проход-741) ────────────────────────────────────────
// Сила — по предмету в руках (предмет сгорает, core снимает heldItem).
// Компактная таблица канона для наших предметов + дефолт 30.
const FLING_POWER: Record<string, number> = {
  'iron-ball': 130, 'hard-stone': 100, 'light-ball': 30,
  'smoke-ball': 30, 'flame-orb': 30, 'toxic-orb': 30,
  'kings-rock': 80, 'razor-fang': 80, 'razor-claw': 80,
  stick: 60, 'thick-club': 60, 'lucky-punch': 40, 'metal-powder': 10, 'quick-powder': 10,
};

/** Сила Fling по id предмета (ягоды — 10, мячи — 30, иначе таблица/дефолт). */
export function flingPower(itemId: unknown, category?: unknown): number {
  const id = String(itemId || '');
  if (FLING_POWER[id] !== undefined) return FLING_POWER[id];
  if (String(category || '') === 'berries') return 10;
  if (/(^|-)ball$/.test(id) || String(category || '') === 'balls') return 30;
  return 30;
}

// ── Natural Gift (проход-741) ─────────────────────────────────
// Съедает ягоду: сила 80, тип — по ягоде (карта основных; иначе normal).
// Упрощение задокументировано: полный чарт на 48 ягод в движке не нужен,
// тип влияет только на STAB/эффективность одного удара.
const GIFT_TYPE: Record<string, string> = {
  'cheri-berry': 'fire', 'chesto-berry': 'water', 'pecha-berry': 'electric',
  'rawst-berry': 'grass', 'aspear-berry': 'ice', 'leppa-berry': 'fighting',
  'oran-berry': 'poison', 'persim-berry': 'ground', 'lum-berry': 'flying',
  'sitrus-berry': 'psychic', 'figy-berry': 'bug', 'wiki-berry': 'rock',
  'mago-berry': 'ghost', 'aguav-berry': 'dragon', 'iapapa-berry': 'dark',
  'razz-berry': 'steel', 'occa-berry': 'fire', 'passho-berry': 'water',
  'wacan-berry': 'electric', 'rindo-berry': 'grass', 'yache-berry': 'ice',
  'chople-berry': 'fighting', 'kebia-berry': 'poison', 'shuca-berry': 'ground',
  'coba-berry': 'flying', 'payapa-berry': 'psychic', 'tanga-berry': 'bug',
  'charti-berry': 'rock', 'kasib-berry': 'ghost', 'haban-berry': 'dragon',
  'colbur-berry': 'dark', 'babiri-berry': 'steel', 'chilan-berry': 'normal',
  'roseli-berry': 'fairy',
};

/** { power, type } Natural Gift по id ягоды или null (нет ягоды). */
export function naturalGift(berryId: unknown): { power: number; type: string } | null {
  const id = String(berryId || '');
  if (!id) return null;
  return { power: 80, type: GIFT_TYPE[id] || 'normal' };
}

// ── Present (проход-741) ──────────────────────────────────────
// Канон: 40% — 40, 30% — 80, 10% — 120, 20% — лечит цель на 25%.
export function presentRoll(rand: () => number = Math.random): { kind: 'dmg'; power: number } | { kind: 'heal' } {
  const r = rand();
  if (r < 0.4) return { kind: 'dmg', power: 40 };
  if (r < 0.7) return { kind: 'dmg', power: 80 };
  if (r < 0.8) return { kind: 'dmg', power: 120 };
  return { kind: 'heal' };
}

// ── Spit Up / Stockpile / Swallow (проход-741) ────────────────
// stock: 0..3 на покемоне. Spit Up: 100 × зарядов (0 — провал).
export function spitUpPower(stock: unknown): number | null {
  const s = Math.floor(Number(stock) || 0);
  return s > 0 ? 100 * Math.min(3, s) : null;
}

/** Swallow: лечение 25/50/100% по зарядам или null (зарядов нет). */
export function swallowPct(stock: unknown): number | null {
  const s = Math.floor(Number(stock) || 0);
  if (s <= 0) return null;
  return [0, 25, 50, 100][Math.min(3, s)];
}

// ── Last Respects / Rage Fist (проход-741) ────────────────────
/** Last Respects: 50 + 50 за каждого павшего в команде. */
export function lastRespectsPower(faintedCount: unknown): number {
  return 50 + 50 * Math.max(0, Math.floor(Number(faintedCount) || 0));
}

/** Rage Fist: 50 + 50 за каждое полученное попадание (счётчик на покемоне). */
export function rageFistPower(rageHits: unknown): number {
  return 50 + 50 * Math.max(0, Math.floor(Number(rageHits) || 0));
}

// ── Population Bomb (проход-741) ──────────────────────────────
// 1 удар + продолжение с шансом 90%, максимум 10.
export function populationBombHits(rand: () => number = Math.random): number {
  let hits = 1;
  while (hits < 10 && rand() < 0.9) hits++;
  return hits;
}

// ── Замешательство (проход-741) ───────────────────────────────
// Шанс спутать по имени атаки (канон). 0 — не путает (chatter оставлен
// чистым уроном: его спутывание было версионным гиммиком).
const CONFUSE_CHANCE: Record<string, number> = {
  'supersonic': 55, 'confuse-ray': 100, 'teeter-dance': 100,
  'sweet-kiss': 75, 'swagger': 100, 'flatter': 100,
  'dynamic-punch': 100, 'water-pulse': 20, 'psybeam': 10,
  'signal-beam': 10, 'extrasensory': 10, 'dizzy-punch': 20,
  'rock-climb': 20, 'hurricane': 30, 'chatter': 0,
  'strange-steam': 20, 'beak-blast': 0,
};

/** Шанс спутать (0–100) или 0. */
export function confuseChance(moveName: unknown): number {
  return CONFUSE_CHANCE[normMoveName(moveName)] || 0;
}

/** Ходов замешательства: 1–4 (канон). */
export function confusionTurns(rand: () => number = Math.random): number {
  return 1 + Math.floor(rand() * 4);
}

/** Шанс ударить себя в замешательстве: 1/3 (канон с 7 поколения). */
export function confusionSelfHit(rand: () => number = Math.random): boolean {
  return rand() < 1 / 3;
}

/** Урон себе в замешательстве: 40 сил, физой по своей защите. */
export function confusionDamage(atkStat: unknown, defStat: unknown, level: unknown): number {
  const a = Math.max(1, Math.floor(Number(atkStat) || 0));
  const d = Math.max(1, Math.floor(Number(defStat) || 0));
  const l = Math.max(1, Math.floor(Number(level) || 0));
  return Math.max(1, Math.floor((Math.floor((Math.floor((2 * l) / 5 + 2) * 40 * a) / d) / 50) + 2));
}

// ── Волатильные состояния: attract/yawn/perish/taunt/encore/disable/torment ─
// Хранятся на покемоне в mon.vol (смена/смерть сбрасывают сами — объект новый).
export interface VolState {
  confusion?: number;
  attract?: boolean;
  taunt?: number;
  encore?: { move: string; turns: number };
  disable?: { move: string; turns: number };
  torment?: boolean;
  lastMove?: string | null;
  perish?: number;
  yawn?: boolean;
  wish?: boolean;
  destiny?: boolean;
  endure?: boolean;
  rageHits?: number;
  saltCure?: boolean;
  stock?: number;
}

/** Влюблённость мешает: 50% (канон), если полы разные и известны. */
export function attractBlocks(genderA: unknown, genderB: unknown, rand: () => number = Math.random): boolean {
  const a = String(genderA || '');
  const b = String(genderB || '');
  if (!a || !b || a === b || a === 'genderless' || b === 'genderless') return false;
  return rand() < 0.5;
}

/** Taunt: запрещает не дамажащие атаки. */
export function tauntBlocks(move: any): boolean {
  return !moveDealsDamage(move);
}

/** Encore: заставляет повторять атаку; возвращает true если выбор неверный. */
export function encoreForces(vol: VolState | undefined, moveName: unknown): string | null {
  const e = vol?.encore;
  if (!e || e.turns <= 0) return null;
  return normMoveName(moveName) === normMoveName(e.move) ? null : e.move;
}

/** Disable: запрещённая атака. */
export function disableBlocks(vol: VolState | undefined, moveName: unknown): boolean {
  const d = vol?.disable;
  return !!d && d.turns > 0 && normMoveName(moveName) === normMoveName(d.move);
}

/** Torment: нельзя дважды подряд той же атакой. */
export function tormentBlocks(vol: VolState | undefined, moveName: unknown): boolean {
  return !!vol?.torment && !!vol.lastMove && normMoveName(moveName) === normMoveName(vol.lastMove);
}

/** Perish Song: обратный отсчёт, на нуле — обморок. */
export function perishTick(vol: VolState | undefined): { faint: boolean; left: number } {
  const p = Math.floor(Number(vol?.perish) || 0);
  if (p <= 0) return { faint: false, left: 0 };
  return { faint: p - 1 <= 0, left: Math.max(0, p - 1) };
}

/** Yawn: на следующем ходу — сон (если статуса нет). */
export function yawnWakes(hasStatus: unknown): boolean {
  return !hasStatus;
}

// ── Поля боя: погода/террейн/tailwind/trick-room (проход-741) ─
export const WEATHER_SET: Record<string, string> = {
  'sunny-day': 'sun', 'rain-dance': 'rain', 'sandstorm': 'sandstorm',
  'hail': 'hail', 'snowscape': 'hail', // снега как механики в движке нет — поведение града
};

export const TERRAIN_SET: Record<string, string> = {
  'electric-terrain': 'electric', 'misty-terrain': 'misty',
  'grassy-terrain': 'grassy', 'psychic-terrain': 'psychic',
};

export const FIELD_TURNS = 5;
export const TAILWIND_TURNS = 4;
export const TRICK_ROOM_TURNS = 5;

// ── Collision Course / Electro Drift (проход-741) ─────────────
// ×4/3, если удар суперэффективен.
export function collisionCourseMult(effectiveness: unknown): number {
  return Number(effectiveness) > 1 ? 4 / 3 : 1;
}

// ── Salt Cure DOT (проход-741) ────────────────────────────────
// 1/8 макс HP в конце хода, 1/4 — по стальному/водному.
export function saltCureChip(maxHp: unknown, targetTypes: unknown): number {
  const m = Math.floor(Number(maxHp) || 0);
  if (m <= 0) return 0;
  const types = Array.isArray(targetTypes) ? targetTypes.map(String) : [];
  const divider = types.includes('steel') || types.includes('water') ? 4 : 8;
  return Math.max(1, Math.floor(m / divider));
}

// ── Тип, устойчивый к атакующему (для Conversion 2, проход-741) ──
// chart — TYPE_CHART { типАтаки: { типЗащиты: множитель } }.
export function resistantType(attackType: unknown, chart: Record<string, Record<string, number>>): string | null {
  const atk = String(attackType || '');
  if (!atk || !chart) return null;
  // chart устроен как chart[атака][защита]: ищем тип защиты с множителем < 1.
  const all = new Set<string>();
  for (const a of Object.values(chart)) for (const d of Object.keys(a)) all.add(d);
  let best: string | null = null;
  let bestMult = 1;
  for (const d of all) {
    const row = chart[atk];
    const mult = row && row[d] !== undefined ? row[d] : 1;
    if (mult < bestMult) {
      bestMult = mult;
      best = d;
    }
  }
  return bestMult < 1 ? best : null;
}

// ── Metronome: пул обычных атак (проход-741) ──────────────────
// Конструируем stub-детали: движок считает по ним как по настоящим.
export const METRONOME_POOL = [
  { name: 'flamethrower', power: 90, type: 'fire', cat: 'special' },
  { name: 'thunderbolt', power: 90, type: 'electric', cat: 'special' },
  { name: 'ice-beam', power: 90, type: 'ice', cat: 'special' },
  { name: 'surf', power: 90, type: 'water', cat: 'special' },
  { name: 'earthquake', power: 100, type: 'ground', cat: 'physical' },
  { name: 'close-combat', power: 120, type: 'fighting', cat: 'physical' },
  { name: 'brave-bird', power: 120, type: 'flying', cat: 'physical' },
  { name: 'shadow-ball', power: 80, type: 'ghost', cat: 'special' },
  { name: 'psychic', power: 90, type: 'psychic', cat: 'special' },
  { name: 'dark-pulse', power: 80, type: 'dark', cat: 'special' },
  { name: 'iron-head', power: 80, type: 'steel', cat: 'physical' },
  { name: 'play-rough', power: 90, type: 'fairy', cat: 'physical' },
  { name: 'dragon-claw', power: 80, type: 'dragon', cat: 'physical' },
  { name: 'rock-slide', power: 75, type: 'rock', cat: 'physical' },
  { name: 'x-scissor', power: 80, type: 'bug', cat: 'physical' },
  { name: 'poison-jab', power: 80, type: 'poison', cat: 'physical' },
  { name: 'seed-bomb', power: 80, type: 'grass', cat: 'physical' },
  { name: 'aerial-ace', power: 60, type: 'flying', cat: 'physical' },
  { name: 'quick-attack', power: 40, type: 'normal', cat: 'physical' },
  { name: 'swift', power: 60, type: 'normal', cat: 'special' },
];

/** Случайная атака из пула в форме деталей движка. */
export function metronomePick(rand: () => number = Math.random): any {
  const p = METRONOME_POOL[Math.floor(rand() * METRONOME_POOL.length)];
  return {
    name: p.name, power: p.power, accuracy: 100, pp: 15,
    type: { name: p.type }, damage_class: { name: p.cat }, meta: {},
  };
}

// ── Me First (проход-741) ─────────────────────────────────────
// Крадёт атаку врага с ×1.5 (только дамажащую), иначе провал.
export function meFirstCopy(enemyMove: any): any | null {
  if (!enemyMove || !moveDealsDamage(enemyMove)) return null;
  const power = Math.floor(Number(enemyMove.power) || 0);
  if (power <= 0) return null;
  return { ...enemyMove, power: Math.floor(power * 1.5) };
}

// ── False Swipe (L2): не добивает ─────────────────────────────
// Канон: если удар довёл бы цель до 0 — остаётся 1 HP. Чистая функция:
// preHp — HP до удара, curHp — после вычитания урона (уже обрезанное ≥0).
export function falseSwipeClamp(preHp: unknown, curHp: unknown): number {
  const pre = Math.floor(Number(preHp) || 0);
  const cur = Math.floor(Number(curHp) || 0);
  return pre > 0 && cur <= 0 ? 1 : cur;
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

/** Базовая защита вида (для урона себе в замешательстве). */
export function baseDefOf(mon: any, isWild: boolean): number {
  const arr = isWild ? mon?.stats : mon?.apiData?.stats;
  const o = Array.isArray(arr) ? arr.find((s: any) => s?.stat?.name === 'defense') : undefined;
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
