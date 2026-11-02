// EventPulse Worker — main entry point.
// Routes: /api/* → Hono API, /api/live/:eventId → WebSocket (DO), everything else → static assets.
// Scheduled: cron trigger syncs external events and refreshes statuses.

import { Hono } from "hono";
import type { Env } from "../../shared/types";
import { corsMiddleware, securityHeaders, rateLimit } from "./middleware";
import eventsRoutes from "./routes/events";
import cartRoutes from "./routes/cart";
import checkoutRoutes from "./routes/checkout";
import paymentsRoutes from "./routes/payments";
import ordersRoutes from "./routes/orders";
import ticketsRoutes from "./routes/tickets";
import organizerRoutes from "./routes/organizer";
import liveRoutes from "./routes/live";
import chatRoutes from "./routes/chat";
import { syncEvents } from "./providers/sync";
import { expireReservations } from "./db/queries";

// ── Export the Durable Object classes ─────────────────────────────
export { EventStatusDO } from "./do/EventStatusDO";
export { ChatRoomDO } from "./do/ChatRoomDO";

// ── Hono API app ─────────────────────────────────────────────────
const api = new Hono<{ Bindings: Env }>();

// Global middleware
api.use("*", corsMiddleware());
api.use("*", securityHeaders());

// Mount route groups
api.route("/api/events", eventsRoutes);
api.route("/api/cart", cartRoutes);
api.route("/api/checkout", checkoutRoutes);
api.route("/api/payments", paymentsRoutes);
api.route("/api/orders", ordersRoutes);
api.route("/api/tickets", ticketsRoutes);
api.route("/api/organizer", organizerRoutes);
api.route("/api/live", liveRoutes);
api.route("/api/chat", chatRoutes);

// Health check
api.get("/api/health", rateLimit(10), (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    stripeConfigured: !!c.env.STRIPE_SECRET_KEY && c.env.STRIPE_SECRET_KEY.startsWith("sk_"),
    eventsApiConfigured: !!c.env.EVENTS_API_BASE_URL && !!c.env.EVENTS_API_KEY,
  })
);

// ── Default export: Worker entry ──────────────────────────────────
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // API and WebSocket routes → Hono
    if (url.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }

    // Everything else → static assets (SPA)
    return env.ASSETS.fetch(request);
  },

  // ── Cron trigger: sync events + expire reservations ────────────
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        // Expire abandoned reservations
        await expireReservations(env.DB);

        // Sync external events
        try {
          const result = await syncEvents(env);
          console.log("Event sync:", JSON.stringify(result));
        } catch (err) {
          console.error("Event sync failed:", err);
        }

        // Auto-update event statuses based on time
        await refreshEventStatuses(env);
      })()
    );
  },
};

// ── Auto-refresh event statuses (scheduled → live → ended) ──────
async function refreshEventStatuses(env: Env): Promise<void> {
  const now = new Date().toISOString();

  // scheduled → live
  await env.DB
    .prepare(
      `UPDATE events SET status = 'live', updated_at = ?
       WHERE status = 'scheduled' AND start_time <= ? AND end_time > ?`
    )
    .bind(now, now, now)
    .run();

  // live → ended
  await env.DB
    .prepare(
      `UPDATE events SET status = 'ended', updated_at = ?
       WHERE status = 'live' AND end_time <= ?`
    )
    .bind(now, now)
    .run();
}
