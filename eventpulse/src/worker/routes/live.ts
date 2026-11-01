// API routes: live status (WebSocket upgrade to Durable Object)
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import { rateLimit } from "../middleware";

const app = new Hono<{ Bindings: Env }>();

// GET /api/live/:eventId — upgrade to WebSocket, routed to EventStatusDO
app.get("/:eventId", rateLimit(200), async (c) => {
  const eventId = c.req.param("eventId");
  const upgradeHeader = c.req.header("Upgrade");

  if (upgradeHeader !== "websocket") {
    // Fallback: return current status as JSON (for polling)
    const event = await c.env.DB
      .prepare("SELECT status, available_tickets, start_time, end_time FROM events WHERE id = ?")
      .bind(eventId)
      .first();

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    return c.json({
      eventId,
      status: (event as any).status,
      availableTickets: (event as any).available_tickets,
      startTime: (event as any).start_time,
      endTime: (event as any).end_time,
      timestamp: new Date().toISOString(),
    });
  }

  // Forward to the Durable Object for this event
  const id = c.env.EVENT_STATUS.idFrom(eventId);
  const stub = c.env.EVENT_STATUS.get(id);
  return stub.fetch(c.req.raw);
});

export default app;
