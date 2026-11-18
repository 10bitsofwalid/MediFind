import axios from 'axios';

export const SESSION_EXPIRED_EVENT = 'medifind:session-expired';
export const DEFAULT_API_TIMEOUT_MS = 15000;

export interface SessionExpiredDetail {
  returnTo?: string;
}

const AUTH_EXEMPT_401_PATHS = ['/auth/login', '/auth/register', '/auth/logout'];

let lastSessionExpiryDispatchAt = 0;

/**
 * Validates that a post-login redirect target is an internal, safe application path.
 */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false;
  if (trimmed.includes('://') || trimmed.includes('\\')) return false;
  if (trimmed.startsWith('/login') || trimmed.startsWith('/register')) return false;
  return true;
}

function isAuthExemptRequest(url?: string): boolean {
  if (!url) return false;
  const normalized = url.toLowerCase();
  return AUTH_EXEMPT_401_PATHS.some((path) => normalized.includes(path));
}

export function resetSessionExpiryGuard(): void {
  lastSessionExpiryDispatchAt = 0;
}

export const api = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || '/api',
  timeout: DEFAULT_API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Bearer token from localStorage unless explicitly set by caller (e.g. logout)
api.interceptors.request.use((config) => {
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && config.headers && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle unauthorized responses (session expiry) on protected endpoints
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url as string | undefined;

    if (status === 401 && !isAuthExemptRequest(requestUrl)) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }

      const now = Date.now();
      const shouldNotify = now - lastSessionExpiryDispatchAt > 1500;
      if (shouldNotify) {
        lastSessionExpiryDispatchAt = now;

        let returnTo: string | undefined;
        if (typeof window !== 'undefined' && window.location) {
          const currentPath = `${window.location.pathname || ''}${window.location.search || ''}`;
          if (isSafeReturnPath(currentPath)) {
            returnTo = currentPath;
          }

          if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
                detail: { returnTo },
              })
            );
          }

          const isAlreadyOnLogin = window.location.pathname === '/login';
          if (!isAlreadyOnLogin && typeof window.location.assign === 'function') {
            const params = new URLSearchParams({ reason: 'session_expired' });
            if (returnTo) {
              params.set('returnTo', returnTo);
            }
            window.location.assign(`/login?${params.toString()}`);
          }
        }
      }
    }

    return Promise.reject(error);
  }
);
