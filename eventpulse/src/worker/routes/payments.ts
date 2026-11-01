// API routes: Stripe webhook handler
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import {
  isWebhookProcessed,
  recordWebhookEvent,
  markOrderPaid,
  fulfillReservations,
  createTickets,
  getOrderItems,
} from "../db/queries";
import { verifyStripeWebhook } from "../lib/stripe";
import { rateLimit } from "../middleware";

const app = new Hono<{ Bindings: Env }>();

// POST /api/payments/webhook — Stripe webhook endpoint
// Verifies the signature, checks idempotency, and fulfills the order.
app.post("/webhook", rateLimit(200), async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("Stripe-Signature") || "";

  // Verify webhook signature
  const { verified, event } = await verifyStripeWebhook(
    rawBody,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET
  );

  if (!verified) {
    return c.json({ error: "Invalid webhook signature." }, 400);
  }

  const eventType = event?.type;
  const stripeEventId = event?.id;

  if (!stripeEventId) {
    return c.json({ error: "Missing event ID." }, 400);
  }

  // Idempotency check — prevent duplicate processing
  if (await isWebhookProcessed(c.env.DB, stripeEventId)) {
    return c.json({ received: true, duplicate: true });
  }

  // Record the webhook event
  await recordWebhookEvent(c.env.DB, stripeEventId, eventType, rawBody);

  // Only process checkout.session.completed events
  if (eventType !== "checkout.session.completed") {
    return c.json({ received: true, ignored: eventType });
  }

  const session = event?.data?.object;
  const orderId = session?.client_reference_id;
  const paymentIntentId = session?.payment_intent;
  const providerOrderId = session?.id;

  if (!orderId) {
    return c.json({ error: "Missing client_reference_id in webhook." }, 400);
  }

  // Verify the order exists and is still pending
  const order = await c.env.DB
    .prepare("SELECT * FROM orders WHERE id = ?")
    .bind(orderId)
    .first();

  if (!order) {
    return c.json({ error: "Order not found." }, 404);
  }

  if ((order as any).status === "paid") {
    // Already paid (duplicate webhook) — idempotent response
    return c.json({ received: true, alreadyPaid: true });
  }

  // Mark order as paid
  await markOrderPaid(c.env.DB, orderId, paymentIntentId, providerOrderId);

  // Fulfill reservations and create tickets
  const reservations = await c.env.DB
    .prepare(
      "SELECT id FROM ticket_reservations WHERE cart_id = ? AND status = 'active'"
    )
    .bind((order as any).cart_id)
    .all()
    .then((r) => r.results.map((r: any) => r.id));

  await fulfillReservations(c.env.DB, reservations);

  const orderItems = await getOrderItems(c.env.DB, orderId);
  await createTickets(c.env.DB, orderId, orderItems);

  // Mark cart as converted
  await c.env.DB
    .prepare("UPDATE carts SET status = 'converted' WHERE id = ?")
    .bind((order as any).cart_id)
    .run();

  return c.json({ received: true, orderId, status: "paid" });
});

export default app;
