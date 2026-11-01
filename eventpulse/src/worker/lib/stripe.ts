// Stripe integration — server-side only.
// This module creates Stripe Checkout Sessions and verifies webhook signatures.
// The Stripe secret key is NEVER exposed to the browser.
//
// In production, set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET as Worker secrets:
//   wrangler secret put STRIPE_SECRET_KEY
//   wrangler secret put STRIPE_WEBHOOK_SECRET
//
// If no Stripe key is configured, checkout falls back to a demo mode that
// simulates the payment flow without real charges.

import type { CheckoutTotals } from "../types";

const STRIPE_API = "https://api.stripe.com/v1";

export function isStripeConfigured(secretKey: string | undefined): boolean {
  return !!secretKey && secretKey.startsWith("sk_");
}

// ── Create a Stripe Checkout Session ────────────────────────────
export async function createCheckoutSession(
  secretKey: string,
  params: {
    orderId: string;
    lineItems: { name: string; quantity: number; unitAmount: number }[];
    successUrl: string;
    cancelUrl: string;
    customerEmail: string;
  }
): Promise<{ sessionId: string; url: string } | null> {
  if (!isStripeConfigured(secretKey)) return null;

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", params.successUrl);
  body.set("cancel_url", params.cancelUrl);
  body.set("customer_email", params.customerEmail);
  body.set("client_reference_id", params.orderId);
  body.set("payment_method_types[0]", "card");

  params.lineItems.forEach((item, i) => {
    body.set(`line_items[${i}][quantity]`, String(item.quantity));
    body.set(`line_items[${i}][price_data][currency]`, "usd");
    body.set(
      `line_items[${i}][price_data][unit_amount]`,
      String(Math.round(item.unitAmount * 100))
    );
    body.set(`line_items[${i}][price_data][product_data][name]`, item.name);
  });

  const resp = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Stripe API error: ${resp.status} ${text}`);
  }

  const data: any = await resp.json();
  return { sessionId: data.id, url: data.url };
}

// ── Verify Stripe webhook signature ────────────────────────────
// Uses Stripe's standard HMAC-SHA256 signature verification.
export async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string
): Promise<{ verified: boolean; event: any | null }> {
  if (!secret) return { verified: false, event: null };

  try {
    const parts = signature.split(",");
    const sigMap: Record<string, string> = {};
    for (const part of parts) {
      const [k, v] = part.split("=");
      sigMap[k.trim()] = v.trim();
    }

    const timestamp = sigMap["t"];
    const signatures = sigMap["v1"];
    if (!timestamp || !signatures) return { verified: false, event: null };

    // Check timestamp freshness (5 min tolerance)
    const ageMs = Date.now() - parseInt(timestamp) * 1000;
    if (ageMs > 5 * 60 * 1000 || ageMs < -5 * 60 * 1000) {
      return { verified: false, event: null };
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const receivedSigs = signatures.split(" ");
    const verified = receivedSigs.includes(expectedSig);
    if (!verified) return { verified: false, event: null };

    const event = JSON.parse(payload);
    return { verified: true, event };
  } catch {
    return { verified: false, event: null };
  }
}

// ── Demo checkout (no real Stripe key) ──────────────────────────
// Simulates a checkout session URL for local/demo use.
export function createDemoCheckoutSession(
  baseUrl: string,
  orderId: string
): { sessionId: string; url: string } {
  const sessionId = `demo_cs_${orderId}`;
  const url = `${baseUrl}/checkout/confirm?order=${orderId}&demo=1`;
  return { sessionId, url };
}
