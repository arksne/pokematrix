import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Тесты журнала дропа.
 *
 * Журнал — это прогресс, который нельзя потерять: раньше дроп жил одной строкой
 * в логе боя и исчезал вместе с боем, поэтому проверяем и запись, и то, что
 * список переживает перезагрузку и ограничен по длине.
 */

// Мок состояния игры: журнал лежит прямо в нём.
const mockState = vi.hoisted(() => ({ dropLog: [] as any[] }));

vi.mock('../../game/state.js', () => ({
  state: mockState,
}));

// Мок предметов: nameRu нужен только для подписей в UI.
vi.mock('../../utils/items.js', () => ({
  itemDef: (id: string) => ({ id, nameRu: `Предмет ${id}` }),
}));

// Минимальный DOM для рендера.
function stubDom() {
  const created: Record<string, any> = {};
  (globalThis as any).document = {
    getElementById: (id: string) => {
      if (!created[id]) {
        created[id] = { innerText: '', textContent: '', innerHTML: '', style: {} };
      }
      return created[id];
    },
    createElement: () => ({ style: {}, dataset: {} }),
  };
  return created;
}

async function loadModule() {
  vi.resetModules();
  return await import('../drop-log.js');
}

describe('журнал дропа', () => {
  beforeEach(() => {
    mockState.dropLog = [];
    stubDom();
  });

  it('начинается пустым и создаётся лениво', async () => {
    const { getDropLog } = await loadModule();
    delete mockState.dropLog;
    expect(Array.isArray(getDropLog())).toBe(true);
    expect(getDropLog()).toHaveLength(0);
  });

  it('записывает выпавшее новой записью сверху', async () => {
    const { recordDrop, getDropLog } = await loadModule();
    recordDrop('Pikachu', 5, [{ id: 'pokeball', qty: 2 }]);
    recordDrop('Caterpie', 3, [{ id: 'greatball', qty: 1 }]);

    const log = getDropLog();
    // Свежие записи сверху: журнал открывают посмотреть, что выпало только что.
    expect(log).toHaveLength(2);
    expect(log[0].name).toBe('Caterpie');
    expect(log[1].name).toBe('Pikachu');
    expect(log[1].level).toBe(5);
    expect(log[1].items).toEqual([{ id: 'pokeball', qty: 2 }]);
  });

  it('не пишет запись, если ничего не выпало', async () => {
    const { recordDrop, getDropLog } = await loadModule();
    recordDrop('Pikachu', 5, []);
    recordDrop('Pikachu', 5, undefined as any);
    expect(getDropLog()).toHaveLength(0);
  });

  it('ограничивает журнал, чтобы сейв не разрастался', async () => {
    const { recordDrop, getDropLog } = await loadModule();
    for (let i = 0; i < 80; i++) {
      recordDrop(`Mon${i}`, i, [{ id: 'pokeball', qty: 1 }]);
    }
    expect(getDropLog()).toHaveLength(60);
    // Хвост обрезается с конца, а самые свежие записи остаются.
    expect(getDropLog()[0].name).toBe('Mon79');
  });

  it('переживает повторную загрузку страницы', async () => {
    const { recordDrop, getDropLog } = await loadModule();
    recordDrop('Pikachu', 5, [{ id: 'pokeball', qty: 2 }]);

    // Перезагрузка: модуль инициализируется заново, состояние — то же самое.
    vi.resetModules();
    const reloaded = await import('../drop-log.js');
    expect(reloaded.getDropLog()).toHaveLength(1);
    expect(reloaded.getDropLog()[0].items[0].qty).toBe(2);
  });

  it('суммирует количество предмета по всему журналу', async () => {
    const { recordDrop, dropTotalFor } = await loadModule();
    recordDrop('Pikachu', 5, [{ id: 'pokeball', qty: 2 }, { id: 'potion', qty: 1 }]);
    recordDrop('Caterpie', 3, [{ id: 'pokeball', qty: 3 }]);

    expect(dropTotalFor('pokeball')).toBe(5);
    expect(dropTotalFor('potion')).toBe(1);
    expect(dropTotalFor('ultra')).toBe(0);
  });

  it('очистка оставляет пустой массив, а не удаляет поле', async () => {
    const { recordDrop, clearDropLog, getDropLog } = await loadModule();
    recordDrop('Pikachu', 5, [{ id: 'pokeball', qty: 2 }]);
    clearDropLog();

    // Пустой массив вместо удалённого поля: иначе сейв выглядел бы как
    // «ещё не загружалось» и журнал вернулся бы при следующей загрузке.
    expect(Array.isArray(mockState.dropLog)).toBe(true);
    expect(getDropLog()).toHaveLength(0);
  });

  it('рисует записи с русскими названиями предметов', async () => {
    const { recordDrop, renderDropLog } = await loadModule();
    recordDrop('Pikachu', 5, [{ id: 'pokeball', qty: 2 }]);
    const container = document.getElementById('drop-list');
    renderDropLog();

    expect(container.innerHTML).toContain('Pikachu');
    expect(container.innerHTML).toContain('ур.5');
    expect(container.innerHTML).toContain('Предмет pokeball');
  });

  it('показывает пустое состояние вместо пустой страницы', async () => {
    const { renderDropLog } = await loadModule();
    const container = document.getElementById('drop-list');
    renderDropLog();
    expect(container.innerHTML).toContain('Пока ничего не выпало');
  });

  it('экранирует имена из сейва, чтобы не выполнить разметку', async () => {
    const { recordDrop, renderDropLog } = await loadModule();
    // Имя покемона приходит из localStorage, который игрок мог отредактировать.
    recordDrop('<img src=x onerror="window.__pwned=1">', 1, [{ id: 'pokeball', qty: 1 }]);
    const container = document.getElementById('drop-list');
    renderDropLog();

    expect(container.innerHTML).not.toContain('<img');
    expect(container.innerHTML).toContain('&lt;img');
    expect((globalThis as any).__pwned).toBeUndefined();
  });

  it('сводка считает бои и предметы', async () => {
    const { recordDrop, renderDropSummary } = await loadModule();
    const box = document.getElementById('drop-summary');

    renderDropSummary();
    expect(box.textContent).toBe('Журнал пуст');

    recordDrop('Pikachu', 5, [{ id: 'pokeball', qty: 2 }, { id: 'potion', qty: 1 }]);
    recordDrop('Caterpie', 3, [{ id: 'pokeball', qty: 3 }]);
    renderDropSummary();
    expect(box.textContent).toContain('Боёв: 2');
    expect(box.textContent).toContain('предметов: 6');
  });
});