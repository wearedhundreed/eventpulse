// API routes: cart management
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import {
  getOrCreateCart,
  getCartItems,
  createReservation,
  releaseReservation,
  getTicketTypeById,
  expireReservations,
} from "../db/queries";
import { calculateTotals, validateQuantity } from "../lib/pricing";
import { computeExpiry, isExpired } from "../lib/reservations";
import { rateLimit, validateBody, isPositiveInt } from "../middleware";
import { getSessionId } from "../lib/auth";

const app = new Hono<{ Bindings: Env }>();

// Helper: get session ID from request
function sessionFromRequest(c: any): string {
  const header = c.req.header("X-Session-Id");
  if (header) return header;
  return getSessionId(c);
}

// Helper: build cart DTO from cart items
async function buildCartDTO(env: Env, sessionId: string) {
  await expireReservations(env.DB);
  const cart = await getOrCreateCart(env.DB, sessionId);
  const items = await getCartItems(env.DB, (cart as any).id);

  const lineItems = items.map((i: any) => ({
    unitPrice: i.price,
    fees: i.fees,
    quantity: i.quantity,
  }));

  const totals = calculateTotals(lineItems);

  const cartItems = items.map((i: any) => ({
    ticketTypeId: i.ticket_type_id,
    eventId: i.event_id,
    eventTitle: i.event_title,
    ticketTypeName: i.ticket_type_name,
    unitPrice: i.price,
    fees: i.fees,
    quantity: i.quantity,
    lineTotal: round2((i.price + i.fees) * i.quantity),
    reservationId: i.id,
    reservationExpiresAt: i.expires_at,
  }));

  return {
    id: (cart as any).id,
    sessionId,
    items: cartItems,
    subtotal: totals.subtotal,
    fees: totals.fees,
    taxes: totals.taxes,
    total: totals.total,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// POST /api/cart — add tickets to cart (creates a reservation)
app.post("/", rateLimit(60), async (c) => {
  const body = await c.req.json();
  const validation = validateBody<{ ticketTypeId: string; quantity: number }>(body, [
    "ticketTypeId",
    "quantity",
  ]);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  const { ticketTypeId, quantity } = validation.data!;
  if (!isPositiveInt(quantity)) {
    return c.json({ error: "Quantity must be a positive integer." }, 400);
  }

  const tt = await getTicketTypeById(c.env.DB, ticketTypeId);
  if (!tt) {
    return c.json({ error: "Ticket type not found." }, 404);
  }

  // Validate availability (server-side — never trust browser values)
  const check = validateQuantity(
    quantity,
    (tt as any).total_quantity,
    (tt as any).sold_quantity,
    (tt as any).reserved_quantity
  );
  if (!check.valid) {
    return c.json({ error: check.reason }, 409);
  }

  const sessionId = sessionFromRequest(c);
  const cart = await getOrCreateCart(c.env.DB, sessionId);
  const cartId = (cart as any).id;

  // Check if there's already a reservation for this ticket type in this cart
  const existing = await c.env.DB
    .prepare(
      "SELECT * FROM ticket_reservations WHERE ticket_type_id = ? AND cart_id = ? AND status = 'active'"
    )
    .bind(ticketTypeId, cartId)
    .first();

  if (existing) {
    // Update quantity — re-validate
    const newQty = (existing as any).quantity + quantity;
    const updateCheck = validateQuantity(
      newQty,
      (tt as any).total_quantity,
      (tt as any).sold_quantity,
      (tt as any).reserved_quantity - (existing as any).quantity // don't double-count existing reservation
    );
    if (!updateCheck.valid) {
      return c.json({ error: updateCheck.reason }, 409);
    }
    // Release old reservation and create new one with combined quantity
    await releaseReservation(c.env.DB, (existing as any).id);
  }

  const reservationId = await createReservation(
    c.env.DB,
    ticketTypeId,
    (tt as any).event_id,
    quantity,
    computeExpiry(),
    cartId
  );

  const cartDTO = await buildCartDTO(c.env, sessionId);
  return c.json({ cart: cartDTO, reservationId }, 201);
});

// PATCH /api/cart/:reservationId — update quantity
app.patch("/:id", rateLimit(60), async (c) => {
  const reservationId = c.req.param("id");
  const body = await c.req.json();
  const validation = validateBody<{ quantity: number }>(body, ["quantity"]);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  const { quantity } = validation.data!;
  if (!isPositiveInt(quantity)) {
    return c.json({ error: "Quantity must be a positive integer." }, 400);
  }

  const res = await c.env.DB
    .prepare("SELECT * FROM ticket_reservations WHERE id = ? AND status = 'active'")
    .bind(reservationId)
    .first();
  if (!res) {
    return c.json({ error: "Reservation not found or expired." }, 404);
  }

  if (isExpired((res as any).expires_at)) {
    await releaseReservation(c.env.DB, reservationId);
    return c.json({ error: "Reservation expired." }, 410);
  }

  const tt = await getTicketTypeById(c.env.DB, (res as any).ticket_type_id);
  if (!tt) return c.json({ error: "Ticket type not found." }, 404);

  const oldQty = (res as any).quantity;
  const check = validateQuantity(
    quantity,
    (tt as any).total_quantity,
    (tt as any).sold_quantity,
    (tt as any).reserved_quantity - oldQty // exclude current reservation
  );
  if (!check.valid) {
    return c.json({ error: check.reason }, 409);
  }

  // Update reservation quantity and adjust reserved count
  await c.env.DB
    .prepare(
      "UPDATE ticket_reservations SET quantity = ?, expires_at = ?, updated_at = ? WHERE id = ?"
    )
    .bind(quantity, computeExpiry(), new Date().toISOString(), reservationId)
    .run();

  const diff = quantity - oldQty;
  await c.env.DB
    .prepare(
      "UPDATE ticket_types SET reserved_quantity = MAX(0, reserved_quantity + ?), updated_at = ? WHERE id = ?"
    )
    .bind(diff, new Date().toISOString(), (tt as any).id)
    .run();

  const sessionId = sessionFromRequest(c);
  const cartDTO = await buildCartDTO(c.env, sessionId);
  return c.json({ cart: cartDTO });
});

// DELETE /api/cart/:reservationId — remove a reservation from cart
app.delete("/:id", rateLimit(60), async (c) => {
  const reservationId = c.req.param("id");
  await releaseReservation(c.env.DB, reservationId);
  const sessionId = sessionFromRequest(c);
  const cartDTO = await buildCartDTO(c.env, sessionId);
  return c.json({ cart: cartDTO });
});

// GET /api/cart — get current cart
app.get("/", rateLimit(60), async (c) => {
  const sessionId = sessionFromRequest(c);
  const cartDTO = await buildCartDTO(c.env, sessionId);
  return c.json({ cart: cartDTO });
});

export default app;
