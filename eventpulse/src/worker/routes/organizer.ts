// API routes: organizer dashboard (protected)
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import {
  getEventById,
  updateEventStatus,
  getTicketTypesByEvent,
  getAllOrders,
  nowUTC,
  uuid,
} from "../db/queries";
import { rateLimit, validateBody, isNonNegInt, isNonNegNum } from "../middleware";
import { verifyOrganizerToken } from "../lib/auth";

const app = new Hono<{ Bindings: Env }>();

// Organizer auth middleware
app.use("*", async (c, next) => {
  if (!verifyOrganizerToken(c, c.env.ORGANIZER_TOKEN)) {
    return c.json({ error: "Unauthorized. Organizer token required." }, 401);
  }
  await next();
});

// POST /api/organizer/events — create a new event
app.post("/events", rateLimit(30), async (c) => {
  const body = await c.req.json();
  const validation = validateBody<{
    title: string;
    category: string;
    venueId: string;
    organizerId: string;
    startTime: string;
    endTime: string;
    description?: string;
    imageUrl?: string;
    timezone?: string;
    featured?: boolean;
  }>(body, ["title", "category", "venueId", "organizerId", "startTime", "endTime"]);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  const data = validation.data!;
  const validCategories = ["concert", "sports", "theater", "festival", "conference", "nightlife"];
  if (!validCategories.includes(data.category)) {
    return c.json({ error: "Invalid category." }, 400);
  }

  // Validate dates
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return c.json({ error: "Invalid start/end times." }, 400);
  }

  const eventId = uuid();
  await c.env.DB
    .prepare(
      `INSERT INTO events
        (id, organizer_id, venue_id, title, description, category, image_url,
         start_time, end_time, timezone, status, source, featured, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', 'local', ?, 1)`
    )
    .bind(
      eventId,
      data.organizerId,
      data.venueId,
      data.title,
      data.description ?? null,
      data.category,
      data.imageUrl ?? null,
      data.startTime,
      data.endTime,
      data.timezone ?? "America/New_York",
      data.featured ? 1 : 0
    )
    .run();

  // Create ticket types if provided
  if (Array.isArray((body as any).ticketTypes)) {
    for (const tt of (body as any).ticketTypes) {
      if (!tt.name || !isNonNegNum(tt.price) || !isNonNegInt(tt.totalQuantity)) continue;
      await c.env.DB
        .prepare(
          `INSERT INTO ticket_types
            (id, event_id, name, description, price, fees, total_quantity, sale_start, sale_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          uuid(),
          eventId,
          tt.name,
          tt.description ?? null,
          tt.price,
          tt.fees ?? 0,
          tt.totalQuantity,
          tt.saleStart ?? null,
          tt.saleEnd ?? null
        )
        .run();
    }
  }

  return c.json({ eventId, message: "Event created." }, 201);
});

// PATCH /api/organizer/events/:id — update event (status, details)
app.patch("/events/:id", rateLimit(30), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const event = await getEventById(c.env.DB, id);
  if (!event) return c.json({ error: "Event not found." }, 404);

  const validStatuses = ["scheduled", "live", "ended", "cancelled", "postponed", "paused"];
  if (body.status && validStatuses.includes(body.status)) {
    await updateEventStatus(c.env.DB, id, body.status);
  }

  // Update other fields
  const updates: string[] = [];
  const params: any[] = [];
  const editable = ["title", "description", "category", "image_url", "start_time", "end_time", "timezone", "featured", "published"];
  for (const field of editable) {
    if (body[field] !== undefined) {
      const col = field === "imageUrl" ? "image_url" : field === "startTime" ? "start_time" : field === "endTime" ? "end_time" : field;
      updates.push(`${col} = ?`);
      params.push(body[field]);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    params.push(nowUTC(), id);
    await c.env.DB
      .prepare(`UPDATE events SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  return c.json({ message: "Event updated." });
});

// POST /api/organizer/ticket-types — add a ticket type to an event
app.post("/ticket-types", rateLimit(30), async (c) => {
  const body = await c.req.json();
  const validation = validateBody<{
    eventId: string;
    name: string;
    price: number;
    totalQuantity: number;
  }>(body, ["eventId", "name", "price", "totalQuantity"]);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  const data = validation.data!;
  if (!isNonNegNum(data.price) || !isNonNegInt(data.totalQuantity)) {
    return c.json({ error: "Invalid price or quantity." }, 400);
  }

  const event = await getEventById(c.env.DB, data.eventId);
  if (!event) return c.json({ error: "Event not found." }, 404);

  const ttId = uuid();
  await c.env.DB
    .prepare(
      `INSERT INTO ticket_types
        (id, event_id, name, description, price, fees, total_quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      ttId,
      data.eventId,
      data.name,
      (body as any).description ?? null,
      data.price,
      (body as any).fees ?? 0,
      data.totalQuantity
    )
    .run();

  return c.json({ ticketTypeId: ttId, message: "Ticket type created." }, 201);
});

// GET /api/organizer/orders — view all orders
app.get("/orders", rateLimit(30), async (c) => {
  const orders = await getAllOrders(c.env.DB, 200);
  return c.json({
    orders: orders.map((o: any) => ({
      id: o.id,
      status: o.status,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      total: o.total,
      currency: o.currency,
      createdAt: o.created_at,
    })),
  });
});

export default app;
