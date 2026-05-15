# AI Change Log — League-17 TMA

> Дата: 2026-05-14
> Описание: Добавлены 5 ключевых механик в покемон-веб-игру League-17 TMA.

---

## 1. Save/Load через localStorage

**Файл:** `main.js`

**Что сделано:**
- `saveGame()` — сериализует всё состояние игры в `localStorage.setItem('league17_save', JSON.stringify(data))`
- `loadGame()` — читает и восстанавливает состояние при загрузке страницы
- `autoSave()` — вызывает `saveGame()`, вставлен после: перемещения по локациям, боёв, использования предметов, лечения, покупок
- `resetGame()` — с подтверждением удаляет save и перезагружает страницу
- В `DOMContentLoaded`: сначала пробуется `loadGame()`. Если успех — пропускается `giveStarter()`. Если нет — выдаётся стартовый Groudon.
- Кнопка сброса (⟳) в шапке сайта

**Структура save:**
```json
{
  "currentLocationId": "string",
  "invPokeballs": "number",
  "invPotion": "number",
  "invCandy": "number",
  "invVitamin": "number",
  "invTrain": "number",
  "invWeaken": "number",
  "money": "number",
  "badges": ["string"],
  "myTeam": [{ /* full monster objects with apiData */ }],
  "currentPokemonIndex": "number|null"
}
```

**Важно:** `apiData` (полный ответ PokeAPI) хранится в JSON — работает, т.к. это статические данные.

---

## 2. Магазин (Money + Shop)

**Файлы:** `main.js`, `index.html`, `style.css`

**Что сделано:**
- `money = 500` — новая глобальная переменная
- Деньги начисляются за победу в битве: `money += wildLvl * 15`
- Кнопка "Магазин" в городах (hasHeal: true)
- Модальное окно `#shop-modal` со списком товаров (иконка, название, цена, кнопка)
- Обработчик покупок: проверка денег → списание → добавление предмета → автосохранение
- `updateMoneyDisplay()` — обновляет `#money-display`, `updateBadgeDisplay()` — `#badge-display`

**Цены:**
| Предмет | Цена |
|---------|------|
| Монстробол | $200 |
| Аптечка | $300 |
| Сладкая Конфета | $1000 |
| Витамин | $2000 |
| Набор Тренировки | $5000 |
| Набор Ослабления | $1000 |

**Важно:** `money` сохраняется и загружается через `saveGame/loadGame`.

---

## 3. Система PP (Power Points)

**Файл:** `main.js`

**Что сделано:**
- У каждого покемона в команде: `movesPP = [{ current: number, max: number }, ...]` (4 слота)
- При загрузке атак через PokeAPI: `movesPP[i] = { current: move.pp, max: move.pp }`
- В `useMove()` / `useMoveGym()`: проверка PP → если 0 — "Нет PP для этой атаки!"
- После каждой атаки: `movesPP[currentIndex].current--`
- `updateMoveButtonUI()` — показывает `(PP: cur/max)` на кнопках атаки
- PP восстанавливается в Монстроцентре: `movesPP.forEach(pp => { pp.current = pp.max })`
- PP сохраняется как часть объекта покемона в localStorage

---

## 4. Статусные эффекты

**Файлы:** `main.js`, `index.html`, `style.css`

**Что сделано:**
- Поле `status` на каждом покемоне: `null | 'psn' | 'brn' | 'par' | 'slp' | 'frz'`
- Поле `sleepTurns` для длительности сна
- Функции:
  - `getStatusIcon(status)` — возвращает эмодзи для статуса
  - `applyStatusEffect(target, statusType)` — применяет статус (для сна: random 1-3 ходов)
  - `cureStatus(target)` — снимает статус
  - `checkStatusTurn(target, isPlayer)` — проверка в начале хода:
    - **Sleep**: пропуск хода, при 0 → просыпается
    - **Freeze**: 20% шанс оттаять
    - **Paralysis**: 25% шанс пропуска
  - `applyStatusEndOfTurn(target, isPlayer)` — урон в конце хода:
    - **Poison**: 1/8 HP
    - **Burn**: 1/16 HP, атака /2 для физических атак
- В `useMove()`: чтение `move.meta.ailment` из API для наложения статусов
- В `enemyTurn()`: 10% шанс наложения статуса на игрока
- Иконки статусов в битве (`#player-status-icon`, `#wild-status-icon`)
- Отображение статуса в профиле покемона (вкладка "Сост.")
- Лечение всех статусов в Монстроцентре

---

## 5. Гим-лидеры и Элитная Четверка

**Файлы:** `main.js`, `index.html`, `style.css`

**Что сделано:**
- **8 гим-лидеров Канто**: Брок (Пьютер), Мисти (Церулин), Лейтенант Сёрдж (Вермилион), Эрика (Селадон), Сабрина (Шаффран), Кога (Фуксия), Блейн (Синнабар), Джованни (Виридиан)
- Каждый лидер: имя, титул, тип, команда (2-4 покемона), бейдж, денежная награда
- **Элитная Четверка**: Лорели (Ice), Бруно (Fighting), Агата (Ghost), Лэнс (Dragon)
- **Чемпион**: Голд с командой из 6 покемонов 61-65 уровней
- Массив `badges = []` — отслеживание полученных бейджей
- Кнопка вызова лидера в городах (если бейдж ещё не получен)
- Кнопка Элитной Четверки на Плато Индиго (доступна после 8 бейджей)
- Модальные окна: `#gym-modal` (инфо о лидере), `#elite-modal` (список членов)
- `battleType = 'wild' | 'gym' | 'elite' | 'champion'` — тип битвы
- `startGymBattle()` — запуск битвы с лидером
- `useMoveGym()` / `enemyTurnGym()` — боевые функции для гимов
- `handleGymPlayerFaint()` — переключение между покемонами игрока в гиме
- `startEliteBattle()` → `startEliteNextMember()` → `startEliteNextPokemon()` — элитная четверка
- `championBattle()` → `startChampionNextPokemon()` — битва с чемпионом
- XP и деньги начисляются за каждого побежденного покемона в гиме

**Важно:** Гим-покемоны с `_2` суффиксом (например `kadabra_2`) — для клонов в команде, заменяются на `''` при запросе к PokeAPI.

---

## Дополнительные изменения

**Файл:** `index.html`
- Добавлены: header-info (money, badges, reset), статус-иконки в битве, gym-info в панели, shop-modal, gym-modal, elite-modal, profile-status-display

**Файл:** `style.css`
- Стили для: header-info, статус-иконок, gym-info, shop-modal, gym-modal, elite-modal, tma-btn

---

---

## 7. Новые механики (2026-05-14)

### 7.1 Темная тема
- Кнопка 🌙/☀️ в хедере
- Переключение через `data-theme` на `<html>`, сохранение в localStorage
- Все элементы игры перекрашиваются через CSS custom properties

### 7.2 Способности покемонов
- У каждого покемона есть способность из PokeAPI (`abilities[0]`)
- **Intimidate**: снижает атаку противника на 1 ступень при входе в бой
- **Static / Flame Body / Poison Point**: 30% шанс наложить статус при физической атаке
- **Rough Skin / Iron Barbs**: 1/8 урона атакующему при физической атаке
- **Sturdy**: OHKO оставляет 1 HP
- Система стадий модификаторов (stat stages): atk/def/spa/spd/spe, ступени от -2 до +2
- Стадии сбрасываются при лечении в Монстроцентре

### 7.3 Ягоды (авто-использование в бою)
- 5 новых предметов: Sitrus, Oran, Lum, Chesto, Rawst
- **Sitrus** (+25% maxHP при HP < 50%), **Oran** (+10 HP при HP < 50%)
- **Lum** (любой статус), **Chesto** (сон), **Rawst** (ожог)
- Ягоды выдаются покемону через инвентарь ("Дать")
- Срабатывают автоматически в бою, одноразово
- Цены в магазине: $800/$400/$1200/$200/$200

### 7.4 Погода
- 5 типов: clear, rain, sun, sandstorm, hail
- Определяется детерминированно от дня года + хеша локации (не меняется每秒)
- Иконка погоды рядом с названием локации
- Влияние на бой: rain (+50% water, -50% fire), sun (+50% fire, -50% water), sandstorm (+50% rock), hail (+50% ice)
- Погода применяется в `useMove()`, `enemyTurn()`, `useMoveGym()`, `enemyTurnGym()`

### 7.5 Ежедневные квесты
- 3 случайных квеста в день из 5 типов:
  - Поймать N покемонов (catch_x)
  - Победить N покемонов (defeat_x)  
  - Заработать N денег (earn_money)
  - Исследовать N локаций (explore)
  - Использовать N предметов в бою (use_item)
- Кнопка "📋 Задания" в хедере
- Модальное окно с прогрессом и кнопкой "Забрать награду"
- Награды: деньги + случайные предметы

### 7.6 Бэкенд улучшения
- Rate limiting (100 req/min) через express-rate-limit
- Валидация saveData на сервере (размер, типы полей)
- Graceful shutdown (SIGTERM → close DB)
- CORS из ALLOWED_ORIGIN env var
- Логирование запросов (method, path, status, duration)

---

## Известные ограничения

1. PP для стартового покемона Groudon не загружаются до первой битвы — PP появятся после первого хода
2. Wild покемоны используют упрощенные атаки без PP (random power 30-60)
3. Статусы от диких покемонов накладываются случайно (10%), а не от конкретных атак
4. Покемоны с `_2` в имени — клоны, заменяются при запросе к PokeAPI
5. Нет анимаций для статусных эффектов (просто эмодзи)
6. Нет системы эволюции

---

## Основные функции для справки (main.js)

| Функция | Назначение |
|---------|-----------|
| `saveGame()` | Сохранить игру в localStorage |
| `loadGame()` | Загрузить игру из localStorage |
| `autoSave()` | Автосохранение |
| `resetGame()` | Сброс прогресса |
| `openShop()` | Открыть магазин |
| `startGymBattle(locId)` | Начать битву с гим-лидером |
| `startEliteBattle()` | Начать Элитную Четверку |
| `useMoveGym(index)` | Атака в гиме/элите |
| `enemyTurnGym()` | Ход врага в гиме |
| `handleGymPlayerFaint()` | Переключение покемона игрока |
| `applyStatusEffect(target, type)` | Наложить статус |
| `checkStatusTurn(target, isPlayer)` | Проверить статус в начале хода |
| `applyStatusEndOfTurn(target, isPlayer)` | Урон от статуса в конце хода |
| `updateMoveButtonUI(index, data)` | Обновить кнопку атаки с PP |

---

## 6. Бэкенд (Express + SQLite)

**Дата:** 2026-05-14

**Файлы:** `server/index.js`, `server/db.js`, `server/auth.js`, `server/middleware/auth.js`, `server/routes/auth.js`, `server/routes/save.js`, `server/routes/leaderboard.js`

**Что сделано:**
- Express сервер на порту 3000
- SQLite база данных (`data/game.db`) с таблицами: `users`, `game_saves`, `leaderboard`
- `POST /api/auth/tg` — аутентификация через Telegram Web App initData (HMAC-SHA256) + JWT токен
  - В dev-режиме (без BOT_TOKEN) создается тестовый пользователь
- `GET /api/save` — загрузка сохранения с сервера
- `POST /api/save` — сохранение игры на сервер + обновление leaderboard
- `GET /api/leaderboard` — топ-50 игроков (по значкам, уровню команды, деньгам)
- `GET /api/health` — healthcheck

### Фронтенд интеграция:
- Telegram Web App SDK (`telegram-web-app.js`) в `<head>`
- `authTelegram()` — получает initData из Telegram и отправляет на бэкенд
- `cloudSave()` — debounced (3s) автосохранение на сервер после каждого autoSave()
- `cloudLoad()` — загрузка с сервера при старте (если есть облачное сохранение)
- `applyCloudSave()` — мердж облачных данных в локальное состояние
- `openLeaderboard()` — модальное окно с топ-50 игроков
- Кнопки: "☁️ Синхр." (ручная синхронизация) и "🏆" (таблица лидеров) в header

### Vite proxy:
- `/api` запросы проксируются на `localhost:3000` в dev-режиме

### Важные детали:
- JWT токен живет 7 дней
- Размер JSON в save ограничен 10MB на сервере
- Cloud save НЕ перезаписывает локальное сохранение, если у игрока больше покемонов (приоритет у более прогретого сохранения)
- Telegram initData валидация требует `BOT_TOKEN` переменную окружения для продакшена

