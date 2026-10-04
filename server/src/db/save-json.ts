/**
 * Разбор save_data на сервере.
 *
 * Раньше в 14 местах стояло `try { saveData = JSON.parse(...) } catch {}`.
 * Пустой catch подставлял `{}`, и вызывающий код мутировал этот объект и писал
 * его обратно в колонку. Один непарсимый байт — то есть одна битая запись — при
 *водила к записи состояния по умолчанию вместо прогресса игрока, молча и
 * безвозвратно.
 *
 * Здесь разбор строгий: при ошибке бросается исключение, маршрут отвечает 500 и
 * запись не происходит. Потерять прогресс из-за служебной ошибки нельзя, а
 * повреждённый сейв должен быть виден в логах, а не заметан под ковёр.
 */

export class SaveParseError extends Error {
  readonly userId: number | null;
  constructor(message: string, userId: number | null = null) {
    super(message);
    this.name = 'SaveParseError';
    this.userId = userId;
  }
}

/**
 * Разбирает сохранение. Пустая строка и null — это нормальное состояние
 * «сейва ещё нет», а не ошибка. Нечитаемый JSON — ошибка.
 */
export function parseSaveStrict(raw: string | null | undefined, userId: number | null = null): any {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`ожидался объект, получено ${Array.isArray(parsed) ? 'массив' : typeof parsed}`);
    }
    return parsed;
  } catch (e: any) {
    const detail = e?.message || String(e);
    // Логируем до броска: если сейв битый, это нужно увидеть в логах Render.
    console.error(`[save-json] user ${userId ?? '?'}: save_data не читается (${detail}). Запись пропущена, прогресс не тронут.`);
    throw new SaveParseError(`save_data is corrupt: ${detail}`, userId);
  }
}

/** Сколько всего покемонов в сейве: команда + ПК + питомник + яйца. */
export function countSavePokemon(d: any): number {
  if (!d || typeof d !== 'object') return 0;
  const pc = Array.isArray(d.pcBoxes) ? d.pcBoxes.reduce((a: number, b: any) => a + (Array.isArray(b) ? b.length : 0), 0) : 0;
  return (Array.isArray(d.myTeam) ? d.myTeam.length : 0)
    + pc
    + (Array.isArray(d.daycareMons) ? d.daycareMons.length : 0)
    + (Array.isArray(d.eggs) ? d.eggs.length : 0);
}
