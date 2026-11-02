// API routes: chat
import { Hono } from "hono";
import type { Env } from "../../shared/types";
import { rateLimit } from "../middleware";
import { getSessionId } from "../lib/auth";

const app = new Hono<{ Bindings: Env }>();

function sessionFromRequest(c: any): string {
  const header = c.req.header("X-Session-Id");
  if (header) return header;
  return getSessionId(c);
}

// GET /api/chat/messages — get chat history for the current session
app.get("/messages", rateLimit(60), async (c) => {
  const sessionId = sessionFromRequest(c);
  const messages = await c.env.DB
    .prepare(
      `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
    )
    .bind(sessionId)
    .all();

  return c.json({
    messages: messages.results.map((m: any) => ({
      id: m.id,
      sender: m.sender,
      message: m.message,
      isAdmin: m.is_admin === 1,
      createdAt: m.created_at,
    })),
  });
});

// GET /api/chat/ws — WebSocket upgrade to ChatRoomDO
app.get("/ws", rateLimit(200), async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.json({ error: "WebSocket required" }, 426);
  }

  const sessionId = sessionFromRequest(c);
  const id = c.env.CHAT_ROOM.idFrom(sessionId);
  const stub = c.env.CHAT_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

// POST /api/chat/send — send a message without WebSocket (fallback)
app.post("/send", rateLimit(30), async (c) => {
  const sessionId = sessionFromRequest(c);
  const body = await c.req.json();
  const message = body.message?.trim();
  const sender = body.sender?.trim() || "Visitor";

  if (!message) {
    return c.json({ error: "Message is required" }, 400);
  }
  if (message.length > 1000) {
    return c.json({ error: "Message too long (max 1000 characters)" }, 400);
  }

  const msgId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO chat_messages (id, session_id, sender, message, is_admin, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
  ).bind(msgId, sessionId, sender, message, new Date().toISOString()).run();

  return c.json({
    id: msgId,
    sender,
    message,
    isAdmin: false,
    createdAt: new Date().toISOString(),
  });
});

// GET /api/chat/admin/messages — get all chat sessions (admin only)
app.get("/admin/messages", rateLimit(60), async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== c.env.ORGANIZER_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessions = await c.env.DB
    .prepare(
      `SELECT session_id, COUNT(*) as msg_count, MIN(created_at) as first_message, MAX(created_at) as last_message
       FROM chat_messages GROUP BY session_id ORDER BY last_message DESC`,
    )
    .all();

  return c.json({ sessions: sessions.results });
});

// GET /api/chat/admin/messages/:sessionId — get messages for a specific session (admin only)
app.get("/admin/messages/:sessionId", rateLimit(60), async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== c.env.ORGANIZER_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessionId = c.req.param("sessionId");
  const messages = await c.env.DB
    .prepare(
      `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
    )
    .bind(sessionId)
    .all();

  return c.json({
    messages: messages.results.map((m: any) => ({
      id: m.id,
      sender: m.sender,
      message: m.message,
      isAdmin: m.is_admin === 1,
      createdAt: m.created_at,
    })),
  });
});

// POST /api/chat/admin/reply — admin replies to a visitor (admin only)
app.post("/admin/reply", rateLimit(60), async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== c.env.ORGANIZER_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const sessionId = body.sessionId;
  const message = body.message?.trim();
  const sender = body.sender?.trim() || "Admin";

  if (!sessionId || !message) {
    return c.json({ error: "sessionId and message are required" }, 400);
  }

  const msgId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO chat_messages (id, session_id, sender, message, is_admin, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
  ).bind(msgId, sessionId, sender, message, new Date().toISOString()).run();

  // Broadcast to the chat DO for that session so the visitor sees it in real-time
  try {
    const id = c.env.CHAT_ROOM.idFrom(sessionId);
    const stub = c.env.CHAT_ROOM.get(id);
    await stub.fetch(
      new Request("https://internal/broadcast", {
        method: "POST",
        body: JSON.stringify({
          type: "chat_message",
          id: msgId,
          sessionId,
          sender,
          message,
          isAdmin: true,
          timestamp: new Date().toISOString(),
        }),
      }),
    );
  } catch {}

  return c.json({
    id: msgId,
    sender,
    message,
    isAdmin: true,
    createdAt: new Date().toISOString(),
  });
});

export default app;
