# PLAN: Документирование кода PokeMatrix

## Формат комментариев
Каждый файл получает шапку:
```
/**
 * ============================================================
 * filename.ts — ЧТО ДЕЛАЕТ
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   Краткое описание
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - ../package/file.js → что импортируется
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   - файлы, которые импортируют ЭТОТ модуль
 *
 * 🔹 ЭКСПОРТИРУЕТ:
 *   - функции/константы, которые экспортируются
 * ============================================================
 */
```

Плюс inline-комментарии к каждому блоку кода.

## Порядок обработки (цепочка зависимостей)

### ✅ [1/6] Game Core (4 файла)
- [x] `src/game/state.ts` — Глобальное состояние, inventory утилиты
- [ ] `src/game/config.ts` — API_BASE, константы
- [ ] `src/game/store.ts` — Реактивный стор (getter/setter)
- [ ] `src/game/getters.ts` — Геттеры для battle и UI

### 🔲 [2/6] Auth + API (4 файла)
- [ ] `src/game/auth.ts` — Telegram auth, initTelegram, showRegistrationScreen
- [ ] `src/game/apiClient.ts` — apiFetch, token refresh queue
- [ ] `src/game/save.ts` — loadGame, cloudLoad, cloudSave, applyCloudSave
- [ ] `src/game/actions.ts` — addItem, removeItem, useItem

### 🔲 [3/6] Entry & Network (3 файла)
- [ ] `src/game/init.ts` — initGame, auth+save+render последовательность
- [ ] `main.ts` — Точка входа, глобальные типы, dev-команды
- [ ] `src/network/socket.ts` — Socket.IO клиент, trade, pvp

### 🔲 [4/6] Data (15 файлов)
- [ ] `src/data/items.ts` — Предметы (1318)
- [ ] `src/data/regions.ts` — Регионы+локации
- [ ] `src/data/gyms.ts` — Данные залов
- [ ] `src/data/natures.ts` — Натуры
- [ ] `src/data/types.ts` — Типы
- [ ] `src/data/drops.ts` — Дроп-таблицы
- [ ] `src/data/pokemon_types.ts` — Типы по видам
- [ ] `src/data/npc.ts` — NPC
- [ ] `src/data/quests.ts` — Квесты
- [ ] `src/data/starters.ts` — Стартовые
- [ ] `src/data/stones.ts` — Камни
- [ ] `src/data/training.ts` — Тренировки
- [ ] `src/data/transport.ts` — Транспорт
- [ ] `src/data/weather.ts` — Погода
- [ ] `src/data/shops.ts` — Магазины

### 🔲 [5/6] Battle (7 файлов)
- [ ] `src/battle/core.ts` — Основная логика боя
- [ ] `src/battle/logic.ts` — Расчёты урона, типы
- [ ] `src/battle/ai.ts` — AI противников
- [ ] `src/battle/state-machine.ts` — Конечный автомат
- [ ] `src/battle/state.ts` — Состояние боя
- [ ] `src/battle/types.ts` — Типы боя
- [ ] `src/battle/pvp-core.ts` — PvP логика
- [ ] `src/battle/pvp.js` — PvP socket обработчики

### 🔲 [6/6] UI (30+ файлов)
- [ ] `src/ui/location.ts`
- [ ] `src/ui/map.ts`
- [ ] `src/ui/profile.ts`
- [ ] `src/ui/inventory.ts`
- [ ] `src/ui/shop.ts`
- [ ] `src/ui/pokedex.ts`
- [ ] `src/ui/chat.ts`
- [ ] `src/ui/nav.ts`
- [ ] `src/ui/starter.ts`
- [ ] `src/ui/tutorial.ts`
- [ ] `src/ui/npcs.ts`
- [ ] `src/ui/notifications.ts`
- [ ] `src/ui/evolution.ts`
- [ ] `src/ui/levelup_moves.ts`
- [ ] `src/ui/pc.ts`
- [ ] `src/ui/admin.ts`
- [ ] `src/ui/quests.ts`
- [ ] `src/ui/achievements.ts`
- [ ] `src/ui/trainer-card.ts`
- [ ] `src/ui/trainers.ts`
- [ ] `src/ui/trade-center.ts`
- [ ] `src/ui/trade-request.ts`
- [ ] `src/ui/trade-window.ts`
- [ ] `src/ui/trade.js`
- [ ] `src/ui/crafting.ts`
- [ ] `src/ui/daycare.ts`
- [ ] `src/ui/item-info.ts`
- [ ] `src/ui/nickname.ts`
- [ ] `src/ui/gym-reward.ts`
- [ ] `src/ui/tm.ts`

### 🔲 Utils (5 файлов)
- [ ] `src/utils/dom.ts`
- [ ] `src/utils/state.ts`
- [ ] `src/utils/items.ts`
- [ ] `src/utils/sprite.ts`
- [ ] `src/utils/api.ts`

### 🔲 Social (1 файл)
- [ ] `src/social/trainer-profile.ts`

## После всех файлов
- [ ] `DOCUMENTATION.md` — сводный файл: что за что отвечает, от чего зависит

## Статус
- Текущий: Идём по [1/6] Game Core — state.ts ✅
- Следующий: config.ts
