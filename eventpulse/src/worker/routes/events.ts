// API routes: events, event sync
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import {
  getPublishedEvents,
  getEventById,
  getTicketTypesByEvent,
  getDistinctCities,
  getAllVenues,
  expireReservations,
} from "../db/queries";
import { syncEvents } from "../providers/sync";
import { rateLimit } from "../middleware";

const app = new Hono<{ Bindings: Env }>();

// GET /api/events — list/search events
app.get("/", rateLimit(100), async (c) => {
  // Lazy-expire reservations on every read
  await expireReservations(c.env.DB);

  const { search, city, category, venueId, dateFrom, dateTo, limit, offset } =
    c.req.query();

  const events = await getPublishedEvents(c.env.DB, {
    search,
    city,
    category,
    venueId,
    dateFrom,
    dateTo,
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
  });

  const rows = events.map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    imageUrl: e.image_url,
    startTime: e.start_time,
    endTime: e.end_time,
    timezone: e.timezone,
    venueName: e.venue_name,
    city: e.city,
    country: e.country,
    status: e.status,
    minPrice: e.min_price,
    maxPrice: e.max_price,
    availableTickets: e.available_tickets,
    featured: e.featured === 1,
    source: e.source,
    isDemo: e.source === "demo",
  }));

  return c.json({ events: rows, count: rows.length });
});

// GET /api/events/cities — distinct cities for the search filter
app.get("/cities", rateLimit(100), async (c) => {
  const cities = await getDistinctCities(c.env.DB);
  return c.json({ cities });
});

// GET /api/events/venues — all venues for the search filter
app.get("/venues", rateLimit(100), async (c) => {
  const venues = await getAllVenues(c.env.DB);
  return c.json({ venues });
});

// POST /api/events/sync — manually trigger an external event sync
app.post("/sync", rateLimit(5), async (c) => {
  const result = await syncEvents(c.env);
  return c.json(result);
});

// GET /api/events/:id — event detail with ticket types
app.get("/:id", rateLimit(100), async (c) => {
  const id = c.req.param("id");
  const event = await getEventById(c.env.DB, id);
  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }

  const ticketTypes = await getTicketTypesByEvent(c.env.DB, id);

  const detail = {
    id: (event as any).id,
    title: (event as any).title,
    description: (event as any).description,
    category: (event as any).category,
    imageUrl: (event as any).image_url,
    startTime: (event as any).start_time,
    endTime: (event as any).end_time,
    timezone: (event as any).timezone,
    status: (event as any).status,
    venueName: (event as any).venue_name,
    city: (event as any).city,
    country: (event as any).country,
    venueAddress: (event as any).venue_address,
    venueCapacity: (event as any).venue_capacity,
    organizerName: (event as any).organizer_name,
    minPrice: (event as any).min_price,
    maxPrice: (event as any).max_price,
    availableTickets: (event as any).available_tickets,
    featured: (event as any).featured === 1,
    source: (event as any).source,
    isDemo: (event as any).source === "demo",
    ticketTypes: ticketTypes.map((tt: any) => ({
      id: tt.id,
      eventId: tt.event_id,
      name: tt.name,
      description: tt.description,
      price: tt.price,
      fees: tt.fees,
      totalQuantity: tt.total_quantity,
      soldQuantity: tt.sold_quantity,
      reservedQuantity: tt.reserved_quantity,
      availableQuantity: tt.total_quantity - tt.sold_quantity - tt.reserved_quantity,
    })),
  };

  return c.json({ event: detail });
});

export default app;
