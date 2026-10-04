/**
 * Генерация валидного Telegram Mini App initData и шим Telegram.WebApp.
 *
 * Подпись считается ровно так, как это делает Telegram и как проверяет
 * server/src/routes/auth.ts:verifyTelegramInitData:
 *   secret = HMAC_SHA256("WebAppData", bot_token)
 *   hash   = HMAC_SHA256(secret, отсортированные параметры)
 */
import crypto from 'node:crypto';
import { BOT_TOKEN } from './paths.mjs';

export function signInitData(botToken, user, extra = {}) {
  const params = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify(user),
    ...extra,
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const qs = new URLSearchParams({ ...params, hash }).toString();
  return { initData: decodeURIComponent(qs), hash, dataCheckString };
}

export function makeUser(id = 777000111, username = 'verify_tester', firstName = 'Verify') {
  return {
    id,
    first_name: firstName,
    last_name: 'Tester',
    username,
    language_code: 'ru',
    is_premium: false,
  };
}

/**
 * Минимальный шим Telegram.WebApp.
 *
 * Важно: index.html подключает настоящий https://telegram.org/js/telegram-web-app.js,
 * и он перезатирает window.Telegram. Поэтому шим не подставляется через
 * addInitScript, а отдаётся в ответ на запрос этого файла — как это и делает
 * клиент Telegram.
 */
export function webAppShim(initData) {
  return `(() => {
  const noop = () => {};
  const win = window;
  win.Telegram = win.Telegram || {};
  win.Telegram.WebApp = {
    initData: ${JSON.stringify(initData)},
    initDataUnsafe: { user: { id: 777000111, first_name: 'Verify', username: 'verify_tester' }, auth_date: Math.floor(Date.now()/1000) },
    version: '7.0',
    platform: 'android',
    colorScheme: 'light',
    themeParams: { bg_color: '#ffffff', text_color: '#000000', hint_color: '#999999', link_color: '#2481cc', button_color: '#2481cc', button_text_color: '#ffffff' },
    isExpanded: true,
    viewportHeight: 800,
    viewportStableHeight: 800,
    headerColor: '#ffffff',
    backgroundColor: '#ffffff',
    isClosingConfirmationEnabled: false,
    isFullscreen: false,
    isActive: true,
    isVisible: true,
    orientation: 'portrait',
    devicePixelRatio: 3,
    safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    ready: noop,
    expand: noop,
    close: noop,
    setHeaderColor: noop,
    setBackgroundColor: noop,
    enableClosingConfirmation: noop,
    disableVerticalSwipes: noop,
    requestFullscreen: noop,
    exitFullscreen: noop,
    onEvent: noop,
    offEvent: noop,
    sendData: noop,
    switchInlineQuery: noop,
    openTelegramLink: noop,
    showPopup: (cb) => cb && cb('ok'),
    showAlert: (msg, cb) => { win.__tgAlert = msg; cb && cb(); },
    showConfirm: (msg, cb) => cb && cb(false),
    HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
    BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop, isVisible: false },
    MainButton: { text: '', show: noop, hide: noop, onClick: noop, offClick: noop, isVisible: false },
    CloudStorage: {
      setItem: (k, v, cb) => { win.__cloudStore = Object.assign(win.__cloudStore || {}, { [k]: v }); cb && cb(true, null); },
      getItem: (k, cb) => cb && cb((win.__cloudStore && win.__cloudStore[k]) || '', null),
      removeItem: (k, cb) => cb && cb(true, null),
    },
    deviceStorage: { removeItem: noop },
    requestWriteAccess: (cb) => cb && cb(false),
  };
})();`;
}

/** Тестовые пользователи по tg_id — чтобы тесты не зависели от внешнего состояния. */
export const USERS = {
  main: makeUser(777000111, 'verify_tester', 'Verify'),
  data: makeUser(555000222, 'regress_tester', 'Regress'),
  xss: makeUser(666000333, 'xss_tester', 'Xss'),
  crash: makeUser(444000555, 'crash_tester', 'Crash'),
};

export { BOT_TOKEN };
