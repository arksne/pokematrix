# PokeMatrix — прод: как устроен, как проверять, что делать при аварии

Дата: 2026-11-01. Документ написан по итогам аварии 26.10–01.11, когда прод
лежал 6 дней, и последующего восстановления.

---

## 1. Что где живёт

| Компонент | Где | Идентификатор |
|---|---|---|
| Игра (клиент + API + Socket.IO) | Render, регион Frankfurt, план Free | сервис `pokematrix`, `srv-d96fg3navr4c739cv2v0` |
| Публичный адрес | — | https://pokematrix.onrender.com |
| База данных | Neon Postgres 18, AWS eu-central-1 | проект `Pokematrix`, `long-darkness-07892814`, ветка `production`, `br-raspy-field-b26xkui2` |
| Telegram-бот | @League17bot (id 8839474113) | кнопка меню «Играть» → прод-URL, команды `/start /play /game /help` |
| Репозиторий | GitHub | `arksne/pokematrix`, ветка `main` |
| Деплой | Render autoDeploy по пушу в `main` | `npm run render-build` → `node server/dist/index.js` |

Стек: Vite 8 + vanilla TS (клиент), Express + Socket.IO + Drizzle ORM (сервер),
дальше статика раздаётся тем же Express из `dist/`. Клиент и API — **один
origin**, `API_BASE = '/api'`.

---

## 2. Переменные окружения Render

| Ключ | Значение | Комментарий |
|---|---|---|
| `NODE_ENV` | `production` | иначе сервер не включает прод-режим и не требует секреты |
| `NODE_VERSION` | `22` | |
| `JWT_SECRET` | сгенерирован Render | смена = разлогин всех |
| `ADMIN_PASS` | сгенерирован Render | заголовок админ-API |
| `BOT_TOKEN` | токен @League17bot | **без него вход в игру не работает** (HMAC initData) |
| `DATABASE_URL` | строка Neon (pooler) | |
| `CORS_ORIGINS` | домены | для браузера не критично (same-origin), нужно для дев-сервера |
| `ADMIN_IDS` | tg_id админов | |
| `ALLOW_DEV_LOGIN` | `false` | `true` в production = сервер не стартует (fail-fast) |
| `PUBLIC_URL` | `https://pokematrix.onrender.com` | из него бот строит кнопку web_app |
| `TELEGRAM_WEBHOOK_SECRET` | 48-символьный hex | путь вебхука и `secret_token`; без него вебхук отвечает 404 |

Сгенерировать секрет и поставить вебхук (один раз после смены секрета):

```powershell
$t = '<BOT_TOKEN>'; $s = '<TELEGRAM_WEBHOOK_SECRET>'
Invoke-RestMethod "https://api.telegram.org/bot$t/setWebhook" -Method Post -ContentType 'application/json' `
  -Body (@{ url = "https://pokematrix.onrender.com/api/telegram/webhook/$s"; secret_token = $s; drop_pending_updates = $false } | ConvertTo-Json)
Invoke-RestMethod "https://api.telegram.org/bot$t/getWebhookInfo"
```

---

## 3. Как проверить, что прод живой

Порядок — от дешёвого к дорогому.

```powershell
# 1. Здоровье и версия
Invoke-RestMethod https://pokematrix.onrender.com/api/health   # {"status":"ok","db":true,...}
Invoke-RestMethod https://pokematrix.onrender.com/api/version  # commit = HEAD в main
Invoke-RestMethod https://pokematrix.onrender.com/api/telegram/status  # enabled: true

# 2. Полный E2E по API и сокетам (50 проверок: infra + pvp + trade + arena)
cd pokematrix
$env:PROD_BOT_TOKEN='<BOT_TOKEN>'; node tools/prod-check/run.mjs all

# 3. Прод глазами игрока в Telegram (17 проверок в Chromium)
$env:PROD_BOT_TOKEN='<BOT_TOKEN>'; node tools/prod-ops/browser-check.mjs
#   скриншоты: tools/prod-ops/.state/prod-browser*.png

# 4. Локальный полный прогон (PGlite + Chromium, ~8 минут)
npm run verify
```

`tools/prod-check/wait-health.mjs` умеет ждать холодный старт Render Free:

```powershell
node tools/prod-check/wait-health.mjs --timeout-min 10 --interval-sec 10
```

---

## 4. Квоты Neon Free — главное ограничение

Free-план: **5 ГБ public network transfer на проект в месяц**, 100 CU-часов,
1 ГБ хранилища. При исчерпании egress Neon **приостанавливает compute до конца
расчётного периода** (не помогает перезапуск; помогают только апгрейд плана или
ожидание 1-го числа). Ветка при этом может показываться как `archived` — она
раз-архивируется сама при первом обращении.

Что произошло 26.10: за 27 дней проект потратил 5.5 ГБ egress. Основной
источник — прокси `/api/pokeapi/*`: каждый запрос шёл `SELECT`'ом в
`pokemon_cache` и тянул из базы целый JSON PokeAPI (десятки-сотни килобайт),
а клиент запрашивает покемона, его вид, эволюцию и атаки постоянно. База
встала, сервер падал на миграциях (`process.exit(1)` в production), Render
крутил crash-loop — снаружи это выглядело как вечный 503/таймаут.

Что сделано, чтобы не повторилось:

- **L1-кэш в памяти** процесса перед таблицей: `server/src/routes/pokeapi.ts`
  (LRU 48 МБ / 600 записей, TTL 24 ч). После прогрева Postgres по этим путям
  не читается вообще; ответ отдаётся готовой строкой.
- Ошибки чтения/записи кэша больше не роняют прокси (приостановленный Neon
  раньше превращал любой запрос в 500).
- **gzip** для JSON-ответов: сейв и дампы PokeAPI в 5–34 раза меньше по проводу.
- `/assets/*` — `immutable` на год, `index.html` — `no-cache`: вебвью перестаёт
  перекачивать бандл на каждое открытие.

Контроль расхода: https://console.neon.tech → проект → Usage (Network transfer).
Порог тревоги — 3.5 ГБ: если растёт быстро, смотреть, не долбит ли какой-то
эндпоинт `pokemon_cache` мимо L1 (перезапуск инстанса Render обнуляет L1 —
первый прогрев снова читает базу).

Быстрый способ проверить, что квота снова кончилась:

```powershell
cd pokematrix
npx --yes psql "$env:DATABASE_URL" -c "select 1"   # 402 quota / connection error
```

---

## 5. Что делать, если прод отдаёт 503 или висит

1. `https://pokematrix.onrender.com/api/health`:
   - `{"status":"warming"}` → сервер поднимается (Render Free холодный старт
     до ~60 с). Подождать.
   - таймаут / нет ответа → инстанс не поднялся. Смотреть Render → Logs.
   - `{"status":"degraded","db":false}` → сервер жив, база нет. Идти в п.2.
2. База: `npx psql "$DATABASE_URL" -c "select 1"`.
   - `HTTP 402 quota` → квота Neon (п.4). Ждать 1-е число или апгрейд.
   - таймаут → compute приостановлен/архив; открыть console.neon.tech
     (любое действие раз-архивирует ветку).
3. Сервер падает на старте: в логах Render искать `[server] Migration FAILED`
   и `[FATAL] ... не задан`. Миграции в production останавливают процесс
   намеренно: с неполной схемой лучше не стартовать.
4. Деплой не проходит health check (Render → Events `server_failed`):
   проверить `/api/health` руками; Render держит предыдущий успешный деплой,
   пока новый не станет здоровым.
5. Откат кода: Render → Deploys → нужный деплой → Rollback (или
   `git revert` + пуш).

---

## 6. Известные ограничения и следующий шаг

- Бесплатный Neon: 5 ГБ egress/мес и остановка на месяц при превышении.
  Следующий шаг для реальной нагрузки — план Launch (~$0.10/GB сверх 500 ГБ).
- Render Free: засыпает после 15 минут без запросов, первый запрос ~30–60 с.
  Для «игрок зашёл и сразу играет» нужен любой always-on план.
- `craftersKit` (вход в крафт) сейчас не продаётся в магазинах — только дроп
  с machop/machoke/makuhita/smeargle. Если вернуть в магазин, убрать его из
  `REMOVED` в `src/ui/shops-assort.test.ts` (тест сверяет ассортимент).
- Вебхук бота отвечает на любое сообщение приветствием с кнопкой игры; диалогов
  и команд-меню (кроме зарегистрированных `setMyCommands`) нет.
- Админ-панель требует `ADMIN_PASS`, значение сгенерировано Render и никому не
  выдавалось; при необходимости задать своё в Dashboard → Environment.

---

## 7. История аварии (для контекста)

- 2026-10-22 — последний зелёный деплой (`5a26fe1`), прод работал.
- 2026-10-24 21:21 — ветка Neon ушла в `archived`, compute остановлен:
  исчерпан egress (5.5 ГБ / 5 ГБ за период 04.10–01.11).
- 2026-10-26 … 2026-10-31 — Render: серия `server_failed` (exit 1) — сервер
  падал на миграциях, `/api/health` отдавал 503 или висел.
- 2026-11-01 00:00 UTC — расчётный период сменился, квота обнулилась, база
  поднялась; деплой пересобран и прод восстановлен.
- В том же окне починено: L1-кэш PokeAPI, gzip, кэш статики, `X-Frame-Options`
  (Telegram Web в iframe), вебхук бота (молчал на `/start`), `/api/api/version`
  (404 у клиента), мёртвый крафт (18 несуществующих id), флаки-тесты CI,
  красный CI (типизация в двух job'ах) и шум Pages-деплоя.
