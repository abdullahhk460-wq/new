import { apiFetch, ensureCsrfToken } from './apiClient';

export const DEFAULT_WHATSAPP = '923169636282';
export const DEFAULT_MSG =
  'Assalam-o-Alaikum, I want to book an elite trial workout pass at The Den Gym!';

/** Same rules as backend — accepts 03xx or 92xx. */
export function normalizeWhatsAppNumber(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = `92${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith('3')) {
    digits = `92${digits}`;
  }
  return digits;
}

export function buildWhatsAppUrl(number, message) {
  const digits = normalizeWhatsAppNumber(number) || DEFAULT_WHATSAPP;
  const text = encodeURIComponent(message || DEFAULT_MSG);
  return `https://wa.me/${digits}?text=${text}`;
}

function formatApiError(data) {
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e.message || `${e.field}: invalid`).join(' · ');
  }
  return data.message || 'Request failed';
}

/** Public site settings (WhatsApp number for visitors). */
export async function fetchPublicSettings() {
  const { ok, data } = await apiFetch('/settings/public');
  if (ok && data.data) {
    return {
      success: true,
      whatsappNumber: data.data.whatsappNumber || DEFAULT_WHATSAPP,
      whatsappDisplay: data.data.whatsappDisplay || '03169636282',
      whatsappPrefillMessage: data.data.whatsappPrefillMessage || DEFAULT_MSG,
    };
  }
  return {
    success: false,
    whatsappNumber: DEFAULT_WHATSAPP,
    whatsappDisplay: '03169636282',
    whatsappPrefillMessage: DEFAULT_MSG,
  };
}

export async function adminFetchSettings() {
  await ensureCsrfToken();
  const { ok, data } = await apiFetch('/settings/admin');
  if (ok) return { success: true, settings: data.data };
  return { success: false, error: formatApiError(data) };
}

export async function adminSaveSettings(payload) {
  await ensureCsrfToken();

  const body = {
    whatsappNumber: normalizeWhatsAppNumber(payload.whatsappNumber),
    whatsappPrefillMessage: (payload.whatsappPrefillMessage || '').trim() || DEFAULT_MSG,
  };

  if (!body.whatsappNumber || body.whatsappNumber.length < 10) {
    return {
      success: false,
      error: 'Enter a valid WhatsApp number (e.g. 03169636282 or 923169636282)',
    };
  }

  const { ok, data } = await apiFetch('/settings/admin', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (ok) return { success: true, settings: data.data };
  return { success: false, error: formatApiError(data) };
}
