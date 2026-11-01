// EventStatusDO — Durable Object for real-time event status.
// One DO instance per event (keyed by event ID).
// Handles WebSocket connections, broadcasts status/inventory updates,
// and runs a timer to auto-detect status transitions (scheduled → live → ended).

import type { Env } from "../../shared/types";

export class EventStatusDO implements DurableObject {
  state: DurableObjectState;
  env: Env;
  sessions: Map<WebSocket, string> = new Map();
  status: string = "scheduled";
  availableTickets: number = 0;
  eventId: string = "";
  timer: ReturnType<typeof setInterval> | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.eventId = state.id.name;
  }

  // ── WebSocket handler ──────────────────────────────────────────
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // Load current state from storage
    const stored = await this.state.storage.get<{
      status: string;
      availableTickets: number;
    }>("status");
    if (stored) {
      this.status = stored.status;
      this.availableTickets = stored.availableTickets;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sessions.set(server, this.eventId);

    // Send initial state immediately
    server.send(
      JSON.stringify({
        type: "status_update",
        eventId: this.eventId,
        status: this.status,
        availableTickets: this.availableTickets,
        timestamp: new Date().toISOString(),
      })
    );

    server.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "ping") {
          server.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    server.addEventListener("close", () => {
      this.sessions.delete(server);
    });

    server.addEventListener("error", () => {
      this.sessions.delete(server);
    });

    // Start the status-check timer if not already running
    this.ensureTimer();

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Broadcast a status update to all connected clients ─────────
  broadcast(status: string, availableTickets: number) {
    this.status = status;
    this.availableTickets = availableTickets;

    // Persist to storage
    this.state.storage.put("status", { status, availableTickets });

    const message = JSON.stringify({
      type: "status_update",
      eventId: this.eventId,
      status,
      availableTickets,
      timestamp: new Date().toISOString(),
    });

    for (const ws of this.sessions.keys()) {
      try {
        ws.send(message);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }

  // ── Periodic status check ──────────────────────────────────────
  // Runs every 30 seconds while there are active connections.
  // Queries the D1 database for the current event status and inventory.
  ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.checkEventStatus().catch(() => {});
    }, 30_000);
  }

  async checkEventStatus() {
    if (this.sessions.size === 0) {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      return;
    }

    try {
      const row = await this.env.DB
        .prepare(
          `SELECT status, available_tickets FROM events WHERE id = ?`
        )
        .bind(this.eventId)
        .first();

      if (row) {
        const newStatus = (row as any).status;
        const newAvail = (row as any).available_tickets;
        if (newStatus !== this.status || newAvail !== this.availableTickets) {
          this.broadcast(newStatus, newAvail);
        }
      }
    } catch {
      // DB might not be available in some contexts; ignore
    }
  }

  // ── Alarm handler (for scheduled status transitions) ──────────
  async alarm() {
    await this.checkEventStatus();
  }
}
