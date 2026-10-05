import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Метки обучения принадлежат конкретному аккаунту.
 *
 * Раньше ключи были голыми — 'league17_tutorial' и 'league17_help_seen' — без
 * идентификатора тренера, в отличие от ключей сейва (league17_save_<tg_id>).
 * Из-за этого обучение проходился один раз на всё устройство: игрок сменил
 * Telegram-аккаунт, и новый аккаунт стартовал без обучения, потому что метка
 * уже стояла от предыдущего.
 *
 * Мок lsKey повторяет реальное поведение utils/state.ts:
 * league17_<name>_<trainerId>.
 */
// localStorage в node-окружении отсутствует — нужен свой, с тем же поведением
// (строки только, без TTL), иначе модуль падает на первой же проверке.
const store = vi.hoisted(() => new Map<string, string>());
const trainerId = vi.hoisted(() => ({ value: '111' }));

vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
});

vi.mock('../../utils/state.js', () => ({
  lsKey: (name: string) => `league17_${name}_${trainerId.value}`,
}));

describe('метки обучения', () => {
  beforeEach(() => {
    store.clear();
    trainerId.value = '111';
    vi.resetModules();
  });

  async function load() {
    return await import('../tutorial.js');
  }

  it('изначально обучение не пройдено', async () => {
    const { isTutorialComplete } = await load();
    expect(isTutorialComplete()).toBe(false);
  });

  it('после отметки обучение считается пройденным', async () => {
    const { markTutorialComplete, isTutorialComplete } = await load();
    markTutorialComplete();
    expect(isTutorialComplete()).toBe(true);
  });

  it('метка пишется с идентификатором тренера, а не голым ключом', async () => {
    const { markTutorialComplete } = await load();
    markTutorialComplete();

    // Именованный ключ есть...
    expect(store.get('league17_tutorial_111')).toBe('complete');
    // ...а голый ключ, которым пользовались раньше, не осталось.
    expect(store.has('league17_tutorial')).toBe(false);
  });

  it('у второго аккаунта обучение начинается заново', async () => {
    const first = await load();
    first.markTutorialComplete();
    expect(first.isTutorialComplete()).toBe(true);

    // Новый Telegram-аккаунт на том же устройстве.
    trainerId.value = '222';
    const second = await load();

    // Ключ с чужим id — обучение для нового аккаунта ещё не пройдено.
    expect(second.isTutorialComplete()).toBe(false);
  });

  it('пройденное обучение не слетает при смене аккаунта обратно', async () => {
    const first = await load();
    first.markTutorialComplete();

    trainerId.value = '222';
    await load();
    trainerId.value = '111';

    const back = await load();
    expect(back.isTutorialComplete()).toBe(true);
  });

  it('startOnboarding для завершённого обучения сразу зовёт callback', async () => {
    const { markTutorialComplete, startOnboarding } = await load();
    markTutorialComplete();

    let called = false;
    startOnboarding(() => { called = true; });
    expect(called).toBe(true);
  });

  it('справка: отметка «просмотрена» принадлежит аккаунту', async () => {
    // openHelp() рисует модалку, поэтому нужен минимальный DOM.
    vi.stubGlobal('document', {
      createElement: () => ({
        id: '', style: {}, classList: { add() {}, remove() {} },
        addEventListener() {}, remove() {},
        querySelector: () => null, querySelectorAll: () => [],
        innerHTML: '', textContent: '',
        appendChild() {},
      }),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createTextNode: () => ({}),
      body: { appendChild() {} },
      head: { appendChild() {} },
    });

    const { openHelp, isHelpSeen } = await load();
    expect(isHelpSeen()).toBe(false);

    openHelp();
    expect(isHelpSeen()).toBe(true);

    // Новый аккаунт на том же устройстве справку ещё не смотрел.
    trainerId.value = '333';
    expect(isHelpSeen()).toBe(false);
  });
});

