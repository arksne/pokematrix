# Telegram production configuration — PokeMatrix

Operational record of the production Telegram bot / Mini App setup.

- Checked: **2026-11-01 ~05:10–05:25 (Asia/Bishkek, UTC+06:00)**
- Bot API reference used: **10.3 (released 2026-08-24)** — `setChatMenuButton`, `getChatMenuButton`,
  `MenuButton*`, `setMyCommands`, `setMyDescription`, `setMyShortDescription` were read from
  `core.telegram.org/bots/api` before use; all of them are current and unchanged since Bot API 6.0/6.1.
- Methods used are long-stable (menu button since Bot API 6.0, bot descriptions since 6.1), so no
  library-version caveat applies: the calls below are raw HTTPS, no client library involved.
- ⚠️ The web service itself was returning 503 during this check (Neon free-tier egress quota),
  so **HTTP-level verification of the page inside Telegram could not be performed**. Everything
  below about the bot is verified live against the Bot API; everything about the repo is static
  code inspection. See "What is still unverified".

---

## 1. Bot identity (verified with `getMe`)

| Field | Value |
|---|---|
| id | `8839474113` |
| first_name | `Pokematrix` |
| username | `@League17bot` |
| has_main_web_app | `true` (a Main Mini App is configured in BotFather) |
| supports_inline_queries | `true` |
| can_join_groups | `true` |

Token is the production token supplied for this operation. It is **not** written into this or any
other tracked file; every call below uses `$BOT_TOKEN` / `<BOT_TOKEN>` placeholders. The deployed
value lives in the Render environment variable `BOT_TOKEN` (`render.yaml:27-28`, `sync: false`).

> A second token (`8702255668:…`, bot **Boogi3BOT**) is a different bot and was deliberately not
> touched.

---

## 2. Before → after

| Property | Before | After |
|---|---|---|
| Menu button | `{"type":"web_app","text":"🎮 Play PokeMatrix","web_app":{"url":"https://pokematrix.onrender.com/"}}` | `{"type":"web_app","text":"Играть","web_app":{"url":"https://pokematrix.onrender.com/"}}` |
| Commands | `[]` (empty) | `start`, `play`, `game`, `help` (Russian, see below) |
| Description | `"test"` (placeholder) | Russian product description (see below) |
| Short description | `""` (empty) | Russian one-liner (see below) |
| Webhook | `{"url":"","pending_update_count":0}` — **none set** | unchanged (correct: a Mini App needs no webhook, and the repo has no update handler) |

The menu button now opens the Mini App at `https://pokematrix.onrender.com/`.
Telegram normalizes a root URL to its trailing-slash form: the request was made with
`https://pokematrix.onrender.com` (as specified) and `getChatMenuButton` reports
`https://pokematrix.onrender.com/`. Same document, same origin — this is expected and harmless
for Mini App domain validation.

---

## 3. Exact API calls used

Base: `https://api.telegram.org/bot<BOT_TOKEN>/` — POST, `Content-Type: application/json; charset=utf-8`.
In PowerShell: `Invoke-RestMethod -Uri "$base/<method>" -Method Post -ContentType 'application/json; charset=utf-8' -Body $json`
with `$base = "https://api.telegram.org/bot$env:TG_BOT_TOKEN"` (token passed via env var only).

### 3.1 Menu button → Mini App ("Играть")

```
POST /setChatMenuButton
{"menu_button":{"type":"web_app","text":"Играть","web_app":{"url":"https://pokematrix.onrender.com"}}}
→ {"ok":true,"result":true}

GET/POST /getChatMenuButton
→ {"ok":true,"result":{"type":"web_app","text":"Играть",
   "web_app":{"url":"https://pokematrix.onrender.com/"}}}
```

Omitted `chat_id` = the bot's **default** menu button, i.e. it applies to every private chat.
This is the current, correct launch path: the launcher icon next to the message box opens the Mini App.

> Operational note: `setChatMenuButton` applies **asynchronously**. Several writes returned
> `{"ok":true}` while `getChatMenuButton` kept returning the previous value for a while
> (observed several minutes; the very first attempt did not appear at all, a later retry did).
> Do not treat an unchanged read-back immediately after a successful write as a failure —
> re-read after a few minutes before retrying or concluding anything. Expected cache/propagation
> on Telegram's side, not an error.

### 3.2 Commands (were empty)

```
POST /setMyCommands
{"commands":[
  {"command":"start","description":"Открыть игру / начать"},
  {"command":"play", "description":"Играть в PokeMatrix"},
  {"command":"game", "description":"Открыть мир покемонов"},
  {"command":"help", "description":"Помощь и подсказки"}
]}
→ {"ok":true,"result":true}
```

Verified with `getMyCommands` — returns exactly the four entries above.

### 3.3 Description (was the placeholder `"test"`)

```
POST /setMyDescription
{"description":"PokeMatrix — фанатская игра про покемонов прямо в Telegram: лови диких покемонов, собирай команду, сражайся с лидерами залов и другими тренерами в PvP. Прогресс сохраняется автоматически."}
→ {"ok":true,"result":true}
```

### 3.4 Short description (was empty)

```
POST /setMyShortDescription
{"short_description":"Лови покемонов, сражайся с тренерами и собирай значки — всё внутри Telegram."}
→ {"ok":true,"result":true}
```

### 3.5 Read-only calls used for the audit

`getMe`, `getWebhookInfo`, `getMyCommands`, `getChatMenuButton`, `getMyDescription`,
`getMyShortDescription` — all returned `{"ok":true}`.

### 3.6 Webhook

`getWebhookInfo` → `{"url":"","has_custom_certificate":false,"pending_update_count":0}`.
No webhook is set, so nothing was deleted or replaced. This is consistent with the repo: a search
of the whole repository found **no Bot API usage at all** — no `api.telegram.org`, `getUpdates`,
`setWebhook`, `sendMessage`, or `answerWebAppQuery` (`*.ts/js/yml/md`). The server only uses the
token to *validate* `initData` (`server/src/routes/auth.ts:42-71`). Consequence: the bot is a pure
launcher — it never replies to `/start` or any command. The commands above are visible in the
Telegram UI but produce no message. Not a blocker for opening the game (the menu button does that);
flag it if the product wants the bot to answer.

---

## 4. Repo audit — Telegram client path

Checked the client entry and the production server wiring at `main @ 5a26fe1`.

| Item | Location | Verdict |
|---|---|---|
| `telegram-web-app.js` included | `index.html:21` (built: `dist/index.html:21`) | ✅ present, loaded before the app bundle |
| Cache-bust guard for Telegram WebView2 | `index.html:10-20` | ✅ runs first; rewrites the URL via `location.replace` only when `location.search` already contains `tgWebAppData`, so launch params are preserved. Uses `?` + search and drops the hash — safe today because the check itself requires `tgWebAppData` in the query string, but fragile if launch params ever arrive only in the hash. Not a current blocker. |
| `Telegram.WebApp.ready()` | `src/game/auth.ts:132-136` (`initTelegram`) | ✅ called first thing in `authTelegram()` |
| `initData` collection + fallback | `src/game/auth.ts:332-347` | ✅ reads `Telegram.WebApp.initData`; if empty, calls `ready()` and retries after 300 ms; on failure shows a Russian error asking to reopen via the bot |
| `initData` → server | `src/game/auth.ts:354-358` — `POST /auth/tg` with `{initData}` | ✅ raw initData sent over same-origin HTTPS; no token in the page |
| Server-side signature check | `server/src/routes/auth.ts:42-71` (HMAC per docs), `:86` (`'test'` only when `ALLOW_DEV_LOGIN=true`), `:94-103` (rejects if `BOT_TOKEN` unset / signature invalid) | ✅ correct algorithm, constant-time compare, `auth_date` freshness bound |
| `API_BASE` | `src/game/config.ts:28` → `'/api'` | ✅ relative, same-origin — no CORS involved |
| API is same origin as the page | `server/src/index.ts:116` (`express.static(CLIENT_DIST)`), `:239-241` (API 404), `:250-255` (SPA fallback to `index.html`) | ✅ page and `/api` are served by the same Express app on `https://pokematrix.onrender.com` |
| CORS | `server/src/config.ts:25` (`CORS_ORIGINS` default `http://localhost:5173`), `server/src/index.ts:99-103`, socket.io `:258-263` | ✅ **not a blocker**: requests from the Mini App are same-origin, so CORS is never applied. Setting `CORS_ORIGINS` is only needed if the client is ever served from another origin. |
| CSP | `server/src/index.ts:106-108` — `helmet({ contentSecurityPolicy: false })` | ✅ CSP explicitly disabled → no `frame-ancestors`, no `script-src`/`connect-src` restriction. Nothing blocks `telegram.org` script, Google Fonts, the API or the socket. |
| COEP | helmet 8.2.0 (`server/node_modules/helmet`), `crossOriginEmbedderPolicy` disabled by default | ✅ `require-corp` is **not** sent, so the cross-origin `telegram-web-app.js` and Google Fonts load normally |
| Built bundle | `dist/index.html:21-26` — telegram script + `/assets/index-*.js` + bundled `/assets/index-*.css` | ✅ Vite bundled `style.css` into the asset CSS (there is and need not be a `dist/style.css`); built artifact is current (2026-11-01 04:53) |

### 4.1 Hazard found: `X-Frame-Options: SAMEORIGIN` (advisory, affects Telegram Web browser only)

`server/src/index.ts:106-108` enables Helmet in production with only CSP turned off:

```ts
if (config.isProduction) {
  app.use(helmet({ contentSecurityPolicy: false }));
}
```

Helmet 8.2.0 defaults `xFrameOptions` to `SAMEORIGIN` (`server/node_modules/helmet/index.cjs`,
`getHeaderValueFromOptions$1({action = "sameorigin"})` → emits `X-Frame-Options: SAMEORIGIN`).
That header is applied to **every** production response, including the SPA fallback that serves
`index.html` (`server/src/index.ts:250-255`) — i.e. to the Mini App document itself.

- **Native clients (Telegram iOS/Android/macOS/Windows)**: the Mini App is loaded as a top-level
  document in a WebView → `X-Frame-Options` is irrelevant → unaffected. This is the normal path.
- **Telegram Web (browser, web.telegram.org)**: Mini Apps are rendered inside an iframe of the
  Telegram Web page, so `SAMEORIGIN` would refuse the frame from `web.telegram.org` and the Mini App
  would fail to appear for that client. **Confidence: medium-high; verify in the browser client
  once the service is back up** (this could not be tested during the 503 window, and it was not
  possible to observe the live headers).

Suggested fix (not applied — outside this task's write scope):
`helmet({ contentSecurityPolicy: false, xFrameOptions: false })` plus, if desired,
`Content-Security-Policy: frame-ancestors https://web.telegram.org https://*.telegram.org`
instead of dropping framing protection entirely.

### 4.2 Security note (no action): client `?dev` flag is inert in production

`src/game/auth.ts:317-334` allows `?dev` on non-localhost to fall back to `initData = 'test'`.
The server only accepts `'test'` when `ALLOW_DEV_LOGIN=true` (`server/src/routes/auth.ts:86`),
and production refuses to boot with that flag (`server/src/config.ts:49-51`;
`render.yaml:34-35` sets it to `false`). So in prod it cannot bypass Telegram auth.

### 4.3 Configuration dependency to verify on Render (cannot be checked from here)

The server validates the Mini App's `initData` with `BOT_TOKEN`
(`server/src/config.ts:11,41-44`; `server/src/routes/auth.ts:42-71,94-103`). The Mini App is opened
from **this** bot, so `initData` is signed with the `8839474113` (`@League17bot`) token. If Render's
`BOT_TOKEN` were ever a *different* bot's token, every login would fail with
`401 Invalid initData signature` (`server/src/routes/auth.ts:100-102`) while the page itself still
loaded fine. This is the single most likely non-DB cause of "opens but stuck on authorization";
it must be `BOT_TOKEN` == the token above. (Not verified: Render MCP/dashboard was out of scope.)

---

## 5. Blockers / open items

1. **No blocker to opening the game from Telegram was found in the repo.** Entry path is correct:
   menu button (web_app) → `https://pokematrix.onrender.com` → `index.html` loads
   `telegram-web-app.js` → `auth.ts` sends same-origin `initData` → server HMAC-verifies it.
2. **`X-Frame-Options: SAMEORIGIN`** — see 4.1. Advisory; would affect the Telegram Web browser
   client only, not native apps.
3. **No update consumer** — the bot never answers commands (no webhook, no polling, no Bot API
   calls anywhere in the repo). Commands are cosmetic until a handler is added.
4. **Bot has a Main Mini App** (`getMe.has_main_web_app: true`), so `https://t.me/League17bot?startapp`
   also opens the app directly from the bot profile / shared link — a useful secondary entry.
5. The current **503** (Neon egress quota, resets `2026-11-01T00:00:00Z` = 06:00 Asia/Bishkek) is
   infrastructure, not Telegram; it is what prevented end-to-end HTTP verification here.

## 6. What is still unverified

- End-to-end launch inside a real Telegram client (page load → `initData` → `POST /api/auth/tg` →
  200 + JWT) and the rendered UI. Was impossible while the web service returned 503 / timed out.
- Live response headers (to confirm the `X-Frame-Options` value in the deployed build) — same reason.
- The deployed `BOT_TOKEN` value on Render — see 4.3.

Re-run after the quota resets: open the bot in Telegram, tap the menu button (should read
**Играть**), confirm the game loads and the user is logged in; then optionally open
`https://t.me/League17bot?startapp` in Telegram Web to validate the framing question in 4.1.
