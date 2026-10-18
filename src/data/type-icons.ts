// ─────────────────────────────────────────────────────────────
// ИКОНКИ ТИПОВ — канонические SVG для всех 18 типов
// ─────────────────────────────────────────────────────────────
// Раньше тип показывался ЭМОДЗИ. Это не канон: у эмодзи нет вида по форме,
// они разные на платформах, а часть типов выглядит одинаково. Игрок писал,
// что иконки типов «странные, не по канону», и что нужны ВСЕ типы.
//
// Теперь — векторные иконки в официальных цветах, отрисованные инлайном:
// не ломаются без сети, не зависят от ОС, одинаковы везде.
// Цвета взяты из TYPE_COLORS (sprite.ts) — те же, что и раньше.

/** Официальные цвета типов (ключ → hex). Дублируют TYPE_COLORS в sprite.ts. */
export const TYPE_COLORS: Record<string, string> = {
  normal: '#9FA19F', fire: '#E62829', water: '#2980EF', electric: '#FAC000',
  grass: '#3FA129', ice: '#3DCEF3', fighting: '#FF8000', poison: '#9141CB',
  ground: '#915121', flying: '#81B9EF', psychic: '#EF4179', bug: '#91A119',
  rock: '#AFA981', ghost: '#704170', dragon: '#5060E1', dark: '#624D4E',
  steel: '#60A1B8', fairy: '#EF70EF',
};

/** Русские названия типов для title/alt. */
export const TYPE_NAMES_RU: Record<string, string> = {
  normal: 'Нормальный', fire: 'Огненный', water: 'Водный', electric: 'Электрический',
  grass: 'Травяной', ice: 'Ледяной', fighting: 'Боевой', poison: 'Ядовитый',
  ground: 'Земляной', flying: 'Летающий', psychic: 'Психический', bug: 'Насекомый',
  rock: 'Каменный', ghost: 'Призрачный', dragon: 'Драконий', dark: 'Тёмный',
  steel: 'Стальной', fairy: 'Волшебный',
};

/** Все 18 типов — используется тестом «иконки есть у всех». */
export const ALL_TYPES = Object.keys(TYPE_COLORS);

/**
 * Глифы иконок. Каждый — компактная path в координатах 0..24,
 * белым по цвету типа. Формы узнаваемые и разные между типами.
 */
const GLYPHS: Record<string, string> = {
  normal:    'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z',
  fire:      'M12 2c1 4-3 5-3 8.5A3 3 0 0 0 12 14c1.8 0 3-1.2 3-2.8 0-1.2-.8-2-1.6-3 .9.3 1.6 1 2 1.9C16.6 8 15 5.6 12 2zM8.6 15.4c.6 2.8 2 5.6 3.4 6.6-3.2 0-5.6-2.4-5.6-5.2 0-1.8.8-3 2.2-1.4z',
  water:     'M12 2.5S5.5 10 5.5 14a6.5 6.5 0 0 0 13 0c0-4-6.5-11.5-6.5-11.5z',
  electric:  'M13.6 2L5 13.2h5.1L9.8 22 19 10.4h-5.4z',
  grass:     'M20 4C10 4 4.5 9 4.5 16c0 2 .6 3.4.6 3.4S7 15 11 13c-3 2.4-4.2 6.6-4.2 6.6S13 19.5 16.6 15C20 10.7 20 4 20 4z',
  ice:       'M12 2v20M3.4 7l17.2 10M20.6 7L3.4 17M12 5.5l-2-2M12 5.5l2-2M12 18.5l-2 2M12 18.5l2 2',
  fighting:  'M4 9h5l3 3h8v3h-8l-3 3H4z',
  poison:    'M12 2.5S5.5 10 5.5 14a6.5 6.5 0 0 0 13 0c0-4-6.5-11.5-6.5-11.5zM9.5 14a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z',
  ground:    'M2 19l6.5-11 4 6 3-4.5L22 19z',
  flying:    'M2 13l8-2.5 3-6.5 1.5 6L22 8l-7.5 4.5 2 2.5-6.5-.5-3 4z',
  psychic:   'M12 4c5 0 8 4 8 8s-3 8-8 8-8-4-8-8 3-8 8-8zm0 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  bug:       'M12 5a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V9a4 4 0 0 1 4-4zM4 9l4 2M20 9l-4 2M4 15l4-2M20 15l-4-2',
  rock:      'M4 17l3-7 5-4 7 4 1 7z',
  ghost:     'M6 20V10a6 6 0 0 1 12 0v10l-2.5-2-2 2-2.5-2-2 2-1-2z',
  dragon:    'M3 7l6 3 3-4 3 4 6-3-3 8-6 5-6-5z',
  dark:      'M15.5 3a9 9 0 1 0 5.5 14A9.5 9.5 0 0 1 15.5 3z',
  steel:     'M12 2l3 2.5 3.5-.5 1 3.5 3 2-1.5 3 1.5 3-3 2-1 3.5-3.5-.5L12 22l-3-2.5-3.5.5-1-3.5-3-2L3 11.5 1.5 8.5l3-2 1-3.5L9 3.5z',
  fairy:     'M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4zM18 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1z',
};

/**
 * Каноническая иконка типа инлайном.
 * @param type имя типа ('fire', 'water', …)
 * @param size сторона квадрата в px
 */
export function typeIconSvg(type: string, size = 22): string {
  const key = String(type || '').toLowerCase();
  const color = TYPE_COLORS[key] || '#8A8A8A';
  const glyph = GLYPHS[key] || GLYPHS.normal;
  const title = TYPE_NAMES_RU[key] || key || 'неизвестный тип';
  return `<span class="type-icon" title="${title}" aria-label="${title}" `
    + `style="display:inline-flex;align-items:center;justify-content:center;`
    + `width:${size}px;height:${size}px;min-width:${size}px;border-radius:50%;`
    + `background:${color};">`
    + `<svg viewBox="0 0 24 24" width="${Math.round(size * 0.72)}" height="${Math.round(size * 0.72)}" `
    + `fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`
    + `<path d="${glyph}"/></svg></span>`;
}

/** Цвет типа (для градиентов и подложек). */
export function typeColor(type: string): string {
  return TYPE_COLORS[String(type || '').toLowerCase()] || '#8A8A8A';
}

/** Русское название типа. */
export function typeNameRu(type: string): string {
  return TYPE_NAMES_RU[String(type || '').toLowerCase()] || String(type || '');
}

/** Есть ли иконка у типа (для теста полноты). */
export function hasTypeIcon(type: string): boolean {
  return Boolean(GLYPHS[String(type || '').toLowerCase()]);
}