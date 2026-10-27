export const WEBSITE_BOOKING_PREFIX = '[Website]';

export function isWebsiteBooking(reason?: string | null) {
  return String(reason ?? '').startsWith(WEBSITE_BOOKING_PREFIX);
}

export function formatWebsiteReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) return WEBSITE_BOOKING_PREFIX;
  return isWebsiteBooking(trimmed) ? trimmed : `${WEBSITE_BOOKING_PREFIX} ${trimmed}`;
}

export function displayAppointmentReason(reason?: string | null) {
  const text = String(reason ?? '').trim();
  if (!isWebsiteBooking(text)) return text;
  return text.slice(WEBSITE_BOOKING_PREFIX.length).trim();
}
