#!/usr/bin/env node
// Скрипт для назначения редкости предметам и генерации дропов
// node rarity.js show     — показать все оценки
// node rarity.js gen      — сгенерировать дропы
// node rarity.js fill     — заполнить неотмеченные

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ITEMS_FILE = resolve(__dirname, 'src/data/items.js');
const DROPS_FILE = resolve(__dirname, 'src/data/drops.js');
const REGIONS_FILE = resolve(__dirname, 'src/data/regions.js');
const RARITY_FILE = resolve(__dirname, 'rarity.json');
const DROP_CONFIG_FILE = resolve(__dirname, 'data/drop_config.json');

const rarityChance = {
  1: 0.001, 2: 0.002, 3: 0.005, 4: 0.01, 5: 0.02,
  6: 0.04, 7: 0.08, 8: 0.15, 9: 0.25, 10: 0.40
};
function r2c(r) { return rarityChance[r] || 0.05; }

function parseItems() {
  const content = readFileSync(ITEMS_FILE, 'utf-8');
  const items = [], lines = content.split('\n');
  let inItem = false, braceDepth = 0, chunk = [];
  for (const line of lines) {
    chunk.push(line);
    if (!inItem && line.includes('{ id:')) { inItem = true; braceDepth = 0; chunk = [line]; }
    if (inItem) { for (const ch of line) { if (ch === '{') braceDepth++; if (ch === '}') braceDepth--; } }
    if (inItem && braceDepth <= 0) {
      const text = chunk.join('\n');
      const g = p => { const m = text.match(p); return m ? m[1] : null; };
      const id = g(/id:\s*'([^']+)'/);
      if (id) items.push({
        id, nameRu: g(/nameRu:\s*'([^']+)'/) || id,
        category: g(/category:\s*'([^']+)'/) || 'unknown',
        price: parseInt(g(/price:\s*(\d+)/) || '0'),
        implemented: g(/implemented:\s*(true|false)/) === 'true',
      });
      inItem = false; chunk = [];
    }
  }
  return items;
}

function parseDrops() {
  const content = readFileSync(DROPS_FILE, 'utf-8');
  const drops = {};
  const regex = /'(\w+)':\s*\[(.*?)\]/gs;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const entries = [];
    const itemRegex = /item:\s*'(\w+)'/g;
    let im;
    while ((im = itemRegex.exec(match[2])) !== null) {
      entries.push(im[1]);
    }
    if (entries.length) drops[name] = entries;
  }
  return drops;
}

function getAllPokemon() {
  const content = readFileSync(REGIONS_FILE, 'utf-8');
  const pokemon = new Set();
  const encRegex = /encounters:\s*\[(.*?)\]/gs;
  let match;
  while ((match = encRegex.exec(content)) !== null) {
    const names = match[1].match(/'(\w+)'/g);
    if (names) names.forEach(n => pokemon.add(n.replace(/'/g, '')));
  }
  return [...pokemon].sort();
}

function showAssessments() {
  const rarity = existsSync(RARITY_FILE) ? JSON.parse(readFileSync(RARITY_FILE, 'utf-8')) : {};
  const items = parseItems();
  const entries = Object.entries(rarity).sort((a, b) => a[1] - b[1]);

  console.log('\n=== ОЦЕНКИ РЕДКОСТИ ===\n');
  let marked = 0, auto = 0;
  for (const [id, r] of entries) {
    const item = items.find(i => i.id === id);
    const source = r.source || 'manual';
    if (source === 'auto') auto++; else marked++;
    console.log(`  ${(r.rarity + '/10').padStart(5)} | ${(r2c(r.rarity) * 100 + '%').padStart(7)} | ${id.padEnd(28)} ${item ? '— ' + item.nameRu : ''}`);
  }
  console.log(`\nВсего: ${entries.length} (отмечено: ${marked}, авто: ${auto})`);
}

function fillUnmarked() {
  const items = parseItems();
  const rarity = existsSync(RARITY_FILE) ? JSON.parse(readFileSync(RARITY_FILE, 'utf-8')) : {};

  let filled = 0;
  for (const item of items) {
    if (rarity[item.id]) continue;
    if (item.price > 0) continue;

    let r;
    if (item.category === 'quest' || item.category === 'crafting') {
      r = Math.floor(Math.random() * 3) + 3;
    } else if (item.category === 'awards' || item.category === 'artifacts') {
      r = Math.floor(Math.random() * 2) + 1;
    } else if (item.category === 'other') {
      r = Math.floor(Math.random() * 4) + 2;
    } else {
      r = Math.floor(Math.random() * 5) + 1;
    }
    rarity[item.id] = { rarity: r, source: 'auto' };
    filled++;
  }

  saveRarity(rarity);
  console.log(`✅ Заполнено ${filled} предметов случайной редкостью`);
  console.log(`   Всего в rarity.json: ${Object.keys(rarity).length}`);
}

function saveRarity(data) {
  writeFileSync(RARITY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function itemCategoryThemes(item) {
  const themes = {
    balls: ['normal', 'flying'],
    healing: ['normal', 'water', 'grass'],
    statusCure: ['grass', 'fairy'],
    ppRecovery: ['psychic', 'water'],
    vitamins: ['fighting', 'normal'],
    evolutionStones: ['fire', 'water', 'grass', 'electric', 'rock', 'ground', 'ice', 'dark', 'ghost', 'fairy', 'dragon'],
    berries: ['grass', 'normal', 'ground'],
    training: ['fighting', 'dragon'],
    battle: ['steel', 'rock', 'fighting', 'dark'],
    tickets: ['flying', 'normal'],
    crafting: ['normal', 'ground', 'water'],
    quest: ['normal', 'psychic', 'ghost', 'dragon', 'fairy', 'dark', 'steel', 'ice', 'fire', 'water', 'grass', 'electric', 'rock', 'ground', 'flying', 'poison', 'bug'],
    other: ['normal', 'psychic'],
    artifacts: ['psychic', 'ghost', 'dragon', 'fairy'],
    awards: ['normal', 'fairy', 'psychic', 'dragon'],
    currency: ['normal'],
  };
  return themes[item.category] || ['normal'];
}

function getPokemonTypes() {
  return {
    'charmander': 'fire', 'charmeleon': 'fire', 'charizard': 'fire', 'vulpix': 'fire', 'ninetales': 'fire',
    'growlithe': 'fire', 'arcanine': 'fire', 'ponyta': 'fire', 'rapidash': 'fire', 'magmar': 'fire',
    'flareon': 'fire', 'moltres': 'fire', 'cyndaquil': 'fire', 'quilava': 'fire', 'typhlosion': 'fire',
    'slugma': 'fire', 'magcargo': 'fire', 'houndour': 'fire', 'houndoom': 'fire', 'magby': 'fire',
    'squirtle': 'water', 'wartortle': 'water', 'blastoise': 'water', 'psyduck': 'water', 'golduck': 'water',
    'poliwag': 'water', 'poliwhirl': 'water', 'poliwrath': 'water', 'tentacool': 'water', 'tentacruel': 'water',
    'seel': 'water', 'dewgong': 'water', 'shellder': 'water', 'cloyster': 'water', 'krabby': 'water',
    'kingler': 'water', 'horsea': 'water', 'seadra': 'water', 'goldeen': 'water', 'seaking': 'water',
    'staryu': 'water', 'starmie': 'water', 'magikarp': 'water', 'gyarados': 'water', 'lapras': 'water',
    'vaporeon': 'water', 'omanyte': 'water', 'omastar': 'water', 'totodile': 'water', 'croconaw': 'water',
    'feraligatr': 'water', 'chinchou': 'water', 'lanturn': 'water', 'marill': 'water', 'azumarill': 'water',
    'politoed': 'water', 'wooper': 'water', 'quagsire': 'water', 'slowpoke': 'water', 'slowbro': 'water',
    'slowking': 'water', 'remoraid': 'water', 'octillery': 'water', 'mantine': 'water', 'kingdra': 'water',
    'bulbasaur': 'grass', 'ivysaur': 'grass', 'venusaur': 'grass', 'oddish': 'grass', 'gloom': 'grass',
    'vileplume': 'grass', 'bellsprout': 'grass', 'weepinbell': 'grass', 'victreebel': 'grass',
    'exeggcute': 'grass', 'exeggutor': 'grass', 'tangela': 'grass', 'chikorita': 'grass', 'bayleef': 'grass',
    'meganium': 'grass', 'hoppip': 'grass', 'skiploom': 'grass', 'jumpluff': 'grass', 'sunkern': 'grass',
    'sunflora': 'grass', 'yanma': 'grass', 'bellossom': 'grass',
    'pikachu': 'electric', 'raichu': 'electric', 'magnemite': 'electric', 'magneton': 'electric',
    'voltorb': 'electric', 'electrode': 'electric', 'electabuzz': 'electric', 'jolteon': 'electric',
    'zapdos': 'electric', 'mareep': 'electric', 'flaaffy': 'electric', 'ampharos': 'electric', 'elekid': 'electric',
    'sandshrew': 'ground', 'sandslash': 'ground', 'diglett': 'ground', 'dugtrio': 'ground',
    'geodude': 'rock', 'graveler': 'rock', 'golem': 'rock', 'onix': 'rock', 'rhydon': 'rock', 'rhyhorn': 'rock',
    'omanyte': 'rock', 'omastar': 'rock', 'kabuto': 'rock', 'kabutops': 'rock', 'aerodactyl': 'rock',
    'sudowoodo': 'rock', 'shuckle': 'rock',
    'pidgey': 'flying', 'pidgeotto': 'flying', 'pidgeot': 'flying', 'spearow': 'flying', 'fearow': 'flying',
    'zubat': 'poison', 'golbat': 'poison', 'grimer': 'poison', 'muk': 'poison', 'koffing': 'poison', 'weezing': 'poison',
    'ekans': 'poison', 'arbok': 'poison', 'nidoran-f': 'poison', 'nidorina': 'poison', 'nidoqueen': 'poison',
    'nidoran-m': 'poison', 'nidorino': 'poison', 'nidoking': 'poison', 'venonat': 'poison',
    'caterpie': 'bug', 'metapod': 'bug', 'butterfree': 'bug', 'weedle': 'bug', 'kakuna': 'bug',
    'beedrill': 'bug', 'paras': 'bug', 'parasect': 'bug', 'scyther': 'bug', 'pinsir': 'bug',
    'ledyba': 'bug', 'ledian': 'bug', 'spinarak': 'bug', 'ariados': 'bug',
    'gastly': 'ghost', 'haunter': 'ghost', 'gengar': 'ghost', 'misdreavus': 'ghost',
    'dratini': 'dragon', 'dragonair': 'dragon', 'dragonite': 'dragon',
    'mewtwo': 'psychic', 'mew': 'psychic', 'abra': 'psychic', 'kadabra': 'psychic', 'alakazam': 'psychic',
    'drowzee': 'psychic', 'hypno': 'psychic', 'mr-mime': 'psychic', 'jynx': 'psychic',
    'natu': 'psychic', 'xatu': 'psychic', 'espeon': 'psychic', 'wobbuffet': 'psychic', 'girafarig': 'psychic',
    'cubone': 'ground', 'marowak': 'ground',
    'machop': 'fighting', 'machoke': 'fighting', 'machamp': 'fighting', 'hitmonlee': 'fighting',
    'hitmonchan': 'fighting', 'hitmontop': 'fighting', 'primeape': 'fighting',
    'clefairy': 'fairy', 'clefable': 'fairy', 'jigglypuff': 'fairy', 'wigglytuff': 'fairy',
    'snorlax': 'normal', 'rattata': 'normal', 'raticate': 'normal', 'meowth': 'normal', 'persian': 'normal',
    'eevee': 'normal', 'porygon': 'normal', 'chansey': 'normal', 'blissey': 'normal', 'ditto': 'normal',
    'kangaskhan': 'normal', 'tauros': 'normal', 'miltank': 'normal', 'teddiursa': 'normal', 'ursaring': 'normal',
    'eelektrik': 'electric', 'eelektross': 'electric',
    'cacnea': 'grass', 'cacturne': 'grass',
    'numel': 'fire', 'camerupt': 'fire',
    'trapinch': 'ground', 'vibrava': 'ground', 'flygon': 'ground',
    'swablu': 'flying', 'altaria': 'dragon',
    'bagon': 'dragon', 'shelgon': 'dragon', 'salamence': 'dragon',
    'ralts': 'psychic', 'kirlia': 'psychic', 'gardevoir': 'psychic', 'gallade': 'psychic',
    'aron': 'steel', 'lairon': 'steel', 'aggron': 'steel', 'skarmory': 'steel',
    'clamperl': 'water', 'huntail': 'water', 'gorebyss': 'water',
    'feebas': 'water', 'milotic': 'water',
    'carvanha': 'water', 'sharpedo': 'water', 'wailmer': 'water', 'wailord': 'water',
    'corphish': 'water', 'crawdaunt': 'water',
    'wynaut': 'psychic',
    'smeargle': 'normal', 'delibird': 'ice', 'smoochum': 'ice',
    'sneasel': 'dark', 'heracross': 'bug', 'stantler': 'normal',
    'zangoose': 'normal', 'seviper': 'poison', 'lunatone': 'rock', 'solrock': 'rock',
    'barboach': 'water', 'whiscash': 'water',
    'baltoy': 'ground', 'claydol': 'ground',
    'lileep': 'grass', 'cradily': 'grass', 'anorith': 'bug', 'armaldo': 'bug',
    'absol': 'dark', 'spheal': 'ice', 'sealeo': 'ice', 'walrein': 'ice',
    'relicanth': 'water', 'luvdisc': 'water',
    'combee': 'bug', 'vespiquen': 'bug',
    'pachirisu': 'electric', 'buizel': 'water', 'floatzel': 'water',
    'cherubi': 'grass', 'cherrim': 'grass',
    'shellos': 'water', 'gastrodon': 'water',
    'drifloon': 'ghost', 'drifblim': 'ghost',
    'buneary': 'normal', 'lopunny': 'normal',
    'glameow': 'normal', 'purugly': 'normal',
    'stunky': 'poison', 'skuntank': 'poison',
    'bronzor': 'psychic', 'bronzong': 'psychic',
    'chatot': 'flying',
    'spiritomb': 'ghost',
    'gible': 'dragon', 'gabite': 'dragon', 'garchomp': 'dragon',
    'riolu': 'fighting', 'lucario': 'fighting',
    'hippopotas': 'ground', 'hippowdon': 'ground',
    'skorupi': 'poison', 'drapion': 'poison',
    'croagunk': 'poison', 'toxicroak': 'poison',
    'finneon': 'water', 'lumineon': 'water',
    'rotom': 'electric', 'gliscor': 'ground',
    'mamoswine': 'ice', 'porygon2': 'normal', 'porygonz': 'normal',
    'electivire': 'electric', 'magmortar': 'fire',
    'togepi': 'fairy', 'togetic': 'fairy', 'togekiss': 'fairy',
    'aipom': 'normal', 'ambipom': 'normal',
    'murkrow': 'dark', 'honchkrow': 'dark',
    'misdreavus': 'ghost', 'mismagius': 'ghost',
    'gligar': 'ground', 'snubbull': 'fairy', 'granbull': 'fairy',
    'corsola': 'water',
    'phanpy': 'ground', 'donphan': 'ground',
    'raikou': 'electric', 'entei': 'fire', 'suicune': 'water',
    'lugia': 'psychic', 'ho-oh': 'fire', 'celebi': 'psychic',
    'treecko': 'grass', 'grovyle': 'grass', 'sceptile': 'grass',
    'torchic': 'fire', 'combusken': 'fire', 'blaziken': 'fire',
    'mudkip': 'water', 'marshtomp': 'water', 'swampert': 'water',
    'poochyena': 'dark', 'mightyena': 'dark',
    'zigzagoon': 'normal', 'linoone': 'normal',
    'wingull': 'water', 'pelipper': 'water',
    'surskit': 'bug', 'masquerain': 'bug',
    'shroomish': 'grass', 'breloom': 'grass',
    'nincada': 'bug', 'ninjask': 'bug', 'shedinja': 'bug',
    'whismur': 'normal', 'loudred': 'normal', 'exploud': 'normal',
    'makuhita': 'fighting', 'hariyama': 'fighting',
    'azurill': 'normal',
    'nosepass': 'rock', 'probopass': 'rock',
    'skitty': 'normal', 'delcatty': 'normal',
    'sableye': 'dark', 'mawile': 'steel',
    'plusle': 'electric', 'minun': 'electric',
    'volbeat': 'bug', 'illumise': 'bug',
    'roselia': 'grass', 'roserade': 'grass',
    'gulpin': 'poison', 'swalot': 'poison',
    'torkoal': 'fire', 'spoink': 'psychic', 'grumpig': 'psychic',
    'castform': 'normal',
    'kecleon': 'normal', 'shuppet': 'ghost', 'banette': 'ghost',
    'duskull': 'ghost', 'dusclops': 'ghost', 'dusknoir': 'ghost',
    'tropius': 'grass', 'chimecho': 'psychic',
    'snorunt': 'ice', 'glalie': 'ice', 'froslass': 'ice',
    'beldum': 'steel', 'metang': 'steel', 'metagross': 'steel',
    'regirock': 'rock', 'regice': 'ice', 'registeel': 'steel',
    'latias': 'dragon', 'latios': 'dragon',
    'kyogre': 'water', 'groudon': 'ground', 'rayquaza': 'dragon',
    'jirachi': 'steel', 'deoxys': 'psychic',
    'turtwig': 'grass', 'grotle': 'grass', 'torterra': 'grass',
    'chimchar': 'fire', 'monferno': 'fire', 'infernape': 'fire',
    'piplup': 'water', 'prinplup': 'water', 'empoleon': 'water',
    'starly': 'normal', 'staravia': 'normal', 'staraptor': 'normal',
    'bidoof': 'normal', 'bibarel': 'normal',
    'kricketot': 'bug', 'kricketune': 'bug',
    'shinx': 'electric', 'luxio': 'electric', 'luxray': 'electric',
    'cranidos': 'rock', 'rampardos': 'rock', 'shieldon': 'rock', 'bastiodon': 'rock',
    'burmy': 'bug', 'wormadam': 'bug', 'mothim': 'bug',
    'ambipom': 'normal', 'chingling': 'psychic',
    'bonsly': 'rock', 'mime-jr': 'psychic', 'happiny': 'normal',
    'carnivine': 'grass',
    'mantyke': 'water', 'snover': 'ice', 'abomasnow': 'ice',
    'porygon-z': 'normal', 'froslass': 'ice', 'heatran': 'fire', 'regigigas': 'normal',
    'cresselia': 'psychic', 'phione': 'water', 'manaphy': 'water', 'darkrai': 'dark',
    'shaymin': 'grass', 'arceus': 'normal',
  };
}

function generateDrops() {
  const rarity = existsSync(RARITY_FILE) ? JSON.parse(readFileSync(RARITY_FILE, 'utf-8')) : {};
  const items = parseItems();
  const pokemon = getAllPokemon();
  const existingDrops = parseDrops();
  const pokeTypes = getPokemonTypes();

  if (Object.keys(rarity).length === 0) {
    console.log('Нет оценок. Сначала запусти: node rarity.js fill');
    return;
  }

  // 1. Универсальные дропы
  const universalDrops = [];
  for (const [id, data] of Object.entries(rarity)) {
    const item = items.find(i => i.id === id);
    if (!item || !item.implemented) continue;
    if (item.category === 'awards' || item.category === 'artifacts') continue;
    if (item.category === 'currency') continue;
    universalDrops.push({
      item: id,
      chance: r2c(data.rarity),
      qty: 1,
    });
  }
  universalDrops.sort((a, b) => a.chance - b.chance);

  // 2. Распределение по покемонам
  const newMonsterDrops = {};
  const pokeItemCount = {};
  let added = 0;

  const itemsByCat = {};
  for (const [id, data] of Object.entries(rarity)) {
    const item = items.find(i => i.id === id);
    if (!item || !item.implemented) continue;
    if (item.category === 'awards' || item.category === 'artifacts') continue;
    if (item.category === 'currency') continue;
    if (!itemsByCat[item.category]) itemsByCat[item.category] = [];
    itemsByCat[item.category].push({ id, rarity: data.rarity, item });
  }

  const catEntries = Object.entries(itemsByCat).sort(() => Math.random() - 0.5);

  for (const [cat, catItems] of catEntries) {
    const themes = itemCategoryThemes({ category: cat });
    const shuffledItems = [...catItems].sort(() => Math.random() - 0.5);

    for (const ci of shuffledItems) {
      const candidates = pokemon.filter(p => {
        const type = pokeTypes[p];
        if (!type || !themes.includes(type)) return false;
        return (pokeItemCount[p] || 0) < 2;
      });

      if (candidates.length === 0) continue;

      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      const count = Math.min(1 + Math.floor(Math.random() * 2), shuffled.length);
      const selected = shuffled.slice(0, count);

      for (const pokeName of selected) {
        if (!newMonsterDrops[pokeName]) newMonsterDrops[pokeName] = [];
        if (!newMonsterDrops[pokeName].includes(ci.id)) {
          newMonsterDrops[pokeName].push(ci.id);
          pokeItemCount[pokeName] = (pokeItemCount[pokeName] || 0) + 1;
          added++;
        }
      }
    }
  }

  // 3. Убираем из универсальных то что распределено по покемонам
  const assignedItems = new Set();
  for (const [, drops] of Object.entries(newMonsterDrops)) {
    drops.forEach(item => assignedItems.add(item));
  }
  const filteredUniversal = universalDrops.filter(d => !assignedItems.has(d.item));

  // 4. drop_config.json
  const dropConfig = {
    universalDrops: filteredUniversal,
    monsterDrops: Object.fromEntries(
      Object.entries(newMonsterDrops).map(([name, drops]) => [
        name,
        drops.map(item => ({
          item,
          chance: (() => {
            const d = rarity[item];
            return d ? r2c(d.rarity) : 0.05;
          })(),
          qty: 1,
        }))
      ])
    ),
  };

  mkdirSync(resolve(__dirname, 'data'), { recursive: true });
  writeFileSync(DROP_CONFIG_FILE, JSON.stringify(dropConfig, null, 2), 'utf-8');

  // 5. Обновляем drops.js
  updateDropsJS(newMonsterDrops, rarity, items);

  console.log(`\n✅ Сгенерировано:`);
  console.log(`   Универсальных дропов: ${filteredUniversal.length} (было ${universalDrops.length})`);
  console.log(`   Покемонов с дропами: ${Object.keys(newMonsterDrops).length}`);
  console.log(`   Новых дропов у покемонов: ${added}`);
  console.log(`   Файлы: data/drop_config.json, src/data/drops.js`);
}

function updateDropsJS(monsterDrops, rarity, items) {
  let content = readFileSync(DROPS_FILE, 'utf-8');
  const tableStart = content.indexOf('MONSTER_DROP_TABLE = {');
  const tableEnd = content.indexOf('};', tableStart) + 2;

  const entries = Object.entries(monsterDrops).sort((a, b) => a[0].localeCompare(b[0]));
  const newTable = entries.map(([name, drops]) => {
    const items = drops.map(d => {
      const r = rarity[d];
      const chance = r ? r2c(r.rarity) : 0.050;
      return `{ item: '${d}', chance: ${chance.toFixed(3)}, qty: 1 }`;
    }).join(', ');
    return `  '${name}': [${items}]`;
  }).join(',\n');

  const newContent = content.slice(0, tableStart) + 'MONSTER_DROP_TABLE = {\n' + newTable + '\n};\n';
  writeFileSync(DROPS_FILE, newContent, 'utf-8');
  console.log(`   drops.js обновлён: ${entries.length} покемонов`);
}

const cmd = process.argv[2];
if (cmd === 'show') {
  showAssessments();
} else if (cmd === 'fill') {
  fillUnmarked();
} else if (cmd === 'gen') {
  generateDrops();
} else {
  console.log('Команды:');
  console.log('  node rarity.js show  — показать все оценки');
  console.log('  node rarity.js fill  — заполнить неотмеченные');
  console.log('  node rarity.js gen   — сгенерировать дропы');
}
