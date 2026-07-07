/**
 * ============================================================
 * auth.ts — ФРОНТЕНД АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   1. Извлекает initData из Telegram.WebApp
 *   2. POST /auth/tg → получает JWT + refreshToken + user
 *   3. Показывает экран логина/загрузки
 *   4. Если пользователь не зарегистрирован → showRegistrationScreen()
 *   5. Регистрация: выбор пиксель-арт аватара + стартового покемона
 *   6. Хранит refreshToken в localStorage, accessToken в state.tgToken
 *   7. Обрабатывает auth_expired события от Socket.IO
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - ./state.js           → state (tgToken, tgUser)
 *   - ./apiClient.js       → apiFetch, setRefreshToken, getRefreshToken
 *   - ../utils/dom.js      → showToast
 *   - ./config.js          → API_BASE
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   - init.ts (await authTelegram() — первая функция при загрузке)
 *
 * 🔹 ЭКСПОРТИРУЕТ:
 *   - authTelegram()       — главная функция входа
 *   - showLoginScreen()    — показать оверлей логина
 *   - hideLoginScreen()    — скрыть оверлей
 *   - showRegistrationScreen() — экран регистрации
 *   - initTelegram()       — Telegram.WebApp.ready()
 *   - setupSocketAuthEvents() — обработчик auth_expired
 *   - TRAINER_AVATARS      — массив ID спрайтов
 *   - STARTER_POKEMON      — массив стартовых покемонов
 * ============================================================
 */

import { state } from './state.js';
import { apiFetch, setRefreshToken, getRefreshToken, onAuthExpired } from './apiClient.js';
import { showToast } from '../utils/dom.js';
import { API_BASE } from './config.js';

// ── Valid trainer sprite IDs (pixel-art avatars) ─────────────────────────
export const TRAINER_AVATARS = [
  'trainer_f',    // Female trainer (leaf green / fire red)
  'trainer_m',    // Male trainer (leaf green / fire red)
  'ninja',        // Koga-style ninja
  'sailor',       // Sailor
  'super_nerd',   // Super Nerd
  'beauty',       // Beauty / Coordinator
  'gentleman',    // Gentleman
] as const;

export type TrainerAvatar = (typeof TRAINER_AVATARS)[number];

// ── Valid starter Pokemon ────────────────────────────────────────────────
export const STARTER_POKEMON = [
  { id: 'bulbasaur', name: 'Bulbasaur', type: 'Grass/Poison', emoji: '🌱' },
  { id: 'charmander', name: 'Charmander', type: 'Fire', emoji: '🔥' },
  { id: 'squirtle', name: 'Squirtle', type: 'Water', emoji: '💧' },
  { id: 'chikorita', name: 'Chikorita', type: 'Grass', emoji: '🌿' },
  { id: 'cyndaquil', name: 'Cyndaquil', type: 'Fire', emoji: '🔥' },
  { id: 'totodile', name: 'Totodile', type: 'Water', emoji: '🐊' },
  { id: 'pikachu', name: 'Pikachu', type: 'Electric', emoji: '⚡' },
  { id: 'eevee', name: 'Eevee', type: 'Normal', emoji: '🦊' },
] as const;

// ── CSS for login/register overlays (injected once) ──────────────────────
const OVERLAY_STYLES = `
  #login-overlay, #register-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: var(--tma-bg, #0a0a1a);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    transition: opacity 0.5s ease;
  }
  .login-spinner {
    width: 32px; height: 32px;
    border: 3px solid var(--tma-border, #333);
    border-top-color: var(--tma-primary, #af52de);
    border-radius: 50%;
    margin: 0 auto;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .avatar-opt {
    width: 56px; height: 56px;
    border-radius: 8px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--tma-card-bg, #1a1a2e);
  }
  .avatar-opt:hover {
    border-color: var(--tma-primary, #af52de);
    transform: scale(1.1);
  }
  .avatar-opt.selected {
    border-color: var(--tma-primary, #af52de);
    box-shadow: 0 0 12px rgba(175, 82, 222, 0.4);
  }
  .avatar-opt img {
    width: 40px; height: 40px;
    image-rendering: pixelated;
    object-fit: contain;
  }
  .starter-opt {
    cursor: pointer;
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 8px;
    transition: all 0.2s ease;
    text-align: center;
    background: var(--tma-card-bg, #1a1a2e);
    min-width: 80px;
  }
  .starter-opt:hover {
    border-color: var(--tma-primary, #af52de);
    transform: scale(1.05);
  }
  .starter-opt.selected {
    border-color: #34c759;
    box-shadow: 0 0 12px rgba(52, 199, 89, 0.4);
  }
  .starter-opt .sprite {
    width: 56px; height: 56px;
    image-rendering: pixelated;
  }
`;

// ── Telegram initialization ──────────────────────────────────────────────

export function initTelegram() {
  if ((window as any).Telegram && (window as any).Telegram.WebApp) {
    (window as any).Telegram.WebApp.ready();
  }
}

// ── Login screen overlay ─────────────────────────────────────────────────

export function showLoginScreen(message: string, isError: boolean) {
  let overlay = document.getElementById('login-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    document.body.appendChild(overlay);

    // Inject styles once
    if (!document.getElementById('auth-overlay-styles')) {
      const style = document.createElement('style');
      style.id = 'auth-overlay-styles';
      style.textContent = OVERLAY_STYLES;
      document.head.appendChild(style);
    }
  }
  overlay.innerHTML = `
    <div class="text-center p-24" style="max-width:320px;">
      <div class="fs-4 mb-16">${isError ? '🔒' : '🐾'}</div>
      <h2 class="m-0-0-8">PokeMatrix</h2>
      <p class="text-muted m-0-0-20 fs-09">${message}</p>
      ${isError
        ? '<p class="text-muted fs-08">Откройте игру через Telegram бота</p>'
        : '<div class="login-spinner"></div>'
      }
    </div>
  `;
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
}

export function hideLoginScreen() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 500);
  }
}

// ── Registration screen ──────────────────────────────────────────────────

export async function showRegistrationScreen(tgData: any): Promise<boolean> {
  // Check if already registered (idempotency guard)
  if (tgData.registered) return true;

  return new Promise((resolve) => {
    const overlay = createRegistrationOverlay(tgData, resolve);
    document.body.appendChild(overlay);
  });
}

function createRegistrationOverlay(tgData: any, resolve: (v: boolean) => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'register-overlay';

  overlay.innerHTML = `
    <div class="w-full" style="max-width:400px;padding:20px;overflow-y:auto;max-height:100vh;">
      <div class="text-center mb-16">
        <div class="fs-4 mb-8">👋</div>
        <h2 class="m-0-0-4">Добро пожаловать!</h2>
        <p class="text-muted" style="margin:0 0 4px;font-size:0.85rem;">Создай свой профиль тренера</p>
      </div>

      <!-- Step 1: Nickname -->
      <div class="mb-16">
        <label class="text-muted fs-08 d-block mb-4">Прозвище тренера</label>
        <input id="reg-nickname" type="text"
          value="${escapeHtml(tgData.first_name || tgData.username || '')}"
          maxlength="20" class="w-full p-10 border-card fs-1"
          style="color:var(--tma-text);background:var(--tma-card-bg);border-radius:8px;border:1px solid var(--tma-border);box-sizing:border-box;">
      </div>

      <!-- Step 2: Avatar (pixel-art trainer sprites) -->
      <div class="mb-16">
        <label class="text-muted fs-08 d-block mb-4">Аватар тренера</label>
        <div id="reg-avatars" class="d-flex flex-wrap gap-8" style="justify-content:center;">
          ${TRAINER_AVATARS.map((av, i) => `
            <div class="avatar-opt ${i === 0 ? 'selected' : ''}"
                 data-av="${av}" title="${avatarLabel(av)}"
                 onclick="window.__selectAvatar(this)">
              <img src="/avatars/${av}.png" alt="${av}"
                   onerror="this.onerror=null;this.parentElement.textContent='${['♀','♂','🥷','⛵','🤓','👩','🧔'][i]}';">
            </div>
          `).join('')}
        </div>
      </div>


      <button class="tma-btn w-full p-12 fs-1" id="btn-register"
              style="background:#34c759;border:none;border-radius:8px;cursor:pointer;">
        🎮 Начать приключение!
      </button>
      <p id="reg-error" class="fs-08 mt-8" style="color:#ff3b30;display:none;"></p>
    </div>
  `;

  // Set up global handler for avatar selection
  (window as any).__selectAvatar = function(el: HTMLElement) {
    overlay.querySelectorAll('.avatar-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
  };
  // Register button handler
  const regBtn = overlay.querySelector('#btn-register') as HTMLElement;
  regBtn.addEventListener('click', async () => {
    const nickInput = overlay.querySelector('#reg-nickname') as HTMLInputElement;
    const nickname = nickInput?.value.trim() || '';
    const regError = overlay.querySelector('#reg-error') as HTMLElement;

    if (!nickname) {
      regError.style.display = 'block';
      regError.textContent = 'Введи прозвище тренера!';
      return;
    }

    const selectedAvatar = overlay.querySelector('.avatar-opt.selected')?.getAttribute('data-av') || 'trainer_f';

    try {
      regBtn.textContent = '⏳ Сохранение...';
      (regBtn as HTMLButtonElement).disabled = true;

      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nickname,
          avatar: selectedAvatar,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        regError.style.display = 'block';
        regError.textContent = errData.error || 'Ошибка сервера';
        regBtn.textContent = '🎮 Начать приключение!';
        (regBtn as HTMLButtonElement).disabled = false;
        return;
      }

      await res.json();
      state.trainerNickname = nickname;
      state.tgUser.registered = 1;

      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); resolve(true); }, 500);
    } catch (e: any) {
      regError.style.display = 'block';
      regError.textContent = 'Ошибка соединения с сервером';
      regBtn.textContent = '🎮 Начать приключение!';
      (regBtn as HTMLButtonElement).disabled = false;
    }
  });

  return overlay;
}

function avatarLabel(av: string): string {
  const labels: Record<string, string> = {
    trainer_f: 'Тренер (д)',
    trainer_m: 'Тренер (м)',
    ninja: 'Ниндзя',
    sailor: 'Моряк',
    super_nerd: 'Заучка',
    beauty: 'Красавица',
    gentleman: 'Джентльмен',
  };
  return labels[av] || av;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ── Main auth flow ───────────────────────────────────────────────────────

export async function authTelegram() {
  initTelegram();
  showLoginScreen('Авторизация через Telegram...', false);

  // Dev mode: allow localhost testing without Telegram
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const devMode = new URLSearchParams(window.location.search).has('dev');

  // Check Telegram WebApp availability
  const tg = (window as any).Telegram;
  if (!tg || !tg.WebApp) {
    if (isLocalhost || devMode) {
      console.info('[auth] Dev mode: bypassing Telegram WebApp check');
    } else {
      showLoginScreen('Игра доступна только через Telegram Mini App. Откройте через бота.', true);
      return;
    }
  }

  // Get initData
  let initData: string;
  if (isLocalhost || devMode) {
    initData = tg?.WebApp?.initData || 'test';
  } else if (tg?.WebApp?.initData) {
    initData = tg.WebApp.initData;
  } else {
    // Try expanding the TMA — some clients delay initData
    try { tg.WebApp.ready(); } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
    if (tg?.WebApp?.initData) {
      initData = tg.WebApp.initData;
    } else {
      showLoginScreen('Ошибка инициализации Telegram. Попробуйте перезапустить бота.', true);
      return;
    }
  }

  // Login via server
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await apiFetch('/auth/tg', {
      method: 'POST',
      body: JSON.stringify({ initData }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Auth failed' }));
      showLoginScreen(errData.error || 'Ошибка авторизации. Попробуйте перезапустить бота.', true);
      return;
    }

    const data = await res.json();

    // Store tokens
    state.tgToken = data.token;
    state.tgUser = data.user;
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
    }

    // Persist trainer ID for localStorage keying
    localStorage.setItem('league17_trainer_id', String(state.tgUser.id));

    hideLoginScreen();

    // Check if registration needed
    if (!data.user.registered) {
      const registered = await showRegistrationScreen(data.user);
      if (registered) {
        state.tgUser.registered = 1;
      }
    }

    // Check admin status
    try {
      const adminRes = await apiFetch('/auth/is-admin');
      if (adminRes.ok) {
        const adminData = await adminRes.json();
        state.isAdmin = adminData.isAdmin;
      }
    } catch (_) {
      // Admin check failure is non-fatal
    }

    // Restore refresh token from localStorage if server didn't return one
    // (backward compat for existing sessions)
    if (!state.refreshToken) {
      const existingRefresh = getRefreshToken();
      if (existingRefresh) {
        state.refreshToken = existingRefresh;
      }
    }
  } catch (e: any) {
    console.warn('[auth] Auth fetch failed:', e?.message || e);
    // Report error to server diagnostics
    try {
      navigator.sendBeacon('/api/log-client-error', JSON.stringify({
        msg: 'Auth fetch failed: ' + (e?.name || e?.message || 'unknown'),
        stack: e?.stack || '',
        url: location.href,
        time: Date.now(),
      }));
    } catch (_) {}

    if (e?.name === 'AbortError') {
      showLoginScreen('Сервер не отвечает (таймаут). Попробуйте позже.', true);
    } else {
      showLoginScreen('Нет соединения с сервером. Проверьте интернет.', true);
    }
  }
}

/**
 * Set up auth_expired event listener on a Socket.IO socket.
 * Call this after establishing a socket connection.
 */
export function setupSocketAuthEvents(socket: any) {
  if (!socket) return;

  // Listen for server-side token expiration notification
  socket.on('auth_expired', async (data: { reason?: string }) => {
    console.info('[auth] Socket reported auth expired:', data?.reason);
    showToast('Сессия истекла. Выполняем переподключение...', false);

    // Attempt token refresh
    const refreshed = await attemptRefresh();
    if (refreshed && state.tgToken) {
      // Reconnect socket with new token
      socket.auth = { token: state.tgToken };
      socket.connect();
    } else {
      showLoginScreen('Сессия истекла. Перезайдите через Telegram.', true);
    }
  });

  // Listen for connect_error with auth failure
  socket.on('connect_error', (err: any) => {
    if (err?.message?.includes('Authentication') || err?.message?.includes('token')) {
      console.warn('[auth] Socket connect_error (auth):', err.message);
      // Don't immediately retry — the reconnection logic will handle it
    }
  });
}

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken || !state.tgUser?.id) return false;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    state.tgToken = data.token;
    setRefreshToken(data.refreshToken);
    return true;
  } catch {
    return false;
  }
}
