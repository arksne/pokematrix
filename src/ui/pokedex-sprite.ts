/**
 * Какой спрайт рисовать в сетке Покедекса.
 *
 * В сетке 1025 записей. Раньше каждая ячейка тянула официальный artwork
 * PokeAPI — замер на живом проде: 99 КБ на одну картинку (#816). С `loading=lazy`
 * видимая часть экрана — это 15 ячеек, то есть ~1.5 МБ на один экран прокрутки.
 * На мобильном интернете это дорого и медленно, а у невиданных покемонов
 * картинка и так затемнена в силуэт — там разницы между 96px спрайтом и
 * артом не видно вообще.
 *
 * Компромисс:
 *   - пойманные — крупный официальный арт (их у игрока немного: приятно
 *     смотреть свою коллекцию),
 *   - остальные — маленький спрайт 96px (~10 КБ).
 *
 * Детальная карточка покемона по-прежнему показывает арт — она открывается
 * одна и там качество важно.
 */

export interface PokedexSpriteOptions {
  /** Пойман ли покемон (для пойманных берём artwork). */
  caught?: boolean;
  /** Показывать шайни-вариант. */
  shiny?: boolean;
}

/** URL спрайта для ячейки сетки Покедекса. */
export function pokedexGridSprite(pokeapiId: number, opts: PokedexSpriteOptions = {}): string {
  const id = Number(pokeapiId);
  const prefix = opts.shiny ? 'shiny/' : '';
  if (!Number.isFinite(id) || id <= 0) return '';
  if (opts.caught) {
    return `/api/sprite/pokemon/other/official-artwork/${prefix}${id}.png`;
  }
  return `/api/sprite/pokemon/${prefix}${id}.png`;
}

/**
 * URL спрайта для детальной карточки: всегда официальный арт (один запрос,
 * картинка крупная — качество здесь важнее трафика).
 */
export function pokedexDetailSprite(pokeapiId: number, opts: { shiny?: boolean } = {}): string {
  const id = Number(pokeapiId);
  if (!Number.isFinite(id) || id <= 0) return '';
  const prefix = opts.shiny ? 'shiny/' : '';
  return `/api/sprite/pokemon/other/official-artwork/${prefix}${id}.png`;
}
