import { describe, it, expect } from 'vitest';
import { buildQuestOfferText } from '../npcs.js';

/**
 * Каждый новичок на первом диалоге с Профессором Оуком видел
 *   «Отлично, ты готов! Вот задание: 1 . Справишься?»
 * — шаблон «{target} {item}» рассчитан на квесты-«принеси предмет», а учебный
 * квест «поймай первого покемона» предмета не имеет. Поймано проверкой NPC на
 * живом проде.
 */
describe('buildQuestOfferText', () => {
  const oakTemplate = 'Отлично, ты готов! Вот задание: {target} {item}. Справишься?';
  const tutorialQuest = {
    targetQty: 1,
    targetItem: null,
    desc: 'Поймайте первого дикого покемона',
  };

  it('квест без предмета (учебный) показывает описание, а не «1 .»', () => {
    const text = buildQuestOfferText(oakTemplate, tutorialQuest);
    expect(text).toContain('Поймайте первого дикого покемона');
    expect(text).not.toMatch(/\d+\s*\./); // никаких «1 .»
    expect(text).not.toContain('{target}');
    expect(text).not.toContain('{item}');
    expect(text).toBe('Отлично, ты готов! Вот задание: Поймайте первого дикого покемона. Справишься?');
  });

  it('квест с предметом: подставляются количество и название предмета', () => {
    const text = buildQuestOfferText('Мне нужны образцы. Принеси мне {target} {item}, и я дам награду.', {
      targetQty: 3,
      targetItem: 'pokeBall',
      desc: 'Принесите покеболы',
    });
    expect(text).toContain('3');
    expect(text).not.toContain('{target}');
    expect(text).not.toContain('{item}');
    // Название предмета пришло из справочника ITEMS, а не осталось ID.
    expect(text).not.toContain('pokeBall');
    expect(text).toMatch(/Принеси мне 3 .+, и я дам награду\./);
  });

  it('шаблон без плейсхолдеров не трогаем', () => {
    const t = 'Оборот 4 000 000. Башенный колокол не ждёт!';
    expect(buildQuestOfferText(t, tutorialQuest)).toBe(t);
  });

  it('остатки плейсхолдеров и лишние пробелы вычищаются', () => {
    const text = buildQuestOfferText('Нужно: {target} {item} .', tutorialQuest);
    expect(text).toBe('Нужно: Поймайте первого дикого покемона.');
  });

  it('пустой шаблон → пустая строка', () => {
    expect(buildQuestOfferText('', tutorialQuest)).toBe('');
  });

  it('квест без desc и без предмета не оставляет «мусор» из плейсхолдеров', () => {
    const text = buildQuestOfferText(oakTemplate, { targetQty: 2, targetItem: null });
    expect(text).not.toContain('{');
    expect(text).not.toContain('  ');
  });
});
