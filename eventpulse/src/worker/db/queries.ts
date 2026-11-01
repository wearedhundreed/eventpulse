import type { D1Database } from "@cloudflare/workers-types";

// ── Helpers ──────────────────────────────────────────────────────
export function uuid(): string {
  return crypto.randomUUID();
}

export function nowUTC(): string {
  return new Date().toISOString();
}

// ── Event queries ────────────────────────────────────────────────

export async function getPublishedEvents(
  db: D1Database,
  opts: {
    search?: string;
    city?: string;
    category?: string;
    venueId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  const conditions = ["e.published = 1"];
  const params: any[] = [];

  if (opts.search) {
    conditions.push("(e.title LIKE ? OR e.description LIKE ?)");
    const term = `%${opts.search}%`;
    params.push(term, term);
  }
  if (opts.city) {
    conditions.push("v.city = ?");
    params.push(opts.city);
  }
  if (opts.category) {
    conditions.push("e.category = ?");
    params.push(opts.category);
  }
  if (opts.venueId) {
    conditions.push("e.venue_id = ?");
    params.push(opts.venueId);
  }
  if (opts.dateFrom) {
    conditions.push("e.start_time >= ?");
    params.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    conditions.push("e.start_time <= ?");
    params.push(opts.dateTo);
  }

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const where = conditions.join(" AND ");

  const sql = `
    SELECT e.*, v.name AS venue_name, v.city, v.country, v.address AS venue_address,
           v.capacity AS venue_capacity
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE ${where}
    ORDER BY e.featured DESC, e.start_time ASC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  return db.prepare(sql).bind(...params).all().then((r) => r.results);
}

export async function getEventById(db: D1Database, id: string): Promise<any | null> {
  const row = await db
    .prepare(
      `SELECT e.*, v.name AS venue_name, v.city, v.country, v.address AS venue_address,
              v.capacity AS venue_capacity, o.name AS organizer_name
       FROM events e
       LEFT JOIN venues v ON e.venue_id = v.id
       LEFT JOIN organizers o ON e.organizer_id = o.id
       WHERE e.id = ?`
    )
    .bind(id)
    .first();
  return row ?? null;
}

export async function getTicketTypesByEvent(db: D1Database, eventId: string): Promise<any[]> {
  return db
    .prepare("SELECT * FROM ticket_types WHERE event_id = ? ORDER BY price ASC")
    .bind(eventId)
    .all()
    .then((r) => r.results);
}

export async function getTicketTypeById(db: D1Database, id: string): Promise<any | null> {
  return db.prepare("SELECT * FROM ticket_types WHERE id = ?").bind(id).first();
}

export async function updateEventStatus(
  db: D1Database,
  eventId: string,
  status: string
): Promise<void> {
  await db
    .prepare("UPDATE events SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, nowUTC(), eventId)
    .run();
  await logEventUpdate(db, eventId, "status_change", { status });
}

export async function logEventUpdate(
  db: D1Database,
  eventId: string,
  updateType: string,
  payload: any
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO event_updates (id, event_id, update_type, payload) VALUES (?, ?, ?, ?)"
    )
    .bind(uuid(), eventId, updateType, JSON.stringify(payload))
    .run();
}

// ── Reservation queries ──────────────────────────────────────────

export async function createReservation(
  db: D1Database,
  ticketTypeId: string,
  eventId: string,
  quantity: number,
  expiresAt: string,
  cartId?: string
): Promise<string> {
  const id = uuid();
  await db
    .prepare(
      `INSERT INTO ticket_reservations (id, ticket_type_id, event_id, cart_id, quantity, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`
    )
    .bind(id, ticketTypeId, eventId, cartId ?? null, quantity, expiresAt)
    .run();

  await db
    .prepare(
      "UPDATE ticket_types SET reserved_quantity = reserved_quantity + ?, updated_at = ? WHERE id = ?"
    )
    .bind(quantity, nowUTC(), ticketTypeId)
    .run();

  await logEventUpdate(db, eventId, "inventory_change", { ticketTypeId, quantity, action: "reserve" });
  return id;
}

export async function releaseReservation(db: D1Database, reservationId: string): Promise<void> {
  const res = await db
    .prepare("SELECT * FROM ticket_reservations WHERE id = ? AND status = 'active'")
    .bind(reservationId)
    .first();
  if (!res) return;

  await db
    .prepare(
      "UPDATE ticket_reservations SET status = 'released', updated_at = ? WHERE id = ?"
    )
    .bind(nowUTC(), reservationId)
    .run();

  await db
    .prepare(
      "UPDATE ticket_types SET reserved_quantity = MAX(0, reserved_quantity - ?), updated_at = ? WHERE id = ?"
    )
    .bind((res as any).quantity, nowUTC(), (res as any).ticket_type_id)
    .run();

  await logEventUpdate(
    db,
    (res as any).event_id,
    "reservation_expired",
    { reservationId }
  );
}

export async function expireReservations(db: D1Database): Promise<number> {
  const expired = await db
    .prepare(
      "SELECT id, ticket_type_id, event_id, quantity FROM ticket_reservations WHERE status = 'active' AND expires_at <= ?"
    )
    .bind(nowUTC())
    .all()
    .then((r) => r.results);

  for (const res of expired) {
    await releaseReservation(db, (res as any).id);
  }
  return expired.length;
}

export async function fulfillReservations(
  db: D1Database,
  reservationIds: string[]
): Promise<void> {
  for (const id of reservationIds) {
    const res = await db
      .prepare("SELECT * FROM ticket_reservations WHERE id = ?")
      .bind(id)
      .first();
    if (!res) continue;

    await db
      .prepare(
        "UPDATE ticket_reservations SET status = 'fulfilled', updated_at = ? WHERE id = ?"
      )
      .bind(nowUTC(), id)
      .run();

    await db
      .prepare(
        "UPDATE ticket_types SET sold_quantity = sold_quantity + ?, reserved_quantity = MAX(0, reserved_quantity - ?), updated_at = ? WHERE id = ?"
      )
      .bind((res as any).quantity, (res as any).quantity, nowUTC(), (res as any).ticket_type_id)
      .run();
  }
}

// ── Cart queries ─────────────────────────────────────────────────

export async function getOrCreateCart(
  db: D1Database,
  sessionId: string,
  userId?: string | null
): Promise<any> {
  let cart = await db
    .prepare("SELECT * FROM carts WHERE session_id = ? AND status = 'active'")
    .bind(sessionId)
    .first();

  if (!cart) {
    const id = uuid();
    await db
      .prepare(
        "INSERT INTO carts (id, user_id, session_id, status) VALUES (?, ?, ?, 'active')"
      )
      .bind(id, userId ?? null, sessionId)
      .run();
    cart = await db.prepare("SELECT * FROM carts WHERE id = ?").bind(id).first();
  }
  return cart;
}

export async function getCartItems(
  db: D1Database,
  cartId: string
): Promise<any[]> {
  return db
    .prepare(
      `SELECT r.*, tt.name AS ticket_type_name, tt.price, tt.fees,
              e.title AS event_title, e.id AS event_id
       FROM ticket_reservations r
       JOIN ticket_types tt ON r.ticket_type_id = tt.id
       JOIN events e ON r.event_id = e.id
       WHERE r.cart_id = ? AND r.status = 'active'`
    )
    .bind(cartId)
    .all()
    .then((r) => r.results);
}

// ── Order queries ────────────────────────────────────────────────

export async function createOrder(
  db: D1Database,
  data: {
    id: string;
    userId: string | null;
    cartId: string;
    sessionId: string;
    customerName: string;
    customerEmail: string;
    attendeeDetails: string | null;
    subtotal: number;
    fees: number;
    taxes: number;
    total: number;
    currency: string;
    checkoutSessionId: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO orders
       (id, user_id, cart_id, session_id, customer_name, customer_email,
        attendee_details, subtotal, fees, taxes, total, currency, status,
        payment_provider, checkout_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'stripe', ?)`
    )
    .bind(
      data.id,
      data.userId,
      data.cartId,
      data.sessionId,
      data.customerName,
      data.customerEmail,
      data.attendeeDetails,
      data.subtotal,
      data.fees,
      data.taxes,
      data.total,
      data.currency,
      data.checkoutSessionId
    )
    .run();
}

export async function markOrderPaid(
  db: D1Database,
  orderId: string,
  paymentIntentId: string,
  providerOrderId: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE orders SET status = 'paid', payment_intent_id = ?, provider_order_id = ?,
       updated_at = ? WHERE id = ? AND status = 'pending'`
    )
    .bind(paymentIntentId, providerOrderId, nowUTC(), orderId)
    .run();
}

export async function getOrderByCheckoutSessionId(
  db: D1Database,
  checkoutSessionId: string
): Promise<any | null> {
  return db
    .prepare("SELECT * FROM orders WHERE checkout_session_id = ?")
    .bind(checkoutSessionId)
    .first();
}

export async function getOrdersBySession(db: D1Database, sessionId: string): Promise<any[]> {
  return db
    .prepare(
      `SELECT DISTINCT o.* FROM orders o WHERE o.session_id = ? ORDER BY o.created_at DESC`
    )
    .bind(sessionId)
    .all()
    .then((r) => r.results);
}

export async function getOrdersByUser(db: D1Database, userId: string): Promise<any[]> {
  return db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all()
    .then((r) => r.results);
}

export async function getOrderItems(db: D1Database, orderId: string): Promise<any[]> {
  return db
    .prepare(
      `SELECT oi.*, e.title AS event_title, e.start_time AS event_start_time
       FROM order_items oi
       JOIN events e ON oi.event_id = e.id
       WHERE oi.order_id = ?`
    )
    .bind(orderId)
    .all()
    .then((r) => r.results);
}

export async function getTicketsByOrder(db: D1Database, orderId: string): Promise<any[]> {
  return db
    .prepare(
      `SELECT t.*, e.title AS event_title, e.start_time AS event_start_time,
              v.name AS event_venue, v.city AS event_city
       FROM tickets t
       JOIN events e ON t.event_id = e.id
       LEFT JOIN venues v ON e.venue_id = v.id
       WHERE t.order_id = ?`
    )
    .bind(orderId)
    .all()
    .then((r) => r.results);
}

export async function getAllOrders(db: D1Database, limit = 100): Promise<any[]> {
  return db
    .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all()
    .then((r) => r.results);
}

// ── Ticket creation ──────────────────────────────────────────────

export async function createTickets(
  db: D1Database,
  orderId: string,
  items: any[]
): Promise<void> {
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      const ticketId = uuid();
      const qrToken = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO tickets
           (id, order_id, order_item_id, event_id, ticket_type_id, ticket_type_name, seat_info, qr_token, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'issued')`
        )
        .bind(
          ticketId,
          orderId,
          item.id,
          item.event_id,
          item.ticket_type_id,
          item.ticket_type_name,
          null,
          qrToken
        )
        .run();
    }
  }
}

// ── Webhook idempotency ──────────────────────────────────────────

export async function isWebhookProcessed(db: D1Database, eventId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT processed FROM webhook_events WHERE id = ?")
    .bind(eventId)
    .first();
  return row ? (row as any).processed === 1 : false;
}

export async function recordWebhookEvent(
  db: D1Database,
  eventId: string,
  eventType: string,
  payload: string
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO webhook_events (id, provider, event_type, payload, processed)
       VALUES (?, 'stripe', ?, ?, 1)`
    )
    .bind(eventId, eventType, payload)
    .run();
}

// ── Venue queries ────────────────────────────────────────────────

export async function getAllVenues(db: D1Database): Promise<any[]> {
  return db.prepare("SELECT * FROM venues ORDER BY city, name").all().then((r) => r.results);
}

export async function getDistinctCities(db: D1Database): Promise<string[]> {
  const rows = await db
    .prepare("SELECT DISTINCT city FROM venues ORDER BY city")
    .all()
    .then((r) => r.results);
  return rows.map((r) => (r as any).city as string);
}
