// Server-authoritative pricing calculations.
// The browser NEVER sends price/total values — the server always recalculates
// from the database ticket_type.price and ticket_type.fees columns.

export interface LineItem {
  unitPrice: number;
  fees: number;
  quantity: number;
}

export interface Totals {
  subtotal: number;
  fees: number;
  taxes: number;
  total: number;
}

// Tax rate placeholder — in production this would be computed from
// the venue's jurisdiction. For now, 0% (clearly labeled as placeholder).
export const TAX_RATE = 0;

export function calculateLineTotal(item: LineItem): number {
  return round2((item.unitPrice + item.fees) * item.quantity);
}

export function calculateTotals(items: LineItem[]): Totals {
  let subtotal = 0;
  let fees = 0;

  for (const item of items) {
    subtotal += item.unitPrice * item.quantity;
    fees += item.fees * item.quantity;
  }

  subtotal = round2(subtotal);
  fees = round2(fees);
  const taxes = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + fees + taxes);

  return { subtotal, fees, taxes, total };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Validate that requested quantities are positive integers within available stock.
export function validateQuantity(
  requested: number,
  totalQuantity: number,
  soldQuantity: number,
  reservedQuantity: number
): { valid: boolean; reason?: string } {
  if (!Number.isInteger(requested) || requested <= 0) {
    return { valid: false, reason: "Quantity must be a positive integer." };
  }
  const available = totalQuantity - soldQuantity - reservedQuantity;
  if (requested > available) {
    return {
      valid: false,
      reason: `Only ${available} tickets available (requested ${requested}).`,
    };
  }
  // Max 10 per ticket type per cart to prevent hoarding.
  if (requested > 10) {
    return { valid: false, reason: "Maximum 10 tickets per type per order." };
  }
  return { valid: true };
}
