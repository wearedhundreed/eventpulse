// ChatRoomDO — Durable Object for real-time chat between visitors and admin.
// Uses the traditional WebSocket pattern for compatibility with wrangler 3.x.
// One DO instance per chat session (keyed by session ID).

import type { Env } from "../../shared/types";

export class ChatRoomDO implements DurableObject {
  state: DurableObjectState;
  env: Env;
  sessions: Map<WebSocket, string> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      // Handle internal broadcast requests (from admin reply API)
      if (request.method === "POST") {
        try {
          const body = await request.json();
          const broadcast = JSON.stringify({
            type: "chat_message",
            id: body.id,
            sessionId: body.sessionId,
            sender: body.sender,
            message: body.message,
            isAdmin: body.isAdmin,
            timestamp: body.timestamp || new Date().toISOString(),
          });
          for (const ws of this.sessions.keys()) {
            try {
              ws.send(broadcast);
            } catch {}
          }
          return new Response("OK");
        } catch {
          return new Response("Bad request", { status: 400 });
        }
      }
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sessions.set(server, "connected");

    server.addEventListener("message", async (event) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.type === "chat_message") {
          // Store the message in D1
          const msgId = crypto.randomUUID();
          await this.env.DB.prepare(
            `INSERT INTO chat_messages (id, session_id, sender, message, is_admin, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).bind(
            msgId,
            data.sessionId,
            data.sender || "Visitor",
            data.message,
            data.isAdmin ? 1 : 0,
            new Date().toISOString(),
          ).run();

          // Broadcast to all connected clients
          const broadcast = JSON.stringify({
            type: "chat_message",
            id: msgId,
            sessionId: data.sessionId,
            sender: data.sender || "Visitor",
            message: data.message,
            isAdmin: data.isAdmin || false,
            timestamp: new Date().toISOString(),
          });

          for (const ws of this.sessions.keys()) {
            try {
              ws.send(broadcast);
            } catch {}
          }
        } else if (data.type === "ping") {
          server.send(JSON.stringify({ type: "pong" }));
        }
      } catch {}
    });

    server.addEventListener("close", () => {
      this.sessions.delete(server);
    });

    server.addEventListener("error", () => {
      this.sessions.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
