// Reservation lifecycle: hold duration, expiry, and cleanup.
// Reservations are temporary ticket holds that expire after RESERVATION_TTL_MS
// if the user abandons checkout. The cron trigger and a lazy expiry check
// on every cart access release abandoned reservations automatically.

export const RESERVATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function computeExpiry(now: number = Date.now()): string {
  return new Date(now + RESERVATION_TTL_MS).toISOString();
}

export function isExpired(expiresAt: string, now: number = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= now;
}

export function timeUntilExpiry(expiresAt: string, now: number = Date.now()): number {
  return Math.max(0, new Date(expiresAt).getTime() - now);
}
