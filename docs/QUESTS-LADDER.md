# Лесенка квестов v3: 15 городов × 10 = 150 (+10 Пьютера = 160)

> Статус: дизайн v3, 2026-10-14. v2 упрекнули справедливо: архетипы всё равно
> повторялись пачками. v3: у каждого города СВОЯ фирменная механика из его лора
> (Сафари, Казино, S.S. Anne, Особняк, Штаб R, Руины Альф, Конкурс жуков,
> Башни, Озеро Ярости, Логово драконов...), остальные слоты — тоже с твистами.
> База: пачка Пьютера (`pw_*`) — минимум сложности. Сложность: комбинированная ×2.

## Правила v3 (опросник + уточнения)

1. Порядок городов — по уровню гима: Пьютер 40 → Церулин 45 → Вермилион 50 →
   Селадон 55 → Шаффран 60 → Фуксия 65 → Киноварь 70 → Виридиан 75 → Вайолет 80 →
   Азалия 85 → Голденрод 90 → Эйкрутик 95 → Сианвуд 100 → Оливин 100 →
   Махогани 100 → Блэкторн 100.
2. **Полная свобода**: никаких цепочек, все 150 сразу. Гимы всегда открыты.
3. **Фирменность**: в каждом городе ≥1 квест, который возможен ТОЛЬКО там
   (уникальная локация/механика/вид). Внутри города механики не повторяются.
4. **Титулы — 30**: 15 за мини-боссов + 15 за финалы городов (стрики).
5. **Деньги** = база × (n+1), n — номер города: гринд/охота/контрудар 5k,
   кладовая 50k, кулак 15k, редкость 25k, кошелёк 5k, гнездо 8k, закалка/строй 10k,
   странник/маршрут 5k, гонец/расход 4.5k (≈), стрик/экзотика 30k.
6. **Плюшки бьют в гим**: ТМ тропы = покрытие типа гима, ТМ кулака = STAB.
   Id сверить с `moves_db.json` / `items.ts` при внедрении.
7. **Сначала движок**: verify, титулы, боссы, посылки (см. «Что допилить»).

## Что допилить в движке

- `verify.typeSpecies/typeCount`, `verify.regionLocs + region`.
- 15 мини-боссов (`friendly: true`) + кнопка боя. 30 титулов. Посылки на 2–3 плеча.
- TODO-механики (помечены ⚠️): фильтр времени суток, трекинг обменов, verify по дексу.
- Исключения лесенки помечены «(искл.)» — там flavor важнее цифр
  (26 букв анноуна, 5 сестёр кимоно, Leaf Stone ×3 — камни дорогие).

## 30 титулов

Боссы: `tideMaster` 🌊 Покоритель волн, `stormRod` ⚡ Громоотвод,
`leafFriend` 🍃 Друг листвы, `mindBender` 🌀 Разумник, `fuchsiaShadow` 🥷 Тень Фуксии,
`fireSpirit` 🔥 Огненный дух, `rBane` 🕶️ Кара R, `skyLord` 🦅 Властелин небес,
`swarmKin` 🐝 Роевой, `goldenStar` 🌟 Звезда Голденрода, `spiritFriend` 🎐 Друг духов,
`ironFist` 👊 Железный кулак, `steelWill` ⚙️ Стальной характер,
`winterHeart` ❄️ Сердце зимы, `dragonBlood` 🐉 Кровь драконов.
Финалы: `cerUnsinkable` 🛟 Непотопляемый, `verGrounded` 🔌 Заземлённый,
`celUnfading` 🌺 Неувядаемый, `safClosedBook` 📕 Закрытая книга,
`fucSilent` 🤫 Бесшумный, `cinUnburnt` 🧯 Несгораемый, `virIncorruptible` 💎 Неподкупный,
`vioFreeWind` 🪁 Вольный ветер, `azaSting` 📌 Жало, `golIdol` 🎤 Кумир,
`ecrIncorporeal` 👤 Бестелесный, `ciaUnbroken` ⛓️‍💥 Несломленный,
`oliStainless` 🪞 Нержавеющий, `mahWarmHeart` 💓 Тёплое сердце,
`blaDragonlord` 🐲 Повелитель драконов.

## База Пьютера (n=0)

Тропа 25+5 лок+ср15 / кладовая max25+8 видов / кулак 3×28 / редкость Aerodactyl×1 /
кошелёк 100k / гнездо 1 / закалка EV100 / странник 12 / гонец 1 плечо / стрик 10.

---

## 1. Церулин — Мисти, вода, 45 (n=1). Фишка: пещера + ископаемые

Босс **Пловец Финн**: psyduck 33, poliwhirl 33, tentacruel 33.
Пул воды: squirtle, psyduck, poliwag, tentacool, krabby, horsea, staryu, magikarp,
goldeen, shellder, slowpoke, lapras, totodile, marill, wooper + PokeAPI.
NPC: Марина 🔬 (`ceruleanCity`), Финн 🏊 (`ceruleanStadium`), Гарпун 🎣 (`route24`),
Прибой 💰 (`ceruleanCity_pokemart`), Лагуна 🥚 (`ceruleanCity_pokecenter`),
Штиль 🏋️ (`ceruleanCity_trainingGrounds` — создать), Маяк 🗼 (`route25`),
Бриз 🛵 (`vermilionCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `cer_trail` | Мокрая тропа | гринд | 40 водных + 6 лок + ср.ур.20 | 10k + TM Thunderbolt + superPotion×3 |
| `cer_fossil` | Камень с горы Мун | расход | использовать 2 Helix/Dome Fossil (оживи в лаборатории!) | 9k + rareBone×2 |
| `cer_repel` | Чистый фарватер | расход | 6 Super Repel на водных маршрутах | 9k + expCandyL×2 |
| `cer_sky` | Глубинный зов | редкость | поймать Lapras ×1 | 50k + luxuryBall×2 |
| `cer_money` | Морская касса | заработок | 160k | 10k + pearl×3 |
| `cer_breed` | Икра и пена | выводок | вылупить 1 | 16k + everstone |
| `cer_mass` | Полные сети | улов | поймать 8 водных | 10k + netBall×4 |
| `cer_counter` | Заземлись | контрудар | победить 20 электрических | 10k + Cheri Berry×5 |
| `cer_fist` | Прибойный кулак | босс | Финн 3×33 | 30k + TM Surf + rareCandy×1 + «Покоритель волн» |
| `cer_streak` | Штиль и шторм | стрик | 12 побед | 60k + shellBell + «Непотопляемый» |

## 2. Вермилион — Сёрдж, электро, 50 (n=2). Фишка: S.S. Anne + электростанция

Босс **Матрос Вольт**: pikachu 38, magneton 38, electabuzz 38.
Пул: pikachu, magnemite, voltorb, electabuzz, jolteon, mareep, elekid + PokeAPI.
NPC: Тесла 🔬 (`vermilionCity`), Вольт ⚓ (`vermilionStadium`), Катушка 🎣
(`vermilionPier`), Ампер 💰 (`vermilionCity_pokemart`), Искра 🥚
(`vermilionCity_pokecenter`), Заземление 🏋️ (`vermilionCity_trainingGrounds` —
создать), Порт 🚢 (`ssAnne`), Провод 🛵 (`saffronCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `ver_trail` | Искрящая тропа | гринд | 60 электро + 7 лок + ср.ур.25 | 15k + TM Bulldoze + superPotion×4 |
| `ver_volatile` | Осторожно, взрывается | охота | победить 30 Voltorb/Electrode (самоуничтожение — добивай первым!) | 15k + Magnet×1 |
| `ver_mass` | Аккумуляторная | улов | поймать 10 электрических | 15k + fastBall×4 |
| `ver_sky` | Живая молния | редкость | поймать Electabuzz ×1 | 75k + luxuryBall×3 |
| `ver_counter` | Копай глубже | контрудар | победить 30 земляных | 15k + Soft Sand×1 |
| `ver_money` | Портовый оборот | заработок | 250k | 15k + bigPearl×2 |
| `ver_anne` | Зайцы на лайнере | маршрут | исходить S.S. Anne + пирс + станцию (корабль уплывает — успей!) | 15k + escapeRope×3 + superRepel×8 |
| `ver_breed` | Заряженное гнездо | выводок | вылупить 2 | 24k + seaIncense |
| `ver_fist` | Высоковольтный | босс | Вольт 3×38 | 45k + TM Thunderbolt + rareCandy×1 + «Громоотвод» |
| `ver_streak` | Без коротких | стрик | 14 побед | 90k + blackSludge + «Заземлённый» |

## 3. Селадон — Эрика, трава, 55 (n=3). Фишка: казино + Иви

Босс **Садовница Флора**: bellsprout 43, exeggcute 43, tangela 43, vileplume 43.
Пул: bulbasaur, oddish, bellsprout, exeggcute, tangela, chikorita, sunkern,
hoppip, paras + PokeAPI.
NPC: Ботаник 🔬 (`celadonCity`), Флора 🌸 (`celadonStadium`), Сачок 🦋 (`route7`),
Лепесток 💰 (`celadonCity_pokemart`), Оранжерея 🥚 (`celadonCity_pokecenter`),
Корень 🏋️ (`celadonCity_trainingGrounds` — создать), Джекпот 🎰 (`celadonCity`),
Спица 🚲 (`lavenderTown`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `cel_trail` | Зелёная тропа | гринд | 85 травяных + 8 лок + ср.ур.30 | 20k + TM Aerial Ace + superPotion×5 |
| `cel_hoard` | Гербарий | коллекция | maxур.40 + 11 видов травы | 200k + ultraBall×10 |
| `cel_eevee` | Приз игрового угла | редкость | поймать Eevee ×5 (добыча казино — только так!) | 100k + sootheBell×1 |
| `cel_counter` | Прополка огнём | контрудар | победить 45 огненных | 20k + Charcoal×1 |
| `cel_coins` | Джекпот | заработок | 400k (казино не в счёт — только бои и торговля!) | 20k + starPiece×2 |
| `cel_breed` | Теплица | выводок | вылупить 2 | 32k + laxIncense |
| `cel_stone` | Камень преткновения | расход | использовать 3 Leaf Stone (искл.: камни дорогие) | 18k + Miracle Seed×1 |
| `cel_temper` | Фотосинтез | EV-пул | 160 | 40k + zinc |
| `cel_fist` | Шипастый кулак | босс | Флора 4×43 | 60k + TM Solar Beam + rareCandy×1 + «Друг листвы» |
| `cel_streak` | Без сорняков | стрик | 16 побед | 120k + rockyHelmet + «Неувядаемый» |

## 4. Шаффран — Сабрина, психика, 60 (n=4). Фишка: додзё + Силф

Босс **Медиум Эспер**: drowzee 48, kadabra 48, mr-mime 48, hypno 48.
Пул: abra, drowzee, mr-mime, espeon, unown, girafarig, slowpoke, exeggcute + PokeAPI.
NPC: Пси 🔬 (`saffronCity`), Эспер 🔮 (`saffronPsychicStadium`), Ловец снов 🌙
(`route9`), Силф 💰 (`saffronCity_pokemart`), Телепатка 🥚 (`saffronCity_pokecenter`),
Додзё 🥋 (`saffronCity_trainingGrounds` — создать), Маглев 🚄 (`saffronStation`),
Курьер 🛵 (`fuchsiaCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `saf_trail` | Ментальная тропа | гринд | 115 психов + 9 лок + ср.ур.35 | 25k + TM Shadow Ball + hyperPotion×3 |
| `saf_files` | Картотека разума | коллекция | maxур.45 + 12 видов психов | 250k + timerBall×6 |
| `saf_sky` | Телепорт в руки | редкость | поймать Abra ×2 (убегает с первого хода!) | 125k + luxuryBall×5 |
| `saf_dojo` | Дежурство в додзё | контрудар | победить 60 бойцов (боевое додзё держит удар) | 25k + Black Belt×1 |
| `saf_money` | Контракт Силфа | заработок | 650k | 25k + nugget×3 |
| `saf_breed` | Яйцо в стазисе | выводок | вылупить 3 | 40k + oddIncense |
| `saf_revive` | Санитары додзё | расход | использовать 12 Revive | 23k + Focus Band×1 |
| `saf_fist` | Третий глаз | босс | Эспер 4×48 | 75k + TM Psychic + rareCandy×1 + «Разумник» |
| `saf_wander` | Мегаполис | визиты | 26 визитов Канто | 25k + escapeRope×3 + maxRepel×8 |
| `saf_streak` | Холодный расчёт | стрик | 18 побед | 150k + kingsRock + «Закрытая книга» |

## 5. Фуксия — Кога, яд, 65 (n=5). Фишка: Сафари-зона

Босс **Ученик Коги**: koffing 53, grimer 53, ekans 53, arbok 53.
Пул: ekans, nidoran, zubat, grimer, koffing, tentacool, gastly, spinarak,
qwilfish, shuckle + PokeAPI.
NPC: Сафари 🔬 (`fuchsiaCity`), Ученик Коги 🥷 (`fuchsiaPoisonStadium`),
Следопыт 🐾 (`route15`), Клык 💰 (`fuchsiaCity_pokemart`), Вольер 🥚
(`fuchsiaCity_pokecenter`), Тишина 🏋️ (`fuchsiaCity_trainingGrounds` — создать),
Смотритель 🎫 (`safariZone`), Тропа 🛵 (`cinnabarIsland`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `fuc_trail` | Ядовитая тропа | гринд | 150 ядовитых + 10 лок + ср.ур.40 | 30k + TM Psychic + hyperPotion×4 |
| `fuc_hoard` | Противоядия | коллекция | maxур.50 + 13 видов яда | 300k + timerBall×8 |
| `fuc_safari` | Сафари-трофей | улов+маршрут | поймать 18 травяных/жуков + исходить safariZone (правила сафари: только ловля!) | 30k + safariBall? нет — nestBall×6 |
| `fuc_sky` | Редкая плесень | редкость | поймать Grimer ×2 | 150k + luxuryBall×6 |
| `fuc_counter` | Проветривание | контрудар | победить 75 земляных/психов | 30k + Pecha Berry×8 |
| `fuc_money` | Сафари-прибыль | заработок | 1M | 30k + bigNugget×2 |
| `fuc_breed` | Кладка в вольере | выводок | вылупить 3 | 48k + rockIncense |
| `fuc_antidote` | Аптечка следопыта | расход | 15 Antidote | 27k + Poison Barb×1 |
| `fuc_fist` | Тихий шаг | босс | Ученик Коги 4×53 | 90k + TM Sludge Bomb + rareCandy×1 + «Тень Фуксии» |
| `fuc_streak` | Без царапин | стрик | 20 побед | 180k + razorClaw + «Бесшумный» |

## 6. Киноварь — Блейн, огонь, 70 (n=6). Фишка: особняк + ключи

Босс **Пирокинетик Блейз**: ponyta 58, growlithe 58, magmar 58, rapidash 58.
Пул: charmander, vulpix, growlithe, ponyta, magmar, flareon, cyndaquil,
slugma, houndour + PokeAPI.
NPC: Вулканолог 🌋 (`cinnabarIsland`), Блейз 🔥 (`cinnabarStadium`),
Пепел 🌫️ (`pokemonMansion`), Обсидиан 💰 (`cinnabarIsland_pokecenter`),
Терма 🥚 (`cinnabarIsland_pokecenter`), Кратер 🏋️
(`cinnabarIsland_trainingGrounds` — создать), Журнал 📓 (`pokemonMansion`),
Паром ⛴️ (`viridianCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `cin_trail` | Пепельная тропа | гринд | 195 огненных + 11 лок + ср.ур.45 | 35k + TM Surf + hyperPotion×5 |
| `cin_mass` | Вулканический пояс | улов | поймать 22 огненных | 35k + repeatBall×5 |
| `cin_amber` | Янтарь из подвала | расход | использовать 1 Old Amber (эхо пьютерской охоты — оживи сам!) | 32k + fossilWing? нет — skullFossil×1 |
| `cin_sky` | Огненный щенок | редкость | поймать Growlithe ×3 | 175k + luxuryBall×8 |
| `cin_counter` | Залить водой | контрудар | победить 95 водных/земляных | 35k + Rawst Berry×8 |
| `cin_money` | Геотермальный фонд | заработок | 1.6M | 35k + cometShard×2 |
| `cin_breed` | Инкубатор кратера | выводок | вылупить 4 | 56k + waveIncense |
| `cin_journals` | Дневники особняка | маршрут | исходить 6 точек (особняк, кратер, Эмбер, тропа, острова, море) + победить 30 Koffing/grimer особняка (мутанты из труб!) | 35k + escapeRope×3 + maxRepel×12 |
| `cin_fist` | Испытание жаром | босс | Блейз 4×58 | 105k + TM Flamethrower + rareCandy×2 + «Огненный дух» |
| `cin_streak` | Несгораемый | стрик | 22 победы | 210k + razorFang + «Несгораемый» |

## 7. Виридиан — Джованни, земля, 75 (n=7). Фишка: лес Пикачу + кроты

Босс **Агент R**: cubone 63, rhyhorn 63, diglett 63, dugtrio 63, marowak 63.
Пул: sandshrew, diglett, geodude, onix, cubone, rhyhorn, wooper, gligar,
larvitar, donphan, steelix + PokeAPI.
NPC: Лесник 🌲 (`viridianCity`), Агент R 🕶️ (`viridianStadium`), Капкан 🪤
(`viridianForest`), Серый 💰 (`viridianCity_pokemart`), Нора 🥚
(`viridianCity_pokecenter`), Плато 🏋️ (`viridianCity_trainingGrounds` — создать),
Паллет 🎒 (`palletTown`), Перевал 🛵 (`pewterCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `vir_trail` | Корневая тропа | гринд | 245 земляных + 12 лок + ср.ур.50 | 40k + TM Giga Drain + maxPotion×2 |
| `vir_hoard` | Недра | коллекция | maxур.60 + 15 видов земли | 400k + quickBall×8 |
| `vir_mole` | Кротовая война | охота | победить 120 Diglett/Dugtrio | 40k + Soft Sand×1 |
| `vir_pika` | Лесная легенда | улов вида | поймать 26 Pikachu в Виридианском лесу (миф, но проверь!) | 40k + lightBall×1 |
| `vir_money` | Общак R | заработок | 2.5M | 40k + balmMushroom×2 |
| `vir_breed` | Нора-гнездо | выводок | вылупить 4 | 64k + roseIncense |
| `vir_rope` | Спелеолог | расход | 22 Escape Rope | 36k + escapeRope×5 |
| `vir_fist` | Операция «Крот» | босс | Агент R 5×63 | 120k + TM Earthquake + rareCandy×2 + «Кара R» |
| `vir_counter` | Полив и покос | контрудар | победить 120 водных/травяных/ледяных | 40k + Aspear Berry×8 |
| `vir_streak` | Твёрдая порода | стрик | 24 победы | 240k + scopeLens + «Неподкупный» |

## 8. Вайолет — Фолкнер, полёт, 80 (n=8, ДЖОТО). Фишка: руины Альф

Босс **Пилот Скай**: pidgeotto 68, fearow 68, noctowl 68, skarmory 68, dodrio 68.
Пул: pidgey, spearow, farfetchd, doduo, hoothoot, murkrow, gligar, delibird,
skarmory + PokeAPI.
NPC: Руинолог 🏛️ (`violetCity`), Скай ✈️ (`violetStadium`), Росток 🌱
(`sproutTower`), Колокол 💰 (`violetCity_pokemart`), Гнездо 🥚
(`violetCity_pokecenter`), Башня 🏋️ (`violetCity_trainingGrounds` — создать),
Старейшина 👴 (`ruinsOfAlph`), Перелёт 🚂 (`viridianCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `vio_trail` | Небесная тропа | гринд | 305 летающих + 13 лок + ср.ур.55 | 45k + TM Ice Beam + maxPotion×3 |
| `vio_unown` | Алфавит руин | улов вида | поймать 26 Unown (искл.: 26 букв — flavor важнее лесенки) | 45k + oddIncense? нет — enigmaBerry? нет — twistUnown? награда: 45k + scopeLens? нет — 45k + lumBerry×10 |
| `vio_night` | Ночной дозор | редкость | Hoothoot ×3 ночью (⚠️ TODO время) | 225k + duskBall×10 |
| `vio_counter` | Каменный град | контрудар | победить 150 электрических/ледяных/каменных | 45k + Sharp Beak×1 |
| `vio_money` | Почтовый сбор | заработок | 4M | 45k + pearlString×2 |
| `vio_breed` | Высокое гнездо | выводок | вылупить 5 | 72k + fullIncense |
| `vio_balls` | Запас перьев | расход | 26 Great Ball | 41k + wingBall×5 (id уточнить) |
| `vio_fist` | Воздушный бой | босс | Скай 5×68 | 135k + TM Aerial Ace + rareCandy×2 + «Властелин небес» |
| `vio_pillar` | Столб башни | маршрут | исходить 7 точек (город, башня Росток, руины, маршруты, пещера, парк) не выходя из Джото | 45k + escapeRope×3 + maxRepel×18 |
| `vio_streak` | Попутный ветер | стрик | 26 побед | 270k + wideLens + «Вольный ветер» |

## 9. Азалия — Багси, жуки, 85 (n=9, ДЖОТО). Фишка: конкурс жуков

Босс **Ловец Жуков Рой**: parasect 73, venomoth 73, scyther 73, heracross 73, forretress 73.
Пул: caterpie, weedle, paras, venonat, scyther, pinsir, ledyba, spinarak,
yanma, heracross, shuckle, forretress + PokeAPI.
NPC: Энтомолог 🐛 (`azaleaTown`), Рой 🪲 (`azaleaStadium`), Паутина 🕸️
(`ilexForest`), Смола 💰 (`azaleaTown_pokemart`), Кокон 🥚 (`azaleaTown_pokecenter`),
Колодец 🏋️ (`slowpokeWell`), Угольщик ⛏️ (`unionCave`), Лес 🛵 (`violetCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `aza_trail` | Жужжащая тропа | гринд | 375 жуков + 14 лок + ср.ур.60 | 50k + TM Flamethrower + maxPotion×4 |
| `aza_spider` | Паутинная зачистка | охота | победить 185 Spinarak/Ariados в Иликс | 50k + Silver Powder×1 |
| `aza_contest` | Главный приз | конкурс | поймать Scyther ×4 + maxур.70 (судья смотрит уровень!) | 500k + starPiece×1 |
| `aza_hoard` | Хитиновый фонд | коллекция | maxур.70 + 17 видов жуков | 500k + repeatBall×8 |
| `aza_counter` | Дымовая шашка | контрудар | победить 185 огненных/летающих/каменных | 50k + Pecha Berry×10 |
| `aza_money` | Смоляной промысел | заработок | 6.5M | 50k + bigNugget×5 |
| `aza_breed` | Коконная | выводок | вылупить 5 | 80k + luckIncense |
| `aza_slowpoke` | Колодец зевоты | улов вида | поймать 35 Slowpoke (не дай уснуть... тебе) | 50k + kingsRock? нет — laggingTail? нет — 50k + mentalHerb? нет — 50k + guardSpec? нет — 50k + smokeBall×5 |
| `aza_fist` | Роевой гул | босс | Рой 5×73 | 150k + TM X-Scissor + rareCandy×2 + «Роевой» |
| `aza_streak` | Без укусов | стрик | 28 побед | 300k + zoomLens + «Жало» |

## 10. Голденрод — Уитни, норма, 90 (n=10, ДЖОТО). Фишка: штаб R + бартер

Босс **Суперфанат Норм**: raticate 78, clefable 78, wigglytuff 78, persian 78, porygon 78.
Пул: rattata, clefairy, jigglypuff, meowth, chansey, kangaskhan, tauros,
ditto, eevee, porygon, aipom, miltank, teddiursa, smeargle, blissey + PokeAPI.
NPC: Урбанист 🏙️ (`goldenrodCity`), Норм ⭐ (`goldenrodStadium`), Парк 🌳
(`nationalPark`), Витрина 💰 (`goldenrodCity_pokemart`), Селекция 🥚
(`goldenrodCity_pokecenter`), Радиобашня 📻 (`teamRocketHq`), Вокзал 🚉
(`goldenrodStation`), Экспресс 🚂 (`azaleaTown`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `gol_trail` | Неоновая тропа | гринд | 455 обычных + 15 лок + ср.ур.65 | 55k + TM Brick Break + fullRestore×1 |
| `gol_rats` | Крысиная зачистка | охота | победить 225 Rattata/Meowth (город кишит) | 55k + Silk Scarf×1 |
| `gol_rockets` | Крысы в подвале | контрудар | победить 225 ядовитых/тёмных (зачистка штаба R!) | 55k + Black Glasses×1 |
| `gol_hoard` | Витрина видов | коллекция | maxур.75 + 18 видов нормы | 550k + netBall×8 |
| `gol_money` | Неоновый оборот | заработок | 10M | 55k + starPiece×5 |
| `gol_trade` | Бартер-холл | экзотика | 3 обмена в трейд-центре (⚠️ TODO трекинг) | 330k + ppMax×1 |
| `gol_breed` | Селекция | выводок | вылупить 6 | 88k + pureIncense |
| `gol_fist` | Звёздный час | босс | Норм 5×78 | 165k + TM Facade + rareCandy×2 + «Звезда Голденрода» |
| `gol_hq` | Штурм башни | маршрут | исходить 6 точек (город, штаб, вокзал, маршруты, парк) | 55k + escapeRope×3 + maxRepel×26 |
| `gol_streak` | Без антрактов | стрик | 30 побед | 330k + metronome + «Кумир» |

## 11. Эйкрутик — Морти, призраки, 95 (n=11, ДЖОТО). Фишка: башни + сёстры кимоно

Босс **Медиум Тень** («армия теней»): gastly 83, haunter 83, haunter 83,
misdreavus 83, gengar 83, gengar 83.
Пул: gastly, haunter, gengar, misdreavus + PokeAPI.
NPC: Фольклорист 📜 (`ecruteakCity`), Тень 🌑 (`ecruteakStadium`),
Полночь 🦉 (`bellTower`), Благовония 💰 (`ecruteakCity_pokemart`),
Предание 🥚 (`ecruteakCity_pokecenter`), Колокол 🏋️ (`burnedTower`),
Пепел 🔥 (`burnedTower`), Тьма 🛵 (`goldenrodCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `ecr_trail` | Туманная тропа | гринд | 545 призраков + 16 лок + ср.ур.70 | 60k + TM Dark Pulse + fullRestore×2 |
| `ecr_ghost` | Перепись духов | улов | поймать 45 призрачных | 60k + duskBall×10 |
| `ecr_kimono` | Пять вееров | охота | победить по 8 Vaporeon/Jolteon/Flareon/Espeon/Umbreon сестёр кимоно (искл.: 5×8 — танец пяти стихий) | 60k + sootheBell×1 |
| `ecr_night` | Полуночный обход | редкость | Gastly ×4 ночью (⚠️ TODO время) | 300k + luxuryBall×20 |
| `ecr_mirror` | Познай тьму | контрудар | победить 270 призрачных/тёмных | 60k + Spell Tag×1 |
| `ecr_money` | Плата за тишину | заработок | 16M | 60k + cometShard×5 |
| `ecr_breed` | Предание оживает | выводок | вылупить 6 | 96k + ovalCharm |
| `ecr_proof` | Доказательство духа | строй | verify-only: ср.ур.70 + maxур.80 (просто покажи команду) | 120k + smokeBall×5 |
| `ecr_fist` | Шепот башни | босс | Тень 6×83 | 180k + TM Shadow Ball + rareCandy×3 + «Друг духов» |
| `ecr_streak` | Не моргай | стрик | 32 победы | 360k + expertBelt + «Бестелесный» |

## 12. Сианвуд — Чак, бой, 100 (n=12, ДЖОТО). Фишка: додзё + аптека

Босс **Ученик Чака**: primeape 88, machoke 88, hitmonlee 88, hitmonchan 88,
machamp 88, heracross 88.
Пул: mankey, machop, hitmonlee, hitmonchan, primeape, heracross, tyrogue,
hitmontop, machamp + PokeAPI.
NPC: Фармацевт 💊 (`cianwoodCity`), Ученик Чака 🥋 (`cianwoodStadium`),
Прибой 🏄 (`seaRoute41`), Ракушка 💰 (`cianwoodCity_pokemart`), Отмель 🥚
(`cianwoodCity_pokecenter`), Додзё 🏋️ (`cianwoodCity_trainingGrounds` — создать),
Отшельник 🧘 (`whirlIslands`), Волна ⛴️ (`ecruteakCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `cia_trail` | Кулачная тропа | гринд | 645 бойцов + 18 лок + ср.ур.75 | 65k + TM Psychic + fullRestore×3 |
| `cia_dojo` | Тысяча спаррингов | охота | победить 320 Machop/Machoke в додзё и округе | 65k + Black Belt×1 |
| `cia_hoard` | Зал славы | коллекция | maxур.85 + 20 видов боя | 650k + nestBall×8 |
| `cia_counter` | Бей сверху | контрудар | победить 320 летающих/психов | 65k + Coba Berry×8 |
| `cia_money` | Призовой фонд | заработок | 25M | 65k + balmMushroom×5 |
| `cia_breed` | Спарринг-потомство | выводок | вылупить 7 | 104k + shinyCharm |
| `cia_roids` | Фарма додзё | расход | 45 X Attack (раздай спарринг-партнёрам) | 59k + protein×2 |
| `cia_fist` | Тысяча первый удар | босс | Ученик Чака 6×88 | 195k + TM Close Combat + rareCandy×3 + «Железный кулак» |
| `cia_temper` | Железное тело | EV-пул | 460 | 130k + choiceSpecs |
| `cia_streak` | Без пропусков | стрик | 34 победы | 390k + muscleBand + «Несломленный» |

## 13. Оливин — Жасмин, сталь, 100 (n=13, ДЖОТО). Фишка: маяк + Амфарос

Босс **Инженер Сталь**: magneton 88, forretress 88, skarmory 88, steelix 88,
scizor 88, magneton 88.
Пул: magnemite, magneton, steelix, scizor, skarmory, forretress + PokeAPI.
NPC: Маячник 🔦 (`olivineCity`), Сталь ⚙️ (`olivineStadium`), Шторм 🌊
(`seaRoute40`), Якорь 💰 (`olivineCity_pokemart`), Гавань 🥚
(`olivineCity_pokecenter`), Маяк 🏋️ (`olivineCity_trainingGrounds` — создать),
Причал ⚓ (`olivinePier`), Рейс ⛴️ (`cianwoodCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `oli_trail` | Рельсовая тропа | гринд | 755 стальных + 20 лок + ср.ур.75 | 70k + TM Earthquake + maxElixir×1 |
| `oli_cliffs` | Редкие скалы | редкость | поймать Shuckle ×5 (держатся за утёсы!) | 350k + Sticky Barb×1 |
| `oli_sky` | Магнитная аномалия | редкость | поймать Magnemite ×5 | 350k + luxuryBall×30 |
| `oli_counter` | Плавильный котёл | контрудар | победить 375 огненных/бойцов/земляных | 70k + Occa Berry×8 |
| `oli_money` | Портовые сборы | заработок | 40M | 70k + pearlString×5 |
| `oli_breed` | Закалка в горне | выводок | вылупить 8 | 112k + abilityCapsule |
| `oli_potion` | Лекарство наверх | доставка | Сианвуд→Оливин морем: Secret Potion для больной Амфарос с маяка (именной груз!) | 63k + rareCandy×10 |
| `oli_fist` | Проверка на прочность | босс | Сталь 6×88 | 210k + TM Flash Cannon + rareCandy×3 + «Стальной характер» |
| `oli_temper` | Нержавейка | EV-пул | 480 | 140k + focusSash |
| `oli_streak` | Без ржавчины | стрик | 36 побед | 420k + wiseGlasses + «Нержавеющий» |

## 14. Махогани — Прайс, лёд, 100 (n=14, ДЖОТО). Фишка: Озеро Ярости

Босс **Морозко**: dewgong 88, cloyster 88, sneasel 88, piloswine 88,
delibird 88, jynx 88.
Пул: dewgong, cloyster, jynx, lapras, sneasel, swinub, delibird, articuno + PokeAPI.
NPC: Гляциолог 🧊 (`mahoganyTown`), Морозко ⛄ (`mahoganyStadium`),
Пурга 🌨️ (`icePath`), Мех 💰 (`mahoganyTown_pokemart`), Берлога 🥚
(`mahoganyTown_pokecenter`), Лёд 🏋️ (`mahoganyTown_trainingGrounds` — создать),
Озеро 🎣 (`lakeOfRage`), Подъёмник 🚡 (`olivineCity`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `mah_trail` | Морозная тропа | гринд | 875 ледяных + 22 локи + ср.ур.75 | 75k + TM Focus Blast + maxElixir×2 |
| `mah_rage` | Гнев озера | охота | победить 435 Swinub/Piloswine у Озера Ярости | 75k + Never-Melt Ice×1 |
| `mah_red` | Красная ярость | улов вида | поймать 60 Magikarp/Gyarados (красный где-то среди них...) | 75k + redScale? нет — mysticWater×1 |
| `mah_counter` | Оттепель | контрудар | победить 435 огненных/бойцов/каменных/стальных | 75k + Yache Berry×8 |
| `mah_money` | Пушной аукцион | заработок | 65M | 75k + bigNugget×10 |
| `mah_breed` | Тёплая кладка | выводок | вылупить 9 | 120k + goldBottleCap |
| `mah_dex` | Перепись севера | экзотика | 40% декса (⚠️ TODO verify) | 450k + ppMax×2 |
| `mah_fist` | Холодный приём | босс | Морозко 6×88 | 225k + TM Ice Beam + rareCandy×3 + «Сердце зимы» |
| `mah_caravan` | Караван на север | доставка | Оливин→Махогани→Блэкторн, 3 плеча | 68k + rareCandy×12 |
| `mah_streak` | Горячее сердце | стрик | 38 побед | 450k + choiceScarf + «Тёплое сердце» |

## 15. Блэкторн — Клер, драконы, 100 (n=15, ФИНАЛ). Фишка: логово

Босс **Наследница Клер**: dragonair 88, kingdra 88, dragonair 88, kingdra 88,
dragonite 88, dragonite 88.
Пул: dratini, dragonair, dragonite, kingdra + PokeAPI.
NPC: Драконовед 🐲 (`blackthornCity`), Наследница 👑 (`blackthornStadium`),
Клык 🦷 (`dragonsDen`), Чешуя 💰 (`blackthornCity_pokemart`),
Гнездовье 🥚 (`blackthornCity_pokecenter`), Пещера 🏋️ (`dragonsDen`),
Старейшина 🧙 (`blackthornCity`), Перевал 🛵 (`mahoganyTown`).

| id | Название | Механика | Задача | Награда |
|---|---|---|---|---|
| `bla_trail` | Тропа повелителей | гринд | 1000 (драконьи редки — в счёт драконьи + ледяные) + 24 локи (турне до Плато Индиго) + ср.ур.75 | 80k + TM Blizzard + maxElixir×3 |
| `bla_den` | Испытание логова | охота | победить 500 драконьих в Пещере Драконов | 80k + Dragon Fang×1 |
| `bla_hoard` | Драконья сокровищница | коллекция | maxур.85 + 24 вида драконов (по всему дексу) | 800k + masterBall×1 |
| `bla_sky` | Сердце бури | редкость | поймать Dratini ×6 | 400k + luxuryBall×40 |
| `bla_money` | Казна повелителей | заработок | 100M | 80k + cometShard×10 |
| `bla_breed` | Гнездо бури | выводок | вылупить 10 | 128k + abilityPatch |
| `bla_temper` | Чешуя и сталь | EV-пул | 496 (потолок!) | 160k + boosterEnergy |
| `bla_fist` | Кровь и чешуя | босс | Наследница 6×88 | 240k + TM Dragon Claw + rareCandy×3 + «Кровь драконов» |
| `bla_caravan` | Последний караван | доставка | Махогани→Блэкторн→Плато Индиго, 3 плеча (финал!) | 72k + rareCandy×12 |
| `bla_streak` | Непобеждённый | стрик | 40 побед | 480k + choiceBand + «Повелитель драконов» |

---

## Контрольная таблица

| n | Город | гринд/локи/ср | босс | max/виды | редкость | заработок | выводок | EV | визиты | стрик |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Пьютер | 25/5/15 | 3×28 | 25/8 | ×1 | 100k | 1 | 100 | 12 | 10 |
| 1 | Церулин | 40/6/20 | 3×33 | 30/9 | ×1 | 160k | 1 | 120 | 15 | 12 |
| 2 | Вермилион | 60/7/25 | 3×38 | 35/10 | ×1 | 250k | 2 | 140 | 18 | 14 |
| 3 | Селадон | 85/8/30 | 4×43 | 40/11 | ×2 | 400k | 2 | 160 | 22 | 16 |
| 4 | Шаффран | 115/9/35 | 4×48 | 45/12 | ×2 | 650k | 3 | 190 | 26 | 18 |
| 5 | Фуксия | 150/10/40 | 4×53 | 50/13 | ×2 | 1M | 3 | 220 | 30 | 20 |
| 6 | Киноварь | 195/11/45 | 4×58 | 55/14 | ×3 | 1.6M | 4 | 250 | 35 | 22 |
| 7 | Виридиан | 245/12/50 | 5×63 | 60/15 | ×3 | 2.5M | 4 | 280 | 40 | 24 |
| 8 | Вайолет | 305/13/55 | 5×68 | 65/16 | ×3 | 4M | 5 | 320 | 45 | 26 |
| 9 | Азалия | 375/14/60 | 5×73 | 70/17 | ×4 | 6.5M | 5 | 360 | 50 | 28 |
| 10 | Голденрод | 455/15/65 | 5×78 | 75/18 | ×4 | 10M | 6 | 400 | 55 | 30 |
| 11 | Эйкрутик | 545/16/70 | 6×83 | 80/19 | ×4 | 16M | 6 | 430 | 60 | 32 |
| 12 | Сианвуд | 645/18/75 | 6×88 | 85/20 | ×5 | 25M | 7 | 460 | 65 | 34 |
| 13 | Оливин | 755/20/75 | 6×88 | 85/21 | ×5 | 40M | 8 | 480 | 70 | 36 |
| 14 | Махогани | 875/22/75 | 6×88 | 85/22 | ×5 | 65M | 9 | 490 | 75 | 38 |
| 15 | Блэкторн | 1000/24/75 | 6×88 | 85/24 | ×6 | 100M | 10 | 496 | 80 | 40 |

Охота на вид: 20/30/45/60/75/95/120/150/185/225/270/320/375/435/500
(искл.: кимоно 5×8, анноун 26 — flavor).
Массовый улов: 8/10/12/15/18/22/26/30/35/40/45/50/55/60/70.
Расход: 6/8/10/12/15/18/22/26/30/35/40/45/50/60/70 (искл.: Leaf Stone ×3).
Доставка: 1 плечо (n1–5) → 2 плеча (n6–13) → 3 плеча (n14–15).
