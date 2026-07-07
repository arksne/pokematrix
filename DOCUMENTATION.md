# PokeMatrix League17 — Архитектура проекта

> Полная документация по файловой структуре, зависимостям и потокам данных.
> Создана: 2026-07-05

## 📁 Структура проекта

```
pokematrix/league17/
├── src/
│   ├── main.ts              # Точка входа (Vite), регистрация глобальных функций
│   ├── game/                 # Ядро игры: состояние, логика, авторизация
│   │   ├── state.ts          # Глобальное состояние игры (singleton)
│   │   ├── store.ts          # Event-система + методы изменения состояния
│   │   ├── config.ts         # Конфиги: API_BASE, SOCKET_COOLDOWN
│   │   ├── getters.ts        # Геттеры для вычисляемых значений
│   │   ├── auth.ts           # Авторизация Telegram Mini App
│   │   ├── apiClient.ts      # HTTP клиент с refresh token
│   │   ├── init.ts           # Стартовая инициализация игры
│   │   ├── actions.ts        # addItem/removeItem — делегируют в store
│   │   └── save.ts           # Cloud save/load через сервер
│   ├── battle/               # Боевая система
│   │   ├── state-machine.ts  # Конечный автомат фаз боя (BattleStateMachine)
│   │   ├── types.ts          # Типы: BattlePhase, MoveData, BattleStateData
│   │   ├── state.ts          # Состояние текущего боя (singleton)
│   │   ├── core.ts           # Движок боя (2927 строк, самый большой файл)
│   │   ├── logic.ts          # Чистые функции: calculateDamage, TYPE_CHART
│   │   ├── ai.ts             # AI выбора атаки для противника
│   │   ├── pvp-core.ts       # PvP бой (клиентский UI + атаки)
│   │   └── pvp.js            # PvP система: очередь, матчинг, арена
│   ├── ui/                   # 30 UI компонентов
│   │   ├── map.ts            # Карта мира
│   │   ├── shop.ts           # Магазины
│   │   ├── inventory.ts      # Инвентарь
│   │   ├── pokedex.ts        # Покедекс
│   │   ├── profile.ts        # Профиль покемона
│   │   ├── pc.ts             # PC Boxes
│   │   ├── evolution.ts      # Эволюция (анимация)
│   │   ├── location.ts       # Локации
│   │   ├── quests.ts         # Квесты/задания
│   │   ├── ... (всего 30)
│   ├── data/                 # Статические данные (игровые конфиги)
│   │   ├── items.ts          # 1300+ предметов (ItemDef[])
│   │   ├── regions.ts        # Регионы/локации
│   │   ├── gyms.ts           # Лидеры залов
│   │   ├── drops.js          # Таблица дропа с монстров
│   │   ├── natures.ts        # Характеры (natures)
│   │   ├── pokemon_types.ts  # Типы покемонов
│   │   ├── weather.ts        # Погода и эффекты
│   │   ├── shops.ts          # Ассортимент магазинов
│   │   ├── quests.ts         # Конфиги квестов
│   │   ├── stones.ts         # Камни эволюции
│   │   ├── training.ts       # Тренировки
│   │   ├── transport.ts      # Транспортные хабы
│   │   ├── starters.ts       # Стартовые покемоны
│   │   ├── npc.ts            # NPC данные
│   │   └── index.ts          # Реэкспорт всех данных
│   ├── utils/                # Утилиты
│   │   ├── dom.ts            # DOM-операции (showToast, showSelectionModal)
│   │   ├── api.ts            # HTTP клиент с PokeAPI (fetchPokeAPI)
│   │   ├── sprite.ts         # URL спрайтов покемонов
│   │   ├── state.ts          # generateUID, getTrainerId
│   │   └── items.ts          # itemDef, itemCategory
│   ├── social/               # Социальные функции
│   │   └── trainer-profile.ts# Профиль тренера
│   ├── network/              # Сеть
│   │   └── socket.ts         # Socket.IO клиент
│   └── data/                 # (доп. файлы данных)
├── index.html                # HTML точка входа
├── vite.config.ts            # Vite конфиг
├── tsconfig.json             # TypeScript конфиг
├── railway.json              # Railway деплой конфиг
├── package.json              # Зависимости
├── ARCHITECTURE.md           # Диаграмма связей файлов
└── DOCUMENTATION.md          # Этот файл
```

## 📊 Файл зависимостей

Ниже — кто от кого зависит. Читается как: `Файл → Зависимости`

### game/ (ядро)
| Файл | Импортирует |
|------|------------|
| `state.ts` | *(чистый singleton, без импортов)* |
| `store.ts` | `state`, `apiClient`, `save`, `items`, `drops`, `weather` |
| `config.ts` | *(чистый конфиг)* |
| `getters.ts` | `state`, `store`, `items`, `regions`, `transport` |
| `auth.ts` | `apiClient`, `store` |
| `apiClient.ts` | `state`, `save` |
| `init.ts` | `store`, `auth`, `socket`, `battle` (core), UI файлы |
| `actions.ts` | `store` |
| `save.ts` | `state`, `apiClient` |

### battle/ (бой)
| Файл | Импортирует |
|------|------------|
| `types.ts` | *(чистые типы, без импортов)* |
| `state.ts` | *(чистый singleton, без импортов)* |
| `state-machine.ts` | `types` |
| `logic.ts` | `weather` |
| `ai.ts` | *(чистая функция, без импортов)* |
| `core.ts` | `logic`, `ai`, `store`, `state`, `dom`, `items`, `sprite`, `api`, `weather`, `quests`, `natures`, `state-machine`, `evolution`, `levelup_moves`, `inventory` |
| `pvp-core.ts` | `state`, `dom`, `sprite`, `save` |
| `pvp.js` | `config`, `state`, `save`, `dom` |

### ui/ (примеры)
| Файл | Импортирует |
|------|------------|
| `map.ts` | `state`, `store`, `regions`, `transport`, `dom` |
| `shop.ts` | `state`, `store`, `items`, `shops`, `dom` |
| `inventory.ts` | `state`, `store`, `items`, `dom` |
| `profile.ts` | `state`, `store`, `items`, `natures`, `sprite`, `dom` |
| `evolution.ts` | `state`, `store`, `dom` |
| (и т.д. — каждый UI файл зависит от game/ и utils/) |

### utils/
| Файл | Импортирует |
|------|------------|
| `dom.ts` | *(чистый DOM, без импортов)* |
| `api.ts` | *(fetch + кэш, без импортов)* |
| `sprite.ts` | *(чистая функция, без импортов)* |
| `state.ts` | *(clean, без импортов)* |
| `items.ts` | `items` (data) |

### social/
| Файл | Импортирует |
|------|------------|
| `trainer-profile.ts` | `state`, `store`, `dom`, `sprite` |

## 🔄 Основные потоки данных

### Поток 1: Аутентификация
```
Telegram → initData → auth.ts → apiClient.ts → сервер (JWT)
                              ↓
                    store.ts ← refresh token (30d)
                              ↓
              apiClient.ts — каждый запрос с Bearer token
```

### Поток 2: Бой (wild)
```
Кнопка "Искать" → startAutoHunt() → getLocationEncounters()
                                  ↓
                     startHunt() → fetchPokeAPI()
                                  ↓
                     renderBattleUI() → кнопки атак
                                  ↓
                     useMove() → calculateDamage() (logic.ts)
                                  ↓
                     enemyTurn() → selectEnemyMove() (ai.ts)
                                  ↓
                     handleWildFaintRewards() → EXP, дроп, эволюция
```

### Поток 3: PvP
```
showPvpPanel() → joinPvpQueue() → socket 'pvp:join_queue'
                                  ↓
                socket 'pvp:matched' → showPvpMatchModal()
                                  ↓
                openPvpBattleArena() → кнопки атак
                                  ↓
                submitPvpMove() → сервер → 'pvp:turn_result'
                                  ↓
                handlePvpTurnResult() → обновление HP
                                  ↓
                socket 'pvp:battle_end' → endPvpBattle()
```

### Поток 4: Сохранение
```
saveBattleState() → JSON.stringify → localStorage
restoreBattleState() ← JSON.parse ← localStorage

cloudSave() → apiClient POST /api/save → сервер → Drizzle ORM → Turso (SQLite)
cloudLoad() → apiClient GET /api/save ← сервер
```

## 🧠 Ключевые паттерны

### Proxy к глобальному состоянию (core.ts)
```typescript
const GS = new Proxy({}, {
  get(_, prop) { return state[prop]; },
  set(_, prop, value) { state[prop] = value; return true; }
});
```
Позволяет core.ts обращаться к `GS.currentLocationId` без реимпорта `state` при каждом изменении.

### BattleStateMachine (state-machine.ts)
Конечный автомат с 15 фазами и строгими правилами переходов (BATTLE_TRANSITIONS). Каждый переход валидируется. Ивент-система: подписка на 'phase:change', 'phase:X'.

### Чистые функции (logic.ts)
Все функции не имеют сайд-эффектов — получают данные через параметры, возвращают результат. Это позволяет тестировать и переиспользовать в AI.

### Refresh Token Queue (apiClient.ts)
Если access token истёк — запросы становятся в очередь, пока refresh token обновляется. Только один refresh запрос за раз.

## 📝 Статус комментирования

| Раздел | Файлы | Статус |
|--------|-------|--------|
| ✨ game/ | 9 файлов | ✅ Полностью |
| ⚔️ battle/ | 8 файлов | ✅ Полностью |
| 📊 data/ | 15 файлов | ✅ Полностью |
| 🖥️ ui/ | 30 файлов | ✅ Полностью |
| 🛠️ utils/ | 5 файлов | ✅ Полностью |
| 👥 social/ | 1 файл | ✅ Полностью |
| 📄 entry | 3 файла (main, init, socket) | ✅ Полностью |
| 📐 ARCHITECTURE.md | — | ✅ Создан |
| 📖 DOCUMENTATION.md | — | ✅ Создан |
