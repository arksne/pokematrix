// ─────────────────────────────────────────��───────────────────
// npc-anchors.ts — ФИКСИРОВАННЫЕ ТОЧКИ NPC (интервью M, п.10)
// ────────────────────────────────��────────────────────────────
// «NPC стоят в фиксированных точках» — раньше все NPC локации выводились
// списком кнопок в три колонки, и их «позиция» зависела от порядка в
// данных: добавил NPC — все соседние сдвинулись, и игрок не находил
// знакомого там, где вчера стоял продавец.
//
// Теперь у каждого NPC своя точка на картинке локации, и она НЕ меняется:
// координаты считаются из id (стабильный хэш), а не от порядка в объекте.
// Одна функция на всех — её же считают тесты.
// ─────────────────────────────────────────────────────────────

/** Точка в процентах внутри блока картинки. */
export interface NpcSpot {
  x: number; // 0..100, слева направо
  y: number; // 0..100, сверху вниз (ниже горизонта)
}

/** Стабильный 32-битный хэш строки (FNV-1a) — детерминированный. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** NPC ниже линии горизонта (y 55..90), с полями слева/справа. */
const X_MIN = 7;
const X_MAX = 93;
const Y_MIN = 55;
const Y_MAX = 90;

/** Минимальная дистанция между двумя NPC в процентах, чтобы не слипались. */
const MIN_GAP = 10;

/**
 * Сетка «тротуара»: NPC стоят в фиксированных точках, разведённых по ячейкам.
 * Ячейки вычисляются из числа NPC в локации, а распределение по ячейкам — из
 * хэша id. Поэтому:
 *   • точка конкретного NPC не зависит от порядка в данных (порядок лишь
 *     переставляет элементы массива, но id → ячейка определяется сортировкой);
 *   • две точки никогда не слипаются: размер ячейки ≥ MIN_GAP по обеим осям.
 */
export function npcSpots(npcIds: string[]): NpcSpot[] {
  const uniq = [...new Set(npcIds)];
  if (uniq.length === 0) return [];

  const W = X_MAX - X_MIN;
  const H = Y_MAX - Y_MIN;
  // Колонок чуть больше, чем строк: картинка широкая (2:1).
  const cols = Math.max(1, Math.ceil(Math.sqrt(uniq.length * (W / H))));
  const rows = Math.max(1, Math.ceil(uniq.length / cols));
  const cellW = W / cols;
  const cellH = H / rows;
  // Джиттер ограничен так, чтобы соседние точки всё равно оставались
  // дальше MIN_GAP друг от друга: максимальный сдвиг в ячейке =
  // (размер ячейки − MIN_GAP) / 2. При мелкой сетке джиттера нет вовсе.
  const jitterAmp = Math.max(0, Math.min(
    0.2,
    (cellW - MIN_GAP) / (2 * cellW),
    (cellH - MIN_GAP) / (2 * cellH),
  ));

  // Порядок ячеек — по хэшу id: одинаковый набор NPC всегда даёт одну и ту же
  // раскладку, независимо от порядка в NPC_DATA.
  const ordered = [...uniq].sort((a, b) => hashId(a) - hashId(b) || (a < b ? -1 : 1));
  const spotById = new Map<string, NpcSpot>();
  ordered.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Центр ячейки + маленький джиттер от хэша, чтобы линия не была
    // механически ровной.
    const h = hashId(`${id}@spot`);
    const jx = (((h % 101) - 50) / 100) * 2 * jitterAmp; // -amp..amp
    const jy = ((((h >>> 8) % 101) - 50) / 100) * 2 * jitterAmp;
    spotById.set(id, {
      x: Math.round((X_MIN + (col + 0.5) * cellW + jx * cellW) * 10) / 10,
      y: Math.round((Y_MIN + (row + 0.5) * cellH + jy * cellH) * 10) / 10,
    });
  });

  return npcIds.map((id) => spotById.get(id)!);
}

/** Точка конкретного NPC в локации (для одиночного рендера). */
export function npcSpot(npcId: string): NpcSpot {
  return npcSpots([npcId])[0];
}