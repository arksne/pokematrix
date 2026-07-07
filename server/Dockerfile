# PokeMatrix League17 — Server Dockerfile
# Этап 1: сборка
FROM node:22-alpine AS builder
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Этап 2: продакшн
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Копируем собранный код
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
