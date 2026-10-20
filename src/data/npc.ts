// ─────────────────────────────────────────────────────────────
// npc.ts — NPC ТРЕНЕРЫ ДЛЯ СРАЖЕНИЙ
// ─────────────────────────────────────────────────────────────
// NPC_DATA — словарь: ID NPC → его описание.
// Каждый NPC (non-player character) — тренер, с которым можно
// сразиться в определённой локации.
//
// Структура NPC:
//   id: str          — уникальный ID (напр. 'oak_lab', 'route1_youngster')
//   name: str        — имя тренера
//   sprite: str      — эмодзи/спрайт
//   location: str    — ID локации, где NPC находится
//   team: [PokeDef]  — команда покемонов
//   reward: number   — деньги за победу
//   dialogue: {...}  — фразы до/после боя
//   respawnTime?: number — через сколько мс NPC возрождается
//
// Используется: npcs.ts (UI), core.ts (сражения), init.ts
//
// Пачки лесенки квестов (docs/QUESTS-LADDER.md) живут в ОТДЕЛЬНЫХ файлах
// (по одному на агента контента) и подмешиваются сюда спредом — чтобы
// параллельные агенты не писали в один файл:
//   src/data/npc-packs/kanto-1.ts (Церулин, Вермилион, Селадон, Шаффран)
//   src/data/npc-packs/kanto-2.ts (Фуксия, Киноварь, Виридиан)
//   src/data/npc-packs/johto-1.ts (Вайолет, Азалия, Голденрод, Эйкрутик)
//   src/data/npc-packs/johto-2.ts (Сианвуд, Оливин, Махогани, Блэкторн)
// ─────────────────────────────────────────────────────────────
import { KANTO1_NPCS } from './npc-packs/kanto-1.js';
import { KANTO2_NPCS } from './npc-packs/kanto-2.js';
import { JOHTO1_NPCS } from './npc-packs/johto-1.js';
import { JOHTO2_NPCS } from './npc-packs/johto-2.js';
export const NPC_DATA = {
  'professor_tutorial': {
    id: 'professor_tutorial', name: 'Профессор Оук', sprite: '👨‍🔬', location: 'pewterCity',
    dialog: {
      greet: 'Приветствую, молодой тренер! Покематрикс ждёт тебя. Я помогу тебе освоиться.',
      default: 'Продолжай тренироваться. У тебя большой потенциал!',
      quest_offer: 'Отлично, ты готов! Вот задание: {target} {item}. Справишься?',
      quest_complete: 'Превосходно! Ты делаешь успехи. Вот твоя награда!',
      quest_incomplete: 'Возвращайся когда выполнишь задание. У тебя всё получится!',
    },
    quests: [],
  },
  'oak_lab': {
    id: 'oak_lab', name: 'Профессор Оук', sprite: '👨‍🔬', location: 'ceruleanCity',
    dialog: {
      greet: 'Привет! Я профессор Оук. Рад видеть тебя в мире покемонов!',
      default: 'Продолжай тренироваться и заполнять Покедекс!',
      quest_offer: 'Мне нужны образцы покемонов. Принеси мне {target} {item}, и я дам награду.',
      quest_complete: 'Отлично! Ты принёс всё что нужно. Вот твоя награда!',
      quest_incomplete: 'Ещё не всё собрано. Продолжай искать!',
    },
    quests: [],
  },
  // Nurse Joy in Pokemon Center
  'joy_pokecenter': {
    id: 'joy_pokecenter', name: 'Сестра Джой', sprite: '👩‍⚕️', location: 'goldenrodCity_pokecenter',
    dialog: {
      greet: 'Добро пожаловать в Покецентр! Я могу вылечить ваших покемонов.',
      default: 'Ваши покемоны в порядке? Заходите если нужна помощь.',
    },
    quests: [],
  },

  // Daycare in Pokemon Center
  'daycare_pokecenter': {
    id: 'daycare_pokecenter', name: 'Смотритель Питомника', sprite: '👴', location: 'goldenrodCity_pokecenter',
    dialog: {
      greet: 'Добро пожаловать в Питомник! Здесь ваши покемоны могут набираться опыта.',
      default: 'Покемоны растут пока вы путешествуете. Оставьте пару — они поднимут уровень!',
    },
    quests: [],
  },

  // Stylist: смена характера за деньги (решение: минты убраны, характер только здесь)
  'goldenrod_stylist': {
    id: 'goldenrod_stylist', name: 'Стилист', sprite: '💇', location: 'goldenrodCity',
    dialog: {
      greet: 'Кручу характер случайно! Что выпадет — то выпадет. Сеанс ¥1,500,000.',
      default: 'Заглядывай, если характер команды перестал устраивать.',
    },
    quests: [],
  },

  // Tutorial NPC at starting location
  // === EAST JOHTO NPCs ===
  'goldenrod_officer': {
    id: 'goldenrod_officer', name: 'Офицер Джес', sprite: '👮', location: 'goldenrodCity',
    dialog: { greet: 'Добро пожаловать в Голденрод — столицу Восточного Джото!', default: 'Если заметите нарушения правил Лиги-17, обращайтесь ко мне.', quest_offer: 'Новичкам нужно снаряжение. Принеси мне {target} {item}.', quest_complete: 'Отлично! Теперь ты экипирован.', quest_incomplete: 'Приходи когда соберёшь всё.' },
    quests: [],
  },
  'goldenrod_michael': {
    id: 'goldenrod_michael', name: 'Майкл', sprite: '🕵️', location: 'goldenrodCity',
    dialog: { greet: 'Помогите! Похитили Батискафиш!', default: 'Квест "Похищение Батискафиш" ждёт тебя.', quest_offer: 'Найди похитителей! Принеси мне {target} {item} как улику.', quest_complete: 'Ты нашёл их! Спасибо!', quest_incomplete: 'Ищи улики в городе...' },
    quests: [],
  },
  'goldenrod_phill': {
    id: 'goldenrod_phill', name: 'Филл', sprite: '🔬', location: 'goldenrodCity',
    dialog: { greet: 'Покемоны исчезают из Института Голденрода!', default: 'Это загадка, которую нужно разгадать.', quest_offer: 'Для расследования мне нужны {target} {item}.', quest_complete: 'Превосходная работа, тренер!', quest_incomplete: 'Нужно больше данных...' },
    quests: [],
  },
  'goldenrod_academy_soren': {
    id: 'goldenrod_academy_soren', name: 'Инструктор Сорен', sprite: '👨‍🏫', location: 'goldenrod_academy',
    dialog: { greet: 'Я инструктор Сорен из Академии Тренеров.', default: 'Практикум по Эволюции ждёт тебя! Обратись к Лаборанту на Тренировочной зоне.', quest_offer: 'Принеси мне {target} {item} для эволюционного эксперимента.', quest_complete: 'Отлично! Эволюция удалась!', quest_incomplete: 'Нужно больше покемонов для эксперимента.' },
    quests: [],
  },
  'goldenrod_academy_jack': {
    id: 'goldenrod_academy_jack', name: 'Инструктор Джек', sprite: '👨‍🏫', location: 'goldenrod_academy',
    dialog: { greet: 'Я инструктор Джек. Оливии на Дороге №2 нужна помощь.', default: 'Первый малыш — ответственный шаг для тренера.', quest_offer: 'Принеси мне {target} {item} для питомника Оливии.', quest_complete: 'Оливия будет довольна!', quest_incomplete: 'Яйцо ещё не доставлено...' },
    quests: [],
  },
  'goldenrod_academy_olin': {
    id: 'goldenrod_academy_olin', name: 'Инструктор Олин', sprite: '👨‍🏫', location: 'goldenrod_academy',
    dialog: { greet: 'Инструктор Олин. Готовься к тренировкам в Вархолле!', default: 'Кевин в спортивном зале Вархолла ждёт тебя.', quest_offer: 'Подготовь {target} {item} для тренировки.', quest_complete: 'Отлично! Ты готов к настоящим боям!', quest_incomplete: 'Тренировка ещё не завершена.' },
    quests: [],
  },
  'goldenrod_academy_lab_assistant': {
    id: 'goldenrod_academy_lab_assistant', name: 'Лаборант', sprite: '🔬', location: 'goldenrod_academy_training',
    dialog: { greet: 'Лаборант тренировочной зоны. Сорен прислал тебя?', default: 'Собирай эволюционные цепочки для экспериментов.', quest_offer: 'Принеси {target} {item} для лаборатории.', quest_complete: 'Прекрасный материал!', quest_incomplete: 'Нужны ещё образцы.' },
    quests: [],
  },
  'olivine_cashier': {
    id: 'olivine_cashier', name: 'Кассир', sprite: '🎫', location: 'olivine_beach_pier',
    dialog: { greet: 'Билеты на корабль до Канто и Селена!', default: 'Расписание: 10, 14, 18, 22 часа.', quest_offer: 'Матросы просят {target} {item} для ремонта.', quest_complete: 'Корабль готов к плаванию!', quest_incomplete: 'Ремонт ещё не закончен...' },
    quests: [],
  },
  'olivine_secretary': { id: 'olivine_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'olivineStadium', dialog: { greet: 'Водный Стадион Оливина.', default: 'Лидер ждёт смелых.' }, quests: [] },
  'flourence_gardener': {
    id: 'flourence_gardener', name: 'Садовник Флор', sprite: '🌸', location: 'flourence',
    dialog: { greet: 'Флауренция — город цветов! Хочешь помочь в оранжерее?', default: 'Цветы и травяные покемоны — идеальная пара.', quest_offer: 'Принеси мне {target} {item} для новых саженцев.', quest_complete: 'Чудесно! Приходи ещё.', quest_incomplete: 'Растениям нужна подкормка...' },
    quests: [],
  },
  'warhall_mayor': {
    id: 'warhall_mayor', name: 'Мэр Вархолла', sprite: '🏛️', location: 'warhall',
    dialog: { greet: 'Вархолл — новый город с древней историей ниндзя.', default: 'Автовокзал работает по расписанию.', quest_offer: 'Для города нужны стройматериалы: {target} {item}.', quest_complete: 'Город растёт благодаря тебе!', quest_incomplete: 'Стройка продолжается...' },
    quests: [],
  },
  'alston_circus': {
    id: 'alston_circus', name: 'Директор цирка', sprite: '🎪', location: 'alston',
    dialog: { greet: 'Добро пожаловать в цирк Олстона! Наши покемоны-артисты лучшие!', default: 'Цирк основан бродячими артистами.', quest_offer: 'Для нового номера нужны {target} {item}.', quest_complete: 'Браво! Потрясающее выступление!', quest_incomplete: 'Репетиции идут полным ходом...' },
    quests: [],
  },
  // === WEST JOHTO NPCs ===
  'summer_institute': {
    id: 'summer_institute', name: 'Учёный Саммера', sprite: '🔬', location: 'summer',
    dialog: { greet: 'Научный институт Саммера исследует редких покемонов саванны.', default: 'Саванна полна загадок.', quest_offer: 'Принеси мне {target} {item} для исследований.', quest_complete: 'Отличный образец! Это продвинет науку.', quest_incomplete: 'Лаборатория ждёт образцов...' },
    quests: [],
  },
  'summer_gibson': {
    id: 'summer_gibson', name: 'Мистер Гибсон', sprite: '🤠', location: 'summer',
    dialog: { greet: 'Я ищу Земли Прайда. Поможешь?', default: 'Земли Прайда ждут своего героя.', quest_offer: 'Подготовься: собери {target} {item} перед походом.', quest_complete: 'Ты готов! Отправляемся в Земли Прайда!', quest_incomplete: 'Снаряжение ещё не полное...' },
    quests: [],
  },
  'melen_diver': {
    id: 'melen_diver', name: 'Дайвер Мелена', sprite: '🤿', location: 'melen',
    dialog: { greet: 'Дайвинг-центр Мелена — лучший в Джото!', default: 'Под водой скрываются редкие покемоны.', quest_offer: 'Нужен {target} {item} для нового снаряжения.', quest_complete: 'Снаряжение готово! Ныряем!', quest_incomplete: 'Мастерская масок поможет...' },
    quests: [],
  },
  // === SELEN ISLAND NPCs ===
  'ostaron_sage': {
    id: 'ostaron_sage', name: 'Мудрец Остарона', sprite: '🧙', location: 'ostaron',
    dialog: { greet: 'Остарон благословлён легендарным покемоном.', default: 'Мудрость приходит с опытом.', quest_offer: 'Помоги найти пропавшего Меррипика: нужен {target} {item}.', quest_complete: 'Ты нашёл его! Благословляю тебя.', quest_incomplete: 'Меррипик где-то на острове...' },
    quests: [],
  },
  'ostaron_chris': {
    id: 'ostaron_chris', name: 'Крис-покемоновед', sprite: '📋', location: 'ostaron',
    dialog: { greet: 'Я перевоспитываю покемонов! 90% шанс сменить характер.', default: 'Характер влияет на статы.', quest_offer: 'Принеси {target} {item} для моих подопечных.', quest_complete: 'Покемоны счастливы! Спасибо!', quest_incomplete: 'Покемоны ждут угощения...' },
    quests: [],
  },
  'sayref_mayor': {
    id: 'sayref_mayor', name: 'Мэр Сайрефа', sprite: '🏛️', location: 'sayref',
    dialog: { greet: 'Сайреф соперничает с Остароном за звание столицы!', default: 'Наш снеговик — символ города.', quest_offer: 'Укрепи позиции города: принеси {target} {item}.', quest_complete: 'Сайреф процветает!', quest_incomplete: 'Город нуждается в ресурсах...' },
    quests: [],
  },
  'estaire_shipyard': {
    id: 'estaire_shipyard', name: 'Мастер верфи', sprite: '🔧', location: 'estaire_city',
    dialog: { greet: 'Верфь Эстайра строит лучшие корабли!', default: 'Мы строим и чиним корабли.', quest_offer: 'Для заказа нужны {target} {item}.', quest_complete: 'Корабль готов к спуску!', quest_incomplete: 'Детали в дефиците...' },
    quests: [],
  },
  'mountain_village_elder': {
    id: 'mountain_village_elder', name: 'Старейшина деревни', sprite: '👴', location: 'mountain_village',
    dialog: { greet: 'Добро пожаловать в нашу горную деревню, путник.', default: 'Горы хранят древние тайны.', quest_offer: 'Найди {target} {item} в ледяных пещерах.', quest_complete: 'Ты достоин уважения гор.', quest_incomplete: 'Горы испытают тебя...' },
    quests: [],
  },
  // === SOUTHERN ARCHIPELAGO NPCs ===
  'ilde_marcel': {
    id: 'ilde_marcel', name: 'Марсель де Фар', sprite: '🧭', location: 'il_de_far',
    dialog: { greet: 'Добро пожаловать в Иль де Фар — сердце Южного Архипелага!', default: 'Здесь вы найдёте редких покемонов и удивительные места.', quest_offer: 'Для исследования островов нужен {target} {item}.', quest_complete: 'Ты готов к приключениям! Исследуй архипелаг.', quest_incomplete: 'Подготовься получше...' },
    quests: [],
  },
  'sen_aspir_elder': {
    id: 'sen_aspir_elder', name: 'Старейшина Сен Аспира', sprite: '🧓', location: 'sen_aspir',
    dialog: { greet: 'Сен Аспир построен у подножия вулкана Синнабунг.', default: 'Вулкан даёт нам силу.', quest_offer: 'Принеси мне {target} {item} с вулканических склонов.', quest_complete: 'Вулкан благосклонен к тебе!', quest_incomplete: 'Вулкан ждёт подношений...' },
    quests: [],
  },
  'orlua_ghost': {
    id: 'orlua_ghost', name: 'Призрак поместья', sprite: '👻', location: 'orlua_estate',
    dialog: { greet: 'Добро пожаловать в моё поместье... навсегда.', default: 'Здесь обитают духи покемонов.', quest_offer: 'Освободи меня: найди {target} {item}.', quest_complete: 'Спасибо... я свободен...', quest_incomplete: 'Я жду освобождения...' },
    quests: [],
  },
  // === EAST JOHTO QUEST NPCs (from wiki quests) ===
  'ej_storn': {
    id: 'ej_storn', name: 'Сторн', sprite: '🦸', location: 'goldenrodCity',
    dialog: { greet: 'Я Сторн! Собери Великолепную Пятёрку!', default: 'Великолепная Пятёрка ждёт тебя.', quest_offer: 'Принеси мне {target} {item} для команды.', quest_complete: 'Теперь мы непобедимы!', quest_incomplete: 'Пятёрка ещё не в сборе...' },
    quests: [],
  },
  'ej_bridge': {
    id: 'ej_bridge', name: 'Дядюшка Бридж', sprite: '👴', location: 'bridge_ej',
    dialog: { greet: 'Привет, путник! Я Дядюшка Бридж.', default: 'Мост соединяет судьбы.', quest_offer: 'Мне нужны материалы: {target} {item}.', quest_complete: 'Мост будет стоять вечно!', quest_incomplete: 'Мост требует ремонта...' },
    quests: [],
  },
  'ej_palmer': {
    id: 'ej_palmer', name: 'Несчастный Пальмер', sprite: '😰', location: 'alston',
    dialog: { greet: 'Ох... всё пошло не так...', default: 'Моя жизнь — череда неудач.', quest_offer: 'Помоги мне: нужен {target} {item}.', quest_complete: 'Наконец-то удача! Спасибо!', quest_incomplete: 'Опять не везёт...' },
    quests: [],
  },
  'ej_granny': {
    id: 'ej_granny', name: 'Старушка', sprite: '👵', location: 'flourence',
    dialog: { greet: 'Здравствуй, милок. Собираю камушки.', default: 'Камушки рассказывают истории.', quest_offer: 'Найди мне {target} {item}, будь добр.', quest_complete: 'Чудесные камушки! Держи награду.', quest_incomplete: 'Камушки где-то рядом...' },
    quests: [],
  },
  'ej_richie': {
    id: 'ej_richie', name: 'Богатенький Ричи', sprite: '💰', location: 'goldenrodCity',
    dialog: { greet: 'Ха! Ещё один бедняк. Я Ричи — самый богатый в Джото!', default: 'Деньги решают всё.', quest_offer: 'Мне нужна редкая вещь: {target} {item}. Заплачу щедро!', quest_complete: 'Великолепно! Вот твоя награда, бедняк.', quest_incomplete: 'Где мой заказ?!' },
    quests: [],
  },
  'vermilion_richie': {
    id: 'vermilion_richie', name: 'Богатенький Ричи', sprite: '💰', location: 'vermilionCity',
    dialog: { greet: 'Ха! Ещё один бедняк. Я Ричи — самый богатый коллекционер!', default: 'Деньги решают всё.', quest_offer: 'Мне нужна редкая вещь: {target} {item}. Заплачу щедро!', quest_complete: 'Великолепно! Вот твоя награда, бедняк.', quest_incomplete: 'Где мой заказ?!' },
    quests: [],
  },
  'ostaron_richie': {
    id: 'ostaron_richie', name: 'Богатенький Ричи', sprite: '💰', location: 'ostaron',
    dialog: { greet: 'Ха! И здесь бедняки! Я Ричи — коллекционер редкостей!', default: 'Деньги решают всё.', quest_offer: 'Мне нужна редкая вещь: {target} {item}. Заплачу щедро!', quest_complete: 'Великолепно! Вот твоя награда, бедняк.', quest_incomplete: 'Где мой заказ?!' },
    quests: [],
  },
  'saffron_officer': {
    id: 'saffron_officer', name: 'Офицер Джес', sprite: '👮', location: 'saffronCity',
    dialog: { greet: 'Офицер Джес из Канто. Слежу за порядком.', default: 'Если заметите нарушения правил Лиги-17, обращайтесь ко мне.', quest_offer: 'Новичкам нужно снаряжение. Принеси мне {target} {item}.', quest_complete: 'Отлично! Теперь ты экипирован.', quest_incomplete: 'Приходи когда соберёшь всё.' },
    quests: [],
  },
  // === WEST JOHTO QUEST NPCs ===
  'wj_mantej': {
    id: 'wj_mantej', name: 'Мантедж', sprite: '💪', location: 'volcanic_plateau',
    dialog: { greet: 'Я МАНТЕДЖ! Слышишь грохот?!', default: 'Вулкан — мой дом!', quest_offer: 'Докажи силу: принеси {target} {item}!', quest_complete: 'ХА! Ты достоин уважения!', quest_incomplete: 'Слабак! Приходи когда окрепнешь.' },
    quests: [],
  },
  'wj_maisho': {
    id: 'wj_maisho', name: 'Маишо', sprite: '🧪', location: 'melen',
    dialog: { greet: 'Я Маишо, алхимик Мелена. Нужно зелье?', default: 'Зелье Маишо — лучшее в Джото!', quest_offer: 'Для зелья нужен {target} {item}.', quest_complete: 'Зелье готово! Пользуйся с умом.', quest_incomplete: 'Ингредиенты ещё не собраны...' },
    quests: [],
  },
  'wj_pantir': {
    id: 'wj_pantir', name: 'Пантир', sprite: '🐾', location: 'empty_city',
    dialog: { greet: 'Мой Пантир... потерялся в руинах.', default: 'Пантир где-то здесь...', quest_offer: 'Найди Пантира! Ищи {target} {item} как след.', quest_complete: 'Пантир! Ты жив! Спасибо, тренер!', quest_incomplete: 'Следы ведут глубже в руины...' },
    quests: [],
  },
  // === KANTO QUEST NPCs ===
  'kanto_lucy': {
    id: 'kanto_lucy', name: 'Люси', sprite: '🎀', location: 'lavender_town',
    dialog: { greet: 'Моя кукла... она потерялась...', default: 'Кукла Люси — всё что у меня есть.', quest_offer: 'Найди куклу! Нужен {target} {item} чтобы её найти.', quest_complete: 'Моя кукла! Ты нашёл её!', quest_incomplete: 'Кукла где-то в Лавандии...' },
    quests: [],
  },
  'kanto_swot': {
    id: 'kanto_swot', name: 'Профессор Свот', sprite: '📚', location: 'saffron_swot_lab',
    dialog: { greet: 'Я профессор Свот из Академии. Готов к исследованиям?', default: 'Академия ждёт твоих открытий.', quest_offer: 'Для диссертации нужен {target} {item}.', quest_complete: 'Превосходное исследование!', quest_incomplete: 'Данных недостаточно...' },
    quests: [],
  },
  'vermilion_mayor': {
    id: 'vermilion_mayor', name: 'Стивен Мейли', sprite: '👔', location: 'vermilionCity',
    dialog: { greet: 'Я Стивен Мейли, мэр Вермилиона. Нужна помощь!', default: 'Городские дела не ждут.', quest_offer: 'Передай {target} {item} — это срочно!', quest_complete: 'Работа сделана! Город благодарит тебя.', quest_incomplete: 'Документы ещё не доставлены...' },
    quests: [],
  },
  // === SELEN ISLAND QUEST NPCs ===
  'selen_mary': {
    id: 'selen_mary', name: 'Мери', sprite: '👧', location: 'ostaron',
    dialog: { greet: 'Мой Меррипик пропал! Помогите!', default: 'Меррипик — мой лучший друг.', quest_offer: 'Найди Меррипика! Понадобится {target} {item}.', quest_complete: 'Меррипик вернулся! Спасибо огромное!', quest_incomplete: 'Меррипик где-то на Селене...' },
    quests: [],
  },
  'selen_museum': {
    id: 'selen_museum', name: 'Куратор музея', sprite: '🏺', location: 'estaire_city',
    dialog: { greet: 'Музей Эстайр сити ограблен!', default: 'Экспонаты всё ещё не найдены.', quest_offer: 'Найди похитителей! Нужен {target} {item}.', quest_complete: 'Экспонаты возвращены! Ты герой!', quest_incomplete: 'Расследование продолжается...' },
    quests: [],
  },
  // === SOUTHERN ARCHIPELAGO QUEST NPCs ===
  'sa_pirate': {
    id: 'sa_pirate', name: 'Капитан пиратов', sprite: '🏴‍☠️', location: 'il_de_far',
    dialog: { greet: 'Свистать всех наверх! Хочешь в команду?', default: 'Море зовёт!', quest_offer: 'Принеси мне {target} {item} для корабля.', quest_complete: 'Йо-хо-хо! Ты принят в команду!', quest_incomplete: 'Корабль ждёт припасов...' },
    quests: [],
  },
  'sa_ice_cave': {
    id: 'sa_ice_cave', name: 'Исследователь пещер', sprite: '🥶', location: 'ice_cave_sa',
    dialog: { greet: 'Эта ледяная пещера... здесь скрыта тайна!', default: 'Холод не остановит науку!', quest_offer: 'Для экспедиции нужен {target} {item}.', quest_complete: 'Тайна раскрыта! Невероятно!', quest_incomplete: 'Пещера хранит свои секреты...' },
    quests: [],
  },
  'cerulean_settler': { id: 'cerulean_settler', name: 'Местный поселенец', sprite: '👤', location: 'ceruleanCity', dialog: { greet: 'Приветствую в Церулине! Наш город славится водой.', default: 'Церулин прекрасен в любое время года.' }, quests: [] },
  'cerulean_barman_al': { id: 'cerulean_barman_al', name: 'Бармен Аль', sprite: '🍺', location: 'cerulean_cafe_rain', dialog: { greet: 'Лучший бар в Церулине! Заходи.', default: 'Вечером у нас музыка.' }, quests: [] },
  'cerulean_jack': { id: 'cerulean_jack', name: 'Джек', sprite: '🧢', location: 'cerulean_cafe_rain', dialog: { greet: 'Я Джек, местный завсегдатай.', default: 'Всех тут знаю.' }, quests: [] },
  'cerulean_auctioneer': { id: 'cerulean_auctioneer', name: 'Аукционист', sprite: '🔨', location: 'cerulean_tavern', dialog: { greet: 'Аукцион начинается! Кто даст больше?', default: 'Редкие лоты ждут.' }, quests: [] },
  'cerulean_agent_james': { id: 'cerulean_agent_james', name: 'Агент Джеймс', sprite: '🕶️', location: 'cerulean_tavern', dialog: { greet: 'Агент Джеймс. Веду расследование.', default: 'Не видели ничего подозрительного?' }, quests: [] },
  'cerulean_agent_stace': { id: 'cerulean_agent_stace', name: 'Агент Стейс', sprite: '🕶️', location: 'cerulean_tavern', dialog: { greet: 'Агент Стейс, напарница Джеймса.', default: 'Мы работаем под прикрытием.' }, quests: [] },
  'cerulean_surfer': { id: 'cerulean_surfer', name: 'Сёрфингист', sprite: '🏄', location: 'ceruleanCity', dialog: { greet: 'Волны Церулина — лучшие в Канто!', default: 'Сёрфинг — это свобода.' }, quests: [] },

  'vermilion_judith': { id: 'vermilion_judith', name: 'Джудит', sprite: '👩', location: 'vermilion_fanclub', dialog: { greet: 'Моя кукла Люси пропала...', default: 'Спасибо что помогаете искать!' }, quests: [] },
  'vermilion_secretary': { id: 'vermilion_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'vermilionStadium', dialog: { greet: 'Я секретарь стадиона. Лидер ждёт.', default: 'Запись на битву открыта.' }, quests: [] },
  'vermilion_librarian': { id: 'vermilion_librarian', name: 'Библиотекарь', sprite: '📚', location: 'vermilion_library', dialog: { greet: 'Добро пожаловать в библиотеку!', default: 'У нас богатая коллекция книг о покемонах.' }, quests: [] },
  'vermilion_kiosk': { id: 'vermilion_kiosk', name: 'Работник киоска', sprite: '🎫', location: 'vermilion_library', dialog: { greet: 'Могу сделать копии документов.', default: 'Библиотека — источник знаний.' }, quests: [] },
  'vermilion_ron': { id: 'vermilion_ron', name: 'Рон', sprite: '👨', location: 'vermilion_library', dialog: { greet: 'Я Рон, захаживаю в библиотеку.', default: 'Книги — мой досуг.' }, quests: [] },
  'vermilion_seller1': { id: 'vermilion_seller1', name: 'Продавец', sprite: '🛒', location: 'vermilion_pokemarket', dialog: { greet: 'Покупайте товары!', default: 'Свежий завоз!' }, quests: [] },
  'vermilion_cashier': { id: 'vermilion_cashier', name: 'Кассир', sprite: '🎫', location: 'vermilion_port', dialog: { greet: 'Билеты на паром!', default: 'Отправление каждый час.' }, quests: [] },

  'lavender_miss_trevis': { id: 'lavender_miss_trevis', name: 'Мисс Тревис', sprite: '👩‍🏫', location: 'lavenderTown', dialog: { greet: 'Лавандия — город упокоения.', default: 'В окрестностях неспокойно... Дикие покемоны атакуют!', quest_offer: 'Офицер Джес из Западного Шаффрана просила помощи. Принеси {target} {item}.', quest_complete: 'Спасибо! Лавандия снова в безопасности!', quest_incomplete: 'Покемоны всё ещё атакуют...' }, quests: [] },
  'lavender_medium': { id: 'lavender_medium', name: 'Медиум', sprite: '🔮', location: 'lavenderTown', dialog: { greet: 'Лавандия — место упокоения покемонов.', default: 'Башня Призраков хранит множество тайн...' }, quests: [] },
  'lavender_guard': { id: 'lavender_guard', name: 'Охранник', sprite: '💂', location: 'lavender_radio_tower', dialog: { greet: 'Порядок под контролем.', default: 'Не шалите.' }, quests: [] },
  'lavender_seller': { id: 'lavender_seller', name: 'Продавец', sprite: '🛒', location: 'lavender_pokemarket', dialog: { greet: 'Товары для тренеров!', default: 'Заходите!' }, quests: [] },

  'celadon_arthur_wilford': { id: 'celadon_arthur_wilford', name: 'Артур Вилфорд', sprite: '🎩', location: 'celadonCity', dialog: { greet: 'Я Артур Вилфорд, старейшина Целадона.', default: 'Целадон — город изобилия.' }, quests: [] },
  'celadon_secretary': { id: 'celadon_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'celadonStadium', dialog: { greet: 'Стадион Эрики открыт.', default: 'Лидер ждёт.' }, quests: [] },
  'celadon_little_girl': { id: 'celadon_little_girl', name: 'Маленькая девочка', sprite: '👧', location: 'celadonCity', dialog: { greet: 'Я люблю гулять по Целадону!', default: 'У меня есть покемон-друг!' }, quests: [] },
  'celadon_meteorologist': { id: 'celadon_meteorologist', name: 'Ведущий метеоролог', sprite: '🌤️', location: 'celadonCity', dialog: { greet: 'Прогноз погоды — наша работа.', default: 'Погода влияет на покемонов.' }, quests: [] },
  'celadon_pharmacist': { id: 'celadon_pharmacist', name: 'Аптекарь', sprite: '💊', location: 'celadonCity', dialog: { greet: 'Аптека Целадона.', default: 'Здоровье команды — наш приоритет.' }, quests: [] },
  'celadon_tm_seller': { id: 'celadon_tm_seller', name: 'Продавец ТМ', sprite: '📀', location: 'celadonCity', dialog: { greet: 'Технические Машины!', default: 'Новинки каждую неделю!' }, quests: [] },
  'celadon_stone_seller': { id: 'celadon_stone_seller', name: 'Продавец камней', sprite: '💎', location: 'celadonCity', dialog: { greet: 'Камни эволюции!', default: 'Редкие камни со всего мира.' }, quests: [] },
  'celadon_barber': { id: 'celadon_barber', name: 'Парикмахер', sprite: '💇', location: 'celadonCity', dialog: { greet: 'Стильная стрижка для вас!', default: 'Новый образ — новые победы!' }, quests: [] },
  'celadon_tattoo': { id: 'celadon_tattoo', name: 'Татуировщик', sprite: '🎨', location: 'celadonCity', dialog: { greet: 'Лучшие тату в Канто!', default: 'Татуировка — это навсегда.' }, quests: [] },
  'celadon_electronics': { id: 'celadon_electronics', name: 'Продавец электроники', sprite: '📱', location: 'celadonCity', dialog: { greet: 'Техника для тренеров!', default: 'Новинки из Силф Ко!' }, quests: [] },
  'celadon_balls': { id: 'celadon_balls', name: 'Продавец покеболов', sprite: '⚽', location: 'celadonCity', dialog: { greet: 'Покеболы всех видов!', default: 'Ловите с комфортом!' }, quests: [] },
  'celadon_appliances': { id: 'celadon_appliances', name: 'Продавец техники', sprite: '🔌', location: 'celadonCity', dialog: { greet: 'Бытовая техника для дома.', default: 'Качество гарантирую.' }, quests: [] },
  'celadon_craftsman': { id: 'celadon_craftsman', name: 'Продавец-ремесленник', sprite: '🔧', location: 'celadonCity', dialog: { greet: 'Ручная работа!', default: 'Каждая вещь с душой.' }, quests: [] },

  'saffron_tailor': { id: 'saffron_tailor', name: 'Портниха', sprite: '🧵', location: 'saffron_needle_house', dialog: { greet: 'Шью лучшие костюмы!', default: 'Стиль важен даже в битве.' }, quests: [] },
  'saffron_secretary': { id: 'saffron_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'saffronPsychicStadium', dialog: { greet: 'Стадион Сабрины — для сильных духом.', default: 'Психические покемоны чувствуют ауру.' }, quests: [] },
  'saffron_cashier': { id: 'saffron_cashier', name: 'Кассир', sprite: '💲', location: 'saffron_east_station', dialog: { greet: 'Билеты на поезд!', default: 'Счастливого пути!' }, quests: [] },
  'saffron_lottery': { id: 'saffron_lottery', name: 'Лотерейщик', sprite: '🎰', location: 'saffron_east_station', dialog: { greet: 'Лотерея Лиги-17!', default: 'Главный приз — редкий покемон!' }, quests: [] },

  'fuchsia_olan': { id: 'fuchsia_olan', name: 'Олан', sprite: '🧙', location: 'fuchsia_beach', dialog: { greet: 'Я Олан, хранитель традиций Фуксии.', default: 'Фуксия — город ниндзя.' }, quests: [] },
  'fuchsia_branzer_richard': { id: 'fuchsia_branzer_richard', name: 'Бранзер Ричард', sprite: '🔥', location: 'fuchsia_beach', dialog: { greet: 'Бранзеры — лучшие покемоны!', default: 'Мои Бранзеры — моя гордость.' }, quests: [] },
  'fuchsia_cashier': { id: 'fuchsia_cashier', name: 'Кассир', sprite: '🎫', location: 'fuchsia_beach_pier', dialog: { greet: 'Билеты на парусник до Архипелага!', default: 'Отправление каждый день.' }, quests: [] },

  'goldenrod_prof_nils': { id: 'goldenrod_prof_nils', name: 'Профессор Нилс', sprite: '🔬', location: 'goldenrod_academy', dialog: { greet: 'Я профессор Нилс из Академии.', default: 'Эволюция — удивительный процесс!' }, quests: [] },
  'goldenrod_prof_karmen': { id: 'goldenrod_prof_karmen', name: 'Профессор Кармен', sprite: '🔬', location: 'goldenrod_academy', dialog: { greet: 'Профессор Кармен.', default: 'Каждая атака имеет свою историю.' }, quests: [] },
  'goldenrod_trainer_ted': { id: 'goldenrod_trainer_ted', name: 'Тренер Тэд', sprite: '🎓', location: 'goldenrod_academy', dialog: { greet: 'Я Тренер Тэд, выпускник Академии.', default: 'Академия дала мне всё.' }, quests: [] },
  'goldenrod_barman': { id: 'goldenrod_barman', name: 'Бармен', sprite: '🍺', location: 'goldenrod_bar', dialog: { greet: 'Лучший бар в Голденроде!', default: 'После трудного дня — только сюда.' }, quests: [] },
  'goldenrod_secretary': { id: 'goldenrod_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'goldenrodStadium', dialog: { greet: 'Стадион Уитни открыт.', default: 'Нормальные покемоны сильнее чем кажутся!' }, quests: [] },
  'goldenrod_kiosk': { id: 'goldenrod_kiosk', name: 'Работник киоска', sprite: '🎫', location: 'goldenrod_supermarket', dialog: { greet: 'Информация о городе!', default: 'Всё что нужно тренеру.' }, quests: [] },
  'goldenrod_clan_commander': { id: 'goldenrod_clan_commander', name: 'Командир штаба', sprite: '🛡️', location: 'goldenrod_cityhall', dialog: { greet: 'Кланы — сила Лиги.', default: 'Вступите в клан!' }, quests: [] },
  'goldenrod_clan_master': { id: 'goldenrod_clan_master', name: 'Клан-мастер', sprite: '👑', location: 'goldenrod_cityhall', dialog: { greet: 'Я Клан-мастер.', default: 'Клан — это семья.' }, quests: [] },
  'goldenrod_clan_secretary': { id: 'goldenrod_clan_secretary', name: 'Клан-секретарь', sprite: '📝', location: 'goldenrod_cityhall', dialog: { greet: 'Веду учёт кланов.', default: 'Бюрократия — двигатель порядка.' }, quests: [] },
  'goldenrod_editor': { id: 'goldenrod_editor', name: 'Главный редактор', sprite: '📰', location: 'new_district', dialog: { greet: 'Главный редактор газеты.', default: 'Свежий выпуск уже в печати!' }, quests: [] },

  'old_district_sergeant': { id: 'old_district_sergeant', name: 'Сержант', sprite: '👮', location: 'old_district', dialog: { greet: 'Сержант полиции.', default: 'Не нарушайте закон.' }, quests: [] },
  'old_district_veteran': { id: 'old_district_veteran', name: 'Ветеран', sprite: '🎖️', location: 'old_district', dialog: { greet: 'Я ветеран. Много битв за плечами.', default: 'Хочешь совет от старого бойца?' }, quests: [] },
  'old_district_stuart': { id: 'old_district_stuart', name: 'Стюарт', sprite: '👨', location: 'old_district', dialog: { greet: 'Стюарт, житель Старого района.', default: 'Тут тихо и спокойно.' }, quests: [] },
  'old_district_master_rob': { id: 'old_district_master_rob', name: 'Мастер Роб', sprite: '🔧', location: 'old_district', dialog: { greet: 'Мастер Роб. Чиню всё.', default: 'Приноси — починю.' }, quests: [] },

  'new_district_lieutenant': { id: 'new_district_lieutenant', name: 'Лейтенант', sprite: '👮', location: 'new_district', dialog: { greet: 'Лейтенант полиции.', default: 'Новый район под защитой.' }, quests: [] },
  'new_district_elen': { id: 'new_district_elen', name: 'Элен', sprite: '🦸', location: 'new_district', dialog: { greet: 'Я Элен из Великолепной Пятёрки.', default: 'Сторн собрал нас ради великой цели!' }, quests: [] },
  'new_district_guard': { id: 'new_district_guard', name: 'Охранник', sprite: '💂', location: 'new_district', dialog: { greet: 'Охраняю Новый район.', default: 'Без пропуска не пройти.' }, quests: [] },
  'new_district_mrs_booker': { id: 'new_district_mrs_booker', name: 'Миссис Букер', sprite: '👩', location: 'new_district', dialog: { greet: 'Миссис Букер.', default: 'Заходите на чай!' }, quests: [] },
  'new_district_mr_booker': { id: 'new_district_mr_booker', name: 'Мистер Букер', sprite: '👨', location: 'new_district', dialog: { greet: 'Мистер Букер к вашим услугам.', default: 'Новый район — лучшее место.' }, quests: [] },
  'new_district_richard': { id: 'new_district_richard', name: 'Ричард', sprite: '👨', location: 'new_district', dialog: { greet: 'Я Ричард. Работаю на радио.', default: 'Радиобашня вещает на всё Джото!' }, quests: [] },
  'new_district_kristen': { id: 'new_district_kristen', name: 'Кристен', sprite: '🏃', location: 'new_district', dialog: { greet: 'Я Кристен. Ветер зовёт вперёд!', default: 'Бег — это жизнь!' }, quests: [] },
  'new_district_train': { id: 'new_district_train', name: 'Поезд', sprite: '🚂', location: 'new_district', dialog: { greet: 'Поезд до Шаффрана.', default: 'Занимайте места!' }, quests: [] },

  'olivine_glen': { id: 'olivine_glen', name: 'Глен', sprite: '👨', location: 'olivineCity', dialog: { greet: 'Я Глен, портовый рабочий.', default: 'Оливинский порт — лучший в Джото.' }, quests: [] },
  'olivine_evan': { id: 'olivine_evan', name: 'Эван', sprite: '👨', location: 'olivine_beach', dialog: { greet: 'Эван. Рыбачу 20 лет.', default: 'Рыбалка учит терпению.' }, quests: [] },
  'olivine_arina': { id: 'olivine_arina', name: 'Арина', sprite: '👩', location: 'olivineCity', dialog: { greet: 'Арина. Люблю наблюдать за кораблями.', default: 'Море бесконечно.' }, quests: [] },
  'olivine_barman_elvin': { id: 'olivine_barman_elvin', name: 'Бармен Элвин', sprite: '🍺', location: 'olivine_bar_pirate', dialog: { greet: 'Пиратское убежище открыто!', default: 'Лучший ром на побережье!' }, quests: [] },
  'olivine_lighthouse_keeper': { id: 'olivine_lighthouse_keeper', name: 'Смотритель маяка', sprite: '🔦', location: 'olivine_beach_lighthouse', dialog: { greet: 'Я смотритель маяка.', default: 'Браконьеры? Да, видел их...' }, quests: [] },
  'olivine_marta': { id: 'olivine_marta', name: 'Марта', sprite: '👩', location: 'olivineCity', dialog: { greet: 'Я Марта. У меня старая фотография.', default: 'На этой фотографии — моя молодость.' }, quests: [] },
  'olivine_janet': { id: 'olivine_janet', name: 'Жанет', sprite: '👩', location: 'olivine_house_221', dialog: { greet: 'Жанет. Ищу рецепт зелья памяти.', default: 'Говорят оно помогает вспомнить прошлое.' }, quests: [] },

  'flourence_pretty_girl': { id: 'flourence_pretty_girl', name: 'Симпатичная девушка', sprite: '👩', location: 'flourence', dialog: { greet: 'Флауренция — город цветов!', default: 'Люблю этот город.' }, quests: [] },
  'flourence_trainer_jim': { id: 'flourence_trainer_jim', name: 'Тренер Джим', sprite: '🎒', location: 'flourence', dialog: { greet: 'Тренер Джим. Флауренция — мой дом.', default: 'Цветы и покемоны — идеально!' }, quests: [] },
  'flourence_florist_helper': { id: 'flourence_florist_helper', name: 'Помощник флориста', sprite: '🌸', location: 'flourence_greenhouse', dialog: { greet: 'Помогаю в оранжерее.', default: 'Приходите любоваться цветами!' }, quests: [] },
  'flourence_bulletin': { id: 'flourence_bulletin', name: 'Доска объявлений', sprite: '📌', location: 'flourence', dialog: { greet: 'Миссия: Флауренция!', default: 'Новые задания каждую неделю.' }, quests: [] },

  'alston_granny': { id: 'alston_granny', name: 'Старушка', sprite: '👵', location: 'alston_granny_house', dialog: { greet: 'Я старушка из Олстона.', default: 'Каждый камень рассказывает историю.' }, quests: [] },
  'alston_little_man': { id: 'alston_little_man', name: 'Маленький человек', sprite: '🎪', location: 'alston_circus', dialog: { greet: 'Цирк покемонов! Лучшее шоу!', default: 'Приходите всей семьёй!' }, quests: [] },
  'alston_secretary1': { id: 'alston_secretary1', name: 'Секретарь Стального Стадиона', sprite: '📋', location: 'alston_steel_stadium', dialog: { greet: 'Стальной Стадион.', default: 'Лидер ждёт.' }, quests: [] },
  'alston_secretary2': { id: 'alston_secretary2', name: 'Секретарь Стадиона Души', sprite: '📋', location: 'alston_soul_stadium', dialog: { greet: 'Стадион Души.', default: 'Готовы к испытанию духа?' }, quests: [] },

  'summer_barman_miguel': { id: 'summer_barman_miguel', name: 'Бармен Мигель', sprite: '🍺', location: 'summer_pub', dialog: { greet: 'Паб Хаус — сердце Саммера!', default: 'Холодное пиво после жаркого дня!' }, quests: [] },
  'summer_librarian': { id: 'summer_librarian', name: 'Библиотекарь', sprite: '📚', location: 'summer_library', dialog: { greet: 'Библиотека Саммера.', default: 'У нас редкие книги о покемонах.' }, quests: [] },
  'summer_officer_jackie': { id: 'summer_officer_jackie', name: 'Офицер Джекки', sprite: '👮', location: 'summer_police', dialog: { greet: 'Офицер Джекки.', default: 'Порядок в городе — наша работа.' }, quests: [] },
  'summer_prof_niro': { id: 'summer_prof_niro', name: 'Профессор Ниро', sprite: '🔬', location: 'summer_institute', dialog: { greet: 'Профессор Ниро.', default: 'Исследуем покемонов саванны!' }, quests: [] },
  'summer_mary_research': { id: 'summer_mary_research', name: 'Мари', sprite: '👩', location: 'summer_institute', dialog: { greet: 'Я Мари, исследую вулканы.', default: 'Вулкан Синнабунг полон тайн.' }, quests: [] },
  'summer_kylie': { id: 'summer_kylie', name: 'Кайли', sprite: '👧', location: 'summer', dialog: { greet: 'Моя Мурысь сбежала!', default: 'Мурысь, где ты?' }, quests: [] },
  'summer_mila': { id: 'summer_mila', name: 'Мила', sprite: '👩', location: 'summer_pokepark', dialog: { greet: 'Я Мила.', default: 'Пантиры — удивительные покемоны.' }, quests: [] },
  'summer_owner': { id: 'summer_owner', name: 'Владелец', sprite: '🏢', location: 'summer_pokepark', dialog: { greet: 'Владелец Поке-парка.', default: 'Новые аттракционы скоро!' }, quests: [] },
  'summer_fisk': { id: 'summer_fisk', name: 'Фиск', sprite: '💎', location: 'summer', dialog: { greet: 'Фиск. Скупаю ониксы.', default: 'Ониксы — камень удачи.' }, quests: [] },

  'warhall_bill_char': { id: 'warhall_bill_char', name: 'Билл', sprite: '🔬', location: 'warhall_bill_shop', dialog: { greet: 'Я Билл, изобретатель.', default: 'Техника и покемоны — моя страсть.' }, quests: [] },
  'warhall_auctioneer': { id: 'warhall_auctioneer', name: 'Аукционист', sprite: '🔨', location: 'warhall', dialog: { greet: 'Аукцион Вархолла!', default: 'Кто даст больше?' }, quests: [] },
  'warhall_master_osaguro': { id: 'warhall_master_osaguro', name: 'Мастер Осагуро', sprite: '⚔️', location: 'warhall_samurai_house', dialog: { greet: 'Я Мастер Осагуро.', default: 'Тренируйся усердно.' }, quests: [] },
  'warhall_kensei': { id: 'warhall_kensei', name: 'Кэнсэй', sprite: '🥋', location: 'warhall_samurai_gym', dialog: { greet: 'Кэнсэй, ученик мастера.', default: 'Тренировка не заканчивается.' }, quests: [] },
  'warhall_kevin': { id: 'warhall_kevin', name: 'Кевин', sprite: '👨', location: 'warhall', dialog: { greet: 'Я Кевин, житель Вархолла.', default: 'Наш город славится историей.' }, quests: [] },
  'warhall_museum_director': { id: 'warhall_museum_director', name: 'Директор музея', sprite: '🏛️', location: 'warhall_museum', dialog: { greet: 'Директор музея.', default: 'Новая экспозиция уже открыта!' }, quests: [] },

  'melen_charlie': { id: 'melen_charlie', name: 'Чарли', sprite: '👨', location: 'melen', dialog: { greet: 'Чарли из Мелена.', default: 'Тишина и покой — вот что ценно.' }, quests: [] },
  'melen_mrs_craig': { id: 'melen_mrs_craig', name: 'Миссис Крейг', sprite: '👩', location: 'melen_craig_shop', dialog: { greet: 'Миссис Крейг.', default: 'Заходите за покупками!' }, quests: [] },
  'melen_old_fisherman': { id: 'melen_old_fisherman', name: 'Старый рыбак', sprite: '🎣', location: 'melen_pier', dialog: { greet: 'Рыбачу 40 лет.', default: 'Море — мой второй дом.' }, quests: [] },
  'melen_silvestr': { id: 'melen_silvestr', name: 'Сильвестр', sprite: '👨', location: 'melen', dialog: { greet: 'Сильвестр.', default: 'Древние тайны ждут.' }, quests: [] },
  'melen_mask_master': { id: 'melen_mask_master', name: 'Мастер масок', sprite: '🎭', location: 'melen_mask_workshop', dialog: { greet: 'Мастер масок.', default: 'Для карнавала или битвы?' }, quests: [] },
  'melen_fiona': { id: 'melen_fiona', name: 'Фиона', sprite: '👩', location: 'melen_fiona_house', dialog: { greet: 'Я Фиона.', default: 'Заходите отдохнуть.' }, quests: [] },
  'melen_albert': { id: 'melen_albert', name: 'Альберт', sprite: '👨', location: 'melen_albert_house', dialog: { greet: 'Альберт.', default: 'За пределами закона — там истина.' }, quests: [] },
  'melen_kristian': { id: 'melen_kristian', name: 'Кристиан', sprite: '👨', location: 'melen_pier', dialog: { greet: 'Кристиан.', default: 'Мечты сбываются у моря.' }, quests: [] },
  'melen_fisk': { id: 'melen_fisk', name: 'Фиск', sprite: '💎', location: 'melen', dialog: { greet: 'Фиск в Мелене.', default: 'Приносите ониксы — плачу хорошо.' }, quests: [] },

  'ostaron_ralf': { id: 'ostaron_ralf', name: 'Ральф', sprite: '👨', location: 'ostaron', dialog: { greet: 'Ральф, житель Остарона.', default: 'Столица Селена прекрасна!' }, quests: [] },
  'ostaron_secretary': { id: 'ostaron_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'ostaron_ice_stadium', dialog: { greet: 'Стадион Чака ждёт.', default: 'Лидер Остарона непобедим!' }, quests: [] },

  'estaire_officer_jes': { id: 'estaire_officer_jes', name: 'Офицер Джес', sprite: '👮', location: 'estaire_city', dialog: { greet: 'Офицер Джес.', default: 'Соблюдайте закон!' }, quests: [] },
  'estaire_bill': { id: 'estaire_bill', name: 'Билл', sprite: '🔬', location: 'estaire_city', dialog: { greet: 'Билл в Эстайре.', default: 'Техника для всех регионов!' }, quests: [] },
  'estaire_mayor': { id: 'estaire_mayor', name: 'Мэр Эстайра', sprite: '🏛️', location: 'estaire_city', dialog: { greet: 'Мэр Эстайра.', default: 'Эстайр растёт и развивается.' }, quests: [] },
  'estaire_happy': { id: 'estaire_happy', name: 'Хэппи', sprite: '😊', location: 'estaire_city', dialog: { greet: 'Счастье есть!', default: 'Улыбайтесь чаще!' }, quests: [] },
  'estaire_toby': { id: 'estaire_toby', name: 'Тоби', sprite: '👨', location: 'estaire_city', dialog: { greet: 'Тоби из Эстайра.', default: 'Море рядом — что ещё нужно?' }, quests: [] },
  'estaire_den': { id: 'estaire_den', name: 'Ден', sprite: '👨', location: 'estaire_city', dialog: { greet: 'Ден. Работаю в порту.', default: 'Корабли приходят и уходят.' }, quests: [] },
  'estaire_auctioneer': { id: 'estaire_auctioneer', name: 'Аукционист', sprite: '🔨', location: 'estaire_city', dialog: { greet: 'Аукцион Эстайра!', default: 'Кто предложит больше?' }, quests: [] },
  'estaire_appliances': { id: 'estaire_appliances', name: 'Продавец техники', sprite: '🔌', location: 'estaire_private_shop', dialog: { greet: 'Техника для острова.', default: 'Лучшие товары здесь!' }, quests: [] },
  'estaire_cashier': { id: 'estaire_cashier', name: 'Кассир', sprite: '💲', location: 'estaire_south_pier', dialog: { greet: 'Билеты на паром.', default: 'Счастливого плавания!' }, quests: [] },

  'sayref_keeper': { id: 'sayref_keeper', name: 'Смотритель покемонов', sprite: '🧹', location: 'sayref', dialog: { greet: 'Смотритель покемонов Сайрефа.', default: 'Покемоны — наши друзья.' }, quests: [] },
  'sayref_ray': { id: 'sayref_ray', name: 'Рей', sprite: '👨', location: 'sayref', dialog: { greet: 'Рей из Сайрефа.', default: 'Снеговик — символ города.' }, quests: [] },
  'sayref_fred_svarovski': { id: 'sayref_fred_svarovski', name: 'Фред Сваровски', sprite: '💎', location: 'sayref', dialog: { greet: 'Фред Сваровски.', default: 'Рипогиты — агрессивные покемоны.' }, quests: [] },
  'sayref_peiri': { id: 'sayref_peiri', name: 'Пэйри', sprite: '👩', location: 'sayref', dialog: { greet: 'Пэйри.', default: 'Ледяные скульптуры — искусство.' }, quests: [] },
  'sayref_ice_statue': { id: 'sayref_ice_statue', name: 'Снеговик', sprite: '⛄', location: 'sayref', dialog: { greet: 'Я — символ Сайрефа!', default: 'Приходите фотографироваться!' }, quests: [] },
  'sayref_secretary': { id: 'sayref_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'sayref_air_stadium', dialog: { greet: 'Воздушный Стадион.', default: 'Летающие покемоны не знают границ!' }, quests: [] },

  'sel_route8_nursery': { id: 'sel_route8_nursery', name: 'Работник питомника', sprite: '🥚', location: 'estaire_daycare_center', dialog: { greet: 'Оставляйте покемонов.', default: 'Покемоны растут пока вы путешествуете.' }, quests: [] },
  'sel_route8_prof_sten': { id: 'sel_route8_prof_sten', name: 'Профессор Стэн', sprite: '🔬', location: 'estaire_daycare_center', dialog: { greet: 'Профессор Стэн. Я изучаю легендарных покемонов.', default: 'Перо легендарного покемона — вот что мне нужно!', quest_offer: 'Найди доказательство существования легендарного покемона: принеси {target} {item}.', quest_complete: 'Это оно! Легенда реальна! Спасибо, исследователь!', quest_incomplete: 'Поиски продолжаются. Легендарный покемон где-то там...' }, quests: [] },
  'sel_route8_mad_scientist': { id: 'sel_route8_mad_scientist', name: 'Сумасшедший ученый', sprite: '🤪', location: 'estaire_daycare_center', dialog: { greet: 'Мои теории верны!', default: 'Наука не знает границ!' }, quests: [] },

  'goldenrod_academy_worker': { id: 'goldenrod_academy_worker', name: 'Работник филиала', sprite: '👨‍💼', location: 'goldenrod_academy_branch', dialog: { greet: 'Работник филиала Академии.', default: 'Исследования идут полным ходом.' }, quests: [] },
  'goldenrod_academy_miss_melani': { id: 'goldenrod_academy_miss_melani', name: 'Мисс Мелани', sprite: '👩‍🏫', location: 'goldenrod_academy_branch', dialog: { greet: 'Мисс Мелани.', default: 'Обучение — ключ к успеху.' }, quests: [] },
  'goldenrod_academy_doran': { id: 'goldenrod_academy_doran', name: 'Профессор Доран', sprite: '👨‍🔬', location: 'goldenrod_academy_branch', dialog: { greet: 'Профессор Доран, исследователь эволюции.', default: 'Академия Голденрода — лучшее место для начинающих тренеров. Советую обратиться к инструкторам Сорену, Джеку или Олину — у них есть полезные задания.' }, quests: [] },

  'ilde_guillaume': { id: 'ilde_guillaume', name: 'Гильом', sprite: '👨', location: 'il_de_far', dialog: { greet: 'Гильом.', default: 'Наш остров — лучший!' }, quests: [] },
  'ilde_ferryman': { id: 'ilde_ferryman', name: 'Паромщик Травэр', sprite: '⛴️', location: 'il_de_far', dialog: { greet: 'Паромщик Травэр.', default: 'Паром ходит по расписанию.' }, quests: [] },
  'ilde_cashier1': { id: 'ilde_cashier1', name: 'Кассир', sprite: '💲', location: 'il_de_far', dialog: { greet: 'Билеты на паром!', default: 'Места ограничены.' }, quests: [] },
  'ilde_cashier2': { id: 'ilde_cashier2', name: 'Кассир', sprite: '💲', location: 'il_de_far', dialog: { greet: 'Касса порта открыта.', default: 'Приятного путешествия!' }, quests: [] },
  'ilde_sailboat': { id: 'ilde_sailboat', name: 'Парусник', sprite: '⛵', location: 'il_de_far', dialog: { greet: 'Парусник до Канто!', default: 'Ветер попутный!' }, quests: [] },

  'sen_aspir_prof_quince': { id: 'sen_aspir_prof_quince', name: 'Профессор Квинс', sprite: '🔬', location: 'sen_aspir', dialog: { greet: 'Профессор Квинс.', default: 'Здесь уникальная экосистема.' }, quests: [] },
  'sen_aspir_passenger': { id: 'sen_aspir_passenger', name: 'Прохожий', sprite: '🚶', location: 'sen_aspir', dialog: { greet: 'Сен Аспир прекрасен.', default: 'Взгляд в прошлое — здесь история.' }, quests: [] },
  'sen_aspir_madame_odeur': { id: 'sen_aspir_madame_odeur', name: 'Мадам де Одер', sprite: '👩‍🦰', location: 'sen_aspir', dialog: { greet: 'Мадам де Одер.', default: 'Ароматы Архипелага уникальны.' }, quests: [] },
  'sen_aspir_madame_chaber': { id: 'sen_aspir_madame_chaber', name: 'Мадам Шабэр', sprite: '👩', location: 'sen_aspir', dialog: { greet: 'Мадам Шабэр.', default: 'У вас есть что-то интересное?' }, quests: [] },
  'sen_aspir_madame_lacerte': { id: 'sen_aspir_madame_lacerte', name: 'Мадам Ласерте', sprite: '👩', location: 'sen_aspir', dialog: { greet: 'Мадам Ласерте.', default: 'Красота спасёт мир.' }, quests: [] },
  'sen_aspir_museum_worker': { id: 'sen_aspir_museum_worker', name: 'Работник музея', sprite: '🏺', location: 'sen_aspir', dialog: { greet: 'Работник музея.', default: 'Новый экспонат — древний покебол!' }, quests: [] },
  'sen_aspir_paleontologist': { id: 'sen_aspir_paleontologist', name: 'Палеонтолог', sprite: '🦴', location: 'sen_aspir', dialog: { greet: 'Палеонтолог.', default: 'Окаменелости рассказывают историю.' }, quests: [] },
  'sen_aspir_monsieur_korel': { id: 'sen_aspir_monsieur_korel', name: 'Месье Корэль', sprite: '🎩', location: 'sen_aspir', dialog: { greet: 'Месье Корэль.', default: 'Сен Аспир — город аристократов.' }, quests: [] },
  'sen_aspir_ferryman': { id: 'sen_aspir_ferryman', name: 'Паромщик Травэр', sprite: '⛴️', location: 'sen_aspir', dialog: { greet: 'Паромщик Травэр.', default: 'Переправа на Иль де Фар.' }, quests: [] },
  'sen_aspir_officer_jes': { id: 'sen_aspir_officer_jes', name: 'Офицер Джес', sprite: '👮', location: 'sen_aspir', dialog: { greet: 'Офицер Джес.', default: 'Порядок и на Архипелаге.' }, quests: [] },
  'sen_aspir_appliances': { id: 'sen_aspir_appliances', name: 'Продавец техники', sprite: '🔌', location: 'sen_aspir', dialog: { greet: 'Техника для Архипелага.', default: 'Доставка на любой остров.' }, quests: [] },
  'sen_aspir_cashier': { id: 'sen_aspir_cashier', name: 'Кассир', sprite: '💲', location: 'sen_aspir', dialog: { greet: 'Касса Сен Аспира.', default: 'Приятных покупок!' }, quests: [] },
  'sen_aspir_lottery': { id: 'sen_aspir_lottery', name: 'Лотерейщик', sprite: '🎰', location: 'sen_aspir', dialog: { greet: 'Лотерея Архипелага!', default: 'Удача любит смелых.' }, quests: [] },

  'ice_cave_aloha': { id: 'ice_cave_aloha', name: 'Алооха', sprite: '🥶', location: 'ice_cave_sa', dialog: { greet: 'Ледяная пещера полна тайн.', default: 'Холодно? Привыкай!' }, quests: [] },

  'air_stadium_forest_lenor': { id: 'air_stadium_forest_lenor', name: 'Ленор', sprite: '👧', location: 'air_stadium_forest', dialog: { greet: 'Я Ленор. Тренируюсь в лесу.', default: 'Хочешь битву?' }, quests: [] },
  'air_stadium_forest_elder': { id: 'air_stadium_forest_elder', name: 'Старый лидер', sprite: '🧓', location: 'air_stadium_forest', dialog: { greet: 'Я бывший лидер стадиона.', default: 'Время летит...' }, quests: [] },
  'air_stadium_forest_guard': { id: 'air_stadium_forest_guard', name: 'Дежурный рейнджер', sprite: '🌲', location: 'air_stadium_forest', dialog: { greet: 'Лес патрулируется.', default: 'Рейнджеры всегда на страже.' }, quests: [] },
  'air_stadium_forest_alice': { id: 'air_stadium_forest_alice', name: 'Алиса', sprite: '👧', location: 'air_stadium_forest', dialog: { greet: 'Алиса. Лепим с ребятами из грязи!', default: 'Принеси мне Чёрной грязи из Низинных болот!' }, quests: [] },
  'air_stadium_forest_farmer': { id: 'air_stadium_forest_farmer', name: 'Фермер', sprite: '👨‍🌾', location: 'air_stadium_forest', dialog: { greet: 'Моя пасека рядом с лесом.', default: 'Покемоны любят мой мёд!' }, quests: [] },

  'empty_city_shannon': { id: 'empty_city_shannon', name: 'Лидер Шэннон', sprite: '⚫', location: 'empty_city', dialog: { greet: 'Я Лидер Шэннон.', default: 'Тьма — это тоже сила.' }, quests: [] },
  'empty_city_silvestr': { id: 'empty_city_silvestr', name: 'Небритый Сильвестр', sprite: '🧔', location: 'empty_city', dialog: { greet: 'Тайна Потерянного города...', default: 'Город хранит секреты.' }, quests: [] },

  'volcanic_plateau_leonard': { id: 'volcanic_plateau_leonard', name: 'Леонард', sprite: '🧪', location: 'volcanic_plateau', dialog: { greet: 'Леонард.', default: 'Ингредиенты? Только вулканические.' }, quests: [] },
  'volcanic_plateau_paulo': { id: 'volcanic_plateau_paulo', name: 'Пауло', sprite: '👨', location: 'volcanic_plateau', dialog: { greet: 'Пауло. Живу у вулкана.', default: 'Вулкан даёт силу.' }, quests: [] },

  'rocks_wj_alvares': { id: 'rocks_wj_alvares', name: 'Альварес', sprite: '⛏️', location: 'rocks_wj', dialog: { greet: 'Альварес.', default: 'Стадион снова будет греметь!' }, quests: [] },
  'rocks_wj_hugo': { id: 'rocks_wj_hugo', name: 'Хьюго', sprite: '👨', location: 'rocks_wj', dialog: { greet: 'Хьюго.', default: 'Тишина скал успокаивает.' }, quests: [] },
  'rocks_wj_old_man': { id: 'rocks_wj_old_man', name: 'Дряхлый Старик', sprite: '🧓', location: 'rocks_wj', dialog: { greet: 'Я видел рождение этих скал...', default: 'Время не щадит никого.' }, quests: [] },
  'rocks_wj_pirate_char': { id: 'rocks_wj_pirate_char', name: 'Пират', sprite: '🏴‍☠️', location: 'rocks_wj', dialog: { greet: 'Пират на скалах!', default: 'Йо-хо-хо!' }, quests: [] },
  'rocks_wj_tourist': { id: 'rocks_wj_tourist', name: 'Турист', sprite: '📸', location: 'rocks_wj', dialog: { greet: 'Турист.', default: 'Говорят, это легендарное место.' }, quests: [] },

  'deserted_road_blind': { id: 'deserted_road_blind', name: 'Незрячая', sprite: '🧑‍🦯', location: 'deserted_road_ej', dialog: { greet: 'Я не вижу, но чувствую мир.', default: 'Покемоны — мои глаза.' }, quests: [] },
  'deserted_road_bruce': { id: 'deserted_road_bruce', name: 'Брюс', sprite: '👨', location: 'deserted_road_ej', dialog: { greet: 'Брюс.', default: 'Одиночество — мой спутник.' }, quests: [] },

  'mountain_pass_scared_woman': { id: 'mountain_pass_scared_woman', name: 'Испуганная женщина', sprite: '😰', location: 'mountain_pass', dialog: { greet: 'Помогите! Здесь опасно!', default: 'Спасибо что помогли!' }, quests: [] },
  'mountain_pass_kris': { id: 'mountain_pass_kris', name: 'Крис', sprite: '👨', location: 'mountain_pass', dialog: { greet: 'Крис.', default: 'Готов к подъёму?' }, quests: [] },

  'mountain_village_archie': { id: 'mountain_village_archie', name: 'Арчи', sprite: '👨', location: 'mountain_village', dialog: { greet: 'Арчи из горной деревушки.', default: 'Горы хранят древние тайны.' }, quests: [] },
  'mountain_village_secretary': { id: 'mountain_village_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'ilde_stadium', dialog: { greet: 'Стадион драконьих покемонов.', default: 'Лидер ждёт смелых.' }, quests: [] },

  'wj_route3_kristi': { id: 'wj_route3_kristi', name: 'Жуколов Кристи', sprite: '🐛', location: 'wj_route_3', dialog: { greet: 'Жуколов Кристи.', default: 'Свадебный переполох? Я помогу!' }, quests: [] },
  'selen_adventurer': { id: 'selen_adventurer', name: 'Искатель приключений', sprite: '🧭', location: 'selen_forest', dialog: { greet: 'В этом лесу я нашёл следы легендарного покемона!', default: 'Логово дракона — моя цель. Но нужна помощь.', quest_offer: 'Помоги найти Око Мироздания: принеси {target} {item}.', quest_complete: 'Око Мироздания найдено! Легенда оживает!', quest_incomplete: 'Поиски продолжаются... Око где-то в мире.' }, quests: [] },
  'wj_richie': { id: 'wj_richie', name: 'Богатенький Ричи', sprite: '💰', location: 'summer', dialog: { greet: 'Ха! И в Западном Джото полно бедняков!', default: 'Деньги решают всё.', quest_offer: 'Мне нужна редкая вещь: {target} {item}. Заплачу щедро!', quest_complete: 'Великолепно! Вот твоя награда, бедняк.', quest_incomplete: 'Где мой заказ?!' }, quests: [] },
  'sa_richie': { id: 'sa_richie', name: 'Богатенький Ричи', sprite: '💰', location: 'il_de_far', dialog: { greet: 'Ха! И на Архипелаге есть бедняки!', default: 'Деньги решают всё.', quest_offer: 'Мне нужна редкая вещь: {target} {item}. Заплачу щедро!', quest_complete: 'Великолепно! Вот твоя награда, бедняк.', quest_incomplete: 'Где мой заказ?!' }, quests: [] },

  'cross_alfred': { id: 'cross_alfred', name: 'Альфред', sprite: '💌', location: 'rocks_wj', dialog: { greet: 'Каждый день я смотрю на багровый закат...', default: 'Любовь не знает границ. Передай письмо моей возлюбленной в другом регионе.', quest_offer: 'Найди прекрасную незнакомку и передай ей {target} {item}.', quest_complete: 'Письмо доставлено! Спасибо, тренер!', quest_incomplete: 'Письмо ещё не доставлено...' }, quests: [] },
  'cross_clown_freddy': { id: 'cross_clown_freddy', name: 'Клоун Фредди', sprite: '🤡', location: 'celadonCity', dialog: { greet: 'Цирк уехал, а клоуны остались!', default: 'Грустить нельзя!', quest_offer: 'Цирк переезжает! Посети {target} города, чтобы найти нас!', quest_complete: 'Ты нашёл цирк! Фредди счастлив!', quest_incomplete: 'Осталось ещё {target} городов...' }, quests: [] },
  'cross_lenart': { id: 'cross_lenart', name: 'Человек в тёмной накидке', sprite: '🥷', location: 'empty_city', dialog: { greet: 'Залечь на дно — мой план.', default: 'Не привлекайте внимания.' }, quests: [] },
  'cross_dr_fins': { id: 'cross_dr_fins', name: 'Доктор Финс', sprite: '🧬', location: 'goldenrod_institute', dialog: { greet: 'Доктор Финс.', default: 'Генетика изменит мир покемонов.' }, quests: [] },
  'cross_journalist_erika': { id: 'cross_journalist_erika', name: 'Журналист Эрика', sprite: '🎤', location: 'new_district', dialog: { greet: 'Журналист Эрика.', default: 'Правда должна быть раскрыта.' }, quests: [] },
  'cross_trainer_tanni': { id: 'cross_trainer_tanni', name: 'Тренер Танни', sprite: '🏃', location: 'route_19', dialog: { greet: 'Тренер Танни.', default: 'Я видел странные вещи на метеостанции.' }, quests: [] },
  'cross_pirate_captain': { id: 'cross_pirate_captain', name: 'Капитан пиратов', sprite: '🏴‍☠️', location: 'il_de_far', dialog: { greet: 'Свистать всех наверх!', default: 'Море зовёт!' }, quests: [] },
  'cross_boy_fishing': { id: 'cross_boy_fishing', name: 'Мальчик с удочкой', sprite: '🎣', location: 'rocky_beach_sa', dialog: { greet: 'Рыбачу на пляже!', default: 'Клюёт! Ой, сорвалось...' }, quests: [] },
  'sa_surfer': { id: 'sa_surfer', name: 'Сёрфингист', sprite: '🏄', location: 'rocky_bay', dialog: { greet: 'Волны Архипелага — лучшие для гонок!', default: 'Хочешь принять участие в гонке? Обгони ветер!', quest_offer: 'Для гонки мне понадобится {target} {item}.', quest_complete: 'Невероятно! Ты обогнал ветер!', quest_incomplete: 'Гонка ещё не завершена.' }, quests: [] },
  'cross_guide_sweets': { id: 'cross_guide_sweets', name: 'Провожатый', sprite: '🍬', location: 'confectionery', dialog: { greet: 'Провожатый в Сладкое царство.', default: 'Кондитерская — самое вкусное место!' }, quests: [] },
  'cross_trainer_derti': { id: 'cross_trainer_derti', name: 'Тренер Дёрти', sprite: '🥊', location: 'route_11', dialog: { greet: 'Тренер Дёрти.', default: 'Готов к сражению?' }, quests: [] },
  'cross_trainer_nambi': { id: 'cross_trainer_nambi', name: 'Тренер Намби', sprite: '🥊', location: 'route_8', dialog: { greet: 'Тренер Намби.', default: 'Битва — моя стихия.' }, quests: [] },
  'cross_trainer_vetti': { id: 'cross_trainer_vetti', name: 'Тренер Ветти', sprite: '🥊', location: 'route_12', dialog: { greet: 'Тренер Ветти.', default: 'Сразись со мной!' }, quests: [] },
  'cross_director_station': { id: 'cross_director_station', name: 'Директор станции', sprite: '⚡', location: 'power_plant', dialog: { greet: 'Директор электростанции.', default: 'Энергия для всего Канто!' }, quests: [] },
  'kanto_route18_tracy': { id: 'kanto_route18_tracy', name: 'Трейси', sprite: '📷', location: 'route_18', dialog: { greet: 'Трейси, фотограф.', default: 'Никак не поймаю удачный кадр!' }, quests: [] },
  'elite_lorelei': { id: 'elite_lorelei', name: 'Лорели', sprite: '❄️', location: 'goldenrodStadium', dialog: { greet: 'Я Лорели, член Элитной Четвёрки. Ледяные покемоны не знают пощады.', default: 'Холод — это то, что ты почувствуешь, когда встретишь меня в бою.' }, quests: [] },
  'elite_bruno': { id: 'elite_bruno', name: 'Бруно', sprite: '💪', location: 'goldenrodStadium', dialog: { greet: 'Я Бруно! Мои покемоны боевого типа сокрушат любого!', default: 'Тренировки делают нас сильнее. Ты готов?' }, quests: [] },
  'elite_agatha': { id: 'elite_agatha', name: 'Агата', sprite: '👻', location: 'goldenrodStadium', dialog: { greet: 'Хе-хе... Я Агата. Призраки — мои верные спутники.', default: 'Смерть неизбежна, как и моя победа.' }, quests: [] },
  'elite_lance': { id: 'elite_lance', name: 'Лэнс', sprite: '🐉', location: 'goldenrodStadium', dialog: { greet: 'Я Лэнс, мастер драконьих покемонов. Элитная Четвёрка — моя стихия.', default: 'Драконы — сильнейшие покемоны. Ты готов это проверить?' }, quests: [] },
  'elite_champion': { id: 'elite_champion', name: 'Чемпион Блю', sprite: '👑', location: 'goldenrodStadium', dialog: { greet: 'Я Чемпион Лиги! Мой дед — профессор Оук. Докажи, что достоин.', default: 'Быть чемпионом — значит быть сильнейшим. Попробуй отобрать титул!' }, quests: [] },
  'summer_trainer_steve': { id: 'summer_trainer_steve', name: 'Тренер Стив', sprite: '🏄', location: 'azure_shoreline', dialog: { greet: 'Я Тренер Стив.', default: 'Расскажу интересные факты о побережье.' }, quests: [] },
  'summer_collector': { id: 'summer_collector', name: 'Коллекционер', sprite: '🎩', location: 'summer_fountain', dialog: { greet: 'Я известный коллекционер со всего региона! Моя коллекция уникальных предметов и редких покемонов ждет пополнения.', default: 'У вас есть что-то интересное для моей коллекции?', quest_offer: 'Для пополнения коллекции нужен {target} {item}.', quest_complete: 'Великолепное пополнение! Вот ваша награда.', quest_incomplete: 'Моя коллекция еще не полна...' }, quests: [] },
  'summer_nursery_worker': { id: 'summer_nursery_worker', name: 'Работник питомника', sprite: '🥚', location: 'summer_nursery', dialog: { greet: 'Добро пожаловать в Питомник Западного Джото! Здесь вы можете получить случайных покемонов для тренировки.', default: 'Питомник всегда открыт для тренеров. Новые покемоны появляются регулярно.', quest_offer: 'Выберите набор покемонов для тренировки!', quest_complete: 'Отличная работа с питомцами! Держите награду.', quest_incomplete: 'Покемоны еще растут. Приходите позже.' }, quests: [] },
  'ostaron_mayor': { id: 'ostaron_mayor', name: 'Мэр Остарона', sprite: '🏛️', location: 'ostaron_cityhall', dialog: { greet: 'Я мэр Остарона! Наш великий город нуждается в вашей помощи в войне с Сайрефом.', default: 'Вы уже выбрали сторону? Остарон ждет вашей поддержки.', quest_offer: 'Для победы над Сайрефом нужен {target} {item}.', quest_complete: 'Остарон благодарит вас! Победа будет за нами!', quest_incomplete: 'Битва еще не выиграна...' }, quests: [] },
  'melen_albert_quest': { id: 'melen_albert_quest', name: 'Альберт', sprite: '🕵️', location: 'melen_albert_house', dialog: { greet: 'Я Альберт. Моя племянница пропала! Банда захватила город... Нужно действовать за пределами закона.', default: 'Банда всё ещё там. Нужно больше подготовки.', quest_offer: 'Для спасения племянницы нужен {target} {item}.', quest_complete: 'Племянница спасена! Вы настоящий герой!', quest_incomplete: 'Племянница всё ещё в плену...' }, quests: [] },
  'estaire_officer_jes_quest': { id: 'estaire_officer_jes_quest', name: 'Офицер Джес (расследование)', sprite: '👮‍♀️', location: 'estaire_city', dialog: { greet: 'Офицер Джес. Команда R похитила Батискафиш! Нужно расследование. У вас ранг выше 650?', default: 'Расследование продолжается. Команда R где-то рядом.', quest_offer: 'Для расследования нужен {target} {item}.', quest_complete: 'Дело раскрыто! Батискафиш в безопасности.', quest_incomplete: 'Расследование не закончено...' }, quests: [] },

  // ─────────────────────────────────────────────────────────────
  // Пачка Пьютера: 10 гринд-квестов под Брока (гимы открыты всегда).
  // Типы — из QUEST_TYPES; трекинг — game/quest-track.ts, составные
  // условия — verify при сдаче. Награды: живые предметы + титулы.
  // ─────────────────────────────────────────────────────────────
  'i1_warhall_sensei': {
    id: 'i1_warhall_sensei', name: 'Мастер Дайго', sprite: '⚔️', location: 'warhall_samurai_gym',
    dialog: {
      greet: 'Додзё Вархолла приветствует тебя. Клинок тупится без спаррингов — готов ли ты к пути самурая?',
      default: 'Возвращайся, когда жаждешь боя. Додзё открыто для стойких.',
      quest_offer: 'Спарринг ждёт: одолей {target} соперников. Докажи дух!',
      quest_complete: 'Достойный бой! Забирай награду, самурай.',
      quest_incomplete: 'Спарринги не закончены. Ученики уже разминаются...',
    },
    quests: [],
  },
  'i1_flourence_herbalist': {
    id: 'i1_flourence_herbalist', name: 'Травница Лия', sprite: '🌿', location: 'flourence_greenhouse',
    dialog: {
      greet: 'Оранжерея Флауренции дышит, но запасы мазей иссякли. Поможешь с травами и ягодами?',
      default: 'Цветы любят заботу, а зелья — точные пропорции. Заходи!',
      quest_offer: 'Для снадобья нужно {target} {item}. Лес отблагодарит.',
      quest_complete: 'Какое сырьё! Мазь выйдет отменной. Держи награду.',
      quest_incomplete: 'Сырьё ещё не собрано. Ягоды ждут в траве...',
    },
    quests: [],
  },
  'i1_academy_mentor': {
    id: 'i1_academy_mentor', name: 'Наставник Вера', sprite: '🎓', location: 'goldenrod_academy',
    dialog: {
      greet: 'Академия Голденрода растит чемпионов, а не зевак. Возьмёшься за программу прокачки?',
      default: 'Уровни сами не растут: бои, уход, контракты. Ты на верном пути.',
      quest_offer: 'Программа требует: {target} {item}. Не подведи группу!',
      quest_complete: 'Группа гордится тобой! Вот стипендия Академии.',
      quest_incomplete: 'Программа не выполнена. Тренируйся дальше!',
    },
    quests: [],
  },
  'i1_daycare_nanny': {
    id: 'i1_daycare_nanny', name: 'Няня Оливия', sprite: '🥚', location: 'goldenrodCity_pokecenter',
    dialog: {
      greet: 'Питомник переполнен: пары подобраны, инкубатор тёплый. Поможешь вывести и выходить малышей?',
      default: 'Яйцам нужны тепло и прогулки, малышам — корм и забота.',
      quest_offer: 'Малышам нужно {target} {item}. Не дай инкубатору остыть!',
      quest_complete: 'Смотри, скорлупа треснула! Ты чудо-няня. Держи награду.',
      quest_incomplete: 'Инкубатор ещё гудит... Выгул не окончен.',
    },
    quests: [],
  },
  'i1_summer_ranger': {
    id: 'i1_summer_ranger', name: 'Рейнджер Нала', sprite: '🔭', location: 'summer',
    dialog: {
      greet: 'Саванна Саммера кишит неизученными видами. Институту нужна большая перепись — возьмёшься?',
      default: 'Покедекс сам не заполнится. Саванна ждёт наблюдательных!',
      quest_offer: 'Каталогу не хватает {target} {item}. Бинокль наготове?',
      quest_complete: 'Какой экземпляр! Каталог пополнен. Держи снаряжение.',
      quest_incomplete: 'Перепись не окончена. Следы ведут вглубь саванны...',
    },
    quests: [],
  },
  'i1_olivine_coach': {
    id: 'i1_olivine_coach', name: 'Тренер прибоя Кора', sprite: '🌊', location: 'olivineStadium',
    dialog: {
      greet: 'Водный стадион Оливина гудит: претенденты рвутся к лидеру. Станешь нашим спарринг-партнёром?',
      default: 'Прибой точит скалы, а бои точат мастерство. Жду на помосте!',
      quest_offer: 'Стадиону нужно {target} {item}. Трибуны уже шумят!',
      quest_complete: 'Трибуны ревут! Ты украшение стадиона. Держи приз.',
      quest_incomplete: 'Бои не окончены. Разминка ещё идёт...',
    },
    quests: [],
  },
  'i1_celadon_trader': {
    id: 'i1_celadon_trader', name: 'Торговец Марко', sprite: '💼', location: 'celadonCity',
    dialog: {
      greet: 'Целадон живёт торговлей: цены скачут, караваны идут. Хочешь сколотить капитал честной сделкой?',
      default: 'Купи дёшево, продай дорого — и не забудь про оборотный запас!',
      quest_offer: 'Сделка требует {target} {item}. Рынок не ждёт!',
      quest_complete: 'Сделка закрыта в плюс! Ты прирождённый купец.',
      quest_incomplete: 'Сделка ещё не закрыта. Рынки шумят без тебя...',
    },
    quests: [],
  },
  'i1_training_master': {
    id: 'i1_training_master', name: 'Мастер тренировок Рэй', sprite: '🏋️', location: 'pewterCity_trainingGrounds',
    dialog: {
      greet: 'Тренировочная зона Пьютера: пот, зелья и спарринги. Выдержишь мою изнуряющую программу?',
      default: 'Отдых — тоже тренировка. Но только после спаррингов!',
      quest_offer: 'Программа требует {target} {item}. Полотенце не забудь!',
      quest_complete: 'Мышцы и команда крепнут на глазах! Держи пайку.',
      quest_incomplete: 'Программа не выполнена. Круг ещё не закрыт...',
    },
    quests: [
      { id: 'pw_tempered', type: 'special', targetItem: null, targetQty: 1, desc: 'Набери 100 EV в пул команды', rewardMoney: 10000, rewardItem: 'protein', rewardQty: 1, rewardTitle: 'tempered', prereqQuest: null, verify: { evPool: 100 } },
      { id: 'pw_undefeated', type: 'streak_x', targetItem: null, targetQty: 10, desc: '10 побед подряд в диких боях (без поражений и побегов)', rewardMoney: 30000, rewardItem: 'leftovers', rewardQty: 1, rewardTitle: 'undefeated', prereqQuest: 'pw_tempered' },
    ],
  },
  // ── Пачка Пьютера: гринд-квесты под Брока (гимы открыты всегда) ──
  'pewter_researcher': {
    id: 'pewter_researcher', name: 'Исследователь музея', sprite: '🔬', location: 'pewterCity',
    dialog: {
      greet: 'Музей Пьютера изучает каменных покемонов. Поможешь с полевыми данными?',
      default: 'Камень помнит всё. Продолжай наблюдения.',
      quest_offer: 'Нужно: {target} {item}. Камень никуда не спешит.',
      quest_complete: 'Отличные данные! Держи награду из фондов музея.',
      quest_incomplete: 'Сбор данных не окончен. Скалы ждут...',
    },
    quests: [
      { id: 'pw_trail', type: 'defeat_x', targetItem: null, targetQty: 25, desc: 'Победи 25 диких каменных/земляных + посети 5 локаций (средний уровень 15)', rewardMoney: 5000, rewardItem: 'hardStone', rewardQty: 1, rewardItems: [{ id: 'superPotion', qty: 3 }], rewardTitle: 'pathfinder', prereqQuest: null, filter: { types: ['rock', 'ground'] }, verify: { avgLevel: 15, locs: ['pewterCity', 'viridianForest', 'route3', 'mtMoon', 'rockTunnel'] } },
      { id: 'pw_rockbane', type: 'special', targetItem: null, targetQty: 1, desc: 'Подними любого до 25 и поймай 8 видов каменных', rewardMoney: 50000, rewardItem: 'greatBall', rewardQty: 6, rewardTitle: 'rockBane', prereqQuest: 'pw_trail', verify: { maxLevel: 25, rockSpecies: ['geodude', 'onix', 'rhyhorn', 'omanyte', 'kabuto', 'aerodactyl', 'nosepass', 'larvitar', 'cranidos', 'shieldon', 'roggenrola', 'boldore'], rockCount: 8 } },
    ],
  },
  'pewter_bully': {
    id: 'pewter_bully', name: 'Ученик Бруно', sprite: '🥋', location: 'pewterStadium',
    dialog: {
      greet: 'Ты слабак! Мои кулаки говорят за меня. Осмелишься выйти?',
      default: 'Возвращайся, когда отрастишь хребет.',
      quest_offer: 'Побей меня, если сможешь. Один бой — одна судьба.',
      quest_complete: 'Невероятно... Ты силён. Забирай приз.',
      quest_incomplete: 'Сначала победи меня в честном бою!',
    },
    quests: [
      { id: 'pw_fist', type: 'boss_win', targetItem: null, targetQty: 1, desc: 'Победи Ученика Бруно (команда 3×Lv28)', rewardMoney: 15000, rewardItem: 'focusBand', rewardQty: 1, rewardItems: [{ id: 'ppUp', qty: 2 }], rewardTitle: 'fistFighter', prereqQuest: null, filter: { bossId: 'pewterBully' } },
    ],
  },
  'pewter_hunter': {
    id: 'pewter_hunter', name: 'Охотник Скай', sprite: '🧭', location: 'pewterCity',
    dialog: {
      greet: 'Над скалами Пьютера кружит тень... Аэродактиль! Поймай его, и я озолочу.',
      default: 'Небо не терпит суеты. Выслеживай.',
      quest_offer: 'Нужен живой Аэродактиль. Один. Целый.',
      quest_complete: 'Вот это добыча! Небо теперь твоё.',
      quest_incomplete: 'Аэродактиль всё ещё кружит над скалами...',
    },
    quests: [
      { id: 'pw_sky', type: 'catch_x', targetItem: null, targetQty: 1, desc: 'Поймай Aerodactyl', rewardMoney: 25000, rewardItem: 'sharpBeak', rewardQty: 1, rewardTitle: 'skyHunter', prereqQuest: null, filter: { species: 'aerodactyl' } },
    ],
  },
  'pewter_trader': {
    id: 'pewter_trader', name: 'Торговец Кэш', sprite: '💰', location: 'pewterCity_pokemart',
    dialog: {
      greet: 'Деньги любят движение. Покажи оборот — получишь инструмент богачей.',
      default: 'Торгуй, сражайся, богатей.',
      quest_offer: 'Оборот 100 000. Легальный. Почти.',
      quest_complete: 'Солидный оборот! Амулет твой.',
      quest_incomplete: 'Касса пока пуста...',
    },
    quests: [
      { id: 'pw_money', type: 'earn_money', targetItem: null, targetQty: 100000, desc: 'Заработай 100 000 боями и торговлей', rewardMoney: 5000, rewardItem: 'amuletCoin', rewardQty: 1, rewardTitle: 'moneyMagnate', prereqQuest: null },
    ],
  },
  'pewter_breeder': {
    id: 'pewter_breeder', name: 'Заводчица Нест', sprite: '🥚', location: 'pewterCity_pokecenter',
    dialog: {
      greet: 'Яйца — это будущее. Выведи и вылупи хоть одно — поверю в тебя.',
      default: 'Тепло, забота и немного удачи.',
      quest_offer: 'Одно вылупленное яйцо. Живое. Пищащее.',
      quest_complete: 'Какая прелесть! Держи узел судьбы.',
      quest_incomplete: 'Яйцо ещё не вылупилось...',
    },
    quests: [
      { id: 'pw_breed', type: 'hatch_x', targetItem: null, targetQty: 1, desc: 'Выведи и вылупи яйцо', rewardMoney: 8000, rewardItem: 'destinyKnot', rewardQty: 1, rewardTitle: 'breeder', prereqQuest: null },
    ],
  },
  'pewter_scout': {
    id: 'pewter_scout', name: 'Следопыт Рут', sprite: '🎒', location: 'pewterCity',
    dialog: {
      greet: 'Карта Канто велика. Посети её ногами — расскажешь, что видел.',
      default: 'Дороги зовут. Не сиди в городе.',
      quest_offer: '12 визитов по локациям Канто. Считаю.',
      quest_complete: 'Настоящий странник! Дорожный набор твой.',
      quest_incomplete: 'Карта ещё полна белых пятен...',
    },
    quests: [
      { id: 'pw_wanderer', type: 'explore', targetItem: null, targetQty: 12, desc: 'Побывай в локациях Канто 12 раз', rewardMoney: 5000, rewardItem: 'escapeRope', rewardQty: 1, rewardItems: [{ id: 'superPotion', qty: 5 }], rewardTitle: 'wanderer', prereqQuest: null, filter: { region: 'kanto' } },
    ],
  },
  'viridian_sender': {
    id: 'viridian_sender', name: 'Отправитель Вера', sprite: '📦', location: 'viridianCity',
    dialog: {
      greet: 'Посылку в Пьютер надо доставить. Возьмёшься? Не вскрывать!',
      default: 'Посылка ждёт курьера.',
      quest_offer: 'Довези запечатанную посылку курьеру в Пьютер.',
      quest_complete: 'Посылка уже не у меня — неси её!',
      quest_incomplete: 'Посылка ещё у тебя? Неси в Пьютер!',
    },
    quests: [],
  },
  'pewter_courier': {
    id: 'pewter_courier', name: 'Курьер Пьютера', sprite: '🛵', location: 'pewterCity',
    dialog: {
      greet: 'Посылка из Виридиана? Давай сюда!',
      default: 'Жду посылки с юга.',
      quest_offer: 'Принеси посылку от Веры.',
      quest_complete: 'Цела! Держи конфеты за скорость.',
      quest_incomplete: 'Без посылки не сдам... то есть не приму!',
    },
    quests: [
      { id: 'pw_courier', type: 'collect_items', targetItem: 'courierParcel', targetQty: 1, desc: 'Довези посылку из Виридиана в Пьютер', rewardMoney: 4500, rewardItem: 'superPotion', rewardQty: 3, rewardTitle: 'courier', prereqQuest: null },
    ],
  },
  'i1_archipelago_captain': {
    id: 'i1_archipelago_captain', name: 'Капитан Бриз', sprite: '⚓', location: 'il_de_far',
    dialog: {
      greet: 'Южный Архипелаг зовёт: лагуны, пираты и контракты на доставку. Поднимешься на борт?',
      default: 'Море любит упорных. Карта, компас — и вперёд!',
      quest_offer: 'Рейс требует {target} {item}. Попутного ветра!',
      quest_complete: 'Рейс завершён без потерь! Доля команды — твоя.',
      quest_incomplete: 'Рейс не окончен. Штормит у дальних рифов...',
    },
    quests: [],
  },

  // ── Пачки лесенки (внешние файлы, см. шапку) ──
  ...KANTO1_NPCS,
  ...KANTO2_NPCS,
  ...JOHTO1_NPCS,
  ...JOHTO2_NPCS,

};

// ─────────────────────────────────────────────────────────────
// УДАЛЕНИЕ NPC НА НЕСУЩЕСТВУЮЩИХ ЛОКАЦИЯХ
// ─────────────────────────────────────────────────────────────
// Часть NPC в реестре ссылается на локации, которых нет на карте
// (flourence, warhall, il_de_far, sen_aspir — целые несуществующие
// регионы). NPC-панель фильтрует строго по n.location === locId, поэтому
// такие NPC НИКОГДА не появлялись: мёртвый контент в данных и в реестре.
// Игрок решил — удалить.
//
// Фильтр применяется к СБОРКЕ NPC_DATA (данные остаются в файлах как
// заготовка), поэтому счётчики в тестах остаются осмысленными, а в игру
// попадает только то, что реально показывается.
import { REGIONS } from './regions.js';

/** Все id локаций, которые есть на карте. */
function mapLocationIds(): Set<string> {
  const ids = new Set<string>();
  for (const region of Object.values(REGIONS) as any[]) {
    for (const id of Object.keys(region?.locations || {})) ids.add(id);
  }
  return ids;
}

/**
 * Выкидывает NPC, чья локация отсутствует на карте.
 * Возвращает id удалённых (для тестов и логов).
 */
export function pruneDeadNpcs(): string[] {
  const known = mapLocationIds();
  const removed: string[] = [];
  for (const [id, npc] of Object.entries(NPC_DATA as Record<string, any>)) {
    const loc = npc?.location;
    if (typeof loc !== 'string' || !loc) continue;   // без локации — оставляем
    if (!known.has(loc)) {
      delete (NPC_DATA as Record<string, any>)[id];
      removed.push(id);
    }
  }
  return removed;
}

/** id NPC, удалённых как несуществующие. Для тестов. */
export const REMOVED_NPC_IDS: string[] = pruneDeadNpcs();