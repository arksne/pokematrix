/**
 * Входные ловушки (hazards): Stealth Rock, Spikes, Toxic Spikes, Sticky Web.
 *
 * До этого модуля ловушки работали ТОЛЬКО в PvP (pvp-core.ts), а в обычных
 * боях (дикие, залы, элита) ходы Stealth Rock / Spikes / Toxic Spikes /
 * Sticky Web были пустышками — игра писала «ничего не произошло». Игрок тратил
 * ход впустую. Здесь чистые правила: состояние ловушек, их установка и эффект
 * на входящего покемона. Применение в бою — battle/core.ts.
 */

export type HazardKind = 'rocks' | 'spikes' | 'toxic' | 'sticky';

export interface HazardSet {
  rocks: boolean;
  /** 0–3 слоя: 1/8, 1/6, 1/4 макс HP. */
  spikes: number;
  /** 0–2 слоя: обычное отравление / сильное отравление. */
  toxic: number;
  sticky: boolean;
}

export function emptyHazards(): HazardSet {
  return { rocks: false, spikes: 0, toxic: 0, sticky: false };
}

/** Слаг атаки → вид ловушки (или null, если это не ловушка). */
export function hazardMoveKind(slug: string): HazardKind | null {
  switch (String(slug || '').toLowerCase()) {
    case 'stealth-rock':
      return 'rocks';
    case 'spikes':
      return 'spikes';
    case 'toxic-spikes':
      return 'toxic';
    case 'sticky-web':
      return 'sticky';
    default:
      return null;
  }
}

/** Добавить слой ловушки (с канонными лимитами: spikes ≤ 3, toxic ≤ 2). */
export function addHazard(set: HazardSet, kind: HazardKind): HazardSet {
  if (kind === 'rocks') set.rocks = true;
  else if (kind === 'spikes') set.spikes = Math.min(3, (set.spikes || 0) + 1);
  else if (kind === 'toxic') set.toxic = Math.min(2, (set.toxic || 0) + 1);
  else if (kind === 'sticky') set.sticky = true;
  return set;
}

/** Есть ли хоть что-то, что сработает при выходе. */
export function hasHazards(set: HazardSet): boolean {
  return !!set && (set.rocks || set.spikes > 0 || set.toxic > 0 || set.sticky);
}

/** Сбросить все ловушки (Defog / Rapid Spin по своей стороне). */
export function clearHazards(set: HazardSet): HazardSet {
  set.rocks = false;
  set.spikes = 0;
  set.toxic = 0;
  set.sticky = false;
  return set;
}

export interface HazardEntryInput {
  /** Множитель урона камней по типу входящего (Rock: 4×…0.25×). */
  rocksMultiplier?: number;
  /** Стоит ли покемон на земле (Flying/Levitate не получают шипы/паутину). */
  grounded?: boolean;
  /** Уже есть статус — новый не накладывается. */
  hasStatus?: boolean;
}

export interface HazardEntryResult {
  /** Урон от камней/шипов (0, если ловушек этого вида нет). */
  damage: number;
  /** Статус от Toxic Spikes ('psn' | 'tox') или null. */
  status: 'psn' | 'tox' | null;
  /** Sticky Web: −1 скорость входящему. */
  speedDrop: boolean;
  /** Строки в лог боя. */
  lines: string[];
}

/**
 * Эффект ловушек на входящего покемона.
 * Камни: 1/8 макс HP × множитель типа. Шипы: 1/8–1/4 (только «наземные»).
 * Токсичные шипы: отравление (2 слоя — токсичное; только «наземные»).
 * Паутина: −1 скорость (только «наземные»).
 */
export function hazardEntryEffect(
  set: HazardSet,
  maxHp: number,
  input: HazardEntryInput = {}
): HazardEntryResult {
  const lines: string[] = [];
  const result: HazardEntryResult = { damage: 0, status: null, speedDrop: false, lines };
  const hp = Number(maxHp) > 0 ? Number(maxHp) : 0;
  if (!hp || !set) return result;

  const grounded = input.grounded !== false; // по умолчанию считается наземным

  if (set.rocks) {
    const mult = Number.isFinite(Number(input.rocksMultiplier)) ? Number(input.rocksMultiplier) : 1;
    const dmg = Math.max(1, Math.floor((hp / 8) * mult));
    result.damage += dmg;
    lines.push(`Камни впиваются — ${dmg} HP!`);
  }

  if (grounded && set.spikes > 0) {
    const fraction = set.spikes >= 3 ? 4 : set.spikes === 2 ? 6 : 8;
    const dmg = Math.max(1, Math.floor(hp / fraction));
    result.damage += dmg;
    lines.push(`Шипы ранят — ${dmg} HP!`);
  }

  if (grounded && set.toxic > 0 && !input.hasStatus) {
    result.status = set.toxic >= 2 ? 'tox' : 'psn';
    lines.push(result.status === 'tox' ? 'Токсичные шипы отравляют!' : 'Токсичные шипы отравляют обычным ядом!');
  }

  if (grounded && set.sticky) {
    result.speedDrop = true;
    lines.push('Паутина опутывает — скорость снижена!');
  }

  return result;
}
