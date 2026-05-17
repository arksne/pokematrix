# LeaguePM / PokeMatrix — Полный анализ проекта

**Дата анализа:** 2026-05-17
**Источник:** main.js (4458 строк), 18 модулей/UI, сервер на Express + SQLite

---

## 1. ОБЩАЯ АРХИТЕКТУРА

### Стек
- **Фронтенд**: Vanilla JS (ES Modules) + Vite + Telegram Web App SDK
- **Бэкенд**: Express 5 + SQLite (через sqlite3) + Socket.IO
- **Сборка**: Vite 8
- **Хостинг**: Telegram Mini App (TMA)

### Структура проекта
```
LeaguePM/
├── main.js              # Ядро игры (4458 строк) — State Bridge
├── index.html            # Вся разметка (SPA, 776 строк)
├── style.css             # Вся стилизация (2794 строк)
├── vite.config.js        # Vite конфиг
├── package.json          # Зависимости
├── src/
│   ├── battle/
│   │   ├── core.js       # Боевая система (2863 строки) — извлечена
│   │   └── state.js      # Состояние битвы (общий mutable объект)
│   ├── data/
│   │   ├── regions.js    # Регионы и локации (1247 строк)
│   │   ├── items.js      # Предметы (421 строка)
│   │   ├── npc.js        # NPC данные (424 строки)
│   │   ├── gyms.js       # Гим-лидеры (145 строк)
│   │   ├── drops.js      # Дроп-таблица монстров (82 строки)
│   │   ├── natures.js    # Характеры (26 строк)
│   │   ├── training.js   # Тренировки (8 строк)
│   │   ├── stones.js     # Камни эволюции (12 строк)
│   │   ├── starters.js   # Стартовые покемоны (10 строк)
│   │   └── transport.js  # Транспорт (29 строк)
│   └── ui/
│       ├── inventory.js  # Инвентарь (760 строк)
│       ├── pokedex.js    # Покедекс (246 строк)
│       ├── shop.js       # Магазин (180 строк)
│       ├── evolution.js  # Эволюция (156 строк)
│       ├── tm.js         # TM/Переучивание (141 строка)
│       ├── chat.js       # Чат (111 строк)
│       ├── trainers.js   # Тренеры (83 строки)
│       ├── levelup_moves.js # Атаки при уровне (90 строк)
│       ├── nickname.js   # Прозвища (16 строк)
│       └── map.js        # Карта (8 строк — заглушка?)
├── server/
│   ├── index.js          # Express сервер (118 строк)
│   ├── db.js             # SQLite инициализация (112 строк)
│   ├── auth.js           # Telegram auth (52 строки)
│   ├── socket.js         # Socket.IO (171 строка)
│   └── routes/
│       ├── admin.js      # Админ-роуты (321 строка)
│       ├── auth.js       # Роуты авторизации (129 строк)
│       ├── chat.js       # Роуты чата (290 строк)
│       ├── save.js       # Роуты сохранения (167 строк)
│       ├── profile.js    # Профили (139 строк)
│       └── leaderboard.js# Лидерборд (26 строк)
├── refactor_data.py      # Скрипт извлечения данных
├── refactor_more_data.py # Ещё скрипт извлечения
└── REFACTOR_CHECKPOINT.md # Чекпоинт рефакторинга
```

---

## 2. КЛЮЧЕВЫЕ ДАННЫЕ

### 2.1 Файлы по размеру
| Файл | Строк | % |
|------|-------|---|
| main.js | 4458 | 34% |
| src/battle/core.js | 2863 | 22% |
| src/data/regions.js | 1247 | 10% |
| src/ui/inventory.js | 760 | 6% |
| src/data/npc.js | 424 | 3% |
| src/data/items.js | 421 | 3% |
| server/routes/admin.js | 321 | 2% |
| server/routes/chat.js | 290 | 2% |
| src/ui/pokedex.js | 246 | 2% |
| Остальное | ~2000 | 15% |
| **Итого (JS/TS)** | **~13 000** | 100% |

### 2.2 Игровые данные
- **Регионы**: Канто, Джото, Хоэнн, Синно, Южный Архипелаг, Остров Селенит
- **Гим-лидеры**: 8 (Канто) + Элитная Четверка + Чемпион
- **Предметы**: ~50+ (покеболы, аптечки, ягоды, бабочки, билеты, эволюционные камни, руды/кристаллы для крафта)
- **NPC**: ~50+ персонажей по локациям
- **Квесты**: 5 типов ежедневных + квесты NPC

---

## 3. СИСТЕМЫ main.js (ПО ПОРЯДКУ В ФАЙЛЕ)

| # | Система | Строки | Описание |
|---|---------|--------|----------|
| 1 | Imports + Error handler | 1-43 | Загрузка модулей, window.onerror |
| 2 | Location helpers | 44-100 | getLocation, getRegionOfLocation, travelToRegion |
| 3 | Глобальные переменные | 101-115 | currentLocationId, pokedexSeen/Caught, itemsUsedInBattle, currentRegion, expShareActive |
| 4 | Дроп-система | 116-148 | MONSTER_DROP_TABLE, UNIVERSAL_DROPS, processMonsterDrop |
| 5 | Инвентарь | 149-172 | inventory, addItem, removeItem, hasItem, itemDef |
| 6 | Админ-консоль | 174-299 | help(), money(), items(), allBadges(), heal(), maxIV(), lvlup(), legendary(), mew(), goto() |
| 7 | UID система | 457+ | Генерация UID покемонов |
| 8 | Звёзды рейтинга | 642+ | getPowerStars (BST-based), getRarityStars |
| 9 | Квесты | 693+ | generateDailyQuests, checkQuestProgress, claimQuestReward |
| 10 | Cloud sync | 728+ | API_BASE, заголовки, облачная синхронизация |
| 11 | Save/Load | 940+ | saveGame, loadGame, autoSave, resetGame |
| 12 | День уход (Daycare) | 962+ | Система daycare |
| 13 | Разведение (Breeding) | 1069+ | PC boxes, яйца, hatching |
| 14 | PC Storage | 1273+ | Хранилище покемонов |
| 15 | Крафтинг | 1449+ | Система крафта предметов |
| 16 | Стартер | 1797+ | giveStarterMon, выбор стартового |
| 17 | Навигация | 1916+ | Переключение вкладок (табов) |
| 18 | NPC Engine | 1983+ | Диалоги с NPC |
| 19 | Location Engine | 2180+ | renderLocation, путешествия |
| 20 | Shop System | 2456+ | Покупки/продажи |
| 21 | Display Updates | 2573+ | updateMoneyDisplay, updateBadgeDisplay |
| 22 | Team Roster | 2585+ | renderTeamGrid, команда |
| 23 | Pokemon Profile | 2661+ | Просмотр профиля покемона |
| 24 | Profile UX | 2943+ | Логика профиля |
| 25 | Cloud Sync (детали) | 3171+ | getCloudAuthHeaders |
| 26 | Trainer Card | 3378+ | renderTrainerCard |
| 27 | Trainer Profile | 3485+ | openTrainerProfile |
| 28 | P2P Trading | 3576+ | Обмен через Socket.IO |
| 29 | Modal Helpers | 3600+ | showToast, showConfirmModal, showSelectionModal |
| 30 | PvP Battle | 3749+ | PvP битвы |
| 31 | Trade UI | 4035+ | Trade Request/Center/Window модалки |
| 32 | State Bridge (геттеры) | 4405-4458 | getPokedexState, getShopState, getTeamState, getSocialState, getMapState, getGameState, getInvState, toggleExpShare |

---

## 4. STATE BRIDGE (Паттерн доступа к состоянию)

Для доступа модулей к глобальным переменным main.js используются функции-геттеры:

```js
getGameState() — возвращает объект с getter-ами на: myTeam, pokedexSeen/Caught, 
                  currentLocationId, isDaytime, gymLeaders, eliteFour, champion,
                  gymBadges, expShareActive, quests, questProgress, completedQuests,
                  visitedLocations, inventory, money, QUEST_CONFIGS, itemsUsedInBattle

getPokedexState()   → { pokedexSeen, pokedexCaught, POKEDEX_ALL, pokedexData, pokedexTotal }
getShopState()      → { money, inventory }
getTeamState()      → { myTeam, currentPokemonIndex }
getSocialState()    → { onlinePlayersList, trainerNickname, tgUser }
getMapState()       → { currentLocationId, currentRegion, lastLocation }
getInvState()       → { money, eggs, ITEMS, trainingStages, expShareActive }
```

Battle использует отдельный подход: `src/battle/state.js` — ES module с mutable объектом,
который импортируется и в main.js, и в battle/core.js.

---

## 5. СТАТУС РЕФАКТОРИНГА

### Извлечено (из main.js в модули)
- `src/ui/evolution.js` ✓
- `src/ui/pokedex.js` ✓
- `src/ui/nickname.js` ✓
- `src/ui/shop.js` ✓
- `src/ui/chat.js` ✓
- `src/ui/trainers.js` ✓
- `src/ui/inventory.js` ✓
- `src/ui/levelup_moves.js` ✓
- `src/ui/tm.js` ✓
- `src/ui/map.js` ✓ (заглушка — 8 строк)
- `src/battle/core.js` ✓ (2863 строки!)
- `src/data/regions.js` ✓
- `src/data/items.js` ✓
- `src/data/npc.js` ✓
- `src/data/gyms.js` ✓
- `src/data/drops.js` ✓
- `src/data/natures.js` ✓
- `src/data/training.js` ✓
- `src/data/stones.js` ✓
- `src/data/starters.js` ✓
- `src/data/transport.js` ✓

### Осталось в main.js (крупные блоки)
- Ядро/стейт/сохранение (~300 строк)
- Крафтинг (~300 строк)
- Система стартера (~120 строк)
- Навигация (~80 строк)
- NPC Engine (~200 строк)
- Location Engine (~350 строк)
- Team Roster (~200 строк)
- Pokemon Profile (~500 строк)
- P2P Trading (~200 строк)
- PvP Battle (~250 строк)
- Modal Helpers (~200 строк)
- Админ-консоль (~200 строк)
- **Итого: ~3000 строк ядра остаётся**

---

## 6. БАЗА ДАННЫХ (SQLite)

**Таблицы:**
1. `users` — telegram_id, username, first_name, nickname, avatar, starter_pokemon, registered
2. `game_saves` — user_id, save_data (JSON строка), updated_at
3. `leaderboard` — user_id, badges_count, team_level_sum, money, pokemon_count, legendary_count
4. `user_locations` — user_id, location_id
5. `action_log` — user_id, action, details
6. `chat_messages` — user_id, username, first_name, text

---

## 7. СЕРВЕРНЫЕ РОУТЫ

| Маршрут | Метод | Описание |
|---------|-------|----------|
| /api/auth | POST | Вход через Telegram |
| /api/save | POST | Сохранение игры |
| /api/save | GET | Загрузка сохранения |
| /api/leaderboard | GET | Таблица лидеров |
| /api/chat | GET | Сообщения чата |
| /api/chat | POST | Отправка сообщения |
| /api/profile/:id | GET | Профиль тренера |
| /api/profile/:id/battle-team | GET | Команда для боя |
| /admin/* | POST | Админ-команды |
| /api/health | GET | Health check |

---

## 8. ЗАВИСИМОСТИ

**Frontend** (Vite):
- vite: ^8.0.12
- socket.io-client: ^4.8.3

**Backend** (Express):
- express: ^5.2.1
- cors: ^2.8.6
- jsonwebtoken: ^9.0.2
- socket.io: ^4.8.3
- sqlite: ^5.1.1
- sqlite3: ^5.1.7
- express-rate-limit: ^8.5.2

---

## 9. Git: ИСТОРИЯ РАЗРАБОТКИ (26 коммитов)

Последние коммиты:
- `816e1ef` — Feat: integrate sub-locations, NPCs from wiki
- `90217bb` — Header reorg + poison removed + money in header
- `e9a4c75` — Tutorial quest chain + egg collection fix
- `32f4aed` — Rebrand: League-17 → PokeMatrix
- `d6c02da` — Cloud-first saves: server is source of truth
- `ab23bb3` — Battle persistence: survive page refresh
- `abcdf2a` — Cleanup + current state
- `f834bd2` — Save system v3: server always wins

---

## 10. ТЕКУЩИЙ ФРОНТЕНД (Вкладки/View)

В `index.html` определены view:
1. **view-world** — Карта мира, локация, NPC, навигация
2. **view-backpack** — Инвентарь/рюкзак
3. **view-team** — Команда покемонов + профиль
4. **view-chat** — Чат с онлайн-игроками
5. **view-trainers** — Тренеры + аккаунт
6. **view-info** — Пособие тренера

**Модальные окна:**
- encounter-modal (битва), shop-modal, gym-modal, elite-modal
- leaderboard-modal, pokedex-modal, tm-modal, evolution-overlay
- npc-modal, pc-modal, crafting-modal, quest-modal
- trainer-profile-modal, notif-modal, starter-modal

---

## 11. ОСНОВНЫЕ ЗАМЕЧАНИЯ

1. **main.js всё ещё 4458 строк** — можно дробить дальше (ядро, крафт, стартер, навигация, PvP)
2. **map.js** — 8 строк, похоже на заглушку
3. **battle/state.js** — отдельный shared state (не через State Bridge, а через ES module import)
4. **Данные из wiki** — сохранены в `wiki_data/` и `public/wiki_images/`
5. **Cloud-first saves** — сервер главный, localStorage кеш
6. **Нет TypeScript** — весь проект на чистом JS
7. **Нет тестов** — ни юнит, ни интеграционных
8. **Telegram Web App** — авторизация через tg, размеры под TMA

---

---

## 12. ИСПРАВЛЕННЫЕ БАГИ (2026-05-17)

### Критические (краш в рантайме)

1. **`battle/core.js: itemsUsedInBattle` — ReferenceError**
   - Проблема: переменная использовалась 15+ раз, но не была объявлена в модуле (ES module strict mode)
   - Комментарий утверждал "Redirected to GS.itemsUsedInBattle", но код использовал голую `itemsUsedInBattle`
   - Исправление: все 15+ обращений заменены на `GS.itemsUsedInBattle` (через State Bridge getter/setter)

2. **`main.js:4443` — `gymBadges` не объявлена**
   - Проблема: `get gymBadges() { return gymBadges; }` ссылалась на несуществующую переменную
   - Исправление: заменено на `return badges;`

### Средние

3. **`battle/core.js: gymTeamIndexInMember` — объявление в конце файла**
   - Проблема: `let gymTeamIndexInMember = 0;` была на строке 2648, хотя использовалась с 103 строки
   - Исправление: объявление перенесено наверх к остальным state-переменным, дубликат удалён

4. **`src/ui/map.js` — мёртвый файл**
   - Проблема: импортировала `updatePlayerLocation` и другие символы из main.js, но сам файл нигде не импортировался
   - Исправление: превращён в заглушку с TODO-комментарием

### Косметические

5. **`battle/core.js: 'GS.champion'` как battleType**
   - Строка `'GS.champion'` используется как тип битвы — работает, но сбивает с толку
   - Не исправлено (затрагивает много мест, требуется осторожность)

6. **PvP `doPvPAttack: move.power` всегда undefined**
   - API покемона хранит moves как `[{ move: { name, url } }]`, без `power`
   - Не исправлено (PvP использует fallback = 60, PvP и так упрощённый)

---

## 14. ИСПРАВЛЕННЫЕ БАГИ (2026-05-17, второй раунд)

### Критические (краш в рантайме)

7. **`main.js: updateStats` — ReferenceError**
   - Проблема: `updateStats()` вызывалась в `refreshProfileUI()` (строка 2773) и в EV input handler (строка 2849), но функция не была определена нигде в проекте — потеряна при рефакторинге
   - Исправление: добавлена функция, использует `calculateStat()` из battle/core.js для 6 статов (HP, ATK, DEF, SPA, SPD, SPE) и обновляет `val-hp`..`val-spe` элементы
   - Статус: **ИСПРАВЛЕНО**

### Средние

8. **`main.js: money('10000')` — конкатенация строк вместо сложения**
   - Проблема: `window.money = function(n = 100000) { money += n; ... }` — при вызове `money('10000')` (строка) делала `'500' + '10000' = '50010000'` (строка)
   - Последствие: `saveData.money` становился строкой, сервер возвращал HTTP 400 ("money must be a number"), все облачные сохранения падали
   - Исправление: `money += Number(n)`
   - Статус: **ИСПРАВЛЕНО**

9. **Cloud save HTTP 400 (всегда)**
   - Проблема: результат бага #8 — `saveData.money` отправлялся как строка, сервер отвечал 400 Bad Request
   - Исправление: фикс #8 устранил первопричину
   - Статус: **ИСПРАВЛЕНО**

### UX (неисправлено)

10. **Pewter City — нет кнопок действий (heal/shop)**
    - Проблема: `hasHeal: true` у `pewter_city`, но `renderLocation()` проверяет только `_pokecenter` суффикс для показа кнопок хилинга/PC. Pewter City не имеет sub-location `pewter_pokecenter`
    - Статус: **НЕ ИСПРАВЛЕНО** — требуется добавить sub-location в данные регионов

11. **Крафтинг: useItem требует выбранного покемона**
    - Проблема: `useItem('craftersKit')` проверяет `currentPokemonIndex`, но крафтинг не требует выбранного покемона
    - Статус: **НЕ ИСПРАВЛЕНО** — мелкий UX баг

---

## 15. РЕЗУЛЬТАТЫ PLAYWRIGHT ТЕСТИРОВАНИЯ

### Проверено и работает (0 ошибок)
1. **6 вкладок навигации**: Мир, Рюкзак, Команда, Чат, Тренеры, Инфо
2. **Кнопки хедера**: Hunt (⚪), Покедекс (📖), Квесты (📋), Лидерборд (🏆), Нотификации (🔔), Тема (☀️), Cloud Sync (☁️)
3. **Покедекс**: загрузка + просмотр + детали Bulbasaur (эволюции, звезды)
4. **Лидерборд**: отображение игроков
5. **Квесты**: 3 ежедневных задания
6. **Нотификации**: пусто (новый аккаунт)
7. **Профиль покемона**: Инфо, Статы, Атаки, Сост. вкладки
8. **Статы покемона**: корректные значения после фикса updateStats
9. **Гим Брока**: модалка с Geodude Lv18, Onix Lv22, награда Boulder Badge
10. **Система битв**: hunt → encounter → flee
11. **Локации**: навигация и переходы (Pallet Town → Route 1 → Viridian → Route 2 → Viridian Forest → Pewter City → Stadium)
12. **Покецентр**: хил команды, PC терминал, NPC диалоги
13. **Покемаркет**: полный ассортимент товаров (покеболы, аптечки, ягоды, камни, билеты)
14. **NPC диалоги**: Профессор Оук, Сестра Джой
15. **PC хранилище**: боксы, депозит покемонов
16. **Облачное сохранение**: работает после фикса #8
17. **Сборка**: Vite build — 0 ошибок

### НЕ тестировалось (требуют специфических условий)
- PvP битва (нужен второй игрок)
- P2P обмен (нужен второй игрок)
- Элитная Четверка (нужны все значки)
- Крафтинг (нужен выбранный покемон в команде)
- Рыбалка (нужен наличие удочки в инвентаре)
- Дейкер/разведение (нужны 2 покемона в питомнике)
- Эволюция (нужен покемон, готовый к эволюции)
- TM/переучивание (нужны TM в инвентаре)
- Fishing (need fishing rod)
- Админ-панель (через серверный роут)

---

## 13. СТРУКТУРА ПАПОК ВНЕ LeaguePM/

- `free-claude-code/` — Прокси-сервер для Claude Code
- `rebuild_main.py` — Скрипт ребилда (73кб)
- `data/` — game.db и бэкапы
- `quest/` — данные квестов
- `wiki_mirror/` — зеркало wiki
- `wiki_backup_old/` — старое зеркало wiki (бэкап)
