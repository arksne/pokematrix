// ─────────────────────────────────────────────────────────────
// johto-2.ts — ПАЧКА ЛЕСЕНКИ: Сианвуд, Оливин, Махогани, Блэкторн (40 квестов, ФИНАЛ)
// ─────────────────────────────────────────────────────────────
// Источник: docs/QUESTS-LADDER.md, разделы 12–15 + Приложение A (новее таблиц).
// Форма NPC/квестов — как pewter_researcher в src/data/npc.ts:
//   у квеста ВСЕ поля явно (targetItem: null где не надо, prereqQuest: null).
// Правила:
//   - id NPC с префиксом города (cia_/oli_/mah_/bla_); реле/финалы доставок —
//     полными именами (cianwood_courier, olivine_relay и т.д., как pewter_courier).
//   - location ∈ REGIONS; trainingGrounds НЕ существуют — наставники в
//     Stadium + // TODO: trainingGrounds.
//   - Награды уже с ремапом Приложения A (tmTop-тир, premierBall, maxHoney…).
//   - Титулы ТОЛЬКО из «30 титулов» (боссы + стрики); остальным — без титула.
//   - filter.bossId — ключи gyms.ts байт-в-байт.
//   - Пулы typeSpecies/speciesList — только реальные виды (меньше, но точно).
// ─────────────────────────────────────────────────────────────

export const JOHTO2_NPCS = {
  // ══════════ СИАНВУД (n=12, бой) ══════════
  'cia_pharmacist': {
    id: 'cia_pharmacist', name: 'Фармацевт', sprite: '💊', location: 'cianwoodCity',
    dialog: {
      greet: 'Аптека Сианвуда: мази от ушибов, бинты, стимуляторы. Бойцы ломаются — я чиню. Поможешь с полевыми данными?',
      default: 'Спарринги гремят с утра до ночи. Заходи за пластырем.',
      quest_offer: 'Нужно: {target} {item}. Додзё никуда не спешит, а синяки — тем более.',
      quest_complete: 'Отличные данные! Держи награду из аптечных запасов.',
      quest_incomplete: 'Сбор данных не окончен. Бойцы ждут...',
    },
    quests: [
      { id: 'cia_trail', type: 'defeat_x', targetItem: null, targetQty: 645, desc: 'Победи 645 диких бойцовых + исходи 18 локаций (средний уровень 75)', rewardMoney: 65000, rewardItem: 'tmTop', rewardQty: 1, rewardItems: [{ id: 'fullRestore', qty: 3 }], prereqQuest: null, filter: { types: ['fighting'] }, verify: { avgLevel: 75, locs: ['cianwoodCity', 'seaRoute40', 'seaRoute41', 'whirlIslands', 'olivineCity', 'route37', 'route38', 'route39', 'mtMortar', 'route42', 'route43', 'lakeOfRage', 'mahoganyTown', 'route44', 'icePath', 'ecruteakCity', 'bellTower', 'blackthornCity'] } },
      { id: 'cia_roids', type: 'use_item', targetItem: null, targetQty: 45, desc: 'Используй 45 X Attack (раздай спарринг-партнёрам додзё)', rewardMoney: 59000, rewardItem: 'protein', rewardQty: 1, prereqQuest: null, filter: { itemId: 'xAttack' } },
    ],
  },
  'cia_surf': {
    id: 'cia_surf', name: 'Прибой', sprite: '🏄', location: 'seaRoute41',
    dialog: {
      greet: 'Сорок первый маршрут: волна, ветер, водовороты. Мачопы гребут сюда тренироваться — сосчитаешь их кулаками?',
      default: 'Держись гребня. Океан уважает упорных.',
      quest_offer: 'Побей три сотни Мачопов и Мачоков в додзё и округе. Тысяча спаррингов начинается с первого!',
      quest_complete: 'Тысяча спаррингов засчитана! Пояс твой, боец.',
      quest_incomplete: 'Мачопы ещё толпятся у берега... Продолжай!',
    },
    quests: [
      { id: 'cia_dojo', type: 'defeat_x', targetItem: null, targetQty: 320, desc: 'Победи 320 Machop/Machoke в додзё и округе', rewardMoney: 65000, rewardItem: 'blackBelt', rewardQty: 1, prereqQuest: null, filter: { speciesList: ['machop', 'machoke'] } },
    ],
  },
  'cia_mentor': {
    id: 'cia_mentor', name: 'Додзё', sprite: '🏋️', location: 'cianwoodStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Додзё Сианвуда: пот, маты и тысяча поклонов. Бей сверху — и никогда не пропускай тренировки!',
      default: 'Отдых — тоже тренировка. Но только после спаррингов!',
      quest_offer: 'Программа требует {target} {item}. Полотенце не забудь!',
      quest_complete: 'Несломленный! Додзё гордится тобой. Держи пояс чемпиона.',
      quest_incomplete: 'Программа не выполнена. Круг ещё не закрыт...',
    },
    quests: [
      { id: 'cia_counter', type: 'defeat_x', targetItem: null, targetQty: 320, desc: 'Победи 320 диких летающих/психических (бей сверху!)', rewardMoney: 65000, rewardItem: 'skyPlate', rewardQty: 1, prereqQuest: null, filter: { types: ['flying', 'psychic'] } },
      { id: 'cia_streak', type: 'streak_x', targetItem: null, targetQty: 34, desc: '34 победы подряд в диких боях (без поражений и побегов)', rewardMoney: 390000, rewardItem: 'muscleBand', rewardQty: 1, rewardTitle: 'ciaUnbroken', prereqQuest: null },
    ],
  },
  'cia_shell': {
    id: 'cia_shell', name: 'Ракушка', sprite: '💰', location: 'cianwoodCity_pokemart',
    dialog: {
      greet: 'Призовой фонд додзё проходит через меня. Покажи оборот — получишь мёд. Много мёда.',
      default: 'Торгуй, сражайся, богатей. Ракушка шумит монетами.',
      quest_offer: 'Оборот 25 000 000. Легальный. Почти. Справишься?',
      quest_complete: 'Солидный фонд! Мёд твой, чемпион кассы.',
      quest_incomplete: 'Касса пока мелкая... Греби дальше!',
    },
    quests: [
      { id: 'cia_money', type: 'earn_money', targetItem: null, targetQty: 25000000, desc: 'Заработай 25 000 000 боями и торговлей', rewardMoney: 65000, rewardItem: 'maxHoney', rewardQty: 26, prereqQuest: null },
    ],
  },
  'cia_shoal': {
    id: 'cia_shoal', name: 'Отмель', sprite: '🥚', location: 'cianwoodCity_pokecenter',
    dialog: {
      greet: 'Отмель тихая, тёплая — яйца здесь вылупляются крепкими, как кулаки Чака. Докажешь?',
      default: 'Тепло, забота и немного удачи. Центр всегда открыт.',
      quest_offer: 'Семь вылупленных яиц. Живых. Пищащих. Спарринг-потомство ждёт!',
      quest_complete: 'Какая прелесть! Держи камень зари — чтоб помнили.',
      quest_incomplete: 'Яйца ещё не вылупились... Греет инкубатор?',
    },
    quests: [
      { id: 'cia_breed', type: 'hatch_x', targetItem: null, targetQty: 7, desc: 'Выведи и вылупи 7 яиц (спарринг-потомство)', rewardMoney: 104000, rewardItem: 'dawnStone', rewardQty: 1, prereqQuest: null },
    ],
  },
  'cia_hermit': {
    id: 'cia_hermit', name: 'Отшельник', sprite: '🧘', location: 'whirlIslands',
    dialog: {
      greet: 'Водовороты шумят, пещеры молчат. Я закалял тело в их тишине — покажи мне своё железное тело.',
      default: 'Дыши медленно. Сила копится в тишине.',
      quest_offer: 'Набери 460 EV в пул команды. Железо не гнётся — оно крепнет.',
      quest_complete: 'Железное тело! Водовороты признают тебя.',
      quest_incomplete: 'Пул ещё жидковат... Тренируйся в глубине.',
    },
    quests: [
      { id: 'cia_temper', type: 'special', targetItem: null, targetQty: 1, desc: 'Набери 460 EV в пул команды (железное тело)', rewardMoney: 130000, rewardItem: 'choiceSpecs', rewardQty: 1, prereqQuest: null, verify: { evPool: 460 } },
    ],
  },
  'cia_champ': {
    id: 'cia_champ', name: 'Ученик Чака', sprite: '🥋', location: 'cianwoodStadium',
    miniBoss: { leaderKey: 'cianwoodPupil', label: '🥋 Сразиться (команда 6×Lv88)' },
    dialog: {
      greet: 'Учитель Чак ковал меня тысячей ударов. Шесть моих бойцов — его тысяча первый. Выстоишь?',
      default: 'Тренируйся у моря. Кулак любит упорных.',
      quest_offer: 'Побей меня в честном бою — команда 6×Lv88. Один бой, одна судьба!',
      quest_complete: 'Тысяча первый удар — твой! Кулак признаёт тебя. Держи приз и титул.',
      quest_incomplete: 'Сначала победи меня в додзё. Маты не прощают суеты.',
    },
    quests: [
      { id: 'cia_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Ученика Чака (команда 6×Lv88)', rewardMoney: 195000, rewardItem: 'tmTop', rewardQty: 1, rewardItems: [{ id: 'rareCandy', qty: 3 }], rewardTitle: 'ironFist', prereqQuest: null, filter: { bossId: 'cianwoodPupil' } },
    ],
  },
  'cia_volna': {
    id: 'cia_volna', name: 'Волна', sprite: '⛴️', location: 'ecruteakCity',
    parcel: { questId: 'cia_courier', itemId: 'ciaLeg1', label: '📦 Взять тюк для Сианвуда' },
    dialog: {
      greet: 'Паром Эйкрутик — Сианвуд отходит по волне. Тюк в Сианвуд надо доставить морем. Возьмёшься? Не вскрывать!',
      default: 'Тюк ждёт курьера. Волна попутная!',
      quest_offer: 'Довези запечатанный тюк курьеру в Сианвуд через Оливин.',
      quest_complete: 'Тюк уже не у меня — вези его!',
      quest_incomplete: 'Тюк ещё у тебя? Вези морем, не вскрывай!',
    },
    quests: [],
  },
  'olivine_relay': {
    id: 'olivine_relay', name: 'Передатчик Оливин', sprite: '🔁', location: 'olivineCity',
    exchange: { questId: 'cia_courier', takeItem: 'ciaLeg1', giveItem: 'ciaLeg2', label: '🔁 Передать тюк через Оливин' },
    dialog: {
      greet: 'Перевалочный пункт Оливина: грузы с севера — на юг, с юга — на север. Тюк на Сианвуд? Перепакуем!',
      default: 'Цепочка не ждёт. Меняй груз — и дальше в путь.',
      quest_offer: 'Обменяй тюк на следующий этап маршрута.',
      quest_complete: 'Груз уже не у меня — вези его!',
      quest_incomplete: 'Без груза не обменяю... Привози!',
    },
    quests: [],
  },
  'cianwood_courier': {
    id: 'cianwood_courier', name: 'Курьер Сианвуда', sprite: '🛵', location: 'cianwoodCity',
    dialog: {
      greet: 'Тюк из Эйкрутика через Оливин? Давай сюда — проверю печати!',
      default: 'Жду грузы с моря.',
      quest_offer: 'Принеси тюк от Волны через Оливин.',
      quest_complete: 'Цел! Держи конфеты за скорость и морскую качку.',
      quest_incomplete: 'Без тюка не сдам... то есть не приму!',
    },
    quests: [
      { id: 'cia_courier', type: 'collect_items', targetItem: 'ciaLeg2', targetQty: 1, desc: 'Довези тюк Эйкрутик → Оливин → Сианвуд (2 плеча)', rewardMoney: 59000, rewardItem: 'carbos', rewardQty: 2, prereqQuest: null },
    ],
  },
  // ══════════ ОЛИВИН (n=13, сталь) ══════════
  'olivine_beacon': {
    id: 'olivine_beacon', name: 'Маячник', sprite: '🔦', location: 'olivineCity',
    dialog: {
      greet: 'Маяк Оливина светит сталью: рельсы, пирс, магнитные аномалии. Поможешь с полевыми данными?',
      default: 'Свет не гаснет. Продолжай наблюдения.',
      quest_offer: 'Нужно: {target} {item}. Рельсы никуда не спешат.',
      quest_complete: 'Отличные данные! Держи награду из фондов маяка.',
      quest_incomplete: 'Сбор данных не окончен. Рельсы ждут...',
    },
    quests: [
      { id: 'oli_trail', type: 'defeat_x', targetItem: null, targetQty: 755, desc: 'Победи 755 диких стальных + исходи 20 локаций (средний уровень 75)', rewardMoney: 70000, rewardItem: 'tmTop', rewardQty: 1, rewardItems: [{ id: 'maxElixir', qty: 1 }], prereqQuest: null, filter: { types: ['steel'] }, verify: { avgLevel: 75, locs: ['olivineCity', 'olivinePier', 'route34', 'route35', 'route36', 'route37', 'route38', 'route39', 'seaRoute40', 'seaRoute41', 'whirlIslands', 'cianwoodCity', 'mtMortar', 'route42', 'ecruteakCity', 'bellTower', 'burnedTower', 'nationalPark', 'goldenrodCity', 'unionCave'] } },
    ],
  },
  'oli_storm': {
    id: 'oli_storm', name: 'Шторм', sprite: '🌊', location: 'seaRoute40',
    dialog: {
      greet: 'Сороковой маршрут не прощает зевак: утёсы, магнитные бури, редкие скалы. Видел Шаклов на утёсах? А Магнемайтов в аномалии?',
      default: 'Шторм шумит — редкости подходят ближе. Выслеживай.',
      quest_offer: 'Нужны живые редкости: держатели утёсов и дети магнитной бури.',
      quest_complete: 'Вот это добыча! Шторм теперь твой.',
      quest_incomplete: 'Редкости всё ещё прячутся в волнах...',
    },
    quests: [
      { id: 'oli_cliffs', type: 'catch_x', targetItem: null, targetQty: 5, desc: 'Поймай Shuckle ×5 (держатся за утёсы!)', rewardMoney: 350000, rewardItem: 'friendBall', rewardQty: 5, prereqQuest: null, filter: { species: 'shuckle' } },
      { id: 'oli_sky', type: 'catch_x', targetItem: null, targetQty: 5, desc: 'Поймай Magnemite ×5 (магнитная аномалия)', rewardMoney: 350000, rewardItem: 'premierBall', rewardQty: 30, prereqQuest: null, filter: { species: 'magnemite' } },
    ],
  },
  'oli_mentor': {
    id: 'oli_mentor', name: 'Маяк', sprite: '🏋️', location: 'olivineStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Маяк закаляет: плавильный котёл, ржавчина — враг, победы — всё. Выдержишь мою программу без ржавчины?',
      default: 'Отдых — тоже тренировка. Но только после спаррингов!',
      quest_offer: 'Программа требует {target} {item}. Полотенце не забудь!',
      quest_complete: 'Нержавеющий! Маяк гордится тобой.',
      quest_incomplete: 'Программа не выполнена. Круг ещё не закрыт...',
    },
    quests: [
      { id: 'oli_counter', type: 'defeat_x', targetItem: null, targetQty: 375, desc: 'Победи 375 диких огненных/бойцовых/земляных (плавильный котёл!)', rewardMoney: 70000, rewardItem: 'hardStone', rewardQty: 1, prereqQuest: null, filter: { types: ['fire', 'fighting', 'ground'] } },
      { id: 'oli_streak', type: 'streak_x', targetItem: null, targetQty: 36, desc: '36 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 420000, rewardItem: 'wiseGlasses', rewardQty: 1, rewardTitle: 'oliStainless', prereqQuest: null },
    ],
  },
  'oli_anchor': {
    id: 'oli_anchor', name: 'Якорь', sprite: '💰', location: 'olivineCity_pokemart',
    dialog: {
      greet: 'Портовые сборы проходят через меня: швартовка, краны, склады. Покажи оборот — получишь мёд.',
      default: 'Торгуй, сражайся, богатей. Якорь держит кассу.',
      quest_offer: 'Оборот 40 000 000. Легальный. Почти. Справишься?',
      quest_complete: 'Солидные сборы! Мёд твой, портовый магнат.',
      quest_incomplete: 'Касса пока мелкая... Греби дальше!',
    },
    quests: [
      { id: 'oli_money', type: 'earn_money', targetItem: null, targetQty: 40000000, desc: 'Заработай 40 000 000 боями и торговлей', rewardMoney: 70000, rewardItem: 'maxHoney', rewardQty: 30, prereqQuest: null },
    ],
  },
  'oli_harbor': {
    id: 'oli_harbor', name: 'Гавань', sprite: '🥚', location: 'olivineCity_pokecenter',
    dialog: {
      greet: 'Гавань тёплая даже в шторм: горн гудит, яйца зреют. Закалишь кладку в горне?',
      default: 'Тепло, забота и немного удачи. Центр всегда открыт.',
      quest_offer: 'Восемь вылупленных яиц. Живых. Пищащих. Закалённых в горне!',
      quest_complete: 'Какая прелесть! Держи камень сумерек — чтоб помнили.',
      quest_incomplete: 'Яйца ещё не вылупились... Греет горн?',
    },
    quests: [
      { id: 'oli_breed', type: 'hatch_x', targetItem: null, targetQty: 8, desc: 'Выведи и вылупи 8 яиц (закалка в горне)', rewardMoney: 112000, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: null },
    ],
  },
  'oli_pier': {
    id: 'oli_pier', name: 'Причал', sprite: '⚓', location: 'olivinePier',
    dialog: {
      greet: 'Причал скрипит, чайки кричат, сталь не ржавеет — если её ковать. Покажи мне нержавейку своей команды.',
      default: 'Соль ест слабых. Крепких — полирует.',
      quest_offer: 'Набери 480 EV в пул команды. Нержавейка не гнётся!',
      quest_complete: 'Нержавейка! Причал признаёт тебя.',
      quest_incomplete: 'Пул ещё жидковат... Куй дальше.',
    },
    quests: [
      { id: 'oli_temper', type: 'special', targetItem: null, targetQty: 1, desc: 'Набери 480 EV в пул команды (нержавейка)', rewardMoney: 140000, rewardItem: 'focusSash', rewardQty: 1, prereqQuest: null, verify: { evPool: 480 } },
    ],
  },
  'oli_steel': {
    id: 'oli_steel', name: 'Сталь', sprite: '⚙️', location: 'olivineStadium',
    miniBoss: { leaderKey: 'olivineSteel', label: '⚙️ Сразиться (команда 6×Lv88)' },
    dialog: {
      greet: 'Я инженер маяка, моя команда — шестерни одной машины. Шесть бойцов 88-го. Проверка на прочность?',
      default: 'Тренируйся у горна. Сталь любит упорных.',
      quest_offer: 'Побей меня в честном бою — команда 6×Lv88. Один бой, одна судьба!',
      quest_complete: 'Проверка пройдена! Характер — стальной. Держи приз и титул.',
      quest_incomplete: 'Сначала победи меня у маяка. Шестерни не прощают суеты.',
    },
    quests: [
      { id: 'oli_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Инженера Сталь (команда 6×Lv88)', rewardMoney: 210000, rewardItem: 'tm91', rewardQty: 1, rewardItems: [{ id: 'rareCandy', qty: 3 }], rewardTitle: 'steelWill', prereqQuest: null, filter: { bossId: 'olivineSteel' } },
    ],
  },
  'cia_reys': {
    id: 'cia_reys', name: 'Рейс', sprite: '⛴️', location: 'cianwoodCity',
    parcel: { questId: 'oli_potion', itemId: 'secretPotion', label: '💊 Взять лекарство для Амфарос' },
    dialog: {
      greet: 'Рейс на Оливин отходит! Амфарос с маяка больна — секретное зелье надо доставить морем. Возьмёшься? Не вскрывать!',
      default: 'Лекарство ждёт курьера. Море волнуется!',
      quest_offer: 'Довези секретное зелье лекарям Оливина. Амфарос ждёт!',
      quest_complete: 'Зелье уже не у меня — вези его скорее!',
      quest_incomplete: 'Зелье ещё у тебя? Амфарос ждёт, поторопись!',
    },
    quests: [],
  },
  'olivine_healer': {
    id: 'olivine_healer', name: 'Лекарь Маяка', sprite: '🏥', location: 'olivineCity',
    dialog: {
      greet: 'Медпункт маяка: Амфарос светит слабее с каждым днём... Лекарство из Сианвуда? Давай сюда скорее!',
      default: 'Слежу за маяком и за больной. Свет должен гореть.',
      quest_offer: 'Принеси секретное зелье от Рейса из Сианвуда.',
      quest_complete: 'Амфарос спасена! Свет горит ярко. Держи конфеты за скорость.',
      quest_incomplete: 'Без зелья не справлюсь... Поторопись к Амфарос!',
    },
    quests: [
      { id: 'oli_potion', type: 'collect_items', targetItem: 'secretPotion', targetQty: 1, desc: 'Довези Secret Potion из Сианвуда для больной Амфарос с маяка', rewardMoney: 63000, rewardItem: 'rareCandy', rewardQty: 10, prereqQuest: null },
    ],
  },
  // ══════════ МАХОГАНИ (n=14, лёд) ══════════
  'mah_glacier': {
    id: 'mah_glacier', name: 'Гляциолог', sprite: '🧊', location: 'mahoganyTown',
    dialog: {
      greet: 'Махогани дышит холодом: ледник, озеро, северные маршруты. Поможешь с полевыми данными и переписью севера?',
      default: 'Лёд помнит всё. Продолжай наблюдения.',
      quest_offer: 'Нужно: {target} {item}. Мороз никуда не спешит.',
      quest_complete: 'Отличные данные! Держи награду из гляциологических фондов.',
      quest_incomplete: 'Сбор данных не окончен. Снега ждут...',
    },
    quests: [
      { id: 'mah_trail', type: 'defeat_x', targetItem: null, targetQty: 875, desc: 'Победи 875 диких ледяных + исходи 22 локации (средний уровень 75)', rewardMoney: 75000, rewardItem: 'tm52', rewardQty: 1, rewardItems: [{ id: 'maxElixir', qty: 2 }], prereqQuest: null, filter: { types: ['ice'] }, verify: { avgLevel: 75, locs: ['mahoganyTown', 'route42', 'route43', 'lakeOfRage', 'route44', 'icePath', 'blackthornCity', 'mtMortar', 'ecruteakCity', 'burnedTower', 'bellTower', 'route35', 'route36', 'route37', 'route38', 'route39', 'olivineCity', 'seaRoute40', 'whirlIslands', 'cianwoodCity', 'nationalPark', 'goldenrodCity'] } },
      { id: 'mah_dex', type: 'special', targetItem: null, targetQty: 1, desc: 'Перепись севера: собери 400 видов в дексе', rewardMoney: 450000, rewardItem: 'ppMax', rewardQty: 2, prereqQuest: null, verify: { dexCount: 400 } },
    ],
  },
  'mah_lake': {
    id: 'mah_lake', name: 'Озеро', sprite: '🎣', location: 'lakeOfRage',
    dialog: {
      greet: 'Озеро Ярости кипит: Свайнубы толпятся у берегов, а среди Мэджикарпов мелькает... красный? Проверь сам!',
      default: 'Озеро гневается — но рыбакам улыбается. Закидывай!',
      quest_offer: 'Нужна зачистка берегов и красная ярость живьём. Слышишь всплеск?',
      quest_complete: 'Вот это улов! Озеро присмирело — пока что.',
      quest_incomplete: 'Ярость всё ещё бурлит у берегов...',
    },
    quests: [
      { id: 'mah_rage', type: 'defeat_x', targetItem: null, targetQty: 435, desc: 'Победи 435 Swinub/Piloswine у Озера Ярости', rewardMoney: 75000, rewardItem: 'neverMeltIce', rewardQty: 1, prereqQuest: null, filter: { speciesList: ['swinub', 'piloswine'] } },
      { id: 'mah_red', type: 'catch_x', targetItem: null, targetQty: 60, desc: 'Поймай 60 Magikarp/Gyarados (красный где-то среди них...)', rewardMoney: 75000, rewardItem: 'mysticWater', rewardQty: 1, prereqQuest: null, filter: { speciesList: ['magikarp', 'gyarados'] } },
    ],
  },
  'mah_mentor': {
    id: 'mah_mentor', name: 'Лёд', sprite: '🏋️', location: 'mahoganyStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Лёд Махогани: оттепель — враг, горячее сердце — всё. Выдержишь мою программу?',
      default: 'Отдых — тоже тренировка. Но только после спаррингов!',
      quest_offer: 'Программа требует {target} {item}. Варежки не забудь!',
      quest_complete: 'Тёплое сердце! Лёд гордится тобой.',
      quest_incomplete: 'Программа не выполнена. Круг ещё не закрыт...',
    },
    quests: [
      { id: 'mah_counter', type: 'defeat_x', targetItem: null, targetQty: 435, desc: 'Победи 435 диких огненных/бойцовых/каменных/стальных (оттепель!)', rewardMoney: 75000, rewardItem: 'iceStone', rewardQty: 1, prereqQuest: null, filter: { types: ['fire', 'fighting', 'rock', 'steel'] } },
      { id: 'mah_streak', type: 'streak_x', targetItem: null, targetQty: 38, desc: '38 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 450000, rewardItem: 'choiceScarf', rewardQty: 1, rewardTitle: 'mahWarmHeart', prereqQuest: null },
    ],
  },
  'mah_fur': {
    id: 'mah_fur', name: 'Мех', sprite: '💰', location: 'mahoganyTown_pokemart',
    dialog: {
      greet: 'Пушной аукцион Махогани: меха, клыки, северные редкости. Покажи оборот — получишь мёд.',
      default: 'Торгуй, сражайся, богатей. Север платит щедро.',
      quest_offer: 'Оборот 65 000 000. Легальный. Почти. Справишься?',
      quest_complete: 'Солидный аукцион! Мёд твой, северный магнат.',
      quest_incomplete: 'Касса пока мелкая... Грейся дальше!',
    },
    quests: [
      { id: 'mah_money', type: 'earn_money', targetItem: null, targetQty: 65000000, desc: 'Заработай 65 000 000 боями и торговлей', rewardMoney: 75000, rewardItem: 'maxHoney', rewardQty: 40, prereqQuest: null },
    ],
  },
  'mah_den': {
    id: 'mah_den', name: 'Берлога', sprite: '🥚', location: 'mahoganyTown_pokecenter',
    dialog: {
      greet: 'Берлога тёплая даже в пургу: яйца зреют под боком, как медвежата. Согреешь кладку?',
      default: 'Тепло, забота и немного удачи. Центр всегда открыт.',
      quest_offer: 'Девять вылупленных яиц. Живых. Пищащих. Тёплых!',
      quest_complete: 'Какая прелесть! Держи яйцо счастья — чтоб помнили.',
      quest_incomplete: 'Яйца ещё не вылупились... Греет берлога?',
    },
    quests: [
      { id: 'mah_breed', type: 'hatch_x', targetItem: null, targetQty: 9, desc: 'Выведи и вылупи 9 яиц (тёплая кладка)', rewardMoney: 120000, rewardItem: 'luckyEgg', rewardQty: 1, prereqQuest: null },
    ],
  },
  'mah_frost': {
    id: 'mah_frost', name: 'Морозко', sprite: '⛄', location: 'mahoganyStadium',
    miniBoss: { leaderKey: 'mahoganyFrost', label: '⛄ Сразиться (команда 6×Lv88)' },
    dialog: {
      greet: 'Я — холод севера, шесть моих зверей — его клыки. Примешь холодный приём?',
      default: 'Тренируйся в пургу. Мороз любит упорных.',
      quest_offer: 'Побей меня в честном бою — команда 6×Lv88. Один бой, одна судьба!',
      quest_complete: 'Холод отступил! Сердце зимы — твоё. Держи приз и титул.',
      quest_incomplete: 'Сначала победи меня на стадионе. Пурга не прощает суеты.',
    },
    quests: [
      { id: 'mah_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Морозко (команда 6×Lv88)', rewardMoney: 225000, rewardItem: 'tm13', rewardQty: 1, rewardItems: [{ id: 'rareCandy', qty: 3 }], rewardTitle: 'winterHeart', prereqQuest: null, filter: { bossId: 'mahoganyFrost' } },
    ],
  },
  'oli_lift': {
    id: 'oli_lift', name: 'Подъёмник', sprite: '🚡', location: 'olivineCity',
    parcel: { questId: 'mah_caravan', itemId: 'mahLeg1', label: '📦 Взять караванный тюк' },
    dialog: {
      greet: 'Караван на север собирается в Оливине: Махогани, Блэкторн, снег и драконы. Поведёшь тюк? Не вскрывать!',
      default: 'Тюк ждёт караванщика. Север зовёт!',
      quest_offer: 'Довези караванный тюк через Махогани в Блэкторн.',
      quest_complete: 'Тюк уже не у меня — веди его на север!',
      quest_incomplete: 'Тюк ещё у тебя? Караван уходит без тебя!',
    },
    quests: [],
  },
  'mahogany_relay': {
    id: 'mahogany_relay', name: 'Передатчик Махогани', sprite: '🔁', location: 'mahoganyTown',
    exchange: { questId: 'mah_caravan', takeItem: 'mahLeg1', giveItem: 'mahLeg2', label: '🔁 Караван на Махогани' },
    dialog: {
      greet: 'Перевалочный пункт Махогани: дальше только снег и перевал. Караванный тюк? Перепакуем под мороз!',
      default: 'Цепочка не ждёт. Меняй груз — и дальше в путь.',
      quest_offer: 'Обменяй тюк на следующий этап маршрута.',
      quest_complete: 'Груз уже не у меня — вези его!',
      quest_incomplete: 'Без груза не обменяю... Привози!',
    },
    quests: [],
  },
  'blackthorn_relay': {
    id: 'blackthorn_relay', name: 'Передатчик Блэкторн', sprite: '🔁', location: 'blackthornCity',
    exchange: [{ questId: 'mah_caravan', takeItem: 'mahLeg2', giveItem: 'mahLeg3', label: '🔁 Караван на Блэкторн' }, { questId: 'bla_caravan', takeItem: 'blaLeg1', giveItem: 'blaLeg2', label: '🔁 Караван наследницы' }],
    dialog: {
      greet: 'Перевал Блэкторна: здесь караваны севера встречаются с волей драконов. Два маршрута — две печати. Какой тюк несёшь?',
      default: 'Цепочка не ждёт. Меняй груз — и дальше в путь.',
      quest_offer: 'Обменяй тюк на следующий этап маршрута.',
      quest_complete: 'Груз уже не у меня — вези его!',
      quest_incomplete: 'Без груза не обменяю... Привози!',
    },
    quests: [],
  },
  'blackthorn_courier': {
    id: 'blackthorn_courier', name: 'Курьер Блэкторна', sprite: '🛵', location: 'blackthornCity',
    dialog: {
      greet: 'Караван с юга через Махогани? Давай сюда — проверю печати!',
      default: 'Жду караваны с юга.',
      quest_offer: 'Принеси караванный тюк от Подъёмника через Махогани.',
      quest_complete: 'Цел! Держи конфеты за северный путь.',
      quest_incomplete: 'Без тюка не сдам... то есть не приму!',
    },
    quests: [
      { id: 'mah_caravan', type: 'collect_items', targetItem: 'mahLeg3', targetQty: 1, desc: 'Довези тюк Оливин → Махогани → Блэкторн (3 плеча)', rewardMoney: 68000, rewardItem: 'rareCandy', rewardQty: 12, prereqQuest: null },
    ],
  },
  // ══════════ БЛЭКТОРН (n=15, драконы, ФИНАЛ) ══════════
  'bla_sage': {
    id: 'bla_sage', name: 'Драконовед', sprite: '🐲', location: 'blackthornCity',
    dialog: {
      greet: 'Ты дошёл до края карты, путник. Здесь кончаются маршруты и начинаются легенды. Драконы не прощают слабых — докажи, что ты достоин их тропы!',
      default: 'Легенды не ждут. Логово гудит.',
      quest_offer: 'Нужно: {target} {item}. Судьба повелителей решается здесь.',
      quest_complete: 'Великолепно! Сокровищница драконов открывается достойным.',
      quest_incomplete: 'Испытание не окончено. Драконы смотрят...',
    },
    quests: [
      { id: 'bla_trail', type: 'defeat_x', targetItem: null, targetQty: 1000, desc: 'Победи 1000 диких драконьих/ледяных + исходи 24 локации (средний уровень 75)', rewardMoney: 80000, rewardItem: 'tm14', rewardQty: 1, rewardItems: [{ id: 'maxElixir', qty: 3 }], prereqQuest: null, filter: { types: ['dragon', 'ice'] }, verify: { avgLevel: 75, locs: ['blackthornCity', 'dragonsDen', 'icePath', 'route44', 'route45', 'route46', 'mtSilver', 'mtMortar', 'lakeOfRage', 'route43', 'mahoganyTown', 'tohjoFalls', 'route26', 'route27', 'route28', 'victoryRoad1', 'victoryRoad2', 'indigoPlateau', 'route22', 'route23', 'viridianCity', 'palletTown', 'route1', 'cinnabarIsland'] } },
      { id: 'bla_hoard', type: 'special', targetItem: null, targetQty: 1, desc: 'Драконья сокровищница: подними любого до 85 и собери 24 вида драконов', rewardMoney: 800000, rewardItem: 'masterBall', rewardQty: 1, prereqQuest: null, verify: { maxLevel: 85, typeSpecies: ['dratini', 'dragonair', 'dragonite', 'kingdra', 'altaria', 'bagon', 'shelgon', 'salamence', 'latias', 'latios', 'rayquaza', 'gible', 'gabite', 'garchomp', 'dialga', 'palkia', 'giratina', 'axew', 'fraxure', 'haxorus', 'deino', 'zweilous', 'hydreigon', 'noivern'], typeCount: 24 } },
    ],
  },
  'bla_fang': {
    id: 'bla_fang', name: 'Клык', sprite: '🦷', location: 'dragonsDen',
    dialog: {
      greet: 'Логово гудит, чешуя шуршит во тьме. Здесь испытывают достойных: победи пять сотен драконьих — или поймай сердце бури живьём!',
      default: 'Тьма логова учит терпению. Слушай шорох.',
      quest_offer: 'Испытание логова: кровь или буря. Выбирай, путник!',
      quest_complete: 'Логово признаёт тебя! Клык склоняется перед достойным.',
      quest_incomplete: 'Логово ещё не довольно... Спускайся глубже!',
    },
    quests: [
      { id: 'bla_den', type: 'defeat_x', targetItem: null, targetQty: 500, desc: 'Победи 500 диких драконьих в Пещере Драконов', rewardMoney: 80000, rewardItem: 'dragonFang', rewardQty: 1, prereqQuest: null, filter: { types: ['dragon'] }, verify: { locs: ['dragonsDen'] } },
      { id: 'bla_sky', type: 'catch_x', targetItem: null, targetQty: 6, desc: 'Поймай Dratini ×6 (сердце бури)', rewardMoney: 400000, rewardItem: 'loveBall', rewardQty: 6, prereqQuest: null, filter: { species: 'dratini' } },
    ],
  },
  'bla_scale': {
    id: 'bla_scale', name: 'Чешуя', sprite: '💰', location: 'blackthornCity_pokemart',
    dialog: {
      greet: 'Казна повелителей проходит через меня: чешуя, клыки, кометы. Покажи оборот, достойный драконов, — получишь мёд.',
      default: 'Торгуй, сражайся, богатей. Чешуя звенит монетами.',
      quest_offer: 'Оборот 100 000 000. Легальный. Почти. Справишься, повелитель?',
      quest_complete: 'Казна полна! Мёд твой, повелитель драконов.',
      quest_incomplete: 'Касса пока мелкая для легенды... Греби дальше!',
    },
    quests: [
      { id: 'bla_money', type: 'earn_money', targetItem: null, targetQty: 100000000, desc: 'Заработай 100 000 000 боями и торговлей', rewardMoney: 80000, rewardItem: 'maxHoney', rewardQty: 50, prereqQuest: null },
    ],
  },
  'bla_nest': {
    id: 'bla_nest', name: 'Гнездовье', sprite: '🥚', location: 'blackthornCity_pokecenter',
    dialog: {
      greet: 'Гнездо бури: здесь вылупляются те, кто однажды затмит небо. Десять яиц — десять будущих легенд. Согреешь?',
      default: 'Тепло, забота и немного удачи. Центр всегда открыт.',
      quest_offer: 'Десять вылупленных яиц. Живых. Пищащих. Грозовых!',
      quest_complete: 'Какая прелесть! Держи заплатку способностей — легендам она пригодится.',
      quest_incomplete: 'Яйца ещё не вылупились... Греет гнездо?',
    },
    quests: [
      { id: 'bla_breed', type: 'hatch_x', targetItem: null, targetQty: 10, desc: 'Выведи и вылупи 10 яиц (гнездо бури)', rewardMoney: 128000, rewardItem: 'abilityPatch', rewardQty: 1, prereqQuest: null },
    ],
  },
  'bla_cave': {
    id: 'bla_cave', name: 'Пещера', sprite: '🏋️', location: 'dragonsDen',
    dialog: {
      greet: 'Пещера куёт чешую и сталь: ни одного пропущенного дня, ни одной проигранной схватки. Сорок побед — и ты Непобеждённый!',
      default: 'Отдых — тоже тренировка. Но только после спаррингов!',
      quest_offer: 'Программа требует {target} {item}. Факел не забудь!',
      quest_complete: 'Непобеждённый! Пещера склоняется. Держи пояс повелителя.',
      quest_incomplete: 'Программа не выполнена. Круг ещё не закрыт...',
    },
    quests: [
      { id: 'bla_temper', type: 'special', targetItem: null, targetQty: 1, desc: 'Набери 496 EV в пул команды (чешуя и сталь, потолок!)', rewardMoney: 160000, rewardItem: 'weaknessPolicy', rewardQty: 1, prereqQuest: null, verify: { evPool: 496 } },
      { id: 'bla_streak', type: 'streak_x', targetItem: null, targetQty: 40, desc: '40 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 480000, rewardItem: 'choiceBand', rewardQty: 1, rewardTitle: 'blaDragonlord', prereqQuest: null },
    ],
  },
  'bla_heir': {
    id: 'bla_heir', name: 'Наследница', sprite: '👑', location: 'blackthornStadium',
    miniBoss: { leaderKey: 'blackthornHeir', label: '👑 Сразиться (команда 6×Lv88)' },
    dialog: {
      greet: 'Я — кровь древних повелителей, мои драконы — их воля. Шесть бойцов 88-го, шесть приговоров. Ты — последний. Докажи, что кровь и чешуя текут и в тебе!',
      default: 'Тренируйся у логова. Драконы любят упорных — и едят слабых.',
      quest_offer: 'Побей меня в честном бою — команда 6×Lv88. Один бой, одна легенда!',
      quest_complete: 'Кровь и чешуя... признают тебя! Ты — повелитель. Прими приз и титул.',
      quest_incomplete: 'Сначала победи меня на стадионе. Трон не прощает суеты.',
    },
    quests: [
      { id: 'bla_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Наследницу (команда 6×Lv88)', rewardMoney: 240000, rewardItem: 'tm02', rewardQty: 1, rewardItems: [{ id: 'rareCandy', qty: 3 }], rewardTitle: 'dragonBlood', prereqQuest: null, filter: { bossId: 'blackthornHeir' } },
    ],
  },
  'mahogany_pereval': {
    id: 'mahogany_pereval', name: 'Перевал', sprite: '🛵', location: 'mahoganyTown',
    parcel: { questId: 'bla_caravan', itemId: 'blaLeg1', label: '📦 Взять груз наследницы' },
    dialog: {
      greet: 'Последний караван уходит через перевал: Махогани — Блэкторн — Плато Индиго. Груз наследницы надо доставить. Возьмёшься? Не вскрывать — там воля драконов!',
      default: 'Груз ждёт караванщика. Перевал не ждёт!',
      quest_offer: 'Довези груз наследницы через Блэкторн на Плато Индиго.',
      quest_complete: 'Груз уже не у меня — веди его к финалу!',
      quest_incomplete: 'Груз ещё у тебя? Последний караван уходит!',
    },
    quests: [],
  },
  'indigo_relay': {
    id: 'indigo_relay', name: 'Передатчик Индиго', sprite: '🔁', location: 'indigoPlateau',
    exchange: { questId: 'bla_caravan', takeItem: 'blaLeg2', giveItem: 'blaLeg3', label: '🔁 Последний караван на Индиго' },
    dialog: {
      greet: 'Плато Индиго: конец всех маршрутов, начало легенд. Последний караван? Перепакуем под финал!',
      default: 'Цепочка не ждёт. Меняй груз — и дальше в путь.',
      quest_offer: 'Обменяй груз на последний этап маршрута.',
      quest_complete: 'Груз уже не у меня — вези его!',
      quest_incomplete: 'Без груза не обменяю... Привози!',
    },
    quests: [],
  },
  'indigo_courier': {
    id: 'indigo_courier', name: 'Курьер Индиго', sprite: '🛵', location: 'indigoPlateau',
    dialog: {
      greet: 'Груз наследницы через Блэкторн? Давай сюда — финал всех караванов здесь, на Плато!',
      default: 'Жду последний караван.',
      quest_offer: 'Принеси груз наследницы от Перевала через Блэкторн.',
      quest_complete: 'Цел! Финал закрыт. Держи конфеты повелителя караванов.',
      quest_incomplete: 'Без груза финал не засчитаю... Неси!',
    },
    quests: [
      { id: 'bla_caravan', type: 'collect_items', targetItem: 'blaLeg3', targetQty: 1, desc: 'Довези груз Махогани → Блэкторн → Плато Индиго (3 плеча, финал!)', rewardMoney: 72000, rewardItem: 'rareCandy', rewardQty: 12, prereqQuest: null },
    ],
  },
  'bla_elder': {
    id: 'bla_elder', name: 'Старейшина', sprite: '🧙', location: 'blackthornCity',
    dialog: {
      greet: 'Я помню, когда драконы были молоды, а Плато — лишь мечтой. Ты прошёл все пятнадцать городов, дитя? Тогда слушай...',
      default: 'Садись у огня. Легенды любят слушателей.',
      quest_offer: 'Легенды не требуют — они рассказывают.',
      quest_complete: 'Так и было. Или будет. Время драконов — круг.',
      quest_incomplete: 'История ещё не дописана...',
    },
    quests: [],
  },
};
