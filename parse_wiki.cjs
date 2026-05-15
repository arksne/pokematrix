const fs = require('fs');
const wiki = JSON.parse(fs.readFileSync('../wiki_database.json', 'utf8'));
const result = {};
const allPokemon = new Set();

// All pokemon by gen
const ALL_POKEMON = [
  'bulbasaur','ivysaur','venusaur','charmander','charmeleon','charizard','squirtle','wartortle','blastoise','caterpie','metapod','butterfree','weedle','kakuna','beedrill','pidgey','pidgeotto','pidgeot','rattata','raticate','spearow','fearow','ekans','arbok','pikachu','raichu','sandshrew','sandslash','nidoran-f','nidorina','nidoqueen','nidoran-m','nidorino','nidoking','clefairy','clefable','vulpix','ninetales','jigglypuff','wigglytuff','zubat','golbat','oddish','gloom','vileplume','paras','parasect','venonat','venomoth','diglett','dugtrio','meowth','persian','psyduck','golduck','mankey','primeape','growlithe','arcanine','poliwag','poliwhirl','poliwrath','abra','kadabra','alakazam','machop','machoke','machamp','bellsprout','weepinbell','victreebel','tentacool','tentacruel','geodude','graveler','golem','ponyta','rapidash','slowpoke','slowbro','magnemite','magneton','farfetchd','doduo','dodrio','seel','dewgong','grimer','muk','shellder','cloyster','gastly','haunter','gengar','onix','drowzee','hypno','krabby','kingler','voltorb','electrode','exeggcute','exeggutor','cubone','marowak','hitmonlee','hitmonchan','lickitung','koffing','weezing','rhyhorn','rhydon','chansey','tangela','kangaskhan','horsea','seadra','goldeen','seaking','staryu','starmie','mr-mime','scyther','jynx','electabuzz','magmar','pinsir','tauros','magikarp','gyarados','lapras','ditto','eevee','vaporeon','jolteon','flareon','porygon','omanyte','omastar','kabuto','kabutops','aerodactyl','snorlax','articuno','zapdos','moltres','dratini','dragonair','dragonite','mewtwo','mew',
  'chikorita','bayleef','meganium','cyndaquil','quilava','typhlosion','totodile','croconaw','feraligatr','sentret','furret','hoothoot','noctowl','ledyba','ledian','spinarak','ariados','crobat','chinchou','lanturn','pichu','cleffa','igglybuff','togepi','togetic','natu','xatu','mareep','flaaffy','ampharos','bellossom','marill','azumarill','sudowoodo','politoed','hoppip','skiploom','jumpluff','aipom','sunkern','sunflora','yanma','wooper','quagsire','espeon','umbreon','murkrow','slowking','misdreavus','unown','wobbuffet','girafarig','pineco','forretress','dunsparce','gligar','steelix','snubbull','granbull','qwilfish','scizor','shuckle','heracross','sneasel','teddiursa','ursaring','slugma','magcargo','swinub','piloswine','corsola','remoraid','octillery','delibird','mantine','skarmory','houndour','houndoom','kingdra','phanpy','donphan','porygon2','stantler','smeargle','tyrogue','hitmontop','smoochum','elekid','magby','miltank','blissey','raikou','entei','suicune','larvitar','pupitar','tyranitar','lugia','ho-oh','celebi',
  'treecko','grovyle','sceptile','torchic','combusken','blaziken','mudkip','marshtomp','swampert','poochyena','mightyena','zigzagoon','linoone','wurmple','silcoon','beautifly','cascoon','dustox','lotad','lombre','ludicolo','seedot','nuzleaf','shiftry','taillow','swellow','wingull','pelipper','ralts','kirlia','gardevoir','surskit','masquerain','shroomish','breloom','slakoth','vigoroth','slaking','nincada','ninjask','shedinja','whismur','loudred','exploud','makuhita','hariyama','azurill','nosepass','skitty','delcatty','sableye','mawile','aron','lairon','aggron','meditite','medicham','electrike','manectric','plusle','minun','volbeat','illumise','roselia','gulpin','swalot','carvanha','sharpedo','wailmer','wailord','numel','camerupt','torkoal','spoink','grumpig','spinda','trapinch','vibrava','flygon','cacnea','cacturne','swablu','altaria','zangoose','seviper','lunatone','solrock','barboach','whiscash','corphish','crawdaunt','baltoy','claydol','lileep','cradily','anorith','armaldo','feebas','milotic','castform','kecleon','shuppet','banette','duskull','dusclops','tropius','chimecho','absol','wynaut','snorunt','glalie','spheal','sealeo','walrein','clamperl','huntail','gorebyss','relicanth','luvdisc','bagon','shelgon','salamence','beldum','metang','metagross','regirock','regice','registeel','latias','latios','kyogre','groudon','rayquaza','jirachi','deoxys',
  'turtwig','grotle','torterra','chimchar','monferno','infernape','piplup','prinplup','empoleon','starly','staravia','staraptor','bidoof','bibarel','kricketot','kricketune','shinx','luxio','luxray','budew','roserade','cranidos','rampardos','shieldon','bastiodon','burmy','wormadam','mothim','combee','vespiquen','pachirisu','buizel','floatzel','cherubi','cherrim','shellos','gastrodon','ambipom','drifloon','drifblim','buneary','lopunny','mismagius','honchkrow','glameow','purugly','chingling','stunky','skuntank','bronzor','bronzong','bonsly','mime-jr','happiny','chatot','spiritomb','gible','gabite','garchomp','munchlax','riolu','lucario','hippopotas','hippowdon','skorupi','drapion','croagunk','toxicroak','carnivine','finneon','lumineon','mantyke','snover','abomasnow','weavile','magnezone','lickilicky','rhyperior','tangrowth','electivire','magmortar','togekiss','yanmega','leafeon','glaceon','gliscor','mamoswine','porygon-z','gallade','probopass','dusknoir','froslass','rotom','uxie','mesprit','azelf','dialga','palkia','heatran','regigigas','giratina','cresselia','phione','manaphy','darkrai','shaymin','arceus',
];

for (const name of ALL_POKEMON) allPokemon.add(name);

// Parse wiki pages
for (const [title, html] of Object.entries(wiki)) {
  const nameMatch = title.match(/^\d+(?:\.\d+)?\s+(.+?)(?:\s+-\s+\d+(?:\.\d+)?\s+(.+?))?(?:\s+-\s+\d+(?:\.\d+)?\s+(.+?))?\s*\(FAQ\)/);
  if (!nameMatch) continue;
  const names = [nameMatch[1], nameMatch[2], nameMatch[3]].filter(Boolean).map(n => n.trim().toLowerCase());
  const fullText = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, '').replace(/'''/g, '').replace(/''/g, '').replace(/\s+/g, ' ');

  for (const name of names) {
    allPokemon.add(name);
    const isLaterEvo = names.indexOf(name) > 0;

    let method, location;
    if (fullText.match(/поймать невозможно|нельзя поймать|недоступен для поимки/i)) { method = 'Недоступен'; location = '-'; }
    else if (isLaterEvo) { method = 'Эволюция'; location = `Эволюция из ${names[names.indexOf(name)-1]}`; }
    else if (fullText.match(/стартов[ыойе]|стартер/i)) { method = 'Стартовый'; location = 'Профессор'; }
    else if (fullText.match(/обмен|трейд/i)) { method = 'Обмен'; location = 'Обмен с другим тренером'; }
    else if (fullText.match(/яйц|вылуп|разведен/i)) { method = 'Яйцо'; location = 'Питомник'; }
    else if (fullText.match(/подар|ивент|награда/i)) { method = 'Подарок'; location = 'Ивент / NPC'; }
    else if (fullText.match(/легендар/i)) { method = 'Легендарный'; location = 'Особое место'; }
    else if (fullText.match(/поймать|обитает|встречает|локаци|маршрут|forest|mountain|cave|sea|ocean|river|lake|дикий|wild/i)) {
      method = 'Поимка';
      const locMatch = fullText.match(/(?:Маршрут|Route|Локаци|Город|Лес|Гора|Пещер|Океан|Море|Река|Озеро|Сафари|Зона)[^.,;!?\n]{0,60}/gi);
      location = locMatch ? [...new Set(locMatch)].slice(0, 3).join(', ') : 'Дикая локация';
    } else { method = 'Поимка'; location = 'Дикая локация'; }

    if (!result[name]) result[name] = { method, location };
  }
}

// Fill remaining pokemon
for (const name of ALL_POKEMON) {
  if (!result[name]) {
    const isLegend = /mewtwo|mew|articuno|zapdos|moltres|raikou|entei|suicune|lugia|ho-oh|celebi|regi|latias|latios|kyogre|groudon|rayquaza|jirachi|deoxys|dialga|palkia|giratina|darkrai|arceus|zekrom|reshiram|kyurem|xerneas|yveltal|zygarde|cosmog|solgaleo|lunala|necrozma|marshadow|zeraora|zacian|zamazenta|eternatus|koraidon|miraidon|uxie|mesprit|azelf|heatran|regigigas|cresselia|phione|manaphy|shaymin/.test(name);
    const isStarter = /treecko|grovyle|sceptile|torchic|combusken|blaziken|mudkip|marshtomp|swampert|turtwig|grotle|torterra|chimchar|monferno|infernape|piplup|prinplup|empoleon|snivy|servine|serperior|tepig|pignite|emboar|oshawott|dewott|samurott|chespin|quilladin|chesnaught|fennekin|braixen|delphox|froakie|frogadier|greninja|rowlet|dartrix|decidueye|litten|torracat|incineroar|popplio|brionne|primarina|grookey|thwackey|rillaboom|scorbunny|raboot|cinderace|sobble|drizzile|inteleon|sprigatito|floragato|meowscarada|fuecoco|crocalor|skeledirge|quaxly|quaxwell|quaquaval/.test(name);
    if (isLegend) result[name] = { method: 'Легендарный', location: 'Особое место' };
    else if (isStarter) result[name] = { method: 'Стартовый', location: 'Профессор' };
    else result[name] = { method: 'Поимка', location: 'Дикая локация' };
  }
}

fs.writeFileSync('public/pokedex_data.json', JSON.stringify(result));
console.log(`Written ${Object.keys(result).length} pokemon to public/pokedex_data.json`);
console.log('Sample:', Object.entries(result).slice(0, 10).map(([k,v]) => `${k}: ${v.method} @ ${v.location}`).join('\n'));
