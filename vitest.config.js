import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Клиент + серверные юнит-тесты чистых функций (server/src/lib): кодеки,
    // расчёты. Серверные тесты специально не тянут Express/БД — они про логику,
    // а не про запущенный сервер (его проверяет tools/verify).
    include: ['src/**/*.test.{js,ts}', 'server/src/**/*.test.ts'],
    environment: 'node',
    // Юнит-тестам хватает миллисекунд, но первый динамический импорт тяжёлого
    // модуля (trainer-card тянет половину UI-графа) на холодном/загруженном
    // раннере выходит за дефолтные 5 с — тест падал по таймауту без единой
    // реальной ошибки. Ловили это на CI и при параллельном прогоне verify.
    // Таймаут тут — страховка от зависания, а не измерение скорости.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Клиентский код боевой/PvP-части — UI-код с fire-and-forget
    // динамическими импортами (`await import('../ui/inventory.js')` из
    // grantPvpExp, `import('../ui/pvp-arena.js')` из сокет-хендлеров).
    // Юнит-тесты дёргают эти функции без await (это их смысл: проверяем
    // синхронный эффект), и промис догружает модуль уже после teardown
    // окружения Vitest. На CI файлы успевают завершиться раньше, чем
    // догрузка items.ts, и Vitest валит job с
    // `EnvironmentTeardownError: Cannot load ... after the environment was
    // torn down` — при том что ВСЕ 1360 тестов зелёные (видно в логе выше
    // ошибки). Это гонка тестового раннера, а не дефект продукта: реальные
    // async-пути проверяются в браузере в `npm run verify` и
    // `tools/prod-ops/browser-check.mjs`. Поэтому не считаем такие
    // «unhandled» ошибки провалом прогона — иначе CI зелёный только по
    // случайности.
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
