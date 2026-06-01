/**
 * Secure member profile data — biometrics & reviews (server-side only, no localStorage).
 */

import { apiFetch, ensureCsrfToken } from './apiClient';

export async function fetchBiometrics() {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch('/profile/biometrics');
  if (ok) return { success: true, biometrics: data.data };
  return { success: false, error: data.message || 'Failed to load biometrics' };
}

export async function saveBiometrics(payload) {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch('/profile/biometrics', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (ok) return { success: true, biometrics: data.data };
  return { success: false, error: data.message || 'Failed to save biometrics' };
}

export async function fetchMyReviews() {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch('/profile/reviews');
  if (ok) return { success: true, reviews: data.data || [] };
  return { success: false, error: data.message || 'Failed to load reviews' };
}

export async function createReview(review) {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch('/profile/reviews', {
    method: 'POST',
    body: JSON.stringify(review),
  });
  if (ok) return { success: true, review: data.data };
  return { success: false, error: data.message || 'Failed to save review' };
}

export async function updateReview(id, review) {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch(`/profile/reviews/${id}`, {
    method: 'PUT',
    body: JSON.stringify(review),
  });
  if (ok) return { success: true, review: data.data };
  return { success: false, error: data.message || 'Failed to update review' };
}

export async function deleteReview(id) {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch(`/profile/reviews/${id}`, { method: 'DELETE' });
  if (ok) return { success: true };
  return { success: false, error: data.message || 'Failed to delete review' };
}

/** Public homepage testimonials — safe fields only. */
export async function fetchPublicTestimonials() {
  const { ok, data } = await apiFetch('/profile/testimonials');
  if (ok) return { success: true, testimonials: data.data || [] };
  return { success: false, testimonials: [] };
}

/** Admin moderation */
export async function adminFetchReviews(status = 'all') {
  await ensureCsrfToken();
  const params = status !== 'all' ? `?status=${status}` : '';
  const { ok, data } = await apiFetch(`/profile/reviews/admin${params}`);
  if (ok) return { success: true, reviews: data.data || [] };
  return { success: false, error: data.message || 'Failed to load reviews' };
}

export async function adminModerateReview(id, payload) {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch(`/profile/reviews/admin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (ok) return { success: true, review: data.data };
  return { success: false, error: data.message || 'Failed to update review' };
}

export async function adminUpdateReview(id, payload) {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch(`/profile/reviews/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (ok) return { success: true, review: data.data };
  return { success: false, error: data.message || 'Failed to update review' };
}

export async function adminDeleteReview(id) {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch(`/profile/reviews/admin/${id}`, { method: 'DELETE' });
  if (ok) return { success: true };
  return { success: false, error: data.message || 'Failed to delete review' };
}
