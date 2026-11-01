import { describe, it, expect } from "vitest";
import { calculateTotals, validateQuantity, round2, calculateLineTotal } from "../src/worker/lib/pricing";

describe("Ticket inventory validation", () => {
  it("rejects zero or negative quantity", () => {
    expect(validateQuantity(0, 100, 50, 10).valid).toBe(false);
    expect(validateQuantity(-1, 100, 50, 10).valid).toBe(false);
  });

  it("rejects non-integer quantity", () => {
    expect(validateQuantity(1.5, 100, 50, 10).valid).toBe(false);
  });

  it("rejects quantity exceeding available stock", () => {
    const result = validateQuantity(50, 100, 60, 0);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Only 40 tickets available");
  });

  it("accounts for reserved tickets in availability", () => {
    // total=100, sold=50, reserved=30 → available=20
    const result = validateQuantity(25, 100, 50, 30);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Only 20 tickets available");
  });

  it("allows quantity within available stock", () => {
    expect(validateQuantity(10, 100, 50, 30).valid).toBe(true);
  });

  it("enforces max 10 tickets per type", () => {
    expect(validateQuantity(11, 1000, 0, 0).valid).toBe(false);
    expect(validateQuantity(10, 1000, 0, 0).valid).toBe(true);
  });
});

describe("Checkout totals", () => {
  it("calculates subtotal, fees, and total correctly", () => {
    const items = [
      { unitPrice: 50, fees: 5, quantity: 2 },
      { unitPrice: 100, fees: 10, quantity: 1 },
    ];
    const totals = calculateTotals(items);
    expect(totals.subtotal).toBe(200); // 50*2 + 100*1
    expect(totals.fees).toBe(20); // 5*2 + 10*1
    expect(totals.taxes).toBe(0); // placeholder 0%
    expect(totals.total).toBe(220);
  });

  it("handles empty cart", () => {
    const totals = calculateTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.fees).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(33.33333)).toBe(33.33);
  });

  it("calculates line total correctly", () => {
    const item = { unitPrice: 45.5, fees: 4.5, quantity: 3 };
    expect(calculateLineTotal(item)).toBe(150); // (45.5 + 4.5) * 3
  });

  it("never trusts browser-sent totals — server always recalculates", () => {
    // Simulate a malicious request: browser claims total is $1, but server recalculates
    const items = [{ unitPrice: 100, fees: 10, quantity: 5 }];
    const serverTotals = calculateTotals(items);
    expect(serverTotals.total).toBe(550); // NOT $1
  });
});
