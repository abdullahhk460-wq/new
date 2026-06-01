export const STATUS_CYCLE = { pending: 'confirmed', confirmed: 'paid', paid: 'pending' };
export const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', paid: 'Paid' };
export const STATUS_STYLES = {
  paid: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
};

export function normalizeBookingStatus(status) {
  const key = String(status ?? 'pending').trim().toLowerCase();
  if (key === 'paid') return 'paid';
  if (key === 'confirmed') return 'confirmed';
  return 'pending';
}

export function isPaidStatus(status) {
  return normalizeBookingStatus(status) === 'paid';
}

export function isActiveMembershipStatus(status) {
  const s = normalizeBookingStatus(status);
  return s === 'paid' || s === 'confirmed';
}

export function statusDisplayLabel(status) {
  return STATUS_LABEL[normalizeBookingStatus(status)];
}
