/**
 * Centralized API client with auto-refresh on 401.
 *
 * Usage:
 *   import { apiClient } from '../utils/apiClient.js';
 *   const res = await apiClient('/api/save');
 *   const data = await res.json();
 *
 * On 401, automatically attempts token refresh via /api/auth/refresh.
 * If refresh succeeds, retries the original request with new token.
 * If refresh fails, shows login screen.
 *
 * Also exports helpers for direct fetch-like calls that bypass the interceptor
 * (e.g., the login flow itself).
 */
import { state } from '../game/state.js';
import { API_BASE } from '../game/config.js';
import { showLoginScreen } from '../game/auth.js';

// Refresh state — singleton to prevent concurrent refresh storms
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Like fetch(), but with automatic Authorization header and 401 -> refresh -> retry.
 */
export async function apiClient(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = buildHeaders(options.headers);

  let res = await fetch(url, { ...options, headers });

  // 401 with a refresh token available -> attempt refresh
  if (res.status === 401 && state.refreshToken) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      // Update auth header and retry
      headers.set('Authorization', `Bearer ${state.tgToken}`);
      res = await fetch(url, { ...options, headers });
    } else {
      showLoginScreen('Сессия истекла. Перезайдите в игру.', true);
      throw new Error('Session expired');
    }
  }

  return res;
}

/**
 * Convenience: read response body as JSON, with error handling.
 * Throws if response is not OK (or returns parsed error body).
 */
export async function apiJSON<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await apiClient(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildHeaders(existing?: HeadersInit): Headers {
  const headers = new Headers(existing || {});
  if (!headers.has('Content-Type') && !headers.has('content-type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (state.tgToken) {
    headers.set('Authorization', `Bearer ${state.tgToken}`);
  }
  return headers;
}

async function attemptRefresh(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  if (!state.refreshToken) return false;

  isRefreshing = true;
  refreshPromise = doRefresh();
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });

    if (!res.ok) {
      // Refresh failed — clear tokens
      state.tgToken = null;
      state.refreshToken = null;
      localStorage.removeItem('league17_refresh_token');
      return false;
    }

    const data = await res.json();
    state.tgToken = data.token;
    state.refreshToken = data.refreshToken;
    localStorage.setItem('league17_refresh_token', data.refreshToken);

    // Notify socket to reconnect with new token if connected
    if (state.socket?.connected) {
      state.socket.auth = { token: data.token };
      try { state.socket.disconnect().connect(); } catch (_) { /* ignore */ }
    }

    return true;
  } catch {
    return false;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

/**
 * Legacy helper — returns headers object for use with raw fetch() calls
 * that don't go through apiClient. Prefer apiClient() for new code.
 */
export function getCloudAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (state.tgToken) {
    headers['Authorization'] = `Bearer ${state.tgToken}`;
  }
  return headers;
}
