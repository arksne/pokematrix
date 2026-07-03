/**
 * API fetch wrapper with automatic JWT refresh on 401.
 *
 * Использование вместо raw fetch для всех вызовов к серверу:
 *   import { apiFetch } from '../network/auth-interceptor.js';
 *   const res = await apiFetch('/api/save', { method: 'POST', body: ... });
 *
 * При 401: автоматически обновляет access token через /api/auth/refresh,
 * сохраняет новые токены в state и localStorage, повторяет запрос.
 * Если refresh не удался — перенаправляет на экран логина.
 *
 * Для запросов с keepalive (pagehide) используйте raw fetch с getCloudAuthHeaders().
 */

import { state } from '../game/state.js';
import { showLoginScreen } from '../game/auth.js';
import { API_BASE } from '../game/config.js';

let isRefreshing = false;
/** Queue of callbacks waiting for the in-flight refresh to complete */
let refreshSubscribers: Array<(ok: boolean) => void> = [];

function onRefreshDone(ok: boolean) {
  refreshSubscribers.forEach(cb => cb(ok));
  refreshSubscribers = [];
}

/**
 * Internal refresh call — guaranteed single in-flight.
 * Returns true if refresh succeeded, false otherwise.
 */
async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });

    if (!res.ok) {
      // 401 or any error — clear tokens
      state.tgToken = null;
      state.refreshToken = null;
      try { localStorage.removeItem('league17_tg_token'); } catch {}
      try { localStorage.removeItem('league17_refresh_token'); } catch {}
      return false;
    }

    const data = await res.json();
    state.tgToken = data.token;
    state.refreshToken = data.refreshToken;
    try {
      localStorage.setItem('league17_tg_token', data.token);
      localStorage.setItem('league17_refresh_token', data.refreshToken);
    } catch {}
    return true;
  } catch (e) {
    // Network error — keep old tokens, they might work next time
    console.warn('[apiFetch] Refresh network error:', e);
    return false;
  }
}

/**
 * Wrapper around fetch that injects the Authorization header and
 * transparently retries after refreshing the access token on 401.
 *
 * @param url     — absolute or relative URL (e.g. '/api/save')
 * @param options — standard RequestInit (headers, body, method, keepalive, …)
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Merge auth header with caller-provided headers
  const headers = new Headers(options.headers || {});
  if (state.tgToken) {
    headers.set('Authorization', `Bearer ${state.tgToken}`);
  }

  let res = await fetch(url, { ...options, headers });

  // 401 + we have a refresh token → try refreshing
  if (res.status === 401 && state.refreshToken) {
    // Only one refresh at a time — others queue up
    if (!isRefreshing) {
      isRefreshing = true;
      const ok = await doRefresh();
      isRefreshing = false;
      onRefreshDone(ok);
    } else {
      // Wait for the in-flight refresh to complete
      const ok = await new Promise<boolean>(resolve => {
        refreshSubscribers.push(resolve);
      });
      if (!ok) return res; // refresh failed, return original 401
    }

    // Retry original request with new token
    if (state.tgToken) {
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set('Authorization', `Bearer ${state.tgToken}`);
      res = await fetch(url, { ...options, headers: retryHeaders });
    }
  }

  // If still 401 after refresh attempt — kill the session
  if (res.status === 401) {
    state.tgToken = null;
    state.refreshToken = null;
    try {
      localStorage.removeItem('league17_tg_token');
      localStorage.removeItem('league17_refresh_token');
    } catch {}
    showLoginScreen('Сессия истекла. Пожалуйста, перезайдите через Telegram.', true);
  }

  return res;
}
