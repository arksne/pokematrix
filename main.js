import { io } from 'socket.io-client';

window.onerror = function(msg, src, line, col, err) {
  document.body.innerHTML += '<div style="position:fixed;top:0;left:0;right:0;background:#ff3b30;color:#fff;padding:10px;z-index:99999;font-size:12px;white-space:pre-wrap"><b>JS ERROR:</b> ' + msg + '<br>at ' + src + ':' + line + ':' + col + '</div>';
  console.error(msg, err);
};

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// --- GAME DATA (REGIONS & LOCATIONS) ---
// --- GAME DATA (REGIONS & LOCATIONS) ---
// Based on wiki.league17.ru structure
const REGIONS = {
  kanto: {
    name: 'Канто',
    locations: {
      'pallet_town': {
        name: 'Алабастия (Pallet Town)', desc: 'Тихий городок на юге Канто. Здесь живёт профессор Оук — ведущий специалист по покемонам.',
        image: 'wiki_images/Vermilion.jpg', links: ['route_1', 'route_21'], encounters: [{ id: 'mel_albert_0', type: 'collect_items', targetItem: 'magnemiteNut', targetQty: 2, desc: 'Принесите 2 магнитные гайки для Альберта', rewardMoney: 500, rewardItem: 'superPotion', rewardQty: 2, prereqQuest: null }], hasHeal: true, hasWater: true, region: 'kanto'
      },
      'route_1': {
        name: 'Маршрут 1', desc: 'Первый маршрут тренера — дорога между Алабастией и Виридианом.',
        image: 'wiki_images/generic_route.png', links: ['pallet_town', 'viridian_city'], encounters: ['pidgey', 'rattata'], hasHeal: false, region: 'kanto'
      },
      'viridian_city': {
        name: 'Виридиан', desc: 'Город вечной зелени. Знаменит статуей Виридианского покемона.',
        image: '', links: ['route_1', 'route_2', 'route_22', 'viridian_stadium'], encounters: [], hasHeal: true, region: 'kanto'
      },
      'viridian_stadium': {
        name: 'Земляной Стадион', desc: 'Арена земляных покемонов Джованни.',
        image: '', links: ['viridian_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'route_22': {
        name: 'Маршрут 22', desc: 'Обходная дорога к Плато Индиго через Дорогу Победы.',
        image: 'wiki_images/generic_route.png', links: ['viridian_city', 'victory_road'], encounters: ['mankey', 'spearow', 'rattata'], hasHeal: false, region: 'kanto'
      },
      'route_2': {
        name: 'Маршрут 2', desc: 'Дорога через лес, ведущая в Виридианский Лес и Пещеру Диглеттов.',
        image: 'wiki_images/Doroga_2.jpg', links: ['viridian_city', 'viridian_forest', 'diglett_cave'], encounters: ['caterpie', 'weedle', 'pidgey'], hasHeal: false, region: 'kanto'
      },
      'viridian_forest': {
        name: 'Виридианский Лес', desc: 'Густой лес полный насекомых-покемонов. Естественный лабиринт для новичков.',
        image: 'wiki_images/generic_route.png', links: ['route_2', 'pewter_city'], encounters: ['caterpie', 'metapod', 'weedle', 'kakuna', 'pikachu'], hasHeal: false, region: 'kanto'
      },
      'pewter_city': {
        name: 'Пьютер', desc: 'Каменный город у подножия гор. Здесь находится музей ископаемых.',
        image: '', links: ['viridian_forest', 'route_3', 'pewter_stadium'], encounters: [], hasHeal: true, region: 'kanto'
      },
      'pewter_stadium': {
        name: 'Каменный Стадион', desc: 'Арена каменных покемонов Брока.',
        image: '', links: ['pewter_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'route_3': {
        name: 'Маршрут 3', desc: 'Горная тропа ведущая к Лунной Горе. Популярна у тренеров-альпинистов.',
        image: 'wiki_images/generic_route.png', links: ['pewter_city', 'mt_moon'], encounters: ['spearow', 'jigglypuff', 'nidoran-f', 'nidoran-m'], hasHeal: false, region: 'kanto'
      },
      'mt_moon': {
        name: 'Лунная Гора (Mt. Moon)', desc: 'Огромная пещера известная метеоритными дождями. Здесь обитают редкие Клефейри.',
        image: 'wiki_images/generic_route.png', links: ['route_3', 'route_4'], encounters: ['zubat', 'geodude', 'clefairy', 'paras'], hasHeal: false, hasWater: false, region: 'kanto'
      },
      'route_4': {
        name: 'Маршрут 4', desc: 'Крутой спуск с Лунной Горы к Церулину. Живописный вид на залив.',
        image: 'wiki_images/generic_route.png', links: ['mt_moon', 'cerulean_city'], encounters: ['rattata', 'spearow', 'ekans', 'sandshrew'], hasHeal: false, region: 'kanto'
      },
      'cerulean_city': {
        name: 'Церулин', desc: 'Водный город с знаменитым фонтаном. Здесь тренирует Мисти — мастер водных покемонов.',
        image: 'wiki_images/Serulin.jpeg', links: ['route_4', 'route_24', 'route_5', 'route_9', 'cerulean_pokecenter', 'cerulean_pokemarket', 'cerulean_bike_shop', 'cerulean_cafe_rain', 'cerulean_tavern', 'cerulean_stadium'], encounters: [], hasHeal: true, hasWater: true, region: 'kanto'
      },
      'cerulean_stadium': {
        name: 'Водный Стадион', desc: 'Арена водных покемонов Мисти.',
        image: '', links: ['cerulean_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'cerulean_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Церулине.',
        image: '', links: ['cerulean_city'], encounters: [],
        hasHeal: true, hasWater: false, region: 'kanto'
      },
      'cerulean_pokemarket': {
        name: 'Покемаркет', desc: 'Магазин товаров для тренеров.',
        image: '', links: ['cerulean_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'cerulean_bike_shop': {
        name: 'Веломагазин', desc: 'Магазин велосипедов.',
        image: '', links: ['cerulean_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'cerulean_cafe_rain': {
        name: 'Кафе «Rain»', desc: 'Уютное кафе в центре Церулина.',
        image: '', links: ['cerulean_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'cerulean_tavern': {
        name: 'Таверна', desc: 'Старая таверна Церулина.',
        image: '', links: ['cerulean_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'route_24': {
        name: 'Маршрут 24', desc: 'Живописный мост через реку. Знаменит тренерами-самородками.',
        image: 'wiki_images/generic_route.png', links: ['cerulean_city', 'route_25'], encounters: ['weedle', 'caterpie', 'abra', 'bellsprout'], hasHeal: false, region: 'kanto'
      },
      'route_25': {
        name: 'Маршрут 25', desc: 'Тупиковая дорога к мысу, где живёт исследователь Билл.',
        image: 'wiki_images/generic_route.png', links: ['route_24'], encounters: ['pidgey', 'oddish', 'venonat'], hasHeal: false, region: 'kanto'
      },
      'route_5': {
        name: 'Маршрут 5', desc: 'Короткая дорога от Церулина до мегаполиса Шаффран.',
        image: 'wiki_images/generic_route.png', links: ['cerulean_city', 'saffron'], encounters: ['meowth', 'mankey', 'pidgey'], hasHeal: false, region: 'kanto'
      },
      'saffron': {
        name: 'Шаффран', desc: 'Крупнейший мегаполис Канто. Здесь базируется штаб-квартира Лиги 17 и Академия Голденрода.',
        image: 'wiki_images/Vostochnyj_Shaffran.jpg', links: ['route_5', 'route_6', 'route_7', 'route_8', 'saffron_west_pokemarket', 'saffron_psychic_stadium', 'saffron_needle_house', 'saffron_swot_lab', 'saffron_east_station', 'saffron_east_pokecenter', 'saffron_silph_co'], encounters: [], hasHeal: true, region: 'kanto'
      },
      'saffron_west_pokemarket': {
        name: 'Покемаркет (Западный)', desc: 'Магазин в западной части Шаффрана.',
        image: '', links: ['saffron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'saffron_psychic_stadium': {
        name: 'Психический Стадион', desc: 'Арена психических покемонов Сабрины.',
        image: '', links: ['saffron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'saffron_needle_house': {
        name: 'Дом с иглой', desc: 'Загадочный дом в Западном Шаффране.',
        image: '', links: ['saffron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'saffron_swot_lab': {
        name: 'Лаборатория Свота', desc: 'Исследовательская лаборатория.',
        image: '', links: ['saffron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'saffron_east_station': {
        name: 'Вокзал (Восточный)', desc: 'Железнодорожный вокзал.',
        image: '', links: ['saffron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'saffron_east_pokecenter': {
        name: 'Покецентр (Восточный)', desc: 'Центр лечения в восточном Шаффране.',
        image: '', links: ['saffron'], encounters: [],
        hasHeal: true, hasWater: false, region: 'kanto'
      },
      'saffron_silph_co': {
        name: 'Силф Ко', desc: 'Штаб-квартира корпорации Силф.',
        image: '', links: ['saffron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'route_6': {
        name: 'Маршрут 6', desc: 'Южная дорога от Шаффрана к портовому Вермилиону.',
        image: 'wiki_images/generic_route.png', links: ['saffron', 'vermilion'], encounters: ['pidgey', 'rattata', 'meowth', 'psyduck', 'oddish'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'vermilion': {
        name: 'Вермилион', desc: 'Крупнейший порт Канто. Отсюда ходят паромы в другие регионы.',
        image: '', links: ['route_6', 'route_11', 'vermilion_pokecenter', 'vermilion_pokemarket', 'vermilion_stadium', 'vermilion_port', 'vermilion_fanclub', 'vermilion_library', 'vermilion_circus'], encounters: [], hasHeal: true, hasWater: true, region: 'kanto'
      },
      'vermilion_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Вермилионе.',
        image: '', links: ['vermilion'], encounters: [],
        hasHeal: true, hasWater: false, region: 'kanto'
      },
      'vermilion_pokemarket': {
        name: 'Покемаркет', desc: 'Магазин товаров для тренеров.',
        image: '', links: ['vermilion'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'vermilion_stadium': {
        name: 'Электрический Стадион', desc: 'Арена электрических покемонов Сёрджа.',
        image: '', links: ['vermilion'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'vermilion_port': {
        name: 'Порт', desc: 'Крупный порт Канто.',
        image: '', links: ['vermilion'], encounters: [],
        hasHeal: false, hasWater: true, region: 'kanto'
      },
      'vermilion_fanclub': {
        name: 'Фан-клуб покемонов', desc: 'Клуб фанатов покемонов.',
        image: '', links: ['vermilion'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'vermilion_library': {
        name: 'Библиотека', desc: 'Городская библиотека Вермилиона.',
        image: '', links: ['vermilion'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'vermilion_circus': {
        name: 'Цирковой шатёр', desc: 'Передвижной цирк с покемонами.',
        image: '', links: ['vermilion'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'route_11': {
        name: 'Маршрут 11', desc: 'Восточная дорога вдоль побережья, ведущая к Пещере Диглеттов.',
        image: 'wiki_images/generic_route.png', links: ['vermilion', 'diglett_cave', 'route_12'], encounters: ['spearow', 'ekans', 'sandshrew', 'drowzee'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'diglett_cave': {
        name: 'Пещера Диглеттов', desc: 'Подземный тоннель, прорытый Диглеттами. Соединяет Вермилион с Маршрутом 2.',
        image: 'wiki_images/Peshhera_Digletov.jpg', links: ['route_11', 'route_2'], encounters: ['diglett', 'dugtrio'], hasHeal: false, region: 'kanto'
      },
      'route_9': {
        name: 'Маршрут 9', desc: 'Скалистая дорога на восток от Церулина к реке и Каменному Тоннелю.',
        image: 'wiki_images/generic_route.png', links: ['cerulean_city', 'route_10'], encounters: ['rattata', 'spearow', 'ekans', 'sandshrew'], hasHeal: false, region: 'kanto'
      },
      'route_10': {
        name: 'Маршрут 10', desc: 'Берег реки у Каменного Тоннеля. Популярное место рыбалки.',
        image: 'wiki_images/generic_route.png', links: ['route_9', 'rock_tunnel', 'lavender_town'], encounters: ['voltorb', 'magnemite', 'machop'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'rock_tunnel': {
        name: 'Каменный Тоннель', desc: 'Тёмный и извилистый тоннель сквозь гору. Без фонарика не пройти.',
        image: '', links: ['route_10'], encounters: ['zubat', 'geodude', 'machop', 'onix'], hasHeal: false, region: 'kanto'
      },
      'lavender_town': {
        name: 'Лавандия', desc: 'Город упокоения покемонов. Здесь находится Башня Призраков.',
        image: 'wiki_images/Lavandia.jpg', links: ['route_10', 'route_8', 'route_12', 'lavender_bug_stadium', 'lavender_pokecenter', 'lavender_pokemarket', 'lavender_radio_tower'], encounters: ['gastly', 'haunter', 'cubone'], hasHeal: true, region: 'kanto'
      },
      'lavender_bug_stadium': {
        name: 'Стадион Жуков', desc: 'Арена насекомых-покемонов.',
        image: '', links: ['lavender_town'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'lavender_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Лавандии.',
        image: '', links: ['lavender_town'], encounters: [],
        hasHeal: true, hasWater: false, region: 'kanto'
      },
      'lavender_pokemarket': {
        name: 'Покемаркет', desc: 'Магазин товаров для тренеров.',
        image: '', links: ['lavender_town'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'lavender_radio_tower': {
        name: 'Радиобашня', desc: 'Радиобашня Лавандии.',
        image: '', links: ['lavender_town'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'route_8': {
        name: 'Маршрут 8', desc: 'Западная дорога от Лавандии в Шаффран через холмы.',
        image: 'wiki_images/generic_route.png', links: ['lavender_town', 'saffron'], encounters: ['pidgey', 'meowth', 'growlithe', 'vulpix'], hasHeal: false, region: 'kanto'
      },
      'route_7': {
        name: 'Маршрут 7', desc: 'Короткая дорога между Селадоном и Шаффраном.',
        image: 'wiki_images/generic_route.png', links: ['celadon_city', 'saffron'], encounters: ['meowth', 'oddish', 'bellsprout'], hasHeal: false, region: 'kanto'
      },
      'celadon_city': {
        name: 'Селадон', desc: 'Город развлечений с крупнейшим универмагом и игровым центром.',
        image: 'wiki_images/Celadon.jpg', links: ['route_7', 'route_16', 'confectionery', 'celadon_stadium'], encounters: [], hasHeal: true, region: 'kanto'
      },
      'celadon_stadium': {
        name: 'Травяной Стадион', desc: 'Арена травяных покемонов Эрики.',
        image: '', links: ['celadon_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'confectionery': {
        name: 'Кондитерская', desc: 'Знаменитая кондитерская Селадона. Сладкие покемоны обожают это место.',
        image: '', links: ['celadon_city'], encounters: ['jigglypuff', 'clefairy', 'chansey'], hasHeal: false, region: 'kanto'
      },
      'route_16': {
        name: 'Маршрут 16', desc: 'Начало Велосипедной Дорожки. Соединяет Селадон с Фуксией.',
        image: 'wiki_images/generic_route.png', links: ['celadon_city', 'route_17'], encounters: ['spearow', 'doduo', 'rattata', 'grimer'], hasHeal: false, region: 'kanto'
      },
      'route_17': {
        name: 'Велосипедная дорожка (М17)', desc: 'Длинный вело-мост над морем. Популярна у байкеров.',
        image: 'wiki_images/generic_route.png', links: ['route_16', 'route_18'], encounters: ['doduo', 'fearow', 'grimer', 'ponyta'], hasHeal: false, region: 'kanto'
      },
      'route_18': {
        name: 'Маршрут 18', desc: 'Конец Велосипедной Дорожки у ворот Фуксии.',
        image: 'wiki_images/generic_route.png', links: ['route_17', 'fuchsia_city'], encounters: ['doduo', 'fearow', 'rattata'], hasHeal: false, region: 'kanto'
      },
      'fuchsia_city': {
        name: 'Фуксия', desc: 'Город ниндзя с Сафари-Зоной и древним зоопарком.',
        image: 'wiki_images/Fuksija.jpg', links: ['route_18', 'safari_zone', 'route_15', 'route_19', 'fuchsia_pokecenter', 'fuchsia_pokemarket', 'fuchsia_dragon_stadium', 'fuchsia_beach'], encounters: [], hasHeal: true, hasWater: true, region: 'kanto'
      },
      'fuchsia_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Фуксии.',
        image: '', links: ['fuchsia_city'], encounters: [],
        hasHeal: true, hasWater: false, region: 'kanto'
      },
      'fuchsia_pokemarket': {
        name: 'Покемаркет', desc: 'Магазин товаров для тренеров.',
        image: '', links: ['fuchsia_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'fuchsia_dragon_stadium': {
        name: 'Ядовитый Стадион', desc: 'Арена ядовитых покемонов Коги.',
        image: '', links: ['fuchsia_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'fuchsia_beach': {
        name: 'Пляж', desc: 'Пляж на окраине Фуксии.',
        image: '', links: ['fuchsia_city'], encounters: [],
        hasHeal: false, hasWater: true, region: 'kanto'
      },
      'fuchsia_beach_pier': {
        name: 'Пирс', desc: 'Пирс фуксийского пляжа.',
        image: '', links: ['fuchsia_city'], encounters: [],
        hasHeal: false, hasWater: true, region: 'kanto'
      },
      'safari_zone': {
        name: 'Сафари Зона', desc: 'Огромный заповедник, где обитают редчайшие покемоны Канто.',
        image: '', links: ['fuchsia_city'], encounters: ['nidoran-f', 'nidoran-m', 'exeggcute', 'rhyhorn', 'chansey', 'scyther', 'pinsir', 'tauros'], hasHeal: false, region: 'kanto'
      },
      'route_15': {
        name: 'Маршрут 15', desc: 'Восточный тракт от Фуксии на север.',
        image: 'wiki_images/generic_route.png', links: ['fuchsia_city', 'route_14'], encounters: ['oddish', 'bellsprout', 'venonat', 'ditto'], hasHeal: false, region: 'kanto'
      },
      'route_14': {
        name: 'Маршрут 14', desc: 'Прибрежная дорога с видом на море. Много диких уток.',
        image: 'wiki_images/generic_route.png', links: ['route_15', 'route_13'], encounters: ['pidgey', 'pidgeotto', 'ditto'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'route_13': {
        name: 'Маршрут 13', desc: 'Деревянный мост-лабиринт через залив. Проверка на терпение.',
        image: 'wiki_images/generic_route.png', links: ['route_14', 'route_12'], encounters: ['pidgey', 'oddish', 'bellsprout', 'venonat'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'route_12': {
        name: 'Маршрут 12', desc: 'Длинный мост рыбаков. Здесь когда-то спал гигантский Снорлакс.',
        image: 'wiki_images/generic_route.png', links: ['route_13', 'lavender_town', 'route_11'], encounters: ['tentacool', 'magikarp', 'snorlax'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'route_19': {
        name: 'Маршрут 19', desc: 'Морской маршрут от Фуксии к Островам Морской Пены.',
        image: 'wiki_images/generic_route.png', links: ['fuchsia_city', 'route_20'], encounters: ['tentacool', 'magikarp'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'route_20': {
        name: 'Маршрут 20', desc: 'Бурные воды вокруг Островов Морской Пены. Только на плав-покемоне.',
        image: 'wiki_images/generic_route.png', links: ['route_19', 'seafoam_islands', 'cinnabar_island'], encounters: ['tentacool', 'magikarp', 'lapras'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'seafoam_islands': {
        name: 'Острова Морской Пены', desc: 'Ледяные пещеры в сердце архипелага. Говорят, здесь обитает Артикуно.',
        image: '', links: ['route_20'], encounters: ['seel', 'slowpoke', 'zubat', 'golbat', 'jynx', 'articuno'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'cinnabar_island': {
        name: 'Синнабар', desc: 'Вулканический остров с покемон-лабораторией. Жаркий климат круглый год.',
        image: '', links: ['route_20', 'route_21', 'cinnabar_stadium'], encounters: ['grimer', 'muk', 'koffing', 'weezing'], hasHeal: true, hasWater: true, region: 'kanto'
      },
      'cinnabar_stadium': {
        name: 'Огненный Стадион', desc: 'Арена огненных покемонов Блейна.',
        image: '', links: ['cinnabar_island'], encounters: [],
        hasHeal: false, hasWater: false, region: 'kanto'
      },
      'route_21': {
        name: 'Маршрут 21', desc: 'Длинный морской путь от Синнабара до Алабастии.',
        image: 'wiki_images/generic_route.png', links: ['cinnabar_island', 'pallet_town'], encounters: ['tentacool', 'tangela'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'bicycle_road': {
        name: 'Велосипедная дорожка', desc: 'Скоростная трасса для велосипедистов через весь Канто.',
        image: 'wiki_images/generic_route.png', links: ['celadon_city', 'fuchsia_city'], encounters: ['doduo', 'ponyta', 'rattata'], hasHeal: false, region: 'kanto'
      },
      'brick_bridge': {
        name: 'Кирпичный мост', desc: 'Старинный кирпичный мост над рекой. Место встречи тренеров.',
        image: 'wiki_images/Kirpichnyj_most.jpg', links: ['route_11', 'route_12'], encounters: ['magikarp', 'poliwag', 'goldeen'], hasHeal: false, hasWater: true, region: 'kanto'
      },
      'labyrinth': {
        name: 'Лабиринт', desc: 'Запутанный природный лабиринт. Проверка на ориентирование для тренеров.',
        image: '', links: ['route_11'], encounters: ['gastly', 'haunter', 'drowzee', 'abra'], hasHeal: false, region: 'kanto'
      },
      'potato_cave': {
        name: 'Пещера Потатов', desc: 'Пещера, где обитают колонии покемонов-овощей.',
        image: 'wiki_images/generic_route.png', links: ['route_24'], encounters: ['oddish', 'bellsprout', 'exeggcute', 'paras'], hasHeal: false, region: 'kanto'
      },
      'goldenrod_academy_branch': {
        name: 'Филиал Академии Голденрода', desc: 'Кантоский филиал престижной Академии Голденрода.',
        image: 'wiki_images/Goldenrod_Place.jpg', links: ['saffron'], encounters: [], hasHeal: true, region: 'kanto'
      },
      'power_plant': {
        name: 'Электростанция', desc: 'Заброшенная электростанция у реки. Пристанище электрических покемонов.',
        image: '', links: ['route_10'], encounters: ['voltorb', 'magnemite', 'magneton', 'electabuzz', 'zapdos'], hasHeal: false, region: 'kanto'
      },
      'victory_road': {
        name: 'Дорога Победы', desc: 'Последнее и тяжелейшее испытание перед Плато Индиго. Элитные тренеры повсюду.',
        image: 'wiki_images/generic_route.png', links: ['route_22', 'indigo_plateau'], encounters: ['machop', 'geodude', 'zubat', 'onix'], hasHeal: false, region: 'kanto'
      },
      'indigo_plateau': {
        name: 'Плато Индиго', desc: 'Вершина Канто. Здесь заседает Элитная Четвёрка и Чемпион.',
        image: 'wiki_images/generic_route.png', links: ['victory_road'], encounters: [], hasHeal: true, region: 'kanto'
      },
      'pokecenter': {
        name: 'Покецентр', desc: 'Центр помощи покемонам. Сестра Джой и дневной питомник.',
        image: '', links: [], encounters: [], hasHeal: false, region: 'kanto'
      }
    }
  },
  east_johto: {
    name: 'Восточный Джото',
    locations: {
      'goldenrod': {
        name: 'Голденрод', desc: 'Столица Восточного Джото и крупнейший город мира Лиги 17. Здесь начинают путь все тренеры.',
        image: '',
        links: ['ej_route_1', 'ej_route_2', 'ej_route_3', 'ej_route_4', 'ej_route_8', 'goldenrod_prison', 'goldenrod_pokecenter', 'goldenrod_supermarket', 'goldenrod_institute', 'goldenrod_academy', 'goldenrod_bar', 'goldenrod_cityhall', 'goldenrod_stadium'],
        encounters: ['pidgey', 'zubat', 'grimer', 'murkrow'], hasHeal: true, region: 'east_johto'
      },
      'goldenrod_stadium': {
        name: 'Обычный Стадион', desc: 'Арена обычных покемонов Уитни.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_prison': {
        name: 'Тюрьма', desc: 'Городская тюрьма Голденрода.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Голденроде.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: true, hasWater: false, region: 'east_johto'
      },
      'goldenrod_supermarket': {
        name: 'Супермаркет', desc: 'Крупнейший супермаркет города.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_institute': {
        name: 'Научный институт', desc: 'Исследовательский институт.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_academy': {
        name: 'Академия Тренеров Покемонов', desc: 'Престижная академия подготовки тренеров.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_academy_training': {
        name: 'Тренировочная зона', desc: 'Зона для тренировок в Академии.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_academy_aviary': {
        name: 'Вольер', desc: 'Вольер с летающими покемонами.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_academy_green': {
        name: 'Зелёная зона', desc: 'Парковая зона Академии.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_academy_lab': {
        name: 'Лаборатория', desc: 'Научная лаборатория Академии.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_bar': {
        name: 'Бар', desc: 'Популярный бар в центре.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_cityhall': {
        name: 'Мэрия', desc: 'Здание мэрии Голденрода.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'goldenrod_cityhall_admin': {
        name: 'Администраторская зона', desc: 'Административные помещения.',
        image: '', links: ['goldenrod'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'ej_route_1': {
        name: 'Дорога №1', desc: 'Первый тракт от Голденрода. Оживлённая дорога для начинающих тренеров.',
        image: 'wiki_images/generic_route.png', links: ['goldenrod', 'ej_route_2', 'deserted_road_ej'],
        encounters: ['sentret', 'pidgey', 'rattata'], hasHeal: false, region: 'east_johto'
      },
      'ej_route_2': {
        name: 'Дорога №2', desc: 'Дорога к Мосту и Оливину. Развилка к Воздушному Стадиону.',
        image: 'wiki_images/generic_route.png', links: ['goldenrod', 'ej_route_1', 'bridge_ej', 'air_stadium_forest'],
        encounters: ['sentret', 'hoothoot', 'spinarak'], hasHeal: false, region: 'east_johto'
      },
      'bridge_ej': {
        name: 'Мост', desc: 'Кирпичный мост через пролив, соединяющий дороги с Оливином.',
        image: 'wiki_images/generic_route.png', links: ['ej_route_2', 'olivine'],
        encounters: ['magikarp', 'tentacool'], hasHeal: false, region: 'east_johto'
      },
      'olivine': {
        name: 'Оливин', desc: 'Портовый город с маяком. Отсюда ходят корабли в Канто и на остров Селен.',
        image: 'wiki_images/Olivin.jpg', links: ['bridge_ej', 'olivine_water_stadium', 'olivine_pokecenter', 'olivine_shop', 'olivine_bar_pirate', 'olivine_beach', 'olivine_aquapark', 'olivine_house_221'],
        encounters: ['shellder', 'wingull', 'krabby', 'magikarp'], hasHeal: true, hasWater: true, region: 'east_johto'
      },
      'olivine_water_stadium': {
        name: 'Стальной Стадион', desc: 'Арена стальных покемонов Жасмин.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: true, region: 'east_johto'
      },
      'olivine_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Оливине.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: true, hasWater: false, region: 'east_johto'
      },
      'olivine_shop': {
        name: 'Магазин Воттэр', desc: 'Фирменный магазин товаров.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'olivine_bar_pirate': {
        name: 'Бар Пиратское убежище', desc: 'Бар в портовом районе.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'olivine_beach': {
        name: 'Пляж', desc: 'Городской пляж Оливина.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: true, region: 'east_johto'
      },
      'olivine_beach_pier': {
        name: 'Причал', desc: 'Причал оливинского пляжа.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: true, region: 'east_johto'
      },
      'olivine_beach_lighthouse': {
        name: 'Маяк', desc: 'Старый маяк на побережье.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: true, region: 'east_johto'
      },
      'olivine_beach_malibu': {
        name: 'Бар Malibu', desc: 'Пляжный бар на побережье.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'olivine_aquapark': {
        name: 'Аквапарк', desc: 'Развлекательный водный комплекс.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: true, region: 'east_johto'
      },
      'olivine_house_221': {
        name: 'Дом 221', desc: 'Жилой дом №221.',
        image: '', links: ['olivine'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'ej_route_3': {
        name: 'Дорога №3', desc: 'Цветущая дорога из Голденрода в город цветов Флауренцию.',
        image: 'wiki_images/generic_route.png', links: ['goldenrod', 'flourence', 'overgrown_trail'],
        encounters: ['pidgey', 'spearow', 'mareep'], hasHeal: false, region: 'east_johto'
      },
      'flourence': {
        name: 'Флауренция', desc: 'Город цветов с тёплым климатом, оранжереями и первым гимом Джото.',
        image: '', links: ['ej_route_3', 'farm_ej', 'flourence_greenhouse', 'flourence_pokecenter', 'flourence_recycling', 'flourence_tech_shop', 'flourence_stadium'],
        encounters: [], hasHeal: true, region: 'east_johto'
      },
      'flourence_stadium': {
        name: 'Воздушный Стадион', desc: 'Арена летающих покемонов Фолкнера.',
        image: '', links: ['flourence'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'flourence_greenhouse': {
        name: 'Оранжерея цветов', desc: 'Красивая оранжерея с редкими растениями.',
        image: '', links: ['flourence'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'flourence_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Флауренции.',
        image: '', links: ['flourence'], encounters: [],
        hasHeal: true, hasWater: false, region: 'east_johto'
      },
      'flourence_recycling': {
        name: 'Пункт переработки', desc: 'Экологический пункт переработки.',
        image: '', links: ['flourence'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'flourence_tech_shop': {
        name: 'Магазин техники', desc: 'Магазин технических устройств.',
        image: '', links: ['flourence'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'farm_ej': {
        name: 'Ферма', desc: 'Сельская местность с пастбищами. Дом для Милтанков и Тауросов.',
        image: '', links: ['flourence', 'ej_route_8'],
        encounters: ['miltank', 'tauros', 'mareep'], hasHeal: false, region: 'east_johto'
      },
      'ej_route_4': {
        name: 'Дорога №4', desc: 'Дорога в новейший город Вархолл через скалистую местность.',
        image: 'wiki_images/generic_route.png', links: ['goldenrod', 'warhall', 'rocks_ej'],
        encounters: ['growlithe', 'spearow', 'ekans'], hasHeal: false, region: 'east_johto'
      },
      'warhall': {
        name: 'Вархолл', desc: 'Новейший город с автовокзалом. Отсюда ходят автобусы в Западное Джото.',
        image: 'wiki_images/Varholl.jpg', links: ['ej_route_4', 'ej_route_9', 'warhall_pokecenter', 'warhall_bill_shop', 'warhall_bill_pawnshop', 'warhall_samurai_house', 'warhall_samurai_gym', 'warhall_battle_stadium', 'warhall_museum', 'warhall_bus_station'],
        encounters: [], hasHeal: true, region: 'east_johto'
      },
      'warhall_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Вархолле.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: true, hasWater: false, region: 'east_johto'
      },
      'warhall_bill_shop': {
        name: 'Магазин Билла', desc: 'Магазин изобретателя Билла.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'warhall_bill_pawnshop': {
        name: 'Ломбард', desc: 'Ломбард при магазине Билла.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'warhall_samurai_house': {
        name: 'Дом самурая', desc: 'Традиционный дом мастера.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'warhall_samurai_gym': {
        name: 'Спортивный зал', desc: 'Тренировочный зал.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'warhall_battle_stadium': {
        name: 'Призрачный Стадион', desc: 'Арена призрачных покемонов Морти.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'warhall_museum': {
        name: 'Музей истории', desc: 'Музей истории Восточного Джото.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'warhall_museum_workshops': {
        name: 'Мастерские', desc: 'Реставрационные мастерские.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'warhall_bus_station': {
        name: 'Автовокзал', desc: 'Междугородний автовокзал.',
        image: '', links: ['warhall'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'ej_route_8': {
        name: 'Дорога №8', desc: 'Прямая дорога от Голденрода к Ферме.',
        image: 'wiki_images/generic_route.png', links: ['goldenrod', 'farm_ej'],
        encounters: ['pidgey', 'spearow', 'rattata'], hasHeal: false, region: 'east_johto'
      },
      'ej_route_9': {
        name: 'Дорога №9', desc: 'Путь от Вархолла на север через предгорья.',
        image: 'wiki_images/generic_route.png', links: ['warhall', 'mountain_pass'],
        encounters: ['geodude', 'machop', 'onix'], hasHeal: false, region: 'east_johto'
      },
      'alston': {
        name: 'Олстон', desc: 'Городок бродячих артистов с цирком покемонов. Расположен в горах.',
        image: '', links: ['deserted_road_ej', 'mountain_pass', 'alston_circus', 'alston_pokecenter', 'alston_shop', 'alston_granny_house', 'alston_steel_stadium', 'alston_soul_stadium'],
        encounters: [], hasHeal: true, region: 'east_johto'
      },
      'alston_circus': {
        name: 'Цирк покемонов', desc: 'Знаменитый цирк с покемонами.',
        image: '', links: ['alston'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'alston_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Олстоне.',
        image: '', links: ['alston'], encounters: [],
        hasHeal: true, hasWater: false, region: 'east_johto'
      },
      'alston_shop': {
        name: 'Магазин', desc: 'Местный магазин товаров.',
        image: '', links: ['alston'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'alston_granny_house': {
        name: 'Дом старушки', desc: 'Дом пожилой женщины.',
        image: '', links: ['alston'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'alston_steel_stadium': {
        name: 'Стадион Жуков', desc: 'Арена насекомых-покемонов Багси.',
        image: '', links: ['alston'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'alston_soul_stadium': {
        name: 'Стадион Души', desc: 'Загадочная арена духовного типа.',
        image: '', links: ['alston'], encounters: [],
        hasHeal: false, hasWater: false, region: 'east_johto'
      },
      'deserted_road_ej': {
        name: 'Безлюдная дорога', desc: 'Пустынная дорога у Олстона. Ночью здесь появляются призрачные Коффинги.',
        image: 'wiki_images/Bezljudnaja_doroga.jpg', links: ['alston', 'ej_route_1'],
        encounters: ['koffing', 'rattata', 'meowth'], hasHeal: false, region: 'east_johto'
      },
      'rocks_ej': {
        name: 'Скалы', desc: 'Скалистая гряда Восточного Джото. Обитель каменных покемонов.',
        image: 'wiki_images/LOK_Восточный_Джото_Скалы.PNG', links: ['ej_route_4'],
        encounters: ['geodude', 'onix', 'machop'], hasHeal: false, region: 'east_johto'
      },
      'overgrown_trail': {
        name: 'Заросшая тропа', desc: 'Густо заросшая растениями тропа. Травяные покемоны процветают здесь.',
        image: 'wiki_images/generic_route.png', links: ['ej_route_3'],
        encounters: ['oddish', 'bellsprout', 'paras'], hasHeal: false, region: 'east_johto'
      },
      'air_stadium_forest': {
        name: 'Лес вокруг воздушного стадиона', desc: 'Густой лес с редкими летающими покемонами.',
        image: 'wiki_images/Les_vokrug_vozdushnogo_stadiona.jpg', links: ['ej_route_2'],
        encounters: ['caterpie', 'weedle', 'hoothoot', 'pineco'], hasHeal: false, region: 'east_johto'
      },
      'mountain_pass': {
        name: 'Горный перевал', desc: 'Высокогорный перевал через хребет. Путь к Олстону.',
        image: 'wiki_images/generic_route.png', links: ['alston', 'ej_route_9'],
        encounters: ['geodude', 'machop', 'zubat', 'clefairy'], hasHeal: false, region: 'east_johto'
      },
      'lowland_marshes': {
        name: 'Низинные болота', desc: 'Обширные болота с редкими ядовитыми и водными покемонами.',
        image: 'wiki_images/generic_route.png', links: ['overgrown_trail'],
        encounters: ['ekans', 'grimer', 'poliwag', 'wooper'], hasHeal: false, region: 'east_johto'
      },
      'new_district': {
        name: 'Новый район', desc: 'Современный район Голденрода с высотками и офисами Лиги.',
        image: '', links: ['goldenrod'],
        encounters: ['magnemite', 'voltorb', 'porygon'], hasHeal: true, region: 'east_johto'
      },
      'old_district': {
        name: 'Старый район', desc: 'Исторический центр Голденрода. Узкие улочки и старинные здания.',
        image: '', links: ['goldenrod'],
        encounters: ['gastly', 'meowth', 'rattata'], hasHeal: false, region: 'east_johto'
      }
    }
  },
  west_johto: {
    name: 'Западный Джото',
    locations: {
      'city_gates_wj': {
        name: 'Ворота перед городом', desc: 'Въездные ворота в Западное Джото. Контрольный пункт для путников.',
        image: '', links: ['summer'],
        encounters: [], hasHeal: false, region: 'west_johto'
      },
      'summer': {
        name: 'Саммер', desc: 'Столица Западного Джото. Здесь есть Покепарк и Научный институт.',
        image: 'wiki_images/Vozviwennost.jpg', links: ['city_gates_wj', 'elevation_wj', 'wj_route_1', 'wj_route_3', 'wj_route_4', 'summer_pokemarket', 'summer_fountain', 'summer_pub', 'summer_library', 'summer_pokepark', 'summer_police', 'summer_institute', 'summer_pokecenter', 'summer_mountain_road', 'summer_mountain_fork', 'summer_nursery'],
        encounters: [], hasHeal: true, region: 'west_johto'
      },
      'summer_pokemarket': {
        name: 'Покемаркет', desc: 'Магазин товаров для тренеров.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_fountain': {
        name: 'Фонтан', desc: 'Центральный фонтан Саммера.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_pub': {
        name: 'Паб Хаус', desc: 'Уютный паб в районе фонтана.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_library': {
        name: 'Библиотека', desc: 'Городская библиотека Саммера.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_pokepark': {
        name: 'Поке-парк', desc: 'Парк для прогулок с покемонами.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_police': {
        name: 'Полицейский участок', desc: 'Полицейский участок Саммера.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_institute': {
        name: 'Институт Саммера', desc: 'Научно-исследовательский институт.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Саммере.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: true, hasWater: false, region: 'west_johto'
      },
      'summer_mountain_road': {
        name: 'Дорога к горе', desc: 'Дорога ведущая к горному перевалу.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_mountain_fork': {
        name: 'Развилка', desc: 'Развилка на дороге к горе.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'summer_nursery': {
        name: 'Питомник Западного Джото', desc: 'Питомник для разведения покемонов.',
        image: '', links: ['summer'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'elevation_wj': {
        name: 'Возвышенность', desc: 'Холмистая возвышенность над Саммером. Популярное место для тренировок.',
        image: '', links: ['summer', 'wj_route_1'],
        encounters: ['geodude', 'sandshrew'], hasHeal: false, region: 'west_johto'
      },
      'wj_route_1': {
        name: 'Маршрут №1', desc: 'Первый маршрут Западного Джото — саванна с дикими огненными покемонами.',
        image: 'wiki_images/generic_route.png', links: ['summer', 'elevation_wj', 'wj_route_2', 'rocks_wj'],
        encounters: ['growlithe', 'ekans', 'spearow'], hasHeal: false, region: 'west_johto'
      },
      'wj_route_2': {
        name: 'Маршрут №2', desc: 'Дорога через саванну в прибрежный Мелен.',
        image: 'wiki_images/generic_route.png', links: ['wj_route_1', 'melen'],
        encounters: ['growlithe', 'ponyta', 'sandshrew'], hasHeal: false, region: 'west_johto'
      },
      'melen': {
        name: 'Мелен', desc: 'Прибрежный пастуший городок с дайвинг-центром и мастерской масок.',
        image: 'wiki_images/Vulkan.jpg', links: ['wj_route_2', 'melen_craig_shop', 'melen_craig_director', 'melen_pier', 'melen_dive_center', 'melen_mask_workshop', 'melen_fiona_house', 'melen_albert_house'],
        encounters: ['poliwag', 'tentacool'], hasHeal: true, region: 'west_johto'
      },
      'melen_craig_shop': {
        name: 'Магазин Крейга', desc: 'Известный магазин коллекционера.',
        image: '', links: ['melen'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'melen_craig_director': {
        name: 'Комната директора', desc: 'Кабинет директора магазина.',
        image: '', links: ['melen'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'melen_pier': {
        name: 'Причал', desc: 'Причал в Мелене.',
        image: '', links: ['melen'], encounters: [],
        hasHeal: false, hasWater: true, region: 'west_johto'
      },
      'melen_dive_center': {
        name: 'Дайвинг-Центр', desc: 'Центр подводного плавания.',
        image: '', links: ['melen'], encounters: [],
        hasHeal: false, hasWater: true, region: 'west_johto'
      },
      'melen_mask_workshop': {
        name: 'Мастерская Масок', desc: 'Мастерская по изготовлению масок.',
        image: '', links: ['melen'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'melen_fiona_house': {
        name: 'Дом Фионы', desc: 'Дом тренера Фионы.',
        image: '', links: ['melen'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'melen_albert_house': {
        name: 'Дом Альберта', desc: 'Дом исследователя Альберта.',
        image: '', links: ['melen'], encounters: [],
        hasHeal: false, hasWater: false, region: 'west_johto'
      },
      'wj_route_3': {
        name: 'Маршрут №3', desc: 'Путь на восток от Саммера к каменным площадкам.',
        image: 'wiki_images/generic_route.png', links: ['summer', 'stone_platform_wj'],
        encounters: ['machop', 'geodude'], hasHeal: false, region: 'west_johto'
      },
      'stone_platform_wj': {
        name: 'Каменная площадка', desc: 'Ровная каменная платформа посреди саванны.',
        image: 'wiki_images/KamennayaPlowadka.jpg', links: ['wj_route_3', 'volcanic_plateau'],
        encounters: ['onix', 'geodude', 'rhyhorn'], hasHeal: false, region: 'west_johto'
      },
      'volcanic_plateau': {
        name: 'Вулканическое плато', desc: 'Жаркое плато у потухшего вулкана. Огненные покемоны повсюду.',
        image: 'wiki_images/generic_route.png', links: ['stone_platform_wj'],
        encounters: ['ponyta', 'magmar', 'growlithe'], hasHeal: false, region: 'west_johto'
      },
      'wj_route_4': {
        name: 'Маршрут №4', desc: 'Четвёртый маршрут — дорога на юг от Саммера к ручью.',
        image: 'wiki_images/generic_route.png', links: ['summer', 'stream_wj'],
        encounters: ['spearow', 'rattata'], hasHeal: false, region: 'west_johto'
      },
      'stream_wj': {
        name: 'Ручей', desc: 'Освежающий ручей в жаркой саванне. Оазис для водных покемонов.',
        image: 'wiki_images/Ru4ey.jpg', links: ['wj_route_4', 'abandoned_road_wj'],
        encounters: ['magikarp', 'poliwag', 'goldeen'], hasHeal: false, hasWater: true, region: 'west_johto'
      },
      'rocks_wj': {
        name: 'Скалы (З.Джото)', desc: 'Скалистая гряда в Западном Джото. Диглетты изрыли здесь всё.',
        image: 'wiki_images/SkaliZD.jpg', links: ['wj_route_1'],
        encounters: ['geodude', 'onix', 'diglett'], hasHeal: false, region: 'west_johto'
      },
      'small_rock_wj': {
        name: 'Небольшая скала', desc: 'Одинокая скала посреди саванны. Место обитания редких покемонов.',
        image: '', links: ['wj_route_1'],
        encounters: ['geodude', 'onix', 'aerodactyl'], hasHeal: false, region: 'west_johto'
      },
      'man_made_cave': {
        name: 'Рукотворная пещера', desc: 'Искусственная пещера, вырытая шахтёрами. Лабиринт с сокровищами.',
        image: 'wiki_images/generic_route.png', links: ['stone_platform_wj'],
        encounters: ['zubat', 'geodude', 'onix', 'golbat'], hasHeal: false, region: 'west_johto'
      },
      'abandoned_road_wj': {
        name: 'Заброшенная дорога (З.Джото)', desc: 'Старая дорога у ручья, ведущая в никуда.',
        image: 'wiki_images/Zabroshennaja_doroga.jpg', links: ['stream_wj'],
        encounters: ['rattata', 'spearow', 'mankey'], hasHeal: false, region: 'west_johto'
      },
      'empty_city': {
        name: 'Опустевший город (Flёr)', desc: 'Древний заброшенный город Флёр. Доступ только после квеста и с запасом воды.',
        image: 'wiki_images/Zabroshennoe_pomeste.jpg', links: ['wj_route_2'],
        encounters: ['gastly', 'haunter', 'gengar', 'misdreavus'], hasHeal: false, region: 'west_johto'
      },
      'arena_wj': {
        name: 'Арена Западного Джото', desc: 'Боевая арена под открытым небом. Место проведения турниров.',
        image: '', links: ['summer'],
        encounters: [], hasHeal: true, region: 'west_johto'
      }
    }
  },
  selen_island: {
    name: 'Остров Селен',
    locations: {
      'ostaron': {
        name: 'Остарон', desc: 'Столица Селена, благословлённая легендарным покемоном. Стадион Ледяных покемонов.',
        image: 'wiki_images/Ostaron.jpg', links: ['sel_route_4', 'sel_route_5', 'sel_route_8', 'ostaron_pokecenter', 'ostaron_pokemarket', 'ostaron_bar', 'ostaron_cityhall', 'ostaron_ice_stadium'],
        encounters: [], hasHeal: true, region: 'selen_island'
      },
      'ostaron_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Остароне.',
        image: '', links: ['ostaron'], encounters: [],
        hasHeal: true, hasWater: false, region: 'selen_island'
      },
      'ostaron_pokemarket': {
        name: 'Покемаркет', desc: 'Магазин товаров для тренеров.',
        image: '', links: ['ostaron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'ostaron_bar': {
        name: 'Бар Ледокол', desc: 'Популярный бар в портовом районе.',
        image: '', links: ['ostaron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'ostaron_cityhall': {
        name: 'Мэрия', desc: 'Здание мэрии Остарона.',
        image: '', links: ['ostaron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'ostaron_ice_stadium': {
        name: 'Боевой Стадион', desc: 'Арена боевых покемонов Чака.',
        image: '', links: ['ostaron'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'sel_route_4': {
        name: 'Маршрут 4 (Селен)', desc: 'Дорога от столицы на юг острова.',
        image: 'wiki_images/generic_route.png', links: ['ostaron', 'sel_route_5'],
        encounters: ['swinub', 'snorunt', 'delibird'], hasHeal: false, region: 'selen_island'
      },
      'sel_route_5': {
        name: 'Маршрут 5 (Селен)', desc: 'Центральный путь к Перекрёстку.',
        image: 'wiki_images/generic_route.png', links: ['ostaron', 'sel_route_4', 'crossroads_sel', 'abandoned_estate'],
        encounters: ['swinub', 'bergmite'], hasHeal: false, region: 'selen_island'
      },
      'crossroads_sel': {
        name: 'Перекрёсток', desc: 'Центральный перекрёсток дорог Селена — сердце транспортной сети.',
        image: 'wiki_images/generic_route.png', links: ['sel_route_5', 'sel_route_10', 'abandoned_road_sel', 'selen_forest'],
        encounters: ['pidgey', 'spearow'], hasHeal: false, region: 'selen_island'
      },
      'sel_route_10': {
        name: 'Маршрут 10 (Селен)', desc: 'Южная дорога к Сайрефу через леса.',
        image: 'wiki_images/generic_route.png', links: ['crossroads_sel', 'sel_route_11', 'selen_forest'],
        encounters: ['swinub', 'delibird'], hasHeal: false, region: 'selen_island'
      },
      'sel_route_11': {
        name: 'Маршрут 11 (Селен)', desc: 'Подход к пригороду Сайрефа. Виднеются шпили города.',
        image: 'wiki_images/generic_route.png', links: ['sel_route_10', 'sayref_suburb'],
        encounters: ['swinub', 'pidgey'], hasHeal: false, region: 'selen_island'
      },
      'sayref_suburb': {
        name: 'Пригород Сайрефа', desc: 'Пригород с цифровым табло почёта тренеров.',
        image: 'wiki_images/Prigorod_Sajrefa.jpg', links: ['sel_route_11', 'sayref'],
        encounters: ['swinub'], hasHeal: false, region: 'selen_island'
      },
      'sayref': {
        name: 'Сайреф', desc: 'Второй по величине город Селена. Снеговик-символ города.',
        image: 'wiki_images/Sajref.jpg', links: ['sayref_suburb', 'sel_route_13', 'sel_route_16', 'sayref_pokemarket', 'sayref_pokecenter', 'sayref_air_stadium', 'sayref_cityhall'],
        encounters: [], hasHeal: true, region: 'selen_island'
      },
      'sayref_pokemarket': {
        name: 'Покемаркет', desc: 'Магазин товаров для тренеров.',
        image: '', links: ['sayref'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'sayref_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Сайрефе.',
        image: '', links: ['sayref'], encounters: [],
        hasHeal: true, hasWater: false, region: 'selen_island'
      },
      'sayref_air_stadium': {
        name: 'Ледяной Стадион', desc: 'Арена ледяных покемонов Прайса.',
        image: '', links: ['sayref'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'sayref_cityhall': {
        name: 'Мэрия', desc: 'Здание мэрии Сайрефа.',
        image: '', links: ['sayref'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'sel_route_13': {
        name: 'Маршрут 13 (Селен)', desc: 'Путь к Восточному тракту и дальше к Эстайр сити.',
        image: 'wiki_images/generic_route.png', links: ['sayref', 'eastern_tract'],
        encounters: ['pidgey', 'spearow'], hasHeal: false, region: 'selen_island'
      },
      'eastern_tract': {
        name: 'Восточный тракт', desc: 'Главная восточная магистраль Селена.',
        image: 'wiki_images/generic_route.png', links: ['sayref', 'sel_route_14'],
        encounters: ['tauros', 'pidgeotto'], hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'sel_route_14': {
        name: 'Маршрут 14 (Селен)', desc: 'Подъездная дорога к торговому центру — Эстайр сити.',
        image: 'wiki_images/generic_route.png', links: ['eastern_tract', 'estaire_city'],
        encounters: ['pidgey', 'rattata'], hasHeal: false, region: 'selen_island'
      },
      'estaire_city': {
        name: 'Эстайр сити', desc: 'Торговое сердце Селена с верфью, супермаркетом и аукционом.',
        image: 'wiki_images/Estajr_siti.jpg', links: ['sel_route_14', 'sel_route_15', 'sel_route_17', 'estaire_pokecenter', 'estaire_daycare_center', 'estaire_supermarket', 'estaire_water_stadium', 'estaire_south_pier', 'estaire_museum', 'estaire_private_shop'],
        encounters: [], hasHeal: true, region: 'selen_island'
      },
      'estaire_pokecenter': {
        name: 'Покецентр', desc: 'Центр лечения покемонов в Эстайр сити.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: true, hasWater: false, region: 'selen_island'
      },
      'estaire_daycare_center': {
        name: 'Центр передержки', desc: 'Центр временной передержки.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'estaire_supermarket': {
        name: 'Супермаркет', desc: 'Крупный супермаркет.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'estaire_supermarket_cozy': {
        name: 'Уютные товары', desc: 'Отдел товаров для дома.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'estaire_supermarket_upper': {
        name: 'Верхние этажи', desc: 'Верхние этажи супермаркета.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'estaire_water_stadium': {
        name: 'Стадион водных покемонов', desc: 'Неработающий стадион водного типа.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: false, hasWater: true, region: 'selen_island'
      },
      'estaire_south_pier': {
        name: 'Южный причал Селена', desc: 'Южный причал острова.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: false, hasWater: true, region: 'selen_island'
      },
      'estaire_museum': {
        name: 'Музей истории', desc: 'Музей истории острова Селен.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'estaire_private_shop': {
        name: 'Частный магазин', desc: 'Эксклюзивный частный магазин.',
        image: '', links: ['estaire_city'], encounters: [],
        hasHeal: false, hasWater: false, region: 'selen_island'
      },
      'sel_route_15': {
        name: 'Маршрут 15 (Селен)', desc: 'Живописная дорога у окраин Эстайра.',
        image: 'wiki_images/generic_route.png', links: ['estaire_city'],
        encounters: ['pidgey', 'spearow', 'tauros'], hasHeal: false, region: 'selen_island'
      },
      'sel_route_16': {
        name: 'Маршрут 16 (Селен)', desc: 'Дорога от Сайрефа к Древней горе.',
        image: 'wiki_images/generic_route.png', links: ['sayref', 'ancient_mountain', 'pasture'],
        encounters: ['snorunt', 'swinub', 'bergmite'], hasHeal: false, region: 'selen_island'
      },
      'sel_route_17': {
        name: 'Маршрут 17 (Селен)', desc: 'Дорога от Эстайра к мысу на север.',
        image: 'wiki_images/generic_route.png', links: ['estaire_city', 'cape_sel'],
        encounters: ['wingull', 'pidgeotto'], hasHeal: false, region: 'selen_island'
      },
      'sel_route_18': {
        name: 'Маршрут 18 (Селен)', desc: 'Северная дорога к причалу.',
        image: 'wiki_images/generic_route.png', links: ['cape_sel', 'north_pier_sel'],
        encounters: ['pidgey', 'rattata'], hasHeal: false, region: 'selen_island'
      },
      'sel_route_3': {
        name: 'Маршрут 3 (Селен)', desc: 'Западная дорога от Остарона к побережью.',
        image: 'wiki_images/generic_route.png', links: ['ostaron', 'shore_sel'],
        encounters: ['swinub', 'delibird', 'pidgey'], hasHeal: false, region: 'selen_island'
      },
      'sel_route_7': {
        name: 'Маршрут 7 (Селен)', desc: 'Путь к Прибрежью с живописными видами.',
        image: 'wiki_images/generic_route.png', links: ['crossroads_sel', 'coast_sel'],
        encounters: ['wingull', 'krabby', 'magikarp'], hasHeal: false, hasWater: true, region: 'selen_island'
      },
      'sel_route_8': {
        name: 'Маршрут 8 (Селен)', desc: 'Заснеженная дорога в ледяные горы.',
        image: 'wiki_images/generic_route.png', links: ['ostaron', 'ice_mountain'],
        encounters: ['snorunt', 'bergmite', 'cubchoo'], hasHeal: false, region: 'selen_island'
      },
      'ice_mountain': {
        name: 'Ледяная гора', desc: 'Величественная заснеженная гора с ледяными пещерами.',
        image: 'wiki_images/Ledjanaja_gora.jpg', links: ['sel_route_8', 'crystal_lake', 'mountain_village'],
        encounters: ['snorunt', 'bergmite', 'lapras', 'articuno'], hasHeal: false, region: 'selen_island'
      },
      'crystal_lake': {
        name: 'Кристальное озеро', desc: 'Замёрзшее кристально чистое озеро. Ледяные покемоны процветают.',
        image: 'wiki_images/Кристальная_пещера.jpg', links: ['ice_mountain'],
        encounters: ['seel', 'shellder', 'lapras'], hasHeal: false, hasWater: true, region: 'selen_island'
      },
      'mountain_village': {
        name: 'Горная деревушка', desc: 'Уютная деревня высоко в горах Селена.',
        image: 'wiki_images/generic_route.png', links: ['ice_mountain'],
        encounters: [], hasHeal: true, region: 'selen_island'
      },
      'abandoned_estate': {
        name: 'Заброшенное поместье', desc: 'Мрачное поместье, населённое призрачными покемонами.',
        image: '', links: ['sel_route_5'],
        encounters: ['gastly', 'haunter', 'misdreavus'], hasHeal: false, region: 'selen_island'
      },
      'abandoned_road_sel': {
        name: 'Заброшенная дорога', desc: 'Старая заброшенная дорога, заросшая травой.',
        image: 'wiki_images/generic_route.png', links: ['crossroads_sel'],
        encounters: ['rattata', 'grimer', 'koffing'], hasHeal: false, region: 'selen_island'
      },
      'selen_forest': {
        name: 'Лес Селена', desc: 'Густой лес в сердце острова. Огромное разнообразие травяных покемонов.',
        image: 'wiki_images/generic_route.png', links: ['crossroads_sel', 'sel_route_10'],
        encounters: ['caterpie', 'weedle', 'oddish', 'bellsprout'], hasHeal: false, region: 'selen_island'
      },
      'ancient_mountain': {
        name: 'Древняя гора', desc: 'Древняя гора с наскальными рисунками покемонов.',
        image: 'wiki_images/generic_route.png', links: ['sel_route_16', 'plateau_sel'],
        encounters: ['geodude', 'onix', 'aerodactyl', 'relicanth'], hasHeal: false, region: 'selen_island'
      },
      'plateau_sel': {
        name: 'Плато', desc: 'Высокогорное плато с разреженным воздухом.',
        image: 'wiki_images/generic_route.png', links: ['ancient_mountain'],
        encounters: ['fearow', 'skarmory', 'gligar'], hasHeal: false, region: 'selen_island'
      },
      'pasture': {
        name: 'Пастбище', desc: 'Зелёное пастбище с пасущимися покемонами.',
        image: '', links: ['sel_route_16'],
        encounters: ['mareep', 'tauros', 'miltank'], hasHeal: false, region: 'selen_island'
      },
      'antique_house': {
        name: 'Антикварный дом', desc: 'Старинный дом с редкими антикварными предметами для покемонов.',
        image: '', links: ['crossroads_sel'],
        encounters: [], hasHeal: false, region: 'selen_island'
      },
      'shore_sel': {
        name: 'Берег', desc: 'Живописный западный берег Селена с песчаными пляжами.',
        image: '', links: ['sel_route_3', 'azure_shoreline'],
        encounters: ['wingull', 'krabby', 'shellder'], hasHeal: false, hasWater: true, region: 'selen_island'
      },
      'azure_shoreline': {
        name: 'Лазурная заводь', desc: 'Красивейшая лазурная бухта с коралловыми рифами.',
        image: '', links: ['shore_sel', 'coast_sel'],
        encounters: ['magikarp', 'goldeen', 'staryu', 'corsola'], hasHeal: false, hasWater: true, region: 'selen_island'
      },
      'coast_sel': {
        name: 'Прибрежье', desc: 'Живописное прибрежье южного Селена.',
        image: '', links: ['sel_route_7', 'azure_shoreline'],
        encounters: ['tentacool', 'wingull', 'magikarp'], hasHeal: false, hasWater: true, region: 'selen_island'
      },
      'cape_sel': {
        name: 'Мыс', desc: 'Северный мыс Селена с маяком. Ветреное место.',
        image: '', links: ['sel_route_17', 'sel_route_18'],
        encounters: ['wingull', 'pelipper', 'fearow'], hasHeal: false, region: 'selen_island'
      },
      'north_pier_sel': {
        name: 'Северный причал Селена', desc: 'Причал на северной оконечности острова.',
        image: '', links: ['sel_route_18', 'speedboat_sel'],
        encounters: ['tentacool', 'magikarp', 'remoraid'], hasHeal: false, hasWater: true, region: 'selen_island'
      },
      'speedboat_sel': {
        name: 'Катер', desc: 'Скоростной катер до Оливина.',
        image: '', links: ['north_pier_sel'],
        encounters: [], hasHeal: false, region: 'selen_island'
      },
      'winding_trail': {
        name: 'Извилистая тропа', desc: 'Извилистая горная тропа с крутыми поворотами.',
        image: 'wiki_images/generic_route.png', links: ['ancient_mountain'],
        encounters: ['geodude', 'machop', 'meditite'], hasHeal: false, region: 'selen_island'
      },
      'chasm_sel': {
        name: 'Провал', desc: 'Глубокий провал в земле — вход в подземный мир покемонов.',
        image: '', links: ['abandoned_road_sel'],
        encounters: ['zubat', 'geodude', 'diglett', 'onix'], hasHeal: false, region: 'selen_island'
      },
      'old_road_sel': {
        name: 'Старая дорога', desc: 'Древняя каменная дорога неизвестного происхождения.',
        image: 'wiki_images/generic_route.png', links: ['chasm_sel', 'ancient_mountain'],
        encounters: ['rattata', 'spearow', 'sandshrew'], hasHeal: false, region: 'selen_island'
      }
    }
  },
  southern_archipelago: {
    name: 'Южный Архипелаг',
    locations: {
      'il_de_far': {
        name: 'Иль де Фар', desc: 'Главный портовый город Южного Архипелага на острове Сифам. Отсюда начинается исследование региона.',
        image: 'wiki_images/Маргарита.jpg', links: ['rocky_beach_sa', 'sandy_trail', 'ferry_sa', 'ilde_stadium'],
        encounters: [], hasHeal: true, hasWater: true, region: 'southern_archipelago'
      },
      'ilde_stadium': {
        name: 'Драконий Стадион', desc: 'Арена драконьих покемонов Клер.',
        image: '', links: ['il_de_far'], encounters: [],
        hasHeal: false, hasWater: false, region: 'southern_archipelago'
      },
      'sen_aspir': {
        name: 'Сен Аспир', desc: 'Город на острове Синнабар у подножия вулкана. Стадион для битв с покемонами.',
        image: '', links: ['foothills_sinnabung', 'rocky_bay'],
        encounters: [], hasHeal: true, region: 'southern_archipelago'
      },
      'rocky_beach_sa': {
        name: 'Каменистый пляж', desc: 'Пляж усыпанный галькой и ракушками. Водные покемоны прячутся в камнях.',
        image: 'wiki_images/Морская_дорога.jpg', links: ['il_de_far', 'strait_entre_iles', 'shallow_waters_sa'],
        encounters: ['shellder', 'krabby', 'staryu'], hasHeal: false, hasWater: true, region: 'southern_archipelago'
      },
      'sandy_trail': {
        name: 'Песчаная тропа', desc: 'Песчаная тропа через дюны вглубь острова Сифам.',
        image: 'wiki_images/Каменная_тропа.jpg', links: ['il_de_far', 'old_park_sa'],
        encounters: ['sandshrew', 'diglett', 'trapinch'], hasHeal: false, region: 'southern_archipelago'
      },
      'ferry_sa': {
        name: 'Паром', desc: 'Паромная переправа между островами архипелага.',
        image: 'wiki_images/Гавань.jpg', links: ['il_de_far', 'sen_aspir'],
        encounters: ['magikarp', 'tentacool', 'wingull'], hasHeal: false, hasWater: true, region: 'southern_archipelago'
      },
      'strait_entre_iles': {
        name: 'Пролив Антр-Иль', desc: 'Узкий пролив между островами архипелага.',
        image: '', links: ['rocky_beach_sa', 'coral_grove'],
        encounters: ['tentacool', 'magikarp', 'horsea', 'chinchou'], hasHeal: false, hasWater: true, region: 'southern_archipelago'
      },
      'coral_grove': {
        name: 'Коралловая роща', desc: 'Подводная коралловая роща с уникальными покемонами.',
        image: 'wiki_images/Мелководье.jpg', links: ['strait_entre_iles'],
        encounters: ['corsola', 'staryu', 'shellder', 'clamperl'], hasHeal: false, hasWater: true, region: 'southern_archipelago'
      },
      'shallow_waters_sa': {
        name: 'Мелководье', desc: 'Тёплые мелкие воды с большим разнообразием покемонов.',
        image: '', links: ['rocky_beach_sa', 'flooded_grotto'],
        encounters: ['magikarp', 'poliwag', 'goldeen', 'staryu'], hasHeal: false, hasWater: true, region: 'southern_archipelago'
      },
      'flooded_grotto': {
        name: 'Затопленный грот', desc: 'Полузатопленная пещера, куда можно попасть только во время отлива.',
        image: '', links: ['shallow_waters_sa'],
        encounters: ['zubat', 'wooper', 'quagsire', 'chinchou'], hasHeal: false, region: 'southern_archipelago'
      },
      'foothills_sinnabung': {
        name: 'Предгорье Синнабунга', desc: 'Предгорье вулкана Синнабунг на острове Синнабар.',
        image: '', links: ['sen_aspir', 'volcanic_caves'],
        encounters: ['growlithe', 'ponyta', 'geodude', 'rhyhorn'], hasHeal: false, region: 'southern_archipelago'
      },
      'volcanic_caves': {
        name: 'Вулканические пещеры', desc: 'Горячие пещеры в жерле потухшего вулкана.',
        image: 'wiki_images/generic_route.png', links: ['foothills_sinnabung'],
        encounters: ['magmar', 'slugma', 'torkoal', 'numel'], hasHeal: false, region: 'southern_archipelago'
      },
      'rocky_bay': {
        name: 'Скалистый залив', desc: 'Живописный залив со скалистыми берегами.',
        image: '', links: ['sen_aspir', 'orlua_estate'],
        encounters: ['tentacool', 'magikarp', 'krabby'], hasHeal: false, hasWater: true, region: 'southern_archipelago'
      },
      'old_park_sa': {
        name: 'Старый парк', desc: 'Заброшенный парк развлечений на Сифаме.',
        image: 'wiki_images/Золотой_лес.jpg', links: ['sandy_trail'],
        encounters: ['gastly', 'misdreavus', 'shuppet'], hasHeal: false, region: 'southern_archipelago'
      },
      'ice_cave_sa': {
        name: 'Ледяная пещера', desc: 'Аномально холодная пещера посреди тропического архипелага.',
        image: 'wiki_images/generic_route.png', links: ['foothills_sinnabung'],
        encounters: ['snorunt', 'spheal', 'sneasel', 'lapras'], hasHeal: false, region: 'southern_archipelago'
      },
      'orlua_estate': {
        name: 'Поместье Орлуа', desc: 'Роскошное поместье с привидениями. Мрачные тайны и редкие покемоны.',
        image: '', links: ['rocky_bay'],
        encounters: ['gastly', 'haunter', 'gengar', 'rotom'], hasHeal: false, region: 'southern_archipelago'
      }
    }
  }
};

function getLocation(locId) {
  for (const region of Object.values(REGIONS)) {
    if (region.locations[locId]) return region.locations[locId];
  }
  return null;
}
function getRegionOfLocation(locId) {
  for (const [key, region] of Object.entries(REGIONS)) {
    if (region.locations[locId]) return key;
  }
  return 'kanto';
}

// Transport hubs between regions
const TRANSPORT_HUBS = {
  'olivine': [
    { label: '🚢 Паром в Канто (Вермилион)', targetRegion: 'kanto', targetLoc: 'vermilion', ticket: 'ticketBoatJK' },
    { label: '🚤 Катер на о.Селен (Остарон)', targetRegion: 'selen_island', targetLoc: 'ostaron', ticket: 'ticketBoatJS' },
  ],
  'vermilion_port': [
    { label: '🚢 Паром в Джото (Оливин)', targetRegion: 'east_johto', targetLoc: 'olivine', ticket: 'ticketBoatJK' },
  ],
  'warhall_bus_station': [
    { label: '🚌 Автобус в Зап.Джото (Саммер)', targetRegion: 'west_johto', targetLoc: 'summer', ticket: 'ticketBusJ' },
  ],
  'summer': [
    { label: '🚌 Автобус в Вост.Джото (Вархолл)', targetRegion: 'east_johto', targetLoc: 'warhall', ticket: 'ticketBusJ' },
  ],
  'saffron_east_station': [
    { label: '🚂 Поезд в Джото (Голденрод)', targetRegion: 'east_johto', targetLoc: 'goldenrod', ticket: 'ticketTrainJK' },
  ],
  'goldenrod': [
    { label: '🚂 Поезд в Канто (Шаффран)', targetRegion: 'kanto', targetLoc: 'saffron', ticket: 'ticketTrainJK' },
  ],
  'ostaron': [
    { label: '🚤 Катер в Джото (Оливин)', targetRegion: 'east_johto', targetLoc: 'olivine', ticket: 'ticketBoatJS' },
  ],
  'fuchsia_beach_pier': [
    { label: '⛴ Паром в Южн. Архипелаг (Иль де Фар)', targetRegion: 'southern_archipelago', targetLoc: 'il_de_far', ticket: 'ticketFerryKS' },
  ],
  'il_de_far': [
    { label: '⛴ Паром в Канто (Фуксия)', targetRegion: 'kanto', targetLoc: 'fuchsia_city', ticket: 'ticketFerryKS' },
  ],
};


function travelToRegion(targetRegion, targetLoc, ticketItemId) {
  if (!hasItem(ticketItemId)) {
    showToast(`Нужен билет: ${itemDef(ticketItemId).nameRu}!`, true);
    return;
  }
  
  const currentHour = new Date().getHours();
  let schedule = [];
  
  if (ticketItemId === 'ticketBoatJK' || ticketItemId === 'ticketBoatJS') {
    schedule = [10, 14, 18, 22];
  } else if (ticketItemId === 'ticketTrainJK') {
    schedule = [8, 12, 16, 20];
  } else if (ticketItemId === 'ticketBusJ') {
    schedule = [9, 13, 17, 21];
  } else if (ticketItemId === 'ticketFerryKS') {
    schedule = [15]; // Only at 15:00
    const day = new Date().getDate();
    if (day % 2 === 0) {
      showToast('Паром в Южный Архипелаг ходит только по нечётным числам месяца!', true);
      return;
    }
  }

  if (!schedule.includes(currentHour)) {
    showToast(`Транспорт сейчас недоступен! Расписание отправлений: ${schedule.map(h => h + ':00').join(', ')}. Текущее время сервера: ${currentHour}:00`, true);
    return;
  }

  removeItem(ticketItemId, 1);
  currentRegion = targetRegion;
  appendToLog(`Вы отправились в регион ${REGIONS[targetRegion].name}!`, false, 'quest');
  renderLocation(targetLoc);
}

let currentLocationId = 'pallet_town';
let lastLocation = null;
let currentRegion = 'kanto';
let huntActive = false;
let huntTimer = null;
let expShareActive = false;

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
  { name: 'Отсутствует', pct: 0, color: '#888' },
  { name: 'Начальная', pct: 10, color: '#8090E8' },
  { name: 'Расширенная', pct: 18, color: '#4088D0' },
  { name: 'Мастерская', pct: 25, color: '#18A8C8' },
  { name: 'Знаменитая', pct: 31, color: '#10C048' },
  { name: 'Легендарная', pct: 36, color: '#E0A800' },
  { name: 'Именная', pct: 40, color: '#E84000' }
];

// ==================== ITEMS DATABASE ====================
// Карта камней эволюции → PokeAPI триггер-названия
const STONE_ITEM_MAP = {
  'evolutionStone': null,
  'fireStone': 'fire-stone',
  'waterStone': 'water-stone',
  'leafStone': 'leaf-stone',
  'thunderStone': 'thunder-stone',
  'moonStone': 'moon-stone',
  'sunStone': 'sun-stone',
  'shinyStone': 'shiny-stone',
  'duskStone': 'dusk-stone',
  'iceStone': 'ice-stone',
  'dawnStone': 'dawn-stone',
};

// Централизованная база всех предметов в игре
const ITEMS = [
  // ── Валюта ──
  { id: 'credit', nameRu: 'Кредит', category: 'currency', desc: 'Игровая валюта', sprite: '💰', spriteType: 'emoji', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  // ── Покеболы ──
  { id: 'pokeball', nameRu: 'Покебол', category: 'balls', desc: 'Шанс поимки x1', sprite: 'Ball1.png', spriteType: 'local', price: 200, sellPrice: 100, isUsable: false, isBall: true, ballMult: 1, implemented: true },
  { id: 'greatBall', nameRu: 'Гритбол', category: 'balls', desc: 'Шанс поимки x1.5', sprite: 'Ball2.png', spriteType: 'local', price: 600, sellPrice: 300, isUsable: false, isBall: true, ballMult: 1.5, implemented: true },
  { id: 'ultraBall', nameRu: 'Ультрабол', category: 'balls', desc: 'Шанс поимки x2', sprite: 'Ball3.png', spriteType: 'local', price: 1200, sellPrice: 600, isUsable: false, isBall: true, ballMult: 2, implemented: true },
  { id: 'masterBall', nameRu: 'Мастербол', category: 'balls', desc: '100% поимка', sprite: '62.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: true, ballMult: 255, implemented: true },
  { id: 'quickBall', nameRu: 'Квикбол', category: 'balls', desc: 'x5 в первом раунде', sprite: 'Ball5.png', spriteType: 'local', price: 3000, sellPrice: 1500, isUsable: false, isBall: true, ballMult: 1, implemented: true },
  { id: 'friendBall', nameRu: 'Френдбол', category: 'balls', desc: 'Характер → Мирный', sprite: 'Ball4.png', spriteType: 'local', price: 5000, sellPrice: 2500, isUsable: false, isBall: true, ballMult: 1, implemented: true },
  { id: 'loveBall', nameRu: 'Лавбол', category: 'balls', desc: 'x8 если противоп. пол', sprite: 'Ball6.png', spriteType: 'local', price: 3000, sellPrice: 1500, isUsable: false, isBall: true, ballMult: 1, implemented: true },
  { id: 'duskBall', nameRu: 'Даскбол', category: 'balls', desc: 'x3 в ночное время', sprite: 'Daskbol.png', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: true, ballMult: 1, implemented: true },
  { id: 'timerBall', nameRu: 'Таймербол', category: 'balls', desc: 'x1 +0.3/раунд', sprite: 'P78.png', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: true, ballMult: 1, implemented: true },
  { id: 'cloneBall', nameRu: 'Клонбол', category: 'balls', desc: 'Для поимки клонов', sprite: 'klonbol.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: true, ballMult: 1, implemented: false },
  { id: 'centerBall', nameRu: 'Центрбол', category: 'balls', desc: 'x2, игнор. лимит', sprite: 'ball7.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: true, ballMult: 2, implemented: false },
  { id: 'darkBall', nameRu: 'Даркбол', category: 'balls', desc: 'x2, +5 гены', sprite: '72.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: true, ballMult: 2, implemented: true },

  // ── Восстановление HP ──
  { id: 'potion', nameRu: 'Аптечка', category: 'healing', desc: '+20 HP', sprite: '38.gif', spriteType: 'local', price: 300, sellPrice: 150, isUsable: true, isBall: false, implemented: true },
  { id: 'superPotion', nameRu: 'Супер Аптечка', category: 'healing', desc: '+50 HP', sprite: '50.gif', spriteType: 'local', price: 700, sellPrice: 350, isUsable: true, isBall: false, implemented: true },
  { id: 'fullRestore', nameRu: 'Полное Восстановление', category: 'healing', desc: 'Все HP + статус', sprite: '29.gif', spriteType: 'local', price: 2500, sellPrice: 1250, isUsable: true, isBall: false, implemented: true },
  { id: 'stimulator', nameRu: 'Стимулятор', category: 'healing', desc: 'Восстанавливает НР', sprite: '51.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: false },
  { id: 'superStimulator', nameRu: 'Суперстимулятор', category: 'healing', desc: 'Сильное восстановление', sprite: 'cstim.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },

  // ── Лечение статусов ──
  { id: 'antidote', nameRu: 'Антидот', category: 'statusCure', desc: 'Лечит отравление', sprite: '3.gif', spriteType: 'local', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },
  { id: 'antiparalyze', nameRu: 'Антипарализ', category: 'statusCure', desc: 'Лечит паралич', sprite: '36.gif', spriteType: 'local', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },
  { id: 'energyDrink', nameRu: 'Энергетик', category: 'statusCure', desc: 'Лечит сон', sprite: '4.gif', spriteType: 'local', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },
  { id: 'fireExtinguisher', nameRu: 'Огнетушитель', category: 'statusCure', desc: 'Лечит ожог', sprite: '9.gif', spriteType: 'local', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },
  { id: 'antiSputin', nameRu: 'Анти-Спутин', category: 'statusCure', desc: 'Лечит спутанность', sprite: '13.gif', spriteType: 'local', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },
  { id: 'healingHerb', nameRu: 'Лечебная трава', category: 'statusCure', desc: 'Снимает все статусы', sprite: '173.gif', spriteType: 'local', price: 0, sellPrice: 200, isUsable: true, isBall: false, implemented: true },

  // ── Восстановление PP ──
  { id: 'weakElixir', nameRu: 'Слабый эликсир', category: 'ppRecovery', desc: '+10 PP всем атакам', sprite: '15.gif', spriteType: 'local', price: 500, sellPrice: 250, isUsable: true, isBall: false, implemented: true },
  { id: 'elixir', nameRu: 'Эликсир', category: 'ppRecovery', desc: '+20 PP всем атакам', sprite: '16.gif', spriteType: 'local', price: 1000, sellPrice: 500, isUsable: true, isBall: false, implemented: true },
  { id: 'strongElixir', nameRu: 'Мощный эликсир', category: 'ppRecovery', desc: '+40 PP всем атакам', sprite: '17.gif', spriteType: 'local', price: 2000, sellPrice: 1000, isUsable: true, isBall: false, implemented: true },

  // ── Витамины ──
  { id: 'vitamin', nameRu: 'Витамин', category: 'vitamins', desc: '+10 макс. EV', sprite: '59.gif', spriteType: 'local', price: 2000, sellPrice: 1000, isUsable: true, isBall: false, implemented: true },
  { id: 'protein', nameRu: 'Протеин', category: 'vitamins', desc: '+10 EV Атаки', sprite: '59.gif', spriteType: 'local', price: 2500, sellPrice: 1250, isUsable: true, isBall: false, implemented: true },
  { id: 'iron', nameRu: 'Железо', category: 'vitamins', desc: '+10 EV Защиты', sprite: '39.gif', spriteType: 'local', price: 2500, sellPrice: 1250, isUsable: true, isBall: false, implemented: true },
  { id: 'calcium', nameRu: 'Кальций', category: 'vitamins', desc: '+10 EV Спец.Атаки', sprite: '23.gif', spriteType: 'local', price: 2500, sellPrice: 1250, isUsable: true, isBall: false, implemented: true },
  { id: 'zinc', nameRu: 'Цинк', category: 'vitamins', desc: '+10 EV Спец.Защиты', sprite: '11.gif', spriteType: 'local', price: 2500, sellPrice: 1250, isUsable: true, isBall: false, implemented: true },
  { id: 'carbos', nameRu: 'Углеводы', category: 'vitamins', desc: '+10 EV Скорости', sprite: '24.gif', spriteType: 'local', price: 2500, sellPrice: 1250, isUsable: true, isBall: false, implemented: true },

  // ── Камни Эволюции ──
  { id: 'evolutionStone', nameRu: 'Камень Эволюции', category: 'evolutionStones', desc: 'Вызывает эволюцию', sprite: '136.gif', spriteType: 'local', price: 5000, sellPrice: 2500, isUsable: true, isBall: false, implemented: true },
  { id: 'fireStone', nameRu: 'Огненный камень', category: 'evolutionStones', desc: 'Эволюция огненных', sprite: '131.gif', spriteType: 'local', price: 120000, sellPrice: 60000, isUsable: true, isBall: false, implemented: true },
  { id: 'waterStone', nameRu: 'Водный камень', category: 'evolutionStones', desc: 'Эволюция водных', sprite: '132.gif', spriteType: 'local', price: 500000, sellPrice: 250000, isUsable: true, isBall: false, implemented: true },
  { id: 'leafStone', nameRu: 'Лиственный камень', category: 'evolutionStones', desc: 'Эволюция травяных', sprite: '133.gif', spriteType: 'local', price: 300000, sellPrice: 150000, isUsable: true, isBall: false, implemented: true },
  { id: 'thunderStone', nameRu: 'Громовой камень', category: 'evolutionStones', desc: 'Эволюция эл.типа', sprite: '134.gif', spriteType: 'local', price: 510000, sellPrice: 255000, isUsable: true, isBall: false, implemented: true },
  { id: 'moonStone', nameRu: 'Лунный камень', category: 'evolutionStones', desc: 'Эволюция лунных', sprite: '135.gif', spriteType: 'local', price: 250000, sellPrice: 125000, isUsable: true, isBall: false, implemented: true },
  { id: 'sunStone', nameRu: 'Солнечный камень', category: 'evolutionStones', desc: 'Эволюция солнечных', sprite: '136.gif', spriteType: 'local', price: 300000, sellPrice: 150000, isUsable: true, isBall: false, implemented: true },
  { id: 'shinyStone', nameRu: 'Сияющий камень', category: 'evolutionStones', desc: 'Эволюция', sprite: '246.gif', spriteType: 'local', price: 0, sellPrice: 50000, isUsable: true, isBall: false, implemented: true },
  { id: 'duskStone', nameRu: 'Мрачный камень', category: 'evolutionStones', desc: 'Эволюция', sprite: '247.gif', spriteType: 'local', price: 0, sellPrice: 50000, isUsable: true, isBall: false, implemented: true },
  { id: 'iceStone', nameRu: 'Ледяной камень', category: 'evolutionStones', desc: 'Эволюция', sprite: '434.png', spriteType: 'local', price: 0, sellPrice: 50000, isUsable: true, isBall: false, implemented: true },
  { id: 'dawnStone', nameRu: 'Камень Зари', category: 'evolutionStones', desc: 'Эволюция', sprite: '253.gif', spriteType: 'local', price: 0, sellPrice: 50000, isUsable: true, isBall: false, implemented: true },
  { id: 'everstone', nameRu: 'Камень вечности', category: 'evolutionStones', desc: 'Блокирует эволюцию', sprite: 'everstone.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },

  // ── Ягоды ──
  { id: 'sitrusBerry', nameRu: 'Ситрус Ягода', category: 'berries', desc: '+25% HP в бою', sprite: 'sitrus-berry.png', spriteType: 'local', price: 800, sellPrice: 400, isUsable: true, isBall: false, implemented: true },
  { id: 'oranBerry', nameRu: 'Оран Ягода', category: 'berries', desc: '+10 HP в бою', sprite: 'oran-berry.png', spriteType: 'local', price: 400, sellPrice: 200, isUsable: true, isBall: false, implemented: true },
  { id: 'lumBerry', nameRu: 'Лум Ягода', category: 'berries', desc: 'Снимает статус в бою', sprite: 'lum-berry.png', spriteType: 'local', price: 1200, sellPrice: 600, isUsable: true, isBall: false, implemented: true },
  { id: 'chestoBerry', nameRu: 'Често Ягода', category: 'berries', desc: 'Лечит сон в бою', sprite: 'chesto-berry.png', spriteType: 'local', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },
  { id: 'rawstBerry', nameRu: 'Рост Ягода', category: 'berries', desc: 'Лечит ожог в бою', sprite: 'rawst-berry.png', spriteType: 'local', price: 200, sellPrice: 100, isUsable: true, isBall: false, implemented: true },
  { id: 'cheriBerry', nameRu: 'Чери Ягода', category: 'berries', desc: 'Лечит паралич в бою', sprite: 'cheri-berry.png', spriteType: 'local', price: 200, sellPrice: 100, isUsable: false, isBall: false, implemented: false },
  { id: 'pechaBerry', nameRu: 'Печа Ягода', category: 'berries', desc: 'Лечит отравление', sprite: 'pecha-berry.png', spriteType: 'local', price: 200, sellPrice: 100, isUsable: false, isBall: false, implemented: false },
  { id: 'aspearBerry', nameRu: 'Аспир Ягода', category: 'berries', desc: 'Лечит заморозку', sprite: 'aspear-berry.png', spriteType: 'local', price: 200, sellPrice: 100, isUsable: false, isBall: false, implemented: false },
  { id: 'leppaBerry', nameRu: 'Леппа Ягода', category: 'berries', desc: '+10 PP', sprite: 'leppa-berry.png', spriteType: 'local', price: 500, sellPrice: 250, isUsable: false, isBall: false, implemented: false },
  { id: 'persimBerry', nameRu: 'Персим Ягода', category: 'berries', desc: 'Лечит спутанность', sprite: 'persim-berry.png', spriteType: 'local', price: 200, sellPrice: 100, isUsable: false, isBall: false, implemented: false },
  { id: 'figyBerry', nameRu: 'Фиги Ягода', category: 'berries', desc: 'Ягода', sprite: 'figy-berry.png', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: false },
  { id: 'wikiBerry', nameRu: 'Вики Ягода', category: 'berries', desc: 'Ягода', sprite: 'wiki-berry.png', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: false },

  // ── Тренировка ──
  { id: 'train', nameRu: 'Набор Тренировки', category: 'training', desc: 'Улучшает случайный стат', sprite: 'train.gif', spriteType: 'local', price: 5000, sellPrice: 2500, isUsable: true, isBall: false, implemented: true },
  { id: 'weaken', nameRu: 'Набор Ослабления', category: 'training', desc: 'Снижает тренировку на 1', sprite: 'oslab.png', spriteType: 'local', price: 1000, sellPrice: 500, isUsable: true, isBall: false, implemented: true },
  { id: 'personalTrain', nameRu: 'Личный набор тренировки', category: 'training', desc: 'Улучшает стат (личный)', sprite: 'lich.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'coffee', nameRu: 'Крепкий кофе', category: 'training', desc: 'Защита от сна на 2 хода', sprite: '286.gif', spriteType: 'local', price: 30000, sellPrice: 15000, isUsable: false, isBall: false, implemented: false },
  { id: 'apricornRoot', nameRu: 'Корень Априкорна', category: 'training', desc: 'Сброс EV покемона', sprite: '288.gif', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },

  // ── Конфеты ──
  { id: 'candy', nameRu: 'Сладкая Конфета', category: 'other', desc: '+1 уровень, +4 EV', sprite: '41.gif', spriteType: 'local', price: 1000, sellPrice: 500, isUsable: true, isBall: false, implemented: true },
  { id: 'vanillaCandy', nameRu: 'Ванильная конфета', category: 'other', desc: '+1 уровень, +2 EV', sprite: '309.gif', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'sweetCandy', nameRu: 'Сладкая конфета', category: 'other', desc: '+1 уровень, +4 EV', sprite: '269.gif', spriteType: 'local', price: 0, sellPrice: 700, isUsable: false, isBall: false, implemented: false },
  { id: 'typeCandy', nameRu: 'Типовая конфета', category: 'other', desc: '+1 уровень, счастье +1', sprite: '481.png', spriteType: 'local', price: 0, sellPrice: 600, isUsable: false, isBall: false, implemented: false },
  { id: 'surpriseCandy', nameRu: 'Конфета Сюрприз', category: 'other', desc: 'Случайный вкус!', sprite: '499.png', spriteType: 'local', price: 0, sellPrice: 800, isUsable: false, isBall: false, implemented: false },

  // ── Прочее ──
  { id: 'skoba', nameRu: 'Скоба', category: 'other', desc: 'Эффект усиления EV на 90 дней', sprite: '27.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'tm', nameRu: 'TM-совместимость', category: 'other', desc: 'Переучивание атак', sprite: '1064.gif', spriteType: 'local', price: 3000, sellPrice: 1500, isUsable: true, isBall: false, implemented: true },
  { id: 'ppUp', nameRu: 'Увеличитель PP', category: 'other', desc: '+20% макс. PP атаки (макс. 3 раза)', sprite: '451.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: true, isBall: false, implemented: true },
  { id: 'greenScarf', nameRu: 'Зелёный шарф', category: 'other', desc: 'Блокирует получение опыта', sprite: '161.gif', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'expShare', nameRu: 'Распределитель опыта', category: 'other', desc: 'Делит опыт между командой', sprite: '93.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: true, isBall: false, implemented: true },
  { id: 'eggBroth', nameRu: 'Яичный отвар', category: 'other', desc: 'Увеличивает счастье', sprite: '448q.png', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'luckAmulet', nameRu: 'Амулет удачи', category: 'other', desc: '+10% дроп кредитов', sprite: '2b.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },

  // ── Лигабол (Покеболы) ──
  { id: 'ligaBall', nameRu: 'Лигабол', category: 'balls', desc: 'Лига-бол', sprite: 'P76.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: true, ballMult: 1, implemented: false },

  // ── Регенераторы (дополнительные) ──
  { id: 'healingPotion', nameRu: 'Зелье исцеления', category: 'healing', desc: 'Снимает все статусы в бою', sprite: '21.gif', spriteType: 'local', price: 500, sellPrice: 250, isUsable: false, isBall: false, implemented: false },
  { id: 'miltankMilk', nameRu: 'Молоко Милтанк', category: 'healing', desc: 'Восстанавливает HP', sprite: 'Milk.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'superStimpak', nameRu: 'Улучшенный стимпак', category: 'healing', desc: 'Сильное восстановление', sprite: 'Ustim.png', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },

  // ── Боевые предметы (Hold Items) ──
  { id: 'sparkles', nameRu: 'Блёстки', category: 'battle', desc: '-10% точности атак по покемону', sprite: '8.gif', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'band', nameRu: 'Повязка', category: 'battle', desc: '12% шанс остаться с 1 HP', sprite: '20.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'patienceBand', nameRu: 'Повязка терпения', category: 'battle', desc: 'При полном HP сохранит 1 HP', sprite: '77.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'powerBracer', nameRu: 'Силовой Браслет', category: 'battle', desc: '+10% физ. атаки', sprite: '75.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'xraySpecs', nameRu: 'Очки прозрения', category: 'battle', desc: '+10% спец. атаки', sprite: '78.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'crown', nameRu: 'Корона', category: 'battle', desc: '12% шанс напугать противника', sprite: '25.gif', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: false },

  // ── Модификаторы (дополнительные) ──
  { id: 'plasticSkoba', nameRu: 'Пластиковая скоба', category: 'training', desc: 'Пластиковый усилитель', sprite: '30.gif', spriteType: 'local', price: 0, sellPrice: 800, isUsable: false, isBall: false, implemented: false },
  { id: 'skobaRing', nameRu: 'Скобовое кольцо', category: 'training', desc: 'Кольцо-усилитель', sprite: '42.gif', spriteType: 'local', price: 0, sellPrice: 1200, isUsable: false, isBall: false, implemented: false },
  { id: 'iodine', nameRu: 'Йод', category: 'vitamins', desc: 'Улучшает статы', sprite: '10.gif', spriteType: 'local', price: 2000, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'xAttack', nameRu: 'X Атака', category: 'battle', desc: '+1 атака в бою', sprite: '54.gif', spriteType: 'local', price: 500, sellPrice: 250, isUsable: true, isBall: false, implemented: true },
  { id: 'xDefense', nameRu: 'X Защита', category: 'battle', desc: '+1 защита в бою', sprite: '55.gif', spriteType: 'local', price: 500, sellPrice: 250, isUsable: true, isBall: false, implemented: true },
  { id: 'xSpDefense', nameRu: 'X Спец.Защита', category: 'battle', desc: '+1 спец.защита в бою', sprite: '56.gif', spriteType: 'local', price: 500, sellPrice: 250, isUsable: true, isBall: false, implemented: true },
  { id: 'xSpAttack', nameRu: 'Х Спец.Атака', category: 'battle', desc: '+1 спец.атака в бою', sprite: '57.gif', spriteType: 'local', price: 500, sellPrice: 250, isUsable: true, isBall: false, implemented: true },
  { id: 'xSpeed', nameRu: 'Х Скорость', category: 'battle', desc: '+1 скорость в бою', sprite: '58.gif', spriteType: 'local', price: 500, sellPrice: 250, isUsable: true, isBall: false, implemented: true },
  { id: 'xAccuracy', nameRu: 'Х Точность', category: 'battle', desc: '+1 точность в бою', sprite: '53.gif', spriteType: 'local', price: 500, sellPrice: 250, isUsable: true, isBall: false, implemented: true },
  { id: 'cottonCandy', nameRu: 'Сахарная вата', category: 'other', desc: 'Сладкое лакомство', sprite: '436q.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: false },
  { id: 'sugarPie', nameRu: 'Сахарный пирог', category: 'other', desc: 'Сладкий пирог', sprite: '437q.png', spriteType: 'local', price: 0, sellPrice: 300, isUsable: false, isBall: false, implemented: false },
  { id: 'superEggBroth', nameRu: 'Улучшенный яичный отвар', category: 'other', desc: 'Сильно увеличивает счастье', sprite: 'Ya581.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'separationPotion', nameRu: 'Зелье разлуки', category: 'other', desc: 'Разлучает покемонов', sprite: '438q.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'friendshipPotion', nameRu: 'Зелье дружбы', category: 'other', desc: 'Увеличивает дружбу', sprite: '443q.png', spriteType: 'local', price: 0, sellPrice: 800, isUsable: false, isBall: false, implemented: false },
  { id: 'charModule', nameRu: 'Модуль Характера', category: 'training', desc: 'Изменяет характер', sprite: 'M118.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'trainModule', nameRu: 'Модуль Тренировки', category: 'training', desc: 'Модифицирует тренировку', sprite: 'M119.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'genocodeModule', nameRu: 'Модуль Генокода', category: 'training', desc: 'Модифицирует генокод', sprite: 'M120.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'attackModule', nameRu: 'Модуль Атаки', category: 'training', desc: 'Модифицирует атаку', sprite: 'M121.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'mint', nameRu: 'Мята', category: 'training', desc: 'Изменяет характеристики', sprite: 'M122.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'amurit', nameRu: 'Амурит', category: 'evolutionStones', desc: 'Позволяет разводить бесполых', sprite: '291.gif', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },

  // ── Эвольверы (не-камни) ──
  { id: 'deepSeaTooth', nameRu: 'Глубоководный зуб', category: 'evolutionStones', desc: 'Эволюция Хантила', sprite: '137.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'deepSeaScale', nameRu: 'Глубоководная чешуя', category: 'evolutionStones', desc: 'Эволюция Горебисса', sprite: '138.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'dragonScale', nameRu: 'Чешуя дракона', category: 'evolutionStones', desc: 'Эволюция Кингдры', sprite: '139.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'upGrade', nameRu: 'Модернизатор', category: 'evolutionStones', desc: 'Эволюция Поригона-2', sprite: '140.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },

  // ── Квестовые ──
  { id: 'quartz', nameRu: 'Кварц', category: 'quest', desc: 'Драгоценный камень (частый)', sprite: '150.gif', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: true },
  { id: 'malachite', nameRu: 'Малахит', category: 'quest', desc: 'Драгоценный камень (нередкий)', sprite: '151.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: true },
  { id: 'lapisLazuli', nameRu: 'Лазурит', category: 'quest', desc: 'Драгоценный камень (редкий)', sprite: '152.gif', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: true },
  { id: 'onyx', nameRu: 'Оникс', category: 'quest', desc: 'Драгоценный камень (очень редкий)', sprite: '153.gif', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: true },
  { id: 'seviperVenom', nameRu: 'Яд Сивайпера', category: 'quest', desc: 'Отравляющий фермент', sprite: '265.gif', spriteType: 'local', price: 0, sellPrice: 300, isUsable: false, isBall: false, implemented: true },
  { id: 'cacneaSpines', nameRu: 'Колючки Какнея', category: 'quest', desc: 'Острые шипы', sprite: '266.gif', spriteType: 'local', price: 0, sellPrice: 300, isUsable: false, isBall: false, implemented: true },
  { id: 'coals', nameRu: 'Угольки', category: 'quest', desc: 'Горячие угольки', sprite: '276.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },

  // ── Покеболы (доп) ──
  { id: 'superDarkBall', nameRu: 'Супердаркбол', category: 'balls', desc: '+6 ген (шайни +7)', sprite: 'P79.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: true, ballMult: 1, implemented: true },

  // ── Эвольверы (доп) ──
  { id: 'happinessEvolver', nameRu: 'Эволвер Счастья', category: 'evolutionStones', desc: 'Эволюция по счастью', sprite: '143.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'ovalStone', nameRu: 'Овальный камень', category: 'evolutionStones', desc: 'Эволюция Хаппини', sprite: '251.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'superUpGrade', nameRu: 'Улучшенный модернизатор', category: 'evolutionStones', desc: 'Эволюция Поригона-Z', sprite: '252.gif', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'knowledgeEvolver', nameRu: 'Эволвер Знаний', category: 'evolutionStones', desc: 'Эволюция по обмену/знаниям', sprite: '295.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },

  // ── Боевые холдеры (доп) ──
  { id: 'leftovers', nameRu: 'Объедки', category: 'battle', desc: '+1/16 HP каждый раунд', sprite: '26.gif', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: true },
  { id: 'claw', nameRu: 'Коготь', category: 'battle', desc: '20% шанс атаковать первым', sprite: '40.gif', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: false },
  { id: 'airBalloon', nameRu: 'Воздушный Шарик', category: 'battle', desc: 'Защита от земляных атак', sprite: '85.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: true },
  { id: 'amuletCoin', nameRu: 'Монета-Амулет', category: 'battle', desc: 'x2 кредитов за бой', sprite: 'Item206.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'lens', nameRu: 'Линзы', category: 'battle', desc: 'Увеличивает шанс крит.удара', sprite: '43.gif', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'whiteBell', nameRu: 'Белый колокольчик', category: 'battle', desc: '+1/8 HP от нанесенного урона', sprite: '45.gif', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'magnifier', nameRu: 'Лупа', category: 'battle', desc: '+10% точность', sprite: '293.gif', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: false },
  { id: 'flameOrb', nameRu: 'Сфера Пламени', category: 'battle', desc: 'Поджигает носителя', sprite: '1107.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'toxicOrb', nameRu: 'Сфера Яда', category: 'battle', desc: 'Отравляет носителя', sprite: '1006.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'rageOrb', nameRu: 'Сфера Ярости', category: 'battle', desc: '+25% урон, -10% HP', sprite: '232.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'lifeOrb', nameRu: 'Сфера Жизни', category: 'battle', desc: '+30% урон, -10% HP за атаку', sprite: 'lifeOrb.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: true },
  { id: 'rockyHelmet', nameRu: 'Каменный шлем', category: 'battle', desc: '1/6 HP урона атакующему при контакте', sprite: 'rockyHelmet.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: true },
  { id: 'focusSash', nameRu: 'Фокусный пояс', category: 'battle', desc: 'Оставляет 1 HP при OHKO с полного HP', sprite: 'focusSash.png', spriteType: 'local', price: 0, sellPrice: 4000, isUsable: false, isBall: false, implemented: true },
  { id: 'shell', nameRu: 'Раковина', category: 'battle', desc: 'Защита от удержания', sprite: '233.gif', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: false },
  { id: 'glowingGlue', nameRu: 'Светящийся клей', category: 'battle', desc: '+8 раундов Reflect/Light Screen', sprite: '225.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'blackSludge', nameRu: 'Черная грязь', category: 'battle', desc: 'Ядовитым: +1/16 HP, иным: яд', sprite: '76.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'redCard', nameRu: 'Красная карточка', category: 'battle', desc: 'Выгоняет атакующего', sprite: '374.gif', spriteType: 'local', price: 0, sellPrice: 2500, isUsable: false, isBall: false, implemented: false },
  { id: 'stoneCascade', nameRu: 'Каменная каска', category: 'battle', desc: 'Ранят при контакте (1/6 HP)', sprite: '89.png', spriteType: 'local', price: 0, sellPrice: 2500, isUsable: false, isBall: false, implemented: false },
  { id: 'durableThorns', nameRu: 'Прочные колючки', category: 'battle', desc: 'Просыпается после усыпления', sprite: '91q.png', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: false },
  { id: 'bigMagnifier', nameRu: 'Увеличивающая лупа', category: 'battle', desc: '+20% точности если медленнее', sprite: '87.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'rotoBoost', nameRu: 'Roto-Усилитель', category: 'battle', desc: '+1 стат для Rotom', sprite: '92.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'luckyGlove', nameRu: 'Фартовая перчатка', category: 'battle', desc: 'Крит для Chansey', sprite: '96.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'expertBelt', nameRu: 'Пояс эксперта', category: 'battle', desc: '+20% при эффективной атаке', sprite: '97.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: true },
  { id: 'bigRoot', nameRu: 'Большой корень', category: 'battle', desc: '+30% отнятых HP', sprite: '95.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: true },
  { id: 'assaultVest', nameRu: 'Штурмовой жилет', category: 'battle', desc: '+50% Спец.Защиты, нельзя статус-атаки', sprite: '94.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: true },
  { id: 'soulDrop', nameRu: 'Капля Души', category: 'battle', desc: '+20% урон Latias/Latios', sprite: '98.png', spriteType: 'local', price: 0, sellPrice: 4000, isUsable: false, isBall: false, implemented: false },
  { id: 'choiceBand', nameRu: 'Повязка выбора', category: 'battle', desc: 'Атака +50%, но 1 атака', sprite: '111.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: true },
  { id: 'choiceScarf', nameRu: 'Шарф выбора', category: 'battle', desc: 'Скорость +50%, но 1 атака', sprite: '112.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: true },
  { id: 'choiceSpecs', nameRu: 'Очки выбора', category: 'battle', desc: 'Спец.Атака +50%, но 1 атака', sprite: '113.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: true },
  { id: 'heatRock', nameRu: 'Горячий камень', category: 'battle', desc: 'Солнце 8 раундов', sprite: '126.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'dampRock', nameRu: 'Влажный камень', category: 'battle', desc: 'Дождь 8 раундов', sprite: '127.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'porousRock', nameRu: 'Пористый камень', category: 'battle', desc: 'Песчаная буря 8 раундов', sprite: '128.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'coldRock', nameRu: 'Холодный камень', category: 'battle', desc: 'Снег 8 раундов', sprite: '129.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'thickClub', nameRu: 'Массивная кость', category: 'battle', desc: 'x2 атака Cubone/Marowak', sprite: 'Item131.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: true },
  { id: 'leek', nameRu: 'Лук-порей', category: 'battle', desc: '+2 крит Farfetchd/Sirfetchd', sprite: 'Item132.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: true },
  { id: 'eviolite', nameRu: 'Эвиолит', category: 'battle', desc: '+50% Защ/Спец.Защ (если может эволюционировать)', sprite: 'Evolit.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: true },
  { id: 'fakeBrooch', nameRu: 'Подделанная брошь', category: 'battle', desc: '+15% статов (сумма <=460)', sprite: 'Item133.png', spriteType: 'local', price: 0, sellPrice: 4000, isUsable: false, isBall: false, implemented: false },
  { id: 'sturdyBoots', nameRu: 'Прочные ботинки', category: 'battle', desc: 'Защита от ловушек', sprite: 'Item134.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'weaknessPolicy', nameRu: 'Полис слабости', category: 'battle', desc: 'Атака +2 при эфф.атаке', sprite: 'Item135.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'fraudDice', nameRu: 'Мошеннические кости', category: 'battle', desc: 'Мульти-атака 4+ раз', sprite: 'Item136.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'apathySnake1', nameRu: 'Змея Апаты', category: 'battle', desc: 'Меняет Атаку и Спец.Атаку', sprite: 'Item137.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'apathySnake2', nameRu: 'Змея Апаты 2', category: 'battle', desc: 'Меняет Защиту и Спец.Защиту', sprite: 'Item138.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'abilityShield', nameRu: 'Щит способности', category: 'battle', desc: 'Защита способности', sprite: 'Item139.png', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'electricSeed', nameRu: 'Электрическое семя', category: 'battle', desc: 'Защита +1 в Electric Terrain', sprite: 'Item140.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'grassySeed', nameRu: 'Травянистое семя', category: 'battle', desc: 'Защита +1 в Grassy Terrain', sprite: 'Item141.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'mistySeed', nameRu: 'Туманное семя', category: 'battle', desc: 'Спец.Защита +1 в Misty Terrain', sprite: 'Item142.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },

  // ── Модификаторы (доп) ──
  { id: 'memoryPotion', nameRu: 'Зелье памяти', category: 'other', desc: 'Вспомнить атаку', sprite: '248.gif', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'maishoPotion', nameRu: 'Зелье Маишо', category: 'other', desc: 'Изучить атаку', sprite: '264.gif', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },

  // ── Прочее (ключевые предметы) ──
  { id: 'oldBell', nameRu: 'Старый колокольчик', category: 'other', desc: 'x3 шанс шайни', sprite: '231.gif', spriteType: 'local', price: 0, sellPrice: 10000, isUsable: false, isBall: false, implemented: false },
  { id: 'graphiteBell', nameRu: 'Графитовый колокольчик', category: 'other', desc: 'x3 шанс редких покемонов', sprite: '241.gif', spriteType: 'local', price: 0, sellPrice: 10000, isUsable: false, isBall: false, implemented: false },
  { id: 'luckyEgg', nameRu: 'Счастливое яйцо', category: 'other', desc: 'x2.5 опыта', sprite: '249.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: true, isBall: false, implemented: true },
  { id: 'oldRod', nameRu: 'Старая удочка', category: 'other', desc: 'Ловля рыбы (многоразовая)', sprite: '145.gif', spriteType: 'local', price: 0, sellPrice: 500, isUsable: true, isBall: false, implemented: true },
  { id: 'goodRod', nameRu: 'Отличная удочка', category: 'other', desc: 'Лучшая ловля рыбы (многоразовая)', sprite: '146.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: true, isBall: false, implemented: true },
  { id: 'superRod', nameRu: 'Супер удочка', category: 'other', desc: 'Активирует на 1 час', sprite: 'Itm147.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: true, isBall: false, implemented: true },
  { id: 'rope', nameRu: 'Канатная веревка', category: 'other', desc: 'Выйти из тупика', sprite: '168.gif', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'scanner', nameRu: 'Самодельный сканер', category: 'other', desc: 'x2 дроп кредитов на 2ч', sprite: '185.gif', spriteType: 'local', price: 0, sellPrice: 3000, isUsable: false, isBall: false, implemented: false },
  { id: 'secretBox', nameRu: 'Украденный секретный ящик', category: 'other', desc: 'Ящик на замке', sprite: '383.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'secretKey', nameRu: 'Секретный ключ', category: 'other', desc: 'Открывает секретный ящик', sprite: '384.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'bambooStem', nameRu: 'Стебель бамбука', category: 'other', desc: 'Лакомство Pancham', sprite: '99q.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: false },
  { id: 'stickySlime', nameRu: 'Липкая слизь', category: 'other', desc: 'Для ловли Tympole', sprite: 'Itm100.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: false },
  { id: 'honeyJar', nameRu: 'Баночка мёда', category: 'other', desc: 'Привлекает диких покемонов', sprite: '108.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'shinyLure', nameRu: 'Блестящая приманка', category: 'other', desc: 'Приманивает шайни', sprite: 'Prim.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'nameCard', nameRu: 'Именной бланк', category: 'other', desc: 'Переименовать покемона', sprite: '160.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'flute', nameRu: 'Флейта', category: 'other', desc: 'Будит спящих покемонов', sprite: 'Item123.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
  { id: 'ripeLimbor', nameRu: 'Спелая Лимбора', category: 'other', desc: 'Лакомство Shroodle', sprite: 'Itm109.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: false },
  { id: 'brokenPlasticSkoba', nameRu: 'Сломанная пластиковая скоба', category: 'other', desc: 'Нужно починить', sprite: '159.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: false },
  { id: 'arenaToken', nameRu: 'Жетон Арены', category: 'other', desc: 'За победы на Арене', sprite: '287.gif', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'kekutanElixir', nameRu: 'Эликсир Кекутан', category: 'other', desc: 'Снимает усталость на 15 мин', sprite: '317.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'coral', nameRu: 'Коралл', category: 'quest', desc: 'Валюта Теваских островов', sprite: '501.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },

  // ── Билеты ──
  { id: 'ticketBoatJK', nameRu: 'Билет на корабль Джото-Канто', category: 'tickets', desc: 'Путешествие в другой регион. 3 часа.', sprite: '162b.gif', spriteType: 'local', price: 120000, sellPrice: 60000, isUsable: false, isBall: false, implemented: true },
  { id: 'ticketTrainJK', nameRu: 'Билет на поезд Джото-Канто', category: 'tickets', desc: 'Быстрое путешествие. 1 час.', sprite: '163t.gif', spriteType: 'local', price: 200000, sellPrice: 100000, isUsable: false, isBall: false, implemented: true },
  { id: 'ticketBoatJS', nameRu: 'Билет на катер Джото-о.Селен', category: 'tickets', desc: 'Путешествие на остров Селен. 2 часа.', sprite: '192.gif', spriteType: 'local', price: 500000, sellPrice: 250000, isUsable: false, isBall: false, implemented: true },
  { id: 'ticketBusJ', nameRu: 'Билет на автобус по Джото', category: 'tickets', desc: 'Путешествие по Джото. 2 часа.', sprite: '285.gif', spriteType: 'local', price: 612000, sellPrice: 306000, isUsable: false, isBall: false, implemented: true },
  { id: 'ticketFerryKS', nameRu: 'Билет на паром Канто-Южн.Архипелаг', category: 'tickets', desc: 'В Южный Архипелаг. Нечётные числа месяца, 15:00.', sprite: '435.gif', spriteType: 'local', price: 470000, sellPrice: 235000, isUsable: false, isBall: false, implemented: true },
  { id: 'ticketPlaneJK', nameRu: 'Билет на самолет Джото-Канто', category: 'tickets', desc: 'Мгновенный перелет. 10 мин.', sprite: '180.gif', spriteType: 'local', price: 0, sellPrice: 50000, isUsable: false, isBall: false, implemented: true },
  { id: 'ticketPlaneEJS', nameRu: 'Билет на самолет Вост.Джото-о.Селен', category: 'tickets', desc: 'Мгновенный перелет.', sprite: '193.gif', spriteType: 'local', price: 0, sellPrice: 50000, isUsable: false, isBall: false, implemented: true },
  { id: 'ticketPlaneKS', nameRu: 'Билет на самолет Канто-о.Селен', category: 'tickets', desc: 'Мгновенный перелет.', sprite: '194.gif', spriteType: 'local', price: 0, sellPrice: 50000, isUsable: false, isBall: false, implemented: true },
  { id: 'ticketPlaneJ', nameRu: 'Билет на самолет по Джото', category: 'tickets', desc: 'Мгновенный перелет.', sprite: '240.gif', spriteType: 'local', price: 0, sellPrice: 50000, isUsable: false, isBall: false, implemented: true },

  // ── Квестовые (дополнительные) ──
  { id: 'bulbasaurBall', nameRu: 'Покебол с Бульбазавром', category: 'quest', desc: 'Покебол с Бульбазавром внутри.', sprite: 'quest3.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'squirtleBall', nameRu: 'Покебол со Сквиртлом', category: 'quest', desc: 'Покебол со Сквиртлом внутри.', sprite: 'quest1.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'charmanderBall', nameRu: 'Покебол с Чармандером', category: 'quest', desc: 'Покебол с Чармандером внутри.', sprite: 'quest1.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'vinepenLeaf', nameRu: 'Лист Випенбела', category: 'quest', desc: 'Небольшой лист идеальной формы.', sprite: '277.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'venonatHair', nameRu: 'Волосок Веноната', category: 'quest', desc: 'Плотный фиолетовый волос.', sprite: '278.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'magnemiteNut', nameRu: 'Магнитная гайка', category: 'quest', desc: 'Намагниченная деталь.', sprite: '280.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'parasSpores', nameRu: 'Споры Параса', category: 'quest', desc: 'Пыльца грибов на спине Параса.', sprite: '281.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'crystalHandful', nameRu: 'Горсть кристаллов', category: 'quest', desc: 'Сверкающие кристаллы воды.', sprite: '282.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'slowpokeTail', nameRu: 'Хвост Слоупока', category: 'quest', desc: 'Хвост Слоупока в пасти Шеллдера.', sprite: '525.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'goldNugget', nameRu: 'Самородок', category: 'quest', desc: 'Золотой самородок.', sprite: '524.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: true },
  { id: 'celebiBall', nameRu: 'Покебол с Селеби', category: 'quest', desc: 'Покебол с легендарным покемоном.', sprite: '345.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'cuboneBone', nameRu: 'Кость Кьюбона', category: 'quest', desc: 'Оружие Кьюбона.', sprite: 'Q526.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'parcel', nameRu: 'Посылка', category: 'quest', desc: 'Запечатанная картонная коробка.', sprite: '322.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'metalPlate', nameRu: 'Металлическая пластинка', category: 'quest', desc: 'Прямоугольная металлическая пластинка.', sprite: '323b.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'stonePlate', nameRu: 'Каменная пластинка', category: 'quest', desc: 'Прямоугольная каменная пластинка.', sprite: '324b.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'letter', nameRu: 'Письмо', category: 'quest', desc: 'Сложенный листок бумаги.', sprite: '325.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'nut', nameRu: 'Орех', category: 'quest', desc: 'Лакомство многих покемонов.', sprite: '187.gif', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: true },
  { id: 'laprasFigurine', nameRu: 'Статуэтка Лапраса', category: 'quest', desc: 'Деревянная статуэтка Лапраса.', sprite: '327.gif', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'rockSample', nameRu: 'Образец породы', category: 'quest', desc: 'Образец горной породы с вулкана.', sprite: '336.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'lavaCore', nameRu: 'Ядро магмы', category: 'quest', desc: 'Раскаленное ядро.', sprite: '337.gif', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'crystalShard', nameRu: 'Осколок кристалла', category: 'quest', desc: 'Сверкающий осколок.', sprite: '338.gif', spriteType: 'local', price: 0, sellPrice: 150, isUsable: false, isBall: false, implemented: true },
  { id: 'plantSample', nameRu: 'Образец растений', category: 'quest', desc: 'Образец флоры.', sprite: '337.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'magmortarBall', nameRu: 'Покебол с Магмотаром', category: 'quest', desc: 'Покебол с покемоном.', sprite: 'quest1.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'tinCan', nameRu: 'Жестяная баночка', category: 'quest', desc: 'Консервная банка.', sprite: '106.png', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: true },
  { id: 'letterL', nameRu: 'Буква L', category: 'quest', desc: 'Буква для квеста.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'letterE', nameRu: 'Буква E', category: 'quest', desc: 'Буква для квеста.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'letterA', nameRu: 'Буква A', category: 'quest', desc: 'Буква для квеста.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'letterG', nameRu: 'Буква G', category: 'quest', desc: 'Буква для квеста.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'letterU', nameRu: 'Буква U', category: 'quest', desc: 'Буква для квеста.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'digit1', nameRu: 'Цифра 1', category: 'quest', desc: 'Цифра для квеста.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'digit7', nameRu: 'Цифра 7', category: 'quest', desc: 'Цифра для квеста.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'bouquet', nameRu: 'Букет', category: 'quest', desc: 'Цветочный букет.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'newyearGift', nameRu: 'Новогодний подарок', category: 'quest', desc: 'Праздничный подарок.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: true },
  { id: 'snowball', nameRu: 'Снежок', category: 'quest', desc: 'Снежок.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: true },
  { id: 'bell', nameRu: 'Бубенец', category: 'quest', desc: 'Звенящий бубенец.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'balloons', nameRu: 'Шарики', category: 'quest', desc: 'Воздушные шарики.', sprite: '1.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },

  // ── Ремесленные (Crafting) ──
  { id: 'mountainSand', nameRu: 'Горсть горного песка', category: 'crafting', desc: 'Ингредиент для крафта.', sprite: '1409.png', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: true },
  { id: 'wonderFlower', nameRu: 'Дивный цветок', category: 'crafting', desc: 'Цветок для создания красителя.', sprite: 'Rem1412.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'woodenApricorn', nameRu: 'Древесный априкон', category: 'crafting', desc: 'Для создания покеболов.', sprite: 'Drevapri.png', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: true },
  { id: 'healingHerbs', nameRu: 'Целебные травы', category: 'crafting', desc: 'Травы для лечения покемона.', sprite: 'Trav.png', spriteType: 'local', price: 0, sellPrice: 80, isUsable: false, isBall: false, implemented: true },
  { id: 'ore', nameRu: 'Руда', category: 'crafting', desc: 'Добытая покемонами руда.', sprite: 'Ruda.gif', spriteType: 'local', price: 0, sellPrice: 150, isUsable: false, isBall: false, implemented: true },
  { id: 'cotton', nameRu: 'Хлопок', category: 'crafting', desc: 'Волокно для создания тканей.', sprite: '1423.png', spriteType: 'local', price: 0, sellPrice: 60, isUsable: false, isBall: false, implemented: true },
  { id: 'shinyDust', nameRu: 'Блестящая пыль', category: 'crafting', desc: 'Пыль после встречи с shiny.', sprite: '1435.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: true },
  { id: 'honeycomb', nameRu: 'Медовые соты', category: 'crafting', desc: 'Мёд Combee.', sprite: 'sota.png', spriteType: 'local', price: 0, sellPrice: 80, isUsable: false, isBall: false, implemented: true },
  { id: 'suspiciousEgg', nameRu: 'Подозрительное яйцо', category: 'crafting', desc: 'Яйцо бирюзового цвета.', sprite: '1434.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'craftBranch', nameRu: 'Ветка дерева Чванши', category: 'crafting', desc: 'Ветка дерева Судовудо.', sprite: '344.gif', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'craftCottonCandy', nameRu: 'Сахарная вата', category: 'crafting', desc: '+10 Счастья.', sprite: '436q.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'craftMiltankMilk', nameRu: 'Молоко Милтанк', category: 'crafting', desc: '+100 HP.', sprite: 'Milk.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: true },
  { id: 'craftersKit', nameRu: 'Набор Ремесленника', category: 'crafting', desc: 'Открывает меню крафтинга.', sprite: 'rem.png', spriteType: 'local', price: 50000, sellPrice: 25000, isUsable: true, isBall: false, implemented: true },
  { id: 'glassFlask', nameRu: 'Стеклянная колба', category: 'crafting', desc: 'Для хранения жидкостей.', sprite: 'Rem1410.png', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: true },
  { id: 'wonderDye', nameRu: 'Дивный краситель', category: 'crafting', desc: 'Краситель из дивного цветка.', sprite: 'Rem1413.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'hardPaper', nameRu: 'Жесткая бумага', category: 'crafting', desc: 'Сверхпрочная бумага.', sprite: 'Rem1415.png', spriteType: 'local', price: 0, sellPrice: 80, isUsable: false, isBall: false, implemented: true },
  { id: 'processedStone', nameRu: 'Обработанный камень', category: 'crafting', desc: 'Камень после обработки.', sprite: 'Rem1417.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'metalIngot', nameRu: 'Металлический слиток', category: 'crafting', desc: 'Очищенный металл.', sprite: 'Rem1418.png', spriteType: 'local', price: 0, sellPrice: 300, isUsable: false, isBall: false, implemented: true },
  { id: 'glass', nameRu: 'Стекло', category: 'crafting', desc: 'Маленькое стекло.', sprite: 'Rem1419.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: true },
  { id: 'microchip', nameRu: 'Микросхема', category: 'crafting', desc: 'Маленький чип.', sprite: 'Rem1420.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'luminFruit', nameRu: 'Плод Люмин', category: 'crafting', desc: 'Светящийся плод.', sprite: 'Rem1421.png', spriteType: 'local', price: 0, sellPrice: 150, isUsable: false, isBall: false, implemented: true },
  { id: 'rottenLumin', nameRu: 'Гнилой плод Люмин', category: 'crafting', desc: 'Сгнивший плод.', sprite: 'Rem1422.png', spriteType: 'local', price: 0, sellPrice: 50, isUsable: false, isBall: false, implemented: true },
  { id: 'cottonFabric', nameRu: 'Хлопковая ткань', category: 'crafting', desc: 'Ткань из хлопка.', sprite: 'Png1424.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'ancientFossil', nameRu: 'Древняя окаменелость', category: 'crafting', desc: 'Окаменелые остатки покемона.', sprite: 'Rem1425.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: true },
  { id: 'archaeologyBrush', nameRu: 'Археологическая щетка', category: 'crafting', desc: 'Для очистки окаменелостей.', sprite: 'Rem1426.png', spriteType: 'local', price: 0, sellPrice: 300, isUsable: false, isBall: false, implemented: true },
  { id: 'mortarPestle', nameRu: 'Ступка и пестик', category: 'crafting', desc: 'Для толчения ингредиентов.', sprite: '1182.png', spriteType: 'local', price: 0, sellPrice: 400, isUsable: false, isBall: false, implemented: true },
  { id: 'tmCarrier', nameRu: 'Носитель TM-Атаки', category: 'crafting', desc: 'Пустой носитель для TM.', sprite: 'Rem1436.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: true },
  { id: 'scrollResourcefulness', nameRu: 'Свиток Находчивость', category: 'crafting', desc: 'Половина ингредиентов при неудаче.', sprite: 'Rem1451.png', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: true },
  { id: 'scrollSmartness', nameRu: 'Свиток Смышлёность', category: 'crafting', desc: '+1% освоения ремесла.', sprite: 'Rem1451.png', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: true },
  { id: 'scrollAccuracy', nameRu: 'Свиток Аккуратность', category: 'crafting', desc: '+5% успешности крафта.', sprite: 'Rem1453.png', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: true },
  { id: 'scrollPerfectionism', nameRu: 'Свиток Перфекционизм', category: 'crafting', desc: 'Освоение до 98%.', sprite: 'Rem1454.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: true },
  { id: 'scrollProductivity', nameRu: 'Свиток Продуктивность', category: 'crafting', desc: 'Шанс создать 2 предмета.', sprite: 'Rem1454.png', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: true },
  { id: 'scrollBrewing', nameRu: 'Свиток Зельеварение', category: 'crafting', desc: 'Создание зелий III-V.', sprite: 'Rem1456.png', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: true },
  { id: 'scrollArchaeology', nameRu: 'Свиток Археология', category: 'crafting', desc: 'x3 шанс окаменелостей.', sprite: 'Rem1456.png', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: true },
  { id: 'scrollPaleogenetics', nameRu: 'Свиток Палеогенетика', category: 'crafting', desc: 'Мин. сохранность ДНК 25%.', sprite: 'Rem1456.png', spriteType: 'local', price: 0, sellPrice: 1500, isUsable: false, isBall: false, implemented: true },
  { id: 'randomFossil', nameRu: 'Случайная окаменелость', category: 'crafting', desc: 'Ископаемые остатки древнего вида.', sprite: '1200.gif', spriteType: 'local', price: 0, sellPrice: 300, isUsable: false, isBall: false, implemented: true },

  // ── Артефакты ──
  { id: 'jirachiCharm', nameRu: 'Талисман Джирачи', category: 'artifacts', desc: '+10% дропа на 1ч, 1 раз в сутки.', sprite: '5511.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'teamRChevron', nameRu: 'Шеврон Команды R', category: 'artifacts', desc: 'Сокращает время до атаки вдвое.', sprite: 'Art552.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'newIslandCoin', nameRu: 'Монета о.Нью Айленд', category: 'artifacts', desc: '+10% тренировка клонов.', sprite: 'Art553.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'soulVessel', nameRu: 'Сосуд с душой', category: 'artifacts', desc: 'Шанс встречи shadow покемонов.', sprite: 'Art554.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'candyBag', nameRu: 'Сумка для конфет', category: 'artifacts', desc: 'Шанс дропа типовых конфет.', sprite: 'Art555.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'cozyNest', nameRu: 'Уютное гнёздышко', category: 'artifacts', desc: '-20% время вылупления, +1 ген.', sprite: 'Art556.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'greenCloak', nameRu: 'Одеяние Зелёного Плаща', category: 'artifacts', desc: 'x2 шанс stellar терасталла.', sprite: 'Art557.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'greenCloakKnife', nameRu: 'Нож Зелёного Плаща', category: 'artifacts', desc: 'Обмен тера-осколков.', sprite: 'Art558.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'taurosOrder', nameRu: 'Ордер на поимку Tauros', category: 'artifacts', desc: 'Ловля Tauros на Селене.', sprite: 'Art559.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'miltankOrder', nameRu: 'Ордер на поимку Miltank', category: 'artifacts', desc: 'Ловля Miltank на Селене.', sprite: 'Art560.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'megaBracelet', nameRu: 'Мега Браслет', category: 'artifacts', desc: 'Мега-эволюция в бою.', sprite: '1300.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },
  { id: 'teraSphere', nameRu: 'Тера Сфера', category: 'artifacts', desc: 'Терасталлизация покемонов.', sprite: 'Art1500.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: true },

  // ── Награды (Бейджи/Кубки) ──
  { id: 'badgeBug', nameRu: 'Значок Голубого Жука', category: 'awards', desc: 'Значок стадиона Жуков.', sprite: '201.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeDark', nameRu: 'Значок Тёмного Мира', category: 'awards', desc: 'Значок Тёмного стадиона.', sprite: '202.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeDragon', nameRu: 'Значок Силы Дракона', category: 'awards', desc: 'Значок стадиона Драконов.', sprite: '203.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeElectric', nameRu: 'Значок Высокого Напряжения', category: 'awards', desc: 'Значок Электрического стадиона.', sprite: '204.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeFighting', nameRu: 'Значок Кунг-Фу', category: 'awards', desc: 'Значок Боевого стадиона.', sprite: '205.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeFire', nameRu: 'Значок Магмы', category: 'awards', desc: 'Значок Огненного стадиона.', sprite: '206.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeFlying', nameRu: 'Значок Воздуха', category: 'awards', desc: 'Значок Летающего стадиона.', sprite: '207.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeGhost', nameRu: 'Значок Потустороннего', category: 'awards', desc: 'Значок Призрачного стадиона.', sprite: '208.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeGrass', nameRu: 'Значок Жизни', category: 'awards', desc: 'Значок Травяного стадиона.', sprite: '209.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeGround', nameRu: 'Значок Тверди', category: 'awards', desc: 'Значок Земляного стадиона.', sprite: '210.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeIce', nameRu: 'Значок Белого Снега', category: 'awards', desc: 'Значок Ледяного стадиона.', sprite: '211.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeNormal', nameRu: 'Значок Мира', category: 'awards', desc: 'Значок Нормального стадиона.', sprite: '212.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgePoison', nameRu: 'Значок Черепа', category: 'awards', desc: 'Значок Ядовитого стадиона.', sprite: '213.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgePsychic', nameRu: 'Значок Ауры', category: 'awards', desc: 'Значок Психического стадиона.', sprite: '214.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeRock', nameRu: 'Значок Энергии Камня', category: 'awards', desc: 'Значок Каменного стадиона.', sprite: '215.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeSteel', nameRu: 'Значок Закалённой Стали', category: 'awards', desc: 'Значок Стального стадиона.', sprite: '216.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeWater', nameRu: 'Значок Дождя', category: 'awards', desc: 'Значок Водного стадиона.', sprite: '217.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'badgeFairy', nameRu: 'Значок Фей', category: 'awards', desc: 'Значок Волшебного стадиона.', sprite: '218.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'goldCup', nameRu: 'Золотой Кубок Лиги', category: 'awards', desc: 'Кубок победителя Лиги-17.', sprite: '219.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'silverCup', nameRu: 'Серебряный Кубок Лиги', category: 'awards', desc: 'Кубок призера Лиги-17.', sprite: '220.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'bronzeCup', nameRu: 'Бронзовый Кубок Лиги', category: 'awards', desc: 'Кубок бронзового призера.', sprite: '221.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'championFinalist1', nameRu: 'Участник финала ЛЧ I', category: 'awards', desc: 'Памятный значок.', sprite: '222.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'championFinalist2', nameRu: 'Участник финала ЛЧ II', category: 'awards', desc: 'Памятный значок.', sprite: '223.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'championFinalist3', nameRu: 'Участник финала ЛЧ III', category: 'awards', desc: 'Памятный значок.', sprite: '224.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'championFinalist4', nameRu: 'Участник финала ЛЧ IV', category: 'awards', desc: 'Памятный значок.', sprite: '229.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'championFinalist5', nameRu: 'Участник финала ЛЧ V', category: 'awards', desc: 'Памятный значок.', sprite: '229.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'championFinalist6', nameRu: 'Участник финала ЛЧ VI', category: 'awards', desc: 'Памятный значок.', sprite: '229.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'championFinalist7', nameRu: 'Участник финала ЛЧ VII', category: 'awards', desc: 'Памятный значок.', sprite: '229.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'goldMedal', nameRu: 'Золотая медаль', category: 'awards', desc: '1 место в турнире.', sprite: '626.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'silverMedal', nameRu: 'Серебряная медаль', category: 'awards', desc: '2 место в турнире.', sprite: '627.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'bronzeMedal', nameRu: 'Бронзовая медаль', category: 'awards', desc: '3 место в турнире.', sprite: '628.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'policeChiefToken', nameRu: 'Жетон начальника полиции', category: 'awards', desc: 'Удостоверение главы полиции.', sprite: '629.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'policeMedal', nameRu: 'Почетная медаль Полиции', category: 'awards', desc: 'x1.5 опыта.', sprite: '630.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'eliteTrainer', nameRu: 'Элитный тренер', category: 'awards', desc: 'Знак элитного тренера.', sprite: '631.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'experiencedTrainer', nameRu: 'Опытный тренер', category: 'awards', desc: 'Знак опытного тренера.', sprite: '632.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'greenRibbon', nameRu: 'Зеленая лента', category: 'awards', desc: '1 место в конкурсе.', sprite: '633.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'purpleRibbon', nameRu: 'Фиолетовая лента', category: 'awards', desc: '2 место в конкурсе.', sprite: '634.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'orangeRibbon', nameRu: 'Оранжевая лента', category: 'awards', desc: '3 место в конкурсе.', sprite: '620.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'blueRibbon', nameRu: 'Синяя лента', category: 'awards', desc: 'Призовое место в контесте.', sprite: '621.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'goldenrodDefender', nameRu: 'Орден Защитника Голденрода', category: 'awards', desc: 'За защиту Голденрода.', sprite: '622.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'johtoDefender', nameRu: 'Орден Защитника Джотто', category: 'awards', desc: 'За защиту Джотто в 2021.', sprite: '259.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'silverFigurine', nameRu: 'Серебряная статуэтка', category: 'awards', desc: 'ДР Лиги-17, 1.5+ лет.', sprite: '184.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'goldFigurine', nameRu: 'Золотая статуэтка', category: 'awards', desc: 'ДР Лиги-17, 2+ лет.', sprite: '377.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'platinumFigurine', nameRu: 'Платиновая статуэтка', category: 'awards', desc: 'ДР Лиги-17.', sprite: '378.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'diamondFigurine', nameRu: 'Алмазная статуэтка', category: 'awards', desc: 'ДР Лиги-17.', sprite: '318.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'palette', nameRu: 'Палитра', category: 'awards', desc: 'Награда.', sprite: '319.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'newspaper', nameRu: 'Газета', category: 'awards', desc: 'Награда.', sprite: '320.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'magistrateHat', nameRu: 'Шляпа магистра', category: 'awards', desc: 'Награда.', sprite: '329.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'headphones', nameRu: 'Наушники', category: 'awards', desc: 'Награда.', sprite: '330.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'pearlDealer', nameRu: 'Дилер жемчуга', category: 'awards', desc: 'Награда.', sprite: '297.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'jeTaime', nameRu: 'je t\'aime', category: 'awards', desc: 'Награда.', sprite: '296.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'handfulAsh', nameRu: 'Горсть пепла', category: 'awards', desc: 'Награда.', sprite: '299.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'redMarkAward', nameRu: 'Красная карточка', category: 'awards', desc: 'Награда.', sprite: '308.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'blackMark', nameRu: 'Черная метка', category: 'awards', desc: 'Награда.', sprite: '270.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'diamondTrophy', nameRu: 'Бриллиантовый трофей', category: 'awards', desc: 'Трофей.', sprite: '294.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'emeraldTrophy', nameRu: 'Изумрудный трофей', category: 'awards', desc: 'Трофей.', sprite: '294.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'sapphireTrophy', nameRu: 'Сапфировый трофей', category: 'awards', desc: 'Трофей.', sprite: '294.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'rubyTrophy', nameRu: 'Рубиновый трофей', category: 'awards', desc: 'Трофей.', sprite: '294.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'amberTrophy', nameRu: 'Янтарный трофей', category: 'awards', desc: 'Трофей.', sprite: '294.gif', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },

  // ── Прочее (дополнительные) ──
  { id: 'clanOrder', nameRu: 'Клан-ордер', category: 'other', desc: 'Для создания клана.', sprite: '257.gif', spriteType: 'local', price: 6950000, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'emblemBook', nameRu: 'Эмблемная книга', category: 'other', desc: '+10 эмблем клану.', sprite: '258.gif', spriteType: 'local', price: 270000, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'dominationOrder', nameRu: 'Ордер Доминации', category: 'other', desc: 'Установка клановой доминации.', sprite: '326.gif', spriteType: 'local', price: 100000, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'teamROrder1', nameRu: 'Ордер Команды Р I', category: 'other', desc: 'Нападение на тренеров (ранг>Новичок).', sprite: '312.gif', spriteType: 'local', price: 80000, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'teamROrder2', nameRu: 'Ордер Команды Р II', category: 'other', desc: 'Нападение на тренеров (любой ранг).', sprite: '313.gif', spriteType: 'local', price: 120000, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'skiGear', nameRu: 'Горнолыжное снаряжение', category: 'other', desc: 'Проход по снежным местам.', sprite: '236.gif', spriteType: 'local', price: 400000, sellPrice: 200000, isUsable: false, isBall: false, implemented: false },
  { id: 'pearl', nameRu: 'Жемчуг', category: 'other', desc: 'Драгоценный камень.', sprite: '500.gif', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'waterSupply', nameRu: 'Запас воды', category: 'other', desc: 'Для путешествий по Зап.Джото.', sprite: '254b.gif', spriteType: 'local', price: 100000, sellPrice: 50000, isUsable: false, isBall: false, implemented: false },
  { id: 'bigWaterSupply', nameRu: 'Большой запас воды', category: 'other', desc: 'Для путешествий по Зап.Джото.', sprite: '255.gif', spriteType: 'local', price: 200000, sellPrice: 100000, isUsable: false, isBall: false, implemented: false },
  { id: 'stolenLure', nameRu: 'Украденная приманка', category: 'other', desc: 'Приманка из института Голденрода.', sprite: '106.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'pager', nameRu: 'Пейджер', category: 'other', desc: 'Использование покемона для перемещения.', sprite: 'Itm373.png', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'ursalunaFur', nameRu: 'Шкура Урсалуны', category: 'other', desc: 'Мягкая теплая шкура.', sprite: 'itm502.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'gimmighoulCoin', nameRu: 'Монета Гиммигула', category: 'other', desc: 'Монета покемона Гиммигула.', sprite: 'itm503.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: false },
  { id: 'bottleCap', nameRu: 'Крышка от бутылки', category: 'other', desc: 'Серебряная крышка.', sprite: 'itm504.png', spriteType: 'local', price: 0, sellPrice: 200, isUsable: false, isBall: false, implemented: false },
  { id: 'mrRichyBag', nameRu: 'Мешочек мистера Ричи', category: 'other', desc: 'Мешочек с деньгами.', sprite: 'itm505.png', spriteType: 'local', price: 0, sellPrice: 500, isUsable: false, isBall: false, implemented: false },
  { id: 'leaguePlus', nameRu: 'Лига-17 Reborn Plus', category: 'other', desc: 'Карта подписки.', sprite: 'itm502.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'greenZonePass', nameRu: 'Пропуск в Зелёную зону', category: 'other', desc: 'Доступ в Зелёную зону Канто.', sprite: 'itm503.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'cinnabarTicket', nameRu: 'Талон о.Синнабар', category: 'other', desc: 'Обмен на TM в Покемаркете.', sprite: 'itm504.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'ancientGenome', nameRu: 'Первобытный геном', category: 'other', desc: 'ДНК древнего покемона.', sprite: 'itm505.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'pokedexLure', nameRu: 'Приманка Покедексера', category: 'other', desc: 'Приманивает нового покемона.', sprite: 'itm502.png', spriteType: 'local', price: 0, sellPrice: 0, isUsable: false, isBall: false, implemented: false },
  { id: 'campfire', nameRu: 'Костёр', category: 'other', desc: 'Лагерь на локации. +10% дроп клану.', sprite: 'itm503.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'bond', nameRu: 'Облигация', category: 'other', desc: 'Ценная бумага.', sprite: 'itm504.png', spriteType: 'local', price: 0, sellPrice: 1000, isUsable: false, isBall: false, implemented: false },
  { id: 'diode', nameRu: 'Диод', category: 'other', desc: 'Электронный компонент.', sprite: 'itm505.png', spriteType: 'local', price: 0, sellPrice: 100, isUsable: false, isBall: false, implemented: false },
  { id: 'upgradedBallSet', nameRu: 'Улучшенный набор покеболов', category: 'other', desc: 'Набор продвинутых покеболов.', sprite: '62.png', spriteType: 'local', price: 0, sellPrice: 5000, isUsable: false, isBall: false, implemented: false },
  { id: 'candySet', nameRu: 'Набор конфет', category: 'other', desc: 'Ассорти конфет.', sprite: '41.gif', spriteType: 'local', price: 0, sellPrice: 2000, isUsable: false, isBall: false, implemented: false },
];

// --- MONSTER DROP TABLE (wiki + original) ---
const MONSTER_DROP_TABLE = {
  'aggron': [{ item: 'stonePlate', chance: 0.45, qty: 1 }],
  'ariados': [{ item: 'waterStone', chance: 0.45, qty: 1 }],
  'aron': [{ item: 'quartz', chance: 0.45, qty: 1 }],
  'articuno': [{ item: 'goldNugget', chance: 0.50, qty: 1 }, { item: 'crystalShard', chance: 0.80, qty: 2 }],
  'bellsprout': [{ item: 'plantSample', chance: 0.50, qty: 1 }],
  'blissey': [{ item: 'healingHerbs', chance: 0.45, qty: 1 }],
  'cacnea': [{ item: 'cacneaSpines', chance: 0.55, qty: 1 }],
  'chansey': [{ item: 'luckyEgg', chance: 0.05, qty: 1 }, { item: 'healingHerbs', chance: 0.45, qty: 1 }],
  'clamperl': [{ item: 'deepSeaScale', chance: 0.45, qty: 1 }, { item: 'deepSeaTooth', chance: 0.45, qty: 1 }],
  'combee': [{ item: 'honeycomb', chance: 0.45, qty: 1 }],
  'cubone': [{ item: 'cuboneBone', chance: 0.60, qty: 1 }],
  'diglett': [{ item: 'goldNugget', chance: 0.05, qty: 1 }],
  'ditto': [{ item: 'metalPlate', chance: 0.30, qty: 1 }],
  'dratini': [{ item: 'goldNugget', chance: 0.15, qty: 1 }],
  'eevee': [{ item: 'goldNugget', chance: 0.08, qty: 1 }],
  'electrike': [{ item: 'fireStone', chance: 0.45, qty: 1 }],
  'farfetchd': [{ item: 'leek', chance: 0.50, qty: 1 }],
  'geodude': [{ item: 'rockSample', chance: 0.50, qty: 1 }, { item: 'malachite', chance: 0.45, qty: 1 }],
  'goldeen': [{ item: 'crystalShard', chance: 0.40, qty: 1 }],
  'golduck': [{ item: 'suspiciousEgg', chance: 0.45, qty: 1 }],
  'gorebyss': [{ item: 'deepSeaScale', chance: 0.45, qty: 1 }, { item: 'deepSeaTooth', chance: 0.45, qty: 1 }],
  'grimer': [{ item: 'everstone', chance: 0.45, qty: 1 }, { item: 'blackSludge', chance: 0.45, qty: 1 }],
  'growlithe': [{ item: 'coals', chance: 0.50, qty: 1 }],
  'gyarados': [{ item: 'deepSeaScale', chance: 0.45, qty: 1 }],
  'happiny': [{ item: 'healingHerbs', chance: 0.45, qty: 1 }],
  'hitmonchan': [{ item: 'train', chance: 0.45, qty: 1 }],
  'hitmonlee': [{ item: 'train', chance: 0.45, qty: 1 }],
  'hitmontop': [{ item: 'train', chance: 0.45, qty: 1 }],
  'huntail': [{ item: 'deepSeaScale', chance: 0.45, qty: 1 }, { item: 'deepSeaTooth', chance: 0.45, qty: 1 }],
  'kangaskhan': [{ item: 'goldNugget', chance: 0.25, qty: 1 }],
  'koffing': [{ item: 'metalPlate', chance: 0.45, qty: 1 }],
  'lairon': [{ item: 'metalPlate', chance: 0.45, qty: 1 }],
  'lapras': [{ item: 'laprasFigurine', chance: 0.40, qty: 1 }],
  'machop': [{ item: 'stonePlate', chance: 0.35, qty: 1 }],
  'magcargo': [{ item: 'coals', chance: 0.45, qty: 1 }],
  'magikarp': [{ item: 'deepSeaScale', chance: 0.45, qty: 1 }],
  'magmar': [{ item: 'lavaCore', chance: 0.45, qty: 1 }],
  'magnemite': [{ item: 'magnemiteNut', chance: 0.55, qty: 1 }],
  'mankey': [{ item: 'nut', chance: 0.50, qty: 1 }],
  'marowak': [{ item: 'thickClub', chance: 0.45, qty: 1 }],
  'meowth': [{ item: 'goldNugget', chance: 0.10, qty: 1 }],
  'mewtwo': [{ item: 'goldNugget', chance: 0.80, qty: 2 }, { item: 'lapisLazuli', chance: 0.50, qty: 1 }],
  'moltres': [{ item: 'goldNugget', chance: 0.50, qty: 1 }, { item: 'coals', chance: 0.80, qty: 3 }],
  'muk': [{ item: 'everstone', chance: 0.45, qty: 1 }, { item: 'blackSludge', chance: 0.45, qty: 1 }],
  'noctowl': [{ item: 'nut', chance: 0.45, qty: 1 }],
  'octillery': [{ item: 'everstone', chance: 0.45, qty: 1 }],
  'oddish': [{ item: 'plantSample', chance: 0.50, qty: 1 }, { item: 'healingHerbs', chance: 0.45, qty: 1 }],
  'onix': [{ item: 'rockSample', chance: 0.60, qty: 1 }, { item: 'stonePlate', chance: 0.15, qty: 1 }, { item: 'lapisLazuli', chance: 0.45, qty: 1 }, { item: 'ore', chance: 0.45, qty: 1 }],
  'paras': [{ item: 'parasSpores', chance: 0.55, qty: 1 }, { item: 'tinCan', chance: 0.10, qty: 1 }, { item: 'goldNugget', chance: 0.45, qty: 1 }],
  'parasect': [{ item: 'goldNugget', chance: 0.45, qty: 1 }],
  'persian': [{ item: 'goldNugget', chance: 0.45, qty: 1 }],
  'politoed': [{ item: 'goldNugget', chance: 0.45, qty: 1 }],
  'poliwag': [{ item: 'goldNugget', chance: 0.45, qty: 1 }],
  'poliwhirl': [{ item: 'goldNugget', chance: 0.45, qty: 1 }],
  'poliwrath': [{ item: 'goldNugget', chance: 0.45, qty: 1 }],
  'ponyta': [{ item: 'coals', chance: 0.55, qty: 1 }],
  'raticate': [{ item: 'woodenApricorn', chance: 0.45, qty: 1 }],
  'rattata': [{ item: 'woodenApricorn', chance: 0.45, qty: 1 }],
  'remoraid': [{ item: 'everstone', chance: 0.45, qty: 1 }],
  'sandslash': [{ item: 'stonePlate', chance: 0.45, qty: 1 }],
  'seviper': [{ item: 'seviperVenom', chance: 0.65, qty: 1 }],
  'shellder': [{ item: 'crystalShard', chance: 0.40, qty: 1 }, { item: 'slowpokeTail', chance: 0.45, qty: 1 }],
  'slowking': [{ item: 'goldNugget', chance: 0.45, qty: 1 }],
  'slowpoke': [{ item: 'slowpokeTail', chance: 0.50, qty: 1 }, { item: 'goldNugget', chance: 0.45, qty: 1 }],
  'slugma': [{ item: 'coals', chance: 0.45, qty: 1 }],
  'slurpuff': [{ item: 'cotton', chance: 0.45, qty: 1 }],
  'spinarak': [{ item: 'waterStone', chance: 0.45, qty: 1 }],
  'staryu': [{ item: 'crystalShard', chance: 0.45, qty: 1 }],
  'steelix': [{ item: 'metalPlate', chance: 0.45, qty: 1 }],
  'sudowoodo': [{ item: 'woodenApricorn', chance: 0.45, qty: 1 }],
  'sunflora': [{ item: 'plantSample', chance: 0.45, qty: 1 }],
  'swalot': [{ item: 'tinCan', chance: 0.45, qty: 1 }],
  'swirlix': [{ item: 'cotton', chance: 0.45, qty: 1 }],
  'tauros': [{ item: 'goldNugget', chance: 0.20, qty: 1 }],
  'tyrogue': [{ item: 'train', chance: 0.45, qty: 1 }],
  'venonat': [{ item: 'venonatHair', chance: 0.60, qty: 1 }],
  'weepinbell': [{ item: 'vinepenLeaf', chance: 0.55, qty: 1 }],
  'weezing': [{ item: 'metalPlate', chance: 0.45, qty: 1 }],
  'yanma': [{ item: 'waterStone', chance: 0.45, qty: 1 }],
  'zapdos': [{ item: 'goldNugget', chance: 0.50, qty: 1 }, { item: 'metalPlate', chance: 0.80, qty: 2 }],
  'zubat': [{ item: 'goldNugget', chance: 0.03, qty: 1 }],
};

const UNIVERSAL_DROPS = [
  { item: 'quartz', chance: 0.03, qty: 1 },
  { item: 'malachite', chance: 0.01, qty: 1 },
  { item: 'goldNugget', chance: 0.01, qty: 1 },
];

function processMonsterDrop(pokemonName) {
  const drops = [];
  const speciesTable = MONSTER_DROP_TABLE[pokemonName] || [];
  for (const entry of speciesTable) {
    if (Math.random() < entry.chance) {
      addItem(entry.item, entry.qty);
      drops.push({ item: entry.item, qty: entry.qty });
    }
  }
  for (const entry of UNIVERSAL_DROPS) {
    if (Math.random() < entry.chance) {
      addItem(entry.item, entry.qty);
      drops.push({ item: entry.item, qty: entry.qty });
    }
  }
  return drops;
}

// --- NPC DATA ---
const NPC_DATA = {
  'oak_lab': {
    id: 'oak_lab', name: 'Профессор Оук', sprite: '👨‍🔬', location: 'pallet_town',
    dialog: {
      greet: 'Привет! Я профессор Оук. Рад видеть тебя в мире покемонов!',
      default: 'Продолжай тренироваться и заполнять Покедекс!',
      quest_offer: 'Мне нужны образцы покемонов. Принеси мне {target} {item}, и я дам награду.',
      quest_complete: 'Отлично! Ты принёс всё что нужно. Вот твоя награда!',
      quest_incomplete: 'Ещё не всё собрано. Продолжай искать!',
    },
    quests: [
      { id: 'oak_research_1', type: 'collect_items', targetItem: 'venonatHair', targetQty: 3, desc: 'Принесите 3 Волоска Веноната', rewardMoney: 500, rewardItem: 'pokeball', rewardQty: 5, prereqQuest: null },
      { id: 'oak_research_2', type: 'collect_items', targetItem: 'parasSpores', targetQty: 2, desc: 'Принесите 2 Спора Параса', rewardMoney: 800, rewardItem: 'candy', rewardQty: 3, prereqQuest: 'oak_research_1' },
    ],
  },
  // Nurse Joy in Pokemon Center
  'joy_pokecenter': {
    id: 'joy_pokecenter', name: 'Сестра Джой', sprite: '👩‍⚕️', location: 'pokecenter',
    dialog: {
      greet: 'Добро пожаловать в Покецентр! Я могу вылечить ваших покемонов.',
      default: 'Ваши покемоны в порядке? Заходите если нужна помощь.',
    },
    quests: [],
  },

  // Daycare in Pokemon Center
  'daycare_pokecenter': {
    id: 'daycare_pokecenter', name: 'Смотритель Питомника', sprite: '👴', location: 'pokecenter',
    dialog: {
      greet: 'Добро пожаловать в Питомник! Здесь ваши покемоны могут набираться опыта.',
      default: 'Покемоны растут пока вы путешествуете. Оставьте пару — они поднимут уровень!',
    },
    quests: [],
  },

  // Tutorial NPC at starting location
  // === EAST JOHTO NPCs ===
  'goldenrod_officer': {
    id: 'goldenrod_officer', name: 'Офицер Джес', sprite: '👮', location: 'goldenrod',
    dialog: { greet: 'Добро пожаловать в Голденрод — столицу Восточного Джото!', default: 'Если заметите нарушения правил Лиги-17, обращайтесь ко мне.', quest_offer: 'Новичкам нужно снаряжение. Принеси мне {target} {item}.', quest_complete: 'Отлично! Теперь ты экипирован.', quest_incomplete: 'Приходи когда соберёшь всё.' },
    quests: [{ id: 'gold_1', type: 'collect_items', targetItem: 'potion', targetQty: 3, desc: 'Принесите 3 Зелья', rewardMoney: 300, rewardItem: 'pokeball', rewardQty: 5, prereqQuest: null }],
  },
  'goldenrod_michael': {
    id: 'goldenrod_michael', name: 'Майкл', sprite: '🕵️', location: 'goldenrod',
    dialog: { greet: 'Помогите! Похитили Батискафиш!', default: 'Квест "Похищение Батискафиш" ждёт тебя.', quest_offer: 'Найди похитителей! Принеси мне {target} {item} как улику.', quest_complete: 'Ты нашёл их! Спасибо!', quest_incomplete: 'Ищи улики в городе...' },
    quests: [{ id: 'gold_2', type: 'defeat_x', targetItem: null, targetQty: 5, desc: 'Победите 5 диких покемонов в поисках улик', rewardMoney: 800, rewardItem: 'greatBall', rewardQty: 3, prereqQuest: 'gold_1' }],
  },
  'goldenrod_phill': {
    id: 'goldenrod_phill', name: 'Филл', sprite: '🔬', location: 'goldenrod',
    dialog: { greet: 'Покемоны исчезают из Института Голденрода!', default: 'Это загадка, которую нужно разгадать.', quest_offer: 'Для расследования мне нужны {target} {item}.', quest_complete: 'Превосходная работа, тренер!', quest_incomplete: 'Нужно больше данных...' },
    quests: [{ id: 'gold_3', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймайте 3 покемонов для исследования института', rewardMoney: 600, rewardItem: 'candy', rewardQty: 3, prereqQuest: 'gold_2' }, { id: 'gold_4', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 исследовательских центра', rewardMoney: 1000, rewardItem: 'tm', rewardQty: 2, prereqQuest: 'gold_3' }],
  },
  'olivine_captain': {
    id: 'olivine_captain', name: 'Капитан порта', sprite: '⚓', location: 'olivine',
    dialog: { greet: 'Добро пожаловать в порт Оливина! Корабли до Канто и Селена.', default: 'Расписание: 10, 14, 18, 22 часа.', quest_offer: 'Матросы просят {target} {item} для ремонта.', quest_complete: 'Корабль готов к плаванию!', quest_incomplete: 'Ремонт ещё не закончен...' },
    quests: [{ id: 'oli_1', type: 'collect_items', targetItem: 'crystalShard', targetQty: 3, desc: 'Принесите 3 осколка кристалла для порта', rewardMoney: 500, rewardItem: 'superPotion', rewardQty: 2, prereqQuest: null }, { id: 'oli_2', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 портовых города', rewardMoney: 800, rewardItem: 'waterStone', rewardQty: 1, prereqQuest: 'oli_1' }],
  },
  'flourence_gardener': {
    id: 'flourence_gardener', name: 'Садовник Флор', sprite: '🌸', location: 'flourence',
    dialog: { greet: 'Флауренция — город цветов! Хочешь помочь в оранжерее?', default: 'Цветы и травяные покемоны — идеальная пара.', quest_offer: 'Принеси мне {target} {item} для новых саженцев.', quest_complete: 'Чудесно! Приходи ещё.', quest_incomplete: 'Растениям нужна подкормка...' },
    quests: [{ id: 'flo_1', type: 'collect_items', targetItem: 'plantSample', targetQty: 4, desc: 'Принесите 4 Образца растений', rewardMoney: 400, rewardItem: 'leafStone', rewardQty: 1, prereqQuest: null }],
  },
  'warhall_mayor': {
    id: 'warhall_mayor', name: 'Мэр Вархолла', sprite: '🏛️', location: 'warhall',
    dialog: { greet: 'Вархолл — новый город с древней историей ниндзя.', default: 'Автовокзал работает по расписанию.', quest_offer: 'Для города нужны стройматериалы: {target} {item}.', quest_complete: 'Город растёт благодаря тебе!', quest_incomplete: 'Стройка продолжается...' },
    quests: [{ id: 'war_1', type: 'collect_items', targetItem: 'rockSample', targetQty: 5, desc: 'Принесите 5 Образцов породы', rewardMoney: 700, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: null }],
  },
  'alston_circus': {
    id: 'alston_circus', name: 'Директор цирка', sprite: '🎪', location: 'alston',
    dialog: { greet: 'Добро пожаловать в цирк Олстона! Наши покемоны-артисты лучшие!', default: 'Цирк основан бродячими артистами.', quest_offer: 'Для нового номера нужны {target} {item}.', quest_complete: 'Браво! Потрясающее выступление!', quest_incomplete: 'Репетиции идут полным ходом...' },
    quests: [{ id: 'als_1', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймайте 2 покемонов для цирка', rewardMoney: 500, rewardItem: 'tm', rewardQty: 1, prereqQuest: null }],
  },
  // === WEST JOHTO NPCs ===
  'summer_institute': {
    id: 'summer_institute', name: 'Учёный Саммера', sprite: '🔬', location: 'summer',
    dialog: { greet: 'Научный институт Саммера исследует редких покемонов саванны.', default: 'Саванна полна загадок.', quest_offer: 'Принеси мне {target} {item} для исследований.', quest_complete: 'Отличный образец! Это продвинет науку.', quest_incomplete: 'Лаборатория ждёт образцов...' },
    quests: [{ id: 'sum_1', type: 'collect_items', targetItem: 'lavaCore', targetQty: 2, desc: 'Принесите 2 ядра магмы для института', rewardMoney: 800, rewardItem: 'fireStone', rewardQty: 1, prereqQuest: null }],
  },
  'summer_gibson': {
    id: 'summer_gibson', name: 'Мистер Гибсон', sprite: '🤠', location: 'summer',
    dialog: { greet: 'Я ищу Земли Прайда. Поможешь?', default: 'Земли Прайда ждут своего героя.', quest_offer: 'Подготовься: собери {target} {item} перед походом.', quest_complete: 'Ты готов! Отправляемся в Земли Прайда!', quest_incomplete: 'Снаряжение ещё не полное...' },
    quests: [{ id: 'sum_2', type: 'defeat_x', targetItem: null, targetQty: 4, desc: 'Победите 4 диких покемонов в саванне', rewardMoney: 600, rewardItem: 'superPotion', rewardQty: 3, prereqQuest: 'sum_1' }, { id: 'sum_3', type: 'explore', targetItem: null, targetQty: 4, desc: 'Исследуйте 4 локации Западного Джото', rewardMoney: 1000, rewardItem: 'sunStone', rewardQty: 1, prereqQuest: 'sum_2' }],
  },
  'melen_diver': {
    id: 'melen_diver', name: 'Дайвер Мелена', sprite: '🤿', location: 'melen',
    dialog: { greet: 'Дайвинг-центр Мелена — лучший в Джото!', default: 'Под водой скрываются редкие покемоны.', quest_offer: 'Нужен {target} {item} для нового снаряжения.', quest_complete: 'Снаряжение готово! Ныряем!', quest_incomplete: 'Мастерская масок поможет...' },
    quests: [{ id: 'mel_1', type: 'collect_items', targetItem: 'crystalShard', targetQty: 2, desc: 'Принесите 2 Осколка кристалла', rewardMoney: 500, rewardItem: 'waterStone', rewardQty: 1, prereqQuest: null }],
  },
  // === SELEN ISLAND NPCs ===
  'ostaron_sage': {
    id: 'ostaron_sage', name: 'Мудрец Остарона', sprite: '🧙', location: 'ostaron',
    dialog: { greet: 'Остарон благословлён легендарным покемоном.', default: 'Мудрость приходит с опытом.', quest_offer: 'Помоги найти пропавшего Меррипика: нужен {target} {item}.', quest_complete: 'Ты нашёл его! Благословляю тебя.', quest_incomplete: 'Меррипик где-то на острове...' },
    quests: [{ id: 'ost_1', type: 'explore', targetItem: null, targetQty: 5, desc: 'Посетите 5 локаций острова Селен', rewardMoney: 1000, rewardItem: 'iceStone', rewardQty: 1, prereqQuest: null }],
  },
  'ostaron_chris': {
    id: 'ostaron_chris', name: 'Крис-покемоновед', sprite: '📋', location: 'ostaron',
    dialog: { greet: 'Я перевоспитываю покемонов! 90% шанс сменить характер.', default: 'Характер влияет на статы.', quest_offer: 'Принеси {target} {item} для моих подопечных.', quest_complete: 'Покемоны счастливы! Спасибо!', quest_incomplete: 'Покемоны ждут угощения...' },
    quests: [{ id: 'ost_2', type: 'use_item', targetItem: null, targetQty: 3, desc: 'Используйте 3 предмета на покемонах', rewardMoney: 400, rewardItem: 'candy', rewardQty: 5, prereqQuest: 'ost_1' }],
  },
  'sayref_mayor': {
    id: 'sayref_mayor', name: 'Мэр Сайрефа', sprite: '🏛️', location: 'sayref',
    dialog: { greet: 'Сайреф соперничает с Остароном за звание столицы!', default: 'Наш снеговик — символ города.', quest_offer: 'Укрепи позиции города: принеси {target} {item}.', quest_complete: 'Сайреф процветает!', quest_incomplete: 'Город нуждается в ресурсах...' },
    quests: [{ id: 'say_1', type: 'collect_items', targetItem: 'rockSample', targetQty: 4, desc: 'Принесите 4 Образца породы', rewardMoney: 600, rewardItem: 'dawnStone', rewardQty: 1, prereqQuest: null }],
  },
  'estaire_shipyard': {
    id: 'estaire_shipyard', name: 'Мастер верфи', sprite: '🔧', location: 'estaire_city',
    dialog: { greet: 'Верфь Эстайра строит лучшие корабли!', default: 'Мы строим и чиним корабли.', quest_offer: 'Для заказа нужны {target} {item}.', quest_complete: 'Корабль готов к спуску!', quest_incomplete: 'Детали в дефиците...' },
    quests: [{ id: 'est_1', type: 'collect_items', targetItem: 'magnemiteNut', targetQty: 3, desc: 'Принесите 3 Магнитные гайки', rewardMoney: 700, rewardItem: 'shinyStone', rewardQty: 1, prereqQuest: null }],
  },
  'mountain_village_elder': {
    id: 'mountain_village_elder', name: 'Старейшина деревни', sprite: '👴', location: 'mountain_village',
    dialog: { greet: 'Добро пожаловать в нашу горную деревню, путник.', default: 'Горы хранят древние тайны.', quest_offer: 'Найди {target} {item} в ледяных пещерах.', quest_complete: 'Ты достоин уважения гор.', quest_incomplete: 'Горы испытают тебя...' },
    quests: [{ id: 'mv_1', type: 'defeat_x', targetItem: null, targetQty: 5, desc: 'Победите 5 покемонов в горах', rewardMoney: 900, rewardItem: 'iceStone', rewardQty: 1, prereqQuest: null }],
  },
  // === SOUTHERN ARCHIPELAGO NPCs ===
  'ilde_marcel': {
    id: 'ilde_marcel', name: 'Марсель де Фар', sprite: '🧭', location: 'il_de_far',
    dialog: { greet: 'Добро пожаловать в Иль де Фар — сердце Южного Архипелага!', default: 'Здесь вы найдёте редких покемонов и удивительные места.', quest_offer: 'Для исследования островов нужен {target} {item}.', quest_complete: 'Ты готов к приключениям! Исследуй архипелаг.', quest_incomplete: 'Подготовься получше...' },
    quests: [{ id: 'sa_1', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 локации Архипелага', rewardMoney: 800, rewardItem: 'masterBall', rewardQty: 1, prereqQuest: null }],
  },
  'sen_aspir_elder': {
    id: 'sen_aspir_elder', name: 'Старейшина Сен Аспира', sprite: '🧓', location: 'sen_aspir',
    dialog: { greet: 'Сен Аспир построен у подножия вулкана Синнабунг.', default: 'Вулкан даёт нам силу.', quest_offer: 'Принеси мне {target} {item} с вулканических склонов.', quest_complete: 'Вулкан благосклонен к тебе!', quest_incomplete: 'Вулкан ждёт подношений...' },
    quests: [{ id: 'sa_2', type: 'collect_items', targetItem: 'lavaCore', targetQty: 3, desc: 'Принесите 3 ядра магмы для старейшины', rewardMoney: 1000, rewardItem: 'fireStone', rewardQty: 1, prereqQuest: 'sa_1' }],
  },
  'orlua_ghost': {
    id: 'orlua_ghost', name: 'Призрак поместья', sprite: '👻', location: 'orlua_estate',
    dialog: { greet: 'Добро пожаловать в моё поместье... навсегда.', default: 'Здесь обитают духи покемонов.', quest_offer: 'Освободи меня: найди {target} {item}.', quest_complete: 'Спасибо... я свободен...', quest_incomplete: 'Я жду освобождения...' },
    quests: [{ id: 'sa_3', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймайте 2 призрачных покемонов для освобождения', rewardMoney: 1500, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: 'sa_2' }],
  },
  // === EAST JOHTO QUEST NPCs (from wiki quests) ===
  'ej_storn': {
    id: 'ej_storn', name: 'Сторн', sprite: '🦸', location: 'goldenrod',
    dialog: { greet: 'Я Сторн! Собери Великолепную Пятёрку!', default: 'Великолепная Пятёрка ждёт тебя.', quest_offer: 'Принеси мне {target} {item} для команды.', quest_complete: 'Теперь мы непобедимы!', quest_incomplete: 'Пятёрка ещё не в сборе...' },
    quests: [{ id: 'ej_storn_1', type: 'catch_x', targetItem: null, targetQty: 5, desc: 'Поймайте 5 разных покемонов', rewardMoney: 1000, rewardItem: 'greatBall', rewardQty: 5, prereqQuest: null }],
  },
  'ej_bridge': {
    id: 'ej_bridge', name: 'Дядюшка Бридж', sprite: '👴', location: 'bridge_ej',
    dialog: { greet: 'Привет, путник! Я Дядюшка Бридж.', default: 'Мост соединяет судьбы.', quest_offer: 'Мне нужны материалы: {target} {item}.', quest_complete: 'Мост будет стоять вечно!', quest_incomplete: 'Мост требует ремонта...' },
    quests: [{ id: 'ej_bridge_1', type: 'collect_items', targetItem: 'rockSample', targetQty: 3, desc: 'Принесите 3 Образца породы', rewardMoney: 400, rewardItem: 'potion', rewardQty: 5, prereqQuest: null }],
  },
  'ej_palmer': {
    id: 'ej_palmer', name: 'Несчастный Пальмер', sprite: '😰', location: 'alston',
    dialog: { greet: 'Ох... всё пошло не так...', default: 'Моя жизнь — череда неудач.', quest_offer: 'Помоги мне: нужен {target} {item}.', quest_complete: 'Наконец-то удача! Спасибо!', quest_incomplete: 'Опять не везёт...' },
    quests: [{ id: 'ej_palmer_1', type: 'defeat_x', targetItem: null, targetQty: 3, desc: 'Победите 3 диких покемонов', rewardMoney: 500, rewardItem: 'luckyEgg', rewardQty: 1, prereqQuest: null }],
  },
  'ej_granny': {
    id: 'ej_granny', name: 'Старушка', sprite: '👵', location: 'flourence',
    dialog: { greet: 'Здравствуй, милок. Собираю камушки.', default: 'Камушки рассказывают истории.', quest_offer: 'Найди мне {target} {item}, будь добр.', quest_complete: 'Чудесные камушки! Держи награду.', quest_incomplete: 'Камушки где-то рядом...' },
    quests: [{ id: 'ej_granny_1', type: 'collect_items', targetItem: 'crystalShard', targetQty: 5, desc: 'Принесите 5 Осколков кристалла', rewardMoney: 300, rewardItem: 'shinyStone', rewardQty: 1, prereqQuest: null }],
  },
  'ej_richie': {
    id: 'ej_richie', name: 'Богатенький Ричи', sprite: '💰', location: 'goldenrod',
    dialog: { greet: 'Ха! Ещё один бедняк. Я Ричи — самый богатый в Джото!', default: 'Деньги решают всё.', quest_offer: 'Мне нужна редкая вещь: {target} {item}. Заплачу щедро!', quest_complete: 'Великолепно! Вот твоя награда, бедняк.', quest_incomplete: 'Где мой заказ?!' },
    quests: [{ id: 'ej_richie_1', type: 'collect_items', targetItem: 'lavaCore', targetQty: 2, desc: 'Принесите Ричи 2 Ядра магмы', rewardMoney: 3000, rewardItem: 'masterBall', rewardQty: 1, prereqQuest: null }],
  },
  // === WEST JOHTO QUEST NPCs ===
  'wj_mantej': {
    id: 'wj_mantej', name: 'Мантедж', sprite: '💪', location: 'volcanic_plateau',
    dialog: { greet: 'Я МАНТЕДЖ! Слышишь грохот?!', default: 'Вулкан — мой дом!', quest_offer: 'Докажи силу: принеси {target} {item}!', quest_complete: 'ХА! Ты достоин уважения!', quest_incomplete: 'Слабак! Приходи когда окрепнешь.' },
    quests: [{ id: 'wj_mantej_1', type: 'defeat_x', targetItem: null, targetQty: 6, desc: 'Победите 6 диких покемонов', rewardMoney: 1200, rewardItem: 'fireStone', rewardQty: 1, prereqQuest: null }],
  },
  'wj_maisho': {
    id: 'wj_maisho', name: 'Маишо', sprite: '🧪', location: 'melen',
    dialog: { greet: 'Я Маишо, алхимик Мелена. Нужно зелье?', default: 'Зелье Маишо — лучшее в Джото!', quest_offer: 'Для зелья нужен {target} {item}.', quest_complete: 'Зелье готово! Пользуйся с умом.', quest_incomplete: 'Ингредиенты ещё не собраны...' },
    quests: [{ id: 'wj_maisho_1', type: 'collect_items', targetItem: 'seviperVenom', targetQty: 2, desc: 'Принесите 2 Яда Сивайпера', rewardMoney: 600, rewardItem: 'fullRestore', rewardQty: 3, prereqQuest: null }],
  },
  'wj_pantir': {
    id: 'wj_pantir', name: 'Пантир', sprite: '🐾', location: 'empty_city',
    dialog: { greet: 'Мой Пантир... потерялся в руинах.', default: 'Пантир где-то здесь...', quest_offer: 'Найди Пантира! Ищи {target} {item} как след.', quest_complete: 'Пантир! Ты жив! Спасибо, тренер!', quest_incomplete: 'Следы ведут глубже в руины...' },
    quests: [{ id: 'wj_pantir_1', type: 'explore', targetItem: null, targetQty: 4, desc: 'Посетите 4 локации Западного Джото', rewardMoney: 800, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: null }],
  },
  // === KANTO QUEST NPCs ===
  'kanto_lucy': {
    id: 'kanto_lucy', name: 'Люси', sprite: '🎀', location: 'lavender_town',
    dialog: { greet: 'Моя кукла... она потерялась...', default: 'Кукла Люси — всё что у меня есть.', quest_offer: 'Найди куклу! Нужен {target} {item} чтобы её найти.', quest_complete: 'Моя кукла! Ты нашёл её!', quest_incomplete: 'Кукла где-то в Лавандии...' },
    quests: [{ id: 'k_lucy_1', type: 'collect_items', targetItem: 'plantSample', targetQty: 3, desc: 'Принесите 3 Образца растений для поиска', rewardMoney: 400, rewardItem: 'candy', rewardQty: 3, prereqQuest: null }],
  },
  'kanto_swot': {
    id: 'kanto_swot', name: 'Профессор Свот', sprite: '📚', location: 'goldenrod_academy_branch',
    dialog: { greet: 'Я профессор Свот из Академии. Готов к исследованиям?', default: 'Академия ждёт твоих открытий.', quest_offer: 'Для диссертации нужен {target} {item}.', quest_complete: 'Превосходное исследование!', quest_incomplete: 'Данных недостаточно...' },
    quests: [{ id: 'k_swot_1', type: 'catch_x', targetItem: null, targetQty: 4, desc: 'Поймайте 4 покемонов для Академии', rewardMoney: 900, rewardItem: 'tm', rewardQty: 2, prereqQuest: null }],
  },
  'vermilion_mayor': {
    id: 'vermilion_mayor', name: 'Стивен Мейли', sprite: '👔', location: 'vermilion',
    dialog: { greet: 'Я Стивен Мейли, мэр Вермилиона. Нужна помощь!', default: 'Городские дела не ждут.', quest_offer: 'Передай {target} {item} — это срочно!', quest_complete: 'Работа сделана! Город благодарит тебя.', quest_incomplete: 'Документы ещё не доставлены...' },
    quests: [{ id: 'k_verm_1', type: 'explore', targetItem: null, targetQty: 2, desc: 'Посетите 2 локации Канто', rewardMoney: 600, rewardItem: 'superPotion', rewardQty: 3, prereqQuest: null }],
  },
  // === SELEN ISLAND QUEST NPCs ===
  'selen_mary': {
    id: 'selen_mary', name: 'Мери', sprite: '👧', location: 'ostaron',
    dialog: { greet: 'Мой Меррипик пропал! Помогите!', default: 'Меррипик — мой лучший друг.', quest_offer: 'Найди Меррипика! Понадобится {target} {item}.', quest_complete: 'Меррипик вернулся! Спасибо огромное!', quest_incomplete: 'Меррипик где-то на Селене...' },
    quests: [{ id: 'sel_mary_1', type: 'explore', targetItem: null, targetQty: 4, desc: 'Посетите 4 локации Селена', rewardMoney: 700, rewardItem: 'iceStone', rewardQty: 1, prereqQuest: null }],
  },
  'selen_museum': {
    id: 'selen_museum', name: 'Куратор музея', sprite: '🏺', location: 'estaire_city',
    dialog: { greet: 'Музей Эстайр сити ограблен!', default: 'Экспонаты всё ещё не найдены.', quest_offer: 'Найди похитителей! Нужен {target} {item}.', quest_complete: 'Экспонаты возвращены! Ты герой!', quest_incomplete: 'Расследование продолжается...' },
    quests: [{ id: 'sel_museum_1', type: 'defeat_x', targetItem: null, targetQty: 5, desc: 'Победите 5 покемонов Команды R', rewardMoney: 1200, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: null }],
  },
  // === SOUTHERN ARCHIPELAGO QUEST NPCs ===
  'sa_pirate': {
    id: 'sa_pirate', name: 'Капитан пиратов', sprite: '🏴‍☠️', location: 'il_de_far',
    dialog: { greet: 'Свистать всех наверх! Хочешь в команду?', default: 'Море зовёт!', quest_offer: 'Принеси мне {target} {item} для корабля.', quest_complete: 'Йо-хо-хо! Ты принят в команду!', quest_incomplete: 'Корабль ждёт припасов...' },
    quests: [{ id: 'sa_pirate_1', type: 'collect_items', targetItem: 'crystalShard', targetQty: 4, desc: 'Принесите 4 Осколка кристалла', rewardMoney: 1000, rewardItem: 'waterStone', rewardQty: 1, prereqQuest: null }],
  },
  'sa_ice_cave': {
    id: 'sa_ice_cave', name: 'Исследователь пещер', sprite: '🥶', location: 'ice_cave_sa',
    dialog: { greet: 'Эта ледяная пещера... здесь скрыта тайна!', default: 'Холод не остановит науку!', quest_offer: 'Для экспедиции нужен {target} {item}.', quest_complete: 'Тайна раскрыта! Невероятно!', quest_incomplete: 'Пещера хранит свои секреты...' },
    quests: [{ id: 'sa_ice_1', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймайте 3 ледяных покемонов', rewardMoney: 800, rewardItem: 'iceStone', rewardQty: 1, prereqQuest: null }],
  },
  'cerulean_settler': { id: 'cerulean_settler', name: 'Местный поселенец', sprite: '👤', location: 'cerulean_city', dialog: { greet: 'Приветствую в Церулине! Наш город славится водой.', default: 'Церулин прекрасен в любое время года.' }, quests: [] },
  'cerulean_barman_al': { id: 'cerulean_barman_al', name: 'Бармен Аль', sprite: '🍺', location: 'cerulean_tavern', dialog: { greet: 'Лучший бар в Церулине! Заходи.', default: 'Вечером у нас музыка.' }, quests: [] },
  'cerulean_jack': { id: 'cerulean_jack', name: 'Джек', sprite: '🧢', location: 'cerulean_city', dialog: { greet: 'Я Джек, местный завсегдатай.', default: 'Всех тут знаю.' }, quests: [] },
  'cerulean_auctioneer': { id: 'cerulean_auctioneer', name: 'Аукционист', sprite: '🔨', location: 'cerulean_pokemarket', dialog: { greet: 'Аукцион начинается! Кто даст больше?', default: 'Редкие лоты ждут.' }, quests: [] },
  'cerulean_agent_james': { id: 'cerulean_agent_james', name: 'Агент Джеймс', sprite: '🕶️', location: 'cerulean_city', dialog: { greet: 'Агент Джеймс. Веду расследование.', default: 'Не видели ничего подозрительного?' }, quests: [] },
  'cerulean_agent_stace': { id: 'cerulean_agent_stace', name: 'Агент Стейс', sprite: '🕶️', location: 'cerulean_city', dialog: { greet: 'Агент Стейс, напарница Джеймса.', default: 'Мы работаем под прикрытием.' }, quests: [] },
  'cerulean_surfer': { id: 'cerulean_surfer', name: 'Сёрфингист', sprite: '🏄', location: 'cerulean_city', dialog: { greet: 'Волны Церулина — лучшие в Канто!', default: 'Сёрфинг — это свобода.' }, quests: [] },

  'vermilion_judith': { id: 'vermilion_judith', name: 'Джудит', sprite: '👩', location: 'vermilion', dialog: { greet: 'Моя кукла Люси пропала...', default: 'Спасибо что помогаете искать!' }, quests: [{ id: 'k_lucy_doll', type: 'collect_items', targetItem: 'plantSample', targetQty: 3, desc: 'Найдите 3 образца растений для поисков куклы Люси', rewardMoney: 600, rewardItem: 'lumBerry', rewardQty: 3, prereqQuest: null }] },
  'vermilion_secretary': { id: 'vermilion_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'vermilion_stadium', dialog: { greet: 'Я секретарь стадиона. Лидер ждёт.', default: 'Запись на битву открыта.' }, quests: [] },
  'vermilion_librarian': { id: 'vermilion_librarian', name: 'Библиотекарь', sprite: '📚', location: 'vermilion_library', dialog: { greet: 'Добро пожаловать в библиотеку!', default: 'У нас богатая коллекция книг о покемонах.' }, quests: [] },
  'vermilion_kiosk': { id: 'vermilion_kiosk', name: 'Работник киоска', sprite: '🎫', location: 'vermilion_port', dialog: { greet: 'Свежие новости! Билеты на паром!', default: 'Киоск работает круглосуточно.' }, quests: [] },
  'vermilion_ron': { id: 'vermilion_ron', name: 'Рон', sprite: '👨', location: 'vermilion_port', dialog: { greet: 'Я Рон, портовый рабочий.', default: 'Порт никогда не спит.' }, quests: [] },
  'vermilion_seller1': { id: 'vermilion_seller1', name: 'Продавец', sprite: '🛒', location: 'vermilion_pokemarket', dialog: { greet: 'Покупайте товары!', default: 'Свежий завоз!' }, quests: [] },

  'lavender_miss_trevis': { id: 'lavender_miss_trevis', name: 'Мисс Тревис', sprite: '👩‍🏫', location: 'lavender_town', dialog: { greet: 'Лавандия — город упокоения.', default: 'Башня Призраков хранит тайны.' }, quests: [] },
  'lavender_secretary': { id: 'lavender_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'lavender_bug_stadium', dialog: { greet: 'Стадион Жуков открыт!', default: 'Лидер ждёт вас.' }, quests: [] },
  'lavender_guard': { id: 'lavender_guard', name: 'Охранник', sprite: '💂', location: 'lavender_radio_tower', dialog: { greet: 'Порядок под контролем.', default: 'Не шалите.' }, quests: [] },
  'lavender_seller': { id: 'lavender_seller', name: 'Продавец', sprite: '🛒', location: 'lavender_pokemarket', dialog: { greet: 'Товары для тренеров!', default: 'Заходите!' }, quests: [] },

  'celadon_arthur_wilford': { id: 'celadon_arthur_wilford', name: 'Артур Вилфорд', sprite: '🎩', location: 'celadon_city', dialog: { greet: 'Я Артур Вилфорд, старейшина Целадона.', default: 'Целадон — город изобилия.' }, quests: [] },
  'celadon_secretary': { id: 'celadon_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'celadon_city', dialog: { greet: 'Стадион Эрики открыт.', default: 'Лидер ждёт.' }, quests: [] },
  'celadon_little_girl': { id: 'celadon_little_girl', name: 'Маленькая девочка', sprite: '👧', location: 'celadon_city', dialog: { greet: 'Я люблю гулять по Целадону!', default: 'У меня есть покемон-друг!' }, quests: [] },
  'celadon_meteorologist': { id: 'celadon_meteorologist', name: 'Ведущий метеоролог', sprite: '🌤️', location: 'celadon_city', dialog: { greet: 'Прогноз погоды — наша работа.', default: 'Погода влияет на покемонов.' }, quests: [{ id: 'cel_weather', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 локации для сбора метеоданных', rewardMoney: 700, rewardItem: 'tm', rewardQty: 1, prereqQuest: null }] },
  'celadon_pharmacist': { id: 'celadon_pharmacist', name: 'Аптекарь', sprite: '💊', location: 'celadon_city', dialog: { greet: 'Аптека Целадона.', default: 'Здоровье команды — наш приоритет.' }, quests: [] },
  'celadon_tm_seller': { id: 'celadon_tm_seller', name: 'Продавец ТМ', sprite: '📀', location: 'celadon_city', dialog: { greet: 'Технические Машины!', default: 'Новинки каждую неделю!' }, quests: [] },
  'celadon_stone_seller': { id: 'celadon_stone_seller', name: 'Продавец камней', sprite: '💎', location: 'celadon_city', dialog: { greet: 'Камни эволюции!', default: 'Редкие камни со всего мира.' }, quests: [] },
  'celadon_barber': { id: 'celadon_barber', name: 'Парикмахер', sprite: '💇', location: 'celadon_city', dialog: { greet: 'Стильная стрижка для вас!', default: 'Новый образ — новые победы!' }, quests: [] },
  'celadon_tattoo': { id: 'celadon_tattoo', name: 'Татуировщик', sprite: '🎨', location: 'celadon_city', dialog: { greet: 'Лучшие тату в Канто!', default: 'Татуировка — это навсегда.' }, quests: [] },
  'celadon_electronics': { id: 'celadon_electronics', name: 'Продавец электроники', sprite: '📱', location: 'celadon_city', dialog: { greet: 'Техника для тренеров!', default: 'Новинки из Силф Ко!' }, quests: [] },
  'celadon_balls': { id: 'celadon_balls', name: 'Продавец покеболов', sprite: '⚽', location: 'celadon_city', dialog: { greet: 'Покеболы всех видов!', default: 'Ловите с комфортом!' }, quests: [] },
  'celadon_appliances': { id: 'celadon_appliances', name: 'Продавец техники', sprite: '🔌', location: 'celadon_city', dialog: { greet: 'Бытовая техника для дома.', default: 'Качество гарантирую.' }, quests: [] },
  'celadon_craftsman': { id: 'celadon_craftsman', name: 'Продавец-ремесленник', sprite: '🔧', location: 'celadon_city', dialog: { greet: 'Ручная работа!', default: 'Каждая вещь с душой.' }, quests: [] },

  'saffron_tailor': { id: 'saffron_tailor', name: 'Портниха', sprite: '🧵', location: 'saffron', dialog: { greet: 'Шью лучшие костюмы!', default: 'Стиль важен даже в битве.' }, quests: [] },
  'saffron_secretary': { id: 'saffron_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'saffron_psychic_stadium', dialog: { greet: 'Стадион Сабрины — для сильных духом.', default: 'Психические покемоны чувствуют ауру.' }, quests: [] },
  'saffron_cashier': { id: 'saffron_cashier', name: 'Кассир', sprite: '💲', location: 'saffron_east_station', dialog: { greet: 'Билеты на поезд!', default: 'Счастливого пути!' }, quests: [] },
  'saffron_lottery': { id: 'saffron_lottery', name: 'Лотерейщик', sprite: '🎰', location: 'saffron_west_pokemarket', dialog: { greet: 'Лотерея Лиги-17!', default: 'Главный приз — редкий покемон!' }, quests: [] },

  'fuchsia_olan': { id: 'fuchsia_olan', name: 'Олан', sprite: '🧙', location: 'fuchsia_city', dialog: { greet: 'Я Олан, хранитель традиций Фуксии.', default: 'Фуксия — город ниндзя.' }, quests: [] },
  'fuchsia_branzer_richard': { id: 'fuchsia_branzer_richard', name: 'Бранзер Ричард', sprite: '🔥', location: 'fuchsia_city', dialog: { greet: 'Бранзеры — лучшие покемоны!', default: 'Мои Бранзеры — моя гордость.' }, quests: [] },
  'fuchsia_sailboat': { id: 'fuchsia_sailboat', name: 'Парусник', sprite: '⛵', location: 'fuchsia_beach', dialog: { greet: 'Парусник до Архипелага!', default: 'Море зовёт!' }, quests: [] },

  'goldenrod_prof_nils': { id: 'goldenrod_prof_nils', name: 'Профессор Нилс', sprite: '🔬', location: 'goldenrod_academy', dialog: { greet: 'Я профессор Нилс из Академии.', default: 'Эволюция — удивительный процесс!' }, quests: [] },
  'goldenrod_prof_karmen': { id: 'goldenrod_prof_karmen', name: 'Профессор Кармен', sprite: '🔬', location: 'goldenrod_academy', dialog: { greet: 'Профессор Кармен.', default: 'Каждая атака имеет свою историю.' }, quests: [] },
  'goldenrod_trainer_ted': { id: 'goldenrod_trainer_ted', name: 'Тренер Тэд', sprite: '🎓', location: 'goldenrod_academy', dialog: { greet: 'Я Тренер Тэд, выпускник Академии.', default: 'Академия дала мне всё.' }, quests: [] },
  'goldenrod_barman': { id: 'goldenrod_barman', name: 'Бармен', sprite: '🍺', location: 'goldenrod_bar', dialog: { greet: 'Лучший бар в Голденроде!', default: 'После трудного дня — только сюда.' }, quests: [] },
  'goldenrod_secretary': { id: 'goldenrod_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'goldenrod', dialog: { greet: 'Стадион Уитни открыт.', default: 'Нормальные покемоны сильнее чем кажутся!' }, quests: [] },
  'goldenrod_kiosk': { id: 'goldenrod_kiosk', name: 'Работник киоска', sprite: '🎫', location: 'goldenrod_supermarket', dialog: { greet: 'Информация о городе!', default: 'Всё что нужно тренеру.' }, quests: [] },
  'goldenrod_clan_commander': { id: 'goldenrod_clan_commander', name: 'Командир штаба', sprite: '🛡️', location: 'goldenrod_cityhall', dialog: { greet: 'Кланы — сила Лиги.', default: 'Вступите в клан!' }, quests: [] },
  'goldenrod_clan_master': { id: 'goldenrod_clan_master', name: 'Клан-мастер', sprite: '👑', location: 'goldenrod_cityhall', dialog: { greet: 'Я Клан-мастер.', default: 'Клан — это семья.' }, quests: [] },
  'goldenrod_clan_secretary': { id: 'goldenrod_clan_secretary', name: 'Клан-секретарь', sprite: '📝', location: 'goldenrod_cityhall', dialog: { greet: 'Веду учёт кланов.', default: 'Бюрократия — двигатель порядка.' }, quests: [] },
  'goldenrod_editor': { id: 'goldenrod_editor', name: 'Главный редактор', sprite: '📰', location: 'new_district', dialog: { greet: 'Главный редактор газеты.', default: 'Свежий выпуск уже в печати!' }, quests: [] },

  'old_district_sergeant': { id: 'old_district_sergeant', name: 'Сержант', sprite: '👮', location: 'old_district', dialog: { greet: 'Сержант полиции.', default: 'Не нарушайте закон.' }, quests: [] },
  'old_district_veteran': { id: 'old_district_veteran', name: 'Ветеран', sprite: '🎖️', location: 'old_district', dialog: { greet: 'Я ветеран. Много битв за плечами.', default: 'Хочешь совет от старого бойца?' }, quests: [{ id: 'ej_memorable', type: 'defeat_x', targetItem: null, targetQty: 4, desc: 'Победите 4 покемонов в памятном бою', rewardMoney: 800, rewardItem: 'fullRestore', rewardQty: 2, prereqQuest: null }] },
  'old_district_stuart': { id: 'old_district_stuart', name: 'Стюарт', sprite: '👨', location: 'old_district', dialog: { greet: 'Стюарт, житель Старого района.', default: 'Тут тихо и спокойно.' }, quests: [] },
  'old_district_master_rob': { id: 'old_district_master_rob', name: 'Мастер Роб', sprite: '🔧', location: 'old_district', dialog: { greet: 'Мастер Роб. Чиню всё.', default: 'Приноси — починю.' }, quests: [] },

  'new_district_lieutenant': { id: 'new_district_lieutenant', name: 'Лейтенант', sprite: '👮', location: 'new_district', dialog: { greet: 'Лейтенант полиции.', default: 'Новый район под защитой.' }, quests: [] },
  'new_district_elen': { id: 'new_district_elen', name: 'Элен', sprite: '🦸', location: 'new_district', dialog: { greet: 'Я Элен из Великолепной Пятёрки.', default: 'Сторн собрал нас ради великой цели!' }, quests: [] },
  'new_district_guard': { id: 'new_district_guard', name: 'Охранник', sprite: '💂', location: 'new_district', dialog: { greet: 'Охраняю Новый район.', default: 'Без пропуска не пройти.' }, quests: [] },
  'new_district_mrs_booker': { id: 'new_district_mrs_booker', name: 'Миссис Букер', sprite: '👩', location: 'new_district', dialog: { greet: 'Миссис Букер.', default: 'Заходите на чай!' }, quests: [] },
  'new_district_mr_booker': { id: 'new_district_mr_booker', name: 'Мистер Букер', sprite: '👨', location: 'new_district', dialog: { greet: 'Мистер Букер к вашим услугам.', default: 'Новый район — лучшее место.' }, quests: [] },
  'new_district_richard': { id: 'new_district_richard', name: 'Ричард', sprite: '👨', location: 'new_district', dialog: { greet: 'Я Ричард. Работаю на радио.', default: 'Радиобашня вещает на всё Джото!' }, quests: [] },
  'new_district_kristen': { id: 'new_district_kristen', name: 'Кристен', sprite: '🏃', location: 'new_district', dialog: { greet: 'Я Кристен. Ветер зовёт вперёд!', default: 'Бег — это жизнь!' }, quests: [{ id: 'ej_wind', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 локации в поисках ветра', rewardMoney: 600, rewardItem: 'tm', rewardQty: 1, prereqQuest: null }] },
  'new_district_train': { id: 'new_district_train', name: 'Поезд', sprite: '🚂', location: 'new_district', dialog: { greet: 'Поезд до Шаффрана.', default: 'Занимайте места!' }, quests: [] },

  'olivine_glen': { id: 'olivine_glen', name: 'Глен', sprite: '👨', location: 'olivine', dialog: { greet: 'Я Глен, портовый рабочий.', default: 'Оливинский порт — лучший в Джото.' }, quests: [] },
  'olivine_evan': { id: 'olivine_evan', name: 'Эван', sprite: '👨', location: 'olivine_beach', dialog: { greet: 'Эван. Рыбачу 20 лет.', default: 'Рыбалка учит терпению.' }, quests: [] },
  'olivine_arina': { id: 'olivine_arina', name: 'Арина', sprite: '👩', location: 'olivine', dialog: { greet: 'Арина. Люблю наблюдать за кораблями.', default: 'Море бесконечно.' }, quests: [] },
  'olivine_barman_elvin': { id: 'olivine_barman_elvin', name: 'Бармен Элвин', sprite: '🍺', location: 'olivine_bar_pirate', dialog: { greet: 'Пиратское убежище открыто!', default: 'Лучший ром на побережье!' }, quests: [] },
  'olivine_lighthouse_keeper': { id: 'olivine_lighthouse_keeper', name: 'Смотритель маяка', sprite: '🔦', location: 'olivine_beach_lighthouse', dialog: { greet: 'Я смотритель маяка.', default: 'Браконьеры? Да, видел их...' }, quests: [{ id: 'oli_brakonier', type: 'defeat_x', targetItem: null, targetQty: 5, desc: 'Победите 5 браконьеров у маяка', rewardMoney: 1000, rewardItem: 'waterStone', rewardQty: 1, prereqQuest: null }] },
  'olivine_marta': { id: 'olivine_marta', name: 'Марта', sprite: '👩', location: 'olivine', dialog: { greet: 'Я Марта. У меня старая фотография.', default: 'На этой фотографии — моя молодость.' }, quests: [{ id: 'oli_photo', type: 'collect_items', targetItem: 'crystalShard', targetQty: 2, desc: 'Принесите 2 осколка кристалла для восстановления фотографии', rewardMoney: 400, rewardItem: 'oranBerry', rewardQty: 3, prereqQuest: null }] },
  'olivine_janet': { id: 'olivine_janet', name: 'Жанет', sprite: '👩', location: 'olivine_house_221', dialog: { greet: 'Жанет. Ищу рецепт зелья памяти.', default: 'Говорят оно помогает вспомнить прошлое.' }, quests: [{ id: 'oli_memory', type: 'collect_items', targetItem: 'plantSample', targetQty: 4, desc: 'Принесите 4 образца растений для зелья памяти', rewardMoney: 500, rewardItem: 'superPotion', rewardQty: 2, prereqQuest: null }] },

  'flourence_pretty_girl': { id: 'flourence_pretty_girl', name: 'Симпатичная девушка', sprite: '👩', location: 'flourence', dialog: { greet: 'Флауренция — город цветов!', default: 'Люблю этот город.' }, quests: [] },
  'flourence_trainer_jim': { id: 'flourence_trainer_jim', name: 'Тренер Джим', sprite: '🎒', location: 'flourence', dialog: { greet: 'Тренер Джим. Флауренция — мой дом.', default: 'Цветы и покемоны — идеально!' }, quests: [] },
  'flourence_florist_helper': { id: 'flourence_florist_helper', name: 'Помощник флориста', sprite: '🌸', location: 'flourence_greenhouse', dialog: { greet: 'Помогаю в оранжерее.', default: 'Приходите любоваться цветами!' }, quests: [] },
  'flourence_bulletin': { id: 'flourence_bulletin', name: 'Доска объявлений', sprite: '📌', location: 'flourence', dialog: { greet: 'Миссия: Флауренция!', default: 'Новые задания каждую неделю.' }, quests: [{ id: 'flo_mission', type: 'collect_items', targetItem: 'plantSample', targetQty: 5, desc: 'Принесите 5 образцов растений для города', rewardMoney: 500, rewardItem: 'leafStone', rewardQty: 1, prereqQuest: null }] },

  'alston_granny': { id: 'alston_granny', name: 'Старушка', sprite: '👵', location: 'alston_granny_house', dialog: { greet: 'Я старушка из Олстона.', default: 'Каждый камень рассказывает историю.' }, quests: [] },
  'alston_little_man': { id: 'alston_little_man', name: 'Маленький человек', sprite: '🎪', location: 'alston_circus', dialog: { greet: 'Цирк покемонов! Лучшее шоу!', default: 'Приходите всей семьёй!' }, quests: [{ id: 'als_circus_quest', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймайте 2 покемонов для циркового представления', rewardMoney: 500, rewardItem: 'tm', rewardQty: 1, prereqQuest: null }] },
  'alston_secretary1': { id: 'alston_secretary1', name: 'Секретарь Стального Стадиона', sprite: '📋', location: 'alston_steel_stadium', dialog: { greet: 'Стальной Стадион.', default: 'Лидер ждёт.' }, quests: [] },
  'alston_secretary2': { id: 'alston_secretary2', name: 'Секретарь Стадиона Души', sprite: '📋', location: 'alston_soul_stadium', dialog: { greet: 'Стадион Души.', default: 'Готовы к испытанию духа?' }, quests: [] },

  'summer_barman_miguel': { id: 'summer_barman_miguel', name: 'Бармен Мигель', sprite: '🍺', location: 'summer_pub', dialog: { greet: 'Паб Хаус — сердце Саммера!', default: 'Холодное пиво после жаркого дня!' }, quests: [] },
  'summer_librarian': { id: 'summer_librarian', name: 'Библиотекарь', sprite: '📚', location: 'summer_library', dialog: { greet: 'Библиотека Саммера.', default: 'У нас редкие книги о покемонах.' }, quests: [] },
  'summer_officer_jackie': { id: 'summer_officer_jackie', name: 'Офицер Джекки', sprite: '👮', location: 'summer_police', dialog: { greet: 'Офицер Джекки.', default: 'Порядок в городе — наша работа.' }, quests: [] },
  'summer_prof_niro': { id: 'summer_prof_niro', name: 'Профессор Ниро', sprite: '🔬', location: 'summer_institute', dialog: { greet: 'Профессор Ниро.', default: 'Исследуем покемонов саванны!' }, quests: [] },
  'summer_mary_research': { id: 'summer_mary_research', name: 'Мари', sprite: '👩', location: 'summer_institute', dialog: { greet: 'Я Мари, исследую вулканы.', default: 'Вулкан Синнабунг полон тайн.' }, quests: [{ id: 'sum_volcano', type: 'collect_items', targetItem: 'lavaCore', targetQty: 3, desc: 'Принесите 3 ядра магмы для исследований', rewardMoney: 800, rewardItem: 'fireStone', rewardQty: 1, prereqQuest: null }] },
  'summer_kylie': { id: 'summer_kylie', name: 'Кайли', sprite: '👧', location: 'summer', dialog: { greet: 'Моя Мурысь сбежала!', default: 'Мурысь, где ты?' }, quests: [{ id: 'sum_murys', type: 'catch_x', targetItem: null, targetQty: 1, desc: 'Найдите и поймайте сбежавшую Мурысь', rewardMoney: 500, rewardItem: 'candy', rewardQty: 3, prereqQuest: null }] },
  'summer_mila': { id: 'summer_mila', name: 'Мила', sprite: '👩', location: 'summer_pokepark', dialog: { greet: 'Я Мила.', default: 'Пантиры — удивительные покемоны.' }, quests: [{ id: 'sum_pantir_story', type: 'explore', targetItem: null, targetQty: 4, desc: 'Посетите 4 локации в поисках Пантира', rewardMoney: 700, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: null }] },
  'summer_owner': { id: 'summer_owner', name: 'Владелец', sprite: '🏢', location: 'summer_pokepark', dialog: { greet: 'Владелец Поке-парка.', default: 'Новые аттракционы скоро!' }, quests: [{ id: 'sum_park', type: 'collect_items', targetItem: 'rockSample', targetQty: 5, desc: 'Принесите 5 образцов породы для строительства', rewardMoney: 900, rewardItem: 'sunStone', rewardQty: 1, prereqQuest: null }] },
  'summer_fisk': { id: 'summer_fisk', name: 'Фиск', sprite: '💎', location: 'summer', dialog: { greet: 'Фиск. Скупаю ониксы.', default: 'Ониксы — камень удачи.' }, quests: [{ id: 'sum_onyx', type: 'collect_items', targetItem: 'rockSample', targetQty: 5, desc: 'Принесите 5 образцов породы для скупщика', rewardMoney: 1000, rewardItem: 'dawnStone', rewardQty: 1, prereqQuest: null }] },

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
  'melen_fisk': { id: 'melen_fisk', name: 'Фиск', sprite: '💎', location: 'melen', dialog: { greet: 'Фиск в Мелене.', default: 'Приносите ониксы — плачу хорошо.' }, quests: [{ id: 'mel_onyx', type: 'collect_items', targetItem: 'rockSample', targetQty: 3, desc: 'Принесите 3 оникса для Фиска', rewardMoney: 600, rewardItem: 'shinyStone', rewardQty: 1, prereqQuest: null }] },

  'ostaron_ralf': { id: 'ostaron_ralf', name: 'Ральф', sprite: '👨', location: 'ostaron', dialog: { greet: 'Ральф, житель Остарона.', default: 'Столица Селена прекрасна!' }, quests: [] },
  'ostaron_secretary': { id: 'ostaron_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'ostaron', dialog: { greet: 'Стадион Чака ждёт.', default: 'Лидер Остарона непобедим!' }, quests: [] },

  'estaire_officer_jes': { id: 'estaire_officer_jes', name: 'Офицер Джес', sprite: '👮', location: 'estaire_city', dialog: { greet: 'Офицер Джес.', default: 'Соблюдайте закон!' }, quests: [] },
  'estaire_bill': { id: 'estaire_bill', name: 'Билл', sprite: '🔬', location: 'estaire_city', dialog: { greet: 'Билл в Эстайре.', default: 'Техника для всех регионов!' }, quests: [] },
  'estaire_mayor': { id: 'estaire_mayor', name: 'Мэр Эстайра', sprite: '🏛️', location: 'estaire_city', dialog: { greet: 'Мэр Эстайра.', default: 'Эстайр растёт и развивается.' }, quests: [] },
  'estaire_happy': { id: 'estaire_happy', name: 'Хэппи', sprite: '😊', location: 'estaire_city', dialog: { greet: 'Счастье есть!', default: 'Улыбайтесь чаще!' }, quests: [{ id: 'sel_happy', type: 'collect_items', targetItem: 'plantSample', targetQty: 3, desc: 'Принесите 3 образца растений для Хэппи', rewardMoney: 400, rewardItem: 'candy', rewardQty: 5, prereqQuest: null }] },
  'estaire_toby': { id: 'estaire_toby', name: 'Тоби', sprite: '👨', location: 'estaire_city', dialog: { greet: 'Тоби из Эстайра.', default: 'Море рядом — что ещё нужно?' }, quests: [] },
  'estaire_den': { id: 'estaire_den', name: 'Ден', sprite: '👨', location: 'estaire_city', dialog: { greet: 'Ден. Работаю в порту.', default: 'Корабли приходят и уходят.' }, quests: [] },
  'estaire_auctioneer': { id: 'estaire_auctioneer', name: 'Аукционист', sprite: '🔨', location: 'estaire_city', dialog: { greet: 'Аукцион Эстайра!', default: 'Кто предложит больше?' }, quests: [] },
  'estaire_appliances': { id: 'estaire_appliances', name: 'Продавец техники', sprite: '🔌', location: 'estaire_private_shop', dialog: { greet: 'Техника для острова.', default: 'Лучшие товары здесь!' }, quests: [] },
  'estaire_cashier': { id: 'estaire_cashier', name: 'Кассир', sprite: '💲', location: 'estaire_south_pier', dialog: { greet: 'Билеты на паром.', default: 'Счастливого плавания!' }, quests: [] },

  'sayref_keeper': { id: 'sayref_keeper', name: 'Смотритель покемонов', sprite: '🧹', location: 'sayref', dialog: { greet: 'Смотритель покемонов Сайрефа.', default: 'Покемоны — наши друзья.' }, quests: [] },
  'sayref_ray': { id: 'sayref_ray', name: 'Рей', sprite: '👨', location: 'sayref', dialog: { greet: 'Рей из Сайрефа.', default: 'Снеговик — символ города.' }, quests: [] },
  'sayref_fred_svarovski': { id: 'sayref_fred_svarovski', name: 'Фред Сваровски', sprite: '💎', location: 'sayref', dialog: { greet: 'Фред Сваровски.', default: 'Рипогиты — агрессивные покемоны.' }, quests: [{ id: 'sel_ripogit', type: 'defeat_x', targetItem: null, targetQty: 4, desc: 'Победите 4 Рипогитов', rewardMoney: 800, rewardItem: 'iceStone', rewardQty: 1, prereqQuest: null }] },
  'sayref_peiri': { id: 'sayref_peiri', name: 'Пэйри', sprite: '👩', location: 'sayref', dialog: { greet: 'Пэйри.', default: 'Ледяные скульптуры — искусство.' }, quests: [] },
  'sayref_ice_statue': { id: 'sayref_ice_statue', name: 'Снеговик', sprite: '⛄', location: 'sayref', dialog: { greet: 'Я — символ Сайрефа!', default: 'Приходите фотографироваться!' }, quests: [] },
  'sayref_secretary': { id: 'sayref_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'sayref_air_stadium', dialog: { greet: 'Воздушный Стадион.', default: 'Летающие покемоны не знают границ!' }, quests: [] },

  'sel_route8_nursery': { id: 'sel_route8_nursery', name: 'Работник питомника', sprite: '🥚', location: 'estaire_daycare_center', dialog: { greet: 'Оставляйте покемонов.', default: 'Покемоны растут пока вы путешествуете.' }, quests: [{ id: 'sel_nursery', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймайте 2 покемонов для питомника', rewardMoney: 500, rewardItem: 'candy', rewardQty: 3, prereqQuest: null }] },
  'sel_route8_prof_sten': { id: 'sel_route8_prof_sten', name: 'Профессор Стэн', sprite: '🔬', location: 'estaire_daycare_center', dialog: { greet: 'Профессор Стэн.', default: 'Питомник — идеальная лаборатория.' }, quests: [] },
  'sel_route8_mad_scientist': { id: 'sel_route8_mad_scientist', name: 'Сумасшедший ученый', sprite: '🤪', location: 'estaire_daycare_center', dialog: { greet: 'Мои теории верны!', default: 'Наука не знает границ!' }, quests: [] },

  'goldenrod_academy_worker': { id: 'goldenrod_academy_worker', name: 'Работник филиала', sprite: '👨‍💼', location: 'goldenrod_academy_branch', dialog: { greet: 'Работник филиала Академии.', default: 'Исследования идут полным ходом.' }, quests: [{ id: 'sel_academy_branch', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 локации для исследования филиала', rewardMoney: 600, rewardItem: 'tm', rewardQty: 1, prereqQuest: null }] },
  'goldenrod_academy_miss_melani': { id: 'goldenrod_academy_miss_melani', name: 'Мисс Мелани', sprite: '👩‍🏫', location: 'goldenrod_academy_branch', dialog: { greet: 'Мисс Мелани.', default: 'Обучение — ключ к успеху.' }, quests: [{ id: 'academy_learn', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймайте 3 покемонов для учебной практики', rewardMoney: 400, rewardItem: 'pokeball', rewardQty: 5, prereqQuest: null }] },

  'ilde_guillaume': { id: 'ilde_guillaume', name: 'Гильом', sprite: '👨', location: 'il_de_far', dialog: { greet: 'Гильом.', default: 'Наш остров — лучший!' }, quests: [] },
  'ilde_ferryman': { id: 'ilde_ferryman', name: 'Паромщик Травэр', sprite: '⛴️', location: 'il_de_far', dialog: { greet: 'Паромщик Травэр.', default: 'Паром ходит по расписанию.' }, quests: [] },
  'ilde_cashier1': { id: 'ilde_cashier1', name: 'Кассир', sprite: '💲', location: 'il_de_far', dialog: { greet: 'Билеты на паром!', default: 'Места ограничены.' }, quests: [] },
  'ilde_cashier2': { id: 'ilde_cashier2', name: 'Кассир', sprite: '💲', location: 'il_de_far', dialog: { greet: 'Касса порта открыта.', default: 'Приятного путешествия!' }, quests: [] },
  'ilde_sailboat': { id: 'ilde_sailboat', name: 'Парусник', sprite: '⛵', location: 'il_de_far', dialog: { greet: 'Парусник до Канто!', default: 'Ветер попутный!' }, quests: [] },

  'sen_aspir_prof_quince': { id: 'sen_aspir_prof_quince', name: 'Профессор Квинс', sprite: '🔬', location: 'sen_aspir', dialog: { greet: 'Профессор Квинс.', default: 'Здесь уникальная экосистема.' }, quests: [] },
  'sen_aspir_passenger': { id: 'sen_aspir_passenger', name: 'Прохожий', sprite: '🚶', location: 'sen_aspir', dialog: { greet: 'Сен Аспир прекрасен.', default: 'Взгляд в прошлое — здесь история.' }, quests: [{ id: 'sa_past', type: 'explore', targetItem: null, targetQty: 2, desc: 'Посетите 2 исторические локации', rewardMoney: 500, rewardItem: 'dawnStone', rewardQty: 1, prereqQuest: null }] },
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

  'ice_cave_aloha': { id: 'ice_cave_aloha', name: 'Алооха', sprite: '🥶', location: 'ice_cave_sa', dialog: { greet: 'Ледяная пещера полна тайн.', default: 'Холодно? Привыкай!' }, quests: [{ id: 'sel_ice_cave', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймайте 3 ледяных покемонов в пещере', rewardMoney: 900, rewardItem: 'iceStone', rewardQty: 1, prereqQuest: null }] },

  'air_stadium_forest_lenor': { id: 'air_stadium_forest_lenor', name: 'Ленор', sprite: '👧', location: 'air_stadium_forest', dialog: { greet: 'Я Ленор. Тренируюсь в лесу.', default: 'Хочешь битву?' }, quests: [{ id: 'ej_night', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймайте 2 покемонов ночью в лесу', rewardMoney: 500, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: null }] },
  'air_stadium_forest_elder': { id: 'air_stadium_forest_elder', name: 'Старый лидер', sprite: '🧓', location: 'air_stadium_forest', dialog: { greet: 'Я бывший лидер стадиона.', default: 'Время летит...' }, quests: [] },
  'air_stadium_forest_guard': { id: 'air_stadium_forest_guard', name: 'Дежурный рейнджер', sprite: '🌲', location: 'air_stadium_forest', dialog: { greet: 'Лес патрулируется.', default: 'Рейнджеры всегда на страже.' }, quests: [{ id: 'ej_prutti', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймайте 3 покемонов Прутти', rewardMoney: 600, rewardItem: 'greatBall', rewardQty: 5, prereqQuest: null }] },
  'air_stadium_forest_alice': { id: 'air_stadium_forest_alice', name: 'Алиса', sprite: '👩', location: 'air_stadium_forest', dialog: { greet: 'Алиса.', default: 'Прутти такие милые!' }, quests: [{ id: 'ej_alice', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймайте 3 покемонов для Алисы', rewardMoney: 300, rewardItem: 'candy', rewardQty: 5, prereqQuest: null }] },
  'air_stadium_forest_farmer': { id: 'air_stadium_forest_farmer', name: 'Фермер', sprite: '👨‍🌾', location: 'air_stadium_forest', dialog: { greet: 'Моя пасека рядом с лесом.', default: 'Покемоны любят мой мёд!' }, quests: [{ id: 'ej_apiary', type: 'collect_items', targetItem: 'plantSample', targetQty: 4, desc: 'Принесите 4 образца растений для восстановления пасеки', rewardMoney: 400, rewardItem: 'sitrusBerry', rewardQty: 3, prereqQuest: null }] },

  'empty_city_shannon': { id: 'empty_city_shannon', name: 'Лидер Шэннон', sprite: '⚫', location: 'empty_city', dialog: { greet: 'Я Лидер Шэннон.', default: 'Тьма — это тоже сила.' }, quests: [] },
  'empty_city_silvestr': { id: 'empty_city_silvestr', name: 'Небритый Сильвестр', sprite: '🧔', location: 'empty_city', dialog: { greet: 'Тайна Потерянного города...', default: 'Город хранит секреты.' }, quests: [{ id: 'wj_lost_city', type: 'explore', targetItem: null, targetQty: 5, desc: 'Посетите 5 локаций в поисках Потерянного города', rewardMoney: 1000, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: null }] },

  'volcanic_plateau_leonard': { id: 'volcanic_plateau_leonard', name: 'Леонард', sprite: '🧪', location: 'volcanic_plateau', dialog: { greet: 'Леонард.', default: 'Ингредиенты? Только вулканические.' }, quests: [{ id: 'wj_potion_quest', type: 'collect_items', targetItem: 'lavaCore', targetQty: 2, desc: 'Принесите 2 ядра магмы для зелья', rewardMoney: 600, rewardItem: 'fullRestore', rewardQty: 3, prereqQuest: null }] },
  'volcanic_plateau_paulo': { id: 'volcanic_plateau_paulo', name: 'Пауло', sprite: '👨', location: 'volcanic_plateau', dialog: { greet: 'Пауло. Живу у вулкана.', default: 'Вулкан даёт силу.' }, quests: [] },

  'rocks_wj_alvares': { id: 'rocks_wj_alvares', name: 'Альварес', sprite: '⛏️', location: 'rocks_wj', dialog: { greet: 'Альварес.', default: 'Стадион снова будет греметь!' }, quests: [{ id: 'wj_earth_stadium', type: 'collect_items', targetItem: 'rockSample', targetQty: 6, desc: 'Принесите 6 образцов породы для восстановления стадиона', rewardMoney: 1200, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: null }] },
  'rocks_wj_hugo': { id: 'rocks_wj_hugo', name: 'Хьюго', sprite: '👨', location: 'rocks_wj', dialog: { greet: 'Хьюго.', default: 'Тишина скал успокаивает.' }, quests: [] },
  'rocks_wj_old_man': { id: 'rocks_wj_old_man', name: 'Дряхлый Старик', sprite: '🧓', location: 'rocks_wj', dialog: { greet: 'Я видел рождение этих скал...', default: 'Время не щадит никого.' }, quests: [] },
  'rocks_wj_pirate_char': { id: 'rocks_wj_pirate_char', name: 'Пират', sprite: '🏴‍☠️', location: 'rocks_wj', dialog: { greet: 'Пират на скалах!', default: 'Йо-хо-хо!' }, quests: [] },
  'rocks_wj_tourist': { id: 'rocks_wj_tourist', name: 'Турист', sprite: '📸', location: 'rocks_wj', dialog: { greet: 'Турист.', default: 'Говорят, это легендарное место.' }, quests: [{ id: 'wj_pride', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 локации в поисках Земель Прайда', rewardMoney: 700, rewardItem: 'sunStone', rewardQty: 1, prereqQuest: null }] },

  'deserted_road_blind': { id: 'deserted_road_blind', name: 'Незрячая', sprite: '🧑‍🦯', location: 'deserted_road_ej', dialog: { greet: 'Я не вижу, но чувствую мир.', default: 'Покемоны — мои глаза.' }, quests: [] },
  'deserted_road_bruce': { id: 'deserted_road_bruce', name: 'Брюс', sprite: '👨', location: 'deserted_road_ej', dialog: { greet: 'Брюс.', default: 'Одиночество — мой спутник.' }, quests: [] },

  'mountain_pass_scared_woman': { id: 'mountain_pass_scared_woman', name: 'Испуганная женщина', sprite: '😰', location: 'mountain_pass', dialog: { greet: 'Помогите! Здесь опасно!', default: 'Спасибо что помогли!' }, quests: [{ id: 'ej_scared', type: 'defeat_x', targetItem: null, targetQty: 3, desc: 'Победите 3 диких покемонов на горном перевале', rewardMoney: 500, rewardItem: 'potion', rewardQty: 3, prereqQuest: null }] },
  'mountain_pass_kris': { id: 'mountain_pass_kris', name: 'Крис', sprite: '👨', location: 'mountain_pass', dialog: { greet: 'Крис.', default: 'Готов к подъёму?' }, quests: [] },

  'mountain_village_archie': { id: 'mountain_village_archie', name: 'Арчи', sprite: '👨', location: 'mountain_village', dialog: { greet: 'Арчи из горной деревушки.', default: 'Горы хранят древние тайны.' }, quests: [] },
  'mountain_village_secretary': { id: 'mountain_village_secretary', name: 'Секретарь Лидера', sprite: '📋', location: 'mountain_village', dialog: { greet: 'Стадион в горах открыт.', default: 'Лидер ждёт смелых.' }, quests: [] },

  'wj_route3_kristi': { id: 'wj_route3_kristi', name: 'Жуколов Кристи', sprite: '🐛', location: 'wj_route_3', dialog: { greet: 'Жуколов Кристи.', default: 'Свадебный переполох? Я помогу!' }, quests: [{ id: 'wj_wedding', type: 'collect_items', targetItem: 'plantSample', targetQty: 3, desc: 'Принесите 3 образца растений для свадебного букета', rewardMoney: 500, rewardItem: 'lumBerry', rewardQty: 2, prereqQuest: null }] },

  'cross_alfred': { id: 'cross_alfred', name: 'Альфред', sprite: '💌', location: 'lavender_town', dialog: { greet: 'Альфред.', default: 'Любовь не знает границ.' }, quests: [{ id: 'k_lovers', type: 'explore', targetItem: null, targetQty: 2, desc: 'Посетите 2 города чтобы передать письмо', rewardMoney: 600, rewardItem: 'lumBerry', rewardQty: 2, prereqQuest: null }] },
  'cross_clown_freddy': { id: 'cross_clown_freddy', name: 'Клоун Фредди', sprite: '🤡', location: 'celadon_city', dialog: { greet: 'Цирк уехал, а клоуны остались!', default: 'Грустить нельзя!' }, quests: [{ id: 'cross_clown', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 города в поисках цирка', rewardMoney: 600, rewardItem: 'candy', rewardQty: 3, prereqQuest: null }] },
  'cross_lenart': { id: 'cross_lenart', name: 'Человек в тёмной накидке', sprite: '🥷', location: 'empty_city', dialog: { greet: 'Залечь на дно — мой план.', default: 'Не привлекайте внимания.' }, quests: [{ id: 'cross_hide', type: 'defeat_x', targetItem: null, targetQty: 3, desc: 'Победите 3 преследователей', rewardMoney: 700, rewardItem: 'fullRestore', rewardQty: 2, prereqQuest: null }] },
  'cross_dr_fins': { id: 'cross_dr_fins', name: 'Доктор Финс', sprite: '🧬', location: 'goldenrod_institute', dialog: { greet: 'Доктор Финс.', default: 'Генетика изменит мир покемонов.' }, quests: [{ id: 'cross_selection', type: 'catch_x', targetItem: null, targetQty: 4, desc: 'Поймайте 4 покемонов для исследований', rewardMoney: 1000, rewardItem: 'tm', rewardQty: 1, prereqQuest: null }] },
  'cross_journalist_erika': { id: 'cross_journalist_erika', name: 'Журналист Эрика', sprite: '🎤', location: 'new_district', dialog: { greet: 'Журналист Эрика.', default: 'Правда должна быть раскрыта.' }, quests: [{ id: 'cross_selection2', type: 'collect_items', targetItem: 'plantSample', targetQty: 3, desc: 'Принесите 3 образца для расследования', rewardMoney: 700, rewardItem: 'superPotion', rewardQty: 3, prereqQuest: 'cross_selection' }] },
  'cross_trainer_tanni': { id: 'cross_trainer_tanni', name: 'Тренер Танни', sprite: '🏃', location: 'route_19', dialog: { greet: 'Тренер Танни.', default: 'Я видел странные вещи на метеостанции.' }, quests: [{ id: 'k_meteo2', type: 'collect_items', targetItem: 'magnemiteNut', targetQty: 3, desc: 'Принесите 3 магнитные гайки для ремонта метеостанции', rewardMoney: 600, rewardItem: 'superPotion', rewardQty: 2, prereqQuest: null }] },
  'cross_pirate_captain': { id: 'cross_pirate_captain', name: 'Капитан пиратов', sprite: '🏴‍☠️', location: 'il_de_far', dialog: { greet: 'Свистать всех наверх!', default: 'Море зовёт!' }, quests: [{ id: 'sa_pirate_quest', type: 'explore', targetItem: null, targetQty: 3, desc: 'Посетите 3 острова Архипелага', rewardMoney: 800, rewardItem: 'waterStone', rewardQty: 1, prereqQuest: null }] },
  'cross_boy_fishing': { id: 'cross_boy_fishing', name: 'Мальчик с удочкой', sprite: '🎣', location: 'rocky_beach_sa', dialog: { greet: 'Рыбачу на пляже!', default: 'Клюёт! Ой, сорвалось...' }, quests: [{ id: 'sa_fishing', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Поймайте 3 водных покемонов', rewardMoney: 700, rewardItem: 'waterStone', rewardQty: 1, prereqQuest: null }] },
  'cross_guide_sweets': { id: 'cross_guide_sweets', name: 'Провожатый', sprite: '🍬', location: 'confectionery', dialog: { greet: 'Провожатый в Сладкое царство.', default: 'Кондитерская — самое вкусное место!' }, quests: [{ id: 'k_sweets', type: 'collect_items', targetItem: 'plantSample', targetQty: 5, desc: 'Соберите 5 образцов растений для кондитерской', rewardMoney: 500, rewardItem: 'candy', rewardQty: 5, prereqQuest: null }] },
  'cross_trainer_derti': { id: 'cross_trainer_derti', name: 'Тренер Дёрти', sprite: '🥊', location: 'route_11', dialog: { greet: 'Тренер Дёрти.', default: 'Готов к сражению?' }, quests: [] },
  'cross_trainer_nambi': { id: 'cross_trainer_nambi', name: 'Тренер Намби', sprite: '🥊', location: 'route_8', dialog: { greet: 'Тренер Намби.', default: 'Битва — моя стихия.' }, quests: [] },
  'cross_trainer_vetti': { id: 'cross_trainer_vetti', name: 'Тренер Ветти', sprite: '🥊', location: 'route_12', dialog: { greet: 'Тренер Ветти.', default: 'Сразись со мной!' }, quests: [] },
  'cross_elite_trainer': { id: 'cross_elite_trainer', name: 'Элитный тренер', sprite: '⭐', location: 'indigo_plateau', dialog: { greet: 'Элитный тренер.', default: 'Хочешь стать таким же? Тренируйся!' }, quests: [] },
  'cross_experienced_trainer': { id: 'cross_experienced_trainer', name: 'Опытный тренер', sprite: '🔰', location: 'victory_road', dialog: { greet: 'Опытный тренер.', default: 'Каждая битва делает сильнее.' }, quests: [] },
  'cross_director_station': { id: 'cross_director_station', name: 'Директор станции', sprite: '⚡', location: 'power_plant', dialog: { greet: 'Директор электростанции.', default: 'Энергия для всего Канто!' }, quests: [{ id: 'k_power', type: 'defeat_x', targetItem: null, targetQty: 4, desc: 'Победите 4 покемонов на электростанции', rewardMoney: 800, rewardItem: 'thunderStone', rewardQty: 1, prereqQuest: null }] },
  'kanto_route18_tracy': { id: 'kanto_route18_tracy', name: 'Трейси', sprite: '📷', location: 'route_18', dialog: { greet: 'Трейси, фотограф.', default: 'Никак не поймаю удачный кадр!' }, quests: [{ id: 'k_photo', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймайте 2 покемонов для фотосессии', rewardMoney: 400, rewardItem: 'greatBall', rewardQty: 3, prereqQuest: null }] },
  'summer_trainer_steve': { id: 'summer_trainer_steve', name: 'Тренер Стив', sprite: '🏄', location: 'azure_shoreline', dialog: { greet: 'Я Тренер Стив.', default: 'Расскажу интересные факты о побережье.' }, quests: [] },
  'summer_collector': { id: 'summer_collector', name: 'Коллекционер', sprite: '🎩', location: 'summer_fountain', dialog: { greet: 'Я известный коллекционер со всего региона! Моя коллекция уникальных предметов и редких покемонов ждет пополнения.', default: 'У вас есть что-то интересное для моей коллекции?', quest_offer: 'Для пополнения коллекции нужен {target} {item}.', quest_complete: 'Великолепное пополнение! Вот ваша награда.', quest_incomplete: 'Моя коллекция еще не полна...' }, quests: [{ id: 'sum_collect_1', type: 'collect_items', targetItem: 'rockSample', targetQty: 3, desc: 'Принесите 3 редких образца породы для коллекции', rewardMoney: 2000, rewardItem: 'dawnStone', rewardQty: 1, prereqQuest: 'sum_onyx' }, { id: 'sum_collect_2', type: 'catch_x', targetItem: null, targetQty: 2, desc: 'Поймайте 2 редких покемонов для коллекции', rewardMoney: 3000, rewardItem: 'shinyStone', rewardQty: 1, prereqQuest: 'sum_collect_1' }] },
  'summer_nursery_worker': { id: 'summer_nursery_worker', name: 'Работник питомника', sprite: '🥚', location: 'summer_nursery', dialog: { greet: 'Добро пожаловать в Питомник Западного Джото! Здесь вы можете получить случайных покемонов для тренировки.', default: 'Питомник всегда открыт для тренеров. Новые покемоны появляются регулярно.', quest_offer: 'Выберите набор покемонов для тренировки!', quest_complete: 'Отличная работа с питомцами! Держите награду.', quest_incomplete: 'Покемоны еще растут. Приходите позже.' }, quests: [{ id: 'sum_nursery_1', type: 'catch_x', targetItem: null, targetQty: 3, desc: 'Вырастите 3 покемонов из питомника (поймайте 3 разных вида)', rewardMoney: 1500, rewardItem: 'masterBall', rewardQty: 3, prereqQuest: null }] },
  'ostaron_mayor': { id: 'ostaron_mayor', name: 'Мэр Остарона', sprite: '🏛️', location: 'ostaron_cityhall', dialog: { greet: 'Я мэр Остарона! Наш великий город нуждается в вашей помощи в войне с Сайрефом.', default: 'Вы уже выбрали сторону? Остарон ждет вашей поддержки.', quest_offer: 'Для победы над Сайрефом нужен {target} {item}.', quest_complete: 'Остарон благодарит вас! Победа будет за нами!', quest_incomplete: 'Битва еще не выиграна...' }, quests: [{ id: 'ost_mayor_war', type: 'explore', targetItem: null, targetQty: 5, desc: 'Посетите 5 локаций Остарона для укрепления позиций', rewardMoney: 5000, rewardItem: 'duskStone', rewardQty: 1, prereqQuest: 'k_verm_1' }] },
  'melen_albert_quest': { id: 'melen_albert_quest', name: 'Альберт', sprite: '🕵️', location: 'melen_albert_house', dialog: { greet: 'Я Альберт. Моя племянница пропала! Банда захватила город... Нужно действовать за пределами закона.', default: 'Банда всё ещё там. Нужно больше подготовки.', quest_offer: 'Для спасения племянницы нужен {target} {item}.', quest_complete: 'Племянница спасена! Вы настоящий герой!', quest_incomplete: 'Племянница всё ещё в плену...' }, quests: [{ id: 'mel_albert_1', type: 'defeat_x', targetItem: null, targetQty: 5, desc: 'Победите 5 членов банды в Мелене', rewardMoney: 2000, rewardItem: 'fullRestore', rewardQty: 3, prereqQuest: 'sum_pantir_story' }, { id: 'mel_albert_2', type: 'collect_items', targetItem: 'crystalShard', targetQty: 3, desc: 'Принесите 3 осколка для взлома убежища банды', rewardMoney: 3000, rewardItem: 'waterStone', rewardQty: 2, prereqQuest: 'mel_albert_1' }] },
  'estaire_officer_jes_quest': { id: 'estaire_officer_jes_quest', name: 'Офицер Джес (расследование)', sprite: '👮‍♀️', location: 'estaire_city', dialog: { greet: 'Офицер Джес. Команда R похитила Батискафиш! Нужно расследование. У вас ранг выше 650?', default: 'Расследование продолжается. Команда R где-то рядом.', quest_offer: 'Для расследования нужен {target} {item}.', quest_complete: 'Дело раскрыто! Батискафиш в безопасности.', quest_incomplete: 'Расследование не закончено...' }, quests: [{ id: 'est_bati_1', type: 'explore', targetItem: null, targetQty: 4, desc: 'Посетите 4 локации для расследования похищения', rewardMoney: 3000, rewardItem: 'masterBall', rewardQty: 1, prereqQuest: null }] },

};

// Centralized inventory
let inventory = {};
let itemHistory = [];

function logItemHistory(itemId, qty, source) {
  itemHistory.push({
    itemId, qty, source,
    timestamp: Date.now(),
    trainerId: getTrainerId()
  });
  if (itemHistory.length > 500) itemHistory = itemHistory.slice(-500);
}

function initInventory() {
  // Give infinite (9999) of every item for beta testing
  ITEMS.forEach(item => {
    inventory[item.id] = 9999;
    logItemHistory(item.id, 9999, 'init');
  });
}

// ═══════════════════════════════════════════
// 🛠 АДМИН-КОНСОЛЬ (вызывай в F12 → Console)
// ═══════════════════════════════════════════
window.help = function() {
  console.log(`
🛠 Админ-команды (вводи в консоли):
──────────────────────────────────────────
💰 money(N)         — Добавить N кредитов
🎒 items()          — Все предметы x999
🎒 items10()        — Все предметы x10
🏅 allBadges()      — Все 8 значков Канто
🏥 heal()           — Вылечить всю команду
⭐ maxIV()          — Макс IV (31) всей команде
📈 lvlup(N)         — +N уровней команде
🦄 legendary()      — Добавить легендарного покемона
🦄 mew()            — Добавить Мью
🗺️  goto(locId)      — Телепорт в локацию
📋 cmds()           — Показать это меню
──────────────────────────────────────────
  `);
};
window.cmds = window.help;

window.money = function(n = 100000) { money += n; updateMoneyDisplay(); autoSave(); console.log('+¥' + n); };
window.items = function() { ITEMS.forEach(i => { inventory[i.id] = 999; }); updateInventoryDisplay(); autoSave(); console.log('Все предметы x999'); };
window.items10 = function() { ITEMS.forEach(i => { inventory[i.id] = 10; }); updateInventoryDisplay(); autoSave(); console.log('Все предметы x10'); };
window.allBadges = function() {
  badges = ['Boulder Badge','Cascade Badge','Thunder Badge','Rainbow Badge','Marsh Badge','Soul Badge','Volcano Badge','Earth Badge'];
  updateBadgeDisplay(); autoSave(); console.log('8 значков получено!');
};
window.heal = function() {
  myTeam.forEach(m => { m.currentHp = m.maxHp; m.status = null; m.sleepTurns = 0;
    if (m.movesPP) m.movesPP.forEach(pp => { if (pp) pp.current = pp.max; });
  });
  updatePlayerHpUI(); autoSave(); console.log('Команда вылечена');
};
window.maxIV = function() {
  myTeam.forEach(m => { m.ivs = { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 }; });
  autoSave(); console.log('IV 31 всей команде');
};
window.lvlup = function(n = 10) {
  myTeam.forEach(m => { for(let i=0;i<n;i++) { m.baseLevel++; m.maxHp = calculateStat(m,'hp',false); m.currentHp = m.maxHp; } });
  refreshProfileUI(); renderTeamGrid(); autoSave(); console.log('+' + n + ' уровней команде');
};
window.legendary = async function() {
  const leg = ['mewtwo','mew','lugia','ho-oh','celebi','rayquaza','groudon','kyogre','dialga','palkia','giratina','arceus','zekrom','reshiram','xerneas','yveltal','solgaleo','lunala','marshadow','zeraora'];
  const pick = leg[Math.floor(Math.random()*leg.length)];
  await giveStarterMon(pick);
  renderTeamGrid(); autoSave(); console.log('Легендарный ' + pick + ' добавлен!');
};
window.mew = async function() { await giveStarterMon('mew'); renderTeamGrid(); autoSave(); console.log('Мью добавлен!'); };
window.goto = function(locId) {
  if (!REGIONS[currentRegion]?.locations[locId] && !Object.values(REGIONS).some(r => r.locations[locId])) {
    console.log('Локация не найдена. Примеры: pallet_town, viridian_city, goldenrod, indigo_plateau');
    return;
  }
  currentLocationId = locId;
  for (const [reg, data] of Object.entries(REGIONS)) {
    if (data.locations[locId]) { currentRegion = reg; break; }
  }
  renderLocation(locId); autoSave(); console.log('Телепорт: ' + locId);
};

// Авто-список ID локаций
window.locations = function() {
  const all = [];
  for (const [reg, data] of Object.entries(REGIONS)) {
    for (const [id, loc] of Object.entries(data.locations)) {
      all.push({ id, name: loc.name, region: reg, hasHeal: loc.hasHeal, hasWater: loc.hasWater });
    }
  }
  console.table(all);
  return all;
};

window.myId = function() { console.log('Твой Telegram ID:', tgUser?.id || 'не авторизован'); console.log('Твой username:', tgUser?.username || 'нет'); return tgUser?.id; };
window.adminAdd = function(id) { if(!id) { console.log('Используй: adminAdd(ТВОЙ_ID_ИЗ_myId())'); return; } ADMIN_IDS.add(id); console.log('Админ добавлен:', id); };
window.adminList = function() { console.log('Админы:', Array.from(ADMIN_IDS)); return Array.from(ADMIN_IDS); };

console.log('🛠 PokeMatrix Admin готов. Введи help() для списка команд.');
console.log('📱 Твой Telegram ID: введи myId()');

// 📱 Админ-панель для телефона (кнопка в интерфейсе)
function initAdminPanel() {
  // Floating admin button
  const fab = document.createElement('button');
  fab.id = 'admin-fab';
  fab.innerHTML = '🛠';
  fab.title = 'Админ-панель';
  fab.style.cssText = 'position:fixed;bottom:120px;right:16px;width:48px;height:48px;border-radius:50%;background:#af52de;color:#fff;border:none;font-size:1.4rem;z-index:250;box-shadow:0 4px 12px rgba(0,0,0,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;';
  document.body.appendChild(fab);

  // Admin modal
  const modal = document.createElement('div');
  modal.id = 'admin-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="selection-modal-card" style="max-width:380px;width:95%;max-height:85vh;overflow-y:auto;">
      <h3>🛠 Админ-панель</h3>
      <p style="font-size:0.75rem;color:var(--tma-text-muted);margin:0 0 8px;">Мой ID: ${tgUser?.id || '?'} | ${tgUser?.username || ''}</p>
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <select id="admin-user-select" style="flex:1;padding:6px;font-size:0.78rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);max-width:60%;">
          <option value="">— Выбрать —</option>
        </select>
        <input id="admin-target-id" type="text" placeholder="или ID" style="flex:1;padding:6px 8px;font-size:0.78rem;border:1px solid var(--tma-border);border-radius:6px;background:var(--tma-bg);color:var(--tma-text);">
        <button class="tma-btn" id="admin-lookup" style="padding:6px 10px;font-size:0.8rem;background:#007aff;">🔍</button>
      </div>
      <div id="admin-target-info" style="font-size:0.72rem;color:var(--tma-text-muted);margin-bottom:8px;"></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
        <button class="tma-btn admin-id-act" data-act="items" style="flex:1;font-size:0.7rem;padding:6px 4px;background:#34c759;">🎒</button>
        <button class="tma-btn admin-id-act" data-act="money" style="flex:1;font-size:0.7rem;padding:6px 4px;background:#ff9500;">💰</button>
        <button class="tma-btn admin-id-act" data-act="badges" style="flex:1;font-size:0.7rem;padding:6px 4px;background:#ff3b30;">🏅</button>
        <button class="tma-btn admin-id-act" data-act="heal" style="flex:1;font-size:0.7rem;padding:6px 4px;background:#007aff;">🏥</button>
        <button class="tma-btn admin-id-act" data-act="iv" style="flex:1;font-size:0.7rem;padding:6px 4px;background:#af52de;">⭐</button>
      </div>
      <div id="admin-buttons" style="display:flex;flex-direction:column;gap:4px;"></div>
      <button class="tma-btn" id="btn-admin-close" style="width:100%;margin-top:8px;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  const btns = [
    ['💰 +100 000 кредитов', () => { money += 100000; updateMoneyDisplay(); autoSave(); showToast('+100 000¥', false); }],
    ['🎒 Предметы x999', () => { ITEMS.forEach(i => { inventory[i.id] = 999; }); updateInventoryDisplay(); autoSave(); showToast('Предметы x999', false); }],
    ['🏅 Все 8 значков', () => { badges = ['Boulder Badge','Cascade Badge','Thunder Badge','Rainbow Badge','Marsh Badge','Soul Badge','Volcano Badge','Earth Badge']; updateBadgeDisplay(); autoSave(); showToast('8 значков!', false); }],
    ['🏥 Лечить команду', () => { myTeam.forEach(m => { m.currentHp = m.maxHp; m.status = null; m.sleepTurns = 0; if (m.movesPP) m.movesPP.forEach(pp => { if (pp) pp.current = pp.max; }); }); refreshProfileUI(); autoSave(); showToast('Вылечено!', false); }],
    ['⭐ Макс IV (31)', () => { myTeam.forEach(m => { m.ivs = { hp:31,atk:31,def:31,spa:31,spd:31,spe:31 }; }); refreshProfileUI(); autoSave(); showToast('IV 31!', false); }],
    ['📈 +10 уровней', () => { myTeam.forEach(m => { for(let i=0;i<10;i++) { m.baseLevel++; m.maxHp = calculateStat(m,'hp',false); m.currentHp = m.maxHp; } }); refreshProfileUI(); renderTeamGrid(); autoSave(); showToast('+10 lvl!', false); }],
    ['🦄 Случайный легендарный', async () => { const leg = ['mewtwo','mew','lugia','ho-oh','rayquaza','groudon','kyogre','dialga','palkia','giratina','zekrom','reshiram','xerneas','yveltal','solgaleo','lunala','zeraora']; const pick = leg[Math.floor(Math.random()*leg.length)]; await giveStarterMon(pick); renderTeamGrid(); autoSave(); showToast(pick + '!', false); }],
    ['🦄 Мью', async () => { await giveStarterMon('mew'); renderTeamGrid(); autoSave(); showToast('Мью!', false); }],
    ['🗺️ Алабастия', () => { currentLocationId = 'pallet_town'; currentRegion = 'kanto'; renderLocation('pallet_town'); autoSave(); showToast('Pallet Town', false); }],
    ['🗺️ Плато Индиго', () => { currentLocationId = 'indigo_plateau'; currentRegion = 'kanto'; renderLocation('indigo_plateau'); autoSave(); showToast('Indigo Plateau', false); }],
    ['🗺️ Голденрод', () => { currentLocationId = 'goldenrod'; currentRegion = 'east_johto'; renderLocation('goldenrod'); autoSave(); showToast('Goldenrod', false); }],
    ['💾 Форс-сейв', () => { saveGame(); cloudSave(); showToast('Сохранено!', false); }],
  ];

  const container = document.getElementById('admin-buttons');
  btns.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.className = 'tma-btn';
    b.textContent = label;
    b.style.cssText = 'width:100%;padding:10px;font-size:0.9rem;background:var(--tma-card-bg);color:var(--tma-text);border:1px solid var(--tma-border);';
    b.addEventListener('click', () => { fn(); });
    container.appendChild(b);
  });

  // Populate user dropdown when opening admin panel
  let adminSelectPopulated = false;
  fab.addEventListener('click', async () => {
    modal.style.display = 'flex';
    const select = document.getElementById('admin-user-select');
    if (!adminSelectPopulated) {
      adminSelectPopulated = true;
      try {
        const res = await fetch('/api/profile/trainers/all');
        const data = await res.json();
        if (data.users) {
          data.users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.first_name||u.username||'?'} (ID:${u.id})`;
            select.appendChild(opt);
          });
        }
      } catch(e) {}
      select.addEventListener('change', () => {
        if (select.value) {
          document.getElementById('admin-target-id').value = select.value;
          document.getElementById('admin-lookup').click();
        }
      });
    }
  });

  // ID-based admin actions
  const targetInfo = document.getElementById('admin-target-info');
  document.getElementById('admin-lookup').addEventListener('click', async () => {
    const tid = document.getElementById('admin-target-id').value.trim();
    if (!tid) { targetInfo.textContent = 'Введите ID'; return; }
    targetInfo.textContent = 'Поиск...';
    try {
      const res = await fetch(`/api/profile/${tid}`);
      const d = await res.json();
      if (d.profile) {
        const p = d.profile;
        targetInfo.innerHTML = `👤 ${p.first_name||p.username} | 🏅${p.badges} | 💰${p.money} | 🐾${p.team?.length||0}`;
        targetInfo.setAttribute('data-found', tid);
      } else { targetInfo.textContent = 'Не найден'; targetInfo.removeAttribute('data-found'); }
    } catch(e) { targetInfo.textContent = 'Ошибка'; }
  });

  document.querySelectorAll('.admin-id-act').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tid = targetInfo.getAttribute('data-found');
      if (!tid) { showToast('Сначала 🔍 найди тренера по ID', true); return; }
      const act = btn.getAttribute('data-act');
      try {
        const headers = tgToken ? { 'Authorization': `Bearer ${tgToken}` } : {};
        const res = await fetch(`/admin/jwt-api?cmd=give_${act}&user=${tid}`, { headers });
        const d = await res.json();
        showToast(d.status === 'ok' ? '✅ Готово' : '❌ ' + (d.error || 'ошибка'), d.status !== 'ok');
      } catch(e) { showToast('Ошибка API', true); }
    });
  });

  document.getElementById('btn-admin-close').addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
}

function getItemQty(itemId) {
  return inventory[itemId] ?? 0;
}

function hasItem(itemId) {
  return getItemQty(itemId) > 0;
}

function itemDef(itemId) {
  return ITEMS.find(i => i.id === itemId) || {};
}

function itemCategory(itemId) {
  return (ITEMS.find(i => i.id === itemId) || {}).category;
}

function addItem(itemId, qty = 1) {
  if (!(itemId in inventory)) {
    console.warn('Unknown item:', itemId);
    return false;
  }
  inventory[itemId] += qty;
  logItemHistory(itemId, qty, 'add');
  checkNPCQuestProgress(itemId, qty);
  checkQuestProgress('collect_items', qty, itemId);
  updateInventoryDisplay();
  autoSave();
  return true;
}

function removeItem(itemId, qty = 1) {
  if (!(itemId in inventory)) return false;
  if (inventory[itemId] < qty) return false;
  inventory[itemId] -= qty;
  updateInventoryDisplay();
  autoSave();
  return true;
}

// Old inventory variables — keep for backward compat during migration
let invPokeballs = 10;
let invGreatBall = 0;
let invUltraBall = 0;
let invPotion = 5;
let invCandy = 20;
let invVitamin = 20;
let invTrain = 50;
let invWeaken = 20;
let invSuperPotion = 0;
let invFullRestore = 0;
let invEvolutionStone = 0;
let invTM = 0;
let invSitrusBerry = 0;
let invOranBerry = 0;
let invLumBerry = 0;
let invChestoBerry = 0;
let invRawstBerry = 0;

// MONEY (NEW)
let money = 500;
let trainerNickname = '';
const LEGENDARY_SET = new Set([
  'articuno', 'zapdos', 'moltres', 'mewtwo', 'mew',
  'raikou', 'entei', 'suicune', 'lugia', 'ho-oh', 'celebi',
  'regirock', 'regice', 'registeel', 'latias', 'latios', 'kyogre', 'groudon', 'rayquaza', 'jirachi', 'deoxys',
  'uxie', 'mesprit', 'azelf', 'dialga', 'palkia', 'heatran', 'regigigas', 'giratina', 'cresselia', 'darkrai', 'shaymin', 'arceus',
  'victini', 'cobalion', 'terrakion', 'virizion', 'tornadus', 'thundurus', 'reshiram', 'zekrom', 'landorus', 'kyurem', 'keldeo', 'meloetta', 'genesect',
  'xerneas', 'yveltal', 'zygarde', 'diancie', 'hoopa', 'volcanion',
  'type-null', 'silvally', 'tapu-koko', 'tapu-lele', 'tapu-bulu', 'tapu-fini', 'cosmog', 'cosmoem', 'solgaleo', 'lunala', 'necrozma', 'magearna', 'marshadow', 'zeraora',
  'zacian', 'zamazenta', 'eternatus', 'kubfu', 'urshifu', 'regieleki', 'regidrago', 'glastrier', 'spectrier', 'calyrex',
  'koraidon', 'miraidon', 'ting-lu', 'chien-pao', 'wo-chien', 'chi-yu'
]);

// --- UID SYSTEM ---
let uidCounter = Date.now();
function generateUID() { return (++uidCounter).toString(36) + Math.random().toString(36).substr(2, 6); }
function getTrainerId() { return tgUser?.id || localStorage.getItem('league17_trainer_id') || '0'; }
function lsKey(name) { return `league17_${name}_${getTrainerId()}`; }

// BADGES (NEW)
let badges = [];

// GYM LEADERS DATA (NEW) — scaled for challenge
const gymLeaders = {
  pewter_stadium: {
    name: 'Брок', title: 'Лидер Зала Пьютера', type: 'rock',
    team: [
      { name: 'geodude', level: 18, move1: 'rock-throw', move2: 'defense-curl' },
      { name: 'onix', level: 22, move1: 'rock-throw', move2: 'screech' }
    ],
    badgeName: 'Boulder Badge', moneyReward: 2000
  },
  cerulean_stadium: {
    name: 'Мисти', title: 'Лидер Зала Церулина', type: 'water',
    team: [
      { name: 'staryu', level: 26, move1: 'water-gun', move2: 'harden' },
      { name: 'goldeen', level: 24, move1: 'water-gun', move2: 'horn-attack' },
      { name: 'starmie', level: 30, move1: 'water-gun', move2: 'swift' }
    ],
    badgeName: 'Cascade Badge', moneyReward: 3000
  },
  vermilion_stadium: {
    name: 'Лейтенант Сёрдж', title: 'Лидер Зала Вермилиона', type: 'electric',
    team: [
      { name: 'voltorb', level: 28, move1: 'thunder-shock', move2: 'sonic-boom' },
      { name: 'magnemite', level: 26, move1: 'thunder-shock', move2: 'supersonic' },
      { name: 'raichu', level: 32, move1: 'thunderbolt', move2: 'swift' }
    ],
    badgeName: 'Thunder Badge', moneyReward: 3500
  },
  celadon_stadium: {
    name: 'Эрика', title: 'Лидер Зала Селадона', type: 'grass',
    team: [
      { name: 'tangela', level: 34, move1: 'vine-whip', move2: 'bind' },
      { name: 'weepinbell', level: 35, move1: 'razor-leaf', move2: 'acid' },
      { name: 'vileplume', level: 38, move1: 'petal-dance', move2: 'sleep-powder' }
    ],
    badgeName: 'Rainbow Badge', moneyReward: 4000
  },
  saffron_psychic_stadium: {
    name: 'Сабрина', title: 'Лидер Зала Шаффрана', type: 'psychic',
    team: [
      { name: 'mr-mime', level: 42, move1: 'confusion', move2: 'barrier' },
      { name: 'kadabra', level: 45, move1: 'psychic', move2: 'recover' },
      { name: 'alakazam', level: 48, move1: 'psychic', move2: 'reflect' }
    ],
    badgeName: 'Marsh Badge', moneyReward: 4500
  },
  fuchsia_dragon_stadium: {
    name: 'Кога', title: 'Лидер Зала Фуксии', type: 'poison',
    team: [
      { name: 'koffing', level: 45, move1: 'sludge', move2: 'smokescreen' },
      { name: 'muk', level: 47, move1: 'sludge', move2: 'harden' },
      { name: 'weezing', level: 50, move1: 'sludge-bomb', move2: 'haze' }
    ],
    badgeName: 'Soul Badge', moneyReward: 5000
  },
  cinnabar_stadium: {
    name: 'Блейн', title: 'Лидер Зала Синнабара', type: 'fire',
    team: [
      { name: 'growlithe', level: 50, move1: 'flamethrower', move2: 'roar' },
      { name: 'magmar', level: 48, move1: 'fire-punch', move2: 'smokescreen' },
      { name: 'rapidash', level: 52, move1: 'fire-blast', move2: 'stomp' },
      { name: 'arcanine', level: 55, move1: 'flamethrower', move2: 'extreme-speed' }
    ],
    badgeName: 'Volcano Badge', moneyReward: 5500
  },
  viridian_stadium: {
    name: 'Джованни', title: 'Босс Команды R', type: 'ground',
    team: [
      { name: 'dugtrio', level: 52, move1: 'earthquake', move2: 'slash' },
      { name: 'nidoking', level: 54, move1: 'earth-power', move2: 'poison-jab' },
      { name: 'rhydon', level: 55, move1: 'stone-edge', move2: 'earthquake' },
      { name: 'mewtwo', level: 60, move1: 'psychic', move2: 'recover' }
    ],
    badgeName: 'Earth Badge', moneyReward: 6000
  },
  // --- Johto Gym Leaders ---
  flourence_stadium: {
    name: 'Фолкнер', title: 'Лидер Зала Флоренса', type: 'flying',
    team: [
      { name: 'hoothoot', level: 15, move1: 'gust', move2: 'hypnosis' },
      { name: 'pidgeotto', level: 18, move1: 'gust', move2: 'quick-attack' }
    ],
    badgeName: 'Zephyr Badge', moneyReward: 2500
  },
  alston_steel_stadium: {
    name: 'Багси', title: 'Лидер Зала Алстона', type: 'bug',
    team: [
      { name: 'butterfree', level: 20, move1: 'gust', move2: 'sleep-powder' },
      { name: 'beedrill', level: 20, move1: 'twineedle', move2: 'fury-attack' },
      { name: 'scyther', level: 24, move1: 'slash', move2: 'wing-attack' }
    ],
    badgeName: 'Hive Badge', moneyReward: 2800
  },
  goldenrod_stadium: {
    name: 'Уитни', title: 'Лидер Зала Голденрода', type: 'normal',
    team: [
      { name: 'clefairy', level: 24, move1: 'doubleslap', move2: 'sing' },
      { name: 'miltank', level: 28, move1: 'stomp', move2: 'milk-drink' }
    ],
    badgeName: 'Plain Badge', moneyReward: 3000
  },
  warhall_battle_stadium: {
    name: 'Морти', title: 'Лидер Зала Вархолла', type: 'ghost',
    team: [
      { name: 'gastly', level: 28, move1: 'night-shade', move2: 'hypnosis' },
      { name: 'haunter', level: 30, move1: 'shadow-ball', move2: 'lick' },
      { name: 'gengar', level: 34, move1: 'shadow-ball', move2: 'hypnosis' }
    ],
    badgeName: 'Fog Badge', moneyReward: 3500
  },
  ostaron_ice_stadium: {
    name: 'Чак', title: 'Лидер Зала Остарона', type: 'fighting',
    team: [
      { name: 'primeape', level: 34, move1: 'karate-chop', move2: 'low-kick' },
      { name: 'poliwrath', level: 38, move1: 'submission', move2: 'hypnosis' }
    ],
    badgeName: 'Storm Badge', moneyReward: 4000
  },
  olivine_water_stadium: {
    name: 'Жасмин', title: 'Лидер Зала Оливина', type: 'steel',
    team: [
      { name: 'magnemite', level: 36, move1: 'thunderbolt', move2: 'sonic-boom' },
      { name: 'skarmory', level: 38, move1: 'steel-wing', move2: 'agility' },
      { name: 'steelix', level: 42, move1: 'rock-throw', move2: 'iron-tail' }
    ],
    badgeName: 'Mineral Badge', moneyReward: 4500
  },
  sayref_air_stadium: {
    name: 'Прайс', title: 'Лидер Зала Сайрефа', type: 'ice',
    team: [
      { name: 'seel', level: 38, move1: 'aurora-beam', move2: 'headbutt' },
      { name: 'dewgong', level: 40, move1: 'ice-beam', move2: 'headbutt' },
      { name: 'piloswine', level: 44, move1: 'ice-beam', move2: 'take-down' }
    ],
    badgeName: 'Glacier Badge', moneyReward: 5000
  },
  ilde_stadium: {
    name: 'Клер', title: 'Лидер Зала Иль де Фар', type: 'dragon',
    team: [
      { name: 'dragonair', level: 44, move1: 'dragon-rage', move2: 'thunderbolt' },
      { name: 'dragonair_2', level: 44, move1: 'dragon-rage', move2: 'surf' },
      { name: 'gyarados', level: 46, move1: 'hydro-pump', move2: 'dragon-rage' },
      { name: 'kingdra', level: 50, move1: 'hydro-pump', move2: 'hyper-beam' }
    ],
    badgeName: 'Rising Badge', moneyReward: 6000
  }
};

// ELITE FOUR DATA (NEW) — scaled up
const eliteFour = [
  {
    name: 'Лорели', title: 'Элитная Четверка — Лед', type: 'ice',
    team: [
      { name: 'dewgong', level: 58, move1: 'aurora-beam', move2: 'rest' },
      { name: 'cloyster', level: 57, move1: 'ice-beam', move2: 'supersonic' },
      { name: 'slowbro', level: 58, move1: 'surf', move2: 'psychic' },
      { name: 'jynx', level: 60, move1: 'blizzard', move2: 'psychic' },
      { name: 'lapras', level: 62, move1: 'ice-beam', move2: 'hydro-pump' }
    ],
    moneyReward: 8000
  },
  {
    name: 'Бруно', title: 'Элитная Четверка — Бой', type: 'fighting',
    team: [
      { name: 'hitmonlee', level: 60, move1: 'jump-kick', move2: 'rolling-kick' },
      { name: 'hitmonchan', level: 60, move1: 'ice-punch', move2: 'fire-punch' },
      { name: 'onix', level: 61, move1: 'rock-slide', move2: 'earthquake' },
      { name: 'machamp', level: 63, move1: 'submission', move2: 'cross-chop' },
      { name: 'machamp', level: 65, move1: 'dynamic-punch', move2: 'earthquake' }
    ],
    moneyReward: 9000
  },
  {
    name: 'Агата', title: 'Элитная Четверка — Призрак', type: 'ghost',
    team: [
      { name: 'gengar', level: 63, move1: 'shadow-ball', move2: 'hypnosis' },
      { name: 'crobat', level: 62, move1: 'wing-attack', move2: 'confuse-ray' },
      { name: 'gengar', level: 64, move1: 'shadow-ball', move2: 'night-shade' },
      { name: 'arbok', level: 63, move1: 'sludge-bomb', move2: 'glare' },
      { name: 'gengar', level: 66, move1: 'shadow-ball', move2: 'dream-eater' }
    ],
    moneyReward: 10000
  },
  {
    name: 'Лэнс', title: 'Элитная Четверка — Дракон', type: 'dragon',
    team: [
      { name: 'gyarados', level: 65, move1: 'hydro-pump', move2: 'hyper-beam' },
      { name: 'dragonair', level: 64, move1: 'dragon-rage', move2: 'thunderbolt' },
      { name: 'dragonair', level: 64, move1: 'dragon-rage', move2: 'ice-beam' },
      { name: 'aerodactyl', level: 66, move1: 'hyper-beam', move2: 'ancient-power' },
      { name: 'dragonite', level: 70, move1: 'hyper-beam', move2: 'dragon-rage' }
    ],
    moneyReward: 12000
  }
];

const champion = {
  name: 'Голд (Чемпион)', title: 'Чемпион Лиги', type: 'water',
  team: [
    { name: 'pidgeot', level: 68, move1: 'fly', move2: 'sky-attack' },
    { name: 'alakazam', level: 70, move1: 'psychic', move2: 'recover' },
    { name: 'rhydon', level: 70, move1: 'earthquake', move2: 'stone-edge' },
    { name: 'exeggutor', level: 68, move1: 'psychic', move2: 'solar-beam' },
    { name: 'gyarados', level: 72, move1: 'hydro-pump', move2: 'hyper-beam' },
    { name: 'blastoise', level: 74, move1: 'hydro-pump', move2: 'ice-beam' }
  ],
  moneyReward: 15000
};

// JOHTO ELITE FOUR — scaled up
const johtoEliteFour = [
  {
    name: 'Уилл', title: 'Элитная Четверка Джото — Экстрасенс', type: 'psychic',
    team: [
      { name: 'xatu', level: 50, move1: 'psychic', move2: 'confuse-ray' },
      { name: 'exeggutor', level: 52, move1: 'psychic', move2: 'solar-beam' },
      { name: 'slowbro', level: 52, move1: 'surf', move2: 'psychic' },
      { name: 'jynx', level: 53, move1: 'ice-punch', move2: 'psychic' },
      { name: 'espeon', level: 55, move1: 'psychic', move2: 'morning-sun' }
    ],
    moneyReward: 7000
  },
  {
    name: 'Кога', title: 'Элитная Четверка Джото — Яд', type: 'poison',
    team: [
      { name: 'ariados', level: 51, move1: 'sludge-bomb', move2: 'spider-web' },
      { name: 'venomoth', level: 52, move1: 'psychic', move2: 'sludge-bomb' },
      { name: 'muk', level: 54, move1: 'sludge', move2: 'minimize' },
      { name: 'weezing', level: 55, move1: 'sludge-bomb', move2: 'explosion' },
      { name: 'crobat', level: 56, move1: 'wing-attack', move2: 'poison-fang' }
    ],
    moneyReward: 8000
  },
  {
    name: 'Бруно', title: 'Элитная Четверка Джото — Бой', type: 'fighting',
    team: [
      { name: 'hitmontop', level: 54, move1: 'rolling-kick', move2: 'quick-attack' },
      { name: 'hitmonlee', level: 55, move1: 'jump-kick', move2: 'rolling-kick' },
      { name: 'hitmonchan', level: 55, move1: 'ice-punch', move2: 'fire-punch' },
      { name: 'machamp', level: 57, move1: 'cross-chop', move2: 'rock-slide' },
      { name: 'machamp', level: 59, move1: 'dynamic-punch', move2: 'strength' }
    ],
    moneyReward: 9000
  },
  {
    name: 'Карен', title: 'Элитная Четверка Джото — Тьма', type: 'dark',
    team: [
      { name: 'umbreon', level: 56, move1: 'faint-attack', move2: 'confuse-ray' },
      { name: 'vileplume', level: 55, move1: 'petal-dance', move2: 'sludge-bomb' },
      { name: 'murkrow', level: 57, move1: 'shadow-ball', move2: 'drill-peck' },
      { name: 'gengar', level: 58, move1: 'shadow-ball', move2: 'destiny-bond' },
      { name: 'houndoom', level: 60, move1: 'crunch', move2: 'flamethrower' }
    ],
    moneyReward: 10000
  }
];

const johtoChampion = {
  name: 'Лэнс (Чемпион Джото)', title: 'Чемпион Лиги Джото', type: 'dragon',
  team: [
    { name: 'gyarados', level: 58, move1: 'hydro-pump', move2: 'dragon-rage' },
    { name: 'dragonite', level: 60, move1: 'hyper-beam', move2: 'dragon-rage' },
    { name: 'charizard', level: 59, move1: 'flamethrower', move2: 'fly' },
    { name: 'aerodactyl', level: 60, move1: 'hyper-beam', move2: 'ancient-power' },
    { name: 'dragonite', level: 62, move1: 'hyper-beam', move2: 'outrage' },
    { name: 'dragonite', level: 64, move1: 'hyper-beam', move2: 'thunder' }
  ],
  moneyReward: 15000
};

// TEAM ROSTER (Max 6)
let myTeam = [];
// PC STORAGE (boxes of 30)
let pcBoxes = [[]];

// NOTIFICATION SYSTEM
let notifications = []; // [{ id, title, text, time, read }]

function addNotification(title, text) {
  notifications.unshift({ id: Date.now(), title, text, time: new Date().toISOString(), read: false });
  if (notifications.length > 50) notifications.length = 50;
  updateNotifBadge();
  saveGame();
}

function updateNotifBadge() {
  const unread = notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = unread || '';
    badge.style.display = unread > 0 ? '' : 'none';
  }
}

function openNotifications() {
  const modal = document.getElementById('notif-modal');
  if (!modal) return;
  const list = document.getElementById('notif-list');
  list.innerHTML = notifications.length === 0
    ? '<div style="text-align:center;padding:20px;color:var(--tma-text-muted);">Нет уведомлений</div>'
    : notifications.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <b>${n.title}</b>
        <p>${n.text}</p>
        <small>${new Date(n.time).toLocaleString('ru')}</small>
      </div>
    `).join('');
  notifications.forEach(n => n.read = true);
  updateNotifBadge();
  modal.style.display = 'flex';
}

// BREEDING SYSTEM
let breedingPairs = []; // [{ boxIdx, mon1Uid, mon2Uid, startTime, readyTime }]
let eggs = [];          // [{ uid, species, apiData, readyTime, boxIdx, parent1Uid, parent2Uid }]
const EGG_TIME = 10 * 60 * 1000;      // 10 min to produce egg
const EGG_BONUS_TIME = 5 * 60 * 1000;  // 5 min with matching nature
// Random hatch time between 3-8 days
function randomHatchTime() { return (3 + Math.floor(Math.random() * 6)) * 24 * 60 * 60 * 1000; }
const BREEDING_CHECK_INTERVAL = 60 * 1000; // check every minute

// --- STAR RATINGS ---
const LEGENDARY_NAMES = new Set([
  'articuno','zapdos','moltres','mewtwo','mew','raikou','entei','suicune','lugia','ho-oh','celebi',
  'regirock','regice','registeel','latias','latios','kyogre','groudon','rayquaza','jirachi','deoxys',
  'uxie','mesprit','azelf','dialga','palkia','heatran','regigigas','giratina','cresselia','phione','manaphy','darkrai','shaymin','arceus',
  'victini','reshiram','zekrom','kyurem','keldeo','meloetta','genesect',
  'xerneas','yveltal','zygarde','diancie','hoopa','volcanion',
  'tapu-koko','tapu-lele','tapu-bulu','tapu-fini','cosmog','cosmoem','solgaleo','lunala','necrozma','magearna','marshadow','zeraora',
  'zacian','zamazenta','eternatus','kubfu','urshifu','regieleki','regidrago','glastrier','spectrier','calyrex',
  'koraidon','miraidon'
]);

function getPowerStars(mon) {
  if (!mon.apiData?.stats) return 1;
  const bst = mon.apiData.stats.reduce((sum, s) => sum + s.base_stat, 0);
  if (bst >= 650) return 10;
  if (bst >= 600) return 9;
  if (bst >= 550) return 8;
  if (bst >= 500) return 7;
  if (bst >= 450) return 6;
  if (bst >= 400) return 5;
  if (bst >= 350) return 4;
  if (bst >= 300) return 3;
  if (bst >= 250) return 2;
  return 1;
}

function getRarityStars(mon) {
  const name = mon.apiData?.species?.name || mon.apiData?.name;
  if (name && LEGENDARY_NAMES.has(name)) return 5;
  const cr = mon.apiData?.captureRate || mon.apiData?.speciesData?.capture_rate || 255;
  if (cr < 30) return 4;
  if (cr < 80) return 3;
  if (cr < 150) return 2;
  return 1;
}

function renderStars(powerStars, rarityStars) {
  const gold = '★'.repeat(powerStars) + '☆'.repeat(10 - powerStars);
  const black = '✦'.repeat(rarityStars) + '✧'.repeat(5 - rarityStars);
  return `<span style="color:#ff9500;font-size:0.55rem;" title="Мощь: ${powerStars}/10">${gold}</span> <span style="color:#333;font-size:0.55rem;" title="Редкость: ${rarityStars}/5">${black}</span>`;
}

// ACTIVE POKEMON STATE
let currentPokemonIndex = null;

// BATTLE STATE
let activeWild = null;
let wildLvl = 5;
let wildMaxHP = 0;
let wildCurHP = 0;
let wildStatus = null;
let wildSleepTurns = 0;
let escapeAttempts = 0;
let wildMovesDetailed = [];
let wildMovesPP = null;
let battleRound = 0;
let activePlayerMon = null; // Reference to myTeam[0] during battle
let playerMovesDetailed = []; // Full API data for player's 4 moves

// GYM/ELITE BATTLE STATE (NEW)
let battleType = 'wild'; // 'wild' | 'gym' | 'elite' | 'champion'
let gymLeaderKey = null;
let gymTeamIndex = 0;
let gymTeamData = null;

// --- BATTLE STATE PERSISTENCE (survives page refresh) ---
function saveBattleState() {
  if (!battleType || battleType === 'none') return;
  const state = {
    battleType,
    locationId: currentLocationId,
    activeMonIndex: myTeam.indexOf(activePlayerMon),
    activeMonCurHP: activePlayerMon?.currentHp,
    activeMonMovesPP: activePlayerMon?.movesPP,
    activeMonStatStages: activePlayerMon?.statStages,
    activeMonChoiceLocked: activePlayerMon?.choiceLockedMove,
    currentWeather,
    escapeAttempts,
    battleRound,
    itemsUsedInBattle
  };
  if (battleType === 'wild' && activeWild) {
    state.wildPkmName = activeWild.name;
    state.wildCurHP = wildCurHP;
    state.wildMaxHP = wildMaxHP;
    state.wildLvl = wildLvl;
    state.wildStatus = wildStatus;
    state.wildSleepTurns = wildSleepTurns;
    state.wildMovesPP = wildMovesPP;
    state.wildIsShiny = activeWild.isShiny;
  }
  if ((battleType === 'gym' || battleType === 'elite' || battleType === 'champion') && gymTeamData) {
    state.gymLeaderKey = gymLeaderKey;
    state.gymTeamIndex = gymTeamIndex;
    state.gymTeamIndexInMember = gymTeamIndexInMember;
    state.gymTeamData = gymTeamData;
    if (activeWild) {
      state.wildCurHP = wildCurHP;
      state.wildMaxHP = wildMaxHP;
      state.wildStatus = wildStatus;
      state.wildSleepTurns = wildSleepTurns;
      state.wildMovesPP = wildMovesPP;
    }
  }
  try { localStorage.setItem(lsKey('battle_state'), JSON.stringify(state)); } catch(e) {}
}

function clearBattleState() {
  try { localStorage.removeItem(lsKey('battle_state')); } catch(e) {}
}

async function restoreBattleState() {
  let state;
  try {
    const raw = localStorage.getItem(lsKey('battle_state'));
    if (!raw) return false;
    state = JSON.parse(raw);
  } catch(e) { return false; }

  if (!state.battleType || !state.locationId || state.locationId !== currentLocationId) {
    clearBattleState();
    return false;
  }

  const activeIdx = state.activeMonIndex;
  if (activeIdx === undefined || activeIdx < 0 || activeIdx >= myTeam.length) return false;
  const mon = myTeam[activeIdx];
  if (!mon || mon.currentHp <= 0) return false;

  // Restore player mon state
  activePlayerMon = mon;
  mon.currentHp = state.activeMonCurHP;
  if (state.activeMonMovesPP) mon.movesPP = state.activeMonMovesPP;
  if (state.activeMonStatStages) mon.statStages = state.activeMonStatStages;
  if (state.activeMonChoiceLocked !== undefined) mon.choiceLockedMove = state.activeMonChoiceLocked;

  battleType = state.battleType;
  currentWeather = state.currentWeather || getDailyWeather(currentLocationId);
  escapeAttempts = state.escapeAttempts || 0;
  battleRound = state.battleRound || 0;
  itemsUsedInBattle = state.itemsUsedInBattle || 0;

  if (battleType === 'wild' && state.wildPkmName) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${state.wildPkmName.toLowerCase()}`);
      activeWild = await res.json();
      pokedexSeen.add(activeWild.name);
      activeWild.isShiny = state.wildIsShiny || false;

      // Fetch species for catch rate
      try {
        const speciesRes = await fetch(activeWild.species.url);
        const speciesData = await speciesRes.json();
        activeWild.captureRate = speciesData.capture_rate;
        activeWild.speciesData = speciesData;
      } catch(e) {}

      wildLvl = state.wildLvl;
      wildMaxHP = state.wildMaxHP;
      wildCurHP = state.wildCurHP;
      wildStatus = state.wildStatus;
      wildSleepTurns = state.wildSleepTurns || 0;
      wildMovesPP = state.wildMovesPP || [];
      activeWild.status = wildStatus;
      activeWild.heldItem = null; // Can't restore held item reliably
      activeWild.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };

      // Fetch wild moves
      wildMovesDetailed = [];
      const movePromises = [];
      for (let i = 0; i < activeWild.moves.length && i < 20; i++) {
        movePromises.push(
          fetch(activeWild.moves[i].move.url).then(r => r.json()).catch(() => null)
        );
      }
      const moveResults = await Promise.all(movePromises);
      wildMovesDetailed = moveResults.filter(m => m && m.power);

      if (!activeWild.wildIVs) {
        activeWild.wildIVs = {
          hp: Math.floor(Math.random() * 32), atk: Math.floor(Math.random() * 32),
          def: Math.floor(Math.random() * 32), spa: Math.floor(Math.random() * 32),
          spd: Math.floor(Math.random() * 32), spe: Math.floor(Math.random() * 32)
        };
      }

      renderBattleUI();
      loadMoveButtons(activePlayerMon, battleType === 'wild' ? useMove : useMoveGym);

      document.getElementById('encounter-modal').style.display = 'flex';
      document.getElementById('battle-main-menu').style.display = 'flex';
      document.getElementById('battle-end-menu').style.display = 'none';
      document.getElementById('battle-gym-info').style.display = 'none';

      appendToLog('⚡ Битва восстановлена!', true);
      appendToLog(`Дикий ${activeWild.name.toUpperCase()} всё ещё здесь!`, false, 'battle');

      return true;
    } catch(e) {
      console.error('Failed to restore wild battle:', e);
      clearBattleState();
      return false;
    }
  }

  return false;
}

function renderBattleUI() {
  document.getElementById('wild-name').innerText = activeWild.name;
  document.getElementById('wild-lvl').innerText = `Lv${wildLvl}`;
  const wildSpriteUrl = activeWild.sprites?.other?.['official-artwork']?.front_default || activeWild.sprites.front_default;
  document.getElementById('wild-sprite').src = wildSpriteUrl;
  document.getElementById('wild-status-icon').innerText = getStatusIcon(wildStatus);
  updateWildHpUI();

  document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
  document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
  const playerSpriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
  document.getElementById('player-sprite').src = playerSpriteUrl;
  document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);
  updateBattleSpriteBgs();
  updatePlayerHpUI();
}
const MAX_IV = 70;

// --- WEATHER ---
let currentWeather = 'clear';
const WEATHERS = ['clear', 'rain', 'sun', 'sandstorm', 'hail'];
const WEATHER_ICONS = { clear: '☀️', rain: '🌧️', sun: '☀️', sandstorm: '🌪️', hail: '❄️' };
const WEATHER_NAMES = { clear: 'Ясно', rain: 'Дождь', sun: 'Солнце', sandstorm: 'Песчаная буря', hail: 'Град' };

function getDailyWeather(locId) {
  const dateStr = new Date().toISOString().slice(0, 10);
  let hash = 0;
  const str = dateStr + locId;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = (Math.abs(hash || 0) || 0) % WEATHERS.length;
  return WEATHERS[idx];
}

function getWeatherMultiplier(moveType, weather) {
  if (weather === 'rain') {
    if (moveType === 'water') return 1.5;
    if (moveType === 'fire') return 0.5;
  }
  if (weather === 'sun') {
    if (moveType === 'fire') return 1.5;
    if (moveType === 'water') return 0.5;
  }
  if (weather === 'sandstorm') {
    if (moveType === 'rock') return 1.5;
  }
  if (weather === 'hail') {
    if (moveType === 'ice') return 1.5;
  }
  return 1.0;
}

// --- QUESTS (Feature 5) ---
const QUEST_TYPES = ['catch_x', 'defeat_x', 'earn_money', 'explore', 'use_item', 'collect_items'];
const QUEST_CONFIGS = [
  // Original 8
  { id: 'catch_5', type: 'catch_x', target: 5, desc: 'Поймайте 5 покемонов', rewardMoney: 500, rewardItem: 'pokeball', rewardQty: 3 },
  { id: 'defeat_10', type: 'defeat_x', target: 10, desc: 'Победите 10 диких покемонов', rewardMoney: 800, rewardItem: 'potion', rewardQty: 2 },
  { id: 'earn_1000', type: 'earn_money', target: 1000, desc: 'Заработайте $1000', rewardMoney: 300, rewardItem: 'candy', rewardQty: 2 },
  { id: 'explore_5', type: 'explore', target: 5, desc: 'Посетите 5 разных локаций', rewardMoney: 400, rewardItem: 'superPotion', rewardQty: 1 },
  { id: 'use_3', type: 'use_item', target: 3, desc: 'Используйте 3 предмета в бою', rewardMoney: 200, rewardItem: 'candy', rewardQty: 1 },
  { id: 'collect_hair', type: 'collect_items', targetItem: 'venonatHair', target: 3, desc: 'Соберите 3 Волоска Веноната', rewardMoney: 300, rewardItem: 'candy', rewardQty: 1 },
  { id: 'collect_bone', type: 'collect_items', targetItem: 'cuboneBone', target: 2, desc: 'Соберите 2 Кости Кьюбона', rewardMoney: 400, rewardItem: 'greatBall', rewardQty: 2 },
  { id: 'collect_coals', type: 'collect_items', targetItem: 'coals', target: 4, desc: 'Соберите 4 Уголька', rewardMoney: 350, rewardItem: 'potion', rewardQty: 3 },
  // New quests based on wiki references
  { id: 'catch_10', type: 'catch_x', target: 10, desc: 'Поймайте 10 покемонов', rewardMoney: 1200, rewardItem: 'greatBall', rewardQty: 5 },
  { id: 'catch_15', type: 'catch_x', target: 15, desc: 'Поймайте 15 покемонов', rewardMoney: 2000, rewardItem: 'ultraBall', rewardQty: 3 },
  { id: 'defeat_20', type: 'defeat_x', target: 20, desc: 'Победите 20 диких покемонов', rewardMoney: 1500, rewardItem: 'superPotion', rewardQty: 3 },
  { id: 'defeat_5', type: 'defeat_x', target: 5, desc: 'Победите 5 диких покемонов', rewardMoney: 400, rewardItem: 'pokeball', rewardQty: 3 },
  { id: 'earn_5000', type: 'earn_money', target: 5000, desc: 'Заработайте $5000', rewardMoney: 1000, rewardItem: 'vitamin', rewardQty: 2 },
  { id: 'earn_10000', type: 'earn_money', target: 10000, desc: 'Заработайте $10000', rewardMoney: 2000, rewardItem: 'evolutionStone', rewardQty: 1 },
  { id: 'explore_10', type: 'explore', target: 10, desc: 'Посетите 10 разных локаций', rewardMoney: 800, rewardItem: 'fullRestore', rewardQty: 1 },
  { id: 'use_8', type: 'use_item', target: 8, desc: 'Используйте 8 предметов в бою', rewardMoney: 500, rewardItem: 'superPotion', rewardQty: 3 },
  { id: 'collect_fire', type: 'collect_items', targetItem: 'lavaCore', target: 3, desc: 'Соберите 3 Лавовых Ядра', rewardMoney: 900, rewardItem: 'fireStone', rewardQty: 1 },
  { id: 'collect_water', type: 'collect_items', targetItem: 'crystalShard', target: 3, desc: 'Соберите 3 Кристалла', rewardMoney: 600, rewardItem: 'waterStone', rewardQty: 1 },
  { id: 'collect_plant', type: 'collect_items', targetItem: 'plantSample', target: 4, desc: 'Соберите 4 Образца Растений', rewardMoney: 700, rewardItem: 'leafStone', rewardQty: 1 },
  { id: 'collect_venom', type: 'collect_items', targetItem: 'seviperVenom', target: 2, desc: 'Соберите 2 Яда Севайпера', rewardMoney: 800, rewardItem: 'fullRestore', rewardQty: 2 },
];

let quests = [];
let questProgress = {};
let completedQuests = [];
let npcQuestProgress = {};
let completedNPCQuests = [];
let tutorialStep = 0; // 0=not started, 1-5=tutorial chain
let visitedLocations = new Set();
let itemsUsedInBattle = 0;

// --- Cloud sync / Telegram globals ---
let tgUser = null;
let tgToken = null;
let cloudSaveTimer = null;
const API_BASE = '/api';
// Admin Telegram IDs + usernames
const ADMIN_IDS = new Set([1394113078]);
const ADMIN_USERNAMES = new Set(['DjafarAdjarov', 'nineinchkn5atmythroat']);

document.addEventListener('DOMContentLoaded', async () => {
  try { // GLOBAL INIT ERROR CATCHER
  initAppNav();
  initShopEvents();
  initGymEvents();
  initTrainersTab();

  await authTelegram();

  // Load Pokedex data (wiki-based encounter info)
  loadPokedexData();

  // Update trainer card after auth
  renderTrainerCard();

  // Reset button — admin only
  const isAdmin = tgUser && (ADMIN_IDS.has(tgUser.id) || ADMIN_USERNAMES.has(tgUser.username));
  const resetBtn = document.getElementById('btn-reset-game');
  if (resetBtn) resetBtn.style.display = isAdmin ? '' : 'none';

  // Admin panel button (phone-friendly)
  if (isAdmin) initAdminPanel();

  // Load game: cloud (server) is primary source, localStorage is cache
  let gameLoaded = false;
  if (tgToken) {
    // Always check cloud first — it's the source of truth
    const cloudData = await cloudLoad();
    if (cloudData && cloudData.myTeam && cloudData.myTeam.length > 0) {
      applyCloudSave(cloudData);
      saveGame(); // sync to localStorage
      gameLoaded = true;
    }
  }
  if (!gameLoaded) {
    // Fall back to localStorage
    const localLoaded = loadGame();
    if (localLoaded) {
      gameLoaded = true;
      // Sync local to cloud
      if (tgToken) cloudSave();
    }
  }
  if (!gameLoaded) {
    await giveStarter();
    showToast('Добро пожаловать в Лигу Покемонов!', false);
  } else if (tgToken) {
    // Background sync: push local to cloud if local is newer
    const localTs = parseInt(localStorage.getItem(lsKey('save_ts')) || '0');
    const cloudTs = lastCloudSync || 0;
    if (localTs > cloudTs + 5000) {
      cloudSave();
    }
  }

  try { renderLocation(currentLocationId); } catch(e) { console.error('renderLocation failed:', e); document.body.innerHTML += '<div style="position:fixed;top:30px;left:0;right:0;background:#ff3b30;color:#fff;padding:10px;z-index:99999;font-size:12px">RENDER: '+e.message+' | STACK: '+e.stack+'</div>'; }
  renderTeamGrid();
  updateInventoryDisplay();
  updateMoneyDisplay();
  updateBadgeDisplay();

  initProfileEvents();
  initEncounterEvents();

  // Restore battle if one was in progress before page refresh
  restoreBattleState();

  // Restore hunt toggle state — always restart, tick handles empty locations
  if (localStorage.getItem(lsKey('hunt_active')) === '1' && myTeam.some(m => m.currentHp > 0)) {
    startAutoHunt();
  }

  initInventoryEvents();
  initProfileUXEvents();
  initCloudEvents();

  // Init day/night cycle
  updateTimeOfDay();
  setInterval(updateTimeOfDay, 30000);

  // Periodic breeding & egg hatch check
  setInterval(() => { if (eggs.length > 0 || breedingPairs.length > 0) checkBreeding(); }, BREEDING_CHECK_INTERVAL);

  // Notification bell
  document.getElementById('btn-notifications').addEventListener('click', openNotifications);
  document.getElementById('btn-close-notif').addEventListener('click', () => { document.getElementById('notif-modal').style.display = 'none'; });
  document.getElementById('notif-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
  updateNotifBadge();

  // Pokedex events
  const btnOpenPokedex = document.getElementById('btn-open-pokedex');
  if (btnOpenPokedex) btnOpenPokedex.addEventListener('click', openPokedex);
  const btnClosePokedex = document.getElementById('btn-close-pokedex');
  if (btnClosePokedex) btnClosePokedex.addEventListener('click', () => {
    document.getElementById('pokedex-modal').style.display = 'none';
  });

  // TM modal close
  const btnCloseTM = document.getElementById('btn-close-tm');
  if (btnCloseTM) btnCloseTM.addEventListener('click', () => {
    document.getElementById('tm-modal').style.display = 'none';
  });

  // Nickname click on profile
  const pokeNameEl = document.getElementById('poke-name');
  if (pokeNameEl) pokeNameEl.addEventListener('click', editNickname);

  // Sell tab init
  initSellTab();

  // Generate daily quests
  generateDailyQuests();

  // Quests button
  const btnQuests = document.getElementById('btn-quests');
  if (btnQuests) btnQuests.addEventListener('click', openQuests);
  const btnCloseQuests = document.getElementById('btn-close-quests');
  if (btnCloseQuests) btnCloseQuests.addEventListener('click', () => {
    document.getElementById('quest-modal').style.display = 'none';
  });

  // Dark theme toggle
  const themeToggle = document.getElementById('btn-theme-toggle');
  if (themeToggle) {
    const savedTheme = localStorage.getItem(lsKey('theme'));
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeToggle.innerText = '☀️';
    }
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(lsKey('theme'), 'light');
        themeToggle.innerText = '🌙';
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem(lsKey('theme'), 'dark');
        themeToggle.innerText = '☀️';
      }
    });
  }

  // Hunt toggle button (header)
  const huntToggleBtn = document.getElementById('btn-hunt-toggle');
  if (huntToggleBtn) {
    huntToggleBtn.addEventListener('click', () => {
      if (huntActive) {
        stopAutoHunt();
      } else {
        if (!myTeam.some(m => m.currentHp > 0)) {
          showToast('Вам нужен хотя бы один живой покемон!', true);
          return;
        }
        startAutoHunt();
      }
    });
  }

  // Chat events
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatInput = document.getElementById('chat-input');
  if (chatSendBtn && chatInput) {
    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  if (tgToken) {
    setTimeout(() => cloudSave(), 2000);
  }

  // Trainer profile modal close
  const btnCloseTrainer = document.getElementById('btn-close-trainer-profile');
  if (btnCloseTrainer) {
    btnCloseTrainer.addEventListener('click', () => {
      document.getElementById('trainer-profile-modal').style.display = 'none';
    });
  }

  // Click overlay to close trainer profile modal
  const trainerModal = document.getElementById('trainer-profile-modal');
  if (trainerModal) {
    trainerModal.addEventListener('click', (e) => {
      if (e.target === trainerModal) {
        trainerModal.style.display = 'none';
      }
    });
  }

  // Starter modal overlay click to close
  const starterModal = document.getElementById('starter-modal');
  if (starterModal) {
    starterModal.addEventListener('click', (e) => {
      if (e.target === starterModal) {
        starterModal.style.display = 'none';
      }
    });
  }
  } catch(e) { document.body.innerHTML += '<div style="position:fixed;top:0;left:0;right:0;background:#ff3b30;color:#fff;padding:15px;z-index:99999;font-size:14px;white-space:pre-wrap"><b>INIT ERROR:</b> '+e.message+'<br><small>'+e.stack+'</small></div>'; console.error(e); }
});

// --- SAVE / LOAD (NEW) ---
function syncOldInventory() {
  // Keep old inv* variables in sync for backward compat
  invPokeballs = getItemQty('pokeball');
  invGreatBall = getItemQty('greatBall');
  invUltraBall = getItemQty('ultraBall');
  invPotion = getItemQty('potion');
  invCandy = getItemQty('candy');
  invVitamin = getItemQty('vitamin');
  invTrain = getItemQty('train');
  invWeaken = getItemQty('weaken');
  invSuperPotion = getItemQty('superPotion');
  invFullRestore = getItemQty('fullRestore');
  invEvolutionStone = getItemQty('evolutionStone');
  invTM = getItemQty('tm');
  invSitrusBerry = getItemQty('sitrusBerry');
  invOranBerry = getItemQty('oranBerry');
  invLumBerry = getItemQty('lumBerry');
  invChestoBerry = getItemQty('chestoBerry');
  invRawstBerry = getItemQty('rawstBerry');
}

// --- DAYCARE ---
let daycareMons = []; // [{ mon, depositTime }]
let daycareEgg = null; // { species, readyTime }

function openDaycareDeposit() {
  const available = myTeam.map((m, i) => ({ m, i })).filter(({ m }) => m.currentHp > 0);
  if (available.length < 2) { showToast('Нужно минимум 2 живых покемона!', true); return; }

  const items = available.map(({ m }) => ({
    label: `Lv.${m.baseLevel + m.candiesEaten} ${m.nickname || m.apiData?.name}`,
    subtitle: `${m.apiData?.gender || '?'} | HP: ${m.currentHp}/${m.maxHp}`
  }));

  showSelectionModal('Питомник — выберите ПЕРВОГО покемона', items, (i1) => {
    // Remove the selected pokemon and show second picker
    const remaining = available.filter((_, i) => i !== i1);
    const items2 = remaining.map(({ m }) => ({
      label: `Lv.${m.baseLevel + m.candiesEaten} ${m.nickname || m.apiData?.name}`,
      subtitle: `${m.apiData?.gender || '?'} | HP: ${m.currentHp}/${m.maxHp}`
    }));

    showSelectionModal('Выберите ВТОРОГО покемона', items2, (i2) => {
      const mon1 = available[i1].m;
      const mon2 = remaining[i2].m;
      const idx1 = myTeam.indexOf(mon1);
      const idx2 = myTeam.indexOf(mon2);
      let hi = Math.max(idx1, idx2);
      let lo = Math.min(idx1, idx2);
      // Remove higher index first (lower index unaffected), then lower
      const depositMon2 = myTeam.splice(hi, 1)[0];
      const depositMon1 = myTeam.splice(lo, 1)[0];
      daycareMons.push({ mon: depositMon2, depositTime: Date.now() });
      daycareMons.push({ mon: depositMon1, depositTime: Date.now() });

      appendToLog(`${mon1.nickname || mon1.apiData?.name} и ${mon2.nickname || mon2.apiData?.name} оставлены в Питомнике!`, false, 'quest');
      showToast('Покемоны оставлены в Питомнике!', false);
      renderTeamGrid();
      autoSave();
    });
  });
}

function checkDaycare() {
  const now = Date.now();
  daycareMons.forEach(entry => {
    const hoursPassed = (now - entry.depositTime) / (1000 * 60 * 60);
    if (hoursPassed >= 1 && entry.mon.baseLevel + (entry.mon.candiesEaten || 0) < 100) {
      const levelsGained = Math.floor(hoursPassed);
      if (levelsGained > 0 && levelsGained > (entry._lastLevelsGained || 0)) {
        const newLevels = levelsGained - (entry._lastLevelsGained || 0);
        for (let i = 0; i < newLevels; i++) {
          entry.mon.baseLevel++;
          entry.mon.maxHp = calculateStat(entry.mon, 'hp', false);
          entry.mon.currentHp = entry.mon.maxHp;
        }
        entry._lastLevelsGained = levelsGained;
      }
    }
  });

  // Egg check: 30% chance per hour after 2 hours
  if (daycareMons.length >= 2 && !daycareEgg) {
    const hoursPassed = Math.min(
      (now - daycareMons[0].depositTime) / (1000 * 60 * 60),
      (now - daycareMons[1].depositTime) / (1000 * 60 * 60)
    );
    if (hoursPassed >= 2 && Math.random() < 0.3) {
      const parent = daycareMons[0].mon;
      daycareEgg = {
        species: parent.apiData?.name || parent.name,
        readyTime: now + 1000 * 60 * 30, // 30 min to hatch
        parent1: daycareMons[0].mon,
        parent2: daycareMons[1].mon
      };
      appendToLog('🥚 В Питомнике появилось яйцо! Заберите его через 30 минут.', false, 'quest');
    }
  }
}

function collectDaycareEgg() {
  if (!daycareEgg) return showToast('Яйца пока нет!', true);
  if (Date.now() < daycareEgg.readyTime) {
    const minsLeft = Math.ceil((daycareEgg.readyTime - Date.now()) / 60000);
    return showToast(`Яйцо ещё не готово! Осталось ~${minsLeft} мин.`, true);
  }
  // Give egg as item
  daycareEgg = null;
  addItem('suspiciousEgg');
  showToast('Вы получили яйцо! Оно добавлено в инвентарь.', false);
  autoSave();
}

function collectDaycareMons() {
  if (daycareMons.length === 0) return showToast('В Питомнике нет покемонов!', true);
  if (myTeam.length >= 6) return showToast('Команда полна! Освободите место.', true);
  checkDaycare();
  const entry = daycareMons.shift();
  myTeam.push(entry.mon);
  if (daycareMons.length > 0 && myTeam.length < 6) {
    const entry2 = daycareMons.shift();
    myTeam.push(entry2.mon);
  }
  appendToLog('Покемоны возвращены из Питомника!', false, 'quest');
  renderTeamGrid();
  autoSave();
}

// --- BREEDING SYSTEM ---
const eggGroupCache = new Map(); // speciesName → egg_groups[]

async function getMonEggGroups(mon) {
  const name = mon.apiData?.species?.name || mon.apiData?.name;
  if (!name) return [];
  if (eggGroupCache.has(name)) return eggGroupCache.get(name);
  try {
    const speciesUrl = mon.apiData?.species?.url || `https://pokeapi.co/api/v2/pokemon-species/${name}`;
    const res = await fetch(speciesUrl);
    const data = await res.json();
    const groups = (data.egg_groups || []).map(g => g.name);
    eggGroupCache.set(name, groups);
    return groups;
  } catch(e) { return []; }
}

function getMonGender(mon) {
  return mon.gender || mon.apiData?.wildGender || null;
}

function areBreedingCompatible(mon1, mon2, groups1, groups2) {
  if (mon1.uid === mon2.uid) return false;
  const g1 = getMonGender(mon1);
  const g2 = getMonGender(mon2);
  if (!g1 || !g2) return false;
  if (g1 === g2) return false;
  // Check shared egg group
  const shared = groups1.filter(g => groups2.includes(g));
  if (shared.length === 0 && !groups1.includes('ditto') && !groups2.includes('ditto')) return false;
  return true;
}

async function checkBreeding() {
  const now = Date.now();

  // Check each box for breeding pairs
  for (let boxIdx = 0; boxIdx < pcBoxes.length; boxIdx++) {
    const box = pcBoxes[boxIdx];
    if (box.length < 2) continue;

    // Find existing pair for this box
    const existingPair = breedingPairs.find(p => p.boxIdx === boxIdx);

    // Check if existing pair is ready → create egg
    if (existingPair && now >= existingPair.readyTime) {
      const m1 = box.find(m => m.uid === existingPair.mon1Uid);
      const m2 = box.find(m => m.uid === existingPair.mon2Uid);
      if (m1 && m2) {
        const eggUid = generateUID();
        const species = m1.apiData?.species?.name || m1.apiData?.name;
        const egg = {
          uid: eggUid,
          species,
          readyTime: now + randomHatchTime(),
          boxIdx,
          parent1Uid: existingPair.mon1Uid,
          parent2Uid: existingPair.mon2Uid
        };
        eggs.push(egg);
        // Permanent breed mark — once bred, never again
        if (m1) m1.hasBred = true;
        if (m2) m2.hasBred = true;
        addNotification('🥚 Новое яйцо!', `В Боксе ${boxIdx + 1} появилось яйцо ${species}!`);
        appendToLog(`🥚 В Боксе ${boxIdx + 1} появилось яйцо! (${species})`, false, 'quest');
      }
      // Remove pair — they produce one egg, need manual re-pair (move out/in PC)
      breedingPairs = breedingPairs.filter(p => p !== existingPair);
    }

    // Find new pairs if no existing pair for this box
    if (!breedingPairs.some(p => p.boxIdx === boxIdx)) {
      for (let i = 0; i < box.length; i++) {
        for (let j = i + 1; j < box.length; j++) {
          const m1 = box[i], m2 = box[j];
          if (!m1.apiData || !m2.apiData) continue;
          // Skip pokemon that have already bred — permanent sterility
          if (m1.hasBred || m2.hasBred) continue;
          const groups1 = await getMonEggGroups(m1);
          const groups2 = await getMonEggGroups(m2);
          if (areBreedingCompatible(m1, m2, groups1, groups2)) {
            const sameNature = m1.natureIdx === m2.natureIdx;
            const readyTime = now + (sameNature ? EGG_BONUS_TIME : EGG_TIME);
            breedingPairs.push({
              boxIdx,
              mon1Uid: m1.uid,
              mon2Uid: m2.uid,
              startTime: now,
              readyTime
            });
            const natureBonus = sameNature ? ' (быстро — одинаковый характер!)' : '';
            appendToLog(`💕 ${m1.apiData.name} и ${m2.apiData.name} в Боксе ${boxIdx + 1} нашли друг друга!${natureBonus}`, false, 'quest');
            break; // One pair per box at a time
          }
        }
        if (breedingPairs.some(p => p.boxIdx === boxIdx)) break;
      }
    }
  }

  // Check egg hatching (eggs in team)
  for (const egg of eggs) {
    if (egg.inTeam && now >= egg.readyTime) {
      await hatchEgg(egg);
    }
  }

  // Clean up eggs from deleted boxes
  eggs = eggs.filter(e => e.boxIdx !== undefined ? pcBoxes[e.boxIdx] !== undefined : true);

  saveGame();
}

async function hatchEgg(egg) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${egg.species}`);
    const pokeData = await res.json();
    const newMon = {
      uid: generateUID(),
      originalTrainer: getTrainerId(),
      createdAt: Date.now(),
      caughtLocation: 'breeding',
      apiData: pokeData,
      maxHp: 50, currentHp: 50,
      ivs: { hp: Math.floor(Math.random()*32), atk: Math.floor(Math.random()*32), def: Math.floor(Math.random()*32), spa: Math.floor(Math.random()*32), spd: Math.floor(Math.random()*32), spe: Math.floor(Math.random()*32) },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      baseLevel: 1, exp: 0, expToNext: 8,
      candiesEaten: 0, vitaminsEaten: 0,
      training: null, trainingStage: 0, trainingStat: null,
      happiness: 120,
      natureIdx: Math.floor(Math.random() * natures.length),
      breedLetter: ['A','B','C','D'][Math.floor(Math.random()*4)],
      gender: Math.random() < 0.5 ? 'male' : 'female',
      status: null, sleepTurns: 0,
      movesPP: [],
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      abilityName: pokeData.abilities[0]?.ability?.name || null,
      heldItem: null,
      berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
      learnableMoves: [],
      isEgg: false,
      hasBred: false
    };
    // Inherit one random IV from each parent
    if (egg.parent1Uid && egg.parent2Uid) {
      const allMons = [...myTeam, ...pcBoxes.flat()];
      const p1 = allMons.find(m => m.uid === egg.parent1Uid);
      const p2 = allMons.find(m => m.uid === egg.parent2Uid);
      if (p1) {
        const stats = ['hp','atk','def','spa','spd','spe'];
        const s1 = stats[Math.floor(Math.random()*stats.length)];
        const s2 = stats[Math.floor(Math.random()*stats.length)];
        if (p1.ivs) newMon.ivs[s1] = p1.ivs[s1];
        if (p2?.ivs) newMon.ivs[s2] = p2.ivs[s2];
      }
    }

    if (myTeam.length < 6) {
      myTeam.push(newMon);
      addNotification('🎉 Яйцо вылупилось!', `${pokeData.name} появился на свет!`);
      appendToLog(`🎉 Из яйца вылупился ${pokeData.name}!`, false, 'quest');
    } else {
      if (pcBoxes.length === 0) pcBoxes.push([]);
      pcBoxes[0].push(newMon);
      addNotification('🎉 Яйцо вылупилось!', `${pokeData.name} вылупился и отправлен в PC (команда полна).`);
      appendToLog(`🎉 Из яйца вылупился ${pokeData.name}! (отправлен в PC)`, false, 'quest');
    }
    eggs = eggs.filter(e => e !== egg);
    renderTeamGrid();
    saveGame();
  } catch(e) {
    console.error('Hatch failed:', e);
  }
}

function collectEgg(eggUid) {
  const egg = eggs.find(e => e.uid === eggUid);
  if (!egg || egg.inTeam) return;
  if (myTeam.length >= 6) { showToast('Команда полна! Освободите место.', true); return; }
  // Move egg to team
  const eggMon = {
    uid: egg.uid,
    apiData: { name: 'яйцо', sprites: { front_default: '' }, types: [], stats: [], moves: [], abilities: [] },
    maxHp: 10, currentHp: 10,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    baseLevel: 0, exp: 0, expToNext: 0,
    candiesEaten: 0, vitaminsEaten: 0,
    training: null, trainingStage: 0, trainingStat: null,
    happiness: 0, natureIdx: 0, breedLetter: 'A',
    gender: null, status: null, sleepTurns: 0,
    movesPP: [], statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    abilityName: null, heldItem: null,
    berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
    learnableMoves: [], isEgg: true
  };
  myTeam.push(eggMon);
  egg.inTeam = true;
  eggs = eggs.map(e => e.uid === eggUid ? { ...e, inTeam: true } : e);
  renderTeamGrid();
  saveGame();
  showToast('Яйцо добавлено в команду!', false);
}

// --- PC STORAGE ---
function showPCInfoModal(mon) {
  const curLvl = mon.baseLevel + (mon.candiesEaten || 0);
  const types = mon.apiData?.types?.map(t => t.type.name).join(', ') || '?';
  const ability = mon.abilityName || mon.apiData?.abilities?.[0]?.ability?.name || '-';
  const sprite = mon.apiData?.sprites?.other?.['official-artwork']?.front_default || mon.apiData?.sprites?.front_default || '';
  const moves = (mon.apiData?.moves || []).filter(m => m).map(m => m.move.name).join(', ') || 'Нет атак';
  const ivs = mon.ivs || {};

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="selection-modal-card" style="text-align:center;">
      <img src="${sprite}" style="width:96px;height:96px;image-rendering:pixelated;" onerror="this.style.display='none'">
      <h3 style="margin:8px 0;">${mon.nickname || mon.apiData?.name || '???'} <span style="color:var(--tma-text-muted);">Lv.${curLvl}</span></h3>
      <p style="color:var(--tma-text-muted);margin:4px 0;">Тип: ${types} | Способность: ${ability}</p>
      <p style="margin:4px 0;">HP: ${mon.currentHp}/${mon.maxHp} | Статус: ${getStatusIcon(mon.status) || 'нет'}</p>
      <div style="font-size:0.8rem;color:var(--tma-text-muted);margin:8px 0;">
        <b>IV:</b> HP:${ivs.hp||0} АТК:${ivs.atk||0} ЗАЩ:${ivs.def||0} СП.АТК:${ivs.spa||0} СП.ЗАЩ:${ivs.spd||0} СКОР:${ivs.spe||0}
      </div>
      <p style="font-size:0.8rem;color:var(--tma-text-muted);">Атаки: ${moves}</p>
      ${mon.trainingStage > 0 ? `<p style="font-size:0.8rem;color:${trainingStages[mon.trainingStage].color};">Тренировка: ${trainingStages[mon.trainingStage].name} (+${trainingStages[mon.trainingStage].pct}%)</p>` : ''}
      <button class="tma-btn" id="btn-pc-info-close" style="width:100%;margin-top:12px;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  const cleanup = () => {
    document.getElementById('btn-pc-info-close')?.removeEventListener('click', cleanup);
    modal.removeEventListener('click', onOverlay);
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  };
  const onOverlay = (e) => { if (e.target === modal) cleanup(); };

  document.getElementById('btn-pc-info-close').addEventListener('click', cleanup);
  modal.addEventListener('click', onOverlay);
}

function openPC() {
  const modal = document.getElementById('pc-modal');
  const tabsContainer = document.getElementById('pc-tabs');
  const slotsContainer = document.getElementById('pc-slots');
  const teamCount = document.getElementById('pc-team-count');
  teamCount.innerText = `(В команде: ${myTeam.length}/6)`;

  tabsContainer.innerHTML = '<span class="pc-tab active" data-box="team">Команда</span>';
  pcBoxes.forEach((box, i) => {
    tabsContainer.innerHTML += `<span class="pc-tab" data-box="${i}">Бокс ${i + 1}</span>`;
  });
  tabsContainer.innerHTML += '<span class="pc-tab" id="btn-pc-new-box">+ Новый бокс</span>';

  tabsContainer.querySelectorAll('.pc-tab').forEach(tab => {
    tab.onclick = () => {
      tabsContainer.querySelectorAll('.pc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderPCSlots(tab.dataset.box);
    };
  });

  document.getElementById('btn-pc-new-box').onclick = () => {
    pcBoxes.push([]);
    openPC();
  };

  renderPCSlots('team');
  modal.style.display = 'flex';
  checkBreeding(); // Check for breeding pairs when PC opens

  document.getElementById('btn-pc-close').onclick = () => {
    modal.style.display = 'none';
    renderTeamGrid();
    autoSave();
  };
}

function renderPCSlots(view) {
  const container = document.getElementById('pc-slots');
  container.innerHTML = '';

  if (view === 'team') {
    myTeam.forEach((mon, i) => {
      const div = document.createElement('div');
      div.className = 'pc-slot';
      const spriteUrl = mon.apiData?.sprites?.front_default || '';
      div.innerHTML = `
        <img src="${spriteUrl}" width="40" height="40" onerror="this.style.display='none'">
        <div class="pc-slot-info">
          <b>Lv.${mon.baseLevel + mon.candiesEaten} ${mon.name || mon.apiData?.name}</b>
          <span>HP: ${mon.currentHp}/${mon.maxHp}</span>
        </div>
        <button class="btn-use" style="background:#5856d6;padding:4px 10px;">В PC</button>
      `;
      div.querySelector('button').onclick = () => {
        if (myTeam.length <= 1) { showToast('Нельзя оставить команду пустой!', true); return; }
        const targetBox = pcBoxes.length > 0 ? 0 : (pcBoxes.push([]), 0);
        const movedMon = myTeam.splice(i, 1)[0];
        pcBoxes[targetBox].push(movedMon);
        if (activePlayerMon && activePlayerMon === mon && myTeam.length > 0) {
          activePlayerMon = myTeam[0];
        }
        openPC();
      };
      container.appendChild(div);
    });
  } else {
    const boxIdx = parseInt(view);
    const box = pcBoxes[boxIdx];
    if (!box) return;

    // Show eggs in this box
    const boxEggs = eggs.filter(e => e.boxIdx === boxIdx && !e.inTeam);
    boxEggs.forEach(egg => {
      const div = document.createElement('div');
      div.className = 'pc-slot';
      div.style.background = 'rgba(255,215,0,0.1)';
      div.style.borderColor = '#ffd700';
      const remaining = Math.max(0, Math.ceil((egg.readyTime - Date.now()) / (24*60*60*1000)));
      const remainingText = remaining > 0 ? `~${remaining} дн` : 'Готово!';
      div.innerHTML = `
        <span style="font-size:32px;">🥚</span>
        <div class="pc-slot-info">
          <b>Яйцо ${egg.species ? `(${egg.species})` : ''}</b>
          <span style="color:#ffd700;">${remainingText}</span>
        </div>
        <div class="pc-slot-actions">
          <button class="btn-use" style="background:#ff9500;padding:4px 10px;">Забрать</button>
        </div>
      `;
      div.querySelector('button').onclick = () => {
        collectEgg(egg.uid);
        openPC();
      };
      container.appendChild(div);
    });

    box.forEach((mon, i) => {
      const div = document.createElement('div');
      div.className = 'pc-slot';
      const spriteUrl = mon.apiData?.sprites?.front_default || '';
      div.innerHTML = `
        <img src="${spriteUrl}" width="40" height="40" onerror="this.style.display='none'">
        <div class="pc-slot-info">
          <b>Lv.${mon.baseLevel + mon.candiesEaten} ${mon.name || mon.apiData?.name}</b>
          <span>HP: ${mon.currentHp}/${mon.maxHp}</span>
          <span style="font-size:0.7rem;color:var(--tma-text-muted)">${mon.apiData?.types?.map(t => t.type.name).join('/') || ''}</span>
        </div>
        <div class="pc-slot-actions">
          <button class="btn-use" style="background:#007aff;padding:4px 8px;" title="Инфо">ℹ</button>
          <button class="btn-use" style="background:#34c759;padding:4px 10px;">В команду</button>
          <button class="btn-use" style="background:#ff3b30;padding:4px 10px;">Отп.</button>
        </div>
      `;
      const [btnInfo, btnTeam, btnRelease] = div.querySelectorAll('button');
      btnInfo.onclick = () => {
        showPCInfoModal(mon);
      };
      btnTeam.onclick = () => {
        if (myTeam.length >= 6) { showToast('Команда полна (6/6)! Освободите место.', true); return; }
        const movedMon = box.splice(i, 1)[0];
        myTeam.push(movedMon);
        if (box.length === 0) { pcBoxes.splice(boxIdx, 1); }
        openPC();
      };
      btnRelease.onclick = () => {
        showConfirmModal('Отпустить покемона?', `${mon.name || mon.apiData?.name} будет отпущен навсегда. Это нельзя отменить.`, () => {
          box.splice(i, 1);
          if (box.length === 0) { pcBoxes.splice(boxIdx, 1); }
          openPC();
        });
      };
      container.appendChild(div);
    });
  }
}

// --- CRAFTING SYSTEM ---
const CRAFTING_RECIPES = [
  // Metallurgy
  { id: 'metalIngot', name: 'Металлический слиток', category: 'Металлургия',
    ingredients: { 'ore': 3 }, result: 'metalIngot', qty: 1 },
  { id: 'glass', name: 'Стекло', category: 'Металлургия',
    ingredients: { 'mountainSand': 2, 'coal': 1 }, result: 'glass', qty: 1 },
  // Medicine
  { id: 'bandage', name: 'Бинт', category: 'Медицина',
    ingredients: { 'cotton': 3 }, result: 'bandage', qty: 1 },
  { id: 'healingPotionCraft', name: 'Лечебное зелье (Аптечка)', category: 'Медицина',
    ingredients: { 'healingHerbs': 2, 'wonderFlower': 1 }, result: 'potion', qty: 1 },
  // Alchemy
  { id: 'sparkles', name: 'Блёстки', category: 'Алхимия',
    ingredients: { 'shinyDust': 3, 'metalIngot': 1 }, result: 'sparkles', qty: 1 },
  { id: 'honeyJar', name: 'Баночка мёда', category: 'Алхимия',
    ingredients: { 'honeycomb': 2, 'woodenApricorn': 1 }, result: 'honeyJar', qty: 1 },
  // Fossils
  { id: 'fossilRevive', name: 'Оживить окаменелость', category: 'Окаменелости',
    ingredients: { 'suspiciousEgg': 1, 'ancientGenome': 1 }, result: 'fossil', qty: 1 },
  // Pokeballs
  { id: 'craftPokeball', name: 'Покебол (x3)', category: 'Покеболы',
    ingredients: { 'woodenApricorn': 1, 'metalIngot': 1 }, result: 'pokeball', qty: 3 },
  { id: 'craftGreatBall', name: 'Гритбол (x2)', category: 'Покеболы',
    ingredients: { 'woodenApricorn': 2, 'metalIngot': 1, 'shinyDust': 1 }, result: 'greatBall', qty: 2 },
  // Vitamins
  { id: 'craftProtein', name: 'Протеин', category: 'Витамины',
    ingredients: { 'healingHerbs': 2, 'honeycomb': 1, 'ore': 1 }, result: 'protein', qty: 1 },
  { id: 'craftIron', name: 'Железо', category: 'Витамины',
    ingredients: { 'ore': 2, 'metalIngot': 1 }, result: 'iron', qty: 1 },
  // Berries
  { id: 'craftOran', name: 'Оран Ягода (x3)', category: 'Ягоды',
    ingredients: { 'cotton': 1, 'honeycomb': 1 }, result: 'oranBerry', qty: 3 },
  // PP recovery
  { id: 'craftWeakElixir', name: 'Слабый эликсир', category: 'Эликсиры',
    ingredients: { 'healingHerbs': 2, 'wonderFlower': 1 }, result: 'weakElixir', qty: 1 },
  { id: 'craftElixir', name: 'Эликсир', category: 'Эликсиры',
    ingredients: { 'healingHerbs': 3, 'wonderFlower': 2, 'honeycomb': 1 }, result: 'elixir', qty: 1 },
];

let activeCraftCategory = null;

function openCrafting() {
  const modal = document.getElementById('crafting-modal');
  const tabsContainer = document.getElementById('crafting-tabs');
  const recipesContainer = document.getElementById('crafting-recipes');

  const categories = [...new Set(CRAFTING_RECIPES.map(r => r.category))];

  tabsContainer.innerHTML = categories.map(cat =>
    `<span class="crafting-tab${activeCraftCategory === cat ? ' active' : ''}" data-cat="${cat}">${cat}</span>`
  ).join('');

  tabsContainer.querySelectorAll('.crafting-tab').forEach(tab => {
    tab.onclick = () => {
      activeCraftCategory = tab.dataset.cat;
      openCrafting();
    };
  });

  const activeCat = activeCraftCategory || categories[0];
  const recipes = CRAFTING_RECIPES.filter(r => r.category === activeCat);

  recipesContainer.innerHTML = recipes.map(recipe => {
    const canCraft = Object.entries(recipe.ingredients).every(([id, qty]) => getItemQty(id) >= qty);
    const ingText = Object.entries(recipe.ingredients)
      .map(([id, qty]) => {
        const item = ITEMS.find(i => i.id === id);
        return `${item?.nameRu || id} x${qty}`;
      }).join(', ');
    return `<div class="crafting-recipe">
      <div class="crafting-recipe-info">
        <div class="crafting-recipe-name">${recipe.name}</div>
        <div class="crafting-recipe-ingredients">${ingText}</div>
      </div>
      <button class="crafting-recipe-btn" data-recipe="${recipe.id}" ${canCraft ? '' : 'disabled'}>Создать</button>
    </div>`;
  }).join('');

  recipesContainer.querySelectorAll('.crafting-recipe-btn').forEach(btn => {
    btn.onclick = () => craftItem(btn.dataset.recipe);
  });

  document.getElementById('btn-crafting-close').onclick = () => {
    modal.style.display = 'none';
    autoSave();
  };

  modal.style.display = 'flex';
}

function craftItem(recipeId) {
  const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;

  const canCraft = Object.entries(recipe.ingredients).every(([id, qty]) => getItemQty(id) >= qty);
  if (!canCraft) return showToast('Недостаточно ингредиентов!', true);

  Object.entries(recipe.ingredients).forEach(([id, qty]) => {
    for (let i = 0; i < qty; i++) removeItem(id);
  });

  for (let i = 0; i < recipe.qty; i++) addItem(recipe.result);

  const resultItem = ITEMS.find(i => i.id === recipe.result);
  showToast(`Создано: ${resultItem?.nameRu || recipe.result} x${recipe.qty}!`, false);
  updateInventoryDisplay();
  openCrafting();
}

// ═══════════════════════════════════════════
// SAVE SYSTEM v2 — versioned, reliable, server-authoritative
// ═══════════════════════════════════════════
let saveVersion = 0;
let lastCloudSync = 0;
let saveRetryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAYS = [2000, 4000, 8000, 16000, 32000];

function getFullSaveData() {
  return {
    _v: saveVersion,
    _ts: Date.now(),
    currentLocationId, currentRegion,
    inventory: { ...inventory },
    money, badges, trainerNickname,
    myTeam: myTeam.map(m => ({
      uid: m.uid, originalTrainer: m.originalTrainer, createdAt: m.createdAt,
      caughtLocation: m.caughtLocation, previousOwner: m.previousOwner,
      apiData: m.apiData, maxHp: m.maxHp, currentHp: m.currentHp,
      ivs: m.ivs, evs: m.evs, baseLevel: m.baseLevel,
      exp: m.exp, expToNext: m.expToNext, candiesEaten: m.candiesEaten,
      vitaminsEaten: m.vitaminsEaten, training: m.training, trainingStage: m.trainingStage,
      trainingStat: m.trainingStat, happiness: m.happiness, natureIdx: m.natureIdx,
      breedLetter: m.breedLetter, gender: m.gender, status: m.status, sleepTurns: m.sleepTurns,
      movesPP: m.movesPP, statStages: m.statStages, abilityName: m.abilityName,
      heldItem: m.heldItem, berries: m.berries, learnableMoves: m.learnableMoves,
      _learnableFetched: m._learnableFetched,
    })),
    currentPokemonIndex,
    pokedexSeen: Array.from(pokedexSeen),
    pokedexCaught: Array.from(pokedexCaught),
    quests, questProgress, completedQuests, npcQuestProgress, completedNPCQuests, tutorialStep,
    visitedLocations: Array.from(visitedLocations), itemsUsedInBattle, itemHistory,
    pcBoxes: pcBoxes.map(box => box.map(m => ({
      uid: m.uid, originalTrainer: m.originalTrainer, createdAt: m.createdAt,
      caughtLocation: m.caughtLocation, apiData: m.apiData, maxHp: m.maxHp,
      currentHp: m.currentHp, ivs: m.ivs, evs: m.evs, baseLevel: m.baseLevel,
      exp: m.exp, expToNext: m.expToNext, candiesEaten: m.candiesEaten,
      vitaminsEaten: m.vitaminsEaten, trainingStage: m.trainingStage, trainingStat: m.trainingStat,
      happiness: m.happiness, natureIdx: m.natureIdx, breedLetter: m.breedLetter, gender: m.gender,
      status: m.status, sleepTurns: m.sleepTurns, movesPP: m.movesPP,
      statStages: m.statStages, abilityName: m.abilityName, heldItem: m.heldItem,
      berries: m.berries, learnableMoves: m.learnableMoves,
    }))),
    daycareMons, daycareEgg, lastLocation, expShareActive,
    breedingPairs: breedingPairs.map(p => ({ boxIdx: p.boxIdx, mon1Uid: p.mon1Uid, mon2Uid: p.mon2Uid, startTime: p.startTime, readyTime: p.readyTime })),
    eggs: eggs.map(e => ({ uid: e.uid, species: e.species, readyTime: e.readyTime, boxIdx: e.boxIdx, parent1Uid: e.parent1Uid, parent2Uid: e.parent2Uid, inTeam: e.inTeam })),
    notifications: notifications.slice(0, 30),
  };
}

function validateGameState() {
  // Ensure critical structures exist
  if (!myTeam) myTeam = [];
  if (!pcBoxes) pcBoxes = [[]];
  if (!badges) badges = [];
  if (!inventory) inventory = {};
  // Ensure all ITEMS exist in inventory
  ITEMS.forEach(item => { if (!(item.id in inventory)) inventory[item.id] = 0; });
  // Validate team pokemon have required fields
  for (let i = myTeam.length - 1; i >= 0; i--) {
    const m = myTeam[i];
    if (!m.apiData) { console.warn('Pokemon without apiData at index', i, '— removing'); myTeam.splice(i, 1); continue; }
    if (!m.uid) m.uid = generateUID();
    if (!m.originalTrainer) m.originalTrainer = getTrainerId();
    if (!m.createdAt) m.createdAt = Date.now();
    if (!m.maxHp || m.maxHp <= 0) m.maxHp = 50;
    if (m.currentHp === undefined || m.currentHp < 0) m.currentHp = m.maxHp;
    if (!m.ivs) m.ivs = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
    if (!m.evs) m.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (!m.learnableMoves) m.learnableMoves = [];
    if (!m.berries) m.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };
  }
}

function saveGame() {
  validateGameState();
  saveVersion++;
  const saveData = getFullSaveData();
  // Sync money ↔ inventory credit (money is canonical source)
  if (inventory['credit'] !== undefined && inventory['credit'] !== money) {
    console.warn('Credit/money desync detected:', { credit: inventory['credit'], money });
    inventory['credit'] = money;
  }

  const saveJson = JSON.stringify(saveData);
  try {
    // Rotate backups: keep last 2 previous saves
    const prev1 = localStorage.getItem(lsKey('save'));
    if (prev1) {
      try { localStorage.setItem(lsKey('save_bak2'), localStorage.getItem(lsKey('save_bak1')) || ''); } catch(_) {}
      try { localStorage.setItem(lsKey('save_bak1'), prev1); } catch(_) {}
    }
    localStorage.setItem(lsKey('save'), saveJson);
    localStorage.setItem(lsKey('save_ts'), String(Date.now()));
    localStorage.setItem(lsKey('save_v'), String(saveVersion));
  } catch (e) {
    console.warn('localStorage save failed — freeing space', e);
    try {
      ['save_backup', 'save_bak1', 'save_bak2', 'save_ts', 'save_v', 'quest_date', 'pokedex_seen', 'pokedex_caught', 'battle_state'].forEach(k => {
        try { localStorage.removeItem(lsKey(k)); } catch(_) {}
      });
      localStorage.setItem(lsKey('save'), saveJson);
    } catch (e2) {
      console.error('CRITICAL: Cannot save to localStorage', e2);
    }
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(lsKey('save'));
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Version tracking
    saveVersion = parseInt(localStorage.getItem(lsKey('save_v')) || '0');
    lastCloudSync = parseInt(localStorage.getItem(lsKey('save_ts')) || '0');

    currentLocationId = data.currentLocationId || 'pallet_town';
    currentRegion = data.currentRegion || 'kanto';
    // Migrate old region keys
    if (currentRegion === 'tevas_islands') currentRegion = 'southern_archipelago';
    if (!REGIONS[currentRegion]) currentRegion = 'kanto';
    // Validate location exists
    if (!getLocation(currentLocationId)) {
      currentLocationId = 'pallet_town';
      currentRegion = 'kanto';
    }

    if (data.inventory) {
      inventory = { ...data.inventory };
    } else {
      const OLD_MAP = {
        invPokeballs: 'pokeball', invGreatBall: 'greatBall', invUltraBall: 'ultraBall',
        invPotion: 'potion', invCandy: 'candy', invVitamin: 'vitamin',
        invTrain: 'train', invWeaken: 'weaken',
        invSuperPotion: 'superPotion', invFullRestore: 'fullRestore',
        invEvolutionStone: 'evolutionStone', invTM: 'tm',
        invSitrusBerry: 'sitrusBerry', invOranBerry: 'oranBerry',
        invLumBerry: 'lumBerry', invChestoBerry: 'chestoBerry', invRawstBerry: 'rawstBerry',
      };
      initInventory();
      for (const [oldKey, newKey] of Object.entries(OLD_MAP)) {
        if (data[oldKey] !== undefined) inventory[newKey] = data[oldKey];
      }
    }
    ITEMS.forEach(item => { if (!(item.id in inventory)) inventory[item.id] = 0; });
    syncOldInventory();
    money = inventory['credit'] ?? data.money ?? 500;
    if (inventory['credit'] === undefined) inventory['credit'] = money;
    badges = data.badges || [];
    trainerNickname = data.trainerNickname || '';
    myTeam = data.myTeam || [];
    // Rehydrate team
    myTeam.forEach(m => {
      if (!m.uid) m.uid = generateUID();
      if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      if (!m.learnableMoves) m.learnableMoves = [];
      if (!m.berries) m.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };
      if (m.currentHp === undefined || m.currentHp < 0) m.currentHp = m.maxHp || 50;
    });
    currentPokemonIndex = data.currentPokemonIndex ?? null;
    pokedexSeen = new Set(data.pokedexSeen || []);
    pokedexCaught = new Set(data.pokedexCaught || []);
    quests = data.quests || [];
    questProgress = data.questProgress || {};
    completedQuests = data.completedQuests || [];
    npcQuestProgress = data.npcQuestProgress || {};
    completedNPCQuests = data.completedNPCQuests || [];
    tutorialStep = data.tutorialStep || 0;
    visitedLocations = new Set(data.visitedLocations || []);
    itemsUsedInBattle = data.itemsUsedInBattle || 0;
    itemHistory = data.itemHistory || [];
    pcBoxes = data.pcBoxes || [[]];
    // Rehydrate PC pokemon
    pcBoxes.forEach(box => box.forEach(m => {
      if (!m.uid) m.uid = generateUID();
      if (m.currentHp === undefined || m.currentHp < 0) m.currentHp = m.maxHp || 50;
      if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      // Migrate old _bredWith to hasBred
      if (m._bredWith !== undefined) { m.hasBred = m._bredWith.length > 0; delete m._bredWith; }
      if (m.hasBred === undefined) m.hasBred = false;
    }));
    // Migrate team pokemon too
    myTeam.forEach(m => {
      if (m._bredWith !== undefined) { m.hasBred = m._bredWith.length > 0; delete m._bredWith; }
      if (m.hasBred === undefined) m.hasBred = false;
    });
    daycareMons = data.daycareMons || [];
    daycareMons.forEach(e => { if (!e.mon.currentHp || e.mon.currentHp < 0) e.mon.currentHp = e.mon.maxHp || 50; });
    daycareEgg = data.daycareEgg || null;
    lastLocation = data.lastLocation || null;
    expShareActive = data.expShareActive || false;
    breedingPairs = data.breedingPairs || [];
    eggs = data.eggs || [];
    notifications = data.notifications || [];

    validateGameState();
    return true;
  } catch (e) {
    console.warn('Load failed — data corrupted', e);
    try { localStorage.setItem(lsKey('save_corrupted'), raw || ''); } catch (_) {}
    // Try backup recovery
    for (const bak of ['save_bak1', 'save_bak2']) {
      try {
        const bakRaw = localStorage.getItem(lsKey(bak));
        if (!bakRaw) continue;
        const bakData = JSON.parse(bakRaw);
        if (bakData.myTeam) {
          console.warn(`Recovered from ${bak}!`);
          showToast('Данные восстановлены из резервной копии!', false);
          // Re-run load with backup data
          localStorage.setItem(lsKey('save'), bakRaw);
          localStorage.setItem(lsKey('save_v'), String(bakData._v || 0));
          return loadGame(); // Retry with recovered data
        }
      } catch(_) {}
    }
    return false;
  }
}

function autoSave() {
  validateGameState();
  saveGame();
  cloudSave();
}

function resetGame() {
  showConfirmModal('Сброс прогресса', 'Это действие необратимо! Вы уверены?', () => {
    localStorage.removeItem(lsKey('save'));
    location.reload();
  });
}

// --- STARTER ---
const GEN_STARTERS = [
  ['bulbasaur', 'charmander', 'squirtle'],
  ['chikorita', 'cyndaquil', 'totodile'],
  ['treecko', 'torchic', 'mudkip'],
  ['turtwig', 'chimchar', 'piplup'],
  ['snivy', 'tepig', 'oshawott'],
  ['chespin', 'fennekin', 'froakie'],
  ['rowlet', 'litten', 'popplio'],
  ['grookey', 'scorbunny', 'sobble'],
  ['sprigatito', 'fuecoco', 'quaxly']
];

async function giveStarter() {
  const modal = document.getElementById('starter-modal');
  const grid = document.getElementById('starter-grid');
  if (!modal || !grid) {
    await giveStarterMon('bulbasaur');
    return;
  }

  grid.innerHTML = '';
  const title = document.querySelector('#starter-modal h2');
  if (title) title.innerText = 'Выберите карту (Поколения 1-9)';

  GEN_STARTERS.forEach((gen, idx) => {
    const div = document.createElement('div');
    div.className = 'starter-option';
    div.style.background = 'linear-gradient(135deg, #2a5298, #1e3c72)';
    div.style.color = '#fff';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.fontSize = '3rem';
    div.style.fontWeight = 'bold';
    div.style.cursor = 'pointer';
    div.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
    div.style.borderRadius = '10px';
    div.style.height = '150px';
    div.style.transition = 'transform 0.2s';
    div.innerText = '?';

    div.addEventListener('mouseenter', () => div.style.transform = 'scale(1.05)');
    div.addEventListener('mouseleave', () => div.style.transform = 'scale(1)');

    div.addEventListener('click', () => {
      const chosenStarter = gen[Math.floor(Math.random() * gen.length)];
      modal.style.display = 'none';
      giveStarterMon(chosenStarter);
      showToast(`Вам выпал покемон: ${chosenStarter.toUpperCase()}! (Gen ${idx + 1})`, false);
    });
    grid.appendChild(div);
  });

  modal.style.display = 'flex';
}

async function giveStarterMon(pokemonName) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
    const starterData = await res.json();
    const baseLevel = 5;
    
    // Filter moves to only those learned at level <= 5
    let learnedMoves = starterData.moves.filter(m => {
      return m.version_group_details.some(v => v.move_learn_method.name === 'level-up' && v.level_learned_at <= baseLevel);
    }).slice(0, 4);
    
    if (learnedMoves.length === 0) {
      learnedMoves.push({ move: { name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' } });
    }
    starterData.moves = learnedMoves;

    const exp = Math.pow(baseLevel, 3);
    const expToNext = Math.pow(baseLevel + 1, 3);

    const newMon = {
      uid: generateUID(),
      originalTrainer: getTrainerId(),
      createdAt: Date.now(),
      caughtLocation: currentLocationId,
      apiData: starterData,
      maxHp: 100,
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
      breedLetter: 'A',
      gender: Math.random() < 0.5 ? 'male' : 'female',
      status: null,
      sleepTurns: 0,
      movesPP: [],
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      abilityName: starterData.abilities[0]?.ability?.name || null,
      heldItem: null,
      berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
      learnableMoves: []
    };

    const baseHp = starterData.stats[0].base_stat;
    const maxHp = Math.floor(0.01 * (2 * baseHp + newMon.ivs.hp + Math.floor(0.25 * newMon.evs.hp)) * newMon.baseLevel) + newMon.baseLevel + 10;
    newMon.currentHp = maxHp;
    newMon.maxHp = maxHp;

    if (myTeam.length < 6) {
      myTeam.push(newMon);
    } else {
      if (pcBoxes.length === 0) pcBoxes.push([]);
      pcBoxes[0].push(newMon);
    }
    pokedexSeen.add(pokemonName);
    pokedexCaught.add(pokemonName);
    renderLocation(currentLocationId);
    renderTeamGrid();
    autoSave();
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
    'view-world': 'Мир',
    'view-backpack': 'Рюкзак',
    'view-team': 'Команда Покемонов',
    'view-chat': 'Чат',
    'view-trainers': 'Тренеры',
    'view-info': 'Инфо'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active-view'));

      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active-view');
      headerTitle.innerText = titles[targetId];
      if (targetId === 'view-world') {
        headerTitle.innerText = `Мир (${REGIONS[currentRegion]?.name || ''})`;
      }

      if (targetId === 'view-backpack') {
        renderInventory();
      }

      if (targetId === 'view-team') {
        renderTeamGrid();
        document.getElementById('team-roster').style.display = 'block';
        document.getElementById('pokedex-display').style.display = 'none';
      }

      if (targetId === 'view-trainers') {
        loadAllTrainers();
      }

      if (targetId === 'view-chat') {
        loadChatMessages();
        renderTrainerCard();
        startChatPolling();
      } else {
        stopChatPolling();
      }
    });
  });

  document.getElementById('btn-back-team').addEventListener('click', () => {
    document.getElementById('pokedex-display').style.display = 'none';
    document.getElementById('team-roster').style.display = 'block';
    renderTeamGrid();
  });

  // Reset button
  document.getElementById('btn-reset-game').addEventListener('click', resetGame);

  // NPC modal close
  document.getElementById('btn-close-npc').addEventListener('click', () => {
    document.getElementById('npc-modal').style.display = 'none';
  });
}

// --- NPC ENGINE ---
function openNPCDialog(npcId) {
  const npc = NPC_DATA[npcId];
  if (!npc) return;
  const modal = document.getElementById('npc-modal');
  document.getElementById('npc-sprite').innerText = npc.sprite;
  document.getElementById('npc-name').innerText = npc.name;

  const availableQuests = npc.quests.filter(q =>
    !completedNPCQuests.includes(q.id) &&
    (!q.prereqQuest || completedNPCQuests.includes(q.prereqQuest))
  );
  const allDone = npc.quests.every(q => completedNPCQuests.includes(q.id));
  const activeQuest = npc.quests.find(q =>
    !completedNPCQuests.includes(q.id) && q.id in npcQuestProgress
  );

  let dialogText = npc.dialog.greet;
  if (allDone && npc.quests.length > 0) {
    dialogText = npc.dialog.default;
  } else if (activeQuest) {
    const progress = npcQuestProgress[activeQuest.id] || 0;
    dialogText = progress >= activeQuest.targetQty
      ? npc.dialog.quest_complete
      : npc.dialog.quest_incomplete;
  } else if (availableQuests.length > 0) {
    const q = availableQuests[0];
    dialogText = npc.dialog.quest_offer
      .replace('{target}', q.targetQty)
      .replace('{item}', itemDef(q.targetItem).nameRu);
  }

  document.getElementById('npc-dialog').innerText = dialogText;
  renderNPCQuests(npc);
  modal.style.display = 'flex';

  // Special NPC actions
  const actionsContainer = document.getElementById('npc-actions');
  // Remove old extra buttons (keep close button)
  actionsContainer.querySelectorAll('.npc-action-extra').forEach(b => b.remove());

  if (npcId === 'joy_pokecenter') {
    const btnHeal = document.createElement('button');
    btnHeal.className = 'tma-btn npc-action-extra';
    btnHeal.style.backgroundColor = '#34c759';
    btnHeal.innerText = '🏥 Вылечить команду';
    btnHeal.onclick = () => {
      myTeam.forEach(mon => {
        const baseHp = mon.apiData.stats[0].base_stat;
        const curLvl = mon.baseLevel + mon.candiesEaten;
        mon.maxHp = Math.floor(0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl) + curLvl + 10;
        mon.currentHp = mon.maxHp;
        mon.status = null;
        mon.sleepTurns = 0;
        mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        if (mon.movesPP) mon.movesPP.forEach(pp => { if (pp) pp.current = pp.max; });
      });
      showToast('Ваша команда полностью вылечена!', false);
      modal.style.display = 'none';
      autoSave();
    };
    actionsContainer.insertBefore(btnHeal, document.getElementById('btn-close-npc'));
  }

  if (npcId === 'daycare_pokecenter') {
    const btnDeposit = document.createElement('button');
    btnDeposit.className = 'tma-btn npc-action-extra';
    btnDeposit.style.backgroundColor = '#5856d6';
    btnDeposit.innerText = '💻 Открыть PC';
    btnDeposit.onclick = () => {
      modal.style.display = 'none';
      openPC();
    };
    actionsContainer.insertBefore(btnDeposit, document.getElementById('btn-close-npc'));

    const btnDaycare = document.createElement('button');
    btnDaycare.className = 'tma-btn npc-action-extra';
    btnDaycare.style.backgroundColor = '#ff9500';
    btnDaycare.innerText = '🥚 Оставить в Питомнике';
    btnDaycare.onclick = () => {
      if (myTeam.length < 2) { showToast('Нужно минимум 2 покемона в команде!', true); return; }
      openDaycareDeposit();
      modal.style.display = 'none';
    };
    actionsContainer.insertBefore(btnDaycare, document.getElementById('btn-close-npc'));
  }

}

function renderNPCQuests(npc) {
  const container = document.getElementById('npc-quests');
  container.innerHTML = '';

  npc.quests.forEach(q => {
    if (completedNPCQuests.includes(q.id)) {
      const el = document.createElement('div');
      el.className = 'npc-quest-item';
      el.innerHTML = `<div class="npc-quest-info"><div class="npc-quest-name">✅ ${q.desc}</div></div>`;
      container.appendChild(el);
      return;
    }

    const prereqMet = !q.prereqQuest || completedNPCQuests.includes(q.prereqQuest);
    if (!prereqMet) return;

    const progress = npcQuestProgress[q.id] || 0;
    const isActive = q.id in npcQuestProgress;
    const isReady = progress >= q.targetQty;
    const pct = Math.min(100, Math.round((progress / q.targetQty) * 100));

    const el = document.createElement('div');
    el.className = 'npc-quest-item';
    el.innerHTML = `
      <div class="npc-quest-info">
        <div class="npc-quest-name">${q.desc}</div>
        <div class="npc-quest-reward">Награда: ${q.rewardMoney}💰 + ${q.rewardQty}x ${itemDef(q.rewardItem).nameRu}</div>
        ${isActive ? `<div class="npc-quest-progress">${progress}/${q.targetQty}</div><div class="npc-quest-bar"><div class="npc-quest-bar-fill" style="width:${pct}%"></div></div>` : ''}
      </div>`;

    const btn = document.createElement('button');
    btn.className = 'tma-btn';
    btn.style.padding = '4px 8px'; btn.style.fontSize = '0.8rem';

    if (!isActive) {
      btn.innerText = 'Взять';
      btn.onclick = () => {
        npcQuestProgress[q.id] = 0;
        document.getElementById('npc-dialog').innerText = npc.dialog.quest_incomplete;
        renderNPCQuests(npc);
        autoSave();
      };
    } else if (isReady) {
      btn.innerText = 'Сдать';
      btn.onclick = () => {
        // Tutorial quests: advance to next step
        if (q.id.startsWith('tutorial_')) {
          const step = parseInt(q.id.split('_')[1]);
          if (step === tutorialStep) {
            tutorialStep++;
            completedNPCQuests.push(q.id);
            delete npcQuestProgress[q.id];
            money += q.rewardMoney;
            addItem(q.rewardItem, q.rewardQty);
            addNotification('🎓 Обучение', `Шаг ${step} завершён! Награда: ${q.rewardMoney}💰 + ${q.rewardQty}x ${itemDef(q.rewardItem).nameRu}`);
            appendToLog(`Обучающий квест (шаг ${step}) выполнен!`, false, 'quest');
          }
        } else {
          for (let i = 0; i < q.targetQty; i++) removeItem(q.targetItem, 1);
          completedNPCQuests.push(q.id);
          delete npcQuestProgress[q.id];
          money += q.rewardMoney;
          addItem(q.rewardItem, q.rewardQty);
          appendToLog(`Квест "${q.desc}" выполнен!`, false, 'quest');
        }
        document.getElementById('npc-dialog').innerText = npc.dialog.quest_complete;
        updateMoneyDisplay();
        renderNPCQuests(npc);
        autoSave();
      };
    } else {
      btn.innerText = '...';
      btn.disabled = true;
    }

    el.appendChild(btn);
    container.appendChild(el);
  });
}

function checkTutorialProgress(type, amount, itemId) {
  if (tutorialStep < 1 || tutorialStep > 5) return;
  const questId = `tutorial_${tutorialStep}`;
  if (completedNPCQuests.includes(questId)) return;
  // Track progress for current tutorial step
  const quest = NPC_DATA['professor_tutorial']?.quests?.find(q => q.id === questId);
  if (!quest || quest.type !== type) return;
  if (!(questId in npcQuestProgress)) npcQuestProgress[questId] = 0;
  npcQuestProgress[questId] += amount;
  if (npcQuestProgress[questId] >= quest.targetQty) {
    npcQuestProgress[questId] = quest.targetQty;
    addNotification('📋 Квест!', `Обучающий квест (шаг ${tutorialStep}): задание выполнено! Вернитесь к Профессору Оуку.`);
  }
  autoSave();
}

function checkNPCQuestProgress(itemId, qty) {
  for (const [npcId, npc] of Object.entries(NPC_DATA)) {
    for (const q of npc.quests) {
      if (q.type === 'collect_items' && q.targetItem === itemId) {
        if (!completedNPCQuests.includes(q.id) && q.id in npcQuestProgress) {
          npcQuestProgress[q.id] += qty;
        }
      }
    }
  }
}

// --- LOCATION ENGINE ---
function renderLocation(locId) {
  currentLocationId = locId;
  updatePlayerLocation();
  const loc = getLocation(locId);
  if (!loc) return;
  currentRegion = getRegionOfLocation(locId);
  // Update header if on world view
  const headerTitle = document.getElementById('header-title');
  if (headerTitle && headerTitle.innerText.startsWith('Мир')) {
    headerTitle.innerText = `Мир (${REGIONS[currentRegion]?.name || ''})`;
  }

  document.getElementById('loc-name').innerText = loc.name;
  document.getElementById('loc-desc').innerText = loc.desc;
  const img = loc.image;
  const locImgEl = document.getElementById('loc-image');
  if (locImgEl) {
    if (img && img.length > 0) {
      const imgUrl = img.startsWith('http') ? img : (img.startsWith('/') ? img : '/' + img);
      locImgEl.style.backgroundImage = `url('${imgUrl}')`;
    } else {
      locImgEl.style.backgroundImage = 'none';
    }
  }

  // Region display
  const regionEl = document.getElementById('loc-region');
  if (regionEl) regionEl.innerText = REGIONS[currentRegion]?.name || '';

  // Weather display
  const weather = getDailyWeather(locId);
  const weatherEl = document.getElementById('loc-weather');
  if (weatherEl) {
    weatherEl.innerText = `${WEATHER_ICONS[weather]} ${WEATHER_NAMES[weather]}`;
  }

  updateTimeOfDay();
  const locNameEl = document.getElementById('loc-name');
  locNameEl.innerText = `${isDaytime ? '☀️' : '🌙'} ${loc.name}`;

  const actionsContainer = document.getElementById('loc-actions');
  actionsContainer.innerHTML = '';
  actionsContainer.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px';

  // Pokemarket — shop button
  if (locId.endsWith('_pokemarket') || locId === 'pokemarket') {
    const btnShop = document.createElement('button');
    btnShop.className = 'btn-use';
    btnShop.style.backgroundColor = '#ff9500';
    btnShop.innerText = '🛒 Магазин';
    btnShop.onclick = () => openShop();
    actionsContainer.appendChild(btnShop);
  }

  // Fishing button on water locations
  if (loc.hasWater && getBestRod()) {
    const btnFish = document.createElement('button');
    btnFish.className = 'btn-use';
    btnFish.style.backgroundColor = '#5ac8fa';
    btnFish.innerText = '🎣 Рыбачить';
    btnFish.onclick = () => showFishMenu();
    actionsContainer.appendChild(btnFish);
  }

  // Pokemon Center location
  if (locId === 'pokecenter' || locId.endsWith('_pokecenter')) {
    checkDaycare();

    const btnTrade = document.createElement('button');
    btnTrade.className = 'btn-use';
    btnTrade.style.backgroundColor = '#007aff';
    btnTrade.innerText = '🤝 Обменник (Игроки)';
    btnTrade.onclick = () => openTradeCenter();
    actionsContainer.appendChild(btnTrade);

    const btnHeal = document.createElement('button');
    btnHeal.className = 'btn-use';
    btnHeal.style.backgroundColor = '#34c759';
    btnHeal.innerText = '🏥 Вылечить команду';
    btnHeal.onclick = () => {
      if (myTeam.length === 0) { showToast('У вас нет покемонов!', true); return; }
      let healed = false;
      myTeam.forEach(mon => {
        if (!mon || !mon.apiData) return;
        const baseHp = mon.apiData.stats[0].base_stat;
        const curLvl = mon.baseLevel + mon.candiesEaten;
        const newMaxHp = Math.floor(0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl) + curLvl + 10;
        if (mon.currentHp < newMaxHp || mon.status || mon.maxHp !== newMaxHp) healed = true;
        mon.maxHp = newMaxHp;
        mon.currentHp = newMaxHp;
        mon.status = null;
        mon.sleepTurns = 0;
        mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        if (mon.movesPP) mon.movesPP.forEach(pp => { if (pp && pp.current < pp.max) { pp.current = pp.max; healed = true; } });
      });
      const msg = healed ? 'Сестра Джой вылечила всю команду!' : 'Все покемоны уже здоровы!';
      const descEl = document.getElementById('loc-desc');
      const oldText = descEl.innerText;
      descEl.innerText = msg;
      descEl.style.color = 'var(--tma-accent)';
      setTimeout(() => { descEl.innerText = oldText; descEl.style.color = ''; }, 2000);
      autoSave();
    };
    actionsContainer.appendChild(btnHeal);

    const btnPC = document.createElement('button');
    btnPC.className = 'btn-use';
    btnPC.style.backgroundColor = '#5856d6';
    btnPC.innerText = '💻 Терминал PC';
    btnPC.onclick = () => openPC();
    actionsContainer.appendChild(btnPC);

    if (daycareMons.length > 0) {
      const btnCollect = document.createElement('button');
      btnCollect.className = 'btn-use';
      btnCollect.style.backgroundColor = '#ff9500';
      btnCollect.innerText = `🐣 Забрать из Питомника (${daycareMons.length})`;
      btnCollect.onclick = () => collectDaycareMons();
      actionsContainer.appendChild(btnCollect);
    }
    if (daycareEgg && Date.now() >= daycareEgg.readyTime) {
      const btnEgg = document.createElement('button');
      btnEgg.className = 'btn-use';
      btnEgg.style.backgroundColor = '#ffcc00';
      btnEgg.style.color = '#000';
      btnEgg.innerText = '🥚 Забрать яйцо!';
      btnEgg.onclick = () => collectDaycareEgg();
      actionsContainer.appendChild(btnEgg);
    }
  }

  // Gym leader button
  if (gymLeaders[locId] && !badges.includes(gymLeaders[locId].badgeName)) {
    const btnGym = document.createElement('button');
    btnGym.className = 'btn-use';
    btnGym.style.backgroundColor = '#af52de';
    btnGym.innerText = `⚔ ${gymLeaders[locId].name} (${gymLeaders[locId].title})`;
    btnGym.onclick = () => openGymModal(locId);
    actionsContainer.appendChild(btnGym);
  }

  // Elite Four button
  if (locId === 'indigo_plateau' && badges.length >= 8) {
    const btnElite = document.createElement('button');
    btnElite.className = 'btn-use';
    btnElite.style.backgroundColor = '#ff3b30';
    btnElite.innerText = '🏆 Элитная Четверка';
    btnElite.onclick = () => openEliteModal();
    actionsContainer.appendChild(btnElite);
  }

  let huntEncounters = loc.encounters;
  if (loc.dayEncounters && isDaytime) huntEncounters = loc.dayEncounters;
  else if (loc.nightEncounters && !isDaytime) huntEncounters = loc.nightEncounters;

  // Fishing button for water locations
  if (loc.hasWater) {
    const rodBtns = [
      { id: 'oldRod', label: '🎣 Старая удочка', color: '#8B4513' },
      { id: 'goodRod', label: '🎣 Отличная удочка', color: '#4169E1' },
      { id: 'superRod', label: '🎣 Супер удочка', color: '#9370DB' },
    ];
    rodBtns.forEach(rod => {
      if (getItemQty(rod.id) > 0) {
        const btn = document.createElement('button');
        btn.className = 'btn-use';
        btn.style.backgroundColor = rod.color;
        btn.innerText = rod.label;
        btn.onclick = () => startFishing(rod.id);
        actionsContainer.appendChild(btn);
      }
    });
  }

  // Hunt persists across locations — tick handles empty encounter tables

  // NPC panel
  const npcPanel = document.getElementById('npc-panel');
  const npcButtons = document.getElementById('npc-buttons');
  npcButtons.innerHTML = '';
  npcButtons.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px';
  let npcsHere = Object.values(NPC_DATA).filter(n => n.location === locId);
  if (locId.endsWith('_pokecenter')) {
    const pcNpcs = Object.values(NPC_DATA).filter(n => n.location === 'pokecenter');
    npcsHere = [...npcsHere, ...pcNpcs];
  }
  if (npcsHere.length > 0) {
    npcPanel.style.display = 'block';
    npcsHere.forEach(npc => {
      const npcBtn = document.createElement('button');
      npcBtn.className = 'btn-nav';
      npcBtn.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px';
      npcBtn.innerHTML = `<span>${npc.sprite} ${npc.name}</span>`;
      npcBtn.onclick = () => openNPCDialog(npc.id);
      npcButtons.appendChild(npcBtn);
    });
  } else {
    npcPanel.style.display = 'none';
  }

  const navContainer = document.getElementById('nav-buttons');
  navContainer.innerHTML = '';
  navContainer.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px';

  // Split: external routes vs sub-locations
  const subLinks = [], extLinks = [];
  loc.links.forEach(linkId => {
    const linkLoc = getLocation(linkId);
    if (!linkLoc) return;
    if (linkId.startsWith(locId + '_')) subLinks.push({ id: linkId, loc: linkLoc });
    else extLinks.push({ id: linkId, loc: linkLoc });
  });

  extLinks.forEach(({ id: linkId, loc: linkLoc }) => {
    const btn = document.createElement('button');
    btn.className = 'btn-nav';
    btn.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px';
    btn.innerHTML = `<span>➔ ${linkLoc.name}</span>`;
    btn.onclick = () => {
      if (!visitedLocations.has(linkId)) { visitedLocations.add(linkId); checkQuestProgress('explore'); }
      renderLocation(linkId);
    };
    navContainer.appendChild(btn);
  });

  if (subLinks.length > 0) {
    const sep = document.createElement('div');
    sep.style.cssText = 'grid-column:1/-1;font-size:11px;color:#888;text-align:center;padding:4px 0 2px';
    sep.innerText = '🏙 В городе';
    navContainer.appendChild(sep);
    subLinks.forEach(({ id: linkId, loc: linkLoc }) => {
      const btn = document.createElement('button');
      btn.className = 'btn-nav';
      btn.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px;border-color:#555';
      btn.innerHTML = `<span>🏠 ${linkLoc.name}</span>`;
      btn.onclick = () => {
        if (!visitedLocations.has(linkId)) { visitedLocations.add(linkId); checkQuestProgress('explore'); }
        renderLocation(linkId);
      };
      navContainer.appendChild(btn);
    });
  }

  // Back from pokecenter
  if ((locId === 'pokecenter' || locId.endsWith('_pokecenter')) && lastLocation) {
    const backLoc = getLocation(lastLocation);
    if (backLoc) {
      const btnBack = document.createElement('button');
      btnBack.className = 'btn-nav';
      btnBack.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px;border-color:var(--tma-accent)';
      btnBack.innerHTML = `<span>↩ ${backLoc.name}</span>`;
      btnBack.onclick = () => {
        renderLocation(lastLocation);
        lastLocation = null;
      };
      navContainer.appendChild(btnBack);
    }
  }

  // Transport hub buttons (region travel)
  const hubs = TRANSPORT_HUBS[locId];
  if (hubs) {
    hubs.forEach(hub => {
      const btn = document.createElement('button');
      btn.className = 'btn-nav';
      btn.style.cssText = 'flex:0 0 auto;min-width:fit-content;padding:6px 10px;font-size:13px;border-color:var(--tma-accent)';
      btn.innerHTML = `<span>🎫 ${hub.label}</span>`;
      btn.onclick = () => travelToRegion(hub.targetRegion, hub.targetLoc, hub.ticket);
      navContainer.appendChild(btn);
    });
  }

  autoSave();
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

  // Nature modifier (non-HP stats only, player mons only)
  let natureMod = 1.0;
  if (statName !== 'hp' && !isWild && pokemon.natureIdx !== undefined) {
    const nature = natures[pokemon.natureIdx];
    if (nature) {
      if (nature.buff === mapName) natureMod = 1.1;
      else if (nature.nerf === mapName) natureMod = 0.9;
    }
  }

  let result;
  if (statName === 'hp') {
    result = Math.floor(0.01 * (2 * base + iv + Math.floor(0.25 * ev)) * level) + level + 10;
  } else {
    result = Math.floor((Math.floor((2 * base + iv + Math.floor(0.25 * ev)) * level / 100) + 5) * natureMod);
  }

  // Apply stat stages
  if (!isWild && pokemon.statStages) {
    const stageMapName = { 'hp': 'hp', 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' }[statName];
    if (stageMapName && pokemon.statStages[stageMapName] !== undefined) {
      const stage = pokemon.statStages[stageMapName];
      if (stage !== 0) {
        const stageMult = stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
        if (statName !== 'hp') {
          result = Math.floor(result * stageMult);
        }
      }
    }
  }

  // Choice item stat multipliers
  if (!isWild && pokemon.heldItem) {
    const choiceMap = { 'choiceBand': 'attack', 'choiceScarf': 'speed', 'choiceSpecs': 'special-attack' };
    if (choiceMap[pokemon.heldItem] === statName) {
      result = Math.floor(result * 1.5);
    }
    // thickClub: x2 Atk for Cubone/Marowak
    if (pokemon.heldItem === 'thickClub' && statName === 'attack') {
      const species = pokemon.apiData?.species?.name || pokemon.apiData?.name || '';
      if (species === 'cubone' || species === 'marowak') result = Math.floor(result * 2);
    }
    // eviolite: x1.5 Def/SpDef if can evolve
    if (pokemon.heldItem === 'eviolite' && (statName === 'defense' || statName === 'special-defense')) {
      if (pokemon.apiData?.species?.url) result = Math.floor(result * 1.5);
    }
    // assaultVest: x1.5 SpDef (status move restriction handled elsewhere)
    if (pokemon.heldItem === 'assaultVest' && statName === 'special-defense') {
      result = Math.floor(result * 1.5);
    }
  }

  return result;
}

function appendToLog(text, clear = false, type) {
  const logEl = document.getElementById('battle-log');
  if (clear) {
    logEl.innerHTML = '';
  }
  const p = document.createElement('p');
  p.innerText = text;
  if (type) p.className = 'chat-' + type;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

// --- ABILITY EFFECTS (Feature 2e) ---
function getAbilityName(pokemon, isWild) {
  if (isWild) return pokemon.abilities?.[0]?.ability?.name || null;
  return pokemon.abilityName || null;
}

function statStageModify(pokemon, stat, delta) {
  if (!pokemon.statStages) pokemon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  pokemon.statStages[stat] = Math.max(-6, Math.min(6, (pokemon.statStages[stat] || 0) + delta));
  updateStatBadges();
}

function updateStatBadges() {
  const labels = { atk: 'Атк', def: 'Защ', spa: 'САт', spd: 'СЗа', spe: 'Скр' };
  // Player badges
  const playerEl = document.getElementById('player-stat-badges');
  if (playerEl && activePlayerMon?.statStages) {
    playerEl.innerHTML = Object.entries(activePlayerMon.statStages)
      .filter(([_, v]) => v !== 0)
      .map(([k, v]) => {
        const sign = v > 0 ? '+' : '';
        return `<span class="stat-badge ${v > 0 ? 'positive' : 'negative'}">${labels[k] || k} ${sign}${v}</span>`;
      }).join('');
  }
  // Wild badges
  const wildEl = document.getElementById('wild-stat-badges');
  if (wildEl && activeWild?.statStages) {
    wildEl.innerHTML = Object.entries(activeWild.statStages || {})
      .filter(([_, v]) => v !== 0)
      .map(([k, v]) => {
        const sign = v > 0 ? '+' : '';
        return `<span class="stat-badge ${v > 0 ? 'positive' : 'negative'}">${labels[k] || k} ${sign}${v}</span>`;
      }).join('');
  }
}

// --- BERRIES (Feature 3) ---
function clearUsedItem(mon) {
  if (mon.berries && mon.heldItem) {
    mon.berries[mon.heldItem] = 0; // backward compat
  }
  mon.heldItem = null;
}

function checkBerryAutoUse(mon, isPlayer) {
  if (!mon || !mon.heldItem) return false;

  // Sitrus: HP < 50% -> +25% maxHP
  if (mon.heldItem === 'sitrusBerry' && mon.currentHp < mon.maxHp * 0.5) {
    const heal = Math.floor(mon.maxHp * 0.25);
    mon.currentHp = Math.min(mon.maxHp, mon.currentHp + heal);
    clearUsedItem(mon);
    if (isPlayer) updatePlayerHpUI();
    else updateWildHpUI();
    appendToLog(`${mon.apiData.name} восстановил HP с помощью Ситрус Ягоды! (+${heal} HP)`, false, 'heal');
    return true;
  }

  // Oran: HP < 50% -> +10 HP
  if (mon.heldItem === 'oranBerry' && mon.currentHp < mon.maxHp * 0.5) {
    mon.currentHp = Math.min(mon.maxHp, mon.currentHp + 10);
    clearUsedItem(mon);
    if (isPlayer) updatePlayerHpUI();
    else updateWildHpUI();
    appendToLog(`${mon.apiData.name} восстановил HP с помощью Оран Ягоды! (+10 HP)`, false, 'heal');
    return true;
  }

  // Lum: any status -> cure
  if (mon.heldItem === 'lumBerry' && mon.status) {
    cureStatus(mon);
    clearUsedItem(mon);
    if (isPlayer) document.getElementById('player-status-icon').innerText = '';
    else document.getElementById('wild-status-icon').innerText = '';
    appendToLog(`${mon.apiData.name} вылечился с помощью Лум Ягоды!`);
    return true;
  }

  // Chesto: sleep -> cure
  if (mon.heldItem === 'chestoBerry' && mon.status === 'slp') {
    cureStatus(mon);
    clearUsedItem(mon);
    if (isPlayer) document.getElementById('player-status-icon').innerText = '';
    else document.getElementById('wild-status-icon').innerText = '';
    appendToLog(`${mon.apiData.name} проснулся с помощью Често Ягоды!`);
    return true;
  }

  // Rawst: burn -> cure
  if (mon.heldItem === 'rawstBerry' && mon.status === 'brn') {
    cureStatus(mon);
    clearUsedItem(mon);
    if (isPlayer) document.getElementById('player-status-icon').innerText = '';
    else document.getElementById('wild-status-icon').innerText = '';
    appendToLog(`${mon.apiData.name} вылечил ожог с помощью Рост Ягоды!`);
    return true;
  }

  // Leftovers: +1/16 maxHP every turn
  // Note: this should be handled at the end of the turn, but for now we'll put it here if we want auto-use
  // Leftovers is not a berry, so it shouldn't be consumed. Wait, this function is for berries!
  // I will leave leftovers out for now until the battle engine has an end-of-turn event.

  return false;
}

function giveBerryToMon(berryType) {
  showToast('Пожалуйста, используйте экипировку (Держит) в профиле покемона для выдачи ягод и предметов!', true);
}

// --- QUESTS (Feature 5) ---
function generateDailyQuests() {
  const today = new Date().toISOString().slice(0, 10);
  const lastGen = localStorage.getItem(lsKey('quest_date'));
  if (lastGen === today && quests.length > 0) return;

  const shuffled = [...QUEST_CONFIGS].sort(() => Math.random() - 0.5);
  quests = shuffled.slice(0, 3).map(q => ({
    ...q,
    progress: 0,
    completed: false,
    claimed: false
  }));
  questProgress = {};
  quests.forEach(q => { questProgress[q.id] = 0; });
  localStorage.setItem(lsKey('quest_date'), today);
  autoSave();
}

function checkQuestProgress(type, amount, itemId) {
  if (amount === undefined) amount = 1;
  quests.forEach(q => {
    if (q.completed || q.claimed) return;
    if (q.type === type) {
      if (type === 'collect_items' && q.targetItem !== itemId) return;
      q.progress = Math.min(q.target, (q.progress || 0) + amount);
      questProgress[q.id] = q.progress;
      if (q.progress >= q.target) {
        q.completed = true;
        appendToLog(`Задание выполнено: ${q.desc}!`, false, 'quest');
      }
    }
  });
  // Also track tutorial quests
  checkTutorialProgress(type, amount, itemId);
}

function claimQuestReward(questId) {
  const q = quests.find(x => x.id === questId);
  if (!q || !q.completed || q.claimed) return showToast('Задание уже выполнено или недоступно!', true);
  q.claimed = true;
  money += q.rewardMoney;
  if (q.rewardItem) {
    addItem(q.rewardItem, q.rewardQty);
  }
  completedQuests.push({ id: questId, date: new Date().toISOString() });
  updateMoneyDisplay();
  updateInventoryDisplay();
  autoSave();
  showToast(`Награда получена: ¥${q.rewardMoney}${q.rewardItem ? ` + ${q.rewardQty}x ${q.rewardItem}` : ''}!`, false);
  renderQuests();
}

function openQuests() {
  const modal = document.getElementById('quest-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderQuests();
}

function renderQuests() {
  const list = document.getElementById('quest-list');
  if (!list) return;
  list.innerHTML = '';
  if (quests.length === 0) {
    list.innerHTML = '<div class="quest-empty">Нет активных заданий</div>';
    return;
  }
  quests.forEach(q => {
    const div = document.createElement('div');
    div.className = 'quest-card';
    const pct = q.target > 0 ? Math.round((q.progress / q.target) * 100) : 0;
    div.innerHTML = `
      <div class="quest-desc">${q.desc} (${q.progress}/${q.target})</div>
      <div class="quest-bar-bg"><div class="quest-bar-fill" style="width:${pct}%"></div></div>
      <div class="quest-reward">Награда: ¥${q.rewardMoney}${q.rewardItem ? ` + ${q.rewardQty}x ${q.rewardItem}` : ''}</div>
      ${q.completed && !q.claimed ? '<button class="btn-use quest-claim-btn" data-quest="'+q.id+'">Получить награду</button>' : ''}
      ${q.claimed ? '<span class="quest-claimed">Получено</span>' : ''}
      ${!q.completed ? '<span class="quest-progress">В процессе...</span>' : ''}
    `;
    list.appendChild(div);
  });

  list.querySelectorAll('.quest-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => claimQuestReward(btn.getAttribute('data-quest')));
  });
}

// --- STATUS EFFECTS (NEW) ---
const STATUS_ICONS = {
  psn: '☠️', brn: '🔥', par: '⚡', slp: '💤', frz: '❄️'
};
const STATUS_NAMES = {
  psn: 'Отравление', brn: 'Ожог', par: 'Паралич', slp: 'Сон', frz: 'Заморозка'
};

const evolutionCache = {};
const evolvesFromMap = {}; // reverse: species → [prevo names]

let POKEDEX_ALL = [];
let pokedexData = {};
let pokedexTotal = 0;

async function loadPokedexData() {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'pokedex_data.json');
    pokedexData = await res.json();
    POKEDEX_ALL = Object.keys(pokedexData);
    pokedexTotal = POKEDEX_ALL.length;
  } catch (e) {
    console.warn('Pokedex data load failed, using Kanto only', e);
    POKEDEX_ALL = ['bulbasaur','ivysaur','venusaur','charmander','charmeleon','charizard','squirtle','wartortle','blastoise','caterpie','metapod','butterfree','weedle','kakuna','beedrill','pidgey','pidgeotto','pidgeot','rattata','raticate','spearow','fearow','ekans','arbok','pikachu','raichu','sandshrew','sandslash','nidoran-f','nidorina','nidoqueen','nidoran-m','nidorino','nidoking','clefairy','clefable','vulpix','ninetales','jigglypuff','wigglytuff','zubat','golbat','oddish','gloom','vileplume','paras','parasect','venonat','venomoth','diglett','dugtrio','meowth','persian','psyduck','golduck','mankey','primeape','growlithe','arcanine','poliwag','poliwhirl','poliwrath','abra','kadabra','alakazam','machop','machoke','machamp','bellsprout','weepinbell','victreebel','tentacool','tentacruel','geodude','graveler','golem','ponyta','rapidash','slowpoke','slowbro','magnemite','magneton','farfetchd','doduo','dodrio','seel','dewgong','grimer','muk','shellder','cloyster','gastly','haunter','gengar','onix','drowzee','hypno','krabby','kingler','voltorb','electrode','exeggcute','exeggutor','cubone','marowak','hitmonlee','hitmonchan','lickitung','koffing','weezing','rhyhorn','rhydon','chansey','tangela','kangaskhan','horsea','seadra','goldeen','seaking','staryu','starmie','mr-mime','scyther','jynx','electabuzz','magmar','pinsir','tauros','magikarp','gyarados','lapras','ditto','eevee','vaporeon','jolteon','flareon','porygon','omanyte','omastar','kabuto','kabutops','aerodactyl','snorlax','articuno','zapdos','moltres','dratini','dragonair','dragonite','mewtwo','mew'];
    pokedexData = {};
    pokedexTotal = POKEDEX_ALL.length;
  }
}

let pokedexSeen = new Set();
let pokedexCaught = new Set();
let isDaytime = true;

function getStatusIcon(status) {
  return STATUS_ICONS[status] || '';
}

function applyStatusEffect(target, statusType) {
  if (target.status) return false; // already has a status
  target.status = statusType;
  if (statusType === 'slp') {
    target.sleepTurns = Math.floor(Math.random() * 3) + 1; // 1-3 turns
  }
  return true;
}

function cureStatus(target) {
  target.status = null;
  target.sleepTurns = 0;
}

function checkStatusTurn(target, isPlayer) {
  if (!target.status) return true; // can act normally

  if (target.status === 'slp') {
    target.sleepTurns--;
    if (target.sleepTurns <= 0) {
      cureStatus(target);
      appendToLog(`${isPlayer ? activePlayerMon.apiData.name : activeWild.name} проснулся!`, false, 'system');
      return true;
    } else {
      appendToLog(`${isPlayer ? activePlayerMon.apiData.name : activeWild.name} спит... (осталось ${target.sleepTurns} ходов)`, false, 'status');
      return false;
    }
  }

  if (target.status === 'frz') {
    if (Math.random() < 0.2) {
      cureStatus(target);
      appendToLog(`${isPlayer ? activePlayerMon.apiData.name : activeWild.name} оттаял!`, false, 'system');
      return true;
    } else {
      appendToLog(`${isPlayer ? activePlayerMon.apiData.name : activeWild.name} заморожен!`, false, 'status');
      return false;
    }
  }

  if (target.status === 'par') {
    if (Math.random() < 0.25) {
      appendToLog(`${isPlayer ? activePlayerMon.apiData.name : activeWild.name} парализован и не может двигаться!`, false, 'status');
      return false;
    }
    return true;
  }

  return true;
}

function applyStatusEndOfTurn(target, isPlayer) {
  if (!target.status) return;

  if (target.status === 'psn') {
    const dmg = Math.max(1, Math.floor((isPlayer ? activePlayerMon.maxHp : wildMaxHP) / 8));
    if (isPlayer) {
      activePlayerMon.currentHp -= dmg;
      if (activePlayerMon.currentHp < 0) activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
    } else {
      wildCurHP -= dmg;
      if (wildCurHP < 0) wildCurHP = 0;
      updateWildHpUI();
    }
    appendToLog(`${isPlayer ? activePlayerMon.apiData.name : activeWild.name} теряет HP от яда! (-${dmg} HP)`, false, 'dmg');
  }

  if (target.status === 'brn') {
    const dmg = Math.max(1, Math.floor((isPlayer ? activePlayerMon.maxHp : wildMaxHP) / 16));
    if (isPlayer) {
      activePlayerMon.currentHp -= dmg;
      if (activePlayerMon.currentHp < 0) activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
    } else {
      wildCurHP -= dmg;
      if (wildCurHP < 0) wildCurHP = 0;
      updateWildHpUI();
    }
    appendToLog(`${isPlayer ? activePlayerMon.apiData.name : activeWild.name} теряет HP от ожога! (-${dmg} HP)`, false, 'dmg');
  }
}

// --- SWITCH POKEMON ---
function switchPokemon() {
  const aliveMons = myTeam.filter((mon, i) => mon.currentHp > 0 && mon !== activePlayerMon);
  if (aliveMons.length === 0) { showToast('Нет других покемонов для смены!', true); return; }

  const items = aliveMons.map((m) => ({
    label: `Lv.${m.baseLevel + m.candiesEaten} ${m.name || m.apiData?.name}`,
    subtitle: `HP: ${m.currentHp}/${m.maxHp}`
  }));

  showSelectionModal('Выберите покемона', items, (idx) => {
    const newActive = aliveMons[idx];
    const oldActive = activePlayerMon;

    // Swap positions: put new active first
    const oldIdx = myTeam.indexOf(oldActive);
    const newIdx = myTeam.indexOf(newActive);
    myTeam[oldIdx] = newActive;
    myTeam[newIdx] = oldActive;
    activePlayerMon = newActive;

    // Clear choice lock
    delete activePlayerMon.choiceLockedMove;

    appendToLog(`${oldActive.name || oldActive.apiData?.name}, возвращайся! Вперёд, ${newActive.name || newActive.apiData?.name}!`, false, 'switch');

    // Rebuild player moves
    playerMovesDetailed = activePlayerMon.apiData?.moves?.filter(m => {
      const vgd = m.version_group_details;
      return vgd && vgd.length && activePlayerMon.movesPP?.some(pp => pp?.moveName === m.move.name);
    }) || [];

    // Update UI
    document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
    document.getElementById('player-sprite').src = playerSpriteUrl;
    document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);
    updatePlayerHpUI();

    // Enemy gets a turn after switch
    document.getElementById('battle-main-menu').style.display = 'none';
    setTimeout(() => { enemyTurn(); }, 1500);
  }, true);
}

// --- BATTLE SYSTEM ---
// Encounter weight multiplier (higher = more common). Default 1.0
const ENCOUNTER_WEIGHTS = {
  'pidgey': 2.0, 'rattata': 2.0, 'spearow': 1.8, 'zubat': 2.5,
  'caterpie': 2.2, 'weedle': 2.2, 'geodude': 1.5, 'machop': 1.3,
  'oddish': 1.8, 'bellsprout': 1.8, 'venonat': 1.5, 'paras': 1.4,
  'mankey': 1.2, 'diglett': 1.2, 'meowth': 1.5, 'psyduck': 1.3,
  'growlithe': 1.0, 'vulpix': 1.0, 'poliwag': 1.5, 'tentacool': 1.8,
  'slowpoke': 1.2, 'magnemite': 1.2, 'farfetchd': 0.5, 'doduo': 1.2,
  'seel': 1.0, 'shellder': 1.3, 'gastly': 0.8, 'onix': 0.6,
  'drowzee': 1.3, 'krabby': 1.5, 'voltorb': 1.2, 'exeggcute': 1.0,
  'cubone': 1.0, 'hitmonlee': 0.3, 'hitmonchan': 0.3, 'lickitung': 0.5,
  'koffing': 1.3, 'rhyhorn': 1.0, 'chansey': 0.1, 'tangela': 1.0,
  'kangaskhan': 0.15, 'horsea': 1.3, 'goldeen': 1.5, 'staryu': 1.3,
  'scyther': 0.4, 'jynx': 0.4, 'electabuzz': 0.4, 'magmar': 0.4,
  'pinsir': 0.4, 'tauros': 0.3, 'magikarp': 2.5,
  'lapras': 0.2, 'ditto': 0.3, 'eevee': 0.25,
  'porygon': 0.3, 'omanyte': 0.8, 'kabuto': 0.8,
  'aerodactyl': 0.1, 'snorlax': 0.1,
  'dratini': 0.1, 'dragonair': 0.05,
  'grimer': 1.2, 'muk': 0.4, 'weezing': 0.4,
  'haunter': 0.5, 'gengar': 0.05,
  'sentret': 2.0, 'hoothoot': 2.0, 'murkrow': 1.0,
  'spinarak': 1.5, 'chinchou': 1.3, 'mareep': 1.5,
  'sudowoodo': 0.5, 'aipom': 1.0, 'sunkern': 1.5,
  'yanma': 1.0, 'wooper': 1.5, 'misdreavus': 0.6,
  'wobbuffet': 0.5, 'girafarig': 0.8, 'pineco': 1.3,
  'dunsparce': 0.6, 'gligar': 0.8, 'snubbull': 1.5,
  'qwilfish': 1.0, 'shuckle': 0.3, 'heracross': 0.5,
  'sneasel': 0.6, 'teddiursa': 1.2, 'slugma': 1.3,
  'swinub': 1.3, 'corsola': 1.0, 'remoraid': 1.3,
  'delibird': 0.7, 'mantine': 0.7, 'skarmory': 0.4,
  'houndour': 1.0, 'phanpy': 1.2, 'stantler': 0.8,
  'smeargle': 0.4, 'tyrogue': 0.8, 'miltank': 0.5,
  'larvitar': 0.1, 'pupitar': 0.05,
  'poochyena': 2.0, 'zigzagoon': 2.0, 'wurmple': 2.2,
  'lotad': 1.5, 'seedot': 1.5, 'taillow': 2.0,
  'wingull': 2.0, 'ralts': 0.5, 'surskit': 1.3,
  'shroomish': 1.3, 'slakoth': 1.0, 'nincada': 1.2,
  'whismur': 1.8, 'makuhita': 1.3, 'azurill': 1.0,
  'nosepass': 0.8, 'skitty': 1.5, 'sableye': 0.4,
  'mawile': 0.4, 'aron': 1.2, 'meditite': 1.2,
  'electrike': 1.3, 'plusle': 1.0, 'minun': 1.0,
  'volbeat': 1.0, 'illumise': 1.0, 'roselia': 1.0,
  'gulpin': 1.3, 'carvanha': 1.2, 'wailmer': 1.0,
  'numel': 1.3, 'torkoal': 0.5, 'spoink': 1.3,
  'spinda': 1.0, 'trapinch': 0.8, 'cacnea': 1.3,
  'swablu': 1.3, 'zangoose': 0.8, 'seviper': 0.8,
  'lunatone': 0.5, 'solrock': 0.5, 'barboach': 1.3,
  'corphish': 1.3, 'baltoy': 1.0, 'lileep': 0.5,
  'anorith': 0.5, 'feebas': 0.3, 'castform': 0.6,
  'kecleon': 0.5, 'shuppet': 1.0, 'duskull': 1.0,
  'tropius': 0.8, 'chimecho': 0.4, 'absol': 0.3,
  'wynaut': 0.6, 'snorunt': 1.0, 'spheal': 1.3,
  'clamperl': 1.0, 'relicanth': 0.3, 'luvdisc': 1.3,
  'bagon': 0.15, 'shelgon': 0.05, 'combee': 1.2,
  'shellos': 1.5, 'buneary': 1.5, 'cottonee': 1.3,
  'petilil': 1.3, 'sandile': 1.2, 'trubbish': 1.5,
  'minccino': 1.5, 'swirlix': 1.0, 'pancham': 0.8,
  'pangoro': 0.3, 'tynamo': 0.8, 'golett': 0.5,
};

function pickWeightedEncounter(encountersArray) {
  const weights = encountersArray.map(name => ENCOUNTER_WEIGHTS[name] || 1.0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < encountersArray.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return encountersArray[i];
  }
  return encountersArray[encountersArray.length - 1];
}

function getWildLevel() {
  // Scale by region and location progression
  const loc = getLocation(currentLocationId);
  const name = (loc?.name || '').toLowerCase();
  const id = currentLocationId || '';
  // Victory Road / Indigo Plateau: 40-50
  if (id.includes('victory') || id.includes('indigo')) return Math.floor(Math.random() * 11) + 40;
  // Late-game Kanto routes: 30-40
  if (/route_(1[7-9]|2[0-1])/.test(id) || id.includes('cinnabar') || id.includes('seafoam')) return Math.floor(Math.random() * 11) + 30;
  // Mid-game: 20-30
  if (/route_(1[1-6])/.test(id) || id.includes('safari') || id.includes('fuchsia') || id.includes('lavender')) return Math.floor(Math.random() * 11) + 20;
  // Early-mid: 12-22
  if (/route_[6-9]|10/.test(id) || id.includes('saffron') || id.includes('celadon')) return Math.floor(Math.random() * 11) + 12;
  // Early: 8-16
  if (/route_[3-5]/.test(id) || id.includes('mt_moon') || id.includes('cerulean')) return Math.floor(Math.random() * 9) + 8;
  // Very early: 5-12
  if (/route_[1-2]|22/.test(id) || id.includes('viridian') || id.includes('forest')) return Math.floor(Math.random() * 8) + 5;
  // Starter area: 3-8
  if (id.includes('pallet')) return Math.floor(Math.random() * 6) + 3;
  // Default for other regions
  return Math.floor(Math.random() * 11) + 10;
}

function getLocationEncounters() {
  const loc = getLocation(currentLocationId);
  if (!loc) return [];
  let enc = loc.encounters || [];
  if (loc.dayEncounters && isDaytime) enc = loc.dayEncounters;
  else if (loc.nightEncounters && !isDaytime) enc = loc.nightEncounters;
  return enc;
}

function startAutoHunt() {
  const encounters = getLocationEncounters();
  if (encounters.length === 0) return;

  huntActive = true;
  try { localStorage.setItem(lsKey('hunt_active'), '1'); } catch(_) {}
  const btn = document.getElementById('btn-hunt-toggle');
  if (btn) {
    btn.classList.add('active');
    btn.title = 'Прекратить поиск';
  }

  const updateHuntBtn = () => {
    if (!btn || !huntActive) return;
    const enc = getLocationEncounters();
    if (enc.length > 0) {
      btn.innerHTML = '🔴';
      btn.style.background = '#ff3b30';
      btn.title = 'Прекратить поиск';
    } else {
      btn.innerHTML = '🟢';
      btn.style.background = '#34c759';
      btn.title = 'Поиск... (нет диких покемонов на этой локации)';
    }
  };
  updateHuntBtn();

  const doTick = () => {
    if (!huntActive) return;
    if (document.getElementById('encounter-modal')?.style.display === 'flex') {
      huntTimer = setTimeout(doTick, 2000);
      return;
    }
    if (document.getElementById('elite-modal')?.style.display === 'flex') {
      huntTimer = setTimeout(doTick, 2000);
      return;
    }
    const enc = getLocationEncounters();
    if (enc.length === 0) { updateHuntBtn(); huntTimer = setTimeout(doTick, 5000); return; }
    updateHuntBtn();
    // 20% base chance every tick
    if (Math.random() < 0.20) {
      const pkmName = pickWeightedEncounter(enc);
      startHunt([pkmName]);
      huntTimer = setTimeout(doTick, 3000);
    } else {
      const delay = 3000 + Math.random() * 5000;
      huntTimer = setTimeout(doTick, delay);
    }
  };

  huntTimer = setTimeout(doTick, 2000 + Math.random() * 3000);
}

function stopAutoHunt() {
  huntActive = false;
  try { localStorage.removeItem(lsKey('hunt_active')); } catch(_) {}
  if (huntTimer) { clearTimeout(huntTimer); huntTimer = null; }
  const btn = document.getElementById('btn-hunt-toggle');
  if (btn) {
    btn.innerHTML = '⚪';
    btn.classList.remove('active');
    btn.style.background = '';
    btn.title = 'Искать покемонов';
  }
}

// --- FISHING SYSTEM ---
const FISHING_TABLES = {
  oldRod: [
    { name: 'magikarp', minLvl: 5, maxLvl: 10, weight: 70 },
    { name: 'tentacool', minLvl: 5, maxLvl: 10, weight: 30 },
  ],
  goodRod: [
    { name: 'magikarp', minLvl: 10, maxLvl: 15, weight: 30 },
    { name: 'tentacool', minLvl: 10, maxLvl: 15, weight: 20 },
    { name: 'poliwag', minLvl: 10, maxLvl: 20, weight: 15 },
    { name: 'goldeen', minLvl: 10, maxLvl: 20, weight: 15 },
    { name: 'horsea', minLvl: 10, maxLvl: 20, weight: 10 },
    { name: 'shellder', minLvl: 10, maxLvl: 20, weight: 10 },
    { name: 'staryu', minLvl: 10, maxLvl: 20, weight: 10 },
    { name: 'krabby', minLvl: 10, maxLvl: 20, weight: 10 },
  ],
  superRod: [
    { name: 'magikarp', minLvl: 15, maxLvl: 25, weight: 20 },
    { name: 'tentacool', minLvl: 15, maxLvl: 25, weight: 15 },
    { name: 'poliwag', minLvl: 15, maxLvl: 30, weight: 10 },
    { name: 'goldeen', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'horsea', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'shellder', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'staryu', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'krabby', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'gyarados', minLvl: 20, maxLvl: 40, weight: 5 },
    { name: 'seaking', minLvl: 20, maxLvl: 35, weight: 5 },
    { name: 'seadra', minLvl: 20, maxLvl: 35, weight: 4 },
    { name: 'cloyster', minLvl: 25, maxLvl: 40, weight: 3 },
    { name: 'starmie', minLvl: 25, maxLvl: 40, weight: 3 },
    { name: 'kingler', minLvl: 25, maxLvl: 40, weight: 3 },
    { name: 'lapras', minLvl: 25, maxLvl: 40, weight: 2 },
    { name: 'dratini', minLvl: 15, maxLvl: 30, weight: 2 },
  ]
};

function getBestRod() {
  if (getItemQty('superRod') > 0) return 'superRod';
  if (getItemQty('goodRod') > 0) return 'goodRod';
  if (getItemQty('oldRod') > 0) return 'oldRod';
  return null;
}

function showFishMenu() {
  const rods = [];
  if (getItemQty('oldRod') > 0) rods.push('oldRod');
  if (getItemQty('goodRod') > 0) rods.push('goodRod');
  if (getItemQty('superRod') > 0) rods.push('superRod');
  if (rods.length === 0) return showToast('Нет удочек!', true);
  if (rods.length === 1) { startFishing(rods[0]); return; }
  const items = rods.map(r => ({ text: itemDef(r).nameRu, action: () => startFishing(r) }));
  showSelectionModal('🎣 Выберите удочку', items);
}

function getLocationHasWater() {
  const loc = getLocation(currentLocationId);
  return loc && loc.hasWater;
}

function startFishing(rodType) {
  if (!getLocationHasWater()) return showToast('Здесь негде рыбачить!', true);
  if (!myTeam.some(m => m.currentHp > 0)) return showToast('Вам нужен хотя бы один живой покемон!', true);

  const table = FISHING_TABLES[rodType];
  if (!table) return showToast('Неизвестная удочка!', true);

  if (rodType === 'superRod') {
    removeItem('superRod');
    updateInventoryDisplay();
  }

  const totalWeight = table.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let pick = table[0];
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) { pick = entry; break; }
  }

  const lvl = pick.minLvl + Math.floor(Math.random() * (pick.maxLvl - pick.minLvl + 1));

  const descEl = document.getElementById('loc-desc');
  const oldText = descEl.innerText;
  const rodNames = { oldRod: 'Старой удочкой', goodRod: 'Отличной удочкой', superRod: 'Супер удочкой' };
  descEl.innerText = `🎣 ${rodNames[rodType]}... Клюёт!`;
  descEl.style.color = 'var(--tma-accent)';
  setTimeout(() => {
    descEl.innerText = oldText;
    descEl.style.color = '';
  }, 2000);

  startHunt([{ name: pick.name, level: lvl }]);
}

async function startHunt(encountersArray) {
  itemsUsedInBattle = 0;
  battleRound = 0;
  const activeMonIndex = myTeam.findIndex(m => m.currentHp > 0);
  if (activeMonIndex === -1) {
    return showToast('Вам нужен хотя бы один живой покемон для битвы!', true);
  }

  battleType = 'wild';
  activePlayerMon = myTeam[activeMonIndex];
  activePlayerMon.choiceLockedMove = undefined;
  currentWeather = getDailyWeather(currentLocationId);

  const modal = document.getElementById('encounter-modal');
  const battleLog = document.getElementById('battle-log');

  document.getElementById('battle-main-menu').style.display = 'flex';
  document.getElementById('battle-end-menu').style.display = 'none';
  document.getElementById('battle-gym-info').style.display = 'none';
  appendToLog('Ищем...', true);
  modal.style.display = 'flex';

  const picked = encountersArray[Math.floor(Math.random() * encountersArray.length)];
  const pkmName = typeof picked === 'string' ? picked : picked.name;
  const presetLvl = typeof picked === 'object' ? picked.level : null;

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pkmName.toLowerCase()}`);
    activeWild = await res.json();
    pokedexSeen.add(activeWild.name);
    wildLvl = presetLvl || getWildLevel();
    wildStatus = null;
    wildSleepTurns = 0;
    activeWild.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    activeWild.isShiny = (Math.random() < 1/4096);

    // Fetch species data for catch rate & gender
    try {
      const speciesRes = await fetch(activeWild.species.url);
      const speciesData = await speciesRes.json();
      activeWild.captureRate = speciesData.capture_rate;
      activeWild.speciesData = speciesData;
      // Determine wild gender
      if (speciesData.gender_rate === -1) activeWild.wildGender = null; // genderless
      else if (speciesData.gender_rate === 0) activeWild.wildGender = 'male';
      else if (speciesData.gender_rate === 8) activeWild.wildGender = 'female';
      else activeWild.wildGender = Math.random() * 8 < speciesData.gender_rate ? 'female' : 'male';
    } catch (e) { /* keep defaults */ }

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

    // 5% chance wild pokemon holds a random berry
    activeWild.heldItem = Math.random() < 0.05
      ? ['sitrusBerry', 'oranBerry', 'lumBerry', 'chestoBerry', 'rawstBerry'][Math.floor(Math.random() * 5)]
      : null;
    activeWild.berries = activeWild.heldItem
      ? { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0, [activeWild.heldItem]: 1 }
      : { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };

    wildMovesDetailed = [];
    const movePromises = [];
    for (let i = 0; i < activeWild.moves.length && i < 20; i++) {
      movePromises.push(
        fetch(activeWild.moves[i].move.url).then(r => r.json()).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);
    wildMovesDetailed = moveResults.filter(m => m && m.power);
    wildMovesPP = wildMovesDetailed.map(m => ({ current: m.pp || 30, max: m.pp || 30 }));

    document.getElementById('wild-name').innerText = activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${wildLvl}`;
    const wildSpriteUrl = activeWild.sprites?.other?.['official-artwork']?.front_default || activeWild.sprites.front_default;
    document.getElementById('wild-sprite').src = wildSpriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('wild-status-icon').innerText = '';
    updateWildHpUI();

    document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
    document.getElementById('player-sprite').src = playerSpriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);
    updatePlayerHpUI();

    appendToLog(`Дикий ${activeWild.name.toUpperCase()} нападает!`, false, 'battle');
    appendToLog(`Погода: ${WEATHER_ICONS[currentWeather]} ${WEATHER_NAMES[currentWeather]}`, false, 'system');

    // Intimidate check
    const wildAbility = activeWild.abilities?.[0]?.ability?.name;
    if (wildAbility === 'intimidate') {
      statStageModify(activePlayerMon, 'atk', -1);
      appendToLog(`${activeWild.name} отпугивает ${activePlayerMon.apiData.name}! Атака снижена!`);
    }

    playerMovesDetailed = [];
    loadMoveButtons(activePlayerMon, useMove);

  } catch (e) {
    battleLog.innerText = 'Ошибка загрузки...';
    setTimeout(() => { modal.style.display = 'none'; }, 1000);
  }
}

function loadMoveButtons(activeMon, clickHandler) {
  playerMovesDetailed = [];
  for (let i = 0; i < 4; i++) {
    const mBtn = document.getElementById(`move-btn-${i}`);
    if (activeMon.apiData.moves[i]) {
      mBtn.innerText = '...';
      mBtn.classList.add('disabled');
      mBtn.onclick = null;
      const url = activeMon.apiData.moves[i].move.url;
      fetch(url)
        .then(r => r.json())
        .then(d => {
          playerMovesDetailed[i] = d;
          if (!activeMon.movesPP) activeMon.movesPP = [];
          if (!activeMon.movesPP[i]) {
            activeMon.movesPP[i] = { current: d.pp || 30, max: d.pp || 30 };
          }
          mBtn.innerText = activeMon.apiData.moves[i].move.name;
          mBtn.classList.remove('disabled');
          mBtn.onclick = () => clickHandler(i);
          updateMoveButtonUI(i, d);
        })
        .catch(() => {
          mBtn.innerText = activeMon.apiData.moves[i].move.name;
          mBtn.classList.remove('disabled');
          mBtn.onclick = () => clickHandler(i);
        });
    } else {
      mBtn.innerText = '-';
      mBtn.classList.add('disabled');
      mBtn.onclick = null;
    }
  }
}

function updateMoveButtonUI(index, moveData) {
  if (!activePlayerMon.movesPP || !activePlayerMon.movesPP[index]) return;
  const pp = activePlayerMon.movesPP[index];
  const mBtn = document.getElementById(`move-btn-${index}`);
  if (pp.current <= 0) {
    mBtn.innerText = `${moveData.name} (PP: 0/${pp.max})`;
    mBtn.classList.add('disabled');
  } else {
    mBtn.innerText = `${moveData.name} (PP: ${pp.current}/${pp.max})`;
  }
}

function updateMoveButtonUIs() {
  for (let i = 0; i < 4; i++) {
    if (playerMovesDetailed[i]) {
      updateMoveButtonUI(i, playerMovesDetailed[i]);
    }
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

async function useMove(moveIndex) {
  const move = playerMovesDetailed[moveIndex];
  if (!move) return;

  // Check PP
  if (activePlayerMon.movesPP && activePlayerMon.movesPP[moveIndex]) {
    if (activePlayerMon.movesPP[moveIndex].current <= 0) {
      appendToLog('Нет PP для этой атаки!');
      return;
    }
  }

  // Choice item move lock
  const choiceItems = ['choiceBand', 'choiceScarf', 'choiceSpecs'];
  if (choiceItems.includes(activePlayerMon.heldItem) && activePlayerMon.choiceLockedMove !== undefined && activePlayerMon.choiceLockedMove !== moveIndex) {
    appendToLog('Можно использовать только выбранную атаку!');
    return;
  }

  // Check player status before attacking (and before consuming PP)
  if (!checkStatusTurn(activePlayerMon, true)) {
    document.getElementById('battle-main-menu').style.display = 'none';
    // Apply end-of-turn status damage before enemy
    applyStatusEndOfTurn(activePlayerMon, true);
    if (activePlayerMon.currentHp <= 0) {
      appendToLog(`${activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      return;
    }
    if (wildCurHP <= 0) return;
    saveBattleState();
    setTimeout(() => { enemyTurn(); }, 1000);
    return;
  }

  // Decrement PP
  if (activePlayerMon.movesPP && activePlayerMon.movesPP[moveIndex]) {
    activePlayerMon.movesPP[moveIndex].current--;
  }

  // Choice item move lock
  if (choiceItems.includes(activePlayerMon.heldItem)) {
    activePlayerMon.choiceLockedMove = moveIndex;
  }

  appendToLog(`${activePlayerMon.apiData.name} использует ${move.name}!`);

  const power = move.power;
  if (!power) {
    // Assault Vest: can't use status moves
    if (activePlayerMon.heldItem === 'assaultVest') {
      appendToLog('Штурмовой жилет не позволяет использовать статус-атаки!');
      return;
    }
    // Status move - try apply status effect or stat change
    const ailment = move.meta?.ailment?.name;
    if (ailment && ailment !== 'none' && ailment !== 'unknown') {
      const statusMap = {
        'poison': 'psn', 'badly-poison': 'psn',
        'burn': 'brn', 'paralysis': 'par',
        'sleep': 'slp', 'freeze': 'frz'
      };
      const targetStatus = statusMap[ailment];
      if (targetStatus && !wildStatus) {
        if (applyStatusEffect(activeWild, targetStatus)) {
          wildStatus = activeWild.status;
          document.getElementById('wild-status-icon').innerText = getStatusIcon(wildStatus);
          appendToLog(`Дикий ${activeWild.name} получил ${STATUS_NAMES[targetStatus]}!`);
        }
      }
    }

    let appliedStat = false;
    if (move.stat_changes && move.stat_changes.length > 0) {
      const targetMap = { 'user': activePlayerMon, 'selected-pokemon': activeWild, 'all-opponents': activeWild };
      const moveTarget = move.target?.name || 'selected-pokemon';
      const affectedMon = targetMap[moveTarget] || activeWild;
      const monName = affectedMon === activePlayerMon ? activePlayerMon.apiData.name : activeWild.name;
      const statNameMap = { 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' };
      
      move.stat_changes.forEach(sc => {
        const statKey = statNameMap[sc.stat.name];
        if (statKey) {
          statStageModify(affectedMon, statKey, sc.change);
          const newStage = affectedMon.statStages[statKey];
          const sign = newStage >= 0 ? '+' : '';
          const dir = sc.change > 0 ? 'повышена' : 'понижена';
          const labels = { atk: 'Атака', def: 'Защита', spa: 'Сп. Атака', spd: 'Сп. Защита', spe: 'Скорость' };
          appendToLog(`${labels[statKey] || statKey} ${monName} ${dir} (${sign}${newStage})`, false, 'system');
          appliedStat = true;
        }
      });
    }

    if (!appliedStat && (!ailment || ailment === 'none' || ailment === 'unknown')) {
      appendToLog('Но ничего не произошло...');
    }
  } else {
    const isPhysical = move.damage_class.name === 'physical';
    const attackStat = isPhysical ? 'attack' : 'special-attack';
    const defenseStat = isPhysical ? 'defense' : 'special-defense';

    const A = calculateStat(activePlayerMon, attackStat, false);
    const D = calculateStat(activeWild, defenseStat, true);

    let burnAtkMod = 1.0;
    if (activePlayerMon.status === 'brn' && isPhysical) burnAtkMod = 0.5;

    const curLvl = activePlayerMon.baseLevel + activePlayerMon.candiesEaten;
    let baseDmg = Math.floor((((2 * curLvl / 5 + 2) * power * (A / D)) / 50) + 2);
    baseDmg = Math.floor(baseDmg * burnAtkMod);

    let stab = 1.0;
    activePlayerMon.apiData.types.forEach(t => {
      if (t.type.name === move.type.name) stab = 1.5;
    });

    const typeMult = getTypeMultiplier(move.type.name, activeWild.types);
    const weatherMult = getWeatherMultiplier(move.type.name, currentWeather);
    const randMod = 0.85 + Math.random() * 0.15;

    // Crit rate (base 6.25%, leek +2 stages = 50%)
    let critRate = 0.0625;
    if (activePlayerMon.heldItem === 'leek') {
      const species = activePlayerMon.apiData?.species?.name || '';
      if (species === 'farfetchd' || species === 'sirfetchd') critRate = 0.5;
    }
    const isCrit = Math.random() < critRate;
    const critMult = isCrit ? 1.5 : 1.0;

    // Air Balloon: ground immunity for wild
    let effTypeMult = typeMult;
    if (activeWild.heldItem === 'airBalloon' && move.type.name === 'ground') effTypeMult = 0;

    let heldMult = 1.0;
    // expertBelt: x1.2 on super-effective
    if (activePlayerMon.heldItem === 'expertBelt' && effTypeMult > 1) heldMult = 1.2;
    // lifeOrb: x1.3 damage
    if (activePlayerMon.heldItem === 'lifeOrb') heldMult = 1.3;

    let dmg = Math.floor(baseDmg * stab * effTypeMult * weatherMult * randMod * critMult * heldMult);

    if (isCrit) appendToLog('Критический удар!', false, 'dmg');

    // Focus Sash: survive at 1 HP (consumed on use)
    if (activeWild.heldItem === 'focusSash' && wildCurHP === wildMaxHP && dmg >= wildCurHP) {
      dmg = wildCurHP - 1;
      appendToLog(`${activeWild.name} держится благодаря Фокусному поясу!`);
      activeWild.heldItem = null;
    }

    wildCurHP -= dmg;
    if (wildCurHP < 0) wildCurHP = 0;

    // Big Root: x1.3 drain healing
    if (activePlayerMon.heldItem === 'bigRoot' && move.meta?.drain > 0) {
      const drainPct = move.meta.drain / 100;
      const heal = Math.floor(dmg * drainPct * 1.3);
      if (heal > 0) {
        activePlayerMon.currentHp = Math.min(activePlayerMon.maxHp, activePlayerMon.currentHp + heal);
        updatePlayerHpUI();
      }
    }

    // Life Orb recoil: -10% max HP
    if (activePlayerMon.heldItem === 'lifeOrb' && power) {
      const recoil = Math.max(1, Math.floor(activePlayerMon.maxHp / 10));
      activePlayerMon.currentHp -= recoil;
      if (activePlayerMon.currentHp < 0) activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
    }

    // Sturdy check: survive OHKO from full HP
    const wildAbil = activeWild.abilities?.[0]?.ability?.name;
    if (wildAbil === 'sturdy' && wildCurHP === 0 && dmg >= wildMaxHP) {
      wildCurHP = 1;
      appendToLog(`${activeWild.name} выдерживает удар благодаря Прочной Броне!`);
    }

    updateWildHpUI();

    appendToLog(`Нанесено ${dmg} урона!`, false, 'dmg');

    if (typeMult > 1) {
      appendToLog('Это суперэффективно!', false, 'eff');
    } else if (typeMult < 1 && typeMult > 0) {
      appendToLog('Это малоэффективно...');
    } else if (typeMult === 0) {
      appendToLog('Атака не возымела эффекта...');
    }

    // Apply secondary status effect from move
    if (move.meta && move.meta.ailment && move.meta.ailment.name !== 'none' && move.meta.ailment.name !== 'unknown') {
      const chance = move.meta.ailment_chance || 10;
      if (Math.random() * 100 < chance) {
        const statusMap = {
          'poison': 'psn', 'badly-poison': 'psn',
          'burn': 'brn', 'paralysis': 'par',
          'sleep': 'slp', 'freeze': 'frz'
        };
        const targetStatus = statusMap[move.meta.ailment.name];
        if (targetStatus && !wildStatus) {
          if (applyStatusEffect(activeWild, targetStatus)) {
            wildStatus = activeWild.status;
            document.getElementById('wild-status-icon').innerText = getStatusIcon(wildStatus);
            appendToLog(`Дикий ${activeWild.name} получил ${STATUS_NAMES[targetStatus]}!`);
          }
        }
      }
    }

    // Static / Flame Body / Poison Point: 30% on physical contact
    const wildAbilityContact = activeWild.abilities?.[0]?.ability?.name;
    if (power && isPhysical && ['static', 'flame-body', 'poison-point'].includes(wildAbilityContact)) {
      const statusMapAbility = { 'static': 'par', 'flame-body': 'brn', 'poison-point': 'psn' };
      if (!activePlayerMon.status && Math.random() < 0.3) {
        const st = statusMapAbility[wildAbilityContact];
        if (applyStatusEffect(activePlayerMon, st)) {
          document.getElementById('player-status-icon').innerText = getStatusIcon(st);
          appendToLog(`${activePlayerMon.apiData.name} получил ${STATUS_NAMES[st]} от способности ${activeWild.name}!`);
        }
      }
    }

    // Berry auto-use for wild
    if (wildCurHP > 0) checkBerryAutoUse(activeWild, false);

    // Rough Skin / Iron Barbs: 1/8 recoil on physical contact
    if (power && isPhysical && ['rough-skin', 'iron-barbs'].includes(wildAbilityContact)) {
      const recoil = Math.max(1, Math.floor(dmg / 8));
      activePlayerMon.currentHp -= recoil;
      if (activePlayerMon.currentHp < 0) activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
      appendToLog(`Шиповатое тело ${activeWild.name} ранит ${activePlayerMon.apiData.name}! (-${recoil} HP)`);
    }
  }

  document.getElementById('battle-main-menu').style.display = 'none';

  // Apply end-of-turn damage (poison/burn on player)
  applyStatusEndOfTurn(activePlayerMon, true);
  if (activePlayerMon.currentHp <= 0) {
    appendToLog(`${activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
    handlePlayerFaint();
    return;
  }

  if (wildCurHP <= 0) {
    applyStatusEndOfTurn(activeWild, false);
  }

  if (wildCurHP === 0) {
    appendToLog(`Дикий ${activeWild.name} побежден!`);
    checkQuestProgress('defeat_x');
    if (Math.random() < 0.10) { addItem('candy'); appendToLog('Вы нашли Сладкую Конфету!', false, 'quest'); }
    const dropResults = processMonsterDrop(activeWild.name);
    if (dropResults.length > 0) {
      const dropText = dropResults.map(d => `${d.qty}x ${itemDef(d.item).nameRu}`).join(', ');
      appendToLog(`Добыча: ${dropText}`, false, 'quest');
    }
    money += wildLvl * 15;
    checkQuestProgress('earn_money', wildLvl * 15);

    const baseExp = activeWild.base_experience || 50;
    let expGain = Math.floor((baseExp * wildLvl) / 7);

    // luckyEgg: x2.5 EXP for holder
    if (activePlayerMon.heldItem === 'luckyEgg') expGain = Math.floor(expGain * 2.5);

    if (activePlayerMon.exp === undefined) {
      activePlayerMon.exp = Math.pow(activePlayerMon.baseLevel, 3);
      activePlayerMon.expToNext = Math.pow(activePlayerMon.baseLevel + 1, 3);
    }

    const monLvl = activePlayerMon.baseLevel + (activePlayerMon.candiesEaten || 0);
    if (monLvl < 100) {
      activePlayerMon.exp += expGain;
      appendToLog(`${activePlayerMon.apiData.name} получил ${expGain} EXP!`);
    }

    // expShare: 50% EXP to non-active team members
    if (expShareActive) {
      const shareExp = Math.floor(expGain / 2);
      myTeam.forEach(mon => {
        if (mon !== activePlayerMon && mon.currentHp > 0 && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
          if (mon.exp === undefined) {
            mon.exp = Math.pow(mon.baseLevel, 3);
            mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
          }
          mon.exp += shareExp;
          while (mon.exp >= mon.expToNext && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
            mon.baseLevel++;
            mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
            const oldMax = mon.maxHp;
            const newMax = calculateStat(mon, 'hp', false);
            mon.maxHp = newMax;
            mon.currentHp += (newMax - oldMax);
          }
        }
      });
      if (shareExp > 0) appendToLog(`Остальная команда получила по ${shareExp} EXP!`);
    }

    while (activePlayerMon.exp >= activePlayerMon.expToNext && activePlayerMon.baseLevel < 100) {
      activePlayerMon.baseLevel++;
      activePlayerMon.expToNext = Math.pow(activePlayerMon.baseLevel + 1, 3);

      const oldMax = activePlayerMon.maxHp;
      const newMax = calculateStat(activePlayerMon, 'hp', false);
      activePlayerMon.maxHp = newMax;
      activePlayerMon.currentHp += (newMax - oldMax);

      appendToLog(`${activePlayerMon.apiData.name} достиг ${activePlayerMon.baseLevel} уровня!`);
      await checkNewMovesOnLevelUp(activePlayerMon, activePlayerMon.baseLevel);
    }

    const evoTarget = await checkEvolution(activePlayerMon);
    if (evoTarget) {
      await triggerEvolution(activePlayerMon, evoTarget.name);
      updatePlayerHpUI();
    }

    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    clearBattleState();
    updateInventoryDisplay();
    updateMoneyDisplay();
    autoSave();
  } else {
    setTimeout(() => { enemyTurn(); }, 1000);
  }
}

function handlePlayerFaint() {
  // Try next mon regardless of battle type
  const nextMon = myTeam.find(m => m.currentHp > 0 && m !== activePlayerMon);
  if (nextMon) {
    activePlayerMon = nextMon;
    activePlayerMon.choiceLockedMove = undefined;
    appendToLog(`${activePlayerMon.apiData.name}, вперёд!`);
    document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
    const spriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
    document.getElementById('player-sprite').src = spriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);
    updatePlayerHpUI();

    // Load moves for new mon
    const handler = battleType === 'wild' ? useMove : useMoveGym;
    loadMoveButtons(activePlayerMon, handler);

    saveBattleState();
    setTimeout(() => { document.getElementById('battle-main-menu').style.display = 'flex'; }, 1000);
    autoSave();
  } else {
    appendToLog('Вся команда потеряла сознание... Вы проиграли.');
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    clearBattleState();
    autoSave();
  }
}

function enemyTurn() {
  // Check wild status before attacking
  if (!checkStatusTurn(activeWild, false)) return;
  applyStatusEndOfTurn(activeWild, false);
  if (wildCurHP <= 0) {
    appendToLog(`Дикий ${activeWild.name} побежден!`);
    // Award EXP for status knockout
    const baseExp = wildLvl * 30;
    let expGain = Math.floor(baseExp / activePlayerMon.myTeam.filter(m => m.currentHp > 0).length);
    if (expShareActive) expGain = Math.floor(baseExp / activePlayerMon.myTeam.length);
    activePlayerMon.currentExp = (activePlayerMon.currentExp || 0) + expGain;
    if (activePlayerMon.currentExp >= (activePlayerMon.expToNext || 100)) {
      activePlayerMon.baseLevel++;
      activePlayerMon.currentExp -= activePlayerMon.expToNext;
      activePlayerMon.expToNext = Math.floor(activePlayerMon.expToNext * 1.2);
      appendToLog(`${activePlayerMon.apiData.name} достиг ${activePlayerMon.baseLevel} уровня!`);
    }
    checkQuestProgress('defeat_x');
    if (Math.random() < 0.10) { addItem('candy'); appendToLog('Вы нашли Сладкую Конфету!', false, 'quest'); }
    const dropResults = processMonsterDrop(activeWild.name);
    if (dropResults.length > 0) {
      const dropText = dropResults.map(d => `${d.qty}x ${itemDef(d.item).nameRu}`).join(', ');
      appendToLog(`Добыча: ${dropText}`, false, 'quest');
    }
    money += wildLvl * 15;
    checkQuestProgress('earn_money', wildLvl * 15);
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    clearBattleState();
    updateInventoryDisplay();
    updateMoneyDisplay();
    autoSave();
    return;
  }

  let chosenMove = null;
  let chosenIdx = -1;
  for (let attempt = 0; attempt < 20; attempt++) {
    const idx = Math.floor(Math.random() * wildMovesDetailed.length);
    if (wildMovesDetailed[idx] && wildMovesDetailed[idx].power) {
      // Check PP if tracking
      if (wildMovesPP && wildMovesPP[idx] && wildMovesPP[idx].current <= 0) continue;
      chosenMove = wildMovesDetailed[idx];
      chosenIdx = idx;
      break;
    }
  }
  if (!chosenMove) {
    chosenMove = { power: 30, damage_class: { name: 'physical' }, type: { name: 'normal' }, name: 'Атака' };
  }
  const enemyMoveName = chosenMove.name || 'Атака';
  // Decrement wild PP
  if (chosenIdx >= 0 && wildMovesPP && wildMovesPP[chosenIdx]) {
    wildMovesPP[chosenIdx].current--;
  }
  const power = chosenMove.power;
  const isPhysical = chosenMove.damage_class.name === 'physical';
  const attackStat = isPhysical ? 'attack' : 'special-attack';
  const defenseStat = isPhysical ? 'defense' : 'special-defense';

  const A = calculateStat(activeWild, attackStat, true);
  const D = calculateStat(activePlayerMon, defenseStat, false);

  let wildStab = 1.0;
  (activeWild.types || []).forEach(t => {
    if (t.type && t.type.name === chosenMove.type.name) wildStab = 1.5;
  });
  const wildTypeMult = getTypeMultiplier(chosenMove.type.name, activePlayerMon.apiData.types);
  const weatherMult = getWeatherMultiplier(chosenMove.type.name, currentWeather);

  // Air Balloon: ground immunity for player
  let wildEffTypeMult = wildTypeMult;
  if (activePlayerMon.heldItem === 'airBalloon' && chosenMove.type.name === 'ground') wildEffTypeMult = 0;

  let wildHeldMult = 1.0;
  if (activeWild.heldItem === 'expertBelt' && wildEffTypeMult > 1) wildHeldMult = 1.2;
  if (activeWild.heldItem === 'lifeOrb') wildHeldMult = 1.3;

  let baseDmg = Math.floor((((2 * wildLvl / 5 + 2) * power * (A / D)) / 50) + 2);
  let dmg = Math.floor(baseDmg * (0.85 + Math.random() * 0.15));

  const isCrit = Math.random() < 0.0625;
  const critMult = isCrit ? 1.5 : 1.0;

  dmg = Math.floor(dmg * wildStab * wildEffTypeMult * weatherMult * critMult * wildHeldMult);

  if (isCrit) appendToLog('Критический удар!', false, 'dmg');
  if (wildEffTypeMult > 1) {
    appendToLog('Это суперэффективно!', false, 'eff');
  } else if (wildEffTypeMult < 1 && wildEffTypeMult > 0) {
    appendToLog('Это малоэффективно...');
  } else if (wildEffTypeMult === 0) {
    appendToLog('Атака не возымела эффекта...');
  }

  // Focus Sash: player survives at 1 HP (consumed on use)
  if (activePlayerMon.heldItem === 'focusSash' && activePlayerMon.currentHp === activePlayerMon.maxHp && dmg >= activePlayerMon.currentHp) {
    dmg = activePlayerMon.currentHp - 1;
    appendToLog(`${activePlayerMon.apiData.name} держится благодаря Фокусному поясу!`);
    activePlayerMon.heldItem = null;
  }

  appendToLog(`Дикий ${activeWild.name} использует ${enemyMoveName}! (-${dmg} HP)`, false, 'dmg');
  activePlayerMon.currentHp -= dmg;
  if (activePlayerMon.currentHp < 0) activePlayerMon.currentHp = 0;
  updatePlayerHpUI();

  // Rocky Helmet: 1/6 max HP recoil on contact
  if (power && isPhysical && activePlayerMon.heldItem === 'rockyHelmet') {
    const recoil = Math.max(1, Math.floor(wildMaxHP / 6));
    wildCurHP -= recoil;
    if (wildCurHP < 0) wildCurHP = 0;
    updateWildHpUI();
    appendToLog(`Каменный шлем ${activePlayerMon.apiData.name} ранит ${activeWild.name}! (-${recoil} HP)`);
  }

  // Wild lifeOrb recoil
  if (activeWild.heldItem === 'lifeOrb' && power) {
    wildCurHP -= Math.max(1, Math.floor(wildMaxHP / 10));
    if (wildCurHP < 0) wildCurHP = 0;
    updateWildHpUI();
  }

  // Rough Skin / Iron Barbs: 1/8 recoil on physical contact (player has the ability)
  const playerAbility = getAbilityName(activePlayerMon, false);
  if (power && isPhysical && ['rough-skin', 'iron-barbs'].includes(playerAbility)) {
    const recoil = Math.max(1, Math.floor(dmg / 8));
    wildCurHP -= recoil;
    if (wildCurHP < 0) wildCurHP = 0;
    updateWildHpUI();
    appendToLog(`Шиповатое тело ${activePlayerMon.apiData.name} ранит ${activeWild.name}! (-${recoil} HP)`);
  }

  // Berry auto-use for player
  if (activePlayerMon.currentHp > 0) checkBerryAutoUse(activePlayerMon, true);


  if (activePlayerMon.currentHp === 0) {
    appendToLog(`${activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
    handlePlayerFaint();
  } else {
    applyStatusEndOfTurn(activePlayerMon, true);
    if (activePlayerMon.currentHp <= 0) {
      handlePlayerFaint();
      return;
    }
    battleRound++;
    // Leftovers end-of-turn healing
    if (activePlayerMon.heldItem === 'leftovers' && activePlayerMon.currentHp > 0 && activePlayerMon.currentHp < activePlayerMon.maxHp) {
      const heal = Math.max(1, Math.floor(activePlayerMon.maxHp / 16));
      activePlayerMon.currentHp = Math.min(activePlayerMon.maxHp, activePlayerMon.currentHp + heal);
      updatePlayerHpUI();
      appendToLog(`${activePlayerMon.apiData.name} восстанавливает HP от Объедков! (+${heal})`);
    }
    saveBattleState();
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex';
    }, 1000);
  }
}

function initEncounterEvents() {
  document.getElementById('btn-run').addEventListener('click', () => {
    if (battleType !== 'wild') {
      appendToLog('Нельзя сбежать от лидера!');
      return;
    }
    escapeAttempts++;
    const playerSpeed = calculateStat(activePlayerMon, 'speed', false);
    const wildSpeed = calculateStat(activeWild, 'speed', true);

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

  document.getElementById('btn-switch').addEventListener('click', () => {
    if (battleType === 'gym' || battleType === 'elite' || battleType === 'champion') {
      showToast('Нельзя сменить покемона в бою с лидером!', true);
      return;
    }
    switchPokemon();
  });

  document.getElementById('btn-use-item').addEventListener('click', () => {
    const item = document.getElementById('battle-item-select').value;

    const BALL_CONFIG = {};
    ITEMS.filter(i => i.isBall && i.implemented).forEach(i => {
      BALL_CONFIG[i.id] = {
        label: i.nameRu,
        mult: i.ballMult,
        qty: getItemQty(i.id),
        dec: () => removeItem(i.id),
      };
    });
    const ballCfg = BALL_CONFIG[item];
    if (ballCfg) {
      if (battleType !== 'wild') {
        return appendToLog('Нельзя ловить в бою с лидером!');
      }
      if (ballCfg.qty <= 0) return showToast(`У вас нет ${ballCfg.label}ов!`, true);
      // If team is full, will auto-send to PC box below

      ballCfg.dec();
      updateInventoryDisplay();

      const hpPct = wildCurHP / wildMaxHP;

      // Species catch rate (0-255, from PokeAPI or default 100)
      const speciesRate = activeWild.captureRate || activeWild.speciesData?.capture_rate || 100;
      // Standard formula: rate = (3*maxHP - 2*curHP) * rate / (3*maxHP) * ballBonus * statusBonus
      let catchRate = ((3 * wildMaxHP - 2 * wildCurHP) * speciesRate) / (3 * wildMaxHP);
      catchRate = catchRate * ballCfg.mult;

      // Status bonus
      if (wildStatus === 'slp' || wildStatus === 'frz') catchRate *= 2.5;
      else if (wildStatus === 'par' || wildStatus === 'brn' || wildStatus === 'psn') catchRate *= 1.5;

      // Ball special effects
      if (item === 'quickBall' && battleRound <= 1) catchRate *= 5;
      if (item === 'duskBall' && !isDaytime) catchRate *= 3;
      if (item === 'timerBall') catchRate *= 1 + battleRound * 0.3;

      // Love Ball: x8 if opposite gender
      if (item === 'loveBall') {
        const wildGender = activeWild.wildGender;
        const playerGender = activePlayerMon?.apiData?.gender || (Math.random() < 0.5 ? 'male' : 'female');
        if (wildGender && playerGender && wildGender !== playerGender) catchRate *= 8;
      }

      // Convert to probability (cap at 95%)
      let catchChance = Math.min(0.95, catchRate / 255);

      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы бросили ${ballCfg.label}...`);

      setTimeout(() => {
        if (Math.random() < catchChance) {
          appendToLog(`Попался! ${activeWild.name.toUpperCase()} пойман!`, false, 'catch');

          const newMon = {
            uid: generateUID(),
            originalTrainer: getTrainerId(),
            createdAt: Date.now(),
            caughtLocation: currentLocationId,
            isShiny: activeWild.isShiny || false,
            gender: activeWild.wildGender || null,
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
            breedLetter: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
            status: wildStatus || null,
            sleepTurns: wildSleepTurns || 0,
            movesPP: wildMovesPP ? wildMovesPP.map(pp => ({ current: pp.max, max: pp.max })) : [],
            statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            abilityName: activeWild.abilities[0]?.ability?.name || null,
            heldItem: null,
            berries: activeWild.berries || { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
            learnableMoves: []
          };

          // Friend Ball: set happiness to 200
          if (item === 'friendBall') {
            newMon.happiness = 200;
          }

          // DarkBall: +5 to all IVs (max 31)
          if (item === 'darkBall') {
            for (const s of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
              newMon.ivs[s] = Math.min(31, newMon.ivs[s] + 5);
            }
          }

          // Transfer held item from wild pokemon to inventory
          if (activeWild.heldItem) {
            const heldLabel = getHeldItemName(activeWild.heldItem);
            appendToLog(`Покемон держал ${heldLabel}! Передано в рюкзак.`, false, 'catch');
            addItem(activeWild.heldItem);
            updateInventoryDisplay();
          }

          if (myTeam.length < 6) {
            myTeam.push(newMon);
          } else {
            if (pcBoxes.length === 0) pcBoxes.push([]);
            pcBoxes[0].push(newMon);
            addNotification('📦 Покемон в PC', `${newMon.name || activeWild.name} отправлен в Бокс 1 (команда полна).`);
            appendToLog(`${newMon.name || activeWild.name} отправлен в PC (команда полна).`, false, 'catch');
          }
          pokedexCaught.add(activeWild.name);
          pokedexSeen.add(activeWild.name);

          checkQuestProgress('catch_x');

          document.getElementById('battle-main-menu').style.display = 'none';
          document.getElementById('battle-end-menu').style.display = 'flex';
          autoSave();
        } else {
          appendToLog(`${activeWild.name.toUpperCase()} вырвался!`);
          setTimeout(() => { enemyTurn(); }, 1500);
        }
      }, 1000);

    } else if (item === 'potion') {
      if (getItemQty('potion') <= 0) return showToast('У вас нет Аптечек!', true);
      if (activePlayerMon.currentHp >= activePlayerMon.maxHp) return showToast('Здоровье уже полное!', true);

      itemsUsedInBattle++;
      checkQuestProgress('use_item');
      removeItem('potion');
      updateInventoryDisplay();

      activePlayerMon.currentHp += 20;
      if (activePlayerMon.currentHp > activePlayerMon.maxHp) activePlayerMon.currentHp = activePlayerMon.maxHp;
      updatePlayerHpUI();

      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали Аптечку! Здоровье ${activePlayerMon.apiData.name} восстановлено.`);

      setTimeout(() => {
        if (battleType === 'wild') {
          enemyTurn();
        } else {
          enemyTurnGym();
        }
      }, 1500);
    } else if (item === 'superPotion') {
      if (getItemQty('superPotion') <= 0) return showToast('Нет Супер Аптечек!', true);
      if (activePlayerMon.currentHp >= activePlayerMon.maxHp) return showToast('Здоровье уже полное!', true);
      itemsUsedInBattle++;
      checkQuestProgress('use_item');
      removeItem('superPotion');
      updateInventoryDisplay();
      activePlayerMon.currentHp += 50;
      if (activePlayerMon.currentHp > activePlayerMon.maxHp) activePlayerMon.currentHp = activePlayerMon.maxHp;
      updatePlayerHpUI();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали Супер Аптечку! Здоровье ${activePlayerMon.apiData.name} восстановлено.`);
      setTimeout(() => {
        if (battleType === 'wild') { enemyTurn(); } else { enemyTurnGym(); }
      }, 1500);
    } else if (item === 'fullRestore') {
      if (getItemQty('fullRestore') <= 0) return showToast('Нет Полного Восстановления!', true);
      if (activePlayerMon.currentHp >= activePlayerMon.maxHp && !activePlayerMon.status) return showToast('Здоровье уже полное!', true);
      itemsUsedInBattle++;
      checkQuestProgress('use_item');
      removeItem('fullRestore');
      updateInventoryDisplay();
      activePlayerMon.currentHp = activePlayerMon.maxHp;
      cureStatus(activePlayerMon);
      document.getElementById('player-status-icon').innerText = '';
      updatePlayerHpUI();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали Полное Восстановление! ${activePlayerMon.apiData.name} полностью здоров!`);
      setTimeout(() => {
        if (battleType === 'wild') { enemyTurn(); } else { enemyTurnGym(); }
      }, 1500);
    } else if (item === 'evolutionStone') {
      if (getItemQty('evolutionStone') <= 0) return showToast('Нет Камней Эволюции!', true);
      (async () => {
        const evoTarget = await checkEvolution(activePlayerMon, true);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать!', true);
        itemsUsedInBattle++;
        checkQuestProgress('use_item');
        removeItem('evolutionStone');
        updateInventoryDisplay();
        await triggerEvolution(activePlayerMon, evoTarget.name);
        updatePlayerHpUI();
        document.getElementById('battle-main-menu').style.display = 'none';
        appendToLog(`${activePlayerMon.apiData.name} эволюционировал!`);
        setTimeout(() => {
          if (battleType === 'wild') { enemyTurn(); } else { enemyTurnGym(); }
        }, 1500);
      })();
    } else if (item === 'tm') {
      if (getItemQty('tm') <= 0) return showToast('Нет TM-совместимости!', true);
      showToast('Используйте TM из профиля покемона.', true);
    } else if (itemCategory(item) === 'statusCure') {
      const statusCureMap = {
        'antidote': 'psn', 'antiparalyze': 'par', 'energyDrink': 'slp',
        'fireExtinguisher': 'brn', 'antiSputin': null,
      };
      const targetStatus = statusCureMap[item];
      if (getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (item === 'healingHerb') {
        if (!activePlayerMon.status) return showToast('У покемона нет статуса!', true);
        removeItem(item);
        cureStatus(activePlayerMon);
        document.getElementById('player-status-icon').innerText = '';
      } else if (targetStatus) {
        if (activePlayerMon.status !== targetStatus) return showToast('Этот предмет не лечит текущий статус!', true);
        removeItem(item);
        cureStatus(activePlayerMon);
        document.getElementById('player-status-icon').innerText = '';
      } else {
        return showToast('Этот предмет пока не работает в бою.', true);
      }
      itemsUsedInBattle++;
      checkQuestProgress('use_item');
      updateInventoryDisplay();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали ${itemDef(item).nameRu}! Статус ${activePlayerMon.apiData.name} исцелён.`);
      setTimeout(() => {
        if (battleType === 'wild') { enemyTurn(); } else { enemyTurnGym(); }
      }, 1500);
    } else if (['weakElixir', 'elixir', 'strongElixir'].includes(item)) {
      const elixirMap = { 'weakElixir': 10, 'elixir': 20, 'strongElixir': 40 };
      const ppRestore = elixirMap[item];
      if (getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (!activePlayerMon.movesPP || activePlayerMon.movesPP.every(pp => pp && pp.current >= pp.max)) {
        return showToast('PP уже полностью!', true);
      }
      removeItem(item);
      itemsUsedInBattle++;
      checkQuestProgress('use_item');
      updateInventoryDisplay();
      for (let i = 0; i < 4; i++) {
        if (activePlayerMon.movesPP && activePlayerMon.movesPP[i]) {
          activePlayerMon.movesPP[i].current = Math.min(
            activePlayerMon.movesPP[i].max,
            activePlayerMon.movesPP[i].current + ppRestore
          );
        }
      }
      updateMoveButtonUIs();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали ${itemDef(item).nameRu}! PP восстановлено.`);
      setTimeout(() => {
        if (battleType === 'wild') { enemyTurn(); } else { enemyTurnGym(); }
      }, 1500);
    } else if (['xAttack', 'xDefense', 'xSpDefense', 'xSpAttack', 'xSpeed', 'xAccuracy'].includes(item)) {
      const xMap = { 'xAttack': 'atk', 'xDefense': 'def', 'xSpDefense': 'spd', 'xSpAttack': 'spa', 'xSpeed': 'spe', 'xAccuracy': null };
      const stat = xMap[item];
      if (getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (stat) {
        if (!activePlayerMon.statStages) activePlayerMon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        if (activePlayerMon.statStages[stat] >= 6) return showToast('Стат уже максимально повышен!', true);
        removeItem(item);
        itemsUsedInBattle++;
        checkQuestProgress('use_item');
        updateInventoryDisplay();
        statStageModify(activePlayerMon, stat, 1);
        document.getElementById('battle-main-menu').style.display = 'none';
        appendToLog(`Вы использовали ${itemDef(item).nameRu}! ${stat.toUpperCase()} повышен!`);
        setTimeout(() => {
          if (battleType === 'wild') { enemyTurn(); } else { enemyTurnGym(); }
        }, 1500);
      } else {
        return showToast('Этот предмет пока не работает в бою.', true);
      }
    } else if (itemCategory(item) === 'evolutionStones' && item !== 'evolutionStone') {
      if (getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      (async () => {
        const evoTarget = await checkEvolution(activePlayerMon, true, item);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать с этим камнем!', true);
        itemsUsedInBattle++;
        checkQuestProgress('use_item');
        removeItem(item);
        updateInventoryDisplay();
        await triggerEvolution(activePlayerMon, evoTarget.name);
        updatePlayerHpUI();
        document.getElementById('battle-main-menu').style.display = 'none';
        appendToLog(`${activePlayerMon.apiData.name} эволюционировал!`);
        setTimeout(() => {
          if (battleType === 'wild') { enemyTurn(); } else { enemyTurnGym(); }
        }, 1500);
      })();
    }
  });

  document.getElementById('btn-leave-battle').addEventListener('click', () => {
    document.getElementById('encounter-modal').style.display = 'none';
    clearBattleState();
    gymTeamIndex = 0;
    gymTeamIndexInMember = 0;
    gymTeamData = null;
    battleType = 'wild';
    battleRound = 0;
    wildMovesPP = null;
    if (activePlayerMon) activePlayerMon.choiceLockedMove = undefined;
    // Clear all team stat stages, status effects, and battle state after battle
    myTeam.forEach(m => {
      m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      m.choiceLockedMove = undefined;
      m.status = null;
      m.sleepTurns = 0;
    });
    // Clear stat badges
    document.getElementById('player-stat-badges').innerHTML = '';
    document.getElementById('wild-stat-badges').innerHTML = '';
  });
}

// --- GYM BATTLE SYSTEM (NEW) ---
function openGymModal(locId) {
  const leader = gymLeaders[locId];
  const modal = document.getElementById('gym-modal');
  document.getElementById('gym-leader-name').innerText = leader.name;
  document.getElementById('gym-leader-title').innerText = leader.title;
  document.getElementById('gym-leader-type').innerText = `Тип: ${leader.type}`;
  document.getElementById('gym-reward').innerText = `Награда: ${leader.badgeName} + ¥${leader.moneyReward}`;

  const teamList = document.getElementById('gym-team-list');
  teamList.innerHTML = '';
  leader.team.forEach((member, i) => {
    const li = document.createElement('li');
    li.innerText = `${member.name} Lv${member.level}`;
    teamList.appendChild(li);
  });

  modal.style.display = 'flex';
  document.getElementById('btn-start-gym-battle').onclick = () => {
    modal.style.display = 'none';
    startGymBattle(locId);
  };
}

document.getElementById('btn-close-gym-modal').addEventListener('click', () => {
  document.getElementById('gym-modal').style.display = 'none';
});

function initGymEvents() {
  document.getElementById('btn-close-gym-modal').addEventListener('click', () => {
    document.getElementById('gym-modal').style.display = 'none';
  });
  document.getElementById('btn-close-elite-modal').addEventListener('click', () => {
    document.getElementById('elite-modal').style.display = 'none';
  });
}

async function startGymBattle(locId) {
  itemsUsedInBattle = 0;
  battleRound = 0;
  const leader = gymLeaders[locId];
  const activeMonIndex = myTeam.findIndex(m => m.currentHp > 0);
  if (activeMonIndex === -1) {
    return showToast('Вам нужен хотя бы один живой покемон для битвы!', true);
  }

  battleType = 'gym';
  gymLeaderKey = locId;
  gymTeamIndex = 0;
  gymTeamData = JSON.parse(JSON.stringify(leader.team)); // clone

  activePlayerMon = myTeam[activeMonIndex];
  activePlayerMon.choiceLockedMove = undefined;

  document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
  document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
  const playerSpriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
  document.getElementById('player-sprite').src = playerSpriteUrl;
  updateBattleSpriteBgs();
  document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);

  const modal = document.getElementById('encounter-modal');
  document.getElementById('battle-main-menu').style.display = 'flex';
  document.getElementById('battle-end-menu').style.display = 'none';
  document.getElementById('battle-gym-info').style.display = 'block';
  document.getElementById('gym-leader-battle-name').innerText = `Лидер: ${leader.name}`;
  appendToLog(`Вызов лидера ${leader.name}!`, true);
  modal.style.display = 'flex';

  await startGymNextPokemon();
}

async function startGymNextPokemon() {
  if (gymTeamIndex >= gymTeamData.length) {
    // Won the gym battle!
    const leader = gymLeaders[gymLeaderKey];
    badges.push(leader.badgeName);
    money += leader.moneyReward;
    checkQuestProgress('earn_money', leader.moneyReward);
    appendToLog(`Победа! Вы получили ${leader.badgeName} и ¥${leader.moneyReward}!`);
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    updateMoneyDisplay();
    updateBadgeDisplay();
    autoSave();
    return;
  }

  const member = gymTeamData[gymTeamIndex];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${member.name.replace('_2', '')}`);
    activeWild = await res.json();
    wildLvl = member.level;
    wildStatus = null;
    wildSleepTurns = 0;
    currentWeather = getDailyWeather(currentLocationId);

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

    wildMovesDetailed = [];
    const movePromises = [];
    for (let i = 0; i < activeWild.moves.length && i < 20; i++) {
      movePromises.push(
        fetch(activeWild.moves[i].move.url).then(r => r.json()).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);
    wildMovesDetailed = moveResults.filter(m => m && m.power);
    wildMovesPP = wildMovesDetailed.map(m => ({ current: m.pp || 30, max: m.pp || 30 }));

    document.getElementById('wild-name').innerText = activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${wildLvl}`;
    const wildSpriteUrl = activeWild.sprites?.other?.['official-artwork']?.front_default || activeWild.sprites.front_default;
    document.getElementById('wild-sprite').src = wildSpriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('wild-status-icon').innerText = '';
    updateWildHpUI();

    appendToLog(`${gymLeaders[gymLeaderKey].name} выпускает ${activeWild.name}! (${gymTeamIndex + 1}/${gymTeamData.length})`);

    // Intimidate check
    const wildAbility = activeWild.abilities?.[0]?.ability?.name;
    if (wildAbility === 'intimidate') {
      statStageModify(activePlayerMon, 'atk', -1);
      appendToLog(`${activeWild.name} отпугивает ${activePlayerMon.apiData.name}! Атака снижена!`);
    }

    // Set up player moves
    loadMoveButtons(activePlayerMon, useMoveGym);

  } catch (e) {
    appendToLog('Ошибка загрузки покемона лидера...');
  }
  // Show the battle menu so player can attack next wild pokemon
  document.getElementById('battle-main-menu').style.display = 'flex';
}

async function useMoveGym(moveIndex) {
  const move = playerMovesDetailed[moveIndex];
  if (!move) return;

  if (activePlayerMon.movesPP && activePlayerMon.movesPP[moveIndex]) {
    if (activePlayerMon.movesPP[moveIndex].current <= 0) {
      appendToLog('Нет PP для этой атаки!');
      return;
    }
    activePlayerMon.movesPP[moveIndex].current--;
  }

  // Choice item move lock
  const choiceItems = ['choiceBand', 'choiceScarf', 'choiceSpecs'];
  if (choiceItems.includes(activePlayerMon.heldItem) && activePlayerMon.choiceLockedMove !== undefined && activePlayerMon.choiceLockedMove !== moveIndex) {
    appendToLog('Можно использовать только выбранную атаку!');
    return;
  }

  if (!checkStatusTurn(activePlayerMon, true)) {
    document.getElementById('battle-main-menu').style.display = 'none';
    applyStatusEndOfTurn(activePlayerMon, true);
    if (activePlayerMon.currentHp <= 0) {
      handleGymPlayerFaint();
      return;
    }
    if (wildCurHP <= 0) return;
    setTimeout(() => { enemyTurnGym(); }, 1000);
    return;
  }

  appendToLog(`${activePlayerMon.apiData.name} использует ${move.name}!`);

  const power = move.power;
  if (!power) {
    const ailment = move.meta?.ailment?.name;
    if (ailment && ailment !== 'none' && ailment !== 'unknown') {
      const statusMap = { 'poison': 'psn', 'badly-poison': 'psn', 'burn': 'brn', 'paralysis': 'par', 'sleep': 'slp', 'freeze': 'frz' };
      const targetStatus = statusMap[ailment];
      if (targetStatus && !wildStatus) {
        if (applyStatusEffect(activeWild, targetStatus)) {
          wildStatus = activeWild.status;
          document.getElementById('wild-status-icon').innerText = getStatusIcon(wildStatus);
          appendToLog(`${activeWild.name} получил ${STATUS_NAMES[targetStatus]}!`);
        }
      }
    }
    // Stat changes for non-damaging moves in gym battles
    const statChanges = move.stat_changes || [];
    for (const sc of statChanges) {
      const change = sc.change;
      const statName = sc.stat.name;
      const statMap = { 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' };
      const short = statMap[statName];
      if (short) {
        if (change > 0) statStageModify(activePlayerMon, short, change);
        else statStageModify(activeWild, short, change);
      }
    }
    appendToLog('Но ничего не произошло...');
  } else {
    const isPhysical = move.damage_class.name === 'physical';
    const attackStat = isPhysical ? 'attack' : 'special-attack';
    const defenseStat = isPhysical ? 'defense' : 'special-defense';

    const A = calculateStat(activePlayerMon, attackStat, false);
    const D = calculateStat(activeWild, defenseStat, true);

    let burnAtkMod = 1.0;
    if (activePlayerMon.status === 'brn' && isPhysical) burnAtkMod = 0.5;

    const curLvl = activePlayerMon.baseLevel + activePlayerMon.candiesEaten;
    let baseDmg = Math.floor((((2 * curLvl / 5 + 2) * power * (A / D)) / 50) + 2);
    baseDmg = Math.floor(baseDmg * burnAtkMod);

    let stab = 1.0;
    activePlayerMon.apiData.types.forEach(t => {
      if (t.type.name === move.type.name) stab = 1.5;
    });

    const typeMult = getTypeMultiplier(move.type.name, activeWild.types);
    const weatherMult = getWeatherMultiplier(move.type.name, currentWeather);
    const randMod = 0.85 + Math.random() * 0.15;
    let dmg = Math.floor(baseDmg * stab * typeMult * weatherMult * randMod);

    wildCurHP -= dmg;
    if (wildCurHP < 0) wildCurHP = 0;

    // Sturdy check
    const wildAbil = activeWild.abilities?.[0]?.ability?.name;
    if (wildAbil === 'sturdy' && wildCurHP === 0 && dmg >= wildMaxHP) {
      wildCurHP = 1;
      appendToLog(`${activeWild.name} выдерживает удар благодаря Прочной Броне!`);
    }

    updateWildHpUI();

    appendToLog(`Нанесено ${dmg} урона!`, false, 'dmg');

    if (typeMult > 1) appendToLog('Это суперэффективно!', false, 'eff');
    else if (typeMult < 1 && typeMult > 0) appendToLog('Это малоэффективно...');
    else if (typeMult === 0) appendToLog('Атака не возымела эффекта...');

    if (move.meta && move.meta.ailment && move.meta.ailment.name !== 'none' && move.meta.ailment.name !== 'unknown') {
      const chance = move.meta.ailment_chance || 10;
      if (Math.random() * 100 < chance) {
        const statusMap = { 'poison': 'psn', 'badly-poison': 'psn', 'burn': 'brn', 'paralysis': 'par', 'sleep': 'slp', 'freeze': 'frz' };
        const targetStatus = statusMap[move.meta.ailment.name];
        if (targetStatus && !wildStatus) {
          if (applyStatusEffect(activeWild, targetStatus)) {
            wildStatus = activeWild.status;
            document.getElementById('wild-status-icon').innerText = getStatusIcon(wildStatus);
            appendToLog(`${activeWild.name} получил ${STATUS_NAMES[targetStatus]}!`);
          }
        }
      }
    }

    // Static / Flame Body / Poison Point: 30% on physical contact
    const wildAbilityContact = activeWild.abilities?.[0]?.ability?.name;
    if (power && isPhysical && ['static', 'flame-body', 'poison-point'].includes(wildAbilityContact)) {
      const statusMapAbility = { 'static': 'par', 'flame-body': 'brn', 'poison-point': 'psn' };
      if (!activePlayerMon.status && Math.random() < 0.3) {
        const st = statusMapAbility[wildAbilityContact];
        if (applyStatusEffect(activePlayerMon, st)) {
          document.getElementById('player-status-icon').innerText = getStatusIcon(st);
          appendToLog(`${activePlayerMon.apiData.name} получил ${STATUS_NAMES[st]} от способности ${activeWild.name}!`);
        }
      }
    }

    // Berry auto-use for wild
    if (wildCurHP > 0) checkBerryAutoUse(activeWild, false);

    // Rough Skin / Iron Barbs: 1/8 recoil on physical contact
    if (power && isPhysical && ['rough-skin', 'iron-barbs'].includes(wildAbilityContact)) {
      const recoil = Math.max(1, Math.floor(dmg / 8));
      activePlayerMon.currentHp -= recoil;
      if (activePlayerMon.currentHp < 0) activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
      appendToLog(`Шиповатое тело ${activeWild.name} ранит ${activePlayerMon.apiData.name}! (-${recoil} HP)`);
    }
  }

  document.getElementById('battle-main-menu').style.display = 'none';

  applyStatusEndOfTurn(activePlayerMon, true);
  if (activePlayerMon.currentHp <= 0) {
    handleGymPlayerFaint();
    return;
  }

  if (wildCurHP === 0) {
    appendToLog(`${activeWild.name} побежден!`);

    if (battleType === 'gym') {
      gymTeamIndex++;
    } else {
      gymTeamIndexInMember++;
    }

    const baseExp = activeWild.base_experience || 50;
    let expGain = Math.floor((baseExp * wildLvl) / 7);
    if (activePlayerMon.heldItem === 'luckyEgg') expGain = Math.floor(expGain * 2.5);

    if (activePlayerMon.exp === undefined) {
      activePlayerMon.exp = Math.pow(activePlayerMon.baseLevel, 3);
      activePlayerMon.expToNext = Math.pow(activePlayerMon.baseLevel + 1, 3);
    }
    const mLvl = activePlayerMon.baseLevel + (activePlayerMon.candiesEaten || 0);
    if (mLvl < 100) {
      activePlayerMon.exp += expGain;
      appendToLog(`${activePlayerMon.apiData.name} получил ${expGain} EXP!`);
    }

    if (expShareActive) {
      const shareExp = Math.floor(expGain / 2);
      myTeam.forEach(mon => {
        if (mon !== activePlayerMon && mon.currentHp > 0 && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
          if (mon.exp === undefined) {
            mon.exp = Math.pow(mon.baseLevel, 3);
            mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
          }
          mon.exp += shareExp;
          while (mon.exp >= mon.expToNext && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
            mon.baseLevel++;
            mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
            const om = mon.maxHp;
            mon.maxHp = calculateStat(mon, 'hp', false);
            mon.currentHp += (mon.maxHp - om);
          }
        }
      });
      if (shareExp > 0) appendToLog(`Остальная команда получила по ${shareExp} EXP!`);
    }

    while (activePlayerMon.exp >= activePlayerMon.expToNext && activePlayerMon.baseLevel < 100) {
      activePlayerMon.baseLevel++;
      activePlayerMon.expToNext = Math.pow(activePlayerMon.baseLevel + 1, 3);
      const oldMax = activePlayerMon.maxHp;
      const newMax = calculateStat(activePlayerMon, 'hp', false);
      activePlayerMon.maxHp = newMax;
      activePlayerMon.currentHp += (newMax - oldMax);
      appendToLog(`${activePlayerMon.apiData.name} достиг ${activePlayerMon.baseLevel} уровня!`);
      await checkNewMovesOnLevelUp(activePlayerMon, activePlayerMon.baseLevel);
    }

    const evoTarget = await checkEvolution(activePlayerMon);
    if (evoTarget) {
      await triggerEvolution(activePlayerMon, evoTarget.name);
      updatePlayerHpUI();
    }

    setTimeout(() => {
      if (battleType === 'gym') {
        startGymNextPokemon();
      } else if (battleType === 'elite') {
        startEliteNextPokemon();
      } else if (battleType === 'champion') {
        startChampionNextPokemon();
      }
    }, 1000);
  } else {
    setTimeout(() => { enemyTurnGym(); }, 1000);
  }
}

function enemyTurnGym() {
  if (!checkStatusTurn(activeWild, false)) return;
  applyStatusEndOfTurn(activeWild, false);
  if (wildCurHP <= 0) {
    appendToLog(`${activeWild.name} побежден!`);
    if (battleType === 'gym') {
      gymTeamIndex++;
      setTimeout(() => { startGymNextPokemon(); }, 1000);
    } else if (battleType === 'elite') {
      gymTeamIndexInMember++;
      setTimeout(() => { startEliteNextPokemon(); }, 1000);
    } else if (battleType === 'champion') {
      gymTeamIndexInMember++;
      setTimeout(() => { startChampionNextPokemon(); }, 1000);
    }
    return;
  }

  let chosenMove = null;
  let chosenIdx = -1;
  for (let attempt = 0; attempt < 20; attempt++) {
    const idx = Math.floor(Math.random() * wildMovesDetailed.length);
    if (wildMovesDetailed[idx] && wildMovesDetailed[idx].power) {
      if (wildMovesPP && wildMovesPP[idx] && wildMovesPP[idx].current <= 0) continue;
      chosenMove = wildMovesDetailed[idx];
      chosenIdx = idx;
      break;
    }
  }
  if (!chosenMove) {
    chosenMove = { power: 30, damage_class: { name: 'physical' }, type: { name: 'normal' }, name: 'Атака' };
  }
  const enemyMoveName = chosenMove.name || 'Атака';
  if (chosenIdx >= 0 && wildMovesPP && wildMovesPP[chosenIdx]) {
    wildMovesPP[chosenIdx].current--;
  }
  const power = chosenMove.power;
  const isPhysical = chosenMove.damage_class.name === 'physical';
  const attackStat = isPhysical ? 'attack' : 'special-attack';
  const defenseStat = isPhysical ? 'defense' : 'special-defense';

  const A = calculateStat(activeWild, attackStat, true);
  const D = calculateStat(activePlayerMon, defenseStat, false);

  let baseDmg = Math.floor((((2 * wildLvl / 5 + 2) * power * (A / D)) / 50) + 2);
  let dmg = Math.floor(baseDmg * (0.85 + Math.random() * 0.15));

  const isCrit = Math.random() < 0.0625;
  const critMult = isCrit ? 1.5 : 1.0;

  let wildStab = 1.0;
  (activeWild.types || []).forEach(t => {
    if (t.type && t.type.name === chosenMove.type.name) wildStab = 1.5;
  });
  const wildTypeMult = getTypeMultiplier(chosenMove.type.name, activePlayerMon.apiData.types);
  const weatherMult = getWeatherMultiplier(chosenMove.type.name, currentWeather);
  dmg = Math.floor(dmg * wildStab * wildTypeMult * weatherMult * critMult);

  if (isCrit) appendToLog('Критический удар!', false, 'dmg');
  if (wildTypeMult > 1) {
    appendToLog('Это суперэффективно!', false, 'eff');
  } else if (wildTypeMult < 1 && wildTypeMult > 0) {
    appendToLog('Это малоэффективно...');
  } else if (wildTypeMult === 0) {
    appendToLog('Атака не возымела эффекта...');
  }

  appendToLog(`Дикий ${activeWild.name} использует ${enemyMoveName}! (-${dmg} HP)`, false, 'dmg');
  activePlayerMon.currentHp -= dmg;
  if (activePlayerMon.currentHp < 0) activePlayerMon.currentHp = 0;
  updatePlayerHpUI();

  // Rough Skin / Iron Barbs: 1/8 recoil on physical contact (player has the ability)
  const playerAbility = getAbilityName(activePlayerMon, false);
  if (power && isPhysical && ['rough-skin', 'iron-barbs'].includes(playerAbility)) {
    const recoil = Math.max(1, Math.floor(dmg / 8));
    wildCurHP -= recoil;
    if (wildCurHP < 0) wildCurHP = 0;
    updateWildHpUI();
    appendToLog(`Шиповатое тело ${activePlayerMon.apiData.name} ранит ${activeWild.name}! (-${recoil} HP)`);
  }

  // Berry auto-use for player
  if (activePlayerMon.currentHp > 0) checkBerryAutoUse(activePlayerMon, true);

  if (!activePlayerMon.status && Math.random() < 0.1) {
    const statuses = ['psn', 'brn', 'par'];
    const st = statuses[Math.floor(Math.random() * statuses.length)];
    if (applyStatusEffect(activePlayerMon, st)) {
      document.getElementById('player-status-icon').innerText = getStatusIcon(st);
      appendToLog(`${activePlayerMon.apiData.name} получил ${STATUS_NAMES[st]}!`);
    }
  }

  if (activePlayerMon.currentHp === 0) {
    appendToLog(`${activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
    handleGymPlayerFaint();
  } else {
    applyStatusEndOfTurn(activePlayerMon, true);
    if (activePlayerMon.currentHp <= 0) {
      handleGymPlayerFaint();
      return;
    }
    battleRound++;
    // Leftovers end-of-turn healing
    if (activePlayerMon.heldItem === 'leftovers' && activePlayerMon.currentHp > 0 && activePlayerMon.currentHp < activePlayerMon.maxHp) {
      const heal = Math.max(1, Math.floor(activePlayerMon.maxHp / 16));
      activePlayerMon.currentHp = Math.min(activePlayerMon.maxHp, activePlayerMon.currentHp + heal);
      updatePlayerHpUI();
      appendToLog(`${activePlayerMon.apiData.name} восстанавливает HP от Объедков! (+${heal})`);
    }
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex';
    }, 1000);
  }
}

function handleGymPlayerFaint() {
  const nextMon = myTeam.find(m => m.currentHp > 0 && m !== activePlayerMon);
  if (nextMon) {
    activePlayerMon = nextMon;
    activePlayerMon.choiceLockedMove = undefined;
    appendToLog(`Go! ${activePlayerMon.apiData.name}!`);
    document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
    const spriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
    document.getElementById('player-sprite').src = spriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);
    updatePlayerHpUI();

    loadMoveButtons(activePlayerMon, useMoveGym);

    setTimeout(() => { document.getElementById('battle-main-menu').style.display = 'flex'; }, 1000);
  } else {
    appendToLog('Вся команда потеряла сознание... Вы проиграли лидеру.');
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    gymTeamIndex = 0;
    gymTeamIndexInMember = 0;
    gymTeamData = null;
    battleType = 'wild';
  }
}

// --- ELITE FOUR (NEW) ---
function openEliteModal() {
  const modal = document.getElementById('elite-modal');
  const list = document.getElementById('elite-member-list');
  list.innerHTML = '';

  eliteFour.forEach((member, i) => {
    const div = document.createElement('div');
    div.className = 'elite-member-card';
    div.innerHTML = `
      <strong>${member.name}</strong> — ${member.title}
      <span style="font-size:0.75rem;color:#666;">Команда: ${member.team.map(t => t.name).join(', ')}</span>
    `;
    list.appendChild(div);
  });

  const championDiv = document.createElement('div');
  championDiv.className = 'elite-member-card champion';
  championDiv.innerHTML = `
    <strong>${champion.name}</strong> — ${champion.title}
    <span style="font-size:0.75rem;color:#666;">Команда: ${champion.team.map(t => t.name).join(', ')}</span>
  `;
  list.appendChild(championDiv);

  modal.style.display = 'flex';
  document.getElementById('btn-start-elite-battle').onclick = () => {
    modal.style.display = 'none';
    startEliteBattle();
  };
}

async function startEliteBattle() {
  itemsUsedInBattle = 0;
  battleRound = 0;
  battleType = 'elite';
  gymTeamIndex = 0;

  const activeMonIndex = myTeam.findIndex(m => m.currentHp > 0);
  if (activeMonIndex === -1) return showToast('Вам нужен хотя бы один живой покемон!', true);
  activePlayerMon = myTeam[activeMonIndex];
  activePlayerMon.choiceLockedMove = undefined;

  document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
  document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
  const playerSpriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
  document.getElementById('player-sprite').src = playerSpriteUrl;
  updateBattleSpriteBgs();
  document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);

  const modal = document.getElementById('encounter-modal');
  document.getElementById('battle-main-menu').style.display = 'flex';
  document.getElementById('battle-end-menu').style.display = 'none';
  document.getElementById('battle-gym-info').style.display = 'block';
  document.getElementById('gym-leader-battle-name').innerText = 'Элитная Четверка';
  appendToLog('Элитная Четверка — Начало!', true);
  modal.style.display = 'flex';

  await startEliteNextMember();
}

async function startEliteNextMember() {
  if (gymTeamIndex >= eliteFour.length) {
    battleType = 'champion';
    await championBattle();
    return;
  }

  const member = eliteFour[gymTeamIndex];
  gymTeamData = JSON.parse(JSON.stringify(member.team));
  gymTeamIndexInMember = 0;
  appendToLog(`--- ${member.name} (${member.title}) ---`);
  await startEliteNextPokemon();
}

let gymTeamIndexInMember = 0;

async function startEliteNextPokemon() {
  // If all pokemon of this elite member are defeated
  if (gymTeamIndexInMember >= gymTeamData.length) {
    money += eliteFour[gymTeamIndex].moneyReward;
    checkQuestProgress('earn_money', eliteFour[gymTeamIndex].moneyReward);
    updateMoneyDisplay();
    gymTeamIndex++;
    gymTeamData = null;
    gymTeamIndexInMember = 0;
    setTimeout(() => { startEliteNextMember(); }, 1500);
    return;
  }

  const member = gymTeamData[gymTeamIndexInMember];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${member.name.replace('_2', '')}`);
    activeWild = await res.json();
    wildLvl = member.level;
    wildStatus = null;
    wildSleepTurns = 0;
    currentWeather = getDailyWeather(currentLocationId);

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

    wildMovesDetailed = [];
    const movePromises = [];
    for (let i = 0; i < activeWild.moves.length && i < 20; i++) {
      movePromises.push(
        fetch(activeWild.moves[i].move.url).then(r => r.json()).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);
    wildMovesDetailed = moveResults.filter(m => m && m.power);
    wildMovesPP = wildMovesDetailed.map(m => ({ current: m.pp || 30, max: m.pp || 30 }));

    document.getElementById('wild-name').innerText = activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${wildLvl}`;
    const wildSpriteUrl = activeWild.sprites?.other?.['official-artwork']?.front_default || activeWild.sprites.front_default;
    document.getElementById('wild-sprite').src = wildSpriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('wild-status-icon').innerText = '';
    updateWildHpUI();

    appendToLog(`${eliteFour[gymTeamIndex].name} выпускает ${activeWild.name}!`);

    // Intimidate check
    const wildAbility = activeWild.abilities?.[0]?.ability?.name;
    if (wildAbility === 'intimidate') {
      statStageModify(activePlayerMon, 'atk', -1);
      appendToLog(`${activeWild.name} отпугивает ${activePlayerMon.apiData.name}! Атака снижена!`);
    }

    // Set up player moves for elite battle
    loadMoveButtons(activePlayerMon, useMoveGym);

    // Player UI refresh
    document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
    document.getElementById('player-sprite').src = playerSpriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);
    updatePlayerHpUI();
    document.getElementById('battle-main-menu').style.display = 'flex';

  } catch (e) {
    appendToLog('Ошибка загрузки...');
  }
}

async function championBattle() {
  itemsUsedInBattle = 0;
  battleRound = 0;
  gymTeamData = JSON.parse(JSON.stringify(champion.team));
  gymTeamIndexInMember = 0;
  battleType = 'champion';
  appendToLog(`--- ${champion.name} вызывает вас! ---`);
  await startChampionNextPokemon();
}

async function startChampionNextPokemon() {
  if (gymTeamIndexInMember >= gymTeamData.length) {
    money += champion.moneyReward;
    checkQuestProgress('earn_money', champion.moneyReward);
    updateMoneyDisplay();
    appendToLog('ПОБЕДА! Вы стали Чемпионом Лиги!');
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    gymTeamIndex = 0;
    gymTeamData = null;
    battleType = 'wild';
    autoSave();
    return;
  }

  const member = gymTeamData[gymTeamIndexInMember];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${member.name.replace('_2', '')}`);
    activeWild = await res.json();
    wildLvl = member.level;
    wildStatus = null;
    wildSleepTurns = 0;
    currentWeather = getDailyWeather(currentLocationId);

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

    wildMovesDetailed = [];
    const movePromises = [];
    for (let i = 0; i < activeWild.moves.length && i < 20; i++) {
      movePromises.push(
        fetch(activeWild.moves[i].move.url).then(r => r.json()).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);
    wildMovesDetailed = moveResults.filter(m => m && m.power);
    wildMovesPP = wildMovesDetailed.map(m => ({ current: m.pp || 30, max: m.pp || 30 }));

    document.getElementById('wild-name').innerText = activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${wildLvl}`;
    const wildSpriteUrl = activeWild.sprites?.other?.['official-artwork']?.front_default || activeWild.sprites.front_default;
    document.getElementById('wild-sprite').src = wildSpriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('wild-status-icon').innerText = '';
    updateWildHpUI();

    appendToLog(`${champion.name} выпускает ${activeWild.name}!`);

    // Intimidate check
    const wildAbility = activeWild.abilities?.[0]?.ability?.name;
    if (wildAbility === 'intimidate') {
      statStageModify(activePlayerMon, 'atk', -1);
      appendToLog(`${activeWild.name} отпугивает ${activePlayerMon.apiData.name}! Атака снижена!`);
    }

    // Set up player moves for champion battle
    loadMoveButtons(activePlayerMon, useMoveGym);

    // Player UI refresh
    document.getElementById('player-name').innerText = activePlayerMon.nickname || activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${activePlayerMon.baseLevel + activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = activePlayerMon.apiData.sprites?.other?.['official-artwork']?.front_default || activePlayerMon.apiData.sprites.front_default;
    document.getElementById('player-sprite').src = playerSpriteUrl;
    updateBattleSpriteBgs();
    document.getElementById('player-status-icon').innerText = getStatusIcon(activePlayerMon.status);
    updatePlayerHpUI();
    document.getElementById('battle-main-menu').style.display = 'flex';

  } catch (e) {
    appendToLog('Ошибка загрузки...');
  }
}

// --- SHOP SYSTEM (NEW) ---
const ITEM_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';
const LOCAL_ITEM_SPRITE_BASE = '/assets/items/';
const ITEM_SPRITE_MAP = {
  // Balls
  pokeball: 'poke-ball.png',
  greatBall: 'great-ball.png',
  ultraBall: 'ultra-ball.png',
  masterBall: 'master-ball.png',
  quickBall: 'quick-ball.png',
  friendBall: 'friend-ball.png',
  loveBall: 'love-ball.png',
  duskBall: 'dusk-ball.png',
  timerBall: { local: 'P78.png' },
  cloneBall: { local: 'klonbol.png' },
  centerBall: { local: 'ball7.png' },
  darkBall: { local: '72.png' },
  // Healing
  potion: 'potion.png',
  superPotion: 'super-potion.png',
  fullRestore: 'full-restore.png',
  // Status cure
  antidote: 'antidote.png',
  antiparalyze: 'paralyze-heal.png',
  energyDrink: 'awakening.png',
  fireExtinguisher: 'burn-heal.png',
  antiSputin: { local: '13.gif' },
  healingHerb: { local: '173.gif' },
  // PP recovery
  weakElixir: 'ether.png',
  elixir: 'elixir.png',
  strongElixir: 'max-elixir.png',
  // Vitamins
  vitamin: 'hp-up.png',
  protein: 'protein.png',
  iron: 'iron.png',
  calcium: 'calcium.png',
  zinc: 'zinc.png',
  carbos: 'carbos.png',
  // Training
  train: { local: 'train.gif' },
  weaken: { local: 'oslab.png' },
  candy: 'rare-candy.png',
  // Evolution stones
  evolutionStone: { local: '136.gif' },
  fireStone: 'fire-stone.png',
  waterStone: 'water-stone.png',
  leafStone: 'leaf-stone.png',
  thunderStone: 'thunder-stone.png',
  moonStone: 'moon-stone.png',
  sunStone: 'sun-stone.png',
  shinyStone: 'shiny-stone.png',
  duskStone: 'dusk-stone.png',
  iceStone: 'ice-stone.png',
  dawnStone: 'dawn-stone.png',
  everstone: 'everstone.png',
  // Evolvers
  deepSeaTooth: 'deep-sea-tooth.png',
  deepSeaScale: 'deep-sea-scale.png',
  dragonScale: 'dragon-scale.png',
  upGrade: 'up-grade.png',
  // Berries
  sitrusBerry: 'sitrus-berry.png',
  oranBerry: 'oran-berry.png',
  lumBerry: 'lum-berry.png',
  chestoBerry: 'chesto-berry.png',
  rawstBerry: 'rawst-berry.png',
  cheriBerry: 'cheri-berry.png',
  pechaBerry: 'pecha-berry.png',
  aspearBerry: 'aspear-berry.png',
  leppaBerry: 'leppa-berry.png',
  persimBerry: 'persim-berry.png',
  figyBerry: { local: 'figy-berry.png' },
  wikiBerry: { local: 'wiki-berry.png' },
  // Battle items
  leftovers: 'leftovers.png',
  ppUp: 'pp-up.png',
  luckyEgg: 'lucky-egg.png',
  expertBelt: 'expert-belt.png',
  bigRoot: 'big-root.png',
  assaultVest: 'assault-vest.png',
  eviolite: { local: 'Evolit.png' },
  choiceBand: 'choice-band.png',
  choiceScarf: 'choice-scarf.png',
  choiceSpecs: 'choice-specs.png',
  thickClub: 'thick-club.png',
  leek: { local: 'Item132.png' },
  flameOrb: 'flame-orb.png',
  toxicOrb: 'toxic-orb.png',
  band: 'focus-band.png',
  xAttack: 'x-attack.png',
  xDefense: 'x-defense.png',
  xSpAttack: 'x-sp-atk.png',
  xSpDefense: 'x-sp-def.png',
  xSpeed: 'x-speed.png',
  xAccuracy: 'x-accuracy.png',
  // TMs
  tm: 'tm-normal.png',
};
function getItemSpriteImg(itemId, size = 24) {
  const mapped = ITEM_SPRITE_MAP[itemId];
  if (mapped) {
    if (typeof mapped === 'object' && mapped.local) {
      return `<img src="${LOCAL_ITEM_SPRITE_BASE}${mapped.local}" style="width:${size}px;height:${size}px;vertical-align:middle;image-rendering:auto" alt="">`;
    }
    return `<img src="${ITEM_SPRITE_BASE}${mapped}" style="width:${size}px;height:${size}px;vertical-align:middle;image-rendering:auto" alt="">`;
  }
  // Fallback to ITEMS database
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return '';
  if (item.spriteType === 'pokeapi') {
    return `<img src="${ITEM_SPRITE_BASE}${item.sprite}" style="width:${size}px;height:${size}px;vertical-align:middle;image-rendering:auto" alt="">`;
  }
  return `<img src="${LOCAL_ITEM_SPRITE_BASE}${item.sprite}" style="width:${size}px;height:${size}px;vertical-align:middle;image-rendering:auto" alt="">`;
}

// Auto-generated from ITEMS database
const shopPrices = {};
ITEMS.forEach(item => { if (item.price > 0) shopPrices[item.id] = item.price; });

const shopItems = ITEMS
  .filter(item => item.price > 0 && item.implemented)
  .map(item => ({
    id: item.id,
    icon: getItemSpriteImg(item.id, 28),
    name: item.nameRu,
    price: item.price,
  }));

function openShop() {
  const modal = document.getElementById('shop-modal');
  const itemsContainer = document.getElementById('shop-items');
  itemsContainer.innerHTML = '';

  shopItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-price">¥${item.price}</div>
      </div>
      <div class="shop-qty-wrap">
        <input type="number" class="shop-qty-input" value="1" min="1" max="99" data-item="${item.id}">
        <button class="btn-use shop-buy-btn" data-item="${item.id}">Купить</button>
      </div>
    `;
    itemsContainer.appendChild(div);
  });

  document.getElementById('shop-money-display').innerText = money;
  modal.style.display = 'flex';
}

function initShopEvents() {
  document.getElementById('btn-close-shop').addEventListener('click', () => {
    document.getElementById('shop-modal').style.display = 'none';
  });

  document.getElementById('shop-items').addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-buy-btn');
    if (!btn) return;

    const itemId = btn.getAttribute('data-item');
    const price = shopPrices[itemId];
    const qtyInput = document.querySelector(`.shop-qty-input[data-item="${itemId}"]`);
    const qty = Math.max(1, Math.min(99, parseInt(qtyInput?.value) || 1));
    const total = price * qty;

    if (money < total) return showToast('Недостаточно кредитов!', true);

    money -= total;

    let bought = 0;
    for (let i = 0; i < qty; i++) {
      if (!addItem(itemId)) {
        money += price;
        break;
      }
      bought++;
    }

    document.getElementById('shop-money-display').innerText = money;
    updateInventoryDisplay();
    updateMoneyDisplay();
    autoSave();

    if (bought > 0) {
      showToast(bought > 1 ? `Куплено ${bought}x! Осталось: ¥${money}` : `Куплено! Осталось: ¥${money}`, false);
    }
  });
}

// --- DISPLAY UPDATES ---
function updateMoneyDisplay() {
  inventory['credit'] = money;
  const el = document.getElementById('money-display');
  if (el) el.innerText = `¥${money}`;
}

function updateBadgeDisplay() {
  const el = document.getElementById('badge-display');
  if (el) el.innerText = `Значки: ${badges.length}/8`;
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
      const statusIcon = getStatusIcon(mon.status);
      slot.className = 'team-slot';
      const reorderHtml = (myTeam.length > 1) ?
        `<div class="team-reorder">
          ${i > 0 ? `<button class="team-move-btn" data-index="${i}" data-dir="-1" title="Вверх">▲</button>` : '<span></span>'}
          ${i < myTeam.length - 1 ? `<button class="team-move-btn" data-index="${i}" data-dir="1" title="Вниз">▼</button>` : '<span></span>'}
        </div>` : '';
      const types = mon.apiData.types;
      const typeBg = getTypeGradient(types);
      const trainStage = mon.trainingStage || 0;
      const trainLabel = trainStage > 0
        ? `<div class="train-label" style="background:${trainingStages[trainStage].color};" title="${trainingStages[trainStage].name} (+${trainingStages[trainStage].pct}%)">${trainingStages[trainStage].name}</div>`
        : '';
      if (mon.isEgg) {
        const eggData = eggs.find(e => e.uid === mon.uid);
        const remaining = eggData ? Math.max(0, Math.ceil((eggData.readyTime - Date.now()) / 60000)) : '?';
        slot.innerHTML = `
          <div class="team-sprite-wrap">
            <span style="font-size:48px;">🥚</span>
          </div>
          <div class="slot-name">Яйцо</div>
          <div class="slot-lvl">Вылупится через ~${remaining} мин</div>
        `;
      } else {
        const pwStars2 = getPowerStars(mon);
        const rStars2 = getRarityStars(mon);
        slot.innerHTML = `
          ${reorderHtml}
          <div class="team-sprite-wrap">
            <img src="${mon.apiData.sprites?.other?.['official-artwork']?.front_default || mon.apiData.sprites.front_default}" alt="sprite" style="background:${typeBg};">
            ${trainLabel}
          </div>
          <div class="slot-name">${escHtml(mon.nickname || mon.apiData.name)} ${statusIcon}</div>
          <div class="slot-lvl">${renderStars(pwStars2, rStars2)} Lvl ${curLvl} | ${mon.currentHp}/${mon.maxHp} HP</div>
        `;
      }
      slot.setAttribute('data-poke-index', i);
      slot.addEventListener('click', (e) => {
        if (e.target.closest('.team-move-btn')) return;
        openPokemonProfile(i);
      });
    } else {
      slot.className = 'team-slot empty';
      slot.innerText = 'Пустой слот';
    }
    grid.appendChild(slot);
  }

  // Set up event delegation for reorder buttons if not already done
  if (!grid._reorderSetup) {
    grid._reorderSetup = true;
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.team-move-btn');
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-index'));
      const dir = parseInt(btn.getAttribute('data-dir'));
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= myTeam.length) return;
      [myTeam[idx], myTeam[swapIdx]] = [myTeam[swapIdx], myTeam[idx]];
      renderTeamGrid();
      autoSave();
    });
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

  document.getElementById('poke-name').innerText = `${mon.nickname || mon.apiData.name} #${mon.apiData.id}`;
  const animSprite = mon.apiData?.sprites?.other?.['official-artwork']?.front_default || mon.apiData?.sprites?.front_default || '';
  document.getElementById('poke-sprite').src = animSprite;
  document.getElementById('poke-sprite').style.background = getTypeGradient(mon.apiData.types);

  const typesHtml = mon.apiData.types.map(t => `<span class="type-badge" style="background-color: ${getTypeColor(t.type.name)}">${t.type.name}</span>`).join('');
  document.getElementById('poke-types').innerHTML = typesHtml;

  const ability = mon.apiData.abilities.length > 0 ? mon.apiData.abilities[0].ability.name : 'Unknown';
  document.getElementById('info-ability').innerText = ability.charAt(0).toUpperCase() + ability.slice(1);
  const tera = mon.apiData.types[0].type.name;
  document.getElementById('info-tera').innerText = tera.charAt(0).toUpperCase() + tera.slice(1);

  const heldEl = document.getElementById('info-held-item');
  const heldItemName = getHeldItemName(mon.heldItem);
  heldEl.innerText = heldItemName;
  heldEl.title = 'Нажмите чтобы сменить';
  heldEl.style.cursor = 'pointer';
  heldEl.onclick = () => openHeldItemPicker(currentPokemonIndex);

  document.getElementById('info-cur-hp').innerText = mon.currentHp;
  document.getElementById('info-max-hp').innerText = mon.maxHp;

  for(let i=0; i<4; i++) {
    if(mon.apiData.moves[i]) {
      const ppDisplay = (mon.movesPP && mon.movesPP[i]) ? `${mon.movesPP[i].current}/${mon.movesPP[i].max}` : '30/30';
      document.getElementById(`move-${i}-name`).innerText = mon.apiData.moves[i].move.name;
      document.getElementById(`move-${i}-pp`).innerText = `PP ${ppDisplay}`;
    } else {
      document.getElementById(`move-${i}-name`).innerText = '-';
      document.getElementById(`move-${i}-pp`).innerText = `PP 0/0`;
    }
  }

  // Learnable moves
  const learnableDiv = document.getElementById('content-moves');
  let learnableHTML = '';
  if (mon.learnableMoves && mon.learnableMoves.length > 0) {
    learnableHTML = '<div class="learnable-section" style="margin-top:12px;"><h4 style="margin:0 0 8px;font-size:0.9rem;">📥 Резерв атак:</h4>';
    mon.learnableMoves.forEach((lm, i) => {
      learnableHTML += `<div class="learnable-move" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin:4px 0;background:var(--tma-bg);border-radius:6px;font-size:0.85rem;">
        <span>${lm.name} (⚡${lm.power || '?'} | ${lm.type || '?'})</span>
        <button class="btn-use learn-btn" data-lm="${i}" style="background:#34c759;padding:3px 8px;font-size:0.75rem;">Выучить</button>
      </div>`;
    });
    learnableHTML += '</div>';
  }
  // Add to moves tab
  let movesContent = document.getElementById('content-moves');
  // Remove old learnable section if exists
  const oldSec = movesContent.querySelector('.learnable-section');
  if (oldSec) oldSec.remove();
  if (learnableHTML) {
    movesContent.insertAdjacentHTML('beforeend', learnableHTML);
    movesContent.querySelectorAll('.learn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-lm'));
        const move = mon.learnableMoves[idx];
        const slotItems = (mon.apiData.moves || []).filter(m => m).map((m, i) => ({
          label: m.move.name, subtitle: `Слот ${i + 1}`
        }));
        showSelectionModal(`Выучить ${move.name} (⚡${move.power}) в какой слот?`, slotItems, (slotPick) => {
          if (!mon.apiData.moves[slotPick]) mon.apiData.moves[slotPick] = {};
          mon.apiData.moves[slotPick].move = { name: move.name, url: move.url };
          mon.learnableMoves.splice(idx, 1);
          refreshProfileUI();
          showToast(`${move.name} выучено в слот ${slotPick + 1}!`, false);
          autoSave();
        }, true);
      });
    });
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
  updateStatusDisplay_Profile(mon);

  updateDynamicEVs();
  updateStats();
}

function updateStatusDisplay_Profile(mon) {
  const el = document.getElementById('profile-status-display');
  if (!el) return;
  if (mon.status) {
    el.innerText = `Статус: ${getStatusIcon(mon.status)} ${STATUS_NAMES[mon.status]}`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
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
  // Show UID & original trainer
  const uidEl = document.getElementById('info-uid');
  if (uidEl) {
    uidEl.innerText = mon.uid || '?';
    uidEl.title = mon.originalTrainer ? `Тренер ID: ${mon.originalTrainer}` : '';
  }
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
  // QA button handlers now useItem()
  const qaMap = {
    'qa-potion': 'potion', 'qa-candy': 'candy', 'qa-vitamin': 'vitamin',
    'qa-train': 'train', 'qa-weaken': 'weaken',
    'qa-super-potion': 'superPotion', 'qa-full-restore': 'fullRestore',
    'qa-evolution-stone': 'evolutionStone', 'qa-tm': 'tm',
  };
  for (const [btnId, itemId] of Object.entries(qaMap)) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => useItem(itemId));
    }
  }
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
        valEl.style.color = '#34c759';
        valEl.title = 'Натренировано';
      } else {
        valEl.style.color = '';
        valEl.title = '';
      }
    }
  }
}

function updateInventoryDisplay() {
  renderInventory();
  renderBattleItemSelect();
  updateQADisplays();
}

function renderBattleItemSelect() {
  const select = document.getElementById('battle-item-select');
  if (!select) return;
  select.innerHTML = '';
  const battleItems = ITEMS.filter(i => i.implemented && getItemQty(i.id) > 0 && (
    i.isBall || i.isUsable || i.category === 'statusCure' || i.category === 'ppRecovery' ||
    i.category === 'evolutionStones'
  ));
  battleItems.forEach(item => {
    const qty = getItemQty(item.id);
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.nameRu} (${qty})`;
    select.appendChild(opt);
  });
}

function updateQADisplays() {
  const map = {
    'qa-qty-potion': 'potion', 'qa-qty-candy': 'candy', 'qa-qty-vitamin': 'vitamin',
    'qa-qty-train': 'train', 'qa-qty-weaken': 'weaken',
    'qa-qty-super-potion': 'superPotion', 'qa-qty-full-restore': 'fullRestore',
    'qa-qty-evolution-stone': 'evolutionStone', 'qa-qty-tm': 'tm',
  };
  for (const [elId, itemId] of Object.entries(map)) {
    const el = document.getElementById(elId);
    if (el) el.textContent = getItemQty(itemId);
  }
}

function renderInventory() {
  const container = document.getElementById('inventory-items');
  if (!container) return;

  container.innerHTML = '';

  // Show Money as an item
  const moneyTitle = document.createElement('div');
  moneyTitle.className = 'inv-category-title';
  moneyTitle.textContent = 'Валюта';
  container.appendChild(moneyTitle);
  
  const moneyGrid = document.createElement('div');
  moneyGrid.className = 'inv-grid';
  moneyGrid.innerHTML = `
    <div class="inv-item" style="cursor: default;">
      <div class="inv-item-icon" style="font-size:24px; color:#f0d060;">¥</div>
      <div class="inv-item-name">Кредиты</div>
      <div class="inv-item-qty">x${money}</div>
    </div>
  `;
  container.appendChild(moneyGrid);

  // Show eggs in inventory
  if (eggs.length > 0) {
    const eggTitle = document.createElement('div');
    eggTitle.className = 'inv-category-title';
    eggTitle.textContent = '🥚 Яйца';
    container.appendChild(eggTitle);

    const eggGrid = document.createElement('div');
    eggGrid.className = 'inv-grid';
    const now = Date.now();
    eggs.forEach((egg, idx) => {
      const cell = document.createElement('div');
      cell.className = 'inv-grid-item';
      cell.style.cssText = 'cursor:pointer;border-color:#34c759;';

      const emoji = document.createElement('div');
      emoji.style.cssText = 'font-size:24px;';
      emoji.textContent = '🥚';
      cell.appendChild(emoji);

      const name = document.createElement('div');
      name.className = 'inv-grid-name';
      name.textContent = egg.species || 'Яйцо';
      cell.appendChild(name);

      const timeLeft = Math.max(0, egg.readyTime - now);
      const badge = document.createElement('div');
      badge.className = 'inv-grid-badge';
      badge.style.cssText = 'background:#34c759;font-size:0.5rem;min-width:28px;';
      if (timeLeft <= 0) {
        badge.textContent = '✓';
        cell.addEventListener('click', () => hatchEgg(egg));
      } else {
        const mins = Math.ceil(timeLeft / 60000);
        badge.textContent = mins > 60 ? `${Math.floor(mins/60)}ч` : `${mins}м`;
      }
      cell.appendChild(badge);

      eggGrid.appendChild(cell);
    });
    container.appendChild(eggGrid);
  }

  // Group items by category
  const categories = {
    balls: 'Покеболы',
    healing: 'Восстановление HP',
    statusCure: 'Лечение статусов',
    ppRecovery: 'Восстановление PP',
    vitamins: 'Витамины',
    evolutionStones: 'Камни Эволюции',
    berries: 'Ягоды',
    battle: 'Боевые',
    quest: 'Квестовые',
    training: 'Тренировка',
    tickets: 'Билеты',
    crafting: 'Ремесленные',
    artifacts: 'Артефакты',
    awards: 'Награды',
    other: 'Прочее',
  };

  let hasAnyItems = false;
  for (const [catId, catName] of Object.entries(categories)) {
    const catItems = ITEMS.filter(item => item.category === catId && getItemQty(item.id) > 0);
    if (catItems.length === 0) continue;
    hasAnyItems = true;

    const title = document.createElement('div');
    title.className = 'inv-category-title';
    title.textContent = catName;
    container.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'inv-grid';

    catItems.forEach(item => {
      const qty = getItemQty(item.id);
      const cell = document.createElement('div');
      cell.className = 'inv-grid-item';
      cell.dataset.itemId = item.id;

      // Sprite
      const img = document.createElement('img');
      img.className = 'inv-grid-sprite';
      if (item.spriteType === 'pokeapi') {
        img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.sprite}`;
      } else {
        img.src = `${import.meta.env.BASE_URL}assets/items/${item.sprite}`;
      }
      img.alt = item.nameRu;
      img.loading = 'lazy';
      img.onerror = () => { img.src = `${import.meta.env.BASE_URL}assets/items/1.gif`; img.onerror = null; };
      cell.appendChild(img);

      // Name
      const name = document.createElement('div');
      name.className = 'inv-grid-name';
      name.textContent = item.nameRu;
      cell.appendChild(name);

      // Use button (if usable)
      if (item.isUsable && item.implemented) {
        const useBtn = document.createElement('button');
        useBtn.className = 'inv-grid-use';
        if (item.id === 'weaken') useBtn.classList.add('danger');
        useBtn.textContent = 'Юз';
        useBtn.dataset.itemId = item.id;
        cell.appendChild(useBtn);
      }

      // Badge (quantity)
      const badge = document.createElement('div');
      badge.className = 'inv-grid-badge';
      badge.textContent = qty;
      cell.appendChild(badge);

      grid.appendChild(cell);
    });

    container.appendChild(grid);
  }

  if (!hasAnyItems) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tma-text-muted);font-size:0.9rem;">Рюкзак пуст</div>';
  }

  // Click on item cell → show info
  container.querySelectorAll('.inv-grid-item').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.inv-grid-use')) return;
      const itemId = cell.dataset.itemId;
      const item = ITEMS.find(i => i.id === itemId);
      if (!item) return;
      const qty = getItemQty(itemId);
      const priceInfo = item.price > 0 ? `\n💰 Цена: ${item.price.toLocaleString()} кр.` : '';
      const sellInfo = item.sellPrice > 0 ? `\n🏷️ Продажа: ${item.sellPrice.toLocaleString()} кр.` : '';
      showItemInfoModal(item, qty);
    });
  });

  // Delegate click events on use buttons
  container.querySelectorAll('.inv-grid-use').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.itemId;
      useItem(itemId);
    });
  });
}

function useItem(itemId) {
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return showToast('Предмет не найден!', true);
  if (getItemQty(itemId) <= 0) return showToast(`Нет ${item.nameRu}!`, true);
  if (!item.isUsable) return showToast(`${item.nameRu} нельзя использовать из рюкзака.`, true);
  if (currentPokemonIndex === null) return showToast('Сначала выберите покемона во вкладке "Команда"!', true);

  const mon = myTeam[currentPokemonIndex];
  if (!mon) return showToast('Покемон не найден!', true);

  switch (itemId) {
    case 'potion': {
      if (mon.currentHp >= mon.maxHp) return showToast('Здоровье уже полное!', true);
      removeItem('potion');
      mon.currentHp += 20;
      if (mon.currentHp > mon.maxHp) mon.currentHp = mon.maxHp;
      refreshProfileUI();
      showToast(`Вы использовали Аптечку. Здоровье ${mon.apiData.name} восстановлено!`, false);
      break;
    }
    case 'superPotion': {
      if (mon.currentHp >= mon.maxHp) return showToast('Здоровье уже полное!', true);
      removeItem('superPotion');
      mon.currentHp += 50;
      if (mon.currentHp > mon.maxHp) mon.currentHp = mon.maxHp;
      refreshProfileUI();
      showToast(`Супер Аптечка использована! Здоровье ${mon.nickname || mon.apiData.name} восстановлено.`, false);
      break;
    }
    case 'fullRestore': {
      if (mon.currentHp >= mon.maxHp && !mon.status) return showToast('Здоровье уже полное!', true);
      removeItem('fullRestore');
      mon.currentHp = mon.maxHp;
      cureStatus(mon);
      refreshProfileUI();
      showToast(`Полное Восстановление использовано! ${mon.nickname || mon.apiData.name} полностью здоров!`, false);
      break;
    }
    case 'candy': {
      if (mon.baseLevel + mon.candiesEaten >= 100) return showToast('Достигнут максимальный 100 уровень!', true);
      removeItem('candy');
      mon.candiesEaten++;
      mon.happiness += 2;
      if (mon.happiness > 255) mon.happiness = 255;
      const baseHp = mon.apiData.stats[0].base_stat;
      const curLvl = mon.baseLevel + mon.candiesEaten;
      const oldMax = mon.maxHp;
      mon.maxHp = Math.floor(0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl) + curLvl + 10;
      mon.currentHp += (mon.maxHp - oldMax);
      (async () => {
        const evoTarget = await checkEvolution(mon);
        if (evoTarget) {
          await triggerEvolution(mon, evoTarget.name);
          refreshProfileUI();
        }
      })();
      // Level-up move learning
      (async () => {
        try {
          const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${mon.apiData.id}`);
          const pokeData = await res.json();
          const allMoves = pokeData.moves || [];
          const knownNames = new Set((mon.apiData.moves || []).filter(m => m).map(m => m.move.name));
          for (const entry of allMoves) {
            for (const detail of entry.version_group_details) {
              if (detail.move_learn_method.name === 'level-up' && detail.level_learned_at === curLvl) {
                if (!knownNames.has(entry.move.name)) {
                  const emptySlot = (mon.apiData.moves || []).findIndex(m => !m);
                  if (emptySlot >= 0) {
                    const url = entry.move.url;
                    if (!mon.apiData.moves[emptySlot]) {
                      mon.apiData.moves[emptySlot] = { move: { name: entry.move.name, url } };
                    }
                    showToast(`${mon.nickname || mon.apiData.name} выучил ${entry.move.name}!`, false);
                    knownNames.add(entry.move.name);
                  } else {
                    // Show slot picker to choose which move to replace
                    const slotItems = (mon.apiData.moves || []).filter(m => m).map((m, i) => ({
                      label: m.move.name,
                      subtitle: `Слот ${i + 1}`
                    }));
                    slotItems.push({ label: 'Отказаться', subtitle: 'Сохранить в резерв' });
                    showSelectionModal(`Заменить атаку на ${entry.move.name}?`, slotItems, (pick) => {
                      if (pick < 4) {
                        mon.apiData.moves[pick].move = { name: entry.move.name, url: entry.move.url };
                        knownNames.add(entry.move.name);
                        showToast(`${entry.move.name} выучено!`, false);
                      } else {
                        // Save to reserve
                        if (!mon.learnableMoves) mon.learnableMoves = [];
                        if (!mon.learnableMoves.some(m => m.name === entry.move.name)) {
                          mon.learnableMoves.push({ name: entry.move.name, url: entry.move.url, power: 0, type: 'normal' });
                        }
                        showToast(`${entry.move.name} сохранено в резерв!`, false);
                      }
                    }, true);
                  }
                }
                break;
              }
            }
          }
        } catch (e) { console.warn('Failed to load level-up moves', e); }
      })();
      refreshProfileUI();
      showToast(`Вы скормили Сладкую Конфету! Уровень повышен до ${curLvl}.`, false);
      break;
    }
    case 'vitamin': {
      if (mon.vitaminsEaten >= 10) return showToast('Этот покемон уже съел максимум 10 витаминов!', true);
      removeItem('vitamin');
      mon.vitaminsEaten++;
      mon.happiness += 5;
      if (mon.happiness > 255) mon.happiness = 255;
      refreshProfileUI();
      showToast(`Вы скормили Витамин! Доступно +10 EV.`, false);
      break;
    }
    case 'train': {
      if (mon.trainingStage >= 6) return showToast('Тренировка уже на Именной стадии!', true);
      removeItem('train');
      const chances = [1.0, 0.8, 0.5, 0.3, 0.15, 0.05];
      if (Math.random() > chances[mon.trainingStage]) {
        return showToast(`Тренировка не удалась! Набор потрачен.`, false);
      }
      const trainableStats = ['atk', 'def', 'spa', 'spd', 'spe'];
      mon.trainingStat = trainableStats[Math.floor(Math.random() * trainableStats.length)];
      mon.trainingStage++;
      mon.happiness += 10;
      if (mon.happiness > 255) mon.happiness = 255;
      refreshProfileUI();
      showToast(`Успешно! Теперь это ${trainingStages[mon.trainingStage].name} тренировка!`, false);
      break;
    }
    case 'weaken': {
      if (mon.trainingStage === 0) return showToast('Покемон ещё не тренирован!', true);
      removeItem('weaken');
      mon.trainingStage--;
      if (mon.trainingStage === 0) mon.trainingStat = null;
      refreshProfileUI();
      break;
    }
    case 'evolutionStone': {
      (async () => {
        const evoTarget = await checkEvolution(mon, true);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать!', true);
        removeItem('evolutionStone');
        await triggerEvolution(mon, evoTarget.name);
        refreshProfileUI();
        showToast(`${mon.nickname || mon.apiData.name} эволюционировал в ${evoTarget.name}!`, false);
      })();
      break;
    }
    case 'tm': {
      openMoveRelearner();
      break;
    }
    case 'sitrusBerry': {
      giveBerryToMon('sitrus');
      break;
    }
    case 'oranBerry': {
      giveBerryToMon('oran');
      break;
    }
    case 'lumBerry': {
      giveBerryToMon('lum');
      break;
    }
    case 'chestoBerry': {
      giveBerryToMon('chesto');
      break;
    }
    case 'rawstBerry': {
      giveBerryToMon('rawst');
      break;
    }
    case 'fireStone': case 'waterStone': case 'leafStone': case 'thunderStone':
    case 'moonStone': case 'sunStone': case 'shinyStone': case 'duskStone':
    case 'iceStone': case 'dawnStone': {
      (async () => {
        const evoTarget = await checkEvolution(mon, true, itemId);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать с этим камнем!', true);
        removeItem(itemId);
        await triggerEvolution(mon, evoTarget.name);
        refreshProfileUI();
        showToast(`${mon.nickname || mon.apiData.name} эволюционировал в ${evoTarget.name}!`, false);
      })();
      break;
    }
    // Status cures — usable from backpack (uses short status codes)
    case 'antidote': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      if (mon.status !== 'psn') return showToast('Антидот лечит только отравление!', true);
      mon.status = null;
      removeItem(itemId);
      if (currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} вылечен от отравления!`, false);
      break;
    }
    case 'antiparalyze': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      if (mon.status !== 'par') return showToast('Антипаралич лечит только паралич!', true);
      mon.status = null;
      removeItem(itemId);
      if (currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} вылечен от паралича!`, false);
      break;
    }
    case 'energyDrink': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      if (mon.status !== 'slp') return showToast('Энергетик лечит только сон!', true);
      mon.status = null;
      mon.sleepTurns = 0;
      removeItem(itemId);
      if (currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} проснулся!`, false);
      break;
    }
    case 'fireExtinguisher': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      if (mon.status !== 'brn') return showToast('Огнетушитель лечит только ожог!', true);
      mon.status = null;
      removeItem(itemId);
      if (currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} вылечен от ожога!`, false);
      break;
    }
    case 'antiSputin': case 'healingHerb': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      const statusNames = { psn: 'отравления', par: 'паралича', slp: 'сна', brn: 'ожога', frz: 'заморозки' };
      showToast(`${mon.nickname || mon.apiData.name} вылечен от ${statusNames[mon.status] || mon.status}!`, false);
      mon.status = null;
      mon.sleepTurns = 0;
      removeItem(itemId);
      if (currentPokemonIndex !== null) refreshProfileUI();
      break;
    }
    // PP recovery — from backpack
    case 'weakElixir': case 'elixir': case 'strongElixir': {
      const ppRestore = itemId === 'weakElixir' ? 10 : itemId === 'elixir' ? 20 : 40;
      if (!mon.movesPP || mon.movesPP.every(pp => !pp || pp.current >= pp.max)) {
        return showToast('Все PP уже максимальны!', true);
      }
      mon.movesPP.forEach(pp => {
        if (pp) pp.current = Math.min(pp.max, pp.current + ppRestore);
      });
      removeItem(itemId);
      if (currentPokemonIndex !== null) refreshProfileUI();
      showToast(`PP всех атак восстановлены на ${ppRestore}!`, false);
      break;
    }
    // EXP Share - toggle distribution
    case 'expShare': {
      expShareActive = !expShareActive;
      showToast(expShareActive ? 'Распределитель опыта активирован! Команда будет получать 50% опыта.' : 'Распределитель опыта деактивирован.', false);
      break;
    }
    // Lucky Egg - give to selected pokemon as held item
    case 'luckyEgg': {
      if (mon.heldItem === 'luckyEgg') return showToast('Покемон уже держит Счастливое яйцо!', true);
      if (mon.heldItem) {
        const heldName = itemDef(mon.heldItem).nameRu;
        showConfirmModal('Заменить предмет?', `Покемон уже держит ${heldName}. Заменить на Счастливое яйцо?`, () => {
          addItem(mon.heldItem);
          removeItem('luckyEgg');
          mon.heldItem = 'luckyEgg';
          refreshProfileUI();
          showToast(`${mon.nickname || mon.apiData.name} теперь держит Счастливое яйцо!`, false);
        });
        return;
      }
      removeItem('luckyEgg');
      mon.heldItem = 'luckyEgg';
      refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} теперь держит Счастливое яйцо!`, false);
      break;
    }
    // Crafting kit
    case 'craftersKit': {
      openCrafting();
      break;
    }
    // Fishing rods - use on location
    case 'oldRod': case 'goodRod': case 'superRod': {
      if (!getLocationHasWater()) return showToast('Здесь негде рыбачить! Перейдите к водоёму.', true);
      if (!myTeam.some(m => m.currentHp > 0)) return showToast('Вам нужен хотя бы один живой покемон!', true);
      startFishing(itemId);
      break;
    }
    // PP Up
    case 'ppUp': {
      if (!mon.movesPP || mon.movesPP.length === 0) return showToast('У покемона нет атак!', true);
      const movesWithPP = mon.movesPP.map((pp, i) => {
        const moveName = mon.apiData?.moves?.[i]?.move?.name || `Атака ${i + 1}`;
        return { ...pp, moveName, index: i };
      }).filter(m => m && m.max > 0);
      if (movesWithPP.length === 0) return showToast('Нет атак для усиления!', true);
      const ppItems = movesWithPP.map(m => ({
        label: `${m.moveName}`,
        subtitle: `PP: ${m.current}/${m.max}`
      }));
      showSelectionModal('Выберите атаку для PP Up', ppItems, (choiceIdx) => {
        const picked = movesWithPP[choiceIdx];
        if (!picked) { showToast('Неверный выбор!', true); return; }
        const basePP = picked.max;
        const newMax = Math.floor(basePP * 1.2);
        if (newMax === basePP) { showToast('PP уже на максимуме!', true); return; }
        mon.movesPP[picked.index].max = newMax;
        mon.movesPP[picked.index].current = Math.min(mon.movesPP[picked.index].current + (newMax - basePP), newMax);
        removeItem('ppUp');
        refreshProfileUI();
        showToast(`PP атаки ${picked.moveName} увеличено до ${newMax}!`, false);
      }, true);
      return;
    }
    // EV vitamins
    case 'protein': case 'iron': case 'calcium': case 'zinc': case 'carbos': {
      const evKey = itemId === 'protein' ? 'atk' : itemId === 'iron' ? 'def' : itemId === 'calcium' ? 'spa' : itemId === 'zinc' ? 'spd' : 'spe';
      const totalEV = Object.values(mon.evs).reduce((s, v) => s + v, 0);
      if (mon.evs[evKey] >= 252) return showToast(`EV ${evKey.toUpperCase()} уже на максимуме (252)!`, true);
      if (totalEV >= 510) return showToast('Суммарные EV уже на максимуме (510)!', true);
      mon.evs[evKey] = Math.min(252, mon.evs[evKey] + 10);
      removeItem(itemId);
      if (currentPokemonIndex !== null) refreshProfileUI();
      showToast(`EV ${evKey.toUpperCase()} +10 (теперь ${mon.evs[evKey]})`, false);
      break;
    }
    default: {
      // Generic equip for battle items + special held items
      if ((item.category === 'battle' || item.id === 'luckyEgg' || item.id === 'expShare') && getItemQty(item.id) > 0) {
        if (!mon) { showToast('Сначала выберите покемона во вкладке Команда!', true); break; }
        if (mon.heldItem === itemId) { showToast('Этот предмет уже надет!', true); break; }
        if (mon.heldItem) {
          const heldName = itemDef(mon.heldItem).nameRu;
          showConfirmModal('Заменить предмет?', `Покемон держит ${heldName}. Заменить на ${item.nameRu}?`, () => {
            addItem(mon.heldItem);
            removeItem(itemId);
            mon.heldItem = itemId;
            refreshProfileUI();
            showToast(`${mon.nickname || mon.apiData.name} теперь держит ${item.nameRu}!`, false);
            autoSave();
          });
        } else {
          removeItem(itemId);
          mon.heldItem = itemId;
          refreshProfileUI();
          showToast(`${mon.nickname || mon.apiData.name} теперь держит ${item.nameRu}!`, false);
          autoSave();
        }
        break;
      }
      showToast(`${item.nameRu} скоро будет доступно!`, true);
      break;
    }
  }

  updateInventoryDisplay();
  autoSave();
}

// HELD_ITEMS array removed in favor of using ITEMS directly

function getHeldItemName(heldItem) {
  if (!heldItem) return 'Пусто';
  const item = ITEMS.find(i => i.id === heldItem);
  return item ? item.nameRu : heldItem;
}

function openHeldItemPicker(monIndex) {
  const mon = myTeam[monIndex];
  if (!mon) return;

  const choices = ITEMS.filter(item => {
    return (item.category === 'battle' || item.category === 'berries' || item.category === 'other') && getItemQty(item.id) > 0 && item.isUsable !== false;
  });

  const selectionItems = choices.map((item) => ({
    label: item.nameRu,
    subtitle: item.desc
  }));
  if (mon.heldItem) {
    selectionItems.unshift({ label: 'Снять предмет', subtitle: `Сейчас: ${getHeldItemName(mon.heldItem)}` });
  }

  showSelectionModal(`Предмет для ${mon.nickname || mon.apiData.name}`, selectionItems, (selIdx) => {
    if (mon.heldItem && selIdx === 0) {
      // Remove held item
      const itemId = mon.heldItem;
      addItem(itemId);
      mon.heldItem = null;
      if (mon.berries && mon.berries[itemId] !== undefined) mon.berries[itemId] = 0;
      refreshProfileUI();
      updateInventoryDisplay();
      autoSave();
      return;
    }

    const chosen = mon.heldItem ? choices[selIdx - 1] : choices[selIdx];
    if (chosen) {
      removeItem(chosen.id);

      // Return old held item if any
      if (mon.heldItem) {
        addItem(mon.heldItem);
        if (mon.berries && mon.berries[mon.heldItem] !== undefined) mon.berries[mon.heldItem] = 0;
      }

      mon.heldItem = chosen.id;
      if (chosen.category === 'berries') {
        if (!mon.berries) mon.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };
        mon.berries[chosen.id] = 1;
      }
      refreshProfileUI();
      updateInventoryDisplay();
      autoSave();
    }
  }, true);
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

function getTypeGradient(types) {
  if (!types || types.length === 0) return 'radial-gradient(circle at 50% 50%, #1a3050 0%, #0d1b2a 100%)';
  const c1 = getTypeColor(types[0].type.name);
  const c2 = types.length > 1 ? getTypeColor(types[1].type.name) : c1;
  return `radial-gradient(circle at 50% 50%, ${c1}dd 0%, ${c1}55 50%, ${c2}55 80%, ${c2}dd 100%)`;
}

function getSpriteUrl(mon) {
  const api = mon.apiData || mon;
  const isShiny = mon.isShiny || api.isShiny;
  if (isShiny) {
    return api.sprites?.other?.['official-artwork']?.front_shiny
        || api.sprites?.front_shiny
        || api.sprites?.other?.['official-artwork']?.front_default
        || api.sprites?.front_default
        || '';
  }
  return api.sprites?.other?.['official-artwork']?.front_default
      || api.sprites?.front_default
      || '';
}

function updateBattleSpriteBgs() {
  const playerBox = document.getElementById('player-sprite')?.closest('.reborn-sprite-box');
  if (playerBox && activePlayerMon?.apiData?.types) {
    playerBox.style.background = getTypeGradient(activePlayerMon.apiData.types);
  }
  const wildBox = document.getElementById('wild-sprite')?.closest('.reborn-sprite-box');
  if (wildBox && activeWild?.types) {
    wildBox.style.background = getTypeGradient(activeWild.types);
  }
  updateBattleHeldIcons();
}

const HELD_ITEM_ICONS = {
  sitrus: '🍊',
  oran: '🫐',
  lum: '🌈',
  chesto: '🌰',
  rawst: '🍓'
};

function updateBattleHeldIcons() {
  const playerIcon = document.getElementById('player-held-icon');
  const wildIcon = document.getElementById('wild-held-icon');
  if (playerIcon) {
    const itemId = activePlayerMon?.heldItem;
    if (itemId && HELD_ITEM_ICONS[itemId]) {
      playerIcon.innerText = HELD_ITEM_ICONS[itemId];
      playerIcon.style.display = '';
    } else {
      playerIcon.innerText = '';
      playerIcon.style.display = 'none';
    }
  }
  if (wildIcon) {
    const itemId = activeWild?.heldItem;
    if (itemId && HELD_ITEM_ICONS[itemId]) {
      wildIcon.innerText = HELD_ITEM_ICONS[itemId];
      wildIcon.style.display = '';
    } else {
      wildIcon.innerText = '';
      wildIcon.style.display = 'none';
    }
  }
}

function setTypeBg(id, types) {
  const el = document.getElementById(id);
  if (el && types) {
    if (el.tagName === 'IMG') {
      el.style.background = getTypeGradient(types);
    } else {
      el.style.background = getTypeGradient(types);
    }
  }
}

// --- NEW PROFILE UX LOGIC ---
function initProfileUXEvents() {
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
        showToast('Нет свободных EV! Дайте покемону Конфеты (+4 EV) или Витамины (+10 EV).', true);
      }
    });
  });
}

// ================================================================
// CLOUD SYNC & TELEGRAM AUTH
// ================================================================

function initTelegram() {
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
  }
}

function showLoginScreen(message, isError) {
  let overlay = document.getElementById('login-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:var(--tma-bg);z-index:999;display:flex;align-items:center;justify-content:center;flex-direction:column;transition:opacity 0.5s;';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="text-align:center;max-width:320px;padding:24px;">
      <div style="font-size:4rem;margin-bottom:16px;">${isError ? '🔒' : '🐾'}</div>
      <h2 style="margin:0 0 8px;">PokeMatrix</h2>
      <p style="color:var(--tma-text-muted);margin:0 0 20px;font-size:0.9rem;">${message}</p>
      ${isError ? '<p style="color:var(--tma-text-muted);font-size:0.8rem;">Откройте игру через Telegram бота</p>' : '<div class="login-spinner" style="width:32px;height:32px;border:3px solid var(--tma-border);border-top-color:var(--tma-primary);border-radius:50%;margin:0 auto;animation:spin 0.8s linear infinite;"></div>'}
    </div>
  `;
  overlay.style.display = 'flex';
}

function hideLoginScreen() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 500);
  }
}

async function showRegistrationScreen(tgData) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'register-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:var(--tma-bg);z-index:1000;display:flex;align-items:center;justify-content:center;flex-direction:column;overflow-y:auto;padding:20px;';
    overlay.innerHTML = `
      <div style="text-align:center;max-width:360px;width:100%;">
        <div style="font-size:4rem;margin-bottom:8px;">👋</div>
        <h2 style="margin:0 0 4px;">Добро пожаловать!</h2>
        <p style="color:var(--tma-text-muted);margin:0 0 20px;font-size:0.85rem;">Давай создадим твой профиль тренера</p>

        <div style="text-align:left;margin-bottom:16px;">
          <label style="font-size:0.8rem;color:var(--tma-text-muted);">Прозвище тренера</label>
          <input id="reg-nickname" type="text" value="${tgData.first_name || tgData.username || ''}" maxlength="20" style="width:100%;padding:10px;margin:4px 0 12px;border:1px solid var(--tma-border);border-radius:8px;background:var(--tma-card-bg);color:var(--tma-text);font-size:1rem;">

          <label style="font-size:0.8rem;color:var(--tma-text-muted);">Аватар</label>
          <div style="display:flex;align-items:center;gap:8px;margin:4px 0 8px;">
            <div id="reg-avatar-preview" style="width:56px;height:56px;border-radius:50%;background:var(--tma-card-bg);display:flex;align-items:center;justify-content:center;font-size:2rem;border:2px solid var(--tma-primary);flex-shrink:0;">👤</div>
            <input type="file" id="reg-avatar-file" accept="image/*" style="display:none;">
            <button class="tma-btn" id="reg-avatar-camera" style="padding:8px 12px;font-size:0.8rem;background:var(--tma-card-bg);">📷 Фото</button>
          </div>
          <div id="reg-avatars" style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px;">
            ${['👤','🧑','👨‍🔬','🎩','🧢','🎓','👑','🤠','🦸','🧙','😎','🤖','👻','🐱','🐶'].map(a => `<span class="reg-avatar-opt" data-av="${a}" style="font-size:1.8rem;cursor:pointer;padding:4px;border-radius:8px;border:2px solid transparent;">${a}</span>`).join('')}
          </div>

        </div>

        <button class="tma-btn" id="btn-register" style="width:100%;padding:12px;background:#34c759;font-size:1rem;">🎮 Начать приключение!</button>
        <p id="reg-error" style="color:#ff3b30;font-size:0.8rem;margin-top:8px;display:none;"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    let selectedAvatar = '👤';
    let customAvatarData = null;

    // Camera/gallery upload
    document.getElementById('reg-avatar-camera').addEventListener('click', () => {
      document.getElementById('reg-avatar-file').click();
    });
    document.getElementById('reg-avatar-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        customAvatarData = ev.target.result;
        document.getElementById('reg-avatar-preview').innerHTML = `<img src="${customAvatarData}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        selectedAvatar = '__custom__';
        overlay.querySelectorAll('.reg-avatar-opt').forEach(el => el.style.borderColor = 'transparent');
      };
      reader.readAsDataURL(file);
    });

    overlay.querySelectorAll('.reg-avatar-opt').forEach(el => {
      el.addEventListener('click', () => {
        overlay.querySelectorAll('.reg-avatar-opt').forEach(e => e.style.borderColor = 'transparent');
        el.style.borderColor = 'var(--tma-primary)';
        selectedAvatar = el.getAttribute('data-av');
      });
    });

    document.getElementById('btn-register').addEventListener('click', async () => {
      const nickname = document.getElementById('reg-nickname').value.trim();
      if (!nickname) { document.getElementById('reg-error').style.display = 'block'; document.getElementById('reg-error').textContent = 'Введи прозвище!'; return; }

      try {
        // Upload custom avatar first if selected
        let finalAvatar = selectedAvatar;
        if (customAvatarData) {
          const upRes = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: { ...getCloudAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: customAvatarData })
          });
          if (upRes.ok) {
            const upData = await upRes.json();
            finalAvatar = upData.avatarUrl;
          }
        }

        await fetch('/api/auth/register', {
          method: 'POST',
          headers: { ...getCloudAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname, avatar: finalAvatar })
        });
        trainerNickname = nickname;
        localStorage.setItem(lsKey('avatar'), selectedAvatar);
        localStorage.setItem(lsKey('nickname_'), nickname);
        tgUser.registered = 1;
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s';
        setTimeout(() => { overlay.remove(); resolve(true); }, 500);
      } catch(e) { document.getElementById('reg-error').style.display = 'block'; document.getElementById('reg-error').textContent = 'Ошибка сервера'; }
    });
  });
}

async function authTelegram() {
  initTelegram();
  showLoginScreen('Авторизация через Telegram...', false);

  // Dev mode: allow localhost testing without Telegram
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const devMode = new URLSearchParams(window.location.search).has('dev');

  if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) {
    if (isLocalhost || devMode) {
      console.log('🔧 Dev mode: bypassing Telegram auth');
    } else {
      showLoginScreen('Игра доступна только через Telegram', true);
      return;
    }
  }

  try {
    const initData = (isLocalhost || devMode) ? 'test' : window.Telegram.WebApp.initData;
    const res = await fetch(`${API_BASE}/auth/tg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData })
    });
    if (!res.ok) {
      showLoginScreen('Ошибка авторизации. Попробуйте перезапустить бота.', true);
      return;
    }
    const data = await res.json();
    tgToken = data.token;
    tgUser = data.user;
    localStorage.setItem('league17_trainer_id', String(tgUser.id));

    hideLoginScreen();

    // Check if registration needed — wait for it
    if (!data.user.registered) {
      await showRegistrationScreen(data.user);
      // Reload user data after registration
      tgUser.registered = 1;
    }
  } catch (e) {
    console.warn('Auth failed (offline?)', e);
    showLoginScreen('Нет соединения с сервером. Проверьте интернет.', true);
  }
}

function getCloudAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(tgToken ? { 'Authorization': `Bearer ${tgToken}` } : {})
  };
}

function getLeaderboardData() {
  const badgesCount = badges ? badges.length : 0;
  const teamLevelSum = myTeam.reduce((sum, mon) => sum + (mon.baseLevel || 1), 0);
  const pokemonCount = pokedexCaught.size;
  const legendaryCount = myTeam.reduce((c, m) => c + (m.apiData?.name && LEGENDARY_SET.has(m.apiData.name) ? 1 : 0), 0);
  return { badgesCount, teamLevelSum, money, pokemonCount, legendaryCount };
}

function cloudSave() {
  if (!tgToken) return;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => doCloudSave(), 2000);
}

async function doCloudSave(attempt = 0) {
  validateGameState();
  const saveData = getFullSaveData();
  const lb = getLeaderboardData();

  try {
    const res = await fetch(`${API_BASE}/save`, {
      method: 'POST',
      headers: getCloudAuthHeaders(),
      body: JSON.stringify({ saveData, ...lb, saveVersion })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    lastCloudSync = Date.now();
    saveRetryCount = 0;
    localStorage.setItem(lsKey('save_sync'), String(lastCloudSync));
    const btnSync = document.getElementById('btn-cloud-sync');
    if (btnSync) { btnSync.textContent = '☁️✓'; setTimeout(() => { btnSync.textContent = '☁️ Авто'; }, 1500); }
    return result;
  } catch (e) {
    console.warn(`Cloud save failed (attempt ${attempt + 1}/${MAX_RETRIES})`, e.message);
    if (attempt < MAX_RETRIES - 1) {
      saveRetryCount = attempt + 1;
      const delay = RETRY_DELAYS[attempt];
      setTimeout(() => doCloudSave(attempt + 1), delay);
    } else {
      saveRetryCount = MAX_RETRIES;
      const btnSync = document.getElementById('btn-cloud-sync');
      if (btnSync) { btnSync.textContent = '☁️✗'; setTimeout(() => { btnSync.textContent = '☁️ Авто'; }, 3000); }
    }
  }
}

async function cloudLoad() {
  if (!tgToken) return null;
  try {
    const res = await fetch(`${API_BASE}/save`, { headers: getCloudAuthHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.saveData;
  } catch (e) {
    console.warn('Cloud load failed', e);
    return null;
  }
}

function applyCloudSave(data) {
  if (!data || !data.myTeam) return;
  const cloudV = data._v || 0;
  if (cloudV <= saveVersion) return; // Server is older or same — skip

  // Server has newer data — use it
  console.log(`[sync] Server v${cloudV} > local v${saveVersion} — applying server data`);
  currentLocationId = data.currentLocationId || currentLocationId;
  currentRegion = data.currentRegion || currentRegion;
  if (currentRegion === 'tevas_islands') currentRegion = 'southern_archipelago';
  if (!REGIONS[currentRegion]) currentRegion = 'kanto';
  if (!getLocation(currentLocationId)) {
    currentLocationId = 'pallet_town';
    currentRegion = 'kanto';
  }
  if (data.inventory) inventory = { ...data.inventory };
  money = data.money ?? money;
  badges = data.badges || badges;
  trainerNickname = data.trainerNickname || trainerNickname;
  myTeam = data.myTeam || myTeam;
  myTeam.forEach(m => {
    if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (!m.learnableMoves) m.learnableMoves = [];
    if (!m.berries) m.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };
  });
  currentPokemonIndex = data.currentPokemonIndex ?? currentPokemonIndex;
  pokedexSeen = new Set(data.pokedexSeen || []);
  pokedexCaught = new Set(data.pokedexCaught || []);
  pcBoxes = data.pcBoxes || pcBoxes;
  pcBoxes.forEach(box => box.forEach(m => {
    if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  }));
  daycareMons = data.daycareMons || daycareMons;
  daycareEgg = data.daycareEgg || daycareEgg;
  lastLocation = data.lastLocation || lastLocation;
  expShareActive = data.expShareActive || expShareActive;
  breedingPairs = data.breedingPairs || breedingPairs;
  eggs = data.eggs || eggs;
  quests = data.quests || quests;
  questProgress = data.questProgress || questProgress;
  completedQuests = data.completedQuests || completedQuests;
  npcQuestProgress = data.npcQuestProgress || npcQuestProgress;
  completedNPCQuests = data.completedNPCQuests || completedNPCQuests;
  tutorialStep = data.tutorialStep || tutorialStep;
  visitedLocations = new Set(data.visitedLocations || []);
  itemsUsedInBattle = data.itemsUsedInBattle || itemsUsedInBattle;
  itemHistory = data.itemHistory || itemHistory;
  saveVersion = cloudV;
  validateGameState();

  // Save reconciled state locally
  saveGame();
  console.log('[sync] Applied server save v' + cloudV);
}

async function openLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  const list = document.getElementById('leaderboard-list');
  if (!modal) return;

  modal.style.display = 'flex';
  list.innerHTML = '<div class="leaderboard-loading">Загрузка...</div>';

  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const data = await res.json();

    if (!data.entries || data.entries.length === 0) {
      list.innerHTML = '<div class="leaderboard-empty">Таблица лидеров пуста</div>';
      return;
    }

    let html = '';
    data.entries.forEach((entry, i) => {
      const name = entry.first_name || entry.username || 'Trainer';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const pkmn = entry.pokemon_count || 0;
      const leg = entry.legendary_count || 0;
      html += `
        <div class="leaderboard-entry">
          <span class="leaderboard-rank">${medal}</span>
          <span class="leaderboard-name">${escHtml(name)}</span>
          <span class="leaderboard-badges">🏅${entry.badges_count}</span>
          <span class="leaderboard-stat">🐾${pkmn}</span>
          <span class="leaderboard-stat">✨${leg}</span>
          <span class="leaderboard-money">¥${entry.money || 0}</span>
        </div>`;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<div class="leaderboard-error">Не удалось загрузить таблицу лидеров</div>';
  }
}

function initCloudEvents() {
  const btnLeaderboard = document.getElementById('btn-leaderboard');
  if (btnLeaderboard) {
    btnLeaderboard.addEventListener('click', openLeaderboard);
  }
  const btnSync = document.getElementById('btn-cloud-sync');
  if (btnSync) {
    btnSync.textContent = tgToken ? '☁️ Авто' : '☁️ —';
    btnSync.title = tgToken ? 'Авто-синхронизация активна' : 'Оффлайн';
    btnSync.onclick = null; // auto-sync, no manual click needed
  }
  const closeLeaderboard = document.getElementById('btn-close-leaderboard');
  if (closeLeaderboard) {
    closeLeaderboard.addEventListener('click', () => {
      document.getElementById('leaderboard-modal').style.display = 'none';
    });
  }
}

// ================================================================
// FEATURE: EVOLUTION
// ================================================================
async function fetchEvolutionChain(pokemonName) {
  try {
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonName}`);
    const speciesData = await speciesRes.json();
    const chainRes = await fetch(speciesData.evolution_chain.url);
    const chainData = await chainRes.json();
    let chain = chainData.chain;
    // Traverse full chain tree and populate both forward + reverse maps
    const queue = [chain];
    while (queue.length > 0) {
      const node = queue.shift();
      const curName = node.species.name;
      if (!evolutionCache[curName]) evolutionCache[curName] = node.evolves_to;
      for (const child of node.evolves_to) {
        const childName = child.species.name;
        if (!evolvesFromMap[childName]) evolvesFromMap[childName] = [];
        if (!evolvesFromMap[childName].includes(curName)) evolvesFromMap[childName].push(curName);
        queue.push(child);
      }
    }
    return evolutionCache[pokemonName] || [];
  } catch (e) {
    console.warn('Evolution fetch failed for', pokemonName, e);
    evolutionCache[pokemonName] = [];
    return [];
  }
}

async function getEvolutions(pokemonName) {
  if (evolutionCache[pokemonName] !== undefined) {
    // Reverse map may be empty if cached before the fix — populate it
    if (evolvesFromMap[pokemonName] === undefined) {
      await fetchEvolutionChain(pokemonName);
    }
    return evolutionCache[pokemonName].map(evo => {
      const d = evo.evolution_details && evo.evolution_details[0] ? evo.evolution_details[0] : {};
      return {
        name: evo.species.name,
        minLevel: d.min_level || null,
        trigger: d.trigger ? d.trigger.name : null,
        item: d.item ? d.item.name : null
      };
    });
  }
  const chain = await fetchEvolutionChain(pokemonName);
  return chain.map(evo => {
    const d = evo.evolution_details && evo.evolution_details[0] ? evo.evolution_details[0] : {};
    return {
      name: evo.species.name,
      minLevel: d.min_level || null,
      trigger: d.trigger ? d.trigger.name : null,
      item: d.item ? d.item.name : null
    };
  });
}

async function checkEvolution(pokemon, useStone = false, stoneItem = null) {
  const evos = await getEvolutions(pokemon.apiData.name);
  const effectiveLevel = pokemon.baseLevel + (pokemon.candiesEaten || 0);
  for (const evo of evos) {
    if (evo.minLevel && effectiveLevel >= evo.minLevel) {
      return evo;
    }
    if (useStone && evo.trigger === 'use-item') {
      if (stoneItem && STONE_ITEM_MAP[stoneItem]) {
        // evo.item is a string (item name), not an object
        if (evo.item && evo.item === STONE_ITEM_MAP[stoneItem]) {
          return evo;
        }
      } else {
        return evo;
      }
    }
  }
  return null;
}

async function triggerEvolution(pokemon, targetName) {
  const overlay = document.getElementById('evolution-overlay');
  const evoSprite = document.getElementById('evo-sprite');
  const evoText = document.getElementById('evo-text');
  if (!overlay) return;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const oldName = pokemon.apiData.name;
  const oldSprite = pokemon.apiData.sprites?.other?.['official-artwork']?.front_default || pokemon.apiData.sprites?.front_default || '';
  const evoBox = evoSprite.closest('.evo-sprite-box');
  overlay.style.display = 'flex';

  // Stage 1: "What?!" — old sprite with shake animation
  evoText.innerHTML = `<span class="evo-shake">Что?!</span><br><small>${oldName} эволюционирует!</small>`;
  evoSprite.src = oldSprite;
  if (evoBox) { evoBox.style.background = getTypeGradient(pokemon.apiData.types); evoBox.classList.add('evo-flash'); }
  await wait(2200);

  // Stage 2: Brightness flashes
  evoText.innerHTML = '✨ <span class="evo-glowing">Эволюция!</span> ✨';
  evoSprite.style.filter = 'brightness(3)';
  await wait(700);
  evoSprite.style.filter = 'brightness(0.3)';
  await wait(400);
  evoSprite.style.filter = 'brightness(2.5)';
  await wait(500);
  evoSprite.style.filter = 'brightness(1)';

  // Stage 3: Fetch new form
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${targetName}`);
    const newData = await res.json();
    pokemon.apiData = newData;

    const baseHp = newData.stats[0].base_stat;
    const curLvl = pokemon.baseLevel + (pokemon.candiesEaten || 0);
    const newMaxHp = Math.floor(0.01 * (2 * baseHp + pokemon.ivs.hp + Math.floor(0.25 * pokemon.evs.hp)) * curLvl) + curLvl + 10;
    const oldMaxHp = pokemon.maxHp;
    pokemon.maxHp = newMaxHp;
    pokemon.currentHp = Math.min(pokemon.currentHp + (newMaxHp - oldMaxHp), newMaxHp);

    // Stage 4: Reveal new sprite
    evoSprite.src = newData.sprites?.other?.['official-artwork']?.front_default || newData.sprites?.front_default || '';
    if (evoBox) evoBox.style.background = getTypeGradient(newData.types);
    evoText.innerHTML = `<b>${targetName.toUpperCase()}!</b>`;
    evoSprite.style.filter = 'brightness(1.3) drop-shadow(0 0 20px gold)';
    evoBox?.classList.remove('evo-flash');
    evoBox?.classList.add('evo-reveal');
    await wait(1800);

    // Stage 5: Show stats
    const newStars = getPowerStars(pokemon);
    const bst = newData.stats.reduce((s, st) => s + st.base_stat, 0);
    const types = newData.types.map(t => t.type.name).join(', ');
    evoText.innerHTML = `
      <b>${targetName.toUpperCase()}</b><br>
      <small style="color:#aaa">${types} | BST: ${bst}</small><br>
      <span style="color:#ff9500;font-size:1rem;">${'★'.repeat(newStars)}${'☆'.repeat(10-newStars)}</span><br>
      <small style="color:#5af">HP: ${oldMaxHp} → ${newMaxHp}</small>
    `;
    evoBox?.classList.remove('evo-reveal');
    await wait(3000);
  } catch (e) {
    console.warn('Evolution fetch failed for', targetName, e);
    evoText.innerHTML = 'Ошибка эволюции...';
    await wait(2000);
  }

  evoSprite.style.filter = '';
  evoBox?.classList.remove('evo-flash', 'evo-reveal');
  overlay.style.display = 'none';
}

// ================================================================
// FEATURE: POKEDEX
// ================================================================
function getPokedexId(speciesName) {
  const idx = POKEDEX_ALL.indexOf(speciesName);
  return idx >= 0 ? idx + 1 : -1;
}

function openPokedex() {
  const modal = document.getElementById('pokedex-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const grid = document.getElementById('pokedex-grid');
  const countEl = document.getElementById('pokedex-count');
  const searchEl = document.getElementById('pokedex-search');
  const detailEl = document.getElementById('pokedex-detail');
  const genFilter = document.getElementById('pokedex-gen-filter');
  const statusFilter = document.getElementById('pokedex-status-filter');

  if (detailEl) detailEl.style.display = 'none';
  if (searchEl) { searchEl.value = ''; searchEl.style.display = 'block'; }
  if (grid) { grid.style.display = 'grid'; grid.style.visibility = 'visible'; grid.style.position = 'relative'; }
  if (genFilter) genFilter.value = 'all';
  if (statusFilter) statusFilter.value = 'all';

  function renderGrid() {
    grid.innerHTML = '';
    const searchTerm = searchEl?.value.toLowerCase().trim() || '';
    const genVal = genFilter?.value || 'all';
    const statusVal = statusFilter?.value || 'all';

    let visible = 0;
    POKEDEX_ALL.forEach((name, idx) => {
      const dexId = idx + 1;

      // Generation filter
      if (genVal !== 'all') {
        const gen = parseInt(genVal);
        if (gen === 1 && dexId > 151) return;
        if (gen === 2 && (dexId < 152 || dexId > 251)) return;
        if (gen === 3 && (dexId < 252 || dexId > 386)) return;
        if (gen === 4 && dexId < 387) return;
      }

      // Status filter
      const isCaught = pokedexCaught.has(name);
      const isSeen = pokedexSeen.has(name);
      if (statusVal === 'caught' && !isCaught) return;
      if (statusVal === 'seen' && !isSeen) return;
      if (statusVal === 'unknown' && (isCaught || isSeen)) return;

      // Search filter
      if (searchTerm) {
        if (!name.includes(searchTerm) && String(dexId) !== searchTerm) return;
      }

      visible++;
      const cell = document.createElement('div');
      cell.className = 'pokedex-cell';

      let statusClass = 'unknown';
      if (isCaught) statusClass = 'caught';
      else if (isSeen) statusClass = 'seen';

      cell.classList.add(statusClass);
      cell.innerHTML = `
        <span class="dex-num">#${dexId}</span>
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${name}.png" alt="${name}" loading="lazy" onerror="this.style.opacity='0.3'">
        <span class="poke-name">${name}</span>
      `;
      grid.appendChild(cell);
      cell.addEventListener('click', () => showPokedexInfo(name));
    });

    countEl.innerText = `Поймано: ${pokedexCaught.size} / ${pokedexTotal}`;
  }

  renderGrid();

  searchEl.oninput = renderGrid;
  if (genFilter) genFilter.onchange = renderGrid;
  if (statusFilter) statusFilter.onchange = renderGrid;
}

async function showPokedexInfo(speciesName) {
  const detailEl = document.getElementById('pokedex-detail');
  const gridEl = document.getElementById('pokedex-grid');
  const searchEl = document.getElementById('pokedex-search');
  const filtersEl = document.getElementById('pokedex-filters');
  if (!detailEl || !gridEl) return;

  gridEl.style.visibility = 'hidden';
  gridEl.style.position = 'absolute';
  if (searchEl) searchEl.style.display = 'none';
  if (filtersEl) filtersEl.style.display = 'none';
  detailEl.style.display = 'flex';
  detailEl.innerHTML = '<div class="pokedex-detail-loading">Загрузка...</div>';

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesName}`);
    const data = await res.json();

    const types = data.types.map(t => `<span class="type-badge" style="background-color:${getTypeColor(t.type.name)}">${t.type.name}</span>`).join('');

    let statusText = '❓ Неизвестен';
    let statusClass = 'unknown';
    if (pokedexCaught.has(speciesName)) {
      statusText = '✅ Пойман';
      statusClass = 'caught';
    } else if (pokedexSeen.has(speciesName)) {
      statusText = '👁️ Замечен';
      statusClass = 'seen';
    }

    const statColors = { hp: '#ff3b30', attack: '#ff9500', defense: '#ffcc00', 'special-attack': '#5ac8fa', 'special-defense': '#4cd964', speed: '#007aff' };
    const statNames = { hp: 'HP', attack: 'Атк', defense: 'Защ', 'special-attack': 'СпА', 'special-defense': 'СпЗ', speed: 'Скор' };

    const statsHtml = data.stats.map(s => {
      const base = s.base_stat;
      const pct = Math.min(100, (base / 255) * 100);
      const color = statColors[s.stat.name] || '#777';
      return `<div class="pokedex-detail-stat">
        <span class="stat-label">${statNames[s.stat.name] || s.stat.name}</span>
        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="stat-value">${base}</span>
      </div>`;
    }).join('');

    const spriteUrl = data.sprites?.other?.['official-artwork']?.front_default || data.sprites.front_default;
    const shinyUrl = data.sprites?.other?.['official-artwork']?.front_shiny || data.sprites.front_shiny;
    const detailTypeBg = getTypeGradient(data.types);

    // Find gym leaders using this Pokemon
    const gymUsers = [];
    for (const [key, leader] of Object.entries(gymLeaders)) {
      if (leader.team) {
        const names = leader.team.flatMap(m => m.name ? [m.name] : []);
        if (names.some(n => n.replace('_2','') === speciesName)) gymUsers.push(leader.name);
      }
    }

    // Evolution info
    const evolutions = await getEvolutions(speciesName);
    let evoHtml = '';
    if (evolutions.length > 0) {
      evoHtml = `<div class="pokedex-detail-method" style="background:rgba(52,199,89,0.1);border-color:#34c759;">
        <div class="method-row"><b>🔮 Эволюции:</b></div>
        ${evolutions.map(evo => {
          const cond = evo.minLevel ? `Ур.${evo.minLevel}` : evo.trigger === 'use-item' ? (evo.item || 'Камень') : (evo.trigger || 'Особая');
          return `<div class="method-row" style="cursor:pointer;color:var(--tma-primary);margin-top:3px;" onclick="showPokedexInfo('${evo.name}')">→ ${evo.name} (${cond})</div>`;
        }).join('')}
      </div>`;
    }

    // Find pokemon that evolve INTO this one (from reverse map populated by chain fetch above)
    const evolvesFrom = evolvesFromMap[speciesName] || [];
    let prevoHtml = '';
    if (evolvesFrom.length > 0) {
      prevoHtml = `<div class="pokedex-detail-method" style="background:rgba(0,122,255,0.1);border-color:#007aff;">
        <div class="method-row"><b>Эволюция из:</b></div>
        ${evolvesFrom.map(name => `<div class="method-row" style="cursor:pointer;color:var(--tma-primary);margin-top:3px;" onclick="showPokedexInfo('${name}')">← ${name}</div>`).join('')}
      </div>`;
    }

    // Prev/Next navigation
    const curIdx = POKEDEX_ALL.indexOf(speciesName);
    const prevName = curIdx > 0 ? POKEDEX_ALL[curIdx - 1] : null;
    const nextName = curIdx < POKEDEX_ALL.length - 1 ? POKEDEX_ALL[curIdx + 1] : null;

    detailEl.innerHTML = `
      <button class="pokedex-detail-back" id="pokedex-detail-back">← Назад</button>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        ${prevName ? `<button class="pokedex-detail-back" style="flex:1;text-align:center;margin:0;padding:6px;" onclick="showPokedexInfo('${prevName}')">◀ ${prevName}</button>` : '<span style="flex:1;"></span>'}
        ${nextName ? `<button class="pokedex-detail-back" style="flex:1;text-align:center;margin:0;padding:6px;" onclick="showPokedexInfo('${nextName}')">${nextName} ▶</button>` : '<span style="flex:1;"></span>'}
      </div>
      <div class="pokedex-detail-header">
        <div class="pokedex-detail-sprite-box" style="background:${detailTypeBg};" id="dex-sprite-box">
          <img class="pokedex-detail-sprite" id="dex-sprite" src="${spriteUrl}" alt="${data.name}">
        </div>
        <div class="pokedex-detail-title">
          <h2>${data.name}</h2>
          <span class="dex-number">#${String(data.id).padStart(3, '0')}</span>
          <div class="pokedex-detail-types">${types}</div>
          <button id="btn-shiny-toggle" style="margin-top:4px;padding:2px 8px;font-size:0.7rem;background:var(--tma-bg);border:1px solid var(--tma-border);color:var(--tma-text);border-radius:4px;cursor:pointer;">✨ Шайни</button>
        </div>
      </div>
      <div class="pokedex-detail-status ${statusClass}">${statusText}</div>
      <div style="display:flex;justify-content:space-around;font-size:0.7rem;margin:4px 0;">
        <span>${getPowerStars({apiData:data})}★ мощи</span>
        <span>${getRarityStars({apiData:data})}✦ редкость</span>
      </div>
      ${pokedexData[speciesName] ? `
      <div class="pokedex-detail-method">
        <div class="method-row"><b>Способ:</b> ${pokedexData[speciesName].method}</div>
        <div class="method-row"><b>Где:</b> ${pokedexData[speciesName].location}</div>
      </div>` : ''}
      ${gymUsers.length > 0 ? `
      <div class="pokedex-detail-method" style="background:rgba(175,82,222,0.15);border-color:#af52de;">
        <div class="method-row"><b>⚔ Используется лидерами:</b> ${gymUsers.join(', ')}</div>
      </div>` : ''}
      ${prevoHtml}
      ${evoHtml}
      <div class="pokedex-detail-stats">
        <h4>Базовые статы</h4>
        ${statsHtml}
      </div>
    `;

    // Shiny toggle
    let showingShiny = false;
    document.getElementById('btn-shiny-toggle').addEventListener('click', () => {
      showingShiny = !showingShiny;
      document.getElementById('dex-sprite').src = showingShiny ? (shinyUrl || spriteUrl) : spriteUrl;
      document.getElementById('btn-shiny-toggle').textContent = showingShiny ? '✨ Обычный' : '✨ Шайни';
      if (showingShiny && shinyUrl) {
        document.getElementById('dex-sprite-box').style.background = 'radial-gradient(circle, #3a2a5a 0%, #1a1a3a 100%)';
      } else {
        document.getElementById('dex-sprite-box').style.background = detailTypeBg;
      }
    });

    document.getElementById('pokedex-detail-back').addEventListener('click', () => {
      detailEl.style.display = 'none';
      gridEl.style.visibility = 'visible';
      gridEl.style.position = 'relative';
      if (searchEl) searchEl.style.display = 'block';
      if (filtersEl) filtersEl.style.display = 'flex';
    });

  } catch (e) {
    detailEl.innerHTML = '<div class="pokedex-detail-loading">Ошибка загрузки</div>';
  }
}

window.showPokedexInfo = showPokedexInfo;

// ================================================================
// ================================================================
function updateTimeOfDay() {
  const hour = new Date().getHours();
  isDaytime = hour >= 6 && hour < 18;
  const card = document.querySelector('.location-card');
  if (card) {
    if (isDaytime) {
      card.classList.remove('night');
    } else {
      card.classList.add('night');
    }
  }
}

// ================================================================
// FEATURE: LEVEL-UP MOVE LEARNING
// ================================================================
async function checkNewMovesOnLevelUp(pokemon, newLevel) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.apiData.id}`);
    const pokeData = await res.json();
    const allMoves = pokeData.moves || [];
    const knownNames = new Set((pokemon.apiData.moves || []).filter(m => m).map(m => m.move.name));

    const prevCheckLevel = pokemon.lastMoveCheckLevel || 1;
    const newMoves = [];
    for (const entry of allMoves) {
      for (const detail of entry.version_group_details) {
        if (detail.move_learn_method.name === 'level-up' && detail.level_learned_at > prevCheckLevel && detail.level_learned_at <= newLevel) {
          if (!knownNames.has(entry.move.name)) {
            newMoves.push(entry.move);
          }
          break;
        }
      }
    }
    pokemon.lastMoveCheckLevel = newLevel;

    for (const move of newMoves) {
      const learned = await offerLearnMove(pokemon, move);
      if (learned) {
        knownNames.add(move.name);
        // Ensure PP tracking
        try {
          const moveRes = await fetch(move.url);
          const moveData = await moveRes.json();
          const slot = pokemon.apiData.moves.findIndex(m => m && m.move.name === move.name);
          if (slot >= 0 && moveData.pp) {
            if (!pokemon.movesPP) pokemon.movesPP = [];
            if (!pokemon.movesPP[slot]) pokemon.movesPP[slot] = {};
            pokemon.movesPP[slot] = { current: moveData.pp || 30, max: moveData.pp || 30 };
          }
        } catch (e) { console.warn('Failed to init PP for move', move.name, e); }
      }
    }
  } catch (e) {
    console.warn('Failed to check new moves for', pokemon.apiData.name, e);
  }
}

function offerLearnMove(pokemon, move) {
  return new Promise((resolve) => {
    const moveName = move.name;
    const monName = pokemon.nickname || pokemon.apiData.name;

    // Find empty slot or show picker
    const emptySlot = (pokemon.apiData.moves || []).findIndex(m => !m);
    if (emptySlot >= 0) {
      const url = move.url || `https://pokeapi.co/api/v2/move/${moveName}/`;
      if (!pokemon.apiData.moves[emptySlot]) {
        pokemon.apiData.moves[emptySlot] = { move: { name: moveName, url } };
      }
      appendToLog(`${monName} выучил ${moveName}!`, false, 'system');
      resolve(true);
      return;
    }

    // All slots full — ask which to replace
    const slotItems = (pokemon.apiData.moves || []).filter(m => m).map((m, i) => ({
      label: m.move.name,
      subtitle: `Слот ${i + 1}`
    }));
    slotItems.push({ label: 'Отказаться', subtitle: 'Сохранить в резерв' });
    showSelectionModal(`Заменить атаку на ${moveName}?`, slotItems, (pick) => {
      const url = move.url || `https://pokeapi.co/api/v2/move/${moveName}/`;
      if (pick < 4) {
        const oldMove = pokemon.apiData.moves[pick]?.move?.name || 'неизвестную атаку';
        pokemon.apiData.moves[pick].move = { name: moveName, url };
        appendToLog(`${monName} забыл ${oldMove} и выучил ${moveName}!`, false, 'system');
        resolve(true);
      } else {
        // Save to reserve
        if (!pokemon.learnableMoves) pokemon.learnableMoves = [];
        if (!pokemon.learnableMoves.some(m => m.name === moveName)) {
          pokemon.learnableMoves.push({ name: moveName, url, power: move.power || 0, type: move.type?.name || 'normal' });
        }
        appendToLog(`${monName} не стал учить ${moveName}. Атака сохранена в резерв.`, false, 'system');
        resolve(false);
      }
    }, true);
  });
}

// ================================================================
// FEATURE: TM MOVE RELEARNER
// ================================================================
async function fetchLearnableMoves(mon) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${mon.apiData.id}`);
    const data = await res.json();
    const allMoves = (data.moves || []).slice(0, 100);
    const knownNames = new Set((mon.apiData.moves || []).filter(m => m).map(m => m.move.name));
    const existingNames = new Set((mon.learnableMoves || []).map(m => m.name));
    if (!mon.learnableMoves) mon.learnableMoves = [];

    for (const entry of allMoves) {
      const name = entry.move.name;
      if (knownNames.has(name) || existingNames.has(name)) continue;
      try {
        const moveRes = await fetch(entry.move.url);
        const moveData = await moveRes.json();
        if (moveData.power && moveData.power > 0) {
          mon.learnableMoves.push({
            name: moveData.name,
            url: entry.move.url,
            power: moveData.power,
            type: moveData.type?.name || 'normal'
          });
        }
      } catch (e) { /* skip failed moves */ }
      if (mon.learnableMoves.length >= 50) break;
    }
    refreshProfileUI();
    autoSave();
  } catch (e) { console.warn('fetchLearnableMoves failed', e); }
}

async function openMoveRelearner() {
  if (currentPokemonIndex === null) return showToast('Сначала выберите покемона во вкладке "Команда"!', true);
  if (getItemQty('tm') <= 0) return showToast('У вас нет TM-совместимости!', true);

  const mon = myTeam[currentPokemonIndex];
  const modal = document.getElementById('tm-modal');
  if (!modal) return;

  document.getElementById('tm-pokemon-name').innerText = `${mon.nickname || mon.apiData.name} (Lv${mon.baseLevel + mon.candiesEaten})`;

  const currentList = document.getElementById('tm-current-list');
  currentList.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const moveEl = document.createElement('div');
    moveEl.className = 'tm-current-move';
    if (mon.apiData.moves[i]) {
      const ppDisplay = (mon.movesPP && mon.movesPP[i]) ? `${mon.movesPP[i].current}/${mon.movesPP[i].max}` : '30/30';
      moveEl.innerText = `${i + 1}. ${mon.apiData.moves[i].move.name} (PP ${ppDisplay})`;
    } else {
      moveEl.innerText = `${i + 1}. -`;
    }
    currentList.appendChild(moveEl);
  }

  const availableList = document.getElementById('tm-available-list');
  availableList.innerHTML = '<div class="tm-loading">Загрузка доступных атак...</div>';
  modal.style.display = 'flex';

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${mon.apiData.id}`);
    const pokeData = await res.json();
    const allMoves = pokeData.moves || [];
    const knownNames = new Set((mon.apiData.moves || []).filter(m => m).map(m => m.move.name));

    const movePromises = [];
    for (let i = 0; i < allMoves.length && i < 50; i++) {
      movePromises.push(
        fetch(allMoves[i].move.url).then(r => r.json()).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);
    const learnable = moveResults.filter(m => m && m.power && !knownNames.has(m.name));

    availableList.innerHTML = '';
    if (learnable.length === 0) {
      availableList.innerHTML = '<div class="tm-empty">Нет новых атак для изучения</div>';
    } else {
      learnable.forEach((moveData) => {
        const moveEl = document.createElement('div');
        moveEl.className = 'tm-move-cell';
        moveEl.innerText = `${moveData.name} (${moveData.power} | ${moveData.damage_class.name})`;
        moveEl.addEventListener('click', () => {
          showSlotPicker(mon, moveData);
        });
        availableList.appendChild(moveEl);
      });
    }
  } catch (e) {
    availableList.innerHTML = '<div class="tm-error">Ошибка загрузки атак</div>';
  }
}

function showSlotPicker(mon, moveData) {
  const picker = document.getElementById('tm-slot-picker');
  picker.style.display = 'block';
  picker.innerHTML = '<h4>Выберите слот для замены:</h4>';
  for (let i = 0; i < 4; i++) {
    const btn = document.createElement('button');
    btn.className = 'tma-btn';
    btn.style.margin = '4px';
    const currentName = (mon.apiData.moves[i]) ? mon.apiData.moves[i].move.name : '-';
    btn.innerText = `Слот ${i + 1}: ${currentName}`;
    btn.addEventListener('click', () => {
      const moveUrl = `https://pokeapi.co/api/v2/move/${moveData.id}/`;
      if (!mon.apiData.moves[i]) {
        mon.apiData.moves[i] = { move: { name: moveData.name, url: moveUrl } };
      } else {
        mon.apiData.moves[i].move.name = moveData.name;
        mon.apiData.moves[i].move.url = moveUrl;
      }
      if (!mon.movesPP) mon.movesPP = [];
      mon.movesPP[i] = { current: moveData.pp || 30, max: moveData.pp || 30 };
      removeItem('tm');
      updateInventoryDisplay();
      refreshProfileUI();
      document.getElementById('tm-slot-picker').style.display = 'none';
      document.getElementById('tm-modal').style.display = 'none';
      autoSave();
      showToast(`${mon.nickname || mon.apiData.name} выучил ${moveData.name}!`, false);
    });
    picker.appendChild(btn);
  }
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'tma-btn';
  cancelBtn.style.margin = '4px';
  cancelBtn.style.backgroundColor = '#ff3b30';
  cancelBtn.innerText = 'Отмена';
  cancelBtn.addEventListener('click', () => {
    picker.style.display = 'none';
  });
  picker.appendChild(cancelBtn);
}

// ================================================================
// FEATURE: SELL ITEMS (Shop Tab)
// ================================================================
function initSellTab() {
  const sellTab = document.getElementById('shop-sell-tab');
  const buyTab = document.getElementById('shop-buy-tab');
  if (!sellTab || !buyTab) return;

  const renderSell = () => {
    const container = document.getElementById('shop-items');
    container.innerHTML = '';

    const sellables = ITEMS
      .filter(item => (inventory[item.id] || 0) > 0)
      .map(item => ({
        id: item.id,
        icon: getItemSpriteImg(item.id, 24),
        name: item.nameRu,
        qty: inventory[item.id],
      }));

    sellables.forEach(item => {
      const div = document.createElement('div');
      div.className = 'shop-item';
      const sellPrice = Math.floor((shopPrices[item.id] || 100) / 2);
      div.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name} (x${item.qty})</div>
          <div class="shop-item-price">Продажа: ¥${sellPrice}/шт</div>
        </div>
        <div class="shop-qty-wrap">
          <input type="number" class="shop-qty-input shop-sell-qty" value="1" min="1" max="${item.qty}" data-item="${item.id}">
          <button class="btn-use shop-sell-btn" data-item="${item.id}" ${item.qty <= 0 ? 'disabled' : ''}>Продать</button>
        </div>
      `;
      container.appendChild(div);
    });
  };

  sellTab.addEventListener('click', () => {
    buyTab.classList.remove('active');
    sellTab.classList.add('active');
    renderSell();
  });

  buyTab.addEventListener('click', () => {
    sellTab.classList.remove('active');
    buyTab.classList.add('active');
    const origOpen = openShop;
    document.getElementById('shop-money-display').innerText = money;
    const container = document.getElementById('shop-items');
    container.innerHTML = '';
    shopItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-price">¥${item.price}</div>
        </div>
        <button class="btn-use shop-buy-btn" data-item="${item.id}">Купить</button>
      `;
      container.appendChild(div);
    });
  });

  // Sell button delegation
  document.getElementById('shop-items').addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-sell-btn');
    if (!btn || btn.disabled) return;

    const itemId = btn.getAttribute('data-item');
    const sellPrice = Math.floor((shopPrices[itemId] || 100) / 2);
    const itemData = ITEMS.find(i => i.id === itemId);
    const qtyInput = document.querySelector(`.shop-sell-qty[data-item="${itemId}"]`);
    const qty = Math.max(1, Math.min(inventory[itemId] || 1, parseInt(qtyInput?.value) || 1));
    const total = sellPrice * qty;
    showConfirmModal('Продать предмет?', `Продать ${qty}x ${itemData ? itemData.nameRu : itemId} за ¥${total.toLocaleString()}?`, () => {
      let sold = 0;
      for (let i = 0; i < qty; i++) {
        if (!removeItem(itemId)) break;
        sold++;
      }
      money += sellPrice * sold;
      document.getElementById('shop-money-display').innerText = money;
      updateInventoryDisplay();
      updateMoneyDisplay();
      autoSave();
      renderSell();
      if (sold > 0) showToast(`Продано ${sold}x! +¥${sellPrice * sold}`, false);
    });
  });
}

// ================================================================
// FEATURE: NICKNAME
// ================================================================
function editNickname() {
  if (currentPokemonIndex === null) return showToast('Сначала выберите покемона!', true);
  const mon = myTeam[currentPokemonIndex];
  showTextInputModal('Новое прозвище', mon.nickname || '', (newName) => {
    mon.nickname = newName;
    refreshProfileUI();
    autoSave();
  });
}

// ================================================================
// FEATURE: CHAT SYSTEM
// ================================================================
let chatPollingInterval = null;
let chatLastTimestamp = null;

async function loadChatMessages() {
  try {
    const url = chatLastTimestamp
      ? `${API_BASE}/chat/messages?since=${encodeURIComponent(chatLastTimestamp)}`
      : `${API_BASE}/chat/messages`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.messages) return;

    const container = document.getElementById('chat-messages');
    if (!chatLastTimestamp && data.messages.length > 0) {
      container.innerHTML = '';
    }

    data.messages.forEach(msg => {
      renderChatMessage(msg, container);
      chatLastTimestamp = msg.created_at;
    });

    container.scrollTop = container.scrollHeight;
  } catch (e) {
    console.warn('Chat load failed', e);
  }
}

function renderChatMessage(msg, container) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.setAttribute('data-msg-id', msg.id);
  const name = msg.first_name || msg.username || `Trainer#${msg.user_id}`;
  const time = msg.created_at ? msg.created_at.slice(11, 16) : '';
  div.innerHTML = `<span class="chat-msg-username" data-user-id="${msg.user_id}">${escapeHtml(name)}:</span><span class="chat-msg-text">${escapeHtml(msg.text)}</span><span class="chat-msg-time">${time}</span>`;
  container.appendChild(div);

  // Click on username -> show trainer profile
  const usernameEl = div.querySelector('.chat-msg-username');
  usernameEl.addEventListener('click', () => openTrainerProfile(msg.user_id));
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function startChatPolling() {
  stopChatPolling();
  chatPollingInterval = setInterval(loadChatMessages, 30000); // fallback poll every 30s
}

// Listen for real-time chat messages via socket
function initChatSocket() {
  if (!socket) return;
  socket.off('chat_message');
  socket.on('chat_message', (msg) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    // Avoid duplicates if we also poll
    const existing = container.querySelector(`[data-msg-id="${msg.id}"]`);
    if (existing) return;
    renderChatMessage(msg, container);
    container.scrollTop = container.scrollHeight;
    chatLastTimestamp = msg.created_at;
  });
}

function stopChatPolling() {
  if (chatPollingInterval) {
    clearInterval(chatPollingInterval);
    chatPollingInterval = null;
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const headers = getCloudAuthHeaders();
  if (!headers.Authorization) {
    input.value = '';
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-system-msg';
    div.innerText = 'Авторизуйтесь через Telegram для отправки сообщений';
    container.appendChild(div);
    return;
  }

  try {
    await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    input.value = '';
    await loadChatMessages();
  } catch (e) {
    console.warn('Chat send failed', e);
  }
}

// ================================================================
// TRAINERS TAB — all visitors + account
// ================================================================
let trainersAllData = [];

async function loadAllTrainers() {
  const listEl = document.getElementById('trainers-all-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:20px;">Загрузка...</div>';
  try {
    const res = await fetch('/api/profile/trainers/all');
    const data = await res.json();
    trainersAllData = data.users || [];
    if (trainersAllData.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:30px;">Нет тренеров</div>';
      return;
    }
    listEl.innerHTML = '';
    trainersAllData.forEach(u => {
      const card = document.createElement('div');
      card.className = 'trainer-list-card';
      const avatarHtml = (u.avatar && u.avatar.startsWith('/avatars/'))
        ? `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : `<span style="font-size:1.5rem;">${u.avatar || '👤'}</span>`;
      const lastSeen = u.lastSeen ? u.lastSeen.slice(0,16).replace('T',' ') : u.created_at?.slice(0,10) || '';
      const isOnline = onlinePlayersList.some(p => p.userId === u.id);
      const onlineDot = isOnline
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#34c759;margin-right:4px;box-shadow:0 0 4px #34c759;"></span>'
        : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#555;margin-right:4px;"></span>';
      card.innerHTML = `
        <div class="trainer-list-avatar">${avatarHtml}</div>
        <div class="trainer-list-info">
          <div class="trainer-list-name">${onlineDot}${escHtml(u.nickname || u.first_name || u.username || 'Тренер')} ${u.registered ? '✅' : '🆕'}</div>
          <div class="trainer-list-id">🏅${u.badges||0} | 💰${u.money||0} | 🐾${u.teamSize||0}</div>
          <div class="trainer-list-id">📍${u.region || '?'} | 🕐${lastSeen}</div>
        </div>`;
      card.addEventListener('click', () => openTrainerProfile(u.id));
      listEl.appendChild(card);
    });
  } catch(e) { listEl.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:20px;">Ошибка загрузки</div>'; }
}

function initTrainersTab() {
  // Tab switching
  document.querySelectorAll('.trainers-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.trainers-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panel = tab.getAttribute('data-tab');
      document.getElementById('trainers-all-panel').style.display = panel === 'all' ? 'block' : 'none';
      document.getElementById('trainers-account-panel').style.display = panel === 'account' ? 'block' : 'none';
      if (panel === 'all') loadAllTrainers();
      if (panel === 'account') showAccountPanel();
    });
  });

  // Account save
  const saveBtn = document.getElementById('btn-account-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      trainerNickname = document.getElementById('account-nickname').value.trim();
      const avatar = document.getElementById('account-avatar-select').value;
      localStorage.setItem(lsKey('avatar'), avatar);
      localStorage.setItem(lsKey('nickname_'), trainerNickname);
      showAccountPanel();
      renderTrainerCard();
      autoSave();
      showToast('Сохранено!', false);
    });
  }
}

function showAccountPanel() {
  document.getElementById('account-avatar').textContent = localStorage.getItem(lsKey('avatar')) || '👤';
  document.getElementById('account-name').textContent = trainerNickname || tgUser?.first_name || 'Тренер';
  document.getElementById('account-id').textContent = `Telegram ID: ${tgUser?.id || '?'}`;
  document.getElementById('account-nickname').value = trainerNickname || '';
  document.getElementById('account-avatar-select').value = localStorage.getItem(lsKey('avatar')) || '👤';
}

// ================================================================
// TRAINER CARD
// ================================================================
function renderTrainerCard() {
  const nameEl = document.getElementById('trainer-name');
  const moneyEl = document.getElementById('trainer-money');
  const badgesEl = document.getElementById('trainer-badges');
  const caughtEl = document.getElementById('trainer-caught');

  if (trainerNickname) {
    nameEl.textContent = trainerNickname;
  } else if (tgUser) {
    nameEl.textContent = tgUser.first_name || tgUser.username || `ID:${tgUser.id}`;
  } else {
    nameEl.textContent = '---';
  }
  nameEl.style.cursor = 'pointer';
  nameEl.title = 'Нажмите чтобы изменить прозвище';
  nameEl.onclick = () => {
    showTextInputModal('Прозвище тренера', trainerNickname || tgUser?.first_name || '', (newName) => {
      trainerNickname = newName;
      renderTrainerCard();
      autoSave();
    });
  };

  moneyEl.textContent = `¥${money}`;
  badgesEl.textContent = badges.length;
  caughtEl.textContent = `${pokedexCaught.size}/${pokedexTotal || 151}`;

  loadLocationTrainers();
  renderOnlinePlayers();
}

// ================================================================
// TRAINER LOCATION & PROFILES
// ================================================================
async function updatePlayerLocation() {
  const headers = getCloudAuthHeaders();
  if (!headers.Authorization) return;
  try {
    await fetch(`${API_BASE}/profile/location`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: currentLocationId, region: currentRegion })
    });
  } catch (e) {
    // silent
  }
}

async function loadLocationTrainers() {
  const listEl = document.getElementById('trainer-location-list');
  if (!listEl) return;
  try {
    const res = await fetch(`${API_BASE}/profile/trainers?locationId=${encodeURIComponent(currentLocationId)}`);
    const data = await res.json();
    listEl.innerHTML = '';
    if (!data.trainers || data.trainers.length === 0) {
      listEl.textContent = '0';
      return;
    }
    listEl.textContent = data.trainers.length + ' ';
    data.trainers.forEach((t, i) => {
      const span = document.createElement('span');
      span.className = 'chat-trainer-chip';
      span.textContent = t.first_name || t.username || `T${t.id}`;
      span.addEventListener('click', () => openTrainerProfile(t.id));
      listEl.appendChild(span);
    });
  } catch (e) { listEl.textContent = '---'; }
}

function renderOnlinePlayers() {
  const listEl = document.getElementById('chat-online-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (onlinePlayersList.length === 0) {
    listEl.textContent = '0';
    return;
  }
  listEl.textContent = onlinePlayersList.length + ' ';
  onlinePlayersList.forEach((p, i) => {
    const span = document.createElement('span');
    span.className = 'chat-trainer-chip';
    span.textContent = p.username || 'Тренер';
    span.addEventListener('click', () => openTrainerProfile(p.userId));
    listEl.appendChild(span);
  });
}

function updateTrainerLocationList(data) {
  const listEl = document.getElementById('trainer-location-list');
  if (!listEl || !data) return;
  if (data.userId === (tgUser?.id || 0)) return;
  const existing = listEl.querySelector(`[data-trainer-id="${data.userId}"]`);
  if (existing) return;
  if (listEl.textContent === 'никого' || listEl.textContent === '---') listEl.textContent = '';
  const span = document.createElement('span');
  span.className = 'chat-trainer-chip';
  span.setAttribute('data-trainer-id', data.userId);
  span.textContent = data.firstName || data.username || `T${data.userId}`;
  span.addEventListener('click', () => openTrainerProfile(data.userId));
  listEl.appendChild(span);
}

let lastProfileOpen = 0;
let lastSocketAction = 0;
const SOCKET_COOLDOWN = 3000; // 3s between trade/pvp requests

async function openTrainerProfile(userId) {
  // Rate limit: 500ms between profile views
  const now = Date.now();
  if (now - lastProfileOpen < 500) return;
  lastProfileOpen = now;

  const modal = document.getElementById('trainer-profile-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  document.getElementById('modal-trainer-name').innerText = 'Загрузка...';
  document.getElementById('modal-trainer-money').innerText = '$0';
  document.getElementById('modal-trainer-badges').innerText = '0';
  document.getElementById('modal-trainer-team').innerHTML = '<div class="trainer-team-empty">Загрузка...</div>';

  try {
    const res = await fetch(`${API_BASE}/profile/${userId}`);
    const data = await res.json();
    if (!data.profile) {
      document.getElementById('modal-trainer-name').innerText = 'Тренер не найден';
      return;
    }

    const p = data.profile;
    const isOnline = onlinePlayersList.some(op => op.userId === userId);
    const onlineDot = isOnline
      ? '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#34c759;margin-right:6px;box-shadow:0 0 6px #34c759;vertical-align:middle;"></span>'
      : '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#555;margin-right:6px;vertical-align:middle;"></span>';
    const statusText = isOnline ? ' (В сети)' : ' (Не в сети)';
    document.getElementById('modal-trainer-name').innerHTML = onlineDot + escHtml(p.first_name || p.username || `Trainer#${p.id}`) + `<span style="font-size:0.7rem;color:${isOnline ? '#34c759' : '#888'};">${statusText}</span>`;
    document.getElementById('modal-trainer-money').innerText = `¥${p.money}`;
    document.getElementById('modal-trainer-badges').innerText = p.badges;

    // Show Trade/Battle buttons if trainer is online
    const actionsDiv = document.getElementById('modal-trainer-actions');
    const onlinePlayer = onlinePlayersList.find(op => op.userId === userId);
    if (actionsDiv && onlinePlayer && onlinePlayer.id !== socket?.id) {
      actionsDiv.style.display = 'flex';
      const tradeBtn = document.getElementById('btn-trainer-trade');
      const battleBtn = document.getElementById('btn-trainer-battle');
      tradeBtn.onclick = () => {
        const now = Date.now();
        if (now - lastSocketAction < SOCKET_COOLDOWN) { showToast('Слишком часто! Подождите...', true); return; }
        lastSocketAction = now;
        modal.style.display = 'none';
        initTradeSocket();
        if (!socket || !socket.connected) {
          showToast('Подключение к серверу...', true);
          return;
        }
        socket.emit('trade_request', onlinePlayer.id);
        showToast('Запрос на обмен отправлен!', false);
      };
      battleBtn.onclick = () => {
        const now = Date.now();
        if (now - lastSocketAction < SOCKET_COOLDOWN) { showToast('Слишком часто! Подождите...', true); return; }
        lastSocketAction = now;
        if (!myTeam.some(m => m.currentHp > 0)) { showToast('Нужен живой покемон!', true); return; }
        modal.style.display = 'none';
        initTradeSocket();
        socket.emit('pvp_challenge', onlinePlayer.id);
        showToast('Вызов на бой отправлен!', false);
      };
    } else if (actionsDiv) {
      actionsDiv.style.display = 'none';
    }

    const teamEl = document.getElementById('modal-trainer-team');
    teamEl.innerHTML = '';
    if (!p.team || p.team.length === 0) {
      teamEl.innerHTML = '<div class="trainer-team-empty">Нет покемонов</div>';
      return;
    }
    p.team.forEach(mon => {
      const div = document.createElement('div');
      div.className = 'trainer-team-mon';
      div.innerHTML = `
        <div class="trainer-team-mon-img-box">
          <img class="trainer-team-mon-img" src="${mon.sprite || ''}" alt="">
        </div>
        <div class="trainer-team-mon-info">
          <div class="trainer-team-mon-name">${mon.nickname || mon.name}</div>
          <div class="trainer-team-mon-lvl">Lv${mon.level}</div>
        </div>`;
      teamEl.appendChild(div);
    });
  } catch (e) {
    document.getElementById('modal-trainer-name').innerText = 'Ошибка загрузки';
  }
}

// --- P2P TRADING VIA SOCKET.IO ---
let socket = null;
let onlinePlayersList = [];
let activeTradeId = null;
let myTradeOffer = null;
let partnerTradeOffer = null;
let iAmP1 = false;

function showToast(msg, isError) {
  let toast = document.getElementById('trade-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'trade-toast';
    toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:8px;font-weight:600;font-size:0.9rem;z-index:300;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.style.background = isError ? '#ff3b30' : '#34c759';
  toast.style.color = '#fff';
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// --- Reusable Modal Helpers ---

function showConfirmModal(title, message, onConfirm, onCancel) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="confirm-modal-card">
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="confirm-modal-buttons">
        <button class="confirm-btn confirm-btn-yes" id="confirm-yes">Да</button>
        <button class="confirm-btn confirm-btn-no" id="confirm-no">Отмена</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const cleanup = () => {
    document.getElementById('confirm-yes').removeEventListener('click', onYes);
    document.getElementById('confirm-no').removeEventListener('click', onNo);
    modal.removeEventListener('click', onOverlay);
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  };
  const onYes = () => { cleanup(); if (onConfirm) onConfirm(); };
  const onNo = () => { cleanup(); if (onCancel) onCancel(); };
  const onOverlay = (e) => { if (e.target === modal) onNo(); };

  document.getElementById('confirm-yes').addEventListener('click', onYes);
  document.getElementById('confirm-no').addEventListener('click', onNo);
  modal.addEventListener('click', onOverlay);
}

function showSelectionModal(title, items, callback, allowCancel) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  const itemsHTML = items.map((item, i) => `
    <button class="selection-item-btn" data-index="${i}">
      ${item.label}
      ${item.subtitle ? `<span class="item-subtitle">${item.subtitle}</span>` : ''}
    </button>
  `).join('');
  modal.innerHTML = `
    <div class="selection-modal-card">
      <h3>${title}</h3>
      <div class="selection-items">${itemsHTML}</div>
      ${allowCancel ? '<button class="confirm-btn confirm-btn-no" id="selection-cancel" style="width:100%;margin-top:8px;">Отмена</button>' : ''}
    </div>
  `;
  document.body.appendChild(modal);

  const cleanup = () => {
    modal.querySelectorAll('.selection-item-btn').forEach(btn => {
      btn.removeEventListener('click', onItemClick);
    });
    if (allowCancel) {
      document.getElementById('selection-cancel').removeEventListener('click', onCancelClick);
    }
    modal.removeEventListener('click', onOverlay);
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  };

  const onItemClick = (e) => {
    const idx = parseInt(e.currentTarget.getAttribute('data-index'));
    cleanup();
    if (callback) callback(idx);
  };
  const onCancelClick = () => { cleanup(); };
  const onOverlay = (e) => { if (e.target === modal) { cleanup(); } };

  modal.querySelectorAll('.selection-item-btn').forEach(btn => {
    btn.addEventListener('click', onItemClick);
  });
  if (allowCancel) {
    document.getElementById('selection-cancel').addEventListener('click', onCancelClick);
  }
  modal.addEventListener('click', onOverlay);
}

function showTextInputModal(title, defaultText, callback) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="selection-modal-card">
      <h3>${title}</h3>
      <input type="text" class="text-input-modal" id="text-input-field" value="${defaultText || ''}" maxlength="20" autocomplete="off">
      <div class="confirm-modal-buttons" style="margin-top:12px;">
        <button class="confirm-btn confirm-btn-yes" id="text-input-ok">OK</button>
        <button class="confirm-btn confirm-btn-no" id="text-input-cancel">Отмена</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const input = document.getElementById('text-input-field');
  input.focus();
  input.select();

  const cleanup = () => {
    document.getElementById('text-input-ok').removeEventListener('click', onOk);
    document.getElementById('text-input-cancel').removeEventListener('click', onCancel);
    modal.removeEventListener('click', onOverlay);
    input.removeEventListener('keydown', onKey);
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  };
  const submit = () => {
    const val = input.value.trim();
    cleanup();
    if (callback && val) callback(val);
  };
  const onOk = () => submit();
  const onCancel = () => { cleanup(); };
  const onOverlay = (e) => { if (e.target === modal) { cleanup(); } };
  const onKey = (e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') cleanup(); };

  document.getElementById('text-input-ok').addEventListener('click', onOk);
  document.getElementById('text-input-cancel').addEventListener('click', onCancel);
  modal.addEventListener('click', onOverlay);
  input.addEventListener('keydown', onKey);
}

function showItemInfoModal(item, qty) {
  const priceInfo = item.price > 0 ? `\n💰 Цена: ${item.price.toLocaleString()} кр.` : '';
  const sellInfo = item.sellPrice > 0 ? `\n🏷️ Продажа: ${item.sellPrice.toLocaleString()} кр.` : '';
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="item-info-card">
      <h3>📦 ${item.nameRu}</h3>
      <p>📝 ${item.desc}</p>
      <div class="item-info-details">📊 Кол-во: ${qty}${priceInfo}${sellInfo}</div>
      <button class="tma-btn" id="btn-item-info-close" style="width:100%;margin-top:12px;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  const cleanup = () => {
    document.getElementById('btn-item-info-close').removeEventListener('click', cleanup);
    modal.removeEventListener('click', onOverlay);
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  };
  const onOverlay = (e) => { if (e.target === modal) cleanup(); };

  document.getElementById('btn-item-info-close').addEventListener('click', cleanup);
  modal.addEventListener('click', onOverlay);
}

// --- PvP Battle ---
let pvpBattleId = null;
let pvpOpponentName = '';
let pvpMyMon = null;
let pvpOppMon = null;
let pvpMyTurn = false;

function openPvPArena(battleId, opponent, myFirst) {
  pvpBattleId = battleId;
  pvpOpponentName = opponent;
  pvpMyTurn = myFirst;
  const alive = myTeam.find(m => m.currentHp > 0);
  if (!alive) { showToast('Нет живых покемонов!', true); return; }
  pvpMyMon = alive;

  let modal = document.getElementById('pvp-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pvp-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="reborn-battle-arena" style="max-width:440px;width:95%;">
        <div style="text-align:center;padding:8px;"><span id="pvp-opponent-name" style="font-weight:bold;"></span></div>
        <div style="text-align:center;font-size:0.9rem;" id="pvp-turn-indicator"></div>
        <div class="reborn-pokemon-row">
          <div class="reborn-side-panel">
            <div class="reborn-poke-header"><span id="pvp-my-name"></span> <span id="pvp-my-lvl"></span></div>
            <div class="reborn-hp-bar"><div class="reborn-hp-fill" id="pvp-my-hp-fill"></div></div>
            <div class="reborn-hp-text" id="pvp-my-hp"></div>
            <div class="reborn-sprite-box"><img class="reborn-sprite" id="pvp-my-sprite" src=""></div>
          </div>
          <div class="reborn-side-panel">
            <div class="reborn-poke-header"><span id="pvp-opp-name"></span> <span id="pvp-opp-lvl"></span></div>
            <div class="reborn-hp-bar"><div class="reborn-hp-fill" id="pvp-opp-hp-fill"></div></div>
            <div class="reborn-hp-text" id="pvp-opp-hp"></div>
            <div class="reborn-sprite-box"><img class="reborn-sprite" id="pvp-opp-sprite" src=""></div>
          </div>
        </div>
        <div class="reborn-center-panel">
          <div class="reborn-moves" id="pvp-moves"></div>
          <div class="reborn-log-container"><div class="reborn-battle-log" id="pvp-log"></div></div>
        </div>
        <button class="tma-btn" id="btn-pvp-leave" style="width:100%;margin-top:8px;">Сдаться</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('btn-pvp-leave').addEventListener('click', () => {
      modal.style.display = 'none';
      socket.emit('pvp_end', { battleId: pvpBattleId, action: { type: 'surrender' } });
      pvpBattleId = null;
      autoSave();
      updateMoneyDisplay();
    });
  }

  document.getElementById('pvp-opponent-name').textContent = `⚔ Бой с ${opponent}`;
  document.getElementById('pvp-opp-name').textContent = opponent;
  document.getElementById('pvp-opp-lvl').textContent = '';
  document.getElementById('pvp-opp-hp').textContent = '?/?';
  document.getElementById('pvp-opp-hp-fill').style.width = '100%';
  document.getElementById('pvp-opp-sprite').src = '';
  document.getElementById('pvp-log').innerHTML = '';
  updatePvPUI();
  modal.style.display = 'flex';

  // Send my pokemon data to opponent
  const mon = pvpMyMon;
  socket.emit('pvp_action', { battleId, action: {
    type: 'mon_data',
    name: mon.nickname || mon.apiData?.name,
    lvl: mon.baseLevel + (mon.candiesEaten || 0),
    hp: mon.currentHp,
    maxHp: mon.maxHp,
    sprite: mon.apiData?.sprites?.other?.['official-artwork']?.front_default || mon.apiData?.sprites?.front_default || ''
  }});
}

function updatePvPUI() {
  if (!pvpMyMon) return;
  const mon = pvpMyMon;
  const curLvl = mon.baseLevel + (mon.candiesEaten || 0);
  document.getElementById('pvp-my-name').textContent = mon.nickname || mon.apiData?.name;
  document.getElementById('pvp-my-lvl').textContent = `Lv${curLvl}`;
  document.getElementById('pvp-my-hp').textContent = `${mon.currentHp}/${mon.maxHp}`;
  document.getElementById('pvp-my-hp-fill').style.width = `${Math.max(0, (mon.currentHp / mon.maxHp) * 100)}%`;
  const sprite = mon.apiData?.sprites?.other?.['official-artwork']?.front_default || mon.apiData?.sprites?.front_default || '';
  document.getElementById('pvp-my-sprite').src = sprite;

  document.getElementById('pvp-turn-indicator').textContent = pvpMyTurn ? '🎯 Ваш ход!' : '⏳ Ожидание хода соперника...';
  document.getElementById('pvp-turn-indicator').style.color = pvpMyTurn ? '#34c759' : '#ff9500';

  const movesDiv = document.getElementById('pvp-moves');
  movesDiv.innerHTML = '';
  const moves = mon.apiData?.moves?.filter(m => m) || [];
  moves.forEach((m, i) => {
    const btn = document.createElement('span');
    btn.className = 'reborn-move-link';
    btn.textContent = m.move.name;
    btn.style.opacity = pvpMyTurn ? '1' : '0.5';
    btn.onclick = () => {
      if (!pvpMyTurn) { showToast('Сейчас ход соперника!', true); return; }
      doPvPAttack(i);
    };
    movesDiv.appendChild(btn);
  });
}

function doPvPAttack(moveIdx) {
  if (!pvpMyMon || !pvpBattleId) return;
  const move = pvpMyMon.apiData?.moves?.[moveIdx]?.move;
  const moveName = move?.name || 'Атака';
  const lvl = pvpMyMon.baseLevel + (pvpMyMon.candiesEaten || 0);
  const atk = (pvpMyMon.apiData?.stats?.[1]?.base_stat || 60);
  const power = move ? (move.power || 60) : 60;
  const rawDmg = Math.floor(((lvl * power * (atk / 100)) / 15) * (0.85 + Math.random() * 0.3));
  const crit = Math.random() < 0.0625;
  const dmg = crit ? Math.floor(rawDmg * 1.5) : rawDmg;

  const logEl = document.getElementById('pvp-log');
  logEl.innerHTML = `Вы: ${moveName}! ${crit ? '💥Крит! ' : ''}(-${dmg})\n${logEl.innerHTML}`;

  pvpMyTurn = false;
  socket.emit('pvp_action', { battleId: pvpBattleId, action: { type: 'attack', moveName, dmg, crit } });
  updatePvPUI();
}

function endPvP(won) {
  showToast(won ? '🏆 Победа в PvP! +500¥' : '💀 Поражение в PvP...', !won);
  if (won) { money += 500; updateMoneyDisplay(); }
  document.getElementById('pvp-modal').style.display = 'none';
  socket.emit('pvp_end', { battleId: pvpBattleId, action: { type: won ? 'win' : 'lose' } });
  pvpBattleId = null;
  autoSave();
}

function initTradeSocket() {
  if (socket) return;
  const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : API_BASE.replace('/api', '');
  socket = io(serverUrl);

  socket.on('connect', () => {
    socket.emit('join_lobby', { username: tgUser?.first_name || tgUser?.username || 'Тренер', userId: tgUser?.id });
    initChatSocket();
  });

  socket.on('disconnect', () => {
    onlinePlayersList = [];
    renderOnlinePlayers();
  });

  // Real-time location updates for trainer list
  socket.on('location_update', (data) => {
    if (data.locationId === currentLocationId && data.userId !== (tgUser?.id || 0)) {
      updateTrainerLocationList(data);
    }
  });

  socket.on('online_players', (players) => {
    onlinePlayersList = players.filter(p => p.id !== socket.id);
    renderTradePlayerList();
    renderOnlinePlayers();
  });

  socket.on('trade_request_received', (data) => {
    showTradeRequestModal(data.fromUsername, data.fromId);
  });

  socket.on('trade_rejected', () => {
    showToast('Тренер отклонил предложение обмена', true);
  });

  socket.on('trade_started', (data) => {
    activeTradeId = data.tradeId;
    iAmP1 = data.tradeId.startsWith(socket.id);
    myTradeOffer = null;
    partnerTradeOffer = null;
    openTradeWindow(data.partnerUsername);
  });

  socket.on('trade_partner_offer', (offer) => {
    partnerTradeOffer = offer;
    renderTradeOffers();
  });

  socket.on('trade_confirm_status', (status) => {
    updateTradeConfirmUI(status);
  });

  socket.on('trade_execute', (receivedOffer) => {
    // Remove what I offered
    if (myTradeOffer) {
      if (myTradeOffer.type === 'pokemon') {
        const idx = myTeam.findIndex(m => m.uid === myTradeOffer.data.uid || m === myTradeOffer.data);
        if (idx !== -1) myTeam.splice(idx, 1);
      } else if (myTradeOffer.type === 'item') {
        removeItem(myTradeOffer.data.id, myTradeOffer.data.qty || 1);
      }
    }

    // Receive what partner offered
    if (receivedOffer) {
      if (receivedOffer.type === 'pokemon') {
        receivedOffer.data.previousOwner = receivedOffer.data.originalTrainer;
        receivedOffer.data.uid = generateUID();
        receivedOffer.data.originalTrainer = getTrainerId();
        receivedOffer.data.createdAt = Date.now();
        myTeam.push(receivedOffer.data);
      } else if (receivedOffer.type === 'item') {
        addItem(receivedOffer.data.id, receivedOffer.data.qty || 1);
        showToast(`Получено: ${receivedOffer.data.name} x${receivedOffer.data.qty || 1}!`, false);
      }
    }

    showToast('Обмен успешно завершён!', false);
    closeTradeWindow();
    autoSave();
    refreshProfileUI();
  });

  socket.on('trade_cancelled', (msg) => {
    showToast(msg || 'Обмен отменён', true);
    closeTradeWindow();
  });

  // PvP handlers
  socket.on('pvp_challenge_received', (data) => {
    showConfirmModal('⚔ Вызов на бой!', `Тренер ${data.fromName} вызывает вас на битву!`, () => {
      if (!myTeam.some(m => m.currentHp > 0)) {
        showToast('Нужен хотя бы один живой покемон!', true);
        socket.emit('pvp_decline', data.fromId);
        return;
      }
      socket.emit('pvp_accept', data.fromId);
    }, () => { socket.emit('pvp_decline', data.fromId); });
  });

  socket.on('pvp_declined', (data) => {
    showToast(`${data.fromName} отклонил вызов`, true);
  });

  socket.on('pvp_start', (data) => {
    openPvPArena(data.battleId, data.opponent, data.first || false);
  });

  socket.on('pvp_opponent_action', (action) => {
    if (!pvpBattleId) return;
    if (action.type === 'mon_data') {
      // Opponent sent their pokemon data
      document.getElementById('pvp-opp-name').textContent = action.name;
      document.getElementById('pvp-opp-lvl').textContent = `Lv${action.lvl}`;
      document.getElementById('pvp-opp-hp').textContent = `${action.hp}/${action.maxHp}`;
      document.getElementById('pvp-opp-hp-fill').style.width = `${(action.hp / action.maxHp) * 100}%`;
      if (action.sprite) document.getElementById('pvp-opp-sprite').src = action.sprite;
      // Store opponent HP for tracking
      if (!pvpOppMon) pvpOppMon = {};
      pvpOppMon.currentHp = action.hp;
      pvpOppMon.maxHp = action.maxHp;
    }
    if (action.type === 'attack') {
      if (pvpMyMon) {
        pvpMyMon.currentHp -= action.dmg;
        if (pvpMyMon.currentHp < 0) pvpMyMon.currentHp = 0;
        updatePvPUI();
      }
      const logEl = document.getElementById('pvp-log');
      logEl.innerHTML = `${pvpOpponentName}: ${action.moveName}! ${action.crit ? '💥Крит! ' : ''}(-${action.dmg})\n${logEl.innerHTML}`;
      pvpMyTurn = true;
      updatePvPUI();
      if (pvpMyMon && pvpMyMon.currentHp <= 0) endPvP(false);
    }
    if (action.type === 'surrender') {
      showToast('🏆 Соперник сдался! Победа!', false);
      money += 500; updateMoneyDisplay();
      document.getElementById('pvp-modal').style.display = 'none';
      pvpBattleId = null;
      autoSave();
    }
    if (action.type === 'win' || action.type === 'lose') {
      document.getElementById('pvp-modal').style.display = 'none';
      pvpBattleId = null;
      autoSave();
    }
  });
}

// --- Trade Request Modal (instead of confirm()) ---
function showTradeRequestModal(fromUsername, fromId) {
  let rm = document.getElementById('trade-request-modal');
  if (!rm) {
    rm = document.createElement('div');
    rm.id = 'trade-request-modal';
    rm.className = 'trade-request-overlay';
    rm.innerHTML = `
      <div class="trade-request-box">
        <h3>🤝 Предложение обмена</h3>
        <p>Тренер <strong id="trade-req-username"></strong> хочет обменяться с вами!</p>
        <div class="trade-request-buttons">
          <button class="trade-btn accept" id="btn-trade-accept">Принять</button>
          <button class="trade-btn reject" id="btn-trade-reject">Отклонить</button>
        </div>
      </div>
    `;
    document.body.appendChild(rm);
  }

  // Clean up previous listeners if modal was already visible
  if (rm._cleanup) rm._cleanup();

  document.getElementById('trade-req-username').textContent = fromUsername;
  rm.style.display = 'flex';

  const accept = () => {
    socket.emit('trade_accept', fromId);
    rm.style.display = 'none';
    cleanup();
  };
  const reject = () => {
    socket.emit('trade_reject', fromId);
    rm.style.display = 'none';
    cleanup();
  };
  const cleanup = () => {
    document.getElementById('btn-trade-accept').removeEventListener('click', accept);
    document.getElementById('btn-trade-reject').removeEventListener('click', reject);
    rm.removeEventListener('click', overlayClick);
    rm._cleanup = null;
  };
  const overlayClick = (e) => { if (e.target === rm) reject(); };

  rm._cleanup = cleanup;
  document.getElementById('btn-trade-accept').addEventListener('click', accept);
  document.getElementById('btn-trade-reject').addEventListener('click', reject);
  rm.addEventListener('click', overlayClick);
}

// --- Trade Center Modal (online players list) ---
function openTradeCenter() {
  initTradeSocket();
  let tc = document.getElementById('trade-center-modal');
  if (!tc) {
    tc = document.createElement('div');
    tc.id = 'trade-center-modal';
    tc.className = 'modal-overlay';
    tc.style.display = 'none';
    tc.innerHTML = `
      <div class="trade-container">
        <h2 style="margin:0 0 4px 0;">🤝 Глобальный Обменник</h2>
        <p style="color:var(--tma-text-muted);font-size:0.85rem;margin:0 0 12px 0;">Выберите тренера в сети, чтобы предложить обмен</p>
        <div id="trade-players-list" class="trade-players-list"></div>
        <button class="trade-btn" id="btn-trade-center-close" style="width:100%;background:var(--tma-text-muted);">Закрыть</button>
      </div>
    `;
    document.body.appendChild(tc);
    document.getElementById('btn-trade-center-close').addEventListener('click', () => {
      tc.style.display = 'none';
    });
    tc.addEventListener('click', (e) => { if (e.target === tc) tc.style.display = 'none'; });
  }
  renderTradePlayerList();
  tc.style.display = 'flex';
}

function renderTradePlayerList() {
  const list = document.getElementById('trade-players-list');
  if (!list) return;
  list.innerHTML = '';

  if (onlinePlayersList.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:30px 0;">Нет тренеров в сети<br><span style="font-size:0.8rem;">Подождите или зайдите позже</span></div>';
    return;
  }

  onlinePlayersList.forEach(p => {
    const row = document.createElement('div');
    row.className = 'trade-player-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'trade-player-name';
    nameSpan.textContent = p.username || 'Тренер';

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:4px;';

    const tradeBtn = document.createElement('button');
    tradeBtn.className = 'trade-btn';
    tradeBtn.textContent = 'Трейд';
    tradeBtn.onclick = () => {
      const now = Date.now();
      if (now - lastSocketAction < SOCKET_COOLDOWN) { showToast('Слишком часто!', true); return; }
      lastSocketAction = now;
      socket.emit('trade_request', p.id);
      tradeBtn.textContent = '✓';
      tradeBtn.disabled = true;
      tradeBtn.style.opacity = '0.5';
      setTimeout(() => { tradeBtn.textContent = 'Трейд'; tradeBtn.disabled = false; tradeBtn.style.opacity = '1'; }, 5000);
    };

    const battleBtn = document.createElement('button');
    battleBtn.className = 'trade-btn';
    battleBtn.style.background = '#ff3b30';
    battleBtn.textContent = '⚔';
    battleBtn.onclick = () => {
      const now = Date.now();
      if (now - lastSocketAction < SOCKET_COOLDOWN) { showToast('Слишком часто!', true); return; }
      lastSocketAction = now;
      if (myTeam.length === 0 || !myTeam.some(m => m.currentHp > 0)) {
        showToast('Нужен хотя бы один живой покемон!', true);
        return;
      }
      socket.emit('pvp_challenge', p.id);
      battleBtn.textContent = '✓';
      battleBtn.disabled = true;
      battleBtn.style.opacity = '0.5';
      setTimeout(() => { battleBtn.textContent = '⚔'; battleBtn.disabled = false; battleBtn.style.opacity = '1'; }, 5000);
    };

    btnWrap.appendChild(tradeBtn);
    btnWrap.appendChild(battleBtn);
    row.appendChild(nameSpan);
    row.appendChild(btnWrap);
    list.appendChild(row);
  });
}

// --- Trade Window Modal (pokemon selection + confirmation) ---
function openTradeWindow(partnerName) {
  let tw = document.getElementById('trade-window-modal');
  if (!tw) {
    tw = document.createElement('div');
    tw.id = 'trade-window-modal';
    tw.className = 'modal-overlay';
    tw.style.display = 'none';
    tw.innerHTML = `
      <div class="trade-window">
        <h2 style="margin:0 0 4px 0;">Обмен с <span id="trade-partner-name"></span></h2>
        <p style="color:var(--tma-text-muted);font-size:0.8rem;margin:0 0 12px 0;">Выберите покемона или предмет — можно дарить без возврата</p>

        <div class="trade-columns">
          <div class="trade-col">
            <h3>Вы предлагаете</h3>
            <div class="trade-offer-slot" id="trade-my-offer"><span style="color:var(--tma-text-muted);">Не выбрано</span></div>
            <button class="trade-btn cancel" id="btn-trade-clear-my" style="width:100%;padding:4px;font-size:0.7rem;margin-bottom:4px;">Очистить</button>
            <div id="trade-my-status" class="trade-status waiting">⏳ Ожидание</div>
          </div>
          <div class="trade-col">
            <h3>Партнёр предлагает</h3>
            <div class="trade-offer-slot" id="trade-partner-offer"><span style="color:var(--tma-text-muted);">Ожидание...</span></div>
            <div id="trade-partner-status" class="trade-status waiting">⏳ Ожидание</div>
          </div>
        </div>

        <div id="trade-pick-area">
          <div class="trade-section-title">🐾 Покемоны:</div>
          <div class="trade-pokemon-grid" id="trade-pick-grid"></div>
          <div class="trade-section-title" style="margin-top:10px;">🎒 Предметы:</div>
          <div class="trade-pokemon-grid" id="trade-item-grid" style="grid-template-columns: repeat(4, 1fr);"></div>
        </div>

        <div class="trade-actions" style="margin-top:12px;">
          <button class="trade-btn confirm" id="btn-trade-confirm">✅ Подтвердить обмен</button>
          <button class="trade-btn cancel" id="btn-trade-cancel">✕ Отменить</button>
        </div>
      </div>
    `;
    document.body.appendChild(tw);

    document.getElementById('btn-trade-cancel').addEventListener('click', () => {
      if (activeTradeId) socket.emit('trade_cancel', activeTradeId);
      closeTradeWindow();
    });

    document.getElementById('btn-trade-confirm').addEventListener('click', () => {
      // Allow one-way: can confirm if you offered something OR partner offered something
      if (!myTradeOffer && !partnerTradeOffer) { showToast('Выберите что-то для обмена или дождитесь предложения!', true); return; }
      socket.emit('trade_confirm', activeTradeId);
      document.getElementById('btn-trade-confirm').textContent = '✓ Ожидание партнёра...';
      document.getElementById('btn-trade-confirm').disabled = true;
      document.getElementById('btn-trade-confirm').style.opacity = '0.5';
    });

    document.getElementById('btn-trade-clear-my').addEventListener('click', () => {
      myTradeOffer = null;
      socket.emit('trade_offer', { tradeId: activeTradeId, offer: null });
      renderTradeOffers();
      renderTradePickGrid();
      renderTradeItemGrid();
      const conf = document.getElementById('btn-trade-confirm');
      conf.textContent = '✅ Подтвердить обмен';
      conf.disabled = false;
      conf.style.opacity = '1';
    });

    tw.addEventListener('click', (e) => { if (e.target === tw) { if (activeTradeId) socket.emit('trade_cancel', activeTradeId); closeTradeWindow(); } });
  }

  myTradeOffer = null;
  partnerTradeOffer = null;
  document.getElementById('trade-partner-name').textContent = partnerName;
  document.getElementById('trade-my-status').textContent = '⏳ Ожидание';
  document.getElementById('trade-my-status').className = 'trade-status waiting';
  document.getElementById('trade-partner-status').textContent = '⏳ Ожидание';
  document.getElementById('trade-partner-status').className = 'trade-status waiting';
  document.getElementById('btn-trade-confirm').textContent = '✅ Подтвердить обмен';
  document.getElementById('btn-trade-confirm').disabled = false;
  document.getElementById('btn-trade-confirm').style.opacity = '1';

  renderTradeOffers();
  renderTradePickGrid();
  renderTradeItemGrid();
  document.getElementById('trade-center-modal').style.display = 'none';
  tw.style.display = 'flex';
}

function renderTradePickGrid() {
  const grid = document.getElementById('trade-pick-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (myTeam.length === 0) {
    grid.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:20px;grid-column:1/-1;">У вас нет покемонов для обмена</div>';
    return;
  }

  myTeam.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'trade-pokemon-card';
    if (myTradeOffer && myTradeOffer.data === m) card.classList.add('selected');

    const untradeable = myTeam.length <= 1;
    if (untradeable) {
      card.classList.add('untradeable');
      card.title = 'Нельзя отдать единственного покемона';
    }

    card.innerHTML = `
      <img src="${m.sprite || m.apiData?.sprites?.front_default || ''}" alt="${m.apiData?.name || '?'}" loading="lazy">
      <div class="name">${escHtml(m.nickname || m.apiData?.name || '???')}</div>
      <div class="lvl">Lv${m.level || 1}</div>
    `;

    if (!untradeable) {
      card.addEventListener('click', () => {
        myTradeOffer = { type: 'pokemon', data: m };
        socket.emit('trade_offer', { tradeId: activeTradeId, offer: myTradeOffer });
        renderTradeOffers();
        renderTradePickGrid();
      });
    }

    grid.appendChild(card);
  });
}

function renderTradeItemGrid() {
  const grid = document.getElementById('trade-item-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const tradeItems = ITEMS.filter(item => (inventory[item.id] || 0) > 0 && item.implemented !== false && item.category !== 'awards');
  if (tradeItems.length === 0) {
    grid.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:10px;grid-column:1/-1;font-size:0.8rem;">Нет предметов</div>';
    return;
  }

  tradeItems.forEach(item => {
    const qty = inventory[item.id] || 0;
    const card = document.createElement('div');
    card.className = 'trade-pokemon-card';
    if (myTradeOffer && myTradeOffer.type === 'item' && myTradeOffer.data.id === item.id) card.classList.add('selected');

    card.innerHTML = `
      <div>${getItemSpriteImg(item.id, 32)}</div>
      <div class="name">${item.nameRu}</div>
      <div class="lvl">x${Math.min(qty, 99)}</div>
    `;

    card.addEventListener('click', () => {
      // Toggle: if already selected, clear; else select this item
      if (myTradeOffer && myTradeOffer.type === 'item' && myTradeOffer.data.id === item.id) {
        myTradeOffer = null;
      } else {
        myTradeOffer = { type: 'item', data: { id: item.id, name: item.nameRu, qty: 1 } };
      }
      socket.emit('trade_offer', { tradeId: activeTradeId, offer: myTradeOffer });
      renderTradeOffers();
      renderTradeItemGrid();
      renderTradePickGrid();
    });

    grid.appendChild(card);
  });
}

function renderTradeOffers() {
  const myDiv = document.getElementById('trade-my-offer');
  const pDiv = document.getElementById('trade-partner-offer');
  if (!myDiv || !pDiv) return;

  const renderOffer = (offer) => {
    if (!offer) return '<span style="color:var(--tma-text-muted);">Не выбрано</span>';
    if (offer.type === 'pokemon') {
      const m = offer.data;
      return `<img class="trade-offer-sprite" src="${m.sprite || m.apiData?.sprites?.front_default || ''}" alt="${escHtml(m.apiData?.name || '?')}"><div class="trade-offer-name">${escHtml(m.nickname || m.apiData?.name || '???')}</div><div class="trade-offer-level">Lv${m.level || 1}</div>`;
    }
    if (offer.type === 'item') {
      const it = offer.data;
      return `<div>${getItemSpriteImg(it.id, 40)}</div><div class="trade-offer-name">${it.name}</div><div class="trade-offer-level">x${it.qty || 1}</div>`;
    }
    return '<span style="color:var(--tma-text-muted);">Не выбрано</span>';
  };

  myDiv.innerHTML = renderOffer(myTradeOffer);
  myDiv.className = myTradeOffer ? 'trade-offer-slot filled' : 'trade-offer-slot';
  pDiv.innerHTML = renderOffer(partnerTradeOffer);
  pDiv.className = partnerTradeOffer ? 'trade-offer-slot filled' : 'trade-offer-slot';
}

function updateTradeConfirmUI(status) {
  const myEl = document.getElementById('trade-my-status');
  const partnerEl = document.getElementById('trade-partner-status');
  if (!myEl || !partnerEl) return;

  let myConfirmed, partnerConfirmed;
  if (iAmP1) {
    myConfirmed = status.p1;
    partnerConfirmed = status.p2;
  } else {
    myConfirmed = status.p2;
    partnerConfirmed = status.p1;
  }

  myEl.textContent = myConfirmed ? '✅ Готов' : '⏳ Ожидание';
  myEl.className = myConfirmed ? 'trade-status ready' : 'trade-status waiting';

  partnerEl.textContent = partnerConfirmed ? '✅ Готов' : '⏳ Ожидание';
  partnerEl.className = partnerConfirmed ? 'trade-status ready' : 'trade-status waiting';

  // Disable confirm button if already confirmed
  if (myConfirmed) {
    const btn = document.getElementById('btn-trade-confirm');
    btn.textContent = '✓ Ожидание партнёра...';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
}

function closeTradeWindow() {
  const tw = document.getElementById('trade-window-modal');
  if (tw) tw.style.display = 'none';
  activeTradeId = null;
  myTradeOffer = null;
  partnerTradeOffer = null;
}

