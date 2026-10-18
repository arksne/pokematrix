/**
 * Канонические иконки типов.
 *
 * Жалоба: «иконки типов покемона странные, не по канону, нужно по канону,
 * чтоб были иконки все». Раньше тип рисовался эмодзи — вид платформенный,
 * часть типов выглядела одинаково, «по канону» не получалось.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_TYPES, TYPE_COLORS, TYPE_NAMES_RU, typeIconSvg,
  hasTypeIcon, typeColor, typeNameRu,
} from '../../data/type-icons.js';
import { typeBadgeHtml, typeBadgesHtml } from '../../utils/sprite.js';

describe('иконки типов', () => {
  it('все 18 типов поколения есть, без дыр', () => {
    expect(ALL_TYPES).toHaveLength(18);
    for (const t of ALL_TYPES) {
      expect(hasTypeIcon(t), `нет глифа: ${t}`).toBe(true);
      expect(TYPE_COLORS[t], `нет цвета: ${t}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(TYPE_NAMES_RU[t], `нет названия: ${t}`).toBeTruthy();
    }
  });

  it('глифы уникальны — иконки не сливаются в одну', () => {
    const svg = ALL_TYPES.map((t) => typeIconSvg(t));
    expect(new Set(svg).size).toBe(ALL_TYPES.length);
  });

  it('иконка инлайновая (SVG), не эмодзи и не внешняя картинка', () => {
    const s = typeIconSvg('fire', 24);
    expect(s).toMatch(/<svg /);
    expect(s).toMatch(/viewBox="0 0 24 24"/);
    expect(s).not.toMatch(/<img/);
    expect(s).not.toMatch(/https?:\/\//);
    expect(s).toMatch(/background:#E62829/);   // официальный цвет огня
    expect(s).toMatch(/Огненный/);             // русское название в title
  });

  it('размер уважается', () => {
    expect(typeIconSvg('water', 30)).toMatch(/width:30px;height:30px;min-width:30px/);
  });

  it('неизвестный тип не ломает разметку', () => {
    expect(() => typeIconSvg('неведомыйтип')).not.toThrow();
    expect(typeColor('неведомыйтип')).toMatch(/^#/);
    expect(typeNameRu('неведомыйтип')).toBe('неведомыйтип');
  });

  it('UI-обёртки используют новые иконки, а не эмодзи', () => {
    expect(typeBadgeHtml('fire')).toMatch(/<svg /);
    const two = typeBadgesHtml([{ type: { name: 'grass' } }, { type: { name: 'poison' } }]);
    expect((two.match(/<svg /g) || []).length).toBe(2);
    // старый путь через эмодзи больше не используется
    expect(typeBadgeHtml('fire')).not.toMatch(/font-size:\d+px/);
  });
});