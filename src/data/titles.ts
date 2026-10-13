// ─────────────────────────────────────────────────────────────
// titles.ts — ТИТУЛЫ ТРЕНЕРА (витрина тренеркарты)
// ─────────────────────────────────────────────────────────────
// Титулы выдаются за квесты (пачка Пьютера: 10 штук). Активный титул
// один — показывается под именем. Хранятся в state.titles /
// state.activeTitle, едут в сейв (save.ts), валидация их пропускает
// (passthrough). Чистый модуль данных — без DOM.
// ─────────────────────────────────────────────────────────────

export interface TitleDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

export const TITLES: TitleDef[] = [
  { id: 'pathfinder', icon: '🧭', name: 'Следопыт', desc: 'Каменная тропа: 5 локаций и 25 побед.' },
  { id: 'fistFighter', icon: '🥊', name: 'Кулачный боец', desc: 'Победа над Учеником Бруно.' },
  { id: 'rockBane', icon: '⛰️', name: 'Гроза скал', desc: 'Музейная коллекция и 25 уровень.' },
  { id: 'skyHunter', icon: '🦅', name: 'Небесный охотник', desc: 'Пойманный Aerodactyl.' },
  { id: 'moneyMagnate', icon: '💰', name: 'Магнат', desc: '100 000 торговлей и боями.' },
  { id: 'breeder', icon: '🥚', name: 'Заводчик', desc: 'Выведено и вылуплено яйцо.' },
  { id: 'tempered', icon: '🛡️', name: 'Закалённый', desc: '100 EV в пуле.' },
  { id: 'wanderer', icon: '🗺️', name: 'Странник', desc: '12 локаций Канто.' },
  { id: 'undefeated', icon: '👑', name: 'Непобедимый', desc: '10 побед подряд в диких боях.' },
  { id: 'courier', icon: '💌', name: 'Гонец', desc: 'Доставка Виридиан → Пьютер.' },
];

const BY_ID = new Map<string, TitleDef>(TITLES.map((t) => [t.id, t]));

export function getTitleById(id: string): TitleDef | undefined {
  return BY_ID.get(id);
}

export function isTitleId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}
