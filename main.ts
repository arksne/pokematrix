/**
 * ============================================================
 * main.ts — ГЛОБАЛЬНЫЙ ВХОД В ИГРУ
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   1. Global type augmentations для legacy JS кода (HTMLElement, Window).
 *   2. Определяет dev-команды в window (help, money, items, heal, maxIV...).
 *   3. Импортирует init.ts → DOMContentLoaded → initGame().
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - ./src/game/init.ts — запускает DOMContentLoaded
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   index.html <script type="module" src="/main.ts">
 *
 * 🔹 ЭКСПОРТИРУЕТ:
 *   ничего (точка входа, не экспортирует)
 * ============================================================
 */

// ── Legacy type augmentations ──────────────────────────────
// HTMLElement: свойства, которые добавляются из HTML атрибутов.
// Window: dev-команды (см. ниже).
declare global {
  interface HTMLElement {
    value: string;
    disabled: boolean;
    src: string;
    files: FileList | null;
    onclick: ((e: Event) => void) | null;
    _cleanup?: () => void;
    _timeout?: ReturnType<typeof setTimeout>;
    _reorderSetup?: boolean;
  }
  interface Element {
    style: CSSStyleDeclaration;
    innerText: string;
    dataset: DOMStringMap;
  }
  interface Window {
    Telegram?: any;
    help: () => void;
    cmds: () => void;
    money: (n?: number) => void;
    items: () => void;
    items10: () => void;
    allBadges: () => void;
    heal: () => void;
    maxIV: () => void;
    lvlup: (n?: number) => void;
    legendary: () => Promise<void>;
    mew: () => Promise<void>;
  }
}

// ── Dev-команды (консоль браузера) ────────────────────────
// Эти функции доступны в window для быстрой отладки из консоли F12.
// Используют store/state для мутаций.

import('./src/game/init.js').then((m) => {
  // После загрузки init.ts, прокидываем функции для dev-консоли.
  // Каждая команда делает toast с результатом.
  const init = m as any;

  if (init.state?.isAdmin) {
  window.help = () => {
    init.showToast('Доступные команды: money(N), items, allBadges, heal, lvlup(N), legendary', false);
  };

  window.cmds = window.help;

  window.money = (n = 100000) => {
    init.store.modifyMoney(n);
    init.showToast(`+${n} кредитов!`, false);
  };

  window.items = () => {
    const inv = init.state.inventory;
    if (!inv) { init.showToast('Инвентарь пуст', true); return; }
    const items = Object.keys(inv).filter(k => k !== 'credit' && inv[k] > 0);
    init.showToast(`Предметов: ${items.length}`, false);
    console.table(items.map(k => ({ id: k, qty: inv[k] })));
  };

  window.items10 = () => {
    const inv = init.state.inventory;
    if (!inv) return;
    Object.keys(inv).filter(k => k !== 'credit').forEach(k => inv[k] = 999);
    init.updateInventoryDisplay();
    init.showToast('Все предметы x999!', false);
  };

  window.allBadges = () => {
    init.state.badges = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
    init.updateBadgeDisplay();
    init.showToast('Все значки получены!', false);
  };

  window.heal = () => {
    init.state.myTeam.forEach((m: any) => m.currentHp = m.maxHp);
    init.showToast('Команда исцелена!', false);
  };

  window.maxIV = () => {
    init.state.myTeam.forEach((m: any) => {
      if (!m.ivs) m.ivs = {};
      ['hp','attack','defense','spAtk','spDef','speed'].forEach(s => m.ivs[s] = 31);
    });
    init.showToast('Максимальные IV!', false);
  };

  window.lvlup = (n = 10) => {
    init.state.myTeam.forEach((m: any) => {
      m.baseLevel = Math.min(100, (m.baseLevel || 1) + n);
      if (m.currentHp < m.maxHp) m.currentHp = m.maxHp;
    });
    init.renderTeamGrid();
    init.showToast(`+${n} уровней!`, false);
  };

  window.legendary = async () => {
    const legendaries = ['mewtwo','mew','lugia','ho-oh','rayquaza','groudon','kyogre','dialga','palkia','giratina','zekrom','reshiram'];
    const pick = legendaries[Math.floor(Math.random() * legendaries.length)];
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pick}`);
      const data = await res.json();
      const newMon = init.makeMon(data, init.getTrainerId(), 70);
      if (init.state.myTeam.length >= 6) init.state.myTeam[0] = newMon;
      else init.state.myTeam.push(newMon);
      init.renderTeamGrid();
      init.showToast(`✨ Пойман ${pick}!`, false);
    } catch { init.showToast('Ошибка API :(', true); }
  };

  window.mew = async () => {
    try {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon/mew');
      const data = await res.json();
      const newMon = init.makeMon(data, init.getTrainerId(), 70);
      if (init.state.myTeam.length >= 6) init.state.myTeam[0] = newMon;
      else init.state.myTeam.push(newMon);
      init.renderTeamGrid();
      init.showToast('✨ Mew получен!', false);
    } catch { init.showToast('Ошибка получения Mew', true); }
  };
  }
});
