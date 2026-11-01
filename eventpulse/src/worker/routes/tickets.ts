// API routes: tickets (paid tickets for the current session)
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import { getOrdersBySession, getTicketsByOrder } from "../db/queries";
import { rateLimit } from "../middleware";
import { getSessionId } from "../lib/auth";

const app = new Hono<{ Bindings: Env }>();

function sessionFromRequest(c: any): string {
  const header = c.req.header("X-Session-Id");
  if (header) return header;
  return getSessionId(c);
}

// GET /api/tickets — list tickets for the current session (paid only)
app.get("/", rateLimit(60), async (c) => {
  const sessionId = sessionFromRequest(c);
  const orders = await getOrdersBySession(c.env.DB, sessionId);

  const tickets = [];
  for (const o of orders) {
    if ((o as any).status !== "paid") continue;
    const orderTickets = await getTicketsByOrder(c.env.DB, (o as any).id);
    for (const t of orderTickets) {
      tickets.push({
        id: (t as any).id,
        orderId: (o as any).id,
        qrToken: (t as any).qr_token,
        ticketTypeName: (t as any).ticket_type_name,
        eventTitle: (t as any).event_title,
        eventStartTime: (t as any).event_start_time,
        eventVenue: (t as any).event_venue,
        eventCity: (t as any).event_city,
        status: (t as any).status,
        seatInfo: (t as any).seat_info,
      });
    }
  }

  return c.json({ tickets });
});

export default app;
