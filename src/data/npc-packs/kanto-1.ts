// ─────────────────────────────────────────────────────────────
// kanto-1.ts — ПАЧКА ЛЕСЕНКИ: Церулин, Вермилион, Селадон, Шаффран (40 квестов)
// ─────────────────────────────────────────────────────────────
// Источник: docs/QUESTS-LADDER.md, разделы 1–4 + Приложение A (новее таблиц).
// Форма NPC/квестов — как pewter_researcher в src/data/npc.ts:
//   у квеста ВСЕ поля явно (targetItem: null где не надо, prereqQuest: null).
// Правила:
//   - id NPC с префиксом города (cer_/ver_/cel_/saf_); финалы доставок —
//     полными именами (cerulean_courier и т.д., как pewter_courier).
//   - location ∈ REGIONS; trainingGrounds НЕ существуют — наставники в
//     Stadium + // TODO: trainingGrounds.
//   - Награды уже с ремапом Приложения A (tmWeak-тир, premierBall, maxHoney…).
//   - Титулы ТОЛЬКО из «30 титулов» (боссы + стрики); остальным — без титула.
//   - filter.bossId — ключи gyms.ts байт-в-байт.
//   - Пулы typeSpecies — только реальные виды типа (взято с запасом: меньше,
//     но точно; сомнения — в отчёте).
// ─────────────────────────────────────────────────────────────

export const KANTO1_NPCS = {
  // ══════════ ЦЕРУЛИН (n=1, вода) ══════════
  'cer_marina': {
    id: 'cer_marina', name: 'Марина', sprite: '🔬', location: 'ceruleanCity',
    dialog: {
      greet: 'Церулин дышит водой: река, мосты, пещера за городом. Поможешь с полевыми данными?',
      default: 'Вода помнит всё. Продолжай наблюдения — и заглядывай к пещере.',
      quest_offer: 'Нужно: {target} {item}. Мокро, но честно!',
      quest_complete: 'Отличные данные! Фонды Церулина платят исправно.',
      quest_incomplete: 'Ещё не всё. Река ждёт, маршруты ждут...',
    },
    quests: [
      { id: 'cer_trail', type: 'defeat_x', targetItem: null, targetQty: 40, desc: 'Победи 40 диких водных + посети 6 локаций (средний уровень 20)', rewardMoney: 10000, rewardItem: 'mysticWater', rewardQty: 1, rewardItems: [{ id: 'superPotion', qty: 3 }], prereqQuest: null, filter: { types: ['water'] }, verify: { avgLevel: 20, locs: ['ceruleanCity', 'route24', 'route25', 'route4', 'mtMoon'] } },
      { id: 'cer_fossil', type: 'use_item', targetItem: null, targetQty: 2, desc: 'Используй 2 Moon Stone (камни с горы Мун)', rewardMoney: 9000, rewardItem: 'superPotion', rewardQty: 3, prereqQuest: null, filter: { itemId: 'moonStone' } },
    ],
  },
  'cer_finn': {
    id: 'cer_finn', name: 'Финн', sprite: '🏊', location: 'ceruleanStadium',
    miniBoss: { leaderKey: 'ceruleanFinn', label: '🏊 Сразиться (команда 3×Lv33)' },
    dialog: {
      greet: 'Прибой — мой дом, вода — моя сила. Три моих бойца смоют любого. Рискнёшь?',
      default: 'Тренируйся у реки. Вода любит упорных.',
      quest_offer: 'Побей меня в честном бою — команда 3×Lv33. Один бой, одна судьба!',
      quest_complete: 'Чистая победа! Волны признают тебя. Держи приз и титул.',
      quest_incomplete: 'Сначала победи меня в воде. Прибой не прощает суеты.',
    },
    quests: [
      { id: 'cer_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Пловца Финна (команда 3×Lv33)', rewardMoney: 30000, rewardItem: 'splashPlate', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'tideMaster', prereqQuest: null, filter: { bossId: 'ceruleanFinn' } },
    ],
  },
  'cer_garpun': {
    id: 'cer_garpun', name: 'Гарпун', sprite: '🎣', location: 'route24',
    dialog: {
      greet: 'Мост Наггет, ветер, клёв... Здесь, на 24-м, ходит тень Глубинного зова. Видел Лапраса?',
      default: 'Сиди тихо, жди клёва. Море само подойдёт.',
      quest_offer: 'Нужен живой Лапрас. Один. Целый. Слышишь песню глубин?',
      quest_complete: 'Вот это улов! Глубины теперь твои.',
      quest_incomplete: 'Лапрас всё ещё поёт где-то у моста...',
    },
    quests: [
      { id: 'cer_sky', type: 'catch_x', targetItem: null, targetQty: 1, desc: 'Поймай Lapras ×1', rewardMoney: 50000, rewardItem: 'netBall', rewardQty: 2, prereqQuest: null, filter: { species: 'lapras' } },
    ],
  },
  'cer_priboy': {
    id: 'cer_priboy', name: 'Прибой', sprite: '💰', location: 'ceruleanCity_pokemart',
    dialog: {
      greet: 'Морская касса любит движение: бои, торговля, оборот. Покажи выручку — получишь мёд.',
      default: 'Торгуй, сражайся, богатей. Река несёт монеты.',
      quest_offer: 'Оборот 160 000. Легальный. Почти. Справишься?',
      quest_complete: 'Солидная касса! Мёд твой, торговец.',
      quest_incomplete: 'Касса пока мелкая... Греби дальше!',
    },
    quests: [
      { id: 'cer_money', type: 'earn_money', targetItem: null, targetQty: 160000, desc: 'Заработай 160 000 боями и торговлей', rewardMoney: 10000, rewardItem: 'maxHoney', rewardQty: 1, prereqQuest: null },
    ],
  },
  'cer_laguna': {
    id: 'cer_laguna', name: 'Лагуна', sprite: '🥚', location: 'ceruleanCity_pokecenter',
    dialog: {
      greet: 'Икра и пена, тепло и забота — выведи малыша у воды, и я поверю в тебя.',
      default: 'Яйцам нужны тепло и прогулки. Центр всегда открыт.',
      quest_offer: 'Одно вылупленное яйцо. Живое. Пищащее. У воды.',
      quest_complete: 'Какая прелесть! Держи вечный камень — чтоб помнил.',
      quest_incomplete: 'Яйцо ещё не вылупилось... Греет инкубатор?',
    },
    quests: [
      { id: 'cer_breed', type: 'hatch_x', targetItem: null, targetQty: 1, desc: 'Выведи и вылупи яйцо', rewardMoney: 16000, rewardItem: 'everstone', rewardQty: 1, prereqQuest: null },
    ],
  },
  'cer_shtil': {
    id: 'cer_shtil', name: 'Штиль', sprite: '🏋️', location: 'ceruleanStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Штиль перед штормом: заземлись, выстой, не пропусти удар. Выдержишь мою программу?',
      default: 'Отдых — тоже тренировка. Но только после спаррингов!',
      quest_offer: 'Программа требует {target} {item}. Полотенце не забудь!',
      quest_complete: 'Непотопляемый! Шторм тебе нипочём. Держи колокол.',
      quest_incomplete: 'Программа не выполнена. Круг ещё не закрыт...',
    },
    quests: [
      { id: 'cer_counter', type: 'defeat_x', targetItem: null, targetQty: 20, desc: 'Победи 20 диких электрических (заземлись!)', rewardMoney: 10000, rewardItem: 'cellBattery', rewardQty: 2, prereqQuest: null, filter: { types: ['electric'] } },
      { id: 'cer_streak', type: 'streak_x', targetItem: null, targetQty: 12, desc: '12 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 60000, rewardItem: 'shellBell', rewardQty: 1, rewardTitle: 'cerUnsinkable', prereqQuest: null },
    ],
  },
  'cer_mayak': {
    id: 'cer_mayak', name: 'Маяк', sprite: '🗼', location: 'route25',
    dialog: {
      greet: 'Дом Билла, пирс, лазурь... Но фарватер заилился дикими. Прочистишь репеллентами?',
      default: 'Смотри за огнём маяка. Фарватер должен быть чистым.',
      quest_offer: 'Используй 6 Super Repel на водных маршрутах. Чистый фарватер — безопасный путь!',
      quest_complete: 'Фарватер чист! Свети ярко, маяк доволен.',
      quest_incomplete: 'Дикие всё ещё мутят воду... Ещё репеллентов!',
    },
    quests: [
      { id: 'cer_repel', type: 'use_item', targetItem: null, targetQty: 6, desc: 'Используй 6 Super Repel на водных маршрутах', rewardMoney: 9000, rewardItem: 'revive', rewardQty: 2, prereqQuest: null, filter: { itemId: 'superRepel' } },
    ],
  },
  'cer_briz': {
    id: 'cer_briz', name: 'Бриз', sprite: '🛵', location: 'vermilionCity',
    parcel: { questId: 'cer_courier', itemId: 'parcelCer', label: '📦 Взять посылку в Церулин' },
    dialog: {
      greet: 'Посылку в Церулин надо доставить. Возьмёшься? Не вскрывать — там хрупкое, морское!',
      default: 'Посылка ждёт курьера. Ветер попутный!',
      quest_offer: 'Довези запечатанную посылку курьеру в Церулин.',
      quest_complete: 'Посылка уже не у меня — вези её!',
      quest_incomplete: 'Посылка ещё у тебя? Вези в Церулин, не вскрывай!',
    },
    quests: [],
  },
  'cerulean_courier': {
    id: 'cerulean_courier', name: 'Курьер Церулина', sprite: '🛵', location: 'ceruleanCity',
    dialog: {
      greet: 'Посылка из Вермилиона? Давай сюда — проверю печать!',
      default: 'Жду посылки с юга, с ветром.',
      quest_offer: 'Принеси посылку от Бриза из Вермилиона.',
      quest_complete: 'Цела! Печать на месте. Держи конфеты за скорость.',
      quest_incomplete: 'Без посылки не приму. Бриз ждёт подтверждения!',
    },
    quests: [
      { id: 'cer_courier', type: 'collect_items', targetItem: 'parcelCer', targetQty: 1, desc: 'Довези посылку из Вермилиона в Церулин', rewardMoney: 9000, rewardItem: 'superPotion', rewardQty: 3, prereqQuest: null },
    ],
  },
  // ══════════ ВЕРМИЛИОН (n=2, электро) ══════════
  'ver_tesla': {
    id: 'ver_tesla', name: 'Тесла', sprite: '🔬', location: 'vermilionCity',
    dialog: {
      greet: 'Порт гудит, генераторы гудят, S.S. Anne гудит! Поможешь замерить искрящую тропу?',
      default: 'Ток любит точных. Продолжай замеры.',
      quest_offer: 'Нужно: {target} {item}. Осторожно — бьётся!',
      quest_complete: 'Замеры сошлись! Держи плату из фондов порта.',
      quest_incomplete: 'Разряды ещё не все посчитаны...',
    },
    quests: [
      { id: 'ver_trail', type: 'defeat_x', targetItem: null, targetQty: 60, desc: 'Победи 60 диких электрических + посети 7 локаций (средний уровень 25)', rewardMoney: 15000, rewardItem: 'zapPlate', rewardQty: 1, rewardItems: [{ id: 'superPotion', qty: 4 }], prereqQuest: null, filter: { types: ['electric'] }, verify: { avgLevel: 25, locs: ['vermilionCity', 'route6', 'route11', 'diglettsCave', 'route2', 'viridianForest', 'ssAnne'] } },
    ],
  },
  'ver_volt': {
    id: 'ver_volt', name: 'Вольт', sprite: '⚓', location: 'vermilionStadium',
    miniBoss: { leaderKey: 'vermilionVolt', label: '⚓ Сразиться (команда 3×Lv38)' },
    dialog: {
      greet: 'Якорь поднят, вольты на максимуме! Моя троица шипит и искрит. Выдержишь разряд?',
      default: 'Заземлись — и возвращайся.',
      quest_offer: 'Побей меня — команда 3×Lv38. Ток не ждёт!',
      quest_complete: 'Высокое напряжение выдержано! Ты — громоотвод. Держи приз.',
      quest_incomplete: 'Сначала победи меня. Искри, но не сгорай!',
    },
    quests: [
      { id: 'ver_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Матроса Вольта (команда 3×Lv38)', rewardMoney: 45000, rewardItem: 'magnet', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'stormRod', prereqQuest: null, filter: { bossId: 'vermilionVolt' } },
    ],
  },
  'ver_katushka': {
    id: 'ver_katushka', name: 'Катушка', sprite: '🎣', location: 'vermilionPier',
    dialog: {
      greet: 'На пирсе клюёт — и бьётся током! Вольторбы тикают, электроды гудят. Добивай первым, не зевай!',
      default: 'Море искрит. Леска дрожит. Жди.',
      quest_offer: 'Нужно: {target} {item}. Живую молнию не упускай!',
      quest_complete: 'Вот это разряд! Пирс гудит от восторга.',
      quest_incomplete: 'Вольторбы всё ещё тикают у свай...',
    },
    quests: [
      { id: 'ver_volatile', type: 'defeat_x', targetItem: null, targetQty: 30, desc: 'Победи 30 Voltorb/Electrode (самоуничтожение — добивай первым!)', rewardMoney: 15000, rewardItem: 'cellBattery', rewardQty: 1, prereqQuest: null, filter: { speciesList: ['voltorb', 'electrode'] } },
      { id: 'ver_sky', type: 'catch_x', targetItem: null, targetQty: 1, desc: 'Поймай Electabuzz ×1', rewardMoney: 75000, rewardItem: 'quickBall', rewardQty: 3, prereqQuest: null, filter: { species: 'electabuzz' } },
    ],
  },
  'ver_amper': {
    id: 'ver_amper', name: 'Ампер', sprite: '💰', location: 'vermilionCity_pokemart',
    dialog: {
      greet: 'Портовый оборот: корабли, грузы, монеты. Покажи оборот — получишь мёд бочками.',
      default: 'Считай, торгуй, не стой.',
      quest_offer: 'Оборот 250 000. Порт не спит — и ты не спи!',
      quest_complete: 'Оборот принят! Порт гудит, касса поёт.',
      quest_incomplete: 'Трюмы ещё полупусты...',
    },
    quests: [
      { id: 'ver_money', type: 'earn_money', targetItem: null, targetQty: 250000, desc: 'Заработай 250 000 боями и торговлей', rewardMoney: 15000, rewardItem: 'maxHoney', rewardQty: 2, prereqQuest: null },
    ],
  },
  'ver_iskra': {
    id: 'ver_iskra', name: 'Искра', sprite: '🥚', location: 'vermilionCity_pokecenter',
    dialog: {
      greet: 'Заряженное гнездо: инкубатор трещит, искры летят! Выведи малышей — будет светло.',
      default: 'Тепло, забота и заземление. Центр всегда открыт.',
      quest_offer: 'Вылупи двоих. Живых. Пищащих. Искрящих.',
      quest_complete: 'Смотри, скорлупа треснула! Держи морское благовоние.',
      quest_incomplete: 'Инкубатор ещё гудит... Выгул не окончен.',
    },
    quests: [
      { id: 'ver_breed', type: 'hatch_x', targetItem: null, targetQty: 2, desc: 'Выведи и вылупи 2 яйца', rewardMoney: 24000, rewardItem: 'seaIncense', rewardQty: 1, prereqQuest: null },
    ],
  },
  'ver_zazemlenie': {
    id: 'ver_zazemlenie', name: 'Заземление', sprite: '🏋️', location: 'vermilionStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Копай глубже, стой твёрдо: земля гасит любой разряд. Выдержишь мою программу?',
      default: 'Ноги в землю, корпус в бой. Жду на помосте!',
      quest_offer: 'Программа требует {target} {item}. Без коротких замыканий!',
      quest_complete: 'Заземлён! Ток тебе нипочём. Держи приз.',
      quest_incomplete: 'Программа не выполнена. Разряд ещё гуляет...',
    },
    quests: [
      { id: 'ver_counter', type: 'defeat_x', targetItem: null, targetQty: 30, desc: 'Победи 30 диких земляных (копай глубже!)', rewardMoney: 15000, rewardItem: 'softSand', rewardQty: 1, prereqQuest: null, filter: { types: ['ground'] } },
      { id: 'ver_streak', type: 'streak_x', targetItem: null, targetQty: 14, desc: '14 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 90000, rewardItem: 'blackSludge', rewardQty: 1, rewardTitle: 'verGrounded', prereqQuest: null },
    ],
  },
  'ver_port': {
    id: 'ver_port', name: 'Порт', sprite: '🚢', location: 'ssAnne',
    dialog: {
      greet: 'S.S. Anne уплывает скоро! Посети лайнер, пирс и город — успей, пока трап не подняли!',
      default: 'Корабль ждёт только пунктуальных. Бегом по палубам!',
      quest_offer: 'Посети S.S. Anne, причал и Вермилион. Корабль уплывает — успей!',
      quest_complete: 'Все палубы исхожены! Зайцев нет. Держи дорожный набор.',
      quest_incomplete: 'Ещё не все точки исхожены. Трап уже скрипит...',
    },
    quests: [
      { id: 'ver_anne', type: 'special', targetItem: null, targetQty: 1, desc: 'Посети S.S. Anne, причал и Вермилион (корабль уплывает — успей!)', rewardMoney: 15000, rewardItem: 'escapeRope', rewardQty: 1, rewardItems: [{ id: 'fullHeal', qty: 3 }], prereqQuest: null, verify: { locs: ['ssAnne', 'vermilionPier', 'vermilionCity'] } },
    ],
  },
  'ver_provod': {
    id: 'ver_provod', name: 'Провод', sprite: '🛵', location: 'saffronCity',
    parcel: { questId: 'ver_courier', itemId: 'parcelVer', label: '📦 Взять посылку в Вермилион' },
    dialog: {
      greet: 'Посылку в Вермилион надо доставить. Высоковольтная, не ронять, не вскрывать!',
      default: 'Посылка ждёт курьера. Ток идёт!',
      quest_offer: 'Довези запечатанную посылку курьеру в Вермилион.',
      quest_complete: 'Посылка уже не у меня — вези её!',
      quest_incomplete: 'Посылка ещё у тебя? Вези в Вермилион!',
    },
    quests: [],
  },
  'vermilion_courier': {
    id: 'vermilion_courier', name: 'Курьер Вермилиона', sprite: '🛵', location: 'vermilionCity',
    dialog: {
      greet: 'Посылка из Шаффрана? Давай сюда — проверю изоляцию!',
      default: 'Жду посылок с севера.',
      quest_offer: 'Принеси посылку от Провода из Шаффрана.',
      quest_complete: 'Цела! Изоляция в норме. Держи конфеты.',
      quest_incomplete: 'Без посылки не приму!',
    },
    quests: [
      { id: 'ver_courier', type: 'collect_items', targetItem: 'parcelVer', targetQty: 1, desc: 'Довези посылку из Шаффрана в Вермилион', rewardMoney: 14000, rewardItem: 'superPotion', rewardQty: 5, prereqQuest: null },
    ],
  },
  // ══════════ СЕЛАДОН (n=3, трава) ══════════
  'cel_botanik': {
    id: 'cel_botanik', name: 'Ботаник', sprite: '🔬', location: 'celadonCity',
    dialog: {
      greet: 'Селадон шумит, а гербарий ждёт: тропа, виды, камни. Поможешь науке среди неона?',
      default: 'Листва любит внимательных. Продолжай сбор.',
      quest_offer: 'Нужно: {target} {item}. Казино подождёт — наука нет!',
      quest_complete: 'Гербарий пополнен! Держи награду из фондов.',
      quest_incomplete: 'Сбор не окончен. Клумбы ждут...',
    },
    quests: [
      { id: 'cel_trail', type: 'defeat_x', targetItem: null, targetQty: 85, desc: 'Победи 85 диких травяных + посети 8 локаций (средний уровень 30)', rewardMoney: 20000, rewardItem: 'miracleSeed', rewardQty: 1, rewardItems: [{ id: 'superPotion', qty: 5 }], prereqQuest: null, filter: { types: ['grass'] }, verify: { avgLevel: 30, locs: ['celadonCity', 'route7', 'route16', 'route17', 'route8', 'lavenderTown', 'pokemonTower', 'saffronCity'] } },
      { id: 'cel_hoard', type: 'special', targetItem: null, targetQty: 1, desc: 'Подними любого до 40 и поймай 11 видов травы', rewardMoney: 200000, rewardItem: 'ultraBall', rewardQty: 10, prereqQuest: null, verify: { maxLevel: 40, typeSpecies: ['bulbasaur', 'oddish', 'gloom', 'bellsprout', 'weepinbell', 'exeggcute', 'tangela', 'chikorita', 'sunkern', 'hoppip', 'paras'], typeCount: 11 } },
      { id: 'cel_stone', type: 'use_item', targetItem: null, targetQty: 3, desc: 'Используй 3 Leaf Stone (камни дорогие — считай каждый!)', rewardMoney: 18000, rewardItem: 'absorbBulb', rewardQty: 1, prereqQuest: null, filter: { itemId: 'leafStone' } },
    ],
  },
  'cel_flora': {
    id: 'cel_flora', name: 'Флора', sprite: '🌸', location: 'celadonStadium',
    miniBoss: { leaderKey: 'celadonFlora', label: '🌸 Сразиться (команда 4×Lv43)' },
    dialog: {
      greet: 'Сад цветёт, шипы остры. Моя четвёрка прорастёт сквозь любую броню. Посмеешь?',
      default: 'Поливай команду заботой. Сад ждёт.',
      quest_offer: 'Побей меня — команда 4×Lv43. Лепестки и шипы!',
      quest_complete: 'Друг листвы! Сад признаёт тебя. Держи приз.',
      quest_incomplete: 'Сначала победи меня. Сорняки не сдаются!',
    },
    quests: [
      { id: 'cel_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Садовницу Флору (команда 4×Lv43)', rewardMoney: 60000, rewardItem: 'meadowPlate', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'leafFriend', prereqQuest: null, filter: { bossId: 'celadonFlora' } },
    ],
  },
  'cel_sachok': {
    id: 'cel_sachok', name: 'Сачок', sprite: '🦋', location: 'route7',
    dialog: {
      greet: 'Приз игрового угла — Иви! Только сачком, только на 7-м. Пять штук — и казино платит!',
      default: 'Тихо, не спугни. Иви чуют суету.',
      quest_offer: 'Поймай 5 Eevee. Добыча казино — только так!',
      quest_complete: 'Пять Иви! Игровой угол в шоке. Держи камни эволюции.',
      quest_incomplete: 'Иви всё ещё прячутся в траве...',
    },
    quests: [
      { id: 'cel_eevee', type: 'catch_x', targetItem: null, targetQty: 5, desc: 'Поймай Eevee ×5 (добыча казино — только так!)', rewardMoney: 100000, rewardItem: 'thunderStone', rewardQty: 1, rewardItems: [{ id: 'waterStone', qty: 1 }, { id: 'fireStone', qty: 1 }], prereqQuest: null, filter: { species: 'eevee' } },
    ],
  },
  'cel_lepestok': {
    id: 'cel_lepestok', name: 'Лепесток', sprite: '💰', location: 'celadonCity_pokemart',
    dialog: {
      greet: 'Неоновый оборот: маркет, казино, витрины. Но учти — казино не в счёт, только бои и торговля!',
      default: 'Считай честно. Лепестки не любят мухлежа.',
      quest_offer: 'Оборот 400 000. Только бои и торговля!',
      quest_complete: 'Джекпот честный! Мёд твой.',
      quest_incomplete: 'Касса ещё не цветёт...',
    },
    quests: [
      { id: 'cel_coins', type: 'earn_money', targetItem: null, targetQty: 400000, desc: 'Заработай 400 000 боями и торговлей (казино не в счёт!)', rewardMoney: 20000, rewardItem: 'maxHoney', rewardQty: 2, prereqQuest: null },
    ],
  },
  'cel_oranzhereya': {
    id: 'cel_oranzhereya', name: 'Оранжерея', sprite: '🥚', location: 'celadonCity_pokecenter',
    dialog: {
      greet: 'Теплица дышит: влага, свет, скорлупа. Выведи двоих — будет зелено.',
      default: 'Тепло и влага. Центр всегда открыт.',
      quest_offer: 'Вылупи двоих. Нежных. Зелёных.',
      quest_complete: 'Смотри, ростки... то есть малыши! Держи благовоние.',
      quest_incomplete: 'Инкубатор ещё гудит...',
    },
    quests: [
      { id: 'cel_breed', type: 'hatch_x', targetItem: null, targetQty: 2, desc: 'Выведи и вылупи 2 яйца', rewardMoney: 32000, rewardItem: 'oddIncense', rewardQty: 1, prereqQuest: null },
    ],
  },
  'cel_koren': {
    id: 'cel_koren', name: 'Корень', sprite: '🏋️', location: 'celadonStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Прополка огнём: жги лишнее, держи строй. Выдержишь мою программу?',
      default: 'Корни глубоки, стойка тверда. Жду на помосте!',
      quest_offer: 'Программа требует {target} {item}. Без сорняков!',
      quest_complete: 'Неувядаемый! Ни засуха, ни огонь тебе нипочём.',
      quest_incomplete: 'Программа не выполнена. Сорняки ещё лезут...',
    },
    quests: [
      { id: 'cel_counter', type: 'defeat_x', targetItem: null, targetQty: 45, desc: 'Победи 45 диких огненных (прополка огнём!)', rewardMoney: 20000, rewardItem: 'charcoal', rewardQty: 1, prereqQuest: null, filter: { types: ['fire'] } },
      { id: 'cel_streak', type: 'streak_x', targetItem: null, targetQty: 16, desc: '16 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 120000, rewardItem: 'rockyHelmet', rewardQty: 1, rewardTitle: 'celUnfading', prereqQuest: null },
    ],
  },
  'cel_jackpot': {
    id: 'cel_jackpot', name: 'Джекпот', sprite: '🎰', location: 'celadonCity',
    dialog: {
      greet: 'Казино сияет, монеты звенят! Но помни: джекпот — это труд, а не удача.',
      default: 'Играй честно. Город всё видит.',
      quest_offer: 'Заглядывай к держателям заданий — у меня пока перерыв.',
      quest_complete: 'Удача любит терпеливых!',
      quest_incomplete: 'Колесо ещё крутится...',
    },
    quests: [],
  },
  'cel_spitsa': {
    id: 'cel_spitsa', name: 'Спица', sprite: '🚲', location: 'lavenderTown',
    parcel: { questId: 'cel_courier', itemId: 'parcelCel', label: '📦 Взять посылку в Селадон' },
    dialog: {
      greet: 'Из тихой Лаванды — в шумный Селадон! Посылку довезёшь? Не вскрывать, там нежное!',
      default: 'Крути педали, держи груз.',
      quest_offer: 'Довези запечатанную посылку курьеру в Селадон.',
      quest_complete: 'Посылка уже не у меня — вези её!',
      quest_incomplete: 'Посылка ещё у тебя? Вези в Селадон!',
    },
    quests: [],
  },
  'celadon_courier': {
    id: 'celadon_courier', name: 'Курьер Селадона', sprite: '🛵', location: 'celadonCity',
    dialog: {
      greet: 'Посылка из Лаванды? Давай сюда — проверю упаковку!',
      default: 'Жду посылок с востока.',
      quest_offer: 'Принеси посылку от Спицы из Лаванды.',
      quest_complete: 'Цела! Упаковка не мята. Держи конфеты.',
      quest_incomplete: 'Без посылки не приму!',
    },
    quests: [
      { id: 'cel_courier', type: 'collect_items', targetItem: 'parcelCel', targetQty: 1, desc: 'Довези посылку из Лаванды в Селадон', rewardMoney: 18000, rewardItem: 'superPotion', rewardQty: 6, prereqQuest: null },
    ],
  },
  // ══════════ ШАФФРАН (n=4, психика) ══════════
  'saf_psi': {
    id: 'saf_psi', name: 'Пси', sprite: '🔬', location: 'saffronCity',
    dialog: {
      greet: 'Мегаполис гудит, разумы шумят. Картотека разума ждёт: тропа, виды, уровни. Справится ли твой мозг?',
      default: 'Думай тихо. Город слышит громких.',
      quest_offer: 'Нужно: {target} {item}. Третий глаз не моргает!',
      quest_complete: 'Картотека пополнена! Разум твой остр. Держи награду.',
      quest_incomplete: 'Разумы ещё не все пересчитаны...',
    },
    quests: [
      { id: 'saf_trail', type: 'defeat_x', targetItem: null, targetQty: 115, desc: 'Победи 115 диких психов + посети 9 локаций (средний уровень 35)', rewardMoney: 25000, rewardItem: 'twistedSpoon', rewardQty: 1, rewardItems: [{ id: 'hyperPotion', qty: 3 }], prereqQuest: null, filter: { types: ['psychic'] }, verify: { avgLevel: 35, locs: ['saffronCity', 'route5', 'route6', 'route7', 'route8', 'saffronStation', 'route9', 'route10', 'powerPlant'] } },
      { id: 'saf_files', type: 'special', targetItem: null, targetQty: 1, desc: 'Подними любого до 45 и поймай 12 видов психов', rewardMoney: 250000, rewardItem: 'timerBall', rewardQty: 6, prereqQuest: null, verify: { maxLevel: 45, typeSpecies: ['abra', 'kadabra', 'drowzee', 'hypno', 'mr-mime', 'espeon', 'unown', 'girafarig', 'slowpoke', 'slowbro', 'natu', 'xatu'], typeCount: 12 } },
    ],
  },
  'saf_esper': {
    id: 'saf_esper', name: 'Эспер', sprite: '🔮', location: 'saffronPsychicStadium',
    miniBoss: { leaderKey: 'saffronEsper', label: '🔮 Сразиться (команда 4×Lv48)' },
    dialog: {
      greet: 'Я вижу твой следующий ход. И следующий за ним. Моя четвёрка читает мысли. Попробуй удивить.',
      default: 'Тишина. Концентрация. Возвращайся собранным.',
      quest_offer: 'Побей меня — команда 4×Lv48. Третий глаз открыт!',
      quest_complete: 'Разумник! Ты закрытая книга — даже я не прочла. Держи приз.',
      quest_incomplete: 'Сначала победи меня. Мысли — в кулак!',
    },
    quests: [
      { id: 'saf_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Медиума Эспера (команда 4×Lv48)', rewardMoney: 75000, rewardItem: 'mindPlate', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'mindBender', prereqQuest: null, filter: { bossId: 'saffronEsper' } },
    ],
  },
  'saf_lovets': {
    id: 'saf_lovets', name: 'Ловец снов', sprite: '🌙', location: 'route9',
    dialog: {
      greet: 'На 9-й скалы шепчут: Абра телепортируется с первого хода! Поймай двоих — докажи, что быстрее мысли.',
      default: 'Спи чутко. Сны здесь телепортируются.',
      quest_offer: 'Поймай Abra ×2. Убегают с первого хода — кидай точно!',
      quest_complete: 'Телепорт в руках! Сны пойманы.',
      quest_incomplete: 'Абры всё ещё ускользают в скалах...',
    },
    quests: [
      { id: 'saf_sky', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймай Abra ×2 (убегает с первого хода!)', rewardMoney: 125000, rewardItem: 'premierBall', rewardQty: 5, prereqQuest: null, filter: { species: 'abra' } },
    ],
  },
  'saf_silf': {
    id: 'saf_silf', name: 'Силф', sprite: '💰', location: 'saffronCity_pokemart',
    dialog: {
      greet: 'Контракт Силфа: корпорация платит за результат. Покажи оборот — получишь мёд и уважение.',
      default: 'Силф считает всё. Работай чисто.',
      quest_offer: 'Оборот 650 000. Мегаполис не ждёт!',
      quest_complete: 'Контракт закрыт! Силф доволен.',
      quest_incomplete: 'Цифры ещё не сошлись...',
    },
    quests: [
      { id: 'saf_money', type: 'earn_money', targetItem: null, targetQty: 650000, desc: 'Заработай 650 000 боями и торговлей', rewardMoney: 25000, rewardItem: 'maxHoney', rewardQty: 3, prereqQuest: null },
    ],
  },
  'saf_telepatka': {
    id: 'saf_telepatka', name: 'Телепатка', sprite: '🥚', location: 'saffronCity_pokecenter',
    dialog: {
      greet: 'Яйцо в стазисе: я держу его мыслью. Поможешь вывести троих — будет тихо и тепло.',
      default: 'Тише. Скорлупа слушает.',
      quest_offer: 'Вылупи троих. В тишине. В тепле.',
      quest_complete: 'Стазис снят, малыши пищат! Держи благовоние.',
      quest_incomplete: 'Инкубатор ещё гудит... Мысль держится.',
    },
    quests: [
      { id: 'saf_breed', type: 'hatch_x', targetItem: null, targetQty: 3, desc: 'Выведи и вылупи 3 яйца', rewardMoney: 40000, rewardItem: 'rockIncense', rewardQty: 1, prereqQuest: null },
    ],
  },
  'saf_dodze': {
    id: 'saf_dodze', name: 'Додзё', sprite: '🥋', location: 'saffronPsychicStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Додзё держит удар: бойцы, санитары, холодный расчёт. Выдержишь три испытания?',
      default: 'Дисциплина. Перевязка. Бой. Возвращайся.',
      quest_offer: 'Додзё требует {target} {item}. Без суеты — только расчёт!',
      quest_complete: 'Холодный расчёт! Додзё кланяется тебе.',
      quest_incomplete: 'Испытания не пройдены. Маты ждут...',
    },
    quests: [
      { id: 'saf_dojo', type: 'defeat_x', targetItem: null, targetQty: 60, desc: 'Победи 60 диких бойцов (боевое додзё держит удар!)', rewardMoney: 25000, rewardItem: 'blackBelt', rewardQty: 1, prereqQuest: null, filter: { types: ['fighting'] } },
      { id: 'saf_revive', type: 'use_item', targetItem: null, targetQty: 12, desc: 'Используй 12 Revive (санитары додзё!)', rewardMoney: 23000, rewardItem: 'focusBand', rewardQty: 1, prereqQuest: null, filter: { itemId: 'revive' } },
      { id: 'saf_streak', type: 'streak_x', targetItem: null, targetQty: 18, desc: '18 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 150000, rewardItem: 'kingsRock', rewardQty: 1, rewardTitle: 'safClosedBook', prereqQuest: null },
    ],
  },
  'saf_maglev': {
    id: 'saf_maglev', name: 'Маглев', sprite: '🚄', location: 'saffronStation',
    dialog: {
      greet: 'Маглев гудит, платформа 2! Поезд до Голденрода — но задания у держателей, не у меня.',
      default: 'Не стой на путях. Расписание — святое.',
      quest_offer: 'Заглядывай к держателям заданий — у меня пока перерыв.',
      quest_complete: 'Приятной поездки!',
      quest_incomplete: 'Состав ещё не подан...',
    },
    quests: [],
  },
  'saffron_courier': {
    id: 'saffron_courier', name: 'Курьер Шаффрана', sprite: '🛵', location: 'saffronCity',
    dialog: {
      greet: 'Посылка из Фуксии? Давай сюда — проверю печати!',
      default: 'Жду посылок с юга.',
      quest_offer: 'Принеси посылку от Курьера из Фуксии (не вскрывать!).',
      quest_complete: 'Цела! Печати на месте. Держи конфеты.',
      quest_incomplete: 'Без посылки не приму!',
    },
    quests: [
      { id: 'saf_courier', type: 'collect_items', targetItem: 'parcelSaf', targetQty: 1, desc: 'Довези посылку из Фуксии в Шаффран', rewardMoney: 23000, rewardItem: 'superPotion', rewardQty: 10, prereqQuest: null },
    ],
  },
};
