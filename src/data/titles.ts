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
  { id: 'tideMaster', icon: '🌊', name: 'Покоритель волн', desc: 'Победа над Пловцом Финном.' },
  { id: 'stormRod', icon: '⚡', name: 'Громоотвод', desc: 'Победа над Матросом Вольтом.' },
  { id: 'leafFriend', icon: '🍃', name: 'Друг листвы', desc: 'Победа над Садовницей Флорой.' },
  { id: 'mindBender', icon: '🌀', name: 'Разумник', desc: 'Победа над Медиумом Эспером.' },
  { id: 'fuchsiaShadow', icon: '🥷', name: 'Тень Фуксии', desc: 'Победа над Учеником Коги.' },
  { id: 'fireSpirit', icon: '🔥', name: 'Огненный дух', desc: 'Победа над Пирокинетиком Блейзом.' },
  { id: 'rBane', icon: '🕶️', name: 'Кара R', desc: 'Победа над Агентом R.' },
  { id: 'skyLord', icon: '🦅', name: 'Властелин небес', desc: 'Победа над Пилотом Скаем.' },
  { id: 'swarmKin', icon: '🐝', name: 'Роевой', desc: 'Победа над Ловцом Жуков Роем.' },
  { id: 'goldenStar', icon: '🌟', name: 'Звезда Голденрода', desc: 'Победа над Суперфанатом Нормом.' },
  { id: 'spiritFriend', icon: '🎐', name: 'Друг духов', desc: 'Победа над Медиумом Тенью.' },
  { id: 'ironFist', icon: '👊', name: 'Железный кулак', desc: 'Победа над Учеником Чака.' },
  { id: 'steelWill', icon: '⚙️', name: 'Стальной характер', desc: 'Победа над Инженером Сталью.' },
  { id: 'winterHeart', icon: '❄️', name: 'Сердце зимы', desc: 'Победа над Морозко.' },
  { id: 'dragonBlood', icon: '🐉', name: 'Кровь драконов', desc: 'Победа над Наследницей Клер.' },
  { id: 'cerUnsinkable', icon: '🛟', name: 'Непотопляемый', desc: '12 побед подряд.' },
  { id: 'verGrounded', icon: '🔌', name: 'Заземлённый', desc: '14 побед подряд.' },
  { id: 'celUnfading', icon: '🌺', name: 'Неувядаемый', desc: '16 побед подряд.' },
  { id: 'safClosedBook', icon: '📕', name: 'Закрытая книга', desc: '18 побед подряд.' },
  { id: 'fucSilent', icon: '🤫', name: 'Бесшумный', desc: '20 побед подряд.' },
  { id: 'cinUnburnt', icon: '🧯', name: 'Несгораемый', desc: '22 победы подряд.' },
  { id: 'virIncorruptible', icon: '💎', name: 'Неподкупный', desc: '24 победы подряд.' },
  { id: 'vioFreeWind', icon: '🪁', name: 'Вольный ветер', desc: '26 побед подряд.' },
  { id: 'azaSting', icon: '📌', name: 'Жало', desc: '28 побед подряд.' },
  { id: 'golIdol', icon: '🎤', name: 'Кумир', desc: '30 побед подряд.' },
  { id: 'ecrIncorporeal', icon: '👤', name: 'Бестелесный', desc: '32 победы подряд.' },
  { id: 'ciaUnbroken', icon: '⛓️‍💥', name: 'Несломленный', desc: '34 победы подряд.' },
  { id: 'oliStainless', icon: '🪞', name: 'Нержавеющий', desc: '36 побед подряд.' },
  { id: 'mahWarmHeart', icon: '💓', name: 'Тёплое сердце', desc: '38 побед подряд.' },
  { id: 'blaDragonlord', icon: '🐲', name: 'Повелитель драконов', desc: '40 побед подряд.' },
];

const BY_ID = new Map<string, TitleDef>(TITLES.map((t) => [t.id, t]));

export function getTitleById(id: string): TitleDef | undefined {
  return BY_ID.get(id);
}

export function isTitleId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}
