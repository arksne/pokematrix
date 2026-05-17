# LeaguePM / PokeMatrix — AI Context File

## Project Overview

Pokemon MMO browser game. Full-stack: Express 5 backend + Vite 8 frontend + SQLite3. 
Deployed on Railway. TMA (Telegram Mini App) compatible.

## Architecture

```
LeaguePM/
├── index.html              # SPA — main game HTML (map, battle, chat, trade, etc.)
├── style.css               # Game styles + recent tab system CSS
├── vite.config.js          # Vite config with API proxy to Express
├── package.json            # ESM ("type": "module")
├── nixpacks.toml           # Railway build config (apt packages)
├── server/
│   ├── index.js            # Express entry: auth, DB init, Socket.IO, REST routes
│   ├── db.js               # Database module (better-sqlite3 wrapper)
│   ├── middleware/auth.js   # JWT auth middleware
│   ├── socket.js            # Socket.IO singleton
│   └── routes/
│       ├── auth.js          # Telegram auth + registration
│       ├── save.js          # Game save/load
│       ├── profile.js       # Trainer profiles + locations
│       ├── admin.js         # Admin panel (add items, pokemon, teleport, reset)
│       ├── chat.js          # Chat + moderation commands
│       └── leaderboard.js   # Leaderboard data
└── src/
    ├── main.js              # ~5000 lines — game client: map, battle, chat, trade, etc.
    ├── data/
    │   ├── gyms.js           # 16 gyms data
    │   ├── items.js          # Item definitions
    │   ├── locations.js      # Map locations
    │   ├── quests.js         # Quest definitions
    │   └── ... (other data)
    ├── battle/
    │   ├── core.js           # Battle engine (wild, trainer, gym, PvP)
    │   └── moves.js          # Move definitions
    └── ui/ ... (UI utilities)
```

## Key Technical Details

### Database
- **better-sqlite3** v11 (switched from sqlite3 due to Python/node-gyp issues on Railway)
- WAL mode for concurrent access
- Volume-mounted at `/app/data` on Railway (persists across deploys)
- Tables: `users`, `game_saves`, `leaderboard`, `user_locations`, `action_log`, `chat_messages`

### Auth
- JWT-based, auto-generated secret persisted to `data/` volume
- Telegram auth flow: `tgAuth` → check/register user → return JWT
- Registration saves starter pokemon choice

### Socket.IO
Used for: online player tracking, chat, location updates, trade center, PvP battles
- `initTradeSocket()` creates the Socket.IO connection (must be called to get online status)
- Chat view handler calls both `initTradeSocket()` and `startChatPolling()`

### Build / Deploy (Railway)
- **Builder**: switched from Nixpacks to Railpack v0.23.0
- **Node**: Railpack default (22.22.3)
- **Env vars set in Railway dashboard**:
  - `RAILPACK_BUILD_APT_PACKAGES=python3`
  - `RAILPACK_PYTHON_VERSION=3.12`
  - `NIXPACKS_APT_PACKAGES=python3`
- `railway up --detach` times out on upload — use **git push** to trigger auto-deploy
- Last successful deploy: `48f62450` (2026-05-17 16:17 UTC+6)

### Startup Location
Starting location after registration: **Goldenrod** (`goldenrod` in `east_johto` region)

## Recent Changes (May 2026)

### 1. Database: sqlite3 → better-sqlite3 (commit 09b5bb4)
- **Why**: Railway Nixpacks uses Node 18 + old node-gyp v8.4.1, which crashes on Python 3.12 (`distutils` removed). better-sqlite3 has prebuilt binaries for Node 18-22.
- **server/db.js**: Rewrote to use better-sqlite3 with async wrapper preserving existing API (`db.run()`, `db.get()`, `db.all()`, `db.exec()`)
- **package.json**: `sqlite3` + `sqlite` removed, `better-sqlite3` ^11.7.0 added

### 2. Tab system for location card (index.html + style.css)
- Three tabs: `[Описание] [Дикая природа] [Пособие]`
- Third tab "Пособие" has collapsible sections with game reference info
- Added `.loc-tabs`, `.loc-tab`, `.loc-tab-content` CSS

### 3. Admin panel fixes (server/routes/admin.js + admin.html)
- Fixed `m.shiny` → `m.isShiny` (shiny icon was showing on non-shiny pokemon)
- Added `isShiny: false` to `makeMon()` default
- Added `fix_save` button + `broadcastMsg()` function
- Fixed `goldenrod_city` → `goldenrod` in teleport dropdown
- Added user check guard at admin save endpoint

### 4. Trainer profile fix (server/routes/profile.js)
- **Bug**: Clicking trainer showed "ошибка загрузки"
- **Root cause**: Route path duplication — `router.get('/profile/:userId', ...)` created `/api/profile/profile/123` instead of `/api/profile/123`
- **Fix**: Changed to `router.get('/:userId', ...)`

### 5. Online count fix (main.js)
- **Bug**: Chat online icon always showed 0
- **Root cause**: Socket.IO connection (`initTradeSocket()`) was only called when opening trade center
- **Fix**: Added `initTradeSocket()` call in chat view handler

### 6. Starting location change (main.js + admin.js)
- Changed from `pallet_town`/`kanto` to `goldenrod`/`east_johto`
- Updated 5 locations: declaration, save fallback, cloud sync fallback, admin reset_save

### 7. Railway build fixes
- Switched builder from Nixpacks to Railpack (Nixpacks uses Node 18 which breaks Vite 8)
- Set `RAILPACK_BUILD_APT_PACKAGES=python3` for native addon support
- `nixpacks.toml`: `aptPkgs = ["python3"]`
- **IMPORTANT**: The `sqlite3` → `better-sqlite3` switch should eliminate the need for Python during build

## Pending Tasks

### Railway Deploy (CRITICAL)
The deploy is currently failing. The switch to `better-sqlite3` + Railpack builder should fix:
1. ~~Nixpacks + Node 18 can't run Vite 8~~ → Switched builder to Railpack
2. ~~sqlite3 needs node-gyp → Python → distutils missing in Python 3.12~~ → Replaced with better-sqlite3
3. New deploy was triggered via git push (commit `09b5bb4`), status: BUILDING
4. If deploy succeeds, verify: trainer profiles, online count, Goldenrod start, admin panel

### If deploy still fails
Potential issues:
- Build cache needs invalidation (Railway caches node_modules between builds)
- Railpack config not applying correctly — may need `railway environment edit --service-config` to set builder
- better-sqlite3 prebuild-install may fail for Node 22 — in that case, consider `sql.js` (pure JS SQLite)

### After deployment
- Verify the app works end-to-end
- Check all recent bugfixes deployed correctly (profile, online count, admin panel)
- Monitor Railway volume for DB persistence

## Important Gotchas for Another AI

1. **Shell is fish, not bash** — `status` is a read-only variable in fish
2. **Railway `--build` logs** flag can't be combined with `--deployment` flag
3. **Railway deploy trigger**: git push to main triggers auto-deploy; `railway up --detach` times out
4. **Nixpacks vs Railpack**: The service was originally using Nixpacks (Node 18 + Python 3.12 + broken distutils). Changed to Railpack via `railway environment edit --service-config <id> build.builder RAILPACK`
5. **All server routes are ESM** — `import` not `require()`
6. **The `sqlite` npm package** was the promise-based wrapper for `sqlite3`; after switching to better-sqlite3, custom async wrapper is in `server/db.js`

## Useful Commands

```bash
# Development
npm run dev           # Vite dev server
node server/index.js  # Express server

# Railway
railway deployment list
railway logs --build --lines 100
railway logs --lines 100
railway variables list
railway environment edit --service-config <id> build.builder RAILPACK

# Git
git push              # Trigger Railway auto-deploy
```
