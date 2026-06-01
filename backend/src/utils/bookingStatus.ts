export const BOOKING_STATUSES = ['pending', 'confirmed', 'paid'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Normalize legacy/mixed-case status values from Supabase. */
export function normalizeBookingStatus(status: string | null | undefined): BookingStatus {
  const key = String(status ?? 'pending').trim().toLowerCase();
  if (key === 'paid') return 'paid';
  if (key === 'confirmed') return 'confirmed';
  return 'pending';
}

export function isValidBookingStatus(status: string): status is BookingStatus {
  return BOOKING_STATUSES.includes(status as BookingStatus);
}
