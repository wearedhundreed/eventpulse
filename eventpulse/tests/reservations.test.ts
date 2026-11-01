import { describe, it, expect } from "vitest";
import {
  computeExpiry,
  isExpired,
  timeUntilExpiry,
  RESERVATION_TTL_MS,
} from "../src/worker/lib/reservations";

describe("Reservation expiration", () => {
  it("computes expiry 10 minutes from now", () => {
    const now = Date.now();
    const expiry = computeExpiry(now);
    const expiryTime = new Date(expiry).getTime();
    expect(expiryTime - now).toBe(RESERVATION_TTL_MS);
  });

  it("detects expired reservations", () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    expect(isExpired(pastExpiry)).toBe(true);
  });

  it("detects non-expired reservations", () => {
    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    expect(isExpired(futureExpiry)).toBe(false);
  });

  it("detects reservation at exact expiry boundary", () => {
    const now = Date.now();
    const expiry = new Date(now).toISOString();
    expect(isExpired(expiry, now)).toBe(true);
  });

  it("computes time until expiry", () => {
    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const remaining = timeUntilExpiry(futureExpiry);
    expect(remaining).toBeGreaterThan(4 * 60 * 1000);
    expect(remaining).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it("returns 0 for already-expired reservations", () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    expect(timeUntilExpiry(pastExpiry)).toBe(0);
  });

  it("reservation TTL is 10 minutes", () => {
    expect(RESERVATION_TTL_MS).toBe(10 * 60 * 1000);
  });
});
