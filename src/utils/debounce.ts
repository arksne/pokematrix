/**
 * debounce — откладывает вызов до паузы в событиях.
 *
 * Зачем: в Покедексе поле поиска перерисовывало сетку из 1025 карточек на
 * КАЖДОЕ нажатие клавиши (`searchEl.oninput = renderGrid`). На телефоне это
 * десятки-сотни миллисекунд на символ — ввод «залипает». С debounce сетка
 * перестраивается один раз после того, как игрок перестал печатать.
 *
 * Возвращаемая функция имеет .cancel() — отменить отложенный вызов (полезно
 * при закрытии модалки, чтобы не рендерить в скрытый экран).
 */
export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void;
  cancel(): void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number
): DebouncedFunction<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Args): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, Math.max(0, waitMs));
  };
  debounced.cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
