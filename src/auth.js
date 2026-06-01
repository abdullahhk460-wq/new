/**
 * auth.js — Admin panel authentication (separate cookies from member login)
 */

import {
  apiFetch,
  ensureCsrfToken,
  clearCsrfToken,
  setAdminAccessToken,
  clearAdminAccessToken,
} from './apiClient';
import { refreshAdminSession } from './sessionRefresh';

let _sessionAdmin = null;

export async function attemptLogin(email, password) {
  try {
    await ensureCsrfToken();
    const { ok, data } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (ok && data.data?.admin) {
      _sessionAdmin = data.data.admin;
      if (data.data.accessToken) setAdminAccessToken(data.data.accessToken);
      return { success: true, error: null, admin: _sessionAdmin };
    }

    return {
      success: false,
      error: data.message || 'Invalid email or password',
    };
  } catch {
    return { success: false, error: 'Unable to connect to server. Please try again.' };
  }
}

export async function isAuthenticated() {
  try {
    await ensureCsrfToken();
    const { ok, data } = await apiFetch('/auth/me');
    if (ok && data.data?.admin) {
      _sessionAdmin = data.data.admin;
      return true;
    }
    _sessionAdmin = null;
    return false;
  } catch {
    _sessionAdmin = null;
    return false;
  }
}

export async function refreshSession() {
  return refreshAdminSession();
}

export async function logout() {
  _sessionAdmin = null;
  clearAdminAccessToken();
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Fail silently
  }
  clearCsrfToken();
}

export function getSessionUser() {
  return _sessionAdmin;
}

export async function forgotPassword(email) {
  try {
    const { ok, data } = await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return { success: ok, message: data.message || 'If that email exists, a reset link has been sent.' };
  } catch {
    return { success: false, message: 'Unable to connect to server.' };
  }
}

export async function resetPassword(token, newPassword) {
  try {
    const { ok, data } = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
    return { success: ok, message: data.message || (ok ? 'Password reset!' : 'Reset failed.') };
  } catch {
    return { success: false, message: 'Unable to connect to server.' };
  }
}

export function getLockoutStatus() {
  return { locked: false, remainingMs: 0 };
}
