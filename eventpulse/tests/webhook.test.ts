import { describe, it, expect } from "vitest";
import { verifyStripeWebhook } from "../src/worker/lib/stripe";

describe("Webhook verification", () => {
  it("rejects empty signature", async () => {
    const result = await verifyStripeWebhook("{}", "", "whsec_test");
    expect(result.verified).toBe(false);
  });

  it("rejects missing webhook secret", async () => {
    const result = await verifyStripeWebhook("{}", "t=123,v1=abc", "");
    expect(result.verified).toBe(false);
  });

  it("rejects signature with missing timestamp", async () => {
    const result = await verifyStripeWebhook("{}", "v1=abc", "whsec_test");
    expect(result.verified).toBe(false);
  });

  it("rejects signature with missing v1", async () => {
    const result = await verifyStripeWebhook("{}", "t=123", "whsec_test");
    expect(result.verified).toBe(false);
  });

  it("rejects stale timestamps (older than 5 minutes)", async () => {
    const oldTimestamp = Math.floor((Date.now() - 6 * 60 * 1000) / 1000);
    const result = await verifyStripeWebhook(
      "{}",
      `t=${oldTimestamp},v1=abc`,
      "whsec_test"
    );
    expect(result.verified).toBe(false);
  });

  it("rejects invalid HMAC signature", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await verifyStripeWebhook(
      '{"test": true}',
      `t=${timestamp},v1=invalid_signature`,
      "whsec_test_secret"
    );
    expect(result.verified).toBe(false);
  });

  it("accepts valid HMAC signature", async () => {
    const secret = "whsec_test_secret";
    const payload = '{"id":"evt_123","type":"checkout.session.completed"}';
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;

    // Compute the correct HMAC
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

    const result = await verifyStripeWebhook(
      payload,
      `t=${timestamp},v1=${expectedSig}`,
      secret
    );

    expect(result.verified).toBe(true);
    expect(result.event).toBeTruthy();
    expect(result.event.type).toBe("checkout.session.completed");
  });
});
