# PokeMatrix — сервер + собранный клиент в одном образе.
#
# Собирает и клиент (Vite → /client/dist), и сервер (tsc → /app/dist).
# Раньше образ копировал только серверный dist, поэтому статика отдавалась
# как 404, а SPA-fallback упирался в отсутствие index.html. Путь к клиенту
# задаётся через CLIENT_DIST, потому что /app/dist занят серверным кодом.

# ── Этап 1: зависимости и сборка клиента ─────────────────────
FROM node:22-alpine AS client
WORKDIR /build
COPY package*.json ./
# playwright тянет браузеры postinstall'ом; в сборке образа они не нужны
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci
COPY tsconfig.json vite.config.js index.html style.css main.ts ./
COPY src ./src
COPY public ./public
RUN npx vite build

# ── Этап 2: сборка сервера ───────────────────────────────────
FROM node:22-alpine AS server
WORKDIR /build
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc -p tsconfig.json \
 && node -e "require('fs').cpSync('src/db/migrations','dist/db/migrations',{recursive:true})"

# ── Этап 3: продакшн ─────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV CLIENT_DIST=/app/client

# Зависимости времени выполнения
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Серверный код
COPY --from=server /build/dist ./dist
# Собранный клиент
COPY --from=client /build/dist ./client

EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
