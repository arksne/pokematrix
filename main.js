// --- GAME DATA (LOCATIONS) ---
const locations = {
  'pallet_town': {
    name: 'Алабастия (Pallet Town)', desc: 'Ваш родной город. Здесь находится лаборатория профессора Оука.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/f/fa/Pallet_Town_FRLG.png/300px-Pallet_Town_FRLG.png',
    links: ['route_1', 'route_21'], encounters: [], hasHeal: true
  },
  'route_1': {
    name: 'Маршрут 1', desc: 'Короткая тропа между Алабастией и Виридианом.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/b/b3/Kanto_Route_1_FRLG.png/250px-Kanto_Route_1_FRLG.png',
    links: ['pallet_town', 'viridian_city'], encounters: ['pidgey', 'rattata'], hasHeal: false
  },
  'viridian_city': {
    name: 'Виридиан', desc: 'Зеленый город, где находится гим земли.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/7/7b/Viridian_City_FRLG.png/300px-Viridian_City_FRLG.png',
    links: ['route_1', 'route_2', 'route_22'], encounters: [], hasHeal: true
  },
  'route_22': {
    name: 'Маршрут 22', desc: 'Дорога к Лиге Покемонов.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/e/ef/Kanto_Route_22_FRLG.png/250px-Kanto_Route_22_FRLG.png',
    links: ['viridian_city', 'victory_road'], encounters: ['mankey', 'spearow'], hasHeal: false
  },
  'route_2': {
    name: 'Маршрут 2', desc: 'Дорога к Виридианскому лесу.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/0/00/Kanto_Route_2_FRLG.png/120px-Kanto_Route_2_FRLG.png',
    links: ['viridian_city', 'viridian_forest', 'diglett_cave'], encounters: ['caterpie', 'weedle', 'pidgey'], hasHeal: false
  },
  'viridian_forest': {
    name: 'Виридианский Лес', desc: 'Темный лес, полный жуков.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/2/23/Viridian_Forest_FRLG.png/300px-Viridian_Forest_FRLG.png',
    links: ['route_2', 'pewter_city'], encounters: ['caterpie', 'metapod', 'weedle', 'kakuna', 'pikachu'], hasHeal: false
  },
  'pewter_city': {
    name: 'Пьютер', desc: 'Каменный город, гим Брока.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/2/22/Pewter_City_FRLG.png/300px-Pewter_City_FRLG.png',
    links: ['viridian_forest', 'route_3'], encounters: [], hasHeal: true
  },
  'route_3': {
    name: 'Маршрут 3', desc: 'Холмистая дорога к Лунной Горе.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/0/02/Kanto_Route_3_FRLG.png/300px-Kanto_Route_3_FRLG.png',
    links: ['pewter_city', 'mt_moon'], encounters: ['spearow', 'jigglypuff', 'nidoran-f', 'nidoran-m'], hasHeal: false
  },
  'mt_moon': {
    name: 'Лунная Гора (Mt. Moon)', desc: 'Огромная пещера, где падают метеориты.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/d/d4/Mt_Moon_1F_FRLG.png/300px-Mt_Moon_1F_FRLG.png',
    links: ['route_3', 'route_4'], encounters: ['zubat', 'geodude', 'paras', 'clefairy'], hasHeal: false
  },
  'route_4': {
    name: 'Маршрут 4', desc: 'Короткий спуск к Церулину.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/d/d8/Kanto_Route_4_FRLG.png/300px-Kanto_Route_4_FRLG.png',
    links: ['mt_moon', 'cerulean_city'], encounters: ['rattata', 'spearow', 'ekans', 'sandshrew'], hasHeal: false
  },
  'cerulean_city': {
    name: 'Церулин', desc: 'Водный город Мисти.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/4/4e/Cerulean_City_FRLG.png/300px-Cerulean_City_FRLG.png',
    links: ['route_4', 'route_24', 'route_5', 'route_9'], encounters: [], hasHeal: true
  },
  'route_24': {
    name: 'Маршрут 24 (Мост)', desc: 'Мост самородков.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/f/f3/Kanto_Route_24_FRLG.png/250px-Kanto_Route_24_FRLG.png',
    links: ['cerulean_city', 'route_25'], encounters: ['weedle', 'caterpie', 'abra', 'bellsprout'], hasHeal: false
  },
  'route_25': {
    name: 'Маршрут 25', desc: 'Дом Билла.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/5/5e/Kanto_Route_25_FRLG.png/250px-Kanto_Route_25_FRLG.png',
    links: ['route_24'], encounters: ['pidgey', 'oddish', 'venonat'], hasHeal: false
  },
  'route_5': {
    name: 'Маршрут 5', desc: 'Спуск к Шаффрану.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/5/5d/Kanto_Route_5_FRLG.png/250px-Kanto_Route_5_FRLG.png',
    links: ['cerulean_city', 'saffron'], encounters: ['meowth', 'mankey', 'pidgey'], hasHeal: false
  },
  'saffron': {
    name: 'Шаффран', desc: 'Крупный мегаполис в центре Канто.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/b/b3/Saffron_City_FRLG.png/300px-Saffron_City_FRLG.png',
    links: ['route_5', 'route_6', 'route_7', 'route_8'], encounters: [], hasHeal: true
  },
  'route_6': {
    name: 'Маршрут 6', desc: 'Короткий маршрут, соединяющий Вермилион и Шаффран.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/c/cd/Kanto_Route_6_FRLG.png/250px-Kanto_Route_6_FRLG.png',
    links: ['saffron', 'vermilion'], encounters: ['pidgey', 'rattata', 'meowth', 'psyduck', 'oddish'], hasHeal: false
  },
  'vermilion': {
    name: 'Вермилион', desc: 'Портовый город Канто.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/3/3d/Vermilion_City_FRLG.png/300px-Vermilion_City_FRLG.png',
    links: ['route_6', 'route_11'], encounters: [], hasHeal: true
  },
  'route_11': {
    name: 'Маршрут 11', desc: 'Дорога на восток от Вермилиона.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/4/4e/Kanto_Route_11_FRLG.png/300px-Kanto_Route_11_FRLG.png',
    links: ['vermilion', 'diglett_cave', 'route_12'], encounters: ['spearow', 'ekans', 'sandshrew', 'drowzee'], hasHeal: false
  },
  'diglett_cave': {
    name: 'Пещера Диглеттов', desc: 'Тоннель между Вермилионом и Пьютером.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/7/77/Diglett%27s_Cave_FRLG.png/300px-Diglett%27s_Cave_FRLG.png',
    links: ['route_11', 'route_2'], encounters: ['diglett', 'dugtrio'], hasHeal: false
  },
  'route_9': {
    name: 'Маршрут 9', desc: 'Скалистая дорога от Церулина к Каменному Тоннелю.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/6/6f/Kanto_Route_9_FRLG.png/300px-Kanto_Route_9_FRLG.png',
    links: ['cerulean_city', 'route_10'], encounters: ['rattata', 'spearow', 'ekans', 'sandshrew'], hasHeal: false
  },
  'route_10': {
    name: 'Маршрут 10', desc: 'Река перед Каменным Тоннелем.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/d/d4/Kanto_Route_10_FRLG.png/150px-Kanto_Route_10_FRLG.png',
    links: ['route_9', 'rock_tunnel', 'lavender_town'], encounters: ['voltorb', 'magnemite', 'machop'], hasHeal: false
  },
  'rock_tunnel': {
    name: 'Каменный Тоннель', desc: 'Темная и длинная пещера.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/e/e0/Rock_Tunnel_1F_FRLG.png/300px-Rock_Tunnel_1F_FRLG.png',
    links: ['route_10'], encounters: ['zubat', 'geodude', 'machop', 'onix'], hasHeal: false
  },
  'lavender_town': {
    name: 'Лавендер', desc: 'Город призраков с Башней Покемонов.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/e/e6/Lavender_Town_FRLG.png/300px-Lavender_Town_FRLG.png',
    links: ['route_10', 'route_8', 'route_12'], encounters: ['gastly', 'haunter', 'cubone'], hasHeal: true
  },
  'route_8': {
    name: 'Маршрут 8', desc: 'Дорога в Шаффран.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/8/87/Kanto_Route_8_FRLG.png/300px-Kanto_Route_8_FRLG.png',
    links: ['lavender_town', 'saffron'], encounters: ['pidgey', 'meowth', 'growlithe', 'vulpix'], hasHeal: false
  },
  'route_7': {
    name: 'Маршрут 7', desc: 'Короткий путь из Селадона в Шаффран.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/0/07/Kanto_Route_7_FRLG.png/150px-Kanto_Route_7_FRLG.png',
    links: ['celadon_city', 'saffron'], encounters: ['meowth', 'oddish', 'bellsprout'], hasHeal: false
  },
  'celadon_city': {
    name: 'Селадон', desc: 'Крупный торговый город с универмагом и казино.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/6/6d/Celadon_City_FRLG.png/300px-Celadon_City_FRLG.png',
    links: ['route_7', 'route_16'], encounters: [], hasHeal: true
  },
  'route_16': {
    name: 'Маршрут 16', desc: 'Выезд на велосипедную дорожку.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/6/69/Kanto_Route_16_FRLG.png/250px-Kanto_Route_16_FRLG.png',
    links: ['celadon_city', 'route_17'], encounters: ['spearow', 'doduo', 'rattata', 'grimer'], hasHeal: false
  },
  'route_17': {
    name: 'Велосипедная дорожка (М17)', desc: 'Длинный мост байкеров.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/0/01/Kanto_Route_17_FRLG.png/150px-Kanto_Route_17_FRLG.png',
    links: ['route_16', 'route_18'], encounters: ['doduo', 'fearow', 'grimer', 'ponyta'], hasHeal: false
  },
  'route_18': {
    name: 'Маршрут 18', desc: 'Конец дорожки у Фуксии.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/5/5f/Kanto_Route_18_FRLG.png/250px-Kanto_Route_18_FRLG.png',
    links: ['route_17', 'fuchsia_city'], encounters: ['doduo', 'fearow', 'rattata'], hasHeal: false
  },
  'fuchsia_city': {
    name: 'Фуксия', desc: 'Город ниндзя и Сафари Зоны.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/7/77/Fuchsia_City_FRLG.png/300px-Fuchsia_City_FRLG.png',
    links: ['route_18', 'safari_zone', 'route_15', 'route_19'], encounters: [], hasHeal: true
  },
  'safari_zone': {
    name: 'Сафари Зона', desc: 'Огромный заповедник редких покемонов.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/6/6f/Safari_Zone_Center_FRLG.png/300px-Safari_Zone_Center_FRLG.png',
    links: ['fuchsia_city'], encounters: ['nidoran-f', 'nidoran-m', 'exeggcute', 'rhyhorn', 'chansey', 'scyther', 'pinsir', 'tauros'], hasHeal: false
  },
  'route_15': {
    name: 'Маршрут 15', desc: 'Дорога на восток от Фуксии.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/9/91/Kanto_Route_15_FRLG.png/300px-Kanto_Route_15_FRLG.png',
    links: ['fuchsia_city', 'route_14'], encounters: ['oddish', 'bellsprout', 'venonat', 'ditto'], hasHeal: false
  },
  'route_14': {
    name: 'Маршрут 14', desc: 'Поворот на север.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/e/e0/Kanto_Route_14_FRLG.png/150px-Kanto_Route_14_FRLG.png',
    links: ['route_15', 'route_13'], encounters: ['pidgey', 'pidgeotto', 'ditto'], hasHeal: false
  },
  'route_13': {
    name: 'Маршрут 13', desc: 'Деревянный мост-лабиринт.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/c/ca/Kanto_Route_13_FRLG.png/300px-Kanto_Route_13_FRLG.png',
    links: ['route_14', 'route_12'], encounters: ['pidgey', 'oddish', 'bellsprout', 'venonat'], hasHeal: false
  },
  'route_12': {
    name: 'Маршрут 12', desc: 'Мост рыбаков. Здесь спал Снорлакс.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/5/52/Kanto_Route_12_FRLG.png/150px-Kanto_Route_12_FRLG.png',
    links: ['route_13', 'lavender_town', 'route_11'], encounters: ['tentacool', 'magikarp', 'snorlax'], hasHeal: false
  },
  'route_19': {
    name: 'Маршрут 19', desc: 'Морской путь от Фуксии.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/f/f2/Kanto_Route_19_FRLG.png/200px-Kanto_Route_19_FRLG.png',
    links: ['fuchsia_city', 'route_20'], encounters: ['tentacool', 'magikarp'], hasHeal: false
  },
  'route_20': {
    name: 'Маршрут 20', desc: 'Бурные воды у Островов Морской Пены.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/7/75/Kanto_Route_20_FRLG.png/300px-Kanto_Route_20_FRLG.png',
    links: ['route_19', 'seafoam_islands', 'cinnabar_island'], encounters: ['tentacool', 'magikarp', 'lapras'], hasHeal: false
  },
  'seafoam_islands': {
    name: 'Острова Морской Пены', desc: 'Ледяные пещеры, обитель Артикуно.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/8/87/Seafoam_Islands_1F_FRLG.png/300px-Seafoam_Islands_1F_FRLG.png',
    links: ['route_20'], encounters: ['seel', 'slowpoke', 'zubat', 'golbat', 'jynx', 'articuno'], hasHeal: false
  },
  'cinnabar_island': {
    name: 'Синнабар', desc: 'Вулканический остров с заброшенной лабораторией.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/0/07/Cinnabar_Island_FRLG.png/300px-Cinnabar_Island_FRLG.png',
    links: ['route_20', 'route_21'], encounters: ['grimer', 'muk', 'koffing', 'weezing'], hasHeal: true
  },
  'route_21': {
    name: 'Маршрут 21', desc: 'Водный путь прямо до Алабастии.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/0/01/Kanto_Route_21_FRLG.png/150px-Kanto_Route_21_FRLG.png',
    links: ['cinnabar_island', 'pallet_town'], encounters: ['tentacool', 'tangela'], hasHeal: false
  },
  'victory_road': {
    name: 'Дорога Победы', desc: 'Последнее испытание перед Лигой.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/2/23/Victory_Road_1F_FRLG.png/300px-Victory_Road_1F_FRLG.png',
    links: ['route_22', 'indigo_plateau'], encounters: ['machop', 'geodude', 'zubat', 'onix'], hasHeal: false
  },
  'indigo_plateau': {
    name: 'Плато Индиго', desc: 'Конец пути. Здесь заседает Элитная Четверка.',
    image: 'https://archives.bulbagarden.net/media/upload/thumb/7/7b/Indigo_Plateau_FRLG.png/300px-Indigo_Plateau_FRLG.png',
    links: ['victory_road'], encounters: [], hasHeal: true
  }
};

let currentLocationId = 'pallet_town';

// --- EXISTING PROFILE DATA ---
const natures = [
  { name: 'Hardy (Твёрдый)', buff: null, nerf: null },
  { name: 'Lonely (Одинокий)', buff: 'atk', nerf: 'def' },
  { name: 'Brave (Отважный)', buff: 'atk', nerf: 'spe' },
  { name: 'Adamant (Непреклонный)', buff: 'atk', nerf: 'spa' },
  { name: 'Naughty (Шаловливый)', buff: 'atk', nerf: 'spd' },
  { name: 'Bold (Смелый)', buff: 'def', nerf: 'atk' },
  { name: 'Docile (Послушный)', buff: null, nerf: null },
  { name: 'Relaxed (Расслабленный)', buff: 'def', nerf: 'spe' },
  { name: 'Impish (Озорной)', buff: 'def', nerf: 'spa' },
  { name: 'Lax (Небрежный)', buff: 'def', nerf: 'spd' },
  { name: 'Timid (Робкий)', buff: 'spe', nerf: 'atk' },
  { name: 'Hasty (Поспешный)', buff: 'spe', nerf: 'def' },
  { name: 'Serious (Серьёзный)', buff: null, nerf: null },
  { name: 'Jolly (Весёлый)', buff: 'spe', nerf: 'spa' },
  { name: 'Naive (Наивный)', buff: 'spe', nerf: 'spd' },
  { name: 'Modest (Скромный)', buff: 'spa', nerf: 'atk' },
  { name: 'Mild (Мягкий)', buff: 'spa', nerf: 'def' },
  { name: 'Quiet (Тихий)', buff: 'spa', nerf: 'spe' },
  { name: 'Bashful (Застенчивый)', buff: null, nerf: null },
  { name: 'Rash (Опрометчивый)', buff: 'spa', nerf: 'spd' },
  { name: 'Calm (Спокойный)', buff: 'spd', nerf: 'atk' },
  { name: 'Gentle (Кроткий)', buff: 'spd', nerf: 'def' },
  { name: 'Sassy (Дерзкий)', buff: 'spd', nerf: 'spe' },
  { name: 'Careful (Осторожный)', buff: 'spd', nerf: 'spa' },
  { name: 'Quirky (Чудный)', buff: null, nerf: null },
];

const trainingStages = [
  { name: 'Отсутствует', pct: 0 },
  { name: 'Начальная', pct: 10 },
  { name: 'Расширенная', pct: 18 },
  { name: 'Мастерская', pct: 25 },
  { name: 'Знаменитая', pct: 31 },
  { name: 'Легендарная', pct: 36 },
  { name: 'Именная', pct: 40 }
];

// INVENTORY
let invPokeballs = 10;
let invPotion = 5;
let invCandy = 20;
let invVitamin = 20;
let invTrain = 50;
let invWeaken = 20;

// TEAM ROSTER (Max 6)
let myTeam = []; 

// ACTIVE POKEMON STATE
let currentPokemonIndex = null; 

// BATTLE STATE
let activeWild = null;
let wildLvl = 5;
let wildMaxHP = 0;
let wildCurHP = 0;
let escapeAttempts = 0;
let activePlayerMon = null; // Reference to myTeam[0] during battle
let playerMovesDetailed = []; // Full API data for player's 4 moves

const MAX_IV = 70;

document.addEventListener('DOMContentLoaded', async () => {
  initAppNav();
  
  // Grant Starter Groudon
  await giveStarter();
  
  renderLocation(currentLocationId);
  renderTeamGrid();
  updateInventoryDisplay();
  
  initProfileEvents();
  initEncounterEvents();
  initInventoryEvents();
  initProfileUXEvents();
});

// --- STARTER ---
async function giveStarter() {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/groudon`);
    const starterData = await res.json();
    const baseLevel = 50;
    const exp = Math.pow(baseLevel, 3);
    const expToNext = Math.pow(baseLevel + 1, 3);

    const newMon = {
      apiData: starterData,
      maxHp: 100, // Recalc below
      currentHp: 100,
      ivs: { hp: 30, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      baseLevel: baseLevel,
      exp: exp,
      expToNext: expToNext,
      candiesEaten: 0,
      vitaminsEaten: 0,
      training: null,
      trainingStage: 0,
      trainingStat: null,
      happiness: 70,
      natureIdx: 0,
      breedLetter: 'A'
    };
    
    // Calculate max HP
    const baseHp = starterData.stats[0].base_stat;
    const maxHp = Math.floor(0.01 * (2 * baseHp + newMon.ivs.hp + Math.floor(0.25 * newMon.evs.hp)) * newMon.baseLevel) + newMon.baseLevel + 10;
    newMon.currentHp = maxHp;
    newMon.maxHp = maxHp; // cache it

    myTeam.push(newMon);
  } catch (e) {
    console.error('Failed to give starter', e);
  }
}

// --- APP NAVIGATION ---
function initAppNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.app-view');
  const headerTitle = document.getElementById('header-title');

  const titles = {
    'view-world': 'Мир (Канто)',
    'view-backpack': 'Рюкзак',
    'view-team': 'Команда Покемонов'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active-view'));

      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active-view');
      headerTitle.innerText = titles[targetId];

      if (targetId === 'view-team') {
        renderTeamGrid();
        document.getElementById('team-roster').style.display = 'block';
        document.getElementById('pokedex-display').style.display = 'none';
      }
    });
  });

  document.getElementById('btn-back-team').addEventListener('click', () => {
    document.getElementById('pokedex-display').style.display = 'none';
    document.getElementById('team-roster').style.display = 'block';
    renderTeamGrid();
  });
}

// --- LOCATION ENGINE ---
function renderLocation(locId) {
  currentLocationId = locId;
  const loc = locations[locId];

  document.getElementById('loc-name').innerText = loc.name;
  document.getElementById('loc-desc').innerText = loc.desc;
  document.getElementById('loc-image').style.backgroundImage = `url('${loc.image}')`;

  const actionsContainer = document.getElementById('loc-actions');
  actionsContainer.innerHTML = '';

  if (loc.hasHeal) {
    const btnHeal = document.createElement('button');
    btnHeal.className = 'btn-use';
    btnHeal.style.backgroundColor = '#34c759';
    btnHeal.innerText = '🏥 Монстроцентр';
    btnHeal.onclick = () => {
      myTeam.forEach(mon => {
        const baseHp = mon.apiData.stats[0].base_stat;
        const curLvl = mon.baseLevel + mon.candiesEaten;
        mon.maxHp = Math.floor(0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl) + curLvl + 10;
        mon.currentHp = mon.maxHp;
      });
      alert('Ваша команда полностью вылечена!');
    };
    actionsContainer.appendChild(btnHeal);
  }

  if (loc.encounters.length > 0) {
    const btnHunt = document.createElement('button');
    btnHunt.className = 'btn-use';
    btnHunt.innerText = '🐾 Искать монстров';
    btnHunt.onclick = () => startHunt(loc.encounters);
    actionsContainer.appendChild(btnHunt);
  }

  const navContainer = document.getElementById('nav-buttons');
  navContainer.innerHTML = '';
  
  loc.links.forEach(linkId => {
    const linkLoc = locations[linkId];
    const btn = document.createElement('button');
    btn.className = 'btn-nav';
    btn.innerHTML = `<span>Идти в: ${linkLoc.name}</span> <span>➔</span>`;
    btn.onclick = () => renderLocation(linkId);
    navContainer.appendChild(btn);
  });
}

// --- BATTLE SYSTEM UTILS ---
const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

function getTypeMultiplier(attackType, defenderTypes) {
  if (!TYPE_CHART[attackType]) return 1;
  let multiplier = 1;
  defenderTypes.forEach(typeObj => {
    const defType = typeObj.type.name;
    if (TYPE_CHART[attackType][defType] !== undefined) {
      multiplier *= TYPE_CHART[attackType][defType];
    }
  });
  return multiplier;
}

function calculateStat(pokemon, statName, isWild) {
  const baseStats = isWild ? pokemon.stats : pokemon.apiData.stats;
  const statObj = baseStats.find(s => s.stat.name === statName);
  const base = statObj ? statObj.base_stat : 50;
  
  const level = isWild ? wildLvl : (pokemon.baseLevel + pokemon.candiesEaten);
  const mapName = { 'hp': 'hp', 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' }[statName] || 'hp';
  
  const iv = isWild ? (pokemon.wildIVs ? pokemon.wildIVs[mapName] : 15) : pokemon.ivs[mapName];
  const ev = isWild ? 0 : pokemon.evs[mapName];
  
  if (statName === 'hp') {
    return Math.floor(0.01 * (2 * base + iv + Math.floor(0.25 * ev)) * level) + level + 10;
  } else {
    return Math.floor((Math.floor((2 * base + iv + Math.floor(0.25 * ev)) * level / 100) + 5) * 1.0); // Nature = 1.0
  }
}

function appendToLog(text, clear = false) {
  const logEl = document.getElementById('battle-log');
  if (clear) {
    logEl.innerHTML = '';
  }
  const p = document.createElement('p');
  p.innerText = text;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

// --- BATTLE SYSTEM ---
async function startHunt(encountersArray) {
  const activeMonIndex = myTeam.findIndex(m => m.currentHp > 0);
  if (activeMonIndex === -1) {
    return alert('Вам нужен хотя бы один живой покемон для битвы!');
  }
  
  activePlayerMon = myTeam[activeMonIndex];
  
  const modal = document.getElementById('encounter-modal');
  const battleLog = document.getElementById('battle-log');
  
  // UI Reset
  document.getElementById('battle-main-menu').style.display = 'flex';
  document.getElementById('battle-end-menu').style.display = 'none';
  appendToLog('Ищем...', true);
  modal.style.display = 'flex';

  const pkmName = encountersArray[Math.floor(Math.random() * encountersArray.length)];

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pkmName}`);
    activeWild = await res.json();
    wildLvl = Math.floor(Math.random() * 11) + 5; // 5-15
    
    // Генерируем IV для дикого покемона
    activeWild.wildIVs = {
      hp: Math.floor(Math.random() * 32),
      atk: Math.floor(Math.random() * 32),
      def: Math.floor(Math.random() * 32),
      spa: Math.floor(Math.random() * 32),
      spd: Math.floor(Math.random() * 32),
      spe: Math.floor(Math.random() * 32)
    };
    
    wildMaxHP = calculateStat(activeWild, 'hp', true);
    wildCurHP = wildMaxHP;
    escapeAttempts = 0;

    // Wild Setup
    document.getElementById('wild-name').innerText = activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${wildLvl}`;
    const wildSpriteUrl = activeWild.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default || activeWild.sprites.front_default;
    document.getElementById('wild-sprite').src = wildSpriteUrl;
    updateWildHpUI();

    // Player Setup
    document.getElementById('player-name').innerText = activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = activePlayerMon.apiData.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default || activePlayerMon.apiData.sprites.front_default;
    document.getElementById('player-sprite').src = playerSpriteUrl;
    updatePlayerHpUI();

    battleLog.innerText = `Дикий ${activeWild.name.toUpperCase()} нападает!`;

    // Fetch Player Moves in background
    playerMovesDetailed = [];
    for (let i = 0; i < 4; i++) {
      if (activePlayerMon.apiData.moves[i]) {
        fetch(activePlayerMon.apiData.moves[i].move.url)
          .then(r => r.json())
          .then(d => { playerMovesDetailed[i] = d; });
        
        const mBtn = document.getElementById(`move-btn-${i}`);
        mBtn.innerText = activePlayerMon.apiData.moves[i].move.name;
        mBtn.classList.remove('disabled');
        mBtn.onclick = () => useMove(i);
      } else {
        const mBtn = document.getElementById(`move-btn-${i}`);
        mBtn.innerText = '-';
        mBtn.classList.add('disabled');
        mBtn.onclick = null;
      }
    }

  } catch (e) {
    battleLog.innerText = 'Ошибка загрузки...';
    setTimeout(() => { modal.style.display = 'none'; }, 1000);
  }
}

function updateWildHpUI() {
  document.getElementById('wild-hp-text').innerText = `${wildCurHP}/${wildMaxHP}`;
  const pct = Math.max(0, (wildCurHP / wildMaxHP) * 100);
  const bar = document.getElementById('wild-hp-fill');
  bar.style.width = `${pct}%`;
  bar.className = 'reborn-hp-fill';
  if (pct <= 20) bar.classList.add('hp-low');
  else if (pct <= 50) bar.classList.add('hp-medium');
}

function updatePlayerHpUI() {
  document.getElementById('player-hp-text').innerText = `${activePlayerMon.currentHp}/${activePlayerMon.maxHp}`;
  const pct = Math.max(0, (activePlayerMon.currentHp / activePlayerMon.maxHp) * 100);
  const bar = document.getElementById('player-hp-fill');
  bar.style.width = `${pct}%`;
  bar.className = 'reborn-hp-fill';
  if (pct <= 20) bar.classList.add('hp-low');
  else if (pct <= 50) bar.classList.add('hp-medium');

  const expToCurrent = Math.pow(activePlayerMon.baseLevel, 3);
  const expToNext = activePlayerMon.expToNext || Math.pow(activePlayerMon.baseLevel + 1, 3);
  let expPct = ((activePlayerMon.exp - expToCurrent) / (expToNext - expToCurrent)) * 100;
  if (expPct < 0) expPct = 0;
  if (expPct > 100) expPct = 100;
  
  const expFill = document.getElementById('player-exp-fill');
  if (expFill) expFill.style.width = `${expPct}%`;
}

function useMove(moveIndex) {
  const move = playerMovesDetailed[moveIndex];
  if (!move) return;
  
  const log = document.getElementById('battle-log');
  appendToLog(`${activePlayerMon.apiData.name} использует ${move.name}!`);

  const power = move.power;
  if (!power) {
    // Статусная атака (пока заглушка)
    appendToLog('Но ничего не произошло...');
  } else {
    // Настоящая формула урона Лиги
    const isPhysical = move.damage_class.name === 'physical';
    const attackStat = isPhysical ? 'attack' : 'special-attack';
    const defenseStat = isPhysical ? 'defense' : 'special-defense';
    
    const A = calculateStat(activePlayerMon, attackStat, false);
    const D = calculateStat(activeWild, defenseStat, true);
    
    const curLvl = activePlayerMon.baseLevel + activePlayerMon.candiesEaten;
    let baseDmg = Math.floor((((2 * curLvl / 5 + 2) * power * (A / D)) / 50) + 2);
    
    // STAB
    let stab = 1.0;
    activePlayerMon.apiData.types.forEach(t => {
      if (t.type.name === move.type.name) stab = 1.5;
    });
    
    // Type Effectiveness
    const typeMult = getTypeMultiplier(move.type.name, activeWild.types);
    const randMod = 0.85 + Math.random() * 0.15;
    
    let dmg = Math.floor(baseDmg * stab * typeMult * randMod);
    
    wildCurHP -= dmg;
    if (wildCurHP < 0) wildCurHP = 0;
    updateWildHpUI();
    
    // Сообщения об эффективности
    if (typeMult > 1) {
      appendToLog('Это суперэффективно!');
    } else if (typeMult < 1 && typeMult > 0) {
      appendToLog('Это малоэффективно...');
    } else if (typeMult === 0) {
      appendToLog('Атака не возымела эффекта...');
    }
  }

  // Hide main menu
  document.getElementById('battle-main-menu').style.display = 'none';
  
  if (wildCurHP === 0) {
    appendToLog(`Дикий ${activeWild.name} побежден!`);
    invCandy++; // Reward
    
    const baseExp = activeWild.base_experience || 50;
    const expGain = Math.floor((baseExp * wildLvl) / 7);
    
    if (activePlayerMon.exp === undefined) {
      activePlayerMon.exp = Math.pow(activePlayerMon.baseLevel, 3);
      activePlayerMon.expToNext = Math.pow(activePlayerMon.baseLevel + 1, 3);
    }
    
    activePlayerMon.exp += expGain;
    appendToLog(`${activePlayerMon.apiData.name} получил ${expGain} EXP!`);
    
    while (activePlayerMon.exp >= activePlayerMon.expToNext && activePlayerMon.baseLevel < 100) {
      activePlayerMon.baseLevel++;
      activePlayerMon.expToNext = Math.pow(activePlayerMon.baseLevel + 1, 3);
      
      const oldMax = activePlayerMon.maxHp;
      const newMax = calculateStat(activePlayerMon, 'hp', false);
      activePlayerMon.maxHp = newMax;
      activePlayerMon.currentHp += (newMax - oldMax);
      
      appendToLog(`${activePlayerMon.apiData.name} достиг ${activePlayerMon.baseLevel} уровня!`);
    }
    
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
  } else {
    // Enemy Turn
    setTimeout(() => { enemyTurn(); }, 1000);
  }
}

function enemyTurn() {
  const log = document.getElementById('battle-log');
  appendToLog(`Дикий ${activeWild.name} атакует!`);

  // У диких покемонов мы пока не загружаем move set, поэтому берем случайную атаку
  const power = 30 + Math.floor(Math.random() * 30); // 30-60 power
  const isPhysical = Math.random() > 0.5;
  const attackStat = isPhysical ? 'attack' : 'special-attack';
  const defenseStat = isPhysical ? 'defense' : 'special-defense';
  
  const A = calculateStat(activeWild, attackStat, true);
  const D = calculateStat(activePlayerMon, defenseStat, false);
  
  let baseDmg = Math.floor((((2 * wildLvl / 5 + 2) * power * (A / D)) / 50) + 2);
  let dmg = Math.floor(baseDmg * (0.85 + Math.random() * 0.15));

  activePlayerMon.currentHp -= dmg;
  if (activePlayerMon.currentHp < 0) activePlayerMon.currentHp = 0;
  updatePlayerHpUI();
  if (activePlayerMon.currentHp === 0) {
    appendToLog(`${activePlayerMon.apiData.name} потерял сознание! Вы проиграли.`);
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
  } else {
    setTimeout(() => {
      
      document.getElementById('battle-main-menu').style.display = 'flex';
    }, 1000);
  }
}

function initEncounterEvents() {
  document.getElementById('btn-run').addEventListener('click', () => {
    escapeAttempts++;
    const playerSpeed = calculateStat(activePlayerMon, 'speed', false);
    const wildSpeed = calculateStat(activeWild, 'speed', true);
    
    // Формула побега Лиги 17 (Оригинал Покемонов)
    let F = Math.floor((playerSpeed * 128 / wildSpeed) + 30 * escapeAttempts);
    
    if (F > 255 || Math.floor(Math.random() * 256) < F) {
      appendToLog('Вам удалось сбежать!');
      setTimeout(() => { document.getElementById('encounter-modal').style.display = 'none'; }, 1000);
    } else {
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog('Не удалось сбежать!');
      setTimeout(() => { enemyTurn(); }, 1500);
    }
  });

  document.getElementById('btn-use-item').addEventListener('click', () => {
    const item = document.getElementById('battle-item-select').value;
    
    if (item === 'pokeball') {
      if (invPokeballs <= 0) return alert('У вас нет Монстроболов!');
      if (myTeam.length >= 6) return alert('Ваша команда переполнена (Максимум 6 покемонов)!');

      invPokeballs--;
      updateInventoryDisplay();

      const hpPct = wildCurHP / wildMaxHP;
      let catchChance = 0.1;
      if (hpPct < 0.5) catchChance = 0.3;
      if (hpPct < 0.2) catchChance = 0.6;

      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы бросили Монстробол...`);

      setTimeout(() => {
        if (Math.random() < catchChance) {
          appendToLog(`Попался! ${activeWild.name.toUpperCase()} пойман!`);
          
          const newMon = {
            apiData: activeWild,
            maxHp: wildMaxHP,
            currentHp: wildCurHP,
            ivs: activeWild.wildIVs,
            evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            baseLevel: wildLvl,
            exp: Math.pow(wildLvl, 3),
            expToNext: Math.pow(wildLvl + 1, 3),
            candiesEaten: 0,
            vitaminsEaten: 0,
            training: null,
            trainingStage: 0,
            trainingStat: null,
            happiness: 70,
            natureIdx: Math.floor(Math.random() * natures.length),
            breedLetter: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]
          };

          myTeam.push(newMon);
          
          document.getElementById('battle-main-menu').style.display = 'none';
          document.getElementById('battle-end-menu').style.display = 'flex';
        } else {
          appendToLog(`${activeWild.name.toUpperCase()} вырвался!`);
          setTimeout(() => { enemyTurn(); }, 1500);
        }
      }, 1000);

    } else if (item === 'potion') {
      if (invPotion <= 0) return alert('У вас нет Аптечек!');
      if (activePlayerMon.currentHp >= activePlayerMon.maxHp) return alert('Здоровье уже полное!');

      invPotion--;
      updateInventoryDisplay();
      
      activePlayerMon.currentHp += 20;
      if (activePlayerMon.currentHp > activePlayerMon.maxHp) activePlayerMon.currentHp = activePlayerMon.maxHp;
      updatePlayerHpUI();

      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали Аптечку! Здоровье ${activePlayerMon.apiData.name} восстановлено.`);
      
      setTimeout(() => { enemyTurn(); }, 1500);
    }
  });

  document.getElementById('btn-leave-battle').addEventListener('click', () => {
    document.getElementById('encounter-modal').style.display = 'none';
  });
}

// --- TEAM ROSTER ---
function renderTeamGrid() {
  document.getElementById('team-count').innerText = `(${myTeam.length}/6)`;
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';

  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    if (i < myTeam.length) {
      const mon = myTeam[i];
      const curLvl = mon.baseLevel + mon.candiesEaten;
      slot.className = 'team-slot';
      slot.innerHTML = `
        <img src="${mon.apiData.sprites.front_default}" alt="sprite">
        <div class="slot-name">${mon.apiData.name}</div>
        <div class="slot-lvl">Lvl ${curLvl} | ${mon.currentHp}/${mon.maxHp} HP</div>
      `;
      slot.onclick = () => openPokemonProfile(i);
    } else {
      slot.className = 'team-slot empty';
      slot.innerText = 'Пустой слот';
    }
    grid.appendChild(slot);
  }
}

// --- POKEMON PROFILE ---
function openPokemonProfile(index) {
  currentPokemonIndex = index;
  refreshProfileUI();

  document.getElementById('team-roster').style.display = 'none';
  document.getElementById('pokedex-display').style.display = 'flex';
}

function refreshProfileUI() {
  if (currentPokemonIndex === null) return;
  const mon = myTeam[currentPokemonIndex];
  
  const curLvl = mon.baseLevel + mon.candiesEaten;

  document.getElementById('poke-name').innerText = `${mon.apiData.name} #${mon.apiData.id}`;
  const animSprite = mon.apiData?.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default
    || mon.apiData?.sprites?.front_default
    || '';
  document.getElementById('poke-sprite').src = animSprite;
  
  const typesHtml = mon.apiData.types.map(t => `<span class="type-badge" style="background-color: ${getTypeColor(t.type.name)}">${t.type.name}</span>`).join('');
  document.getElementById('poke-types').innerHTML = typesHtml;

  const ability = mon.apiData.abilities.length > 0 ? mon.apiData.abilities[0].ability.name : 'Unknown';
  document.getElementById('info-ability').innerText = ability.charAt(0).toUpperCase() + ability.slice(1);
  const tera = mon.apiData.types[0].type.name;
  document.getElementById('info-tera').innerText = tera.charAt(0).toUpperCase() + tera.slice(1);

  document.getElementById('info-cur-hp').innerText = mon.currentHp;
  document.getElementById('info-max-hp').innerText = mon.maxHp;

  for(let i=0; i<4; i++) {
    if(mon.apiData.moves[i]) {
      document.getElementById(`move-${i}-name`).innerText = mon.apiData.moves[i].move.name;
      document.getElementById(`move-${i}-pp`).innerText = `PP 30/30`;
    } else {
      document.getElementById(`move-${i}-name`).innerText = '-';
      document.getElementById(`move-${i}-pp`).innerText = `PP 0/0`;
    }
  }

  document.getElementById('info-lvl').innerText = curLvl;
  document.getElementById('stat-lvl-display').innerText = curLvl;
  document.getElementById('stat-vit-display').innerText = `${mon.vitaminsEaten}/10`;
  
  document.getElementById('iv-hp').value = mon.ivs.hp;
  document.getElementById('iv-atk').value = mon.ivs.atk;
  document.getElementById('iv-def').value = mon.ivs.def;
  document.getElementById('iv-spa').value = mon.ivs.spa;
  document.getElementById('iv-spd').value = mon.ivs.spd;
  document.getElementById('iv-spe').value = mon.ivs.spe;

  document.getElementById('ev-hp').value = mon.evs.hp;
  document.getElementById('ev-atk').value = mon.evs.atk;
  document.getElementById('ev-def').value = mon.evs.def;
  document.getElementById('ev-spa').value = mon.evs.spa;
  document.getElementById('ev-spd').value = mon.evs.spd;
  document.getElementById('ev-spe').value = mon.evs.spe;

  updateTrainingUI_Profile(mon);
  updateHappinessUI_Profile(mon);
  updateGenecodeDisplay_Profile(mon);
  
  updateDynamicEVs();
  updateStats();
}

// ... keeping rest identical down to end
function updateTrainingUI_Profile(mon) {
  const stageName = trainingStages[mon.trainingStage].name;
  const pct = trainingStages[mon.trainingStage].pct;
  
  document.getElementById('train-stage').innerText = stageName;
  document.getElementById('train-pct').innerText = pct > 0 ? `(+${pct}%)` : '';
  
  const statNames = { 'atk': 'Атака', 'def': 'Защита', 'spa': 'Сп.Атака', 'spd': 'Сп.Защита', 'spe': 'Скорость' };
  document.getElementById('train-stat').innerText = mon.trainingStat ? `(${statNames[mon.trainingStat]})` : '';
}

function updateHappinessUI_Profile(mon) {
  document.getElementById('status-happiness').innerText = mon.happiness;
  const baseCrit = 7.0;
  const maxCrit = 11.0;
  const currentCrit = baseCrit + ((mon.happiness / 255) * (maxCrit - baseCrit));
  document.getElementById('info-crit').innerText = `${currentCrit.toFixed(1)}%`;
}

function updateGenecodeDisplay_Profile(mon) {
  const vitStr = (mon.vitaminsEaten > 0) ? `.${mon.vitaminsEaten*10}` : '.0';
  const genecodeStr = `h${mon.ivs.hp}a${mon.ivs.atk}d${mon.ivs.def}s${mon.ivs.spe}sa${mon.ivs.spa}sd${mon.ivs.spd}${vitStr}${mon.breedLetter}`;
  document.getElementById('info-genecode').innerText = genecodeStr;
}

function saveActiveMonData() {
  if (currentPokemonIndex === null) return;
  const mon = myTeam[currentPokemonIndex];
  
  mon.evs.hp = parseInt(document.getElementById('ev-hp').value) || 0;
  mon.evs.atk = parseInt(document.getElementById('ev-atk').value) || 0;
  mon.evs.def = parseInt(document.getElementById('ev-def').value) || 0;
  mon.evs.spa = parseInt(document.getElementById('ev-spa').value) || 0;
  mon.evs.spd = parseInt(document.getElementById('ev-spd').value) || 0;
  mon.evs.spe = parseInt(document.getElementById('ev-spe').value) || 0;

  // MaxHp needs recalc if EV HP changed
  const baseHp = mon.apiData.stats[0].base_stat;
  const curLvl = mon.baseLevel + mon.candiesEaten;
  mon.maxHp = Math.floor(0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl) + curLvl + 10;
  if (mon.currentHp > mon.maxHp) mon.currentHp = mon.maxHp;
  document.getElementById('info-max-hp').innerText = mon.maxHp;
  document.getElementById('info-cur-hp').innerText = mon.currentHp;
}

function initProfileEvents() {
  const evInputs = document.querySelectorAll('.reborn-input-ev');
  evInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      let val = parseInt(e.target.value) || 0;
      if (val < 0) val = 0;
      if (val > 126) val = 126; 
      e.target.value = val;
      
      saveActiveMonData();
      updateDynamicEVs(e.target);
      updateStats();
    });
  });
}

function initInventoryEvents() {
  document.getElementById('btn-use-potion-out').addEventListener('click', () => {
    if (currentPokemonIndex === null) return alert('Сначала выберите покемона во вкладке "Команда"!');
    if (invPotion <= 0) return alert('Нет Аптечек!');
    
    const mon = myTeam[currentPokemonIndex];
    if (mon.currentHp >= mon.maxHp) return alert('Здоровье уже полное!');

    invPotion--;
    mon.currentHp += 20;
    if (mon.currentHp > mon.maxHp) mon.currentHp = mon.maxHp;

    updateInventoryDisplay();
    refreshProfileUI();
    alert(`Вы использовали Аптечку. Здоровье ${mon.apiData.name} восстановлено!`);
  });
  document.getElementById('btn-use-candy').addEventListener('click', () => {
    if (currentPokemonIndex === null) return alert('Сначала откройте профиль покемона во вкладке "Команда"!');
    if (invCandy <= 0) return alert('Нет Сладких Конфет!');
    
    const mon = myTeam[currentPokemonIndex];
    if (mon.baseLevel + mon.candiesEaten >= 100) return alert('Достигнут максимальный 100 уровень!');

    invCandy--;
    mon.candiesEaten++;
    mon.happiness += 2;
    if (mon.happiness > 255) mon.happiness = 255;

    // Recalc max HP
    const baseHp = mon.apiData.stats[0].base_stat;
    const curLvl = mon.baseLevel + mon.candiesEaten;
    const oldMax = mon.maxHp;
    mon.maxHp = Math.floor(0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl) + curLvl + 10;
    mon.currentHp += (mon.maxHp - oldMax); // Give HP gained by level up

    updateInventoryDisplay();
    refreshProfileUI();
    alert(`Вы скормили Сладкую Конфету! Уровень повышен до ${curLvl}.`);
  });

  document.getElementById('btn-use-vitamin').addEventListener('click', () => {
    if (currentPokemonIndex === null) return alert('Сначала откройте профиль покемона во вкладке "Команда"!');
    if (invVitamin <= 0) return alert('Нет Витаминов!');

    const mon = myTeam[currentPokemonIndex];
    if (mon.vitaminsEaten >= 10) return alert('Этот покемон уже съел максимум 10 витаминов!');

    invVitamin--;
    mon.vitaminsEaten++;
    mon.happiness += 5;
    if (mon.happiness > 255) mon.happiness = 255;

    updateInventoryDisplay();
    refreshProfileUI();
    alert(`Вы скормили Витамин! Доступно +10 EV.`);
  });

  document.getElementById('btn-use-train').addEventListener('click', () => {
    if (currentPokemonIndex === null) return alert('Сначала откройте профиль покемона во вкладке "Команда"!');
    const mon = myTeam[currentPokemonIndex];

    if (invTrain <= 0) return alert('Нет Наборов Тренировки!');
    if (mon.trainingStage >= 6) return alert('Тренировка уже на Именной стадии!');
    
    invTrain--;
    updateInventoryDisplay();

    const chances = [1.0, 0.8, 0.5, 0.3, 0.15, 0.05]; 
    if (Math.random() > chances[mon.trainingStage]) {
      return alert(`Тренировка не удалась! Набор потрачен.`);
    }

    const trainableStats = ['atk', 'def', 'spa', 'spd', 'spe'];
    mon.trainingStat = trainableStats[Math.floor(Math.random() * trainableStats.length)];
    mon.trainingStage++;
    mon.happiness += 10;
    if (mon.happiness > 255) mon.happiness = 255;

    refreshProfileUI();
    alert(`Успешно! Теперь это ${trainingStages[mon.trainingStage].name} тренировка!`);
  });

  document.getElementById('btn-use-weaken').addEventListener('click', () => {
    if (currentPokemonIndex === null) return alert('Сначала откройте профиль покемона во вкладке "Команда"!');
    const mon = myTeam[currentPokemonIndex];

    if (invWeaken <= 0) return alert('Нет Наборов Ослабления!');
    if (mon.trainingStage === 0) return alert('Монстр ещё не тренирован!');

    invWeaken--;
    updateInventoryDisplay();

    mon.trainingStage--;
    if (mon.trainingStage === 0) mon.trainingStat = null;
    
    refreshProfileUI();
  });
}

function updateDynamicEVs(changedInput = null) {
  if (currentPokemonIndex === null) return;
  const mon = myTeam[currentPokemonIndex];

  const maxTotalEV = (mon.candiesEaten * 4) + (mon.vitaminsEaten * 10);
  document.getElementById('ev-total').innerText = maxTotalEV;

  const evInputs = document.querySelectorAll('.reborn-input-ev');
  let currentTotal = 0;
  evInputs.forEach(input => currentTotal += parseInt(input.value) || 0);

  if (currentTotal > maxTotalEV) {
    let diff = currentTotal - maxTotalEV;
    if (changedInput && parseInt(changedInput.value) >= diff) {
      changedInput.value = parseInt(changedInput.value) - diff;
      currentTotal -= diff;
    } else {
      document.querySelectorAll('.reborn-input-ev').forEach(input => {
        let val = parseInt(input.value) || 0;
        if (val > 0 && diff > 0) {
          let toSubtract = Math.min(val, diff);
          input.value = val - toSubtract;
          diff -= toSubtract;
          currentTotal -= toSubtract;
        }
      });
    }
    saveActiveMonData();
  }

  document.getElementById('ev-remaining').innerText = maxTotalEV - currentTotal;
}

function updateStats() {
  if (currentPokemonIndex === null) return;
  const mon = myTeam[currentPokemonIndex];
  
  const activeNature = natures[mon.natureIdx];
  document.getElementById('info-nature').innerText = activeNature.name.split(' ')[1].replace(/[()]/g, '');

  const statsMapping = {
    'hp': { idx: 0, el: 'hp' },
    'attack': { idx: 1, el: 'atk' },
    'defense': { idx: 2, el: 'def' },
    'special-attack': { idx: 3, el: 'spa' },
    'special-defense': { idx: 4, el: 'spd' },
    'speed': { idx: 5, el: 'spe' }
  };

  const trainPct = trainingStages[mon.trainingStage].pct / 100;
  const curLvl = mon.baseLevel + mon.candiesEaten;

  for (const [statName, info] of Object.entries(statsMapping)) {
    const baseStat = mon.apiData.stats[info.idx].base_stat;
    const ev = mon.evs[info.el];
    const iv = mon.ivs[info.el];
    
    let natureMod = 1.0;
    let isTrained = false;

    const labelEl = document.getElementById(`label-${info.el}`);
    if (labelEl) {
      labelEl.className = 'stat-name'; 
      if (activeNature.buff === info.el) {
        natureMod = 1.1;
        labelEl.classList.add('nature-buff');
      } else if (activeNature.nerf === info.el) {
        natureMod = 0.9;
        labelEl.classList.add('nature-nerf');
      }

      if (mon.trainingStat === info.el) {
        isTrained = true;
      }
    }

    let finalStat = 0;
    if (statName === 'hp') {
      finalStat = Math.floor(0.01 * (2 * baseStat + iv + Math.floor(0.25 * ev)) * curLvl) + curLvl + 10;
    } else {
      finalStat = Math.floor(Math.floor(0.01 * (2 * baseStat + iv + Math.floor(0.25 * ev)) * curLvl) + 5);
      finalStat = Math.floor(finalStat * natureMod);
      
      if (isTrained) {
        finalStat = Math.floor(finalStat * (1 + trainPct));
      }
    }

    document.getElementById(`val-${info.el}`).innerText = finalStat;
    
    const valEl = document.getElementById(`val-${info.el}`);
    if (valEl) {
      if (isTrained) {
        valEl.style.color = '#34c759'; // Зеленый для тренированного
        valEl.title = 'Натренировано';
      } else {
        valEl.style.color = '';
        valEl.title = '';
      }
    }
  }
}

function updateInventoryDisplay() {
  document.getElementById('qty-pokeball').innerText = invPokeballs;
  const catchQtyEl = document.getElementById('btn-catch-qty');
  if (catchQtyEl) catchQtyEl.innerText = invPokeballs;
  
  const qtyPotionEl = document.getElementById('qty-potion');
  if (qtyPotionEl) qtyPotionEl.innerText = invPotion;

  document.getElementById('qty-candy').innerText = invCandy;
  document.getElementById('qty-vitamin').innerText = invVitamin;
  document.getElementById('qty-train').innerText = invTrain;
  document.getElementById('qty-weaken').innerText = invWeaken;

  const battleQtyPokeballs = document.getElementById('battle-qty-pokeballs');
  if (battleQtyPokeballs) {
    battleQtyPokeballs.innerText = invPokeballs;
    document.getElementById('battle-qty-potions').innerText = invPotion;
  }

  // Update Quick Actions in Profile
  if (document.getElementById('qa-qty-potion')) {
    document.getElementById('qa-qty-potion').innerText = invPotion;
    document.getElementById('qa-qty-candy').innerText = invCandy;
    document.getElementById('qa-qty-vitamin').innerText = invVitamin;
    document.getElementById('qa-qty-train').innerText = invTrain;
    document.getElementById('qa-qty-weaken').innerText = invWeaken;
  }
}

function getTypeColor(type) {
  const colors = {
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
    ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
    rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705898',
    steel: '#B7B7CE', fairy: '#D685AD'
  };
  return colors[type] || '#777';
}

// --- NEW PROFILE UX LOGIC ---
function initProfileUXEvents() {
  // 1. Navigation Arrows
  document.getElementById('btn-prev-mon').addEventListener('click', () => {
    if (currentPokemonIndex !== null && myTeam.length > 0) {
      currentPokemonIndex = (currentPokemonIndex - 1 + myTeam.length) % myTeam.length;
      openPokemonProfile(currentPokemonIndex);
    }
  });
  document.getElementById('btn-next-mon').addEventListener('click', () => {
    if (currentPokemonIndex !== null && myTeam.length > 0) {
      currentPokemonIndex = (currentPokemonIndex + 1) % myTeam.length;
      openPokemonProfile(currentPokemonIndex);
    }
  });

  // 2. Quick Actions (Proxy clicks to inventory buttons)
  document.getElementById('qa-potion').addEventListener('click', () => document.getElementById('btn-use-potion-out').click());
  document.getElementById('qa-candy').addEventListener('click', () => document.getElementById('btn-use-candy').click());
  document.getElementById('qa-vitamin').addEventListener('click', () => document.getElementById('btn-use-vitamin').click());
  document.getElementById('qa-train').addEventListener('click', () => document.getElementById('btn-use-train').click());
  document.getElementById('qa-weaken').addEventListener('click', () => document.getElementById('btn-use-weaken').click());

  // 3. Quick EV Buttons
  document.querySelectorAll('.reborn-ev-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (currentPokemonIndex === null) return;
      const mon = myTeam[currentPokemonIndex];
      const stat = e.target.getAttribute('data-stat');
      const valStr = e.target.getAttribute('data-val');
      
      let totalEVs = Object.values(mon.evs).reduce((a, b) => a + b, 0);
      let maxTotal = (mon.candiesEaten * 4) + (mon.vitaminsEaten * 10);
      
      let currentEV = mon.evs[stat];
      let toAdd = 0;
      
      if (valStr === 'max') {
        toAdd = Math.min(126 - currentEV, maxTotal - totalEVs);
      } else {
        toAdd = parseInt(valStr);
        if (currentEV + toAdd > 126) toAdd = 126 - currentEV;
        if (totalEVs + toAdd > maxTotal) toAdd = maxTotal - totalEVs;
      }
      
      if (toAdd > 0) {
        mon.evs[stat] += toAdd;
        refreshProfileUI();
      } else {
        alert('Нет свободных EV! Дайте покемону Конфеты (+4 EV) или Витамины (+10 EV).');
      }
    });
  });
}
