/**
 * Throttled token refresh — avoids "Too many requests" from flooding /auth/refresh.
 * Access tokens expire in ~15m; we refresh at most once every 10 minutes.
 */

import { apiFetch, setAdminAccessToken, setMemberAccessToken } from './apiClient';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 min (before 15m access token expiry)

let lastAdminRefresh = 0;
let lastMemberRefresh = 0;
let adminRefreshPromise = null;
let memberRefreshPromise = null;

export async function refreshAdminSession(force = false) {
  const now = Date.now();
  if (!force && now - lastAdminRefresh < REFRESH_INTERVAL_MS) {
    return true;
  }
  if (adminRefreshPromise) return adminRefreshPromise;

  adminRefreshPromise = (async () => {
    try {
      const { ok, data } = await apiFetch('/auth/refresh', { method: 'POST' });
      if (ok) {
        lastAdminRefresh = Date.now();
        if (data.data?.accessToken) setAdminAccessToken(data.data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      adminRefreshPromise = null;
    }
  })();

  return adminRefreshPromise;
}

export async function refreshMemberSession(force = false) {
  const now = Date.now();
  if (!force && now - lastMemberRefresh < REFRESH_INTERVAL_MS) {
    return true;
  }
  if (memberRefreshPromise) return memberRefreshPromise;

  memberRefreshPromise = (async () => {
    try {
      const { ok, data } = await apiFetch('/auth/user/refresh', { method: 'POST' });
      if (ok) {
        lastMemberRefresh = Date.now();
        if (data.data?.accessToken) setMemberAccessToken(data.data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      memberRefreshPromise = null;
    }
  })();

  return memberRefreshPromise;
}

/** Call once after login; refreshes on a safe interval while the tab is open. */
export function startAdminSessionKeepAlive() {
  refreshAdminSession(true);
  const id = setInterval(() => refreshAdminSession(), REFRESH_INTERVAL_MS);
  return () => clearInterval(id);
}

export function startMemberSessionKeepAlive() {
  refreshMemberSession(true);
  const id = setInterval(() => refreshMemberSession(), REFRESH_INTERVAL_MS);
  return () => clearInterval(id);
}
