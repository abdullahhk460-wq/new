/**
 * Shared API client — CSRF + Bearer fallback when HttpOnly cookies are not sent (e.g. cross-origin API URL).
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

let cachedCsrfToken = null;
let memberAccessToken = null;
let adminAccessToken = null;

const MEMBER_TOKEN_KEY = 'den_member_at';
const ADMIN_TOKEN_KEY = 'den_admin_at';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function setMemberAccessToken(token) {
  memberAccessToken = token || null;
  try {
    if (token) sessionStorage.setItem(MEMBER_TOKEN_KEY, token);
    else sessionStorage.removeItem(MEMBER_TOKEN_KEY);
  } catch {
    // private mode
  }
}

export function getMemberAccessToken() {
  if (memberAccessToken) return memberAccessToken;
  try {
    const stored = sessionStorage.getItem(MEMBER_TOKEN_KEY);
    if (stored) memberAccessToken = stored;
    return stored;
  } catch {
    return null;
  }
}

export function setAdminAccessToken(token) {
  adminAccessToken = token || null;
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // private mode
  }
}

export function getAdminAccessToken() {
  if (adminAccessToken) return adminAccessToken;
  try {
    const stored = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (stored) adminAccessToken = stored;
    return stored;
  } catch {
    return null;
  }
}

export function clearMemberAccessToken() {
  setMemberAccessToken(null);
}

export function clearAdminAccessToken() {
  adminAccessToken = null;
}

export async function ensureCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;

  const fromCookie = getCookie('XSRF-TOKEN');
  if (fromCookie) {
    cachedCsrfToken = fromCookie;
    return cachedCsrfToken;
  }

  try {
    const res = await fetch(`${API_URL}/auth/csrf`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (data.data?.csrfToken) {
      cachedCsrfToken = data.data.csrfToken;
      return cachedCsrfToken;
    }
  } catch {
    // offline
  }

  return null;
}

export function clearCsrfToken() {
  cachedCsrfToken = null;
}

function isAdminApiPath(path) {
  return (
    path.includes('/reviews/admin') ||
    path.startsWith('/settings/admin') ||
    path.startsWith('/bookings/admin') ||
    path === '/auth/me' ||
    (path.startsWith('/auth/') && !path.startsWith('/auth/user'))
  );
}

function isMemberApiPath(path) {
  return (
    path.startsWith('/auth/user') ||
    path.startsWith('/profile/') ||
    path.startsWith('/bookings/my-bookings')
  );
}

function authHeadersForPath(path) {
  const extra = {};
  // Admin routes under /profile/* must be checked before generic /profile/
  if (isAdminApiPath(path)) {
    const token = getAdminAccessToken();
    if (token) extra.Authorization = `Bearer ${token}`;
  } else if (isMemberApiPath(path)) {
    const token = getMemberAccessToken();
    if (token) extra.Authorization = `Bearer ${token}`;
  }
  return extra;
}

async function tryRefreshMemberToken() {
  const { refreshMemberSession } = await import('./sessionRefresh.js');
  return refreshMemberSession(true);
}

async function tryRefreshAdminToken() {
  const { refreshAdminSession } = await import('./sessionRefresh.js');
  return refreshAdminSession(true);
}

export async function apiFetch(path, options = {}, retried = false) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    ...authHeadersForPath(path),
    ...options.headers,
  };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) headers['x-xsrf-token'] = csrfToken;
  }

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers,
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !retried) {
    if (isAdminApiPath(path)) {
      const refreshed = await tryRefreshAdminToken();
      if (refreshed) return apiFetch(path, options, true);
    } else if (isMemberApiPath(path)) {
      const refreshed = await tryRefreshMemberToken();
      if (refreshed) return apiFetch(path, options, true);
    }
  }

  if (res.status === 429) {
    data.message =
      data.message ||
      'Too many requests. Please wait a minute and try again.';
  }

  return { ok: res.ok, status: res.status, data };
}

export { API_URL };
