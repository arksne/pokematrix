export const gymLeaders = {

  // ── Ученик Бруно — мини-босс у стадиона Пьютера (fighting) ──
  // friendly: без значка/наград гима, реванши бесконечные. Бой запускается
  // кнопкой NPC (startMiniBossBattle), нужен квесту «Кулачный боец».
  pewterBully: {
    name: 'Ученик Бруно',
    title: 'Гроза новичков',
    type: 'fighting',
    badgeName: '',
    badgeIcon: '🥊',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'machop', level: 28 },
      { name: 'machoke', level: 28 },
      { name: 'primeape', level: 28 },
    ],
  },

  // ── Пловец Финн — мини-босс у стадиона Церулина (water) ──
  ceruleanFinn: {
    name: 'Пловец Финн',
    title: 'Прибойный кулак',
    type: 'water',
    badgeName: '',
    badgeIcon: '🌊',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'psyduck', level: 33 },
      { name: 'poliwhirl', level: 33 },
      { name: 'tentacruel', level: 33 },
    ],
  },

  // ── Матрос Вольт — мини-босс у стадиона Вермилиона (electric) ──
  vermilionVolt: {
    name: 'Матрос Вольт',
    title: 'Высоковольтный',
    type: 'electric',
    badgeName: '',
    badgeIcon: '⚡',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'pikachu', level: 38 },
      { name: 'magneton', level: 38 },
      { name: 'electabuzz', level: 38 },
    ],
  },

  // ── Садовница Флора — мини-босс у стадиона Селадона (grass) ──
  celadonFlora: {
    name: 'Садовница Флора',
    title: 'Шипастый кулак',
    type: 'grass',
    badgeName: '',
    badgeIcon: '🍃',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'bellsprout', level: 43 },
      { name: 'exeggcute', level: 43 },
      { name: 'tangela', level: 43 },
      { name: 'vileplume', level: 43 },
    ],
  },

  // ── Медиум Эспер — мини-босс у стадиона Шаффрана (psychic) ──
  saffronEsper: {
    name: 'Медиум Эспер',
    title: 'Третий глаз',
    type: 'psychic',
    badgeName: '',
    badgeIcon: '🌀',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'drowzee', level: 48 },
      { name: 'kadabra', level: 48 },
      { name: 'mr-mime', level: 48 },
      { name: 'hypno', level: 48 },
    ],
  },

  // ── Ученик Коги — мини-босс у стадиона Фуксии (poison) ──
  fuchsiaApprentice: {
    name: 'Ученик Коги',
    title: 'Тихий шаг',
    type: 'poison',
    badgeName: '',
    badgeIcon: '🥷',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'koffing', level: 53 },
      { name: 'grimer', level: 53 },
      { name: 'ekans', level: 53 },
      { name: 'arbok', level: 53 },
    ],
  },

  // ── Пирокинетик Блейз — мини-босс у стадиона Острова Киноварь (fire) ──
  cinnabarBlaze: {
    name: 'Пирокинетик Блейз',
    title: 'Испытание жаром',
    type: 'fire',
    badgeName: '',
    badgeIcon: '🔥',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'ponyta', level: 58 },
      { name: 'growlithe', level: 58 },
      { name: 'magmar', level: 58 },
      { name: 'rapidash', level: 58 },
    ],
  },

  // ── Агент R — мини-босс у стадиона Виридиана (ground) ──
  viridianAgent: {
    name: 'Агент R',
    title: 'Операция «Крот»',
    type: 'ground',
    badgeName: '',
    badgeIcon: '🕶️',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'cubone', level: 63 },
      { name: 'rhyhorn', level: 63 },
      { name: 'diglett', level: 63 },
      { name: 'dugtrio', level: 63 },
      { name: 'marowak', level: 63 },
    ],
  },

  // ── Пилот Скай — мини-босс у стадиона Вайолет (flying) ──
  violetSky: {
    name: 'Пилот Скай',
    title: 'Воздушный бой',
    type: 'flying',
    badgeName: '',
    badgeIcon: '🦅',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'pidgeotto', level: 68 },
      { name: 'fearow', level: 68 },
      { name: 'noctowl', level: 68 },
      { name: 'skarmory', level: 68 },
      { name: 'dodrio', level: 68 },
    ],
  },

  // ── Ловец Жуков Рой — мини-босс у стадиона Азалии (bug) ──
  azaleaSwarm: {
    name: 'Ловец Жуков Рой',
    title: 'Роевой гул',
    type: 'bug',
    badgeName: '',
    badgeIcon: '🐝',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'parasect', level: 73 },
      { name: 'venomoth', level: 73 },
      { name: 'scyther', level: 73 },
      { name: 'heracross', level: 73 },
      { name: 'forretress', level: 73 },
    ],
  },

  // ── Суперфанат Норм — мини-босс у стадиона Голденрода (normal) ──
  goldenrodNorm: {
    name: 'Суперфанат Норм',
    title: 'Звёздный час',
    type: 'normal',
    badgeName: '',
    badgeIcon: '🌟',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'raticate', level: 78 },
      { name: 'clefable', level: 78 },
      { name: 'wigglytuff', level: 78 },
      { name: 'persian', level: 78 },
      { name: 'porygon', level: 78 },
    ],
  },

  // ── Медиум Тень — мини-босс у стадиона Эйкрутика (ghost) ──
  ecruteakShade: {
    name: 'Медиум Тень',
    title: 'Шепот башни',
    type: 'ghost',
    badgeName: '',
    badgeIcon: '🎐',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'gastly', level: 83 },
      { name: 'haunter', level: 83 },
      { name: 'haunter', level: 83 },
      { name: 'misdreavus', level: 83 },
      { name: 'gengar', level: 83 },
      { name: 'gengar', level: 83 },
    ],
  },

  // ── Ученик Чака — мини-босс у стадиона Сианвуда (fighting) ──
  cianwoodPupil: {
    name: 'Ученик Чака',
    title: 'Тысяча первый удар',
    type: 'fighting',
    badgeName: '',
    badgeIcon: '👊',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'primeape', level: 88 },
      { name: 'machoke', level: 88 },
      { name: 'hitmonlee', level: 88 },
      { name: 'hitmonchan', level: 88 },
      { name: 'machamp', level: 88 },
      { name: 'heracross', level: 88 },
    ],
  },

  // ── Инженер Сталь — мини-босс у стадиона Оливина (steel) ──
  olivineSteel: {
    name: 'Инженер Сталь',
    title: 'Проверка на прочность',
    type: 'steel',
    badgeName: '',
    badgeIcon: '⚙️',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'magneton', level: 88 },
      { name: 'forretress', level: 88 },
      { name: 'skarmory', level: 88 },
      { name: 'steelix', level: 88 },
      { name: 'scizor', level: 88 },
      { name: 'magneton', level: 88 },
    ],
  },

  // ── Морозко — мини-босс у стадиона Махогани (ice) ──
  mahoganyFrost: {
    name: 'Морозко',
    title: 'Холодный приём',
    type: 'ice',
    badgeName: '',
    badgeIcon: '❄️',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'dewgong', level: 88 },
      { name: 'cloyster', level: 88 },
      { name: 'sneasel', level: 88 },
      { name: 'piloswine', level: 88 },
      { name: 'delibird', level: 88 },
      { name: 'jynx', level: 88 },
    ],
  },

  // ── Наследница Клер — мини-босс у стадиона Блэкторна (dragon) ──
  blackthornHeir: {
    name: 'Наследница Клер',
    title: 'Кровь и чешуя',
    type: 'dragon',
    badgeName: '',
    badgeIcon: '🐉',
    trainingStage: 0,
    moneyReward: 0,
    friendly: true,
    team: [
      { name: 'dragonair', level: 88 },
      { name: 'kingdra', level: 88 },
      { name: 'dragonair', level: 88 },
      { name: 'kingdra', level: 88 },
      { name: 'dragonite', level: 88 },
      { name: 'dragonite', level: 88 },
    ],
  },

  // ── Брок — Лидер Зала Пьютера (rock) ──
  pewterStadium: {
    name: 'Брок',
    title: 'Лидер Зала Пьютера',
    type: 'rock',
    badgeName: 'Boulder Badge',
    badgeIcon: '🪨',
    trainingStage: 1,
    moneyReward: 4000,
    rewardItem: 'fullRestore',
    rewardQty: 1,
    team: [
      { name: 'golem', level: 40 },
      { name: 'omastar', level: 40 },
      { name: 'aerodactyl', level: 40 },
      { name: 'tyranitar', level: 40 },
    ],
  },

  // ── Мисти — Лидер Зала Церулина (water) ──
  ceruleanStadium: {
    name: 'Мисти',
    title: 'Лидер Зала Церулина',
    type: 'water',
    badgeName: 'Cascade Badge',
    badgeIcon: '💧',
    trainingStage: 1,
    moneyReward: 5000,
    rewardItem: 'superPotion',
    rewardQty: 1,
    team: [
      { name: 'starmie', level: 45 },
      { name: 'lapras', level: 45 },
      { name: 'gyarados', level: 45 },
      { name: 'poliwrath', level: 45 },
    ],
  },

  // ── Лейтенант Сёрдж — Лидер Зала Вермилиона (electric) ──
  vermilionStadium: {
    name: 'Лейтенант Сёрдж',
    title: 'Лидер Зала Вермилиона',
    type: 'electric',
    badgeName: 'Thunder Badge',
    badgeIcon: '⚡',
    trainingStage: 2,
    moneyReward: 6000,
    rewardItem: 'elixir',
    rewardQty: 1,
    team: [
      { name: 'raichu', level: 50 },
      { name: 'magneton', level: 50 },
      { name: 'lanturn', level: 50 },
      { name: 'electabuzz', level: 50 },
    ],
  },

  // ── Эрика — Лидер Зала Селадона (grass) ──
  celadonStadium: {
    name: 'Эрика',
    title: 'Лидер Зала Селадона',
    type: 'grass',
    badgeName: 'Rainbow Badge',
    badgeIcon: '🌿',
    trainingStage: 2,
    moneyReward: 7000,
    rewardItem: 'hyperPotion',
    rewardQty: 1,
    team: [
      { name: 'venusaur', level: 55 },
      { name: 'exeggutor', level: 55 },
      { name: 'jumpluff', level: 55 },
      { name: 'bellossom', level: 55 },
    ],
  },

  // ── Сабрина — Лидер Зала Шаффрана (psychic) ──
  saffronPsychicStadium: {
    name: 'Сабрина',
    title: 'Лидер Зала Шаффрана',
    type: 'psychic',
    badgeName: 'Marsh Badge',
    badgeIcon: '🔮',
    trainingStage: 2,
    moneyReward: 8000,
    rewardItem: 'maxPotion',
    rewardQty: 1,
    team: [
      { name: 'alakazam', level: 60 },
      { name: 'espeon', level: 60 },
      { name: 'mr-mime', level: 60 },
      { name: 'hypno', level: 60 },
    ],
  },

  // ── Кога — Лидер Зала Фуксии (poison) ──
  fuchsiaPoisonStadium: {
    name: 'Кога',
    title: 'Лидер Зала Фуксии',
    type: 'poison',
    badgeName: 'Soul Badge',
    badgeIcon: '☠️',
    trainingStage: 3,
    moneyReward: 9000,
    rewardItem: 'fullRestore',
    rewardQty: 2,
    team: [
      { name: 'gengar', level: 65 },
      { name: 'crobat', level: 65 },
      { name: 'tentacruel', level: 65 },
      { name: 'muk', level: 65 },
    ],
  },

  // ── Блейн — Лидер Зала Острова Киноварь (fire) ──
  cinnabarStadium: {
    name: 'Блейн',
    title: 'Лидер Зала Острова Киноварь',
    type: 'fire',
    badgeName: 'Volcano Badge',
    badgeIcon: '🌋',
    trainingStage: 3,
    moneyReward: 10000,
    rewardItem: 'maxElixir',
    rewardQty: 1,
    team: [
      { name: 'arcanine', level: 70 },
      { name: 'ninetales', level: 70 },
      { name: 'rapidash', level: 70 },
      { name: 'magmortar', level: 70 },
    ],
  },

  // ── Джованни — Босс Команды R (ground) ──
  viridianStadium: {
    name: 'Джованни',
    title: 'Босс Команды R',
    type: 'ground',
    badgeName: 'Earth Badge',
    badgeIcon: '🏜️',
    trainingStage: 3,
    moneyReward: 11000,
    rewardItem: 'maxRevive',
    rewardQty: 1,
    team: [
      { name: 'nidoking', level: 75 },
      { name: 'rhydon', level: 75 },
      { name: 'dugtrio', level: 75 },
      { name: 'krookodile', level: 75 },
    ],
  },

  // ── Фолкнер — Лидер Зала Вайолет (flying) ──
  violetStadium: {
    name: 'Фолкнер',
    title: 'Лидер Зала Вайолет',
    type: 'flying',
    badgeName: 'Zephyr Badge',
    badgeIcon: '🕊️',
    trainingStage: 4,
    moneyReward: 12000,
    rewardItem: 'fullRestore',
    rewardQty: 1,
    team: [
      { name: 'pidgeot', level: 80 },
      { name: 'skarmory', level: 80 },
      { name: 'gligar', level: 80 },
      { name: 'aerodactyl', level: 80 },
    ],
  },

  // ── Багси — Лидер Зала Азалии (bug) ──
  azaleaStadium: {
    name: 'Багси',
    title: 'Лидер Зала Азалии',
    type: 'bug',
    badgeName: 'Hive Badge',
    badgeIcon: '🐛',
    trainingStage: 4,
    moneyReward: 13000,
    rewardItem: 'hyperPotion',
    rewardQty: 1,
    team: [
      { name: 'scizor', level: 85 },
      { name: 'heracross', level: 85 },
      { name: 'scyther', level: 85 },
      { name: 'yanmega', level: 85 },
    ],
  },

  // ── Уитни — Лидер Зала Голденрода (normal) ──
  goldenrodStadium: {
    name: 'Уитни',
    title: 'Лидер Зала Голденрода',
    type: 'normal',
    badgeName: 'Plain Badge',
    badgeIcon: '⭐',
    trainingStage: 4,
    moneyReward: 14000,
    rewardItem: 'maxPotion',
    rewardQty: 1,
    team: [
      { name: 'snorlax', level: 90 },
      { name: 'blissey', level: 90 },
      { name: 'kangaskhan', level: 90 },
      { name: 'tauros', level: 90 },
    ],
  },

  // ── Морти — Лидер Зала Эйкрутика (ghost) ──
  ecruteakStadium: {
    name: 'Морти',
    title: 'Лидер Зала Эйкрутика',
    type: 'ghost',
    badgeName: 'Fog Badge',
    badgeIcon: '👻',
    trainingStage: 5,
    moneyReward: 15000,
    rewardItem: 'fullRestore',
    rewardQty: 2,
    team: [
      { name: 'gengar', level: 95 },
      { name: 'mismagius', level: 95 },
      { name: 'sableye', level: 95 },
      { name: 'banette', level: 95 },
    ],
  },

  // ── Чак — Лидер Зала Сианвуда (fighting) ──
  cianwoodStadium: {
    name: 'Чак',
    title: 'Лидер Зала Сианвуда',
    type: 'fighting',
    badgeName: 'Storm Badge',
    badgeIcon: '👊',
    trainingStage: 5,
    moneyReward: 16000,
    rewardItem: 'maxElixir',
    rewardQty: 1,
    team: [
      { name: 'machamp', level: 100 },
      { name: 'hitmonlee', level: 100 },
      { name: 'hitmonchan', level: 100 },
      { name: 'conkeldurr', level: 100 },
    ],
  },

  // ── Жасмин — Лидер Зала Оливина (steel) ──
  olivineStadium: {
    name: 'Жасмин',
    title: 'Лидер Зала Оливина',
    type: 'steel',
    badgeName: 'Mineral Badge',
    badgeIcon: '⚙️',
    trainingStage: 5,
    moneyReward: 17000,
    rewardItem: 'fullRestore',
    rewardQty: 2,
    team: [
      { name: 'steelix', level: 100 },
      { name: 'skarmory', level: 100 },
      { name: 'mawile', level: 100 },
      { name: 'aggron', level: 100 },
    ],
  },

  // ── Прайс — Лидер Зала Махогани (ice) ──
  mahoganyStadium: {
    name: 'Прайс',
    title: 'Лидер Зала Махогани',
    type: 'ice',
    badgeName: 'Glacier Badge',
    badgeIcon: '❄️',
    trainingStage: 6,
    moneyReward: 18000,
    rewardItem: 'maxRevive',
    rewardQty: 1,
    team: [
      { name: 'dewgong', level: 100 },
      { name: 'cloyster', level: 100 },
      { name: 'mamoswine', level: 100 },
      { name: 'glaceon', level: 100 },
    ],
  },

  // ── Клер — Лидер Зала Блэкторна (dragon) ──
  blackthornStadium: {
    name: 'Клер',
    title: 'Лидер Зала Блэкторна',
    type: 'dragon',
    badgeName: 'Rising Badge',
    badgeIcon: '🐉',
    trainingStage: 6,
    moneyReward: 20000,
    rewardItem: 'maxRevive',
    rewardQty: 2,
    team: [
      { name: 'dragonite', level: 100 },
      { name: 'salamence', level: 100 },
      { name: 'garchomp', level: 100 },
      { name: 'kingdra', level: 100 },
    ],
  },

};
