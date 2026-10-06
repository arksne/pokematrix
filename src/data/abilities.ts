/**
 * ============================================================
 * abilities.ts — СПРАВОЧНИК СПОСОБНОСТЕЙ (ABILITIES)
 * ============================================================
 * Единый источник истины о способностях. Раньше имена способностей были
 * захардкожены строками по всему бою (`if (abil === 'levitate')`), из-за чего:
 *   - нельзя было понять, какие способности вообще реализованы, а какие нет;
 *   - клиент не мог показать описание способности игроку;
 *   - одна и та же способность в разных местах писалась по-разному.
 *
 * Здесь только ДАННЫЕ: id, название, описание и триггеры. Логика срабатывания
 * живёт в движке (logic.ts / core.ts) — она ищет способность через `getAbility()`
 * и решает, что делать на конкретном триггере.
 *
 * Используется:
 *   logic.ts  — isStatusImmune, calculateDamage (иммунитеты, модификаторы урона)
 *   core.ts   — getEffectiveSpeed, эффекты конца хода, контактные способности
 *   ui/*.ts   — отображение способности в профиле и в бою
 *
 * Зависит: ничего (чистые данные).
 * ============================================================
 */

/**
 * Когда способность срабатывает.
 *   onSwitchIn      — при выходе на поле (Intimidate, Drought…)
 *   onDamageCalc    — при расчёте урона (Thick Fat, Filter, Wonder Guard…)
 *   onAfterHit      — после попадания по владельцу (Static, Rough Skin…)
 *   onEndTurn       — в конце хода (Speed Boost, Rain Dish…)
 *   onStatusAttempt — при попытке наложить статус (Immunity, Limber…)
 *   passive         — постоянный эффект (Swift Swim, Huge Power…)
 */
export type AbilityTrigger =
  | 'onSwitchIn'
  | 'onDamageCalc'
  | 'onAfterHit'
  | 'onEndTurn'
  | 'onStatusAttempt'
  | 'passive';

export interface AbilityDef {
  /** ID в kebab-case, совпадает с PokeAPI (`levitate`, `flash-fire`). */
  id: string;
  /** Название по-русски для интерфейса. */
  nameRu: string;
  /** Одно предложение: что делает. Показывается игроку. */
  short: string;
  /** Где срабатывает. */
  triggers: AbilityTrigger[];
  /**
   * Реализована ли механика в движке. У нереализованных стоит false —
   * они показываются игроку как «способность пока не работает», но не
   * молчат в бою, создавая ложное ожидание.
   */
  implemented: boolean;
}

export const ABILITIES: Record<string, AbilityDef> = {
  // ── Иммунитеты по типу ────────────────────────────────────────────
  levitate: {
    id: 'levitate', nameRu: 'Левитация',
    short: 'Иммунитет к атакам земляного типа.',
    triggers: ['onDamageCalc', 'onSwitchIn'], implemented: true,
  },
  'flash-fire': {
    id: 'flash-fire', nameRu: 'Вспышка',
    short: 'Иммунитет к огню; при попадании огнём усиливает свои огненные атаки.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'water-absorb': {
    id: 'water-absorb', nameRu: 'Водопоглощение',
    short: 'Иммунитет к воде; вода восстанавливает четверть максимального HP.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'volt-absorb': {
    id: 'volt-absorb', nameRu: 'Электропоглощение',
    short: 'Иммунитет к электричеству; электричество восстанавливает четверть HP.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'dry-skin': {
    id: 'dry-skin', nameRu: 'Сухая кожа',
    short: 'Иммунитет к воде, но огонь наносит на 25% больше; под дождём лечится, в жару теряет HP.',
    triggers: ['onDamageCalc', 'onEndTurn'], implemented: true,
  },
  'motor-drive': {
    id: 'motor-drive', nameRu: 'Мотор',
    short: 'Иммунитет к электричеству; при попадании повышает свою скорость.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'sap-sipper': {
    id: 'sap-sipper', nameRu: 'Сокосос',
    short: 'Иммунитет к травяным атакам; при попадании повышает свою атаку.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'storm-drain': {
    id: 'storm-drain', nameRu: 'Сток',
    short: 'Иммунитет к воде; при попадании повышает свою сп. атаку.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'lightning-rod': {
    id: 'lightning-rod', nameRu: 'Громоотвод',
    short: 'Иммунитет к электричеству; притягивает электрические атаки на себя.',
    triggers: ['onDamageCalc'], implemented: true,
  },

  // ── Иммунитеты к статусам ─────────────────────────────────────────
  immunity: {
    id: 'immunity', nameRu: 'Иммунитет',
    short: 'Покемона нельзя отравить: попытка наложить яд не срабатывает.',
    triggers: ['onStatusAttempt'], implemented: true,
  },
  limber: {
    id: 'limber', nameRu: 'Гибкость',
    short: 'Покемона нельзя парализовать: паралич на него не накладывается.',
    triggers: ['onStatusAttempt'], implemented: true,
  },
  insomnia: {
    id: 'insomnia', nameRu: 'Бессонница',
    short: 'Покемона нельзя усыпить: сон на него не накладывается.',
    triggers: ['onStatusAttempt'], implemented: true,
  },
  'vital-spirit': {
    id: 'vital-spirit', nameRu: 'Жизненная сила',
    short: 'Покемона нельзя усыпить: сон на него не накладывается.',
    triggers: ['onStatusAttempt'], implemented: true,
  },
  'water-veil': {
    id: 'water-veil', nameRu: 'Водная вуаль',
    short: 'Покемона нельзя обжечь: ожог на него не накладывается.',
    triggers: ['onStatusAttempt'], implemented: true,
  },
  'magma-armor': {
    id: 'magma-armor', nameRu: 'Магмовая броня',
    short: 'Покемона нельзя заморозить: заморозка на него не накладывается.',
    triggers: ['onStatusAttempt'], implemented: true,
  },
  comatose: {
    id: 'comatose', nameRu: 'Кома',
    short: 'Считается спящим всегда, но действует; статусы не накладываются.',
    triggers: ['onStatusAttempt'], implemented: true,
  },

  // ── Модификаторы урона ────────────────────────────────────────────
  'thick-fat': {
    id: 'thick-fat', nameRu: 'Толстый жир',
    short: 'Огонь и лёд наносят вдвое меньше урона.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  filter: {
    id: 'filter', nameRu: 'Фильтр',
    short: 'Сверхэффективные атаки наносят на 25% меньше.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'solid-rock': {
    id: 'solid-rock', nameRu: 'Твёрдая скала',
    short: 'Сверхэффективные атаки наносят на 25% меньше.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'wonder-guard': {
    id: 'wonder-guard', nameRu: 'Чудесная защита',
    short: 'Проходят только сверхэффективные атаки.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  sturdy: {
    id: 'sturdy', nameRu: 'Прочная броня',
    short: 'Оглушающая атака оставляет 1 HP. Иммунитет к атакам ваншотом.',
    triggers: ['onDamageCalc', 'onAfterHit'], implemented: true,
  },
  hustle: {
    id: 'hustle', nameRu: 'Суета',
    short: 'Атака выше на 50%, но физические атаки могут промахнуться.',
    triggers: ['onDamageCalc', 'passive'], implemented: true,
  },
  'sheer-force': {
    id: 'sheer-force', nameRu: 'Чистая сила',
    short: 'Убирает побочные эффекты атак, но повышает их урон на 30%.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  sniper: {
    id: 'sniper', nameRu: 'Снайпер',
    short: 'Критические удары наносят в полтора раза больше урона.',
    triggers: ['onDamageCalc'], implemented: true,
  },
  'super-luck': {
    id: 'super-luck', nameRu: 'Суперудача',
    short: 'Частота критических ударов повышена.',
    triggers: ['onDamageCalc'], implemented: false,  // TODO: crit stage +1
  },
  guts: {
    id: 'guts', nameRu: 'Кишки',
    short: 'Атака выше на 50%, пока покемон под статусом.',
    triggers: ['onDamageCalc'], implemented: false,  // TODO: ожог больше не снижает атаку, надо переосмыслить
  },
  'battle-armor': {
    id: 'battle-armor', nameRu: 'Боевая броня',
    short: 'Противник не может нанести критический удар.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'shell-armor': {
    id: 'shell-armor', nameRu: 'Панцирь',
    short: 'Противник не может нанести критический удар.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'mold-breaker': {
    id: 'mold-breaker', nameRu: 'Разрушитель',
    short: 'Игнорирует защитные способности противника.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'tinted-lens': {
    id: 'tinted-lens', nameRu: 'Цветные линзы',
    short: 'Неэффективные атаки наносят вдвое больше урона.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'scrappy': {
    id: 'scrappy', nameRu: 'Задира',
    short: 'Обычные и боевые атаки попадают по призракам.',
    triggers: ['onDamageCalc'], implemented: false,
  },

  // ── Контактные способности (срабатывают, когда бьют владельца) ─────
  static: {
    id: 'static', nameRu: 'Статика',
    short: '30% шанс парализовать атакующего при физическом контакте.',
    triggers: ['onAfterHit'], implemented: true,
  },
  'flame-body': {
    id: 'flame-body', nameRu: 'Пламенное тело',
    short: '30% шанс обжечь атакующего при физическом контакте.',
    triggers: ['onAfterHit'], implemented: true,
  },
  'poison-point': {
    id: 'poison-point', nameRu: 'Ядовитый шип',
    short: '30% шанс отравить атакующего при физическом контакте.',
    triggers: ['onAfterHit'], implemented: true,
  },
  'rough-skin': {
    id: 'rough-skin', nameRu: 'Грубая кожа',
    short: 'Атакующий теряет 1/8 своего макс. HP при физическом контакте.',
    triggers: ['onAfterHit'], implemented: true,
  },
  'iron-barbs': {
    id: 'iron-barbs', nameRu: 'Железные шипы',
    short: 'Атакующий теряет 1/8 своего макс. HP при физическом контакте.',
    triggers: ['onAfterHit'], implemented: true,
  },
  'effect-spore': {
    id: 'effect-spore', nameRu: 'Спора',
    short: '30% шанс наложить случайный статус на атакующего при контакте.',
    triggers: ['onAfterHit'], implemented: false,
  },
  'cute-charm': {
    id: 'cute-charm', nameRu: 'Милая приманка',
    short: '30% шанс понизить атаку атакующего при контакте.',
    triggers: ['onAfterHit'], implemented: false,
  },
  mummy: {
    id: 'mummy', nameRu: 'Мумия',
    short: 'При контакте меняет способность атакующего на Мумию.',
    triggers: ['onAfterHit'], implemented: false,
  },

  // ── Погодные способности ──────────────────────────────────────────
  'swift-swim': {
    id: 'swift-swim', nameRu: 'Быстрое плавание',
    short: 'Под дождём скорость удваивается.',
    triggers: ['passive'], implemented: true,
  },
  chlorophyll: {
    id: 'chlorophyll', nameRu: 'Хлорофилл',
    short: 'Под солнцем скорость удваивается.',
    triggers: ['passive'], implemented: true,
  },
  'sand-veil': {
    id: 'sand-veil', nameRu: 'Песчаная завеса',
    short: 'В песчаную бурю уклонение повышено.',
    triggers: ['passive'], implemented: false,
  },
  'snow-cloak': {
    id: 'snow-cloak', nameRu: 'Снежный плащ',
    short: 'В град уклонение повышено.',
    triggers: ['passive'], implemented: false,
  },
  'rain-dish': {
    id: 'rain-dish', nameRu: 'Блюдо дождя',
    short: 'Под дождём восстанавливает 1/16 HP каждый ход.',
    triggers: ['onEndTurn'], implemented: true,
  },
  'solar-power': {
    id: 'solar-power', nameRu: 'Солнечная сила',
    short: 'Под солнцем сп. атака выше на 50%, но каждый ход теряется HP.',
    triggers: ['passive', 'onEndTurn'], implemented: true,
  },
  drought: {
    id: 'drought', nameRu: 'Засуха',
    short: 'При выходе вызывает солнечную погоду на 5 ходов.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  drizzle: {
    id: 'drizzle', nameRu: 'Морось',
    short: 'При выходе вызывает дождь на 5 ходов.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  'sand-stream': {
    id: 'sand-stream', nameRu: 'Песчаный поток',
    short: 'При выходе вызывает песчаную бурю на 5 ходов.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  'snow-warning': {
    id: 'snow-warning', nameRu: 'Снежное предупреждение',
    short: 'При выходе вызывает град на 5 ходов.',
    triggers: ['onSwitchIn'], implemented: false,
  },

  // ── Способности при выходе на поле ────────────────────────────────
  intimidate: {
    id: 'intimidate', nameRu: 'Устрашение',
    short: 'При выходе понижает атаку противника на одну ступень.',
    triggers: ['onSwitchIn'], implemented: true,
  },
  'download': {
    id: 'download', nameRu: 'Загрузка',
    short: 'При выходе повышает атаку или сп. атаку в зависимости от защиты противника.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  trace: {
    id: 'trace', nameRu: 'Слежение',
    short: 'При выходе копирует способность противника.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  'pressure': {
    id: 'pressure', nameRu: 'Давление',
    short: 'Противник тратит вдвое больше PP за каждую атаку.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  'frisk': {
    id: 'frisk', nameRu: 'Проницательность',
    short: 'При выходе показывает удерживаемые предметы противника.',
    triggers: ['onSwitchIn'], implemented: false,
  },

  // ── Пассивные способности ─────────────────────────────────────────
  'huge-power': {
    id: 'huge-power', nameRu: 'Огромная сила',
    short: 'Физическая атака удваивается.',
    triggers: ['passive'], implemented: false,
  },
  'pure-power': {
    id: 'pure-power', nameRu: 'Чистая сила',
    short: 'Физическая атака удваивается.',
    triggers: ['passive'], implemented: false,
  },
  'speed-boost': {
    id: 'speed-boost', nameRu: 'Ускорение',
    short: 'В конце каждого хода повышает свою скорость.',
    triggers: ['onEndTurn'], implemented: false,
  },
  oblivious: {
    id: 'oblivious', nameRu: 'Беспечность',
    short: 'Иммунитет к привлекающим и запрещающим атакам.',
    triggers: ['onStatusAttempt'], implemented: false,
  },
  'own-tempo': {
    id: 'own-tempo', nameRu: 'Свой ритм',
    short: 'Иммунитет к замешательству.',
    triggers: ['onStatusAttempt'], implemented: false,
  },
  'tangled-feet': {
    id: 'tangled-feet', nameRu: 'Запутанные ноги',
    short: 'В замешательстве уклонение повышено.',
    triggers: ['passive'], implemented: false,
  },
  'magic-guard': {
    id: 'magic-guard', nameRu: 'Магическая защита',
    short: 'Получает урон только от прямых атак.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'neutralizing-gas': {
    id: 'neutralizing-gas', nameRu: 'Нейтрализующий газ',
    short: 'Пока покемон в бою, все способности подавлены.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  'unaware': {
    id: 'unaware', nameRu: 'Незнание',
    short: 'Игнорирует изменения статов противника и свои.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'infiltrator': {
    id: 'infiltrator', nameRu: 'Проникновение',
    short: 'Игнорирует барьеры противника и Заменитель.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'keen-eye': {
    id: 'keen-eye', nameRu: 'Зоркий глаз',
    short: 'Точность не может быть понижена.',
    triggers: ['passive'], implemented: false,
  },
  'hyper-cutter': {
    id: 'hyper-cutter', nameRu: 'Гиперрезак',
    short: 'Атака не может быть понижена противником.',
    triggers: ['passive'], implemented: false,
  },
  'clear-body': {
    id: 'clear-body', nameRu: 'Чистое тело',
    short: 'Статы не могут быть понижены противником.',
    triggers: ['passive'], implemented: false,
  },
  'white-smoke': {
    id: 'white-smoke', nameRu: 'Белый дым',
    short: 'Статы не могут быть понижены противником.',
    triggers: ['passive'], implemented: false,
  },
  'natural-cure': {
    id: 'natural-cure', nameRu: 'Природное лечение',
    short: 'При уходе с поля снимает свои статусы.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  'regenerator': {
    id: 'regenerator', nameRu: 'Регенерация',
    short: 'При уходе с поля восстанавливает треть максимального HP.',
    triggers: ['onSwitchIn'], implemented: false,
  },
  'rock-head': {
    id: 'rock-head', nameRu: 'Каменная голова',
    short: 'Не получает урон от отдачи своих атак.',
    triggers: ['passive'], implemented: false,
  },
  'reckless': {
    id: 'reckless', nameRu: 'Безрассудство',
    short: 'Атаки с отдачей наносят на 20% больше урона.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'technician': {
    id: 'technician', nameRu: 'Техник',
    short: 'Слабые атаки (сила ≤ 60) наносят на 50% больше урона.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'adaptability': {
    id: 'adaptability', nameRu: 'Адаптивность',
    short: 'Бонус за совпадение типа выше: 2× вместо 1.5×.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'serene-grace': {
    id: 'serene-grace', nameRu: 'Безмятежность',
    short: 'Шанс побочного эффекта атак удваивается.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'compound-eyes': {
    id: 'compound-eyes', nameRu: 'Фасеточные глаза',
    short: 'Точность повышена на 30%.',
    triggers: ['passive'], implemented: false,
  },
  'no-guard': {
    id: 'no-guard', nameRu: 'Без защиты',
    short: 'Все атаки обеих сторон всегда попадают.',
    triggers: ['passive'], implemented: false,
  },
  'sand-rush': {
    id: 'sand-rush', nameRu: 'Песчаный натиск',
    short: 'В песчаную бурю скорость удваивается.',
    triggers: ['passive'], implemented: false,
  },
  'slush-rush': {
    id: 'slush-rush', nameRu: 'Снежный натиск',
    short: 'В град скорость удваивается.',
    triggers: ['passive'], implemented: false,
  },
  'hydration': {
    id: 'hydration', nameRu: 'Увлажнение',
    short: 'Под дождём снимает свой статус в конце хода.',
    triggers: ['onEndTurn'], implemented: false,
  },
  'ice-body': {
    id: 'ice-body', nameRu: 'Ледяное тело',
    short: 'В град восстанавливает 1/16 HP каждый ход.',
    triggers: ['onEndTurn'], implemented: false,
  },
  'shed-skin': {
    id: 'shed-skin', nameRu: 'Линька',
    short: 'Треть шанс снять свой статус в конце хода.',
    triggers: ['onEndTurn'], implemented: false,
  },
  'poison-heal': {
    id: 'poison-heal', nameRu: 'Ядовитое лечение',
    short: 'Вместо урона от отравления восстанавливает HP.',
    triggers: ['onEndTurn'], implemented: false,
  },
  'truant': {
    id: 'truant', nameRu: 'Лентяй',
    short: 'Покемон действует через ход: после каждой атаки пропускает следующую.',
    triggers: ['passive'], implemented: false,
  },
  'slow-start': {
    id: 'slow-start', nameRu: 'Медленный старт',
    short: 'Первые 5 ходов атака и скорость вдвое ниже.',
    triggers: ['passive'], implemented: false,
  },
  'defeatist': {
    id: 'defeatist', nameRu: 'Пессимизм',
    short: 'При половине HP атака и сп. атака вдвое ниже.',
    triggers: ['passive'], implemented: false,
  },
  'multiscale': {
    id: 'multiscale', nameRu: 'Многослойность',
    short: 'При полном HP получает вдвое меньше урона.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'shadow-shield': {
    id: 'shadow-shield', nameRu: 'Теневая защита',
    short: 'При полном HP получает вдвое меньше урона.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'fluffy': {
    id: 'fluffy', nameRu: 'Пушистый',
    short: 'Физический урон вдвое меньше, огонь вдвое больше.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'punk-rock': {
    id: 'punk-rock', nameRu: 'Панк-рок',
    short: 'Звуковые атаки на 30% сильнее, получаемый урон от них на 50% меньше.',
    triggers: ['onDamageCalc'], implemented: false,
  },
  'queenly-majesty': {
    id: 'queenly-majesty', nameRu: 'Королевское величие',
    short: 'Противник не может использовать приоритетные атаки.',
    triggers: ['passive'], implemented: false,
  },
  'dazzling': {
    id: 'dazzling', nameRu: 'Ослепление',
    short: 'Противник не может использовать приоритетные атаки.',
    triggers: ['passive'], implemented: false,
  },
  'prankster': {
    id: 'prankster', nameRu: 'Шалун',
    short: 'Статус-атаки получают +1 к приоритету.',
    triggers: ['passive'], implemented: false,
  },
  'gale-wings': {
    id: 'gale-wings', nameRu: 'Буревестник',
    short: 'Летящие атаки получают +1 к приоритету при полном HP.',
    triggers: ['passive'], implemented: false,
  },
  'triage': {
    id: 'triage', nameRu: 'Сортировка',
    short: 'Лечащие атаки получают +3 к приоритету.',
    triggers: ['passive'], implemented: false,
  },
};

/**
 * getAbility — получить описание способности по ID.
 * Возвращает undefined, если такой способности нет в справочнике: неизвестные
 * способности движок игнорирует, а UI показывает только название из PokeAPI.
 */
export function getAbility(id: string | null | undefined): AbilityDef | undefined {
  if (!id) return undefined;
  return ABILITIES[id];
}

/** Название по-русски, либо сам ID, если способности нет в справочнике. */
export function getAbilityNameRu(id: string | null | undefined): string {
  if (!id) return '';
  return ABILITIES[id]?.nameRu || id;
}

/** True, если способность срабатывает на указанном триггере. */
export function abilityHasTrigger(id: string | null | undefined, trigger: AbilityTrigger): boolean {
  const def = getAbility(id);
  return !!def && def.triggers.includes(trigger);
}

/** True, если механика способности реализована в движке. */
export function isAbilityImplemented(id: string | null | undefined): boolean {
  return !!getAbility(id)?.implemented;
}

/** Количество способностей в справочнике — для отчётов и тестов. */
export const ABILITY_COUNT = Object.keys(ABILITIES).length;
