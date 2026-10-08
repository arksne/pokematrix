import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AVATARS, AVATAR_IDS, DEFAULT_AVATAR_ID, getAvatarById, getAvatarSvg, isAvatarId } from '../../data/avatars.js';

/**
 * Блок G (G1 пак аватарок + G2 тренеркарта):
 * - G1: ≥24 уникальных id, валидный inline-SVG, разные палитры/позы.
 * - G2: поверхностные метрики есть, детальных списков/историй нет,
 *   место под PvP-кнопку арены — пустой контейнер без дублирования кнопки.
 */

// ── G1: пак аватарок ─────────────────────────────────────────

describe('G1: пак аватарок', () => {
  it('≥24 штук', () => {
    expect(AVATARS.length).toBeGreaterThanOrEqual(24);
    expect(AVATAR_IDS.length).toBeGreaterThanOrEqual(24);
  });

  it('id уникальны, латиница/дефис, имена непустые', () => {
    const ids = AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of AVATARS) {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(a.id).toMatch(/^[a-z0-9-]+$/);
      expect(typeof a.name).toBe('string');
      expect(a.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('SVG валиден: <svg…</svg>, xmlns, viewBox, без скриптов', () => {
    for (const a of AVATARS) {
      expect(typeof a.svg).toBe('string');
      const s = a.svg;
      expect(s).toContain('<svg');
      expect(s).toContain('</svg>');
      expect(s).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(s).toContain('viewBox="0 0 64 64"');
      expect(s).not.toContain('<script');
      expect(s).not.toContain('onerror');
      expect(s).not.toContain('javascript:');
      // Один корневой svg
      expect((s.match(/<svg/g) || []).length).toBe(1);
      expect((s.match(/<\/svg>/g) || []).length).toBe(1);
    }
  });

  it('аватарки разные (палитры/позы/атрибуты)', () => {
    // Строки SVG целиком уникальны — значит палитры/формы различаются.
    expect(new Set(AVATARS.map((a) => a.svg)).size).toBe(AVATARS.length);
  });

  it('есть с покемоном и без, есть боевые сцены', () => {
    // Эвристика по содержимому: компаньоны рисуются в правом нижнем углу
    // (cx≈49), боевые эффекты — белые линии/полигон поверх фона.
    const withCompanion = AVATARS.filter((a) => a.svg.includes('cx="49"')).length;
    const withoutCompanion = AVATARS.length - withCompanion;
    const battle = AVATARS.filter((a) => a.svg.includes('<line')).length;
    expect(withCompanion).toBeGreaterThan(0);
    expect(withoutCompanion).toBeGreaterThan(0);
    expect(battle).toBeGreaterThan(0);
  });

  it('хелперы: get/is/DEFAULT', () => {
    expect(isAvatarId(AVATARS[0].id)).toBe(true);
    expect(isAvatarId('no-such-avatar')).toBe(false);
    expect(isAvatarId(null)).toBe(false);
    expect(getAvatarById(AVATARS[0].id)?.name).toBe(AVATARS[0].name);
    expect(getAvatarById('no-such-avatar')).toBeUndefined();
    expect(getAvatarSvg(AVATARS[1].id)).toContain('<svg');
    expect(getAvatarSvg('no-such-avatar')).toBeUndefined();
    expect(isAvatarId(DEFAULT_AVATAR_ID)).toBe(true);
  });
});

// ── G2: тренеркарта (поверхностно) ───────────────────────────
// Мокаем окружение тренеркарты: state, dom, save, core, trainer-profile.

const mockState: Record<string, any> = vi.hoisted(() => ({
  badges: ['Boulder Badge', 'Cascade Badge'],
  myTeam: [{ uid: '1' }, { uid: '2' }],
  pcBoxes: [[{ uid: '3' }], []],
  pokedexCaught: new Set(['pikachu', 'bulbasaur', 'charmander']),
  pokedexSeen: new Set(['pikachu']),
  battleWins: 7,
  pvpWins: 3,
  pvpLosses: 1,
  pvpStreak: 2,
  pvpBestStreak: 4,
  trainerNickname: '',
  trainerAvatar: '',
  tgUser: null,
}));

vi.mock('../../game/state.js', () => ({
  state: mockState,
  lsKey: (n: string) => `test_${n}`,
}));

vi.mock('../../utils/dom.js', () => ({
  showTextInputModal: vi.fn(),
}));

vi.mock('../../game/save.js', () => ({
  autoSave: vi.fn(),
}));

vi.mock('../../battle/core.js', () => ({
  pokedexTotal: 151,
}));

vi.mock('../../social/trainer-profile.js', () => ({
  loadLocationTrainers: vi.fn(),
  renderOnlinePlayers: vi.fn(),
}));

function makeEl(id = ''): any {
  const el: any = {
    id,
    innerHTML: '',
    textContent: '',
    innerText: '',
    style: {},
    dataset: {},
    className: '',
    title: '',
    onclick: null,
    children: [] as any[],
    parentNode: null as any,
    setAttribute(k: string, v: string) { (this as any)[`attr_${k}`] = v; },
    getAttribute(k: string) { return (this as any)[`attr_${k}`]; },
    appendChild(c: any) { this.children.push(c); c.parentNode = this; return c; },
    append(c: any) { this.children.push(c); c.parentNode = this; return c; },
    querySelector() { return null; },
  };
  return el;
}

function stubDom() {
  const els: Record<string, any> = {};
  const body = makeEl('body');
  const doc: any = {
    getElementById: (id: string) => {
      if (els[id]) return els[id];
      // Ищем среди динамически созданных (appendChild в body).
      const found = (body.children as any[]).find((c) => c?.id === id);
      return found || null;
    },
    createElement: (_tag: string) => makeEl(),
    body,
    querySelector: () => null,
  };
  (globalThis as any).document = doc;
  (globalThis as any).localStorage = {
    _s: {} as Record<string, string>,
    getItem(k: string) { return (this._s as any)[k] ?? null; },
    setItem(k: string, v: string) { (this._s as any)[k] = String(v); },
    removeItem(k: string) { delete (this._s as any)[k]; },
    clear() { this._s = {}; },
  };
  return els;
}

describe('G2: тренеркарта — только поверхностно', () => {
  beforeEach(() => {
    stubDom();
    mockState.badges = ['Boulder Badge', 'Cascade Badge'];
    mockState.myTeam = [{ uid: '1' }, { uid: '2' }];
    mockState.pcBoxes = [[{ uid: '3' }], []];
    mockState.pokedexCaught = new Set(['pikachu', 'bulbasaur', 'charmander']);
    mockState.battleWins = 7;
    mockState.pvpWins = 3;
    mockState.pvpLosses = 1;
    mockState.pvpStreak = 2;
    mockState.pvpBestStreak = 4;
    mockState.trainerNickname = '';
    mockState.trainerAvatar = '';
    vi.resetModules();
  });

  it('сводка: счётчики есть, списков/историй нет', async () => {
    const m = await import('../trainer-card.js');
    const s = m.getTrainerSummary();
    // Поверхностные метрики присутствуют
    expect(s.badges).toBe(2);
    expect(s.dexCaught).toBe(3);
    expect(s.dexTotal).toBe(151);
    expect(s.teamSize).toBe(2);
    expect(s.pvpWins).toBe(3);
    expect(s.pvpLosses).toBe(1);
    expect(s.pvpStreak).toBe(2);
    expect(s.pvpBestStreak).toBe(4);
    // Только числа — никаких детальных разборов
    for (const v of Object.values(s)) expect(typeof v).toBe('number');
    expect(JSON.stringify(s)).not.toContain('history');
    const src = JSON.stringify(Object.keys(s));
    expect(src).not.toMatch(/list|history|detail|perMon|byDay/i);
  });

  it('стрики обновляются без детальных записей', async () => {
    const m = await import('../trainer-card.js');
    mockState.pvpWins = 0; mockState.pvpLosses = 0;
    mockState.pvpStreak = 0; mockState.pvpBestStreak = 0;
    m.recordPvpResult(true);
    m.recordPvpResult(true);
    expect(mockState.pvpWins).toBe(2);
    expect(mockState.pvpStreak).toBe(2);
    expect(mockState.pvpBestStreak).toBe(2);
    m.recordPvpResult(false);
    expect(mockState.pvpLosses).toBe(1);
    expect(mockState.pvpStreak).toBe(0);
    expect(mockState.pvpBestStreak).toBe(2);
    // Сводка по-прежнему только числа
    const s = m.getTrainerSummary();
    for (const v of Object.values(s)) expect(typeof v).toBe('number');
  });

  it('аватар: get/set только из пака', async () => {
    const m = await import('../trainer-card.js');
    expect(m.getTrainerAvatarId()).toBe(DEFAULT_AVATAR_ID);
    expect(m.setTrainerAvatarId('nope')).toBe(false);
    expect(m.setTrainerAvatarId(AVATARS[5].id)).toBe(true);
    expect(m.getTrainerAvatarId()).toBe(AVATARS[5].id);
    expect(m.trainerAvatarSvg('nope', 48)).toContain('<svg');
  });

  it('прогресс рендерится числами, без <li>/<ul>/историй', async () => {
    const els = stubDom();
    els['trainer-name'] = makeEl('trainer-name');
    els['trainer-badges'] = makeEl('trainer-badges');
    els['trainer-caught'] = makeEl('trainer-caught');
    els['chat-top-bar'] = makeEl('chat-top-bar');
    const m = await import('../trainer-card.js');
    m.renderTrainerCard();
    const box = (globalThis as any).document.getElementById('trainer-card-progress');
    expect(box).toBeTruthy();
    expect(box.innerHTML).toContain('🏅');
    expect(box.innerHTML).toContain('🐾');
    expect(box.innerHTML).toContain('⚔');
    expect(box.innerHTML).toContain('🔥');
    expect(box.innerHTML).not.toContain('<li');
    expect(box.innerHTML).not.toContain('<ul');
    expect(box.innerHTML).not.toContain('<table');
    expect(box.innerHTML.toLowerCase()).not.toContain('истор');
    expect(box.innerHTML.toLowerCase()).not.toContain('history');
  });

  it('контейнер trainer-card-actions есть, кнопки PvP внутри нет', async () => {
    stubDom();
    const m = await import('../trainer-card.js');
    const box = m.ensureTrainerCardActions();
    expect(box).toBeTruthy();
    expect(box.id === 'trainer-card-actions' || box.className.includes('trainer-card-actions')).toBe(true);
    // Пустой слот под агента арены — кнопку он добавит сам, мы не дублируем
    expect(box.innerHTML || '').not.toContain('<button');
  });

  it('сетка аватарок рисует весь пак', async () => {
    const els = stubDom();
    const grid = makeEl('trainer-avatar-grid');
    els['trainer-avatar-grid'] = grid;
    const m = await import('../trainer-card.js');
    m.renderAvatarPicker();
    expect(grid.children.length).toBe(AVATARS.length);
  });
});
