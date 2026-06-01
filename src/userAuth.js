/**
 * userAuth.js — Member authentication
 */

import {
  apiFetch,
  ensureCsrfToken,
  clearCsrfToken,
  setMemberAccessToken,
  clearMemberAccessToken,
  getMemberAccessToken,
} from './apiClient';
import { refreshMemberSession } from './sessionRefresh';

let _sessionUser = null;

function captureLoginTokens(data) {
  if (data.data?.accessToken) {
    setMemberAccessToken(data.data.accessToken);
  }
  if (data.data?.user) {
    _sessionUser = data.data.user;
  }
}

export async function attemptSignup(name, email, password) {
  try {
    await ensureCsrfToken();
    const result = await apiFetch('/auth/user/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    if (result.ok) {
      captureLoginTokens(result.data);
      return { success: true, error: null, user: _sessionUser };
    }

    return { success: false, error: result.data.message || 'Signup failed' };
  } catch {
    return { success: false, error: 'Unable to connect to server. Please try again.' };
  }
}

export async function attemptUserLogin(email, password) {
  try {
    await ensureCsrfToken();
    const result = await apiFetch('/auth/user/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.ok) {
      captureLoginTokens(result.data);
      return { success: true, error: null, user: _sessionUser };
    }

    return { success: false, error: result.data.message || 'Invalid email or password' };
  } catch {
    return { success: false, error: 'Unable to connect to server. Please try again.' };
  }
}

export async function isUserAuthenticated() {
  try {
    await ensureCsrfToken();
    const { ok, data } = await apiFetch('/auth/user/me');
    if (ok && data.data?.user) {
      _sessionUser = data.data.user;
      return true;
    }
    _sessionUser = null;
    clearMemberAccessToken();
    return false;
  } catch {
    _sessionUser = null;
    return false;
  }
}

export async function userLogout() {
  _sessionUser = null;
  clearMemberAccessToken();
  try {
    await apiFetch('/auth/user/logout', { method: 'POST' });
  } catch {
    // silent
  }
  clearCsrfToken();
}

export function getActiveUser() {
  return _sessionUser;
}

export async function fetchMyBookings() {
  try {
    const { ok, data } = await apiFetch('/bookings/my-bookings');
    if (ok) return { success: true, bookings: data.data || [] };
    return { success: false, error: data.message || 'Failed to load bookings' };
  } catch {
    return { success: false, error: 'Connection failed' };
  }
}

export async function updateUserProfile(name) {
  try {
    const { ok, data } = await apiFetch('/auth/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    if (ok) {
      _sessionUser = data.data;
      return { success: true, user: _sessionUser };
    }
    return { success: false, error: data.message || 'Failed to update profile' };
  } catch {
    return { success: false, error: 'Connection failed' };
  }
}

export async function changeUserPassword(oldPassword, newPassword) {
  try {
    const { ok, data } = await apiFetch('/auth/user/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    if (ok) {
      _sessionUser = null;
      clearMemberAccessToken();
      clearCsrfToken();
      return { success: true };
    }
    return { success: false, error: data.message || 'Failed to change password' };
  } catch {
    return { success: false, error: 'Connection failed' };
  }
}
