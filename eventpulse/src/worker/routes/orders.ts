// API routes: orders and tickets
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import {
  getOrdersBySession,
  getOrderItems,
} from "../db/queries";
import { rateLimit } from "../middleware";
import { getSessionId } from "../lib/auth";

const app = new Hono<{ Bindings: Env }>();

function sessionFromRequest(c: any): string {
  const header = c.req.header("X-Session-Id");
  if (header) return header;
  return getSessionId(c);
}

// GET /api/orders — list orders for the current session
app.get("/", rateLimit(60), async (c) => {
  const sessionId = sessionFromRequest(c);
  const orders = await getOrdersBySession(c.env.DB, sessionId);

  const result = [];
  for (const o of orders) {
    const items = await getOrderItems(c.env.DB, (o as any).id);
    const tickets = await getTicketsByOrder(c.env.DB, (o as any).id);
    result.push({
      id: (o as any).id,
      status: (o as any).status,
      customerName: (o as any).customer_name,
      customerEmail: (o as any).customer_email,
      subtotal: (o as any).subtotal,
      fees: (o as any).fees,
      taxes: (o as any).taxes,
      total: (o as any).total,
      currency: (o as any).currency,
      createdAt: (o as any).created_at,
      items: items.map((i: any) => ({
        id: i.id,
        ticketTypeName: i.ticket_type_name,
        unitPrice: i.unit_price,
        fees: i.fees,
        quantity: i.quantity,
        lineTotal: i.line_total,
        eventTitle: i.event_title,
        eventStartTime: i.event_start_time,
      })),
      tickets: tickets.map((t: any) => ({
        id: t.id,
        qrToken: t.qr_token,
        ticketTypeName: t.ticket_type_name,
        eventTitle: t.event_title,
        eventStartTime: t.event_start_time,
        eventVenue: t.event_venue,
        eventCity: t.event_city,
        status: t.status,
        seatInfo: t.seat_info,
      })),
    });
  }

  return c.json({ orders: result });
});

export default app;
