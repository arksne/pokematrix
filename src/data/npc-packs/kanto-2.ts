/**
 * ============================================================
 * kanto-2.ts — ПАЧКА ЛЕСЕНКИ: Фуксия, Киноварь, Виридиан (30 квестов)
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   NPC и квесты лесенки (docs/QUESTS-LADDER.md, разделы 5–7 +
 *   Приложение A — оно новее таблиц и главнее).
 *   Фуксия n5 (яд, фишка — Сафари-зона), Киноварь n6 (огонь,
 *   фишка — Особняк), Виридиан n7 (земля, фишка — лес Пикачу
 *   + кроты). Сложность: комбинированная ×2.
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - нет (чистый модуль данных)
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   - src/data/npc.ts → NPC_DATA (...KANTO2_NPCS)
 *
 * 🔹 ЭКСПОРТИРУЕТ:
 *   - KANTO2_NPCS — словарь NPC пачки (имя байт-в-байт,
 *     npc.ts уже импортирует)
 *
 * 🔹 ПРАВИЛА ПАЧКИ (как pewter_researcher в npc.ts):
 *   - У квеста ВСЕ поля явно (targetItem: null где не надо,
 *     prereqQuest: null — полная свобода, без цепочек).
 *   - id NPC с префиксом города (fuc_/cin_/vir_); финалы/релеи
 *     доставок — полными именами (fuchsia_courier, pallet_relay…),
 *     как pewter_courier.
 *   - location ОБЯЗАН существовать в REGIONS; trainingGrounds НЕ
 *     существуют — наставники в Stadium + // TODO: trainingGrounds.
 *   - Награды с ремапом Приложения A2 (тиры tmWeak/tmMid, premierBall,
 *     maxHoney, blackSludge/absorbBulb/iceHeal, wave/rose/luckIncense…).
 *   - Титулы ТОЛЬКО из «30 титулов» (кулаки + стрики); остальным —
 *     без титула (поле опущено, как в kanto-1.ts).
 *   - filter.bossId — ключи gyms.ts байт-в-байт; мульти-видовые
 *     охоты — через filter.speciesList (реализует движок).
 *   - Пулы typeSpecies — только реальные виды типа.
 * ============================================================
 */

export const KANTO2_NPCS = {
  // ══════════ ФУКСИЯ (n=5, яд) ══════════
  'fuc_eger': {
    id: 'fuc_eger', name: 'Сафари', sprite: '🔬', location: 'fuchsiaCity',
    dialog: {
      greet: 'Фуксия дышит ядом и зеленью: болота, Сафари-зона, тихие тропы. Поможешь с полевыми данными?',
      default: 'Яд любит терпеливых. Продолжай наблюдения — и заглядывай в Сафари.',
      quest_offer: 'Нужно: {target} {item}. Тихо, без царапин!',
      quest_complete: 'Отличные данные! Фонды Фуксии платят исправно.',
      quest_incomplete: 'Сбор не окончен. Болота ждут...',
    },
    quests: [
      { id: 'fuc_trail', type: 'defeat_x', targetItem: null, targetQty: 150, desc: 'Победи 150 диких ядовитых + посети 10 локаций (средний уровень 40)', rewardMoney: 30000, rewardItem: 'poisonBarb', rewardQty: 1, rewardItems: [{ id: 'hyperPotion', qty: 4 }], prereqQuest: null, filter: { types: ['poison'] }, verify: { avgLevel: 40, locs: ['fuchsiaCity', 'route15', 'seaRoute19', 'seaRoute20', 'safariZone', 'route12', 'route13', 'route14', 'route18', 'lavenderTown'] } },
      { id: 'fuc_hoard', type: 'special', targetItem: null, targetQty: 1, desc: 'Подними любого до 50 и поймай 13 видов яда', rewardMoney: 300000, rewardItem: 'timerBall', rewardQty: 8, prereqQuest: null, verify: { maxLevel: 50, typeSpecies: ['ekans', 'arbok', 'zubat', 'golbat', 'grimer', 'muk', 'gastly', 'haunter', 'koffing', 'weezing', 'tentacool', 'tentacruel', 'spinarak'], typeCount: 13 } },
    ],
  },
  'fuc_uchenik': {
    id: 'fuc_uchenik', name: 'Ученик Коги', sprite: '🥷', location: 'fuchsiaPoisonStadium',
    miniBoss: { leaderKey: 'fuchsiaApprentice', label: '🥷 Сразиться (команда 4×Lv53)' },
    dialog: {
      greet: 'Тень Фуксии падает бесшумно. Моя четвёрка разит из темноты. Посмеешь шагнуть?',
      default: 'Тишина — мой союзник. Тренируйся бесшумно.',
      quest_offer: 'Побей меня — команда 4×Lv53. Тихий шаг, верный удар!',
      quest_complete: 'Тень признаёт тебя. Ты — тень Фуксии. Держи приз.',
      quest_incomplete: 'Сначала победи меня. Яд не прощает шума!',
    },
    quests: [
      { id: 'fuc_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Ученика Коги (команда 4×Lv53)', rewardMoney: 90000, rewardItem: 'toxicPlate', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'fuchsiaShadow', prereqQuest: null, filter: { bossId: 'fuchsiaApprentice' } },
    ],
  },
  'fuc_sledopyt': {
    id: 'fuc_sledopyt', name: 'Следопыт', sprite: '🐾', location: 'route15',
    dialog: {
      greet: 'На 15-й тропе, у самой Фуксии, ползает редкая плесень... Гримеры! Видел? Поймай двоих!',
      default: 'Следы читай, шум не поднимай. Болото всё слышит.',
      quest_offer: 'Нужны два живых Гримера. Редкая плесень — редкая награда!',
      quest_complete: 'Вот это нюх! Плесень поймана, награда твоя.',
      quest_incomplete: 'Гримеры всё ещё булькают в болоте...',
    },
    quests: [
      { id: 'fuc_sky', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймай Grimer ×2 (редкая плесень болот!)', rewardMoney: 150000, rewardItem: 'ultraBall', rewardQty: 3, prereqQuest: null, filter: { species: 'grimer' } },
    ],
  },
  'fuc_klyk': {
    id: 'fuc_klyk', name: 'Клык', sprite: '💰', location: 'fuchsiaCity_pokemart',
    dialog: {
      greet: 'Сафари-прибыль: билеты, болы, трофеи. Покажи оборот — получишь мёд.',
      default: 'Считай, торгуй, не зевай.',
      quest_offer: 'Оборот 1 000 000. Сафари не ждёт!',
      quest_complete: 'Миллион! Клык доволен, касса поёт.',
      quest_incomplete: 'Касса ещё не полна...',
    },
    quests: [
      { id: 'fuc_money', type: 'earn_money', targetItem: null, targetQty: 1000000, desc: 'Заработай 1 000 000 боями и торговлей (сафари-прибыль!)', rewardMoney: 30000, rewardItem: 'maxHoney', rewardQty: 3, prereqQuest: null },
    ],
  },
  'fuc_volier': {
    id: 'fuc_volier', name: 'Вольер', sprite: '🥚', location: 'fuchsiaCity_pokecenter',
    dialog: {
      greet: 'Кладка в вольере: тепло, мох, скорлупа. Выведи троих — будет тихо и зелено.',
      default: 'Тепло и влага. Центр всегда открыт.',
      quest_offer: 'Вылупи троих. Тихо. Без царапин.',
      quest_complete: 'Смотри, скорлупа треснула! Держи благовоние волн.',
      quest_incomplete: 'Инкубатор ещё гудит...',
    },
    quests: [
      { id: 'fuc_breed', type: 'hatch_x', targetItem: null, targetQty: 3, desc: 'Выведи и вылупи 3 яйца', rewardMoney: 48000, rewardItem: 'waveIncense', rewardQty: 1, prereqQuest: null },
    ],
  },
  'fuc_tishina': {
    id: 'fuc_tishina', name: 'Тишина', sprite: '🏋️', location: 'fuchsiaPoisonStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Проветривание и бесшумность: выбей дурной воздух, выстой серию. Выдержишь мою программу?',
      default: 'Дыши ровно. Тень не шумит. Жду на помосте!',
      quest_offer: 'Программа требует {target} {item}. Без царапин!',
      quest_complete: 'Бесшумный! Ни яд, ни шум тебе нипочём.',
      quest_incomplete: 'Программа не выполнена. Тень ещё дрожит...',
    },
    quests: [
      { id: 'fuc_counter', type: 'defeat_x', targetItem: null, targetQty: 75, desc: 'Победи 75 диких земляных/психов (проветривание!)', rewardMoney: 30000, rewardItem: 'blackSludge', rewardQty: 1, prereqQuest: null, filter: { types: ['ground', 'psychic'] } },
      { id: 'fuc_streak', type: 'streak_x', targetItem: null, targetQty: 20, desc: '20 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 180000, rewardItem: 'razorClaw', rewardQty: 1, rewardTitle: 'fucSilent', prereqQuest: null },
    ],
  },
  'fuc_smotritel': {
    id: 'fuc_smotritel', name: 'Смотритель', sprite: '🎫', location: 'safariZone',
    dialog: {
      greet: 'Сафари-зона! Правила просты: только ловля, только трава и жуки. Трофей из 18 штук — и болы твои!',
      default: 'Билет прокомпостирован? Тогда в зону — тихо!',
      quest_offer: 'Поймай 18 травяных и жуков в Сафари-зоне. Посети зону всю!',
      quest_complete: 'Сафари-трофей! Смотритель ставит печать. Держи болы.',
      quest_incomplete: 'Трофей ещё не полон. Зона велика...',
    },
    quests: [
      { id: 'fuc_safari', type: 'catch_x', targetItem: null, targetQty: 18, desc: 'Поймай 18 травяных/жуков + посети Сафари-зону (правила сафари: только ловля!)', rewardMoney: 30000, rewardItem: 'nestBall', rewardQty: 6, prereqQuest: null, filter: { types: ['grass', 'bug'] }, verify: { locs: ['safariZone'] } },
    ],
  },
  'fuc_tropa': {
    id: 'fuc_tropa', name: 'Тропа', sprite: '🛵', location: 'cinnabarIsland',
    parcel: { questId: 'fuc_courier', itemId: 'parcelFuc', label: '📦 Взять посылку в Фуксию' },
    dialog: {
      greet: 'Посылку на Фуксию надо доставить. С Киновари, через море! Возьмёшься? Не вскрывать!',
      default: 'Посылка ждёт курьера. Ветер попутный!',
      quest_offer: 'Довези запечатанную посылку курьеру в Фуксию.',
      quest_complete: 'Посылка уже не у меня — вези её!',
      quest_incomplete: 'Посылка ещё у тебя? Вези в Фуксию, не вскрывай!',
    },
    quests: [],
  },
  'fuchsia_courier': {
    id: 'fuchsia_courier', name: 'Курьер Фуксии', sprite: '🛵', location: 'fuchsiaCity',
    dialog: {
      greet: 'Посылка с Киновари? От Тропы? Давай сюда — проверю печать!',
      default: 'Жду посылок с вулкана.',
      quest_offer: 'Принеси посылку от Тропы с Киновари.',
      quest_complete: 'Цела! Пахнет серой, печать на месте. Держи конфеты.',
      quest_incomplete: 'Без посылки не приму!',
    },
    quests: [
      { id: 'fuc_courier', type: 'collect_items', targetItem: 'parcelFuc', targetQty: 1, desc: 'Довези посылку с Киновари в Фуксию (от Тропы)', rewardMoney: 27000, rewardItem: 'expCandyM', rewardQty: 16, prereqQuest: null },
    ],
  },
  'fuchsia_sender': {
    id: 'fuchsia_sender', name: 'Курьер', sprite: '🛵', location: 'fuchsiaCity',
    parcel: { questId: 'saf_courier', itemId: 'parcelSaf', label: '📦 Взять посылку в Шаффран' },
    dialog: {
      greet: 'Посылку в Шаффран надо доставить. Возьмёшься? Не вскрывать — там хрупкое, психическое!',
      default: 'Посылка ждёт курьера. Мегаполис ждёт!',
      quest_offer: 'Довези запечатанную посылку курьеру в Шаффран.',
      quest_complete: 'Посылка уже не у меня — вези её!',
      quest_incomplete: 'Посылка ещё у тебя? Вези в Шаффран!',
    },
    quests: [],
  },
  // ══════════ КИНОВАРЬ (n=6, огонь) ══════════
  'cin_vulkanolog': {
    id: 'cin_vulkanolog', name: 'Вулканолог', sprite: '🌋', location: 'cinnabarIsland',
    dialog: {
      greet: 'Киноварь дышит жаром: кратер, Эмбер, особняк. Замерь пепельную тропу — поможешь науке?',
      default: 'Лава любит точных. Продолжай замеры.',
      quest_offer: 'Нужно: {target} {item}. Осторожно — горячо!',
      quest_complete: 'Замеры сошлись! Держи плату из геотермального фонда.',
      quest_incomplete: 'Искры ещё не все посчитаны...',
    },
    quests: [
      { id: 'cin_trail', type: 'defeat_x', targetItem: null, targetQty: 195, desc: 'Победи 195 диких огненных + посети 11 локаций (средний уровень 45)', rewardMoney: 35000, rewardItem: 'charcoal', rewardQty: 1, rewardItems: [{ id: 'hyperPotion', qty: 5 }], prereqQuest: null, filter: { types: ['fire'] }, verify: { avgLevel: 45, locs: ['cinnabarIsland', 'seaRoute20', 'seaRoute21', 'seafoamIslands', 'pokemonMansion', 'mtEmber', 'kindleRoad', 'route22', 'palletTown', 'route1', 'route2'] } },
    ],
  },
  'cin_bleiz': {
    id: 'cin_bleiz', name: 'Блейз', sprite: '🔥', location: 'cinnabarStadium',
    miniBoss: { leaderKey: 'cinnabarBlaze', label: '🔥 Сразиться (команда 4×Lv58)' },
    dialog: {
      greet: 'Испытание жаром! Моя четвёрка плавит камень. Выдержишь температуру?',
      default: 'Закаляйся у кратера. Огонь любит упорных.',
      quest_offer: 'Побей меня — команда 4×Lv58. Не сгорай!',
      quest_complete: 'Огненный дух! Пламя признаёт тебя. Держи приз.',
      quest_incomplete: 'Сначала победи меня. Жар не прощает дрожи!',
    },
    quests: [
      { id: 'cin_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Пирокинетика Блейза (команда 4×Lv58)', rewardMoney: 105000, rewardItem: 'flamePlate', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'fireSpirit', prereqQuest: null, filter: { bossId: 'cinnabarBlaze' } },
    ],
  },
  'cin_pepel': {
    id: 'cin_pepel', name: 'Пепел', sprite: '🌫️', location: 'pokemonMansion',
    dialog: {
      greet: 'Особняк шепчет: подвал, янтарь, огненные щенки в саду... Разберёшься?',
      default: 'Тихо. Стены особняка помнят всё.',
      quest_offer: 'Нужно: {target} {item}. Особняк не любит суеты!',
      quest_complete: 'Эхо подвала довольно. Держи награду.',
      quest_incomplete: 'Особняк ещё хранит тайны...',
    },
    quests: [
      { id: 'cin_amber', type: 'use_item', targetItem: null, targetQty: 1, desc: 'Используй 1 Fire Stone (янтарь из подвала особняка!)', rewardMoney: 32000, rewardItem: 'spellTag', rewardQty: 1, prereqQuest: null, filter: { itemId: 'fireStone' } },
      { id: 'cin_sky', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймай Growlithe ×3 (огненные щенки особняка!)', rewardMoney: 175000, rewardItem: 'repeatBall', rewardQty: 8, prereqQuest: null, filter: { species: 'growlithe' } },
    ],
  },
  'cin_obsidian': {
    id: 'cin_obsidian', name: 'Обсидиан', sprite: '💰', location: 'cinnabarIsland_pokecenter',
    dialog: {
      greet: 'Геотермальный фонд: тепло земли — в монеты. Покажи оборот — получишь мёд.',
      default: 'Считай, копи, не перегрейся.',
      quest_offer: 'Оборот 1 600 000. Фонд не ждёт!',
      quest_complete: 'Фонд принят! Обсидиан доволен.',
      quest_incomplete: 'Цифры ещё не сошлись...',
    },
    quests: [
      { id: 'cin_money', type: 'earn_money', targetItem: null, targetQty: 1600000, desc: 'Заработай 1 600 000 боями и торговлей (геотермальный фонд!)', rewardMoney: 35000, rewardItem: 'maxHoney', rewardQty: 4, prereqQuest: null },
    ],
  },
  'cin_terma': {
    id: 'cin_terma', name: 'Терма', sprite: '🥚', location: 'cinnabarIsland_pokecenter',
    dialog: {
      greet: 'Инкубатор кратера: тепло земли греет скорлупу. Выведи четверых — будет жарко и весело.',
      default: 'Тепло, забота, пар. Центр всегда открыт.',
      quest_offer: 'Вылупи четверых. Тёплых. Пищащих.',
      quest_complete: 'Смотри, скорлупа треснула! Держи розовое благовоние.',
      quest_incomplete: 'Инкубатор ещё гудит...',
    },
    quests: [
      { id: 'cin_breed', type: 'hatch_x', targetItem: null, targetQty: 4, desc: 'Выведи и вылупи 4 яйца', rewardMoney: 56000, rewardItem: 'roseIncense', rewardQty: 1, prereqQuest: null },
    ],
  },
  'cin_krater': {
    id: 'cin_krater', name: 'Кратер', sprite: '🏋️', location: 'cinnabarStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Залить водой, выстоять жаром: контрудар и серия. Выдержишь мою программу?',
      default: 'Пар и камень. Жду на помосте!',
      quest_offer: 'Программа требует {target} {item}. Несгораемо!',
      quest_complete: 'Несгораемый! Ни вода, ни пламя тебе нипочём.',
      quest_incomplete: 'Программа не выполнена. Жар ещё держится...',
    },
    quests: [
      { id: 'cin_counter', type: 'defeat_x', targetItem: null, targetQty: 95, desc: 'Победи 95 диких водных/земляных (залить водой!)', rewardMoney: 35000, rewardItem: 'absorbBulb', rewardQty: 1, prereqQuest: null, filter: { types: ['water', 'ground'] } },
      { id: 'cin_streak', type: 'streak_x', targetItem: null, targetQty: 22, desc: '22 победы подряд в диких боях (без поражений и побегов)', rewardMoney: 210000, rewardItem: 'razorFang', rewardQty: 1, rewardTitle: 'cinUnburnt', prereqQuest: null },
    ],
  },
  'cin_zhurnal': {
    id: 'cin_zhurnal', name: 'Журнал', sprite: '📓', location: 'pokemonMansion',
    dialog: {
      greet: 'Дневники особняка: шесть точек, мутанты из труб! Коффинги и гримеры лезут из вентиляции. Зачистишь?',
      default: 'Читай дневники. Особняк пишет сам.',
      quest_offer: 'Победи 30 Koffing/Grimer особняка + посети 6 точек!',
      quest_complete: 'Дневники закрыты! Мутанты зачищены. Держи дорожный набор.',
      quest_incomplete: 'Трубы ещё шипят... Не все точки исхожены.',
    },
    quests: [
      { id: 'cin_journals', type: 'defeat_x', targetItem: null, targetQty: 30, desc: 'Победи 30 Koffing/Grimer особняка + посети 6 точек (мутанты из труб!)', rewardMoney: 35000, rewardItem: 'escapeRope', rewardQty: 1, rewardItems: [{ id: 'revive', qty: 2 }], prereqQuest: null, filter: { speciesList: ['koffing', 'grimer'] }, verify: { locs: ['cinnabarIsland', 'pokemonMansion', 'mtEmber', 'kindleRoad', 'seafoamIslands', 'seaRoute21'] } },
    ],
  },
  'cin_parom': {
    id: 'cin_parom', name: 'Паром', sprite: '⛴️', location: 'viridianCity',
    parcel: { questId: 'cin_courier', itemId: 'cinLeg1', label: '📦 Взять ящик на Киноварь' },
    dialog: {
      greet: 'Ящик на Киноварь, через Паллет! Паром ждёт, вулкан ждёт. Возьмёшься? Не вскрывать!',
      default: 'Ящик ждёт курьера. Отлив скоро!',
      quest_offer: 'Довези первый ящик до перевала в Паллете.',
      quest_complete: 'Ящик уже не у меня — вези его!',
      quest_incomplete: 'Ящик ещё у тебя? Вези в Паллет!',
    },
    quests: [],
  },
  'pallet_relay': {
    id: 'pallet_relay', name: 'Почтарь', sprite: '📮', location: 'palletTown',
    exchange: { questId: 'cin_courier', takeItem: 'cinLeg1', giveItem: 'cinLeg2', label: '🔁 Передать ящик на паром' },
    dialog: {
      greet: 'Перевал в Паллете! Ящик с Виридиана на Киноварь? Передам дальше — только покажи первый ящик!',
      default: 'Передаю грузы точно по книгам.',
      quest_offer: 'Покажи ящик с парома — передам следующий.',
      quest_complete: 'Обмен записан в книгу!',
      quest_incomplete: 'Без первого ящика не передам!',
    },
    quests: [],
  },
  'cinnabar_courier': {
    id: 'cinnabar_courier', name: 'Курьер Киновари', sprite: '🛵', location: 'cinnabarIsland',
    dialog: {
      greet: 'Ящик с парома? Через Паллет? Давай сюда — проверю пломбу!',
      default: 'Жду грузов с моря.',
      quest_offer: 'Принеси второй ящик от перевала в Паллете.',
      quest_complete: 'Цел! Пломба на месте. Держи конфету.',
      quest_incomplete: 'Без ящика не приму!',
    },
    quests: [
      { id: 'cin_courier', type: 'collect_items', targetItem: 'cinLeg2', targetQty: 1, desc: 'Довези ящик с Виридиана на Киноварь через Паллет', rewardMoney: 32000, rewardItem: 'expCandyM', rewardQty: 10, prereqQuest: null },
    ],
  },
  // ══════════ ВИРИДИАН (n=7, земля) ══════════
  'vir_lesnik': {
    id: 'vir_lesnik', name: 'Лесник', sprite: '🌲', location: 'viridianCity',
    dialog: {
      greet: 'Виридиан стоит на корне: лес, пещеры, перевал. Замерь корневую тропу — поможешь лесу?',
      default: 'Лес любит терпеливых. Продолжай обход.',
      quest_offer: 'Нужно: {target} {item}. Корни никуда не спешат!',
      quest_complete: 'Обход завершён! Держи плату из лесной кассы.',
      quest_incomplete: 'Тропы ещё не все исхожены...',
    },
    quests: [
      { id: 'vir_trail', type: 'defeat_x', targetItem: null, targetQty: 245, desc: 'Победи 245 диких земляных + посети 12 локаций (средний уровень 50)', rewardMoney: 40000, rewardItem: 'earthPlate', rewardQty: 1, rewardItems: [{ id: 'maxPotion', qty: 2 }], prereqQuest: null, filter: { types: ['ground'] }, verify: { avgLevel: 50, locs: ['viridianCity', 'palletTown', 'route1', 'route2', 'route22', 'route23', 'viridianForest', 'diglettsCave', 'route3', 'route4', 'mtMoon', 'ceruleanCity'] } },
    ],
  },
  'vir_agent': {
    id: 'vir_agent', name: 'Агент R', sprite: '🕶️', location: 'viridianStadium',
    miniBoss: { leaderKey: 'viridianAgent', label: '🕶️ Сразиться (команда 5×Lv63)' },
    dialog: {
      greet: 'Операция «Крот» началась. Моя пятёрка роет глубоко. Посмеешь встать на пути R?',
      default: 'R всегда возвращается. Готовься.',
      quest_offer: 'Побей меня — команда 5×Lv63. Без свидетелей!',
      quest_complete: 'Ты — кара R! Организация признаёт силу. Держи приз.',
      quest_incomplete: 'Сначала победи меня. Крот не сдаётся!',
    },
    quests: [
      { id: 'vir_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Агента R (команда 5×Lv63)', rewardMoney: 120000, rewardItem: 'hardStone', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'rBane', prereqQuest: null, filter: { bossId: 'viridianAgent' } },
    ],
  },
  'vir_kapkan': {
    id: 'vir_kapkan', name: 'Капкан', sprite: '🪤', location: 'viridianForest',
    dialog: {
      greet: 'Виридианский лес: кроты роют, легенда пищит! Кротовая война и лесная легенда — берёшься?',
      default: 'Сиди тихо. Капкан сам щёлкнет.',
      quest_offer: 'Нужно: {target} {item}. Лес не любит шума!',
      quest_complete: 'Вот это добыча! Лес признаёт тебя.',
      quest_incomplete: 'Лес ещё полон шорохов...',
    },
    quests: [
      { id: 'vir_mole', type: 'defeat_x', targetItem: null, targetQty: 120, desc: 'Победи 120 Diglett/Dugtrio (кротовая война!)', rewardMoney: 40000, rewardItem: 'softSand', rewardQty: 1, prereqQuest: null, filter: { speciesList: ['diglett', 'dugtrio'] } },
      { id: 'vir_pika', type: 'catch_x', targetItem: null, targetQty: 26, desc: 'Поймай 26 Pikachu в Виридианском лесу (лесная легенда!)', rewardMoney: 40000, rewardItem: 'lightBall', rewardQty: 1, prereqQuest: null, filter: { species: 'pikachu' }, verify: { locs: ['viridianForest'] } },
    ],
  },
  'vir_seriy': {
    id: 'vir_seriy', name: 'Серый', sprite: '💰', location: 'viridianCity_pokemart',
    dialog: {
      greet: 'Общак R: всё учтено, всё сходится. Покажи оборот — получишь мёд. И никому ни слова.',
      default: 'Считай тихо. Серый всё видит.',
      quest_offer: 'Оборот 2 500 000. Только бои и торговля!',
      quest_complete: 'Общак сошёлся! Серый доволен.',
      quest_incomplete: 'Цифры ещё не сошлись...',
    },
    quests: [
      { id: 'vir_money', type: 'earn_money', targetItem: null, targetQty: 2500000, desc: 'Заработай 2 500 000 боями и торговлей (общак R!)', rewardMoney: 40000, rewardItem: 'maxHoney', rewardQty: 5, prereqQuest: null },
    ],
  },
  'vir_nora': {
    id: 'vir_nora', name: 'Нора', sprite: '🥚', location: 'viridianCity_pokecenter',
    dialog: {
      greet: 'Нора-гнездо: тепло земли, мох, скорлупа. Выведи четверых — будет уютно.',
      default: 'Тепло и темно — как в норе. Центр всегда открыт.',
      quest_offer: 'Вылупи четверых. Тёплых. Мохнатых.',
      quest_complete: 'Смотри, скорлупа треснула! Держи благовоние удачи.',
      quest_incomplete: 'Инкубатор ещё гудит...',
    },
    quests: [
      { id: 'vir_breed', type: 'hatch_x', targetItem: null, targetQty: 4, desc: 'Выведи и вылупи 4 яйца', rewardMoney: 64000, rewardItem: 'luckIncense', rewardQty: 1, prereqQuest: null },
    ],
  },
  'vir_plato': {
    id: 'vir_plato', name: 'Плато', sprite: '🏋️', location: 'viridianStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Полив, покос, твёрдая порода: контрудар и серия. Выдержишь мою программу?',
      default: 'Камень и вода. Жду на помосте!',
      quest_offer: 'Программа требует {target} {item}. Твёрдо!',
      quest_complete: 'Неподкупный! Твёрдая порода. Держи приз.',
      quest_incomplete: 'Программа не выполнена. Порода ещё крошится...',
    },
    quests: [
      { id: 'vir_counter', type: 'defeat_x', targetItem: null, targetQty: 120, desc: 'Победи 120 диких водных/травяных/ледяных (полив и покос!)', rewardMoney: 40000, rewardItem: 'iceHeal', rewardQty: 5, prereqQuest: null, filter: { types: ['water', 'grass', 'ice'] } },
      { id: 'vir_streak', type: 'streak_x', targetItem: null, targetQty: 24, desc: '24 победы подряд в диких боях (без поражений и побегов)', rewardMoney: 240000, rewardItem: 'brightPowder', rewardQty: 1, rewardTitle: 'virIncorruptible', prereqQuest: null },
    ],
  },
  'vir_pallet': {
    id: 'vir_pallet', name: 'Паллет', sprite: '🎒', location: 'palletTown',
    dialog: {
      greet: 'Спелеолог из Паллета: пещеры, норы, верёвки! Посетил всё — верёвок не осталось. Раздобудешь?',
      default: 'Дороги зовут. Пещеры ждут.',
      quest_offer: 'Используй 22 Escape Rope. Спелеолог считает каждый узел!',
      quest_complete: 'Все узлы развязаны! Держи болы.',
      quest_incomplete: 'Верёвок ещё не хватает...',
    },
    quests: [
      { id: 'vir_rope', type: 'use_item', targetItem: null, targetQty: 22, desc: 'Используй 22 Escape Rope (спелеолог из Паллета!)', rewardMoney: 36000, rewardItem: 'greatBall', rewardQty: 8, prereqQuest: null, filter: { itemId: 'escapeRope' } },
    ],
  },
  'pewter_pereval': {
    id: 'pewter_pereval', name: 'Перевал', sprite: '🛵', location: 'pewterCity',
    parcel: { questId: 'vir_courier', itemId: 'parcelVir', label: '📦 Взять посылку в Виридиан' },
    dialog: {
      greet: 'Посылку в Виридиан надо доставить. С перевала Пьютера! Возьмёшься? Не вскрывать!',
      default: 'Посылка ждёт курьера. Тропа открыта!',
      quest_offer: 'Довези запечатанную посылку курьеру в Виридиан.',
      quest_complete: 'Посылка уже не у меня — вези её!',
      quest_incomplete: 'Посылка ещё у тебя? Вези в Виридиан!',
    },
    quests: [],
  },
  'viridian_courier': {
    id: 'viridian_courier', name: 'Курьер Виридиана', sprite: '🛵', location: 'viridianCity',
    dialog: {
      greet: 'Посылка с перевала? От Пьютера? Давай сюда — проверю сургуч!',
      default: 'Жду посылок с севера.',
      quest_offer: 'Принеси посылку от Перевала из Пьютера.',
      quest_complete: 'Цела! Сургуч на месте. Держи конфеты.',
      quest_incomplete: 'Без посылки не приму!',
    },
    quests: [
      { id: 'vir_courier', type: 'collect_items', targetItem: 'parcelVir', targetQty: 1, desc: 'Довези посылку с перевала Пьютера в Виридиан', rewardMoney: 36000, rewardItem: 'expCandyM', rewardQty: 20, prereqQuest: null },
    ],
  },
};
