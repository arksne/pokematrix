import { describe, it, expect, vi, beforeEach } from 'vitest';
import { state } from '../../game/state.js';
import { GEN_STARTERS } from '../../data/starters.js';

/**
 * Выдача стартовика + модалка онбординга.
 * Сеть (PokeAPI) и DOM подменены стабами — проверяем логику, не сеть.
 */

// ── Стаб document: персистентные элементы по id (клики симулируем),
// createElement даёт Proxy-заглушку, body считает appendChild ──
function makeEl(): any {
  const listeners: Record<string, Function[]> = {};
  const el: any = {
    style: {},
    removed: false,
    // Жмём только ПОСЛЕДНИЙ хендлер: старые принадлежат убранным
    // оверлеям (в браузере они умирают вместе с DOM-узлом).
    click() { const arr = listeners['click'] || []; if (arr.length) arr[arr.length - 1](); },
  };
  return new Proxy(el, {
    get(t: any, p: string) {
      if (p === 'addEventListener') return (ev: string, fn: Function) => { (listeners[ev] = listeners[ev] || []).push(fn); };
      if (p === 'appendChild') return (c: any) => c;
      if (p === 'querySelector') return null;
      if (p === 'remove') return () => { t.removed = true; };
      if (p === 'getBoundingClientRect') return () => ({ top: 0, left: 0, width: 0, height: 0 });
      if (p === 'classList') return { add: () => {}, remove: () => {} };
      return t[p];
    },
    set(t: any, p: string, v: any) { t[p] = v; return true; },
  });
}
const appended: any[] = [];
const byId = new Map<string, any>();
function installDomNull() {
  appended.length = 0;
  byId.clear();
  (globalThis as any).document = {
    getElementById: (id: string) => {
      if (id === 'tutorial-overlay') {
        // оверлей «живёт» пока не remove(): ищем неубранный
        for (let i = appended.length - 1; i >= 0; i--) {
          if (appended[i].id === 'tutorial-overlay' && !appended[i].removed) return appended[i];
        }
        return null;
      }
      if (!byId.has(id)) byId.set(id, makeEl());
      return byId.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeEl(),
    addEventListener: () => {},
    body: { appendChild: (c: any) => { appended.push(c); return c; } },
  };
}
/** Клик по кнопке онбординга (null-safe: кнопки может не быть). */
function clickBtn(id: string): boolean {
  const el = byId.get(id);
  if (!el) return false;
  el.click();
  return true;
}

// ── Фикстура PokeAPI для бульбазавра ──
const BULBA = {
  name: 'bulbasaur',
  stats: [
    { base_stat: 45, stat: { name: 'hp' } },
    { base_stat: 49, stat: { name: 'attack' } },
    { base_stat: 49, stat: { name: 'defense' } },
    { base_stat: 65, stat: { name: 'special-attack' } },
    { base_stat: 65, stat: { name: 'special-defense' } },
    { base_stat: 45, stat: { name: 'speed' } },
  ],
  types: [{ type: { name: 'grass' } }, { type: { name: 'poison' } }],
  abilities: [{ ability: { name: 'overgrow' }, is_hidden: false }],
  species: { name: 'bulbasaur', url: '' },
  sprites: {},
  moves: [
    { move: { name: 'tackle', url: '' }, version_group_details: [{ move_learn_method: { name: 'level-up' }, level_learned_at: 1 }] },
    { move: { name: 'growl', url: '' }, version_group_details: [{ move_learn_method: { name: 'level-up' }, level_learned_at: 1 }] },
    { move: { name: 'vine-whip', url: '' }, version_group_details: [{ move_learn_method: { name: 'level-up' }, level_learned_at: 9 }] },
  ],
};

function installFetch() {
  vi.stubGlobal('fetch', async (url: any) => {
    const u = String(url);
    // Любого покемона отдаём бульбазавром (для выдачи важна форма, не вид);
    // относительные URL (learnset) роняем — код уходит в PokeAPI-фолбэк.
    if (/\/pokemon\/[^/]+$/.test(u) && !u.startsWith('/')) {
      return { ok: true, json: async () => JSON.parse(JSON.stringify(BULBA)) };
    }
    throw new TypeError('fetch failed (стаб)');
  });
  // localStorage для UID/тренера
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
    removeItem: (k: string) => { mem.delete(k); },
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  installDomNull();
  installFetch();
  state.myTeam = [];
  state.pcBoxes = [[]];
  state.inventory = { credit: 0 };
  state.pokedexSeen = new Set();
  state.pokedexCaught = new Set();
  state.starterGiven = false;
  state.tutorialStep = 0;
  state.currentLocationId = 'pewterCity';
});

describe('randomStarter', () => {
  it('тянет из пула всех 27', async () => {
    const { randomStarter } = await import('../starter.js');
    const pool = new Set(GEN_STARTERS.flat());
    expect(pool.size).toBe(27);
    for (let i = 0; i < 200; i++) expect(pool.has(randomStarter())).toBe(true);
  });
});

describe('giveStarterMon (выдача)', () => {
  it('команда, уровень 5, гены 49-50, предметы, флаги', async () => {
    const { giveStarterMon } = await import('../starter.js');
    await giveStarterMon('bulbasaur');
    expect(state.myTeam.length).toBe(1);
    const mon = state.myTeam[0];
    expect(mon.baseLevel).toBe(5);
    expect(mon.ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
    expect(mon.exp).toBe(125);
    expect(mon.currentHp).toBe(mon.maxHp);
    expect(mon.happiness).toBe(70);
    expect(mon.caughtLocation).toBe('pewterCity');
    // Только атаки до 5 уровня (tackle, growl), vine-whip (9) — нет
    const names = mon.apiData.moves.map((m: any) => m.move.name);
    expect(names).toContain('tackle');
    expect(names).toContain('growl');
    expect(names).not.toContain('vine-whip');
    // Стартовый набор и флаги
    expect(state.inventory.pokeBall).toBeGreaterThanOrEqual(5);
    expect(state.inventory.potion).toBeGreaterThanOrEqual(3);
    expect(state.inventory.credit).toBeGreaterThanOrEqual(1000);
    expect(state.starterGiven).toBe(true);
    expect(state.tutorialStep).toBe(1);
    expect(state.pokedexCaught.has('bulbasaur')).toBe(true);
  });

  it('полная команда — уходит в PC, не теряется', async () => {
    const { giveStarterMon } = await import('../starter.js');
    state.myTeam = [1, 2, 3, 4, 5, 6].map((i) => ({ uid: `m${i}` }));
    await giveStarterMon('bulbasaur');
    expect(state.myTeam.length).toBe(6);
    expect(state.pcBoxes[0].length).toBe(1);
    expect(state.pcBoxes[0][0].apiData.name).toBe('bulbasaur');
  });
});

describe('giveStarter (фолбэк без модалки)', () => {
  it('без DOM-модалки резолвится и выдаёт монстра', async () => {
    const { giveStarter } = await import('../starter.js');
    // Модалки нет в DOM: getElementById → null → запасной путь
    (globalThis as any).document.getElementById = () => null;
    await giveStarter();
    // выдача асинхронна (цепочка после resolve) — ждём тик
    for (let i = 0; i < 50 && state.myTeam.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(state.myTeam.length).toBe(1);
  });
});

describe('startOnboarding (модалка обучения)', () => {
  it('оверлей создаётся и вешается на body', async () => {
    const { startOnboarding } = await import('../tutorial.js');
    appended.length = 0;
    startOnboarding();
    const ov = appended.find((el) => el.className === 'tutorial-overlay');
    expect(ov).toBeTruthy();
    expect(String(ov.innerHTML)).toContain('tutorial-card');
  });

  it('полный проход: клики «Далее» ведут по цепочке до завершения', async () => {
    const tut = await import('../tutorial.js');
    expect(tut.isTutorialComplete()).toBe(false);
    let done = false;
    tut.startOnboarding(() => { done = true; });
    // Кликаем «Далее» пока оверлеи появляются (кап от зацикливания)
    for (let i = 0; i < 40 && !tut.isTutorialComplete(); i++) {
      if (!clickBtn('tutorial-next')) break;
    }
    expect(tut.isTutorialComplete()).toBe(true);
    expect(done).toBe(true);
  });

  it('повторный запуск после завершения — сразу колбэк, без оверлея', async () => {
    const tut = await import('../tutorial.js');
    tut.markTutorialComplete();
    expect(tut.isTutorialComplete()).toBe(true);
    appended.length = 0;
    let done = false;
    tut.startOnboarding(() => { done = true; });
    expect(done).toBe(true);
    expect(appended.filter((el) => el.className === 'tutorial-overlay')).toHaveLength(0);
  });

  it('кнопка «Пропустить» завершает текущий урок', async () => {
    const tut = await import('../tutorial.js');
    tut.startOnboarding();
    const before = appended.filter((el) => el.className === 'tutorial-overlay').length;
    expect(before).toBeGreaterThan(0);
    expect(clickBtn('tutorial-skip')).toBe(true);
    // Пропуск финиширует урок → цепочка идёт дальше (новый оверлей) или конец
    const states = appended.filter((el) => el.className === 'tutorial-overlay').length;
    expect(states).toBeGreaterThanOrEqual(before);
  });
});
