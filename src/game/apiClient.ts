/**
 * Centralized API client with automatic token refresh and request queuing.
 *
 * Features:
 * - Auto-injects Authorization header from state.tgToken
 * - On 401: queues ALL concurrent requests, refreshes token once, retries all
 * - Prevents race conditions where multiple 401s trigger parallel refreshes
 * - Falls back to original 401 if refresh fails (caller handles re-login)
 * - Pino-compatible logging via console (browser environment)
 */
import { state } from './state';
import { API_BASE } from './config';

// ── Refresh token management (localStorage-persisted) ────────────────────

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem('league17_refresh_token');
  } catch {
    return null;
  }
}

function setRefreshToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem('league17_refresh_token', token);
    } else {
      localStorage.removeItem('league17_refresh_token');
    }
  } catch {
    // localStorage full or unavailable — ignore
  }
}

// ── Refresh queue (race-condition guard) ─────────────────────────────────
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token.
 * Multiple concurrent callers share one refresh attempt — the first one
 * starts the refresh, the rest await the same Promise.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  // If a refresh is already in progress, join it
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken || !state.tgUser?.id) {
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Refresh failed permanently — clear tokens, force re-login
      console.warn('[apiClient] Token refresh failed:', res.status);
      setRefreshToken(null);
      state.tgToken = null;
      return false;
    }

    const data = await res.json();
    state.tgToken = data.token;
    setRefreshToken(data.refreshToken);
    return true;
  } catch (err) {
    // Network error — don't clear tokens, maybe next attempt succeeds
    console.warn('[apiClient] Token refresh network error:', err);
    return false;
  }
}

// ── Event dispatcher for auth failures ───────────────────────────────────

type AuthEventListener = (reason: string) => void;
let authExpiredListeners: AuthEventListener[] = [];

export function onAuthExpired(listener: AuthEventListener) {
  authExpiredListeners.push(listener);
}

export function offAuthExpired(listener: AuthEventListener) {
  authExpiredListeners = authExpiredListeners.filter(l => l !== listener);
}

function dispatchAuthExpired(reason: string) {
  for (const listener of authExpiredListeners) {
    try {
      listener(reason);
    } catch (err) {
      console.warn('[apiClient] AuthExpired listener error:', err);
    }
  }
}

// ── Main fetch wrapper ──────────────────────────────────────────────────

export interface ApiFetchOptions extends RequestInit {
  /** If true, skip auto-refresh on 401 (default: false) */
  skipAuth?: boolean;
  /** AbortSignal for timeout/cancellation */
  signal?: AbortSignal;
}

/**
 * Enhanced fetch wrapper with automatic 401 → refresh → retry interceptor.
 * Use this for ALL game API calls instead of raw fetch().
 *
 * @param url — API URL (relative paths like '/api/save' are resolved)
 * @param options — fetch options (Authorization header injected automatically)
 * @returns Promise<Response> — the final response after any refresh+retry
 *
 * Usage:
 *   const res = await apiFetch('/api/save');
 *   const data = await apiFetch('/api/save', { method: 'POST', body: JSON.stringify({...}) });
 */
export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;

  // Resolve relative URLs
  const resolvedUrl = url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Inject auth token if available
  const token = state.tgToken;
  if (token && !skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(resolvedUrl, {
    ...fetchOptions,
    headers,
  });

  // Auto-refresh on 401 (Unauthorized) — skip for auth endpoints to avoid loops
  if (res.status === 401 && !skipAuth && !url.includes('/auth/refresh')) {
    console.info('[apiClient] 401 received, attempting token refresh');

    const refreshed = await attemptTokenRefresh();

    if (refreshed) {
      // Retry with new token
      const newToken = state.tgToken;
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      res = await fetch(resolvedUrl, {
        ...fetchOptions,
        headers,
      });
    } else {
      // Refresh failed — dispatch auth_expired event
      dispatchAuthExpired('refresh_failed');
    }
  }

  return res;
}

/**
 * Backward-compatible wrapper for code that uses getCloudAuthHeaders().
 * Returns the headers object with Authorization if a token exists.
 */
export function getCloudAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(state.tgToken ? { Authorization: `Bearer ${state.tgToken}` } : {}),
  };
}

// Expose refresh token helpers for other modules
export { getRefreshToken, setRefreshToken };
