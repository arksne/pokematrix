# PokeMatrix — Архитектура проекта

> Сгенерировано после удаления server/ 2026-07-05
> Проект: League17 — Pokémon-style TMA (Telegram Mini App)
> Фронтенд: Vanilla TS/JS + Vite 8

---

## 1. Точка входа

```
main.ts ──→ src/game/init.ts (инициализация игры)
         ──→ index.html (HTML шаблон)
```

---

## 2. Схема взаимодействия файлов

### 2.1 Game Core (ядро игры)

| Файл | Зависит от | Используется в |
|---|---|---|
| `src/game/state.ts` | — (базовое состояние) | init, save, auth, actions, battle, UI modules (40+ файлов) |
| `src/game/config.ts` | — (конфигурация) | init, save, auth, apiClient, socket, battle |
| `src/game/store.ts` | state | init, inventory, shop |
| `src/game/getters.ts` | state | battle, UI modules |
| `src/game/actions.ts` | state, items, config, getters | inventory, battle, shop, npcs |
| `src/game/init.ts` | state, store, config, auth, save, battle, **все UI модули** | main.ts (точка входа в игру) |
| `src/game/save.ts` | state, apiClient, config, actions | init, auth, socket, profile, location, inventory |
| `src/game/auth.ts` | state, apiClient, save | init (authTelegram) |
| `src/game/apiClient.ts` | state, config | auth, save |

### 2.2 Battle System

| Файл | Зависит от | Используется в |
|---|---|---|
| `src/battle/core.ts` | state, config, items, action, ai, logic, state-machine | init, pvp, evolution, inventory, location, profile |
| `src/battle/logic.ts` | state, config, items, natures, types, weather | core |
| `src/battle/ai.ts` | state, logic | core (AI противников) |
| `src/battle/state-machine.ts` | state, battle/state, battle/types | core |
| `src/battle/pvp-core.ts` | state, config, save, network/socket | pvp, socket |
| `src/battle/pvp.js` | state, config, network/socket, pvp-core | socket |
| `src/battle/state.ts` | state, items, config | state-machine, core |
| `src/battle/types.ts` | — (типы) | state-machine |

### 2.3 Network / Socket

| Файл | Зависит от | Используется в |
|---|---|---|
| `src/network/socket.ts` | state, config, save, ui modules | init (initTradeSocket) |

### 2.4 Social

| Файл | Зависит от | Используется в |
|---|---|---|
| `src/social/trainer-profile.ts` | state, config, socket | socket, chat, trainers |

### 2.5 UI Modules (рендеринг)

| Файл | Зависит от | Используется в |
|---|---|---|
| `src/ui/location.ts` | state, config, game/actions, game/save, game/getters, data/regions | init (renderLocation) |
| `src/ui/map.ts` | state, config, data/regions | init (openMap) |
| `src/ui/profile.ts` | state, config, game/actions, data/items | init |
| `src/ui/inventory.ts` | state, game/actions, data/items, store | init |
| `src/ui/shop.ts` | state, store, data/items, data/shops | init |
| `src/ui/battle.ts` | — (встроен в index.html) | index.html |
| `src/ui/pokedex.ts` | state, data/items, utils/sprite | init |
| `src/ui/chat.ts` | state, network/socket | init, socket |
| `src/ui/quests.ts` | state | init |
| `src/ui/achievements.ts` | state | init |
| `src/ui/admin.ts` | state, config, game/save | init |
| `src/ui/nav.ts` | — | init |
| `src/ui/trainer-card.ts` | state | init |
| `src/ui/tutorial.ts` | state | init |
| `src/ui/npcs.ts` | state, data/npc, game/actions | init |
| `src/ui/starter.ts` | state, data/starters | init (giveStarter) |
| `src/ui/trade-center.ts` | state, network/socket | socket |
| `src/ui/trade-request.ts` | — | socket |
| `src/ui/trade-window.ts` | state | socket |
| `src/ui/trade.js` | — | — |
| `src/ui/notifications.ts` | state | socket, core |
| `src/ui/evolution.ts` | state, battle/core | inventory |
| `src/ui/daycare.ts` | state, data/items | init |
| `src/ui/item-info.ts` | data/items | inventory |
| `src/ui/levelup_moves.ts` | state, battle/core | profile |
| `src/ui/nickname.ts` | — | init |
| `src/ui/pc.ts` | state | — |
| `src/ui/tm.ts` | state, data/items | — |
| `src/ui/gym-reward.ts` | state, data/gyms | init |
| `src/ui/crafting.ts` | state | — |

### 2.6 Data (статические данные)

| Файл | Содержит | Используется в |
|---|---|---|
| `src/data/items.ts` | Предметы (1318) | actions, battle, inventory, shop, profile, core |
| `src/data/regions.ts` | Регионы + локации | location, map, init |
| `src/data/gyms.ts` | Данные залов | core, gym-reward |
| `src/data/shops.ts` | Магазины | shop |
| `src/data/natures.ts` | Натуры покемонов | logic, battle |
| `src/data/types.ts` | Типы покемонов | logic |
| `src/data/drops.ts` | Дроп-таблицы | core, admin |
| `src/data/pokemon_types.ts` | Типы по видам | logic |
| `src/data/npc.ts` | NPC тренеры | npcs |
| `src/data/quests.ts` | Квесты | quests |
| `src/data/starters.ts` | Стартовые покемоны | starter |
| `src/data/stones.ts` | Камни эволюции | evolution |
| `src/data/training.ts` | Тренировки | training |
| `src/data/transport.ts` | Транспорт | map, location |
| `src/data/weather.ts` | Погода | logic |
| `src/data/weather.test.ts` | Тесты погоды | — |

### 2.7 Utils

| Файл | Содержит | Используется в |
|---|---|---|
| `src/utils/dom.ts` | DOM утилиты (showToast, showConfirmModal) | auth, save, все UI модули |
| `src/utils/state.ts` | LEGENDARY_SET | save |
| `src/utils/items.ts` | getItemId, getItemName | inventory, shop |
| `src/utils/sprite.ts` | URL покемонов | core, pokedex, location |
| `src/utils/api.ts` | API base URL | config |

---

## 3. Порядок загрузки (init.ts)

```
1. authTelegram()
   └── apiFetch('/auth/tg') → state.tgToken, state.tgUser
   
2. loadPokedexData()
3. fetchDropConfig()
4. renderTrainerCard()
5. setTravelCallback()
6. setExploredLocs()
7. initGameLoop()
   ├── loadGame() (localStorage)
   ├── cloudLoad() (server GET /api/save)
   │   └── apiFetch('/save')
   ├── applyCloudSave(data)
   ├── saveGame()
   ├── giveStarter() (если новая игра)
   └── renderLocation(state.currentLocationId)
   
8. renderTeamGrid()
9. updateInventoryDisplay()
10. updateMoneyDisplay()
11. updateBadgeDisplay()
12. initProfileEvents()
13. restoreBattleState()
14. startAutoHunt() (если был активен)
15. initInventoryEvents()
16. initProfileUXEvents()
17. initShopEvents()
18. initSellTab()
19. initTrainersTab()
20. openNotifications()
21. startBreedingCheck()
22. startOnboarding() (если туториал)
```

---

## 4. Auth Flow (текущий — фронтенд)

```
Telegram WebApp открывается
  → Telegram.WebApp.initData (строка запроса)
  → initTelegram() / WebApp.ready()
  → authTelegram()
      → apiFetch('/auth/tg', { initData })
      → { token, refreshToken, user } ← response
      → state.tgToken = token
      → state.refreshToken = refreshToken (localStorage)
      → state.tgUser = user
      → hideLoginScreen()
      → если !user.registered → showRegistrationScreen()
      → apiFetch('/auth/is-admin') → state.isAdmin
```

---

## 5. Save Flow

```
cloudLoad()
  → apiFetch('/save') GET
  → { saveData } → applyCloudSave(data)

cloudSave()
  → getFullSaveData() (собирает state в JSON)
  → apiFetch('/save', { saveData, saveVersion })
  → { success, serverVersion }

autoSave()
  → debounced cloudSave()

ApplyCloudSave(data):
  → state.myTeam = data.myTeam
  → state.inventory = data.inventory
  → state.badges = data.badges
  → state.visitedLocations = new Set(data.visitedLocations)
  → state.currentLocationId = data.currentLocationId
  → ...
  → saveGame() (localStorage)
```
