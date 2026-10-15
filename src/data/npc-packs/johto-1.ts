// ─────────────────────────────────────────────────────────────
// johto-1.ts — ПАЧКА ЛЕСЕНКИ: Вайолет, Азалия, Голденрод, Эйкрутик (40 квестов)
// ─────────────────────────────────────────────────────────────
// Источник: docs/QUESTS-LADDER.md, разделы 8–11 + Приложение A (новее таблиц).
// Форма NPC/квестов — как pewter_researcher в src/data/npc.ts:
//   у квеста ВСЕ поля явно (targetItem: null где не надо, prereqQuest: null).
// Правила:
//   - id NPC с префиксом города (vio_/aza_/gol_/ecr_); финалы доставок —
//     полными именами (violet_courier и т.д., как pewter_courier);
//     промежутки цепочек — *_relay по городу обмена.
//   - location ∈ REGIONS; trainingGrounds НЕ существуют — наставники в
//     Stadium/колодце/башне с комментарием // TODO: trainingGrounds.
//   - Награды уже с ремапом Приложения A (tmMid/tmTop-тир, premierBall,
//     maxHoney, ovalStone/moonStone/sunStone/shinyStone, scopeLens,
//     expertBelt, leftovers…).
//   - Титулы ТОЛЬКО из «30 титулов» (боссы + стрики); остальным — без титула.
//   - filter.bossId — ключи gyms.ts байт-в-байт.
//   - filter.speciesList (любой-из), filter.time (ночь), type trade_x,
//     кнопки npc.exchange — реализует движок параллельно, пишем смело.
// ─────────────────────────────────────────────────────────────

export const JOHTO1_NPCS = {
  // ══════════ ВАЙОЛЕТ (n=8, полёт) ══════════
  'vio_ruinolog': {
    id: 'vio_ruinolog', name: 'Руинолог', sprite: '🏛️', location: 'violetCity',
    dialog: {
      greet: 'Руины Альф шепчут, башня Росток скрипит, небо гудит! Поможешь разгадать небесную тропу?',
      default: 'Камень помнит, ветер носит. Продолжай наблюдения.',
      quest_offer: 'Нужно: {target} {item}. Небо никуда не спешит — а мы спешим!',
      quest_complete: 'Данные с башни и руин сошлись! Фонды Вайолета платят исправно.',
      quest_incomplete: 'Сбор не окончен. Руины ждут, маршруты ждут...',
    },
    quests: [
      { id: 'vio_trail', type: 'defeat_x', targetItem: null, targetQty: 305, desc: 'Победи 305 диких летающих + исходи 13 локаций (средний уровень 55)', rewardMoney: 45000, rewardItem: 'skyPlate', rewardQty: 1, rewardItems: [{ id: 'maxPotion', qty: 3 }], prereqQuest: null, filter: { types: ['flying'] }, verify: { avgLevel: 55, locs: ['violetCity', 'sproutTower', 'ruinsOfAlph', 'route31', 'route32', 'unionCave', 'route33', 'route36', 'route37', 'nationalPark', 'cherrygroveCity', 'route29', 'route30'] } },
      { id: 'vio_unown', type: 'catch_x', targetItem: null, targetQty: 26, desc: 'Поймай 26 Unown (весь алфавит руин Альф!)', rewardMoney: 45000, rewardItem: 'fullHeal', rewardQty: 5, prereqQuest: null, filter: { species: 'unown' } },
    ],
  },
  'vio_rostok': {
    id: 'vio_rostok', name: 'Росток', sprite: '🌱', location: 'sproutTower',
    dialog: {
      greet: 'Башня Росток качается, колокола звонят, а ночью тут шуршат крылья... Видел Хутута?',
      default: 'Тихо. Слушай башню. Ночь всё покажет.',
      quest_offer: 'Нужны три Хутута, пойманные ночью. Дозор — дело тёмное!',
      quest_complete: 'Ночной дозор пройден! Башня спит спокойно.',
      quest_incomplete: 'Хутуты всё ещё шуршат во тьме башни...',
    },
    quests: [
      { id: 'vio_night', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймай Hoothoot ×3 ночью', rewardMoney: 225000, rewardItem: 'duskBall', rewardQty: 10, prereqQuest: null, filter: { species: 'hoothoot', time: 'night' } },
    ],
  },
  'vio_bashnya': {
    id: 'vio_bashnya', name: 'Башня', sprite: '🏋️', location: 'violetStadium', // TODO: trainingGrounds
    dialog: {
      greet: 'Ветер бьёт, камень сечёт, искра жжёт! Моя программа сделает из тебя вольный ветер. Выдержишь?',
      default: 'Стойка тверда, взгляд в небо. Жду на помосте!',
      quest_offer: 'Программа требует {target} {item}. Вольный ветер не знает пощады!',
      quest_complete: 'Попутный ветер! Никто тебя не догонит. Держи пояс мастера.',
      quest_incomplete: 'Программа не выполнена. Ветер ещё встречный...',
    },
    quests: [
      { id: 'vio_counter', type: 'defeat_x', targetItem: null, targetQty: 150, desc: 'Победи 150 диких электрических/ледяных/каменных (каменный град!)', rewardMoney: 45000, rewardItem: 'sharpBeak', rewardQty: 1, prereqQuest: null, filter: { types: ['electric', 'ice', 'rock'] } },
      { id: 'vio_streak', type: 'streak_x', targetItem: null, targetQty: 26, desc: '26 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 270000, rewardItem: 'expertBelt', rewardQty: 1, rewardTitle: 'vioFreeWind', prereqQuest: null },
    ],
  },
  'vio_kolokol': {
    id: 'vio_kolokol', name: 'Колокол', sprite: '💰', location: 'violetCity_pokemart',
    dialog: {
      greet: 'Почтовый сбор: башня гудит, маркет торгует, монеты звенят. Покажи оборот — получишь мёд.',
      default: 'Считай честно. Колокол слышит каждую монету.',
      quest_offer: 'Оборот 4 000 000. Башенный колокол не ждёт!',
      quest_complete: 'Сбор закрыт! Колокол звонит в твою честь.',
      quest_incomplete: 'Касса ещё не гудит... Торгуй и сражайся!',
    },
    quests: [
      { id: 'vio_money', type: 'earn_money', targetItem: null, targetQty: 4000000, desc: 'Заработай 4 000 000 боями и торговлей', rewardMoney: 45000, rewardItem: 'maxHoney', rewardQty: 12, prereqQuest: null },
    ],
  },
  'vio_gnezdo': {
    id: 'vio_gnezdo', name: 'Гнездо', sprite: '🥚', location: 'violetCity_pokecenter',
    dialog: {
      greet: 'Высокое гнездо: ветер, перья, скорлупа! Выведи птенцов под самым небом — будет светло.',
      default: 'Тепло, забота и мягкая подстилка. Центр всегда открыт.',
      quest_offer: 'Вылупи пятерых. Живых. Пищащих. Крылатых.',
      quest_complete: 'Смотри, скорлупа треснула! Гнездо довольно. Держи камень.',
      quest_incomplete: 'Инкубатор ещё гудит... Птенцы не вылупились.',
    },
    quests: [
      { id: 'vio_breed', type: 'hatch_x', targetItem: null, targetQty: 5, desc: 'Выведи и вылупи 5 яиц', rewardMoney: 72000, rewardItem: 'ovalStone', rewardQty: 1, prereqQuest: null },
    ],
  },
  'vio_skay': {
    id: 'vio_skay', name: 'Скай', sprite: '✈️', location: 'violetStadium',
    miniBoss: { leaderKey: 'violetSky', label: '✈️ Сразиться (команда 5×Lv68)' },
    dialog: {
      greet: 'Небо — мой дом, ветер — мой друг! Пять моих птиц разорвут любые облака. Рискнёшь взлететь?',
      default: 'Тренируй крылья. Небо любит упорных.',
      quest_offer: 'Побей меня — команда 5×Lv68. Воздушный бой, один на один с небом!',
      quest_complete: 'Властелин небес! Облака расступились. Держи приз и титул.',
      quest_incomplete: 'Сначала победи меня в небе. Ветер не прощает суеты.',
    },
    quests: [
      { id: 'vio_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Пилота Ская (команда 5×Lv68)', rewardMoney: 135000, rewardItem: 'whiteHerb', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'skyLord', prereqQuest: null, filter: { bossId: 'violetSky' } },
    ],
  },
  'vio_stareishina': {
    id: 'vio_stareishina', name: 'Старейшина', sprite: '👴', location: 'ruinsOfAlph',
    dialog: {
      greet: 'Столб башни держит небо, руины держат память. Исходи святые места Джото — не выходя за его пределы!',
      default: 'Камни ждут. Тропа сама ляжет под ноги.',
      quest_offer: 'Исходи город, башню Росток, руины, маршруты, пещеру и парк. Только Джото!',
      quest_complete: 'Столб пройден! Руины признали тебя своим.',
      quest_incomplete: 'Ещё не все точки исхожены. Камни молчат...',
    },
    quests: [
      { id: 'vio_pillar', type: 'special', targetItem: null, targetQty: 1, desc: 'Исходи 7 точек Джото (город, башня Росток, руины, маршруты, пещера, парк)', rewardMoney: 45000, rewardItem: 'escapeRope', rewardQty: 1, rewardItems: [{ id: 'superPotion', qty: 5 }], prereqQuest: null, verify: { locs: ['violetCity', 'sproutTower', 'ruinsOfAlph', 'route32', 'unionCave', 'route36', 'nationalPark'] } },
    ],
  },
  'vio_perelet': {
    id: 'vio_perelet', name: 'Перелёт', sprite: '🚂', location: 'viridianCity',
    parcel: { questId: 'vio_courier', itemId: 'parcelVio', label: '📦 Взять посылку в Вайолет' },
    dialog: {
      greet: 'Посылку в Вайолет надо доставить. Возьмёшься? Не вскрывать — там хрупкое, башенное!',
      default: 'Посылка ждёт курьера. Ветер попутный!',
      quest_offer: 'Довези запечатанную посылку курьеру в Вайолет.',
      quest_complete: 'Посылка уже не у меня — вези её!',
      quest_incomplete: 'Посылка ещё у тебя? Вези в Вайолет, не вскрывай!',
    },
    quests: [],
  },
  'violet_courier': {
    id: 'violet_courier', name: 'Курьер Вайолета', sprite: '🛵', location: 'violetCity',
    dialog: {
      greet: 'Посылка из Виридиана? Давай сюда — проверю печать башни!',
      default: 'Жду посылок с юга, с ветром.',
      quest_offer: 'Принеси посылку от Перелёта из Виридиана.',
      quest_complete: 'Цела! Печать на месте. Держи конфеты за скорость.',
      quest_incomplete: 'Без посылки не приму. Перелёт ждёт подтверждения!',
    },
    quests: [
      { id: 'vio_courier', type: 'collect_items', targetItem: 'parcelVio', targetQty: 1, desc: 'Довези посылку из Виридиана в Вайолет', rewardMoney: 41000, rewardItem: 'expCandyL', rewardQty: 15, prereqQuest: null },
    ],
  },
  // ══════════ АЗАЛИЯ (n=9, жуки) ══════════
  'aza_entomolog': {
    id: 'aza_entomolog', name: 'Энтомолог', sprite: '🐛', location: 'azaleaTown',
    dialog: {
      greet: 'Азалия жужжит: Иликс шумит, колодец зевает, смола течёт! Поможешь с жужжащей тропой?',
      default: 'Жуки любят внимательных. Продолжай сбор.',
      quest_offer: 'Нужно: {target} {item}. Сачок не забудь!',
      quest_complete: 'Коллекция пополнена! Хитин блестит, наука довольна.',
      quest_incomplete: 'Рой ещё не весь пересчитан...',
    },
    quests: [
      { id: 'aza_trail', type: 'defeat_x', targetItem: null, targetQty: 375, desc: 'Победи 375 диких жуков + исходи 14 локаций (средний уровень 60)', rewardMoney: 50000, rewardItem: 'insectPlate', rewardQty: 1, rewardItems: [{ id: 'maxPotion', qty: 4 }], prereqQuest: null, filter: { types: ['bug'] }, verify: { avgLevel: 60, locs: ['azaleaTown', 'ilexForest', 'slowpokeWell', 'route32', 'route33', 'route34', 'route35', 'route36', 'route37', 'unionCave', 'goldenrodCity', 'nationalPark', 'ruinsOfAlph', 'violetCity'] } },
    ],
  },
  'aza_pautina': {
    id: 'aza_pautina', name: 'Паутина', sprite: '🕸️', location: 'ilexForest',
    dialog: {
      greet: 'Иликс шепчет: паутина дрожит, конкурс зовёт! Зачисти лес от пауков — а там и главный приз.',
      default: 'Тихо. Не рви паутину раньше времени.',
      quest_offer: 'Нужно: {target} {item}. Лес смотрит — не оплошай!',
      quest_complete: 'Лес вздохнул свободно! Судьи конкурса в восторге.',
      quest_incomplete: 'Пауки всё ещё шуршат в листве...',
    },
    quests: [
      { id: 'aza_spider', type: 'defeat_x', targetItem: null, targetQty: 185, desc: 'Победи 185 Spinarak/Ariados в Иликс (паутинная зачистка!)', rewardMoney: 50000, rewardItem: 'silverPowder', rewardQty: 1, prereqQuest: null, filter: { speciesList: ['spinarak', 'ariados'] } },
      { id: 'aza_contest', type: 'catch_x', targetItem: null, targetQty: 4, desc: 'Поймай Scyther ×4 (судья смотрит уровень: нужен 70!)', rewardMoney: 500000, rewardItem: 'timerBall', rewardQty: 4, prereqQuest: null, filter: { species: 'scyther' }, verify: { maxLevel: 70 } },
    ],
  },
  'aza_kolodets': {
    id: 'aza_kolodets', name: 'Колодец', sprite: '🏋️', location: 'slowpokeWell', // TODO: trainingGrounds
    dialog: {
      greet: 'Колодец зевает, Слоупоки дремлют... Не спи! Дымовая шашка, закалка, стрик — три испытания колодца.',
      default: 'Зевота заразительна. Держись, тренер!',
      quest_offer: 'Колодец требует {target} {item}. Без укусов, без дрёмы!',
      quest_complete: 'Без укусов! Колодец гудит от восторга. Держи приз.',
      quest_incomplete: 'Испытания не пройдены. Вода ещё сонная...',
    },
    quests: [
      { id: 'aza_counter', type: 'defeat_x', targetItem: null, targetQty: 185, desc: 'Победи 185 диких огненных/летающих/каменных (дымовая шашка!)', rewardMoney: 50000, rewardItem: 'fluffyTail', rewardQty: 3, prereqQuest: null, filter: { types: ['fire', 'flying', 'rock'] } },
      { id: 'aza_temper', type: 'special', targetItem: null, targetQty: 1, desc: 'Набери 360 EV в пул команды (закалка колодца)', rewardMoney: 100000, rewardItem: 'abilityCapsule', rewardQty: 1, prereqQuest: null, verify: { evPool: 360 } },
      { id: 'aza_streak', type: 'streak_x', targetItem: null, targetQty: 28, desc: '28 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 300000, rewardItem: 'scopeLens', rewardQty: 1, rewardTitle: 'azaSting', prereqQuest: null },
    ],
  },
  'aza_smola': {
    id: 'aza_smola', name: 'Смола', sprite: '💰', location: 'azaleaTown_pokemart',
    dialog: {
      greet: 'Смоляной промысел: Иликс течёт, маркет торгует. Покажи оборот — получишь мёд бочками.',
      default: 'Смола липнет к рукам, монеты — к кассе.',
      quest_offer: 'Оборот 6 500 000. Лес не ждёт!',
      quest_complete: 'Промысел удался! Смола продана, мёд твой.',
      quest_incomplete: 'Бочки ещё полупусты...',
    },
    quests: [
      { id: 'aza_money', type: 'earn_money', targetItem: null, targetQty: 6500000, desc: 'Заработай 6 500 000 боями и торговлей', rewardMoney: 50000, rewardItem: 'maxHoney', rewardQty: 15, prereqQuest: null },
    ],
  },
  'aza_kokon': {
    id: 'aza_kokon', name: 'Кокон', sprite: '🥚', location: 'azaleaTown_pokecenter',
    dialog: {
      greet: 'Коконная: тихо, тепло, шуршит... Выведи малышей — будет звонко!',
      default: 'Не шуми. Коконы слушают.',
      quest_offer: 'Вылупи пятерых. Тихо. Тепло. Терпеливо.',
      quest_complete: 'Смотри, коконы треснули! Держи лунный камень.',
      quest_incomplete: 'Инкубатор ещё гудит... Коконы не раскрылись.',
    },
    quests: [
      { id: 'aza_breed', type: 'hatch_x', targetItem: null, targetQty: 5, desc: 'Выведи и вылупи 5 яиц', rewardMoney: 80000, rewardItem: 'moonStone', rewardQty: 1, prereqQuest: null },
    ],
  },
  'aza_roy': {
    id: 'aza_roy', name: 'Рой', sprite: '🪲', location: 'azaleaStadium',
    miniBoss: { leaderKey: 'azaleaSwarm', label: '🪲 Сразиться (команда 5×Lv73)' },
    dialog: {
      greet: 'Ж-ж-ж! Рой гудит, хитин звенит! Пять моих жуков прогрызут любую броню. Посмеешь?',
      default: 'Рой ждёт. Точи жвалы... то есть команду!',
      quest_offer: 'Побей меня — команда 5×Lv73. Роевой гул не смолкает!',
      quest_complete: 'Роевой! Ты свой в рое. Держи приз и жало.',
      quest_incomplete: 'Сначала победи меня. Рой не сдаётся!',
    },
    quests: [
      { id: 'aza_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Ловца Жуков Роя (команда 5×Lv73)', rewardMoney: 150000, rewardItem: 'mentalHerb', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'swarmKin', prereqQuest: null, filter: { bossId: 'azaleaSwarm' } },
    ],
  },
  'aza_les': {
    id: 'aza_les', name: 'Лес', sprite: '🛵', location: 'violetCity',
    parcel: { questId: 'aza_courier', itemId: 'azaLeg1', label: '📦 Взять смолу в Азалию' },
    dialog: {
      greet: 'Смолу в Азалию надо довезти. Первое плечо — из Вайолета в лес! Возьмёшься? Не вскрывать!',
      default: 'Смола ждёт курьера. Пахнет хвоей!',
      quest_offer: 'Довези запечатанную смолу до связного в Азалии.',
      quest_complete: 'Смола уже не у меня — вези её!',
      quest_incomplete: 'Смола ещё у тебя? Вези в Азалию!',
    },
    quests: [],
  },
  'azalea_relay': {
    id: 'azalea_relay', name: 'Связной Азалии', sprite: '🔁', location: 'azaleaTown',
    exchange: { questId: 'aza_courier', takeItem: 'azaLeg1', giveItem: 'azaLeg2', label: '🔁 Передать смолу дальше' },
    dialog: {
      greet: 'Смола из Вайолета? Перепакую для Голденрода — там второе плечо. Давай сюда!',
      default: 'Перевалочный пункт. Смола, печати, второе плечо.',
      quest_offer: 'Обменяй груз у меня — и вези дальше, в Голденрод!',
      quest_complete: 'Обмен закрыт! Вези груз в Голденрод.',
      quest_incomplete: 'Без первого груза обмен не сойдётся...',
    },
    quests: [],
  },
  'goldenrod_courier': {
    id: 'goldenrod_courier', name: 'Курьер Голденрода', sprite: '🛵', location: 'goldenrodCity',
    dialog: {
      greet: 'Смола из Азалии? Давай сюда — проверю печать леса!',
      default: 'Жду грузов с юга, из лесов.',
      quest_offer: 'Принеси смолу от связного из Азалии.',
      quest_complete: 'Цела! Пахнет хвоей. Держи конфеты за скорость.',
      quest_incomplete: 'Без смолы не приму!',
    },
    quests: [
      { id: 'aza_courier', type: 'collect_items', targetItem: 'azaLeg2', targetQty: 1, desc: 'Довези смолу из Азалии в Голденрод (через связного)', rewardMoney: 45000, rewardItem: 'protein', rewardQty: 2, prereqQuest: null },
    ],
  },
  // ══════════ ГОЛДЕНРОД (n=10, норма) ══════════
  'gol_urbanist': {
    id: 'gol_urbanist', name: 'Урбанист', sprite: '🏙️', location: 'goldenrodCity',
    dialog: {
      greet: 'Неон, вокзал, радиобашня, штаб... Голденрод не спит! Поможешь с неоновой тропой?',
      default: 'Город гудит. Продолжай наблюдения.',
      quest_offer: 'Нужно: {target} {item}. Неон никуда не спешит!',
      quest_complete: 'Данные сошлись! Неон сияет, фонды платят.',
      quest_incomplete: 'Сбор не окончен. Улицы ждут...',
    },
    quests: [
      { id: 'gol_trail', type: 'defeat_x', targetItem: null, targetQty: 455, desc: 'Победи 455 диких обычных + исходи 15 локаций (средний уровень 65)', rewardMoney: 55000, rewardItem: 'tm31', rewardQty: 1, rewardItems: [{ id: 'fullRestore', qty: 1 }], prereqQuest: null, filter: { types: ['normal'] }, verify: { avgLevel: 65, locs: ['goldenrodCity', 'goldenrodStation', 'teamRocketHq', 'route32', 'route33', 'route34', 'route35', 'route36', 'route37', 'route38', 'route39', 'unionCave', 'ilexForest', 'azaleaTown', 'nationalPark'] } },
    ],
  },
  'gol_park': {
    id: 'gol_park', name: 'Парк', sprite: '🌳', location: 'nationalPark',
    dialog: {
      greet: 'Национальный парк кишит: крысы шуршат, мяуты мурчат! Город просит зачистку — возьмёшься?',
      default: 'Тихо. Не спугни... хотя кого тут пугать — их сотни!',
      quest_offer: 'Победи 225 Rattata/Raticate/Meowth/Persian. Город кишит!',
      quest_complete: 'Парк вздохнул! Тропинки свободны.',
      quest_incomplete: 'Крысы всё ещё шуршат в кустах...',
    },
    quests: [
      { id: 'gol_rats', type: 'defeat_x', targetItem: null, targetQty: 225, desc: 'Победи 225 Rattata/Raticate/Meowth/Persian (крысиная зачистка!)', rewardMoney: 55000, rewardItem: 'silkScarf', rewardQty: 1, prereqQuest: null, filter: { speciesList: ['rattata', 'raticate', 'meowth', 'persian'] } },
    ],
  },
  'gol_radio': {
    id: 'gol_radio', name: 'Радиобашня', sprite: '📻', location: 'teamRocketHq',
    dialog: {
      greet: 'Шипение эфира, тени в подвале... Штаб R засел внизу! Зачисти подвал — а там и без антрактов.',
      default: 'Эфир гудит. Башня держится.',
      quest_offer: 'Башня требует {target} {item}. Крысы в подвале — выкури их!',
      quest_complete: 'Эфир чист! Ты — кумир башни. Держи приз.',
      quest_incomplete: 'Тени всё ещё шуршат в подвале...',
    },
    quests: [
      { id: 'gol_rockets', type: 'defeat_x', targetItem: null, targetQty: 225, desc: 'Победи 225 диких ядовитых/тёмных (зачистка штаба R!)', rewardMoney: 55000, rewardItem: 'blackGlasses', rewardQty: 1, prereqQuest: null, filter: { types: ['poison', 'dark'] } },
      { id: 'gol_streak', type: 'streak_x', targetItem: null, targetQty: 30, desc: '30 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 330000, rewardItem: 'metronome', rewardQty: 1, rewardTitle: 'golIdol', prereqQuest: null },
    ],
  },
  'gol_vitrina': {
    id: 'gol_vitrina', name: 'Витрина', sprite: '💰', location: 'goldenrodCity_pokemart',
    dialog: {
      greet: 'Неоновый оборот и бартер-холл: монеты, обмены, витрины! Покажи оборот — а там и поторгуемся.',
      default: 'Витрина блестит. Город торгует.',
      quest_offer: 'Нужно: {target} {item}. Неон не ждёт!',
      quest_complete: 'Сделка закрыта в плюс! Витрина сияет.',
      quest_incomplete: 'Оборот ещё не сошёлся... Обмены ещё не закрыты...',
    },
    quests: [
      { id: 'gol_money', type: 'earn_money', targetItem: null, targetQty: 10000000, desc: 'Заработай 10 000 000 боями и торговлей', rewardMoney: 55000, rewardItem: 'maxHoney', rewardQty: 18, prereqQuest: null },
      { id: 'gol_trade', type: 'trade_x', targetItem: null, targetQty: 3, desc: 'Соверши 3 обмена в трейд-центре (бартер-холл!)', rewardMoney: 330000, rewardItem: 'ppMax', rewardQty: 1, prereqQuest: null },
    ],
  },
  'gol_selektsiya': {
    id: 'gol_selektsiya', name: 'Селекция', sprite: '🥚', location: 'goldenrodCity_pokecenter',
    dialog: {
      greet: 'Селекция: родословные, стати, неон! Выведи шестерых — будет звёздный помёт.',
      default: 'Карточки помёта в порядке. Центр всегда открыт.',
      quest_offer: 'Вылупи шестерых. Породистых. Звёздных.',
      quest_complete: 'Вот это помёт! Держи солнечный камень.',
      quest_incomplete: 'Инкубатор ещё гудит... Селекция ждёт.',
    },
    quests: [
      { id: 'gol_breed', type: 'hatch_x', targetItem: null, targetQty: 6, desc: 'Выведи и вылупи 6 яиц', rewardMoney: 88000, rewardItem: 'sunStone', rewardQty: 1, prereqQuest: null },
    ],
  },
  'gol_norm': {
    id: 'gol_norm', name: 'Норм', sprite: '⭐', location: 'goldenrodStadium',
    miniBoss: { leaderKey: 'goldenrodNorm', label: '⭐ Сразиться (команда 5×Lv78)' },
    dialog: {
      greet: 'Я — суперфанат нормальных! Пять моих звёзд сияют ярче неона. Твой звёздный час — или мой?',
      default: 'Неон ждёт реванша. Тренируйся!',
      quest_offer: 'Побей меня — команда 5×Lv78. Звёздный час пробил!',
      quest_complete: 'Звезда Голденрода! Неон признал тебя. Держи приз.',
      quest_incomplete: 'Сначала победи меня. Звёзды не сдаются!',
    },
    quests: [
      { id: 'gol_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Суперфаната Норма (команда 5×Lv78)', rewardMoney: 165000, rewardItem: 'powerHerb', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'goldenStar', prereqQuest: null, filter: { bossId: 'goldenrodNorm' } },
    ],
  },
  'gol_vokzal': {
    id: 'gol_vokzal', name: 'Вокзал', sprite: '🚉', location: 'goldenrodStation',
    dialog: {
      greet: 'Маглев гудит, платформа 1! Штурм башни: город, штаб, вокзал, маршруты, парк. Успей до отправления!',
      default: 'Не стой на путях. Расписание — святое.',
      quest_offer: 'Исходи город, штаб, вокзал, маршруты и парк. Поезд не ждёт!',
      quest_complete: 'Все точки исхожены! Штурм удался. Держи дорожный набор.',
      quest_incomplete: 'Ещё не все точки исхожены. Состав уже подан...',
    },
    quests: [
      { id: 'gol_hq', type: 'special', targetItem: null, targetQty: 1, desc: 'Исходи 6 точек (город, штаб, вокзал, маршруты, парк)', rewardMoney: 55000, rewardItem: 'escapeRope', rewardQty: 1, rewardItems: [{ id: 'fullHeal', qty: 3 }], prereqQuest: null, verify: { locs: ['goldenrodCity', 'teamRocketHq', 'goldenrodStation', 'route34', 'route35', 'nationalPark'] } },
    ],
  },
  'gol_express': {
    id: 'gol_express', name: 'Экспресс', sprite: '🚂', location: 'azaleaTown',
    parcel: { questId: 'gol_courier', itemId: 'golLeg1', label: '📦 Взять груз в Голденрод' },
    dialog: {
      greet: 'Экспресс до Голденрода! Первое плечо — из Азалии в неон. Возьмёшься? Не вскрывать!',
      default: 'Груз ждёт курьера. Рельсы гудят!',
      quest_offer: 'Довези запечатанный груз до связного в Голденроде.',
      quest_complete: 'Груз уже не у меня — вези его!',
      quest_incomplete: 'Груз ещё у тебя? Вези в Голденрод!',
    },
    quests: [],
  },
  'goldenrod_relay': {
    id: 'goldenrod_relay', name: 'Связной Голденрода', sprite: '🔁', location: 'goldenrodCity',
    exchange: { questId: 'gol_courier', takeItem: 'golLeg1', giveItem: 'golLeg2', label: '🔁 Передать груз дальше' },
    dialog: {
      greet: 'Груз из Азалии? Перепакую для Эйкрутика — там второе плечо. Давай сюда!',
      default: 'Перевалочный пункт. Грузы, печати, второе плечо.',
      quest_offer: 'Обменяй груз у меня — и вези дальше, в Эйкрутик!',
      quest_complete: 'Обмен закрыт! Вези груз в Эйкрутик.',
      quest_incomplete: 'Без первого груза обмен не сойдётся...',
    },
    quests: [],
  },
  'ecruteak_courier': {
    id: 'ecruteak_courier', name: 'Курьер Эйкрутика', sprite: '🛵', location: 'ecruteakCity',
    dialog: {
      greet: 'Груз из Голденрода? Давай сюда — проверю печать неона!',
      default: 'Жду грузов с юга, из неона.',
      quest_offer: 'Принеси груз от связного из Голденрода.',
      quest_complete: 'Цел! Печать на месте. Держи конфеты за скорость.',
      quest_incomplete: 'Без груза не приму!',
    },
    quests: [
      { id: 'gol_courier', type: 'collect_items', targetItem: 'golLeg2', targetQty: 1, desc: 'Довези груз из Голденрода в Эйкрутик (через связного)', rewardMoney: 50000, rewardItem: 'calcium', rewardQty: 2, prereqQuest: null },
    ],
  },
  // ══════════ ЭЙКРУТИК (n=11, призраки) ══════════
  'ecr_folklorist': {
    id: 'ecr_folklorist', name: 'Фольклорист', sprite: '📜', location: 'ecruteakCity',
    dialog: {
      greet: 'Башни шепчут, туман стелется... Туманная тропа ждёт: призраки, локи, уровни. Запишешь предание?',
      default: 'Туман помнит всё. Продолжай записи.',
      quest_offer: 'Нужно: {target} {item}. Башни никуда не спешат!',
      quest_complete: 'Предание записано! Туман расступился, фонды платят.',
      quest_incomplete: 'Духи ещё не все пересчитаны...',
    },
    quests: [
      { id: 'ecr_trail', type: 'defeat_x', targetItem: null, targetQty: 545, desc: 'Победи 545 диких призрачных + исходи 16 локаций (средний уровень 70)', rewardMoney: 60000, rewardItem: 'spookyPlate', rewardQty: 1, rewardItems: [{ id: 'fullRestore', qty: 2 }], prereqQuest: null, filter: { types: ['ghost'] }, verify: { avgLevel: 70, locs: ['ecruteakCity', 'bellTower', 'burnedTower', 'route34', 'route35', 'route36', 'route37', 'route38', 'route39', 'olivineCity', 'seaRoute40', 'route42', 'mtMortar', 'goldenrodCity', 'unionCave', 'nationalPark'] } },
    ],
  },
  'ecr_polnoch': {
    id: 'ecr_polnoch', name: 'Полночь', sprite: '🦉', location: 'bellTower',
    dialog: {
      greet: 'Колокол молчит, веера шелестят... Сёстры кимоно танцуют, духи бродят. В полночь — только смелые!',
      default: 'Тихо. Башня слушает.',
      quest_offer: 'Нужно: {target} {item}. Пять вееров, полночь, не моргай!',
      quest_complete: 'Пять вееров сложены! Полночь признала тебя.',
      quest_incomplete: 'Танец ещё не окончен... Духи бродят...',
    },
    quests: [
      { id: 'ecr_kimono', type: 'defeat_x', targetItem: null, targetQty: 40, desc: 'Победи 40 покемонов сестёр кимоно (Vaporeon, Jolteon, Flareon, Espeon, Umbreon) сестёр кимоно (танец пяти стихий!)', rewardMoney: 60000, rewardItem: 'premierBall', rewardQty: 6, prereqQuest: null, filter: { speciesList: ['vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon'] } },
      { id: 'ecr_night', type: 'catch_x', targetItem: null, targetQty: 4, desc: 'Поймай Gastly ×4 ночью (полуночный обход!)', rewardMoney: 300000, rewardItem: 'duskBall', rewardQty: 12, prereqQuest: null, filter: { species: 'gastly', time: 'night' } },
    ],
  },
  'ecr_kolokol': {
    id: 'ecr_kolokol', name: 'Колокол', sprite: '🏋️', location: 'burnedTower', // TODO: trainingGrounds
    dialog: {
      greet: 'Сгоревшая башня помнит пожар... Познай тьму, не моргай! Два испытания колокола — выдержишь?',
      default: 'Пепел под ногами, тени на стенах. Жду!',
      quest_offer: 'Колокол требует {target} {item}. Тьма не прощает суеты!',
      quest_complete: 'Не моргнул! Башня гудит от восторга. Держи приз.',
      quest_incomplete: 'Испытания не пройдены. Тени ещё густы...',
    },
    quests: [
      { id: 'ecr_mirror', type: 'defeat_x', targetItem: null, targetQty: 270, desc: 'Победи 270 диких призрачных/тёмных (познай тьму!)', rewardMoney: 60000, rewardItem: 'spellTag', rewardQty: 1, prereqQuest: null, filter: { types: ['ghost', 'dark'] } },
      { id: 'ecr_streak', type: 'streak_x', targetItem: null, targetQty: 32, desc: '32 победы подряд в диких боях (без поражений и побегов)', rewardMoney: 360000, rewardItem: 'leftovers', rewardQty: 1, rewardTitle: 'ecrIncorporeal', prereqQuest: null },
    ],
  },
  'ecr_blagovoniya': {
    id: 'ecr_blagovoniya', name: 'Благовония', sprite: '💰', location: 'ecruteakCity_pokemart',
    dialog: {
      greet: 'Плата за тишину: башни молчат, маркет торгует. Покажи оборот — получишь мёд и покой.',
      default: 'Тихо. Монеты любят тишину.',
      quest_offer: 'Оборот 16 000 000. Башни не ждут!',
      quest_complete: 'Тишина куплена! Мёд твой, торговец.',
      quest_incomplete: 'Касса ещё шумит...',
    },
    quests: [
      { id: 'ecr_money', type: 'earn_money', targetItem: null, targetQty: 16000000, desc: 'Заработай 16 000 000 боями и торговлей', rewardMoney: 60000, rewardItem: 'maxHoney', rewardQty: 22, prereqQuest: null },
    ],
  },
  'ecr_predanie': {
    id: 'ecr_predanie', name: 'Предание', sprite: '🥚', location: 'ecruteakCity_pokecenter',
    dialog: {
      greet: 'Предание оживает: туман, шёпот, скорлупа... Выведи шестерых — будет жутко и тепло.',
      default: 'Тихо. Предания слушают.',
      quest_offer: 'Вылупи шестерых. В тумане. В тепле.',
      quest_complete: 'Смотри, предание ожило! Держи камень.',
      quest_incomplete: 'Инкубатор ещё гудит... Туман не рассеялся.',
    },
    quests: [
      { id: 'ecr_breed', type: 'hatch_x', targetItem: null, targetQty: 6, desc: 'Выведи и вылупи 6 яиц', rewardMoney: 96000, rewardItem: 'shinyStone', rewardQty: 1, prereqQuest: null },
    ],
  },
  'ecr_pepel': {
    id: 'ecr_pepel', name: 'Пепел', sprite: '🔥', location: 'burnedTower',
    dialog: {
      greet: 'Пепел сгоревшей башни... Хочешь доказать, что видел духа? Просто покажи команду. Никакой беготни!',
      default: 'Пепел помнит пожар. Покажи, что помнишь ты.',
      quest_offer: 'Покажи команду: средний уровень 70, максимум 80. Просто покажи!',
      quest_complete: 'Дух доказан! Пепел признал тебя.',
      quest_incomplete: 'Команда ещё слаба для духов...',
    },
    quests: [
      { id: 'ecr_proof', type: 'special', targetItem: null, targetQty: 1, desc: 'Покажи команду: средний уровень 70 + максимум 80 (доказательство духа)', rewardMoney: 120000, rewardItem: 'pokeDoll', rewardQty: 5, prereqQuest: null, verify: { avgLevel: 70, maxLevel: 80 } },
    ],
  },
  'ecr_ten': {
    id: 'ecr_ten', name: 'Тень', sprite: '🌑', location: 'ecruteakStadium',
    miniBoss: { leaderKey: 'ecruteakShade', label: '🌑 Сразиться (команда 6×Lv83)' },
    dialog: {
      greet: 'Ш-ш-ш... Армия теней уже здесь. Шесть моих духов скользят сквозь стены. Не моргай — иначе конец!',
      default: 'Тени ждут. Не моргай.',
      quest_offer: 'Побей меня — команда 6×Lv83. Шёпот башни не смолкает!',
      quest_complete: 'Друг духов! Тени расступились. Держи приз.',
      quest_incomplete: 'Сначала победи меня. Тьма не сдаётся!',
    },
    quests: [
      { id: 'ecr_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Медиума Тень (команда 6×Lv83)', rewardMoney: 180000, rewardItem: 'tm30', rewardQty: 1, rewardItems: [{ id: 'rareCandy', qty: 3 }], rewardTitle: 'spiritFriend', prereqQuest: null, filter: { bossId: 'ecruteakShade' } },
    ],
  },
  'ecr_tma': {
    id: 'ecr_tma', name: 'Тьма', sprite: '🛵', location: 'goldenrodCity',
    parcel: { questId: 'ecr_courier', itemId: 'ecrLeg1', label: '📦 Взять тьму в Эйкрутик' },
    dialog: {
      greet: 'Тьму в Эйкрутик надо довезти. Первое плечо — из неона в туман! Возьмёшься? Не вскрывать!',
      default: 'Тьма ждёт курьера. Неон гудит!',
      quest_offer: 'Довези запечатанную тьму до связного в Эйкрутике.',
      quest_complete: 'Тьма уже не у меня — вези её!',
      quest_incomplete: 'Тьма ещё у тебя? Вези в Эйкрутик!',
    },
    quests: [],
  },
  'ecruteak_relay': {
    id: 'ecruteak_relay', name: 'Связной Эйкрутика', sprite: '🔁', location: 'ecruteakCity',
    exchange: { questId: 'ecr_courier', takeItem: 'ecrLeg1', giveItem: 'ecrLeg2', label: '🔁 Передать тьму дальше' },
    dialog: {
      greet: 'Тьма из Голденрода? Перепакую для Оливина — там второе плечо. Давай сюда!',
      default: 'Перевалочный пункт. Тьма, печати, второе плечо.',
      quest_offer: 'Обменяй груз у меня — и вези дальше, в Оливин!',
      quest_complete: 'Обмен закрыт! Вези груз в Оливин.',
      quest_incomplete: 'Без первого груза обмен не сойдётся...',
    },
    quests: [],
  },
  'olivine_courier': {
    id: 'olivine_courier', name: 'Курьер Оливина', sprite: '🛵', location: 'olivineCity',
    dialog: {
      greet: 'Тьма из Эйкрутика? Давай сюда — проверю печать башен!',
      default: 'Жду грузов с востока, из туманов.',
      quest_offer: 'Принеси тьму от связного из Эйкрутика.',
      quest_complete: 'Цела! Пахнет туманом. Держи конфеты за скорость.',
      quest_incomplete: 'Без тьмы не приму!',
    },
    quests: [
      { id: 'ecr_courier', type: 'collect_items', targetItem: 'ecrLeg2', targetQty: 1, desc: 'Довези тьму из Эйкрутика в Оливин (через связного)', rewardMoney: 54000, rewardItem: 'zinc', rewardQty: 2, prereqQuest: null },
    ],
  },
};
