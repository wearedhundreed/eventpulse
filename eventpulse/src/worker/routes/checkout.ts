// API routes: checkout session creation
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import {
  getOrCreateCart,
  getCartItems,
  createOrder,
  createTickets,
  fulfillReservations,
  expireReservations,
  getOrderByCheckoutSessionId,
  markOrderPaid,
  getOrderItems,
  getTicketsByOrder,
} from "../db/queries";
import { calculateTotals } from "../lib/pricing";
import { isExpired } from "../lib/reservations";
import { isStripeConfigured, createCheckoutSession, createDemoCheckoutSession } from "../lib/stripe";
import { rateLimit, validateBody, isNonNegNum } from "../middleware";
import { getSessionId } from "../lib/auth";
import { uuid } from "../db/queries";

const app = new Hono<{ Bindings: Env }>();

function sessionFromRequest(c: any): string {
  const header = c.req.header("X-Session-Id");
  if (header) return header;
  return getSessionId(c);
}

// POST /api/checkout/session — create a checkout session
app.post("/session", rateLimit(20), async (c) => {
  await expireReservations(c.env.DB);

  const body = await c.req.json();
  const validation = validateBody<{
    customerName: string;
    customerEmail: string;
    attendeeDetails?: string;
  }>(body, ["customerName", "customerEmail"]);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  const { customerName, customerEmail, attendeeDetails } = validation.data!;

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return c.json({ error: "Invalid email address." }, 400);
  }

  const sessionId = sessionFromRequest(c);
  const cart = await getOrCreateCart(c.env.DB, sessionId);
  const cartId = (cart as any).id;
  const items = await getCartItems(c.env.DB, cartId);

  if (items.length === 0) {
    return c.json({ error: "Cart is empty." }, 400);
  }

  // Check for expired reservations
  for (const item of items) {
    if (isExpired((item as any).expires_at)) {
      return c.json({ error: "Some tickets in your cart have expired. Please refresh and try again." }, 409);
    }
  }

  // Server-side total calculation — never trust browser-sent totals
  const lineItems = items.map((i: any) => ({
    unitPrice: i.price,
    fees: i.fees,
    quantity: i.quantity,
  }));
  const totals = calculateTotals(lineItems);

  // Prevent duplicate orders — check if cart already has a pending order
  const existingOrder = await c.env.DB
    .prepare("SELECT id FROM orders WHERE cart_id = ? AND status = 'pending'")
    .bind(cartId)
    .first();
  if (existingOrder) {
    // Return the existing checkout URL
    const order = await getOrderByCheckoutSessionId(
      c.env.DB,
      (existingOrder as any).checkout_session_id
    );
    if (order) {
      const configured = isStripeConfigured(c.env.STRIPE_SECRET_KEY);
      if (configured) {
        // Re-fetch the Stripe session URL
        return c.json({ error: "You already have a pending checkout. Complete it or cancel." }, 409);
      } else {
        const demo = createDemoCheckoutSession(c.env.APP_BASE_URL || "http://localhost:8787", (existingOrder as any).id);
        return c.json({ checkoutUrl: demo.url, isDemo: true, orderId: (existingOrder as any).id });
      }
    }
  }

  const orderId = uuid();
  const checkoutSessionId = isStripeConfigured(c.env.STRIPE_SECRET_KEY)
    ? `stripe_pending_${orderId}` // will be replaced with real session ID
    : `demo_cs_${orderId}`;

  // Create the order record (status: pending)
  await createOrder(c.env.DB, {
    id: orderId,
    userId: null,
    cartId,
    sessionId,
    customerName,
    customerEmail,
    attendeeDetails: attendeeDetails ?? null,
    subtotal: totals.subtotal,
    fees: totals.fees,
    taxes: totals.taxes,
    total: totals.total,
    currency: "usd",
    checkoutSessionId,
  });

  // Insert order items
  for (const item of items) {
    await c.env.DB
      .prepare(
        `INSERT INTO order_items
         (id, order_id, ticket_type_id, event_id, ticket_type_name, unit_price, fees, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        uuid(),
        orderId,
        (item as any).ticket_type_id,
        (item as any).event_id,
        (item as any).ticket_type_name,
        (item as any).price,
        (item as any).fees,
        (item as any).quantity,
        round2(((item as any).price + (item as any).fees) * (item as any).quantity)
      )
      .run();
  }

  // Create Stripe Checkout Session or demo checkout
  if (isStripeConfigured(c.env.STRIPE_SECRET_KEY)) {
    try {
      const lineItemsForStripe = items.map((i: any) => ({
        name: `${(i as any).event_title} — ${(i as any).ticket_type_name}`,
        quantity: (i as any).quantity,
        unitAmount: (i as any).price + (i as any).fees,
      }));

      const baseUrl = c.env.APP_BASE_URL || "http://localhost:8787";
      const session = await createCheckoutSession(c.env.STRIPE_SECRET_KEY, {
        orderId,
        lineItems: lineItemsForStripe,
        successUrl: `${baseUrl}/checkout/confirm?order=${orderId}`,
        cancelUrl: `${baseUrl}/cart`,
        customerEmail,
      });

      if (session) {
        // Update order with real Stripe session ID
        await c.env.DB
          .prepare("UPDATE orders SET checkout_session_id = ? WHERE id = ?")
          .bind(session.sessionId, orderId)
          .run();

        return c.json({
          checkoutUrl: session.url,
          isDemo: false,
          orderId,
        });
      }
    } catch (err: any) {
      return c.json({ error: `Payment provider error: ${err.message}` }, 502);
    }
  }

  // Demo mode — no real Stripe key configured
  const baseUrl = c.env.APP_BASE_URL || "http://localhost:8787";
  const demo = createDemoCheckoutSession(baseUrl, orderId);
  await c.env.DB
    .prepare("UPDATE orders SET checkout_session_id = ? WHERE id = ?")
    .bind(demo.sessionId, orderId)
    .run();

  return c.json({
    checkoutUrl: demo.url,
    isDemo: true,
    orderId,
    message:
      "Demo mode: Stripe is not configured. No real payment will be processed. Set STRIPE_SECRET_KEY to enable real checkout.",
  });
});

// GET /api/checkout/confirm — confirm a demo checkout (no Stripe)
// In production, this is handled by the Stripe webhook.
app.get("/confirm", rateLimit(20), async (c) => {
  const orderId = c.req.query("order");
  if (!orderId) return c.json({ error: "Missing order ID." }, 400);

  const order = await c.env.DB
    .prepare("SELECT * FROM orders WHERE id = ?")
    .bind(orderId)
    .first();
  if (!order) return c.json({ error: "Order not found." }, 404);

  if ((order as any).status === "pending") {
    // In demo mode, mark as paid and issue tickets
    await markOrderPaid(c.env.DB, orderId, "demo_payment_intent", "demo_provider_order");

    // Fulfill reservations and create tickets
    const reservations = await c.env.DB
      .prepare("SELECT id FROM ticket_reservations WHERE cart_id = ? AND status = 'active'")
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
  }

  return c.json({ orderId, status: "paid", isDemo: true });
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default app;
