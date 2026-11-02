import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const wsTimedOut = useRef(false);

  const loadMessages = useCallback(async () => {
    try {
      const { messages } = await api.getChatMessages();
      setMessages(messages);
    } catch {}
  }, []);

  const connect = useCallback(() => {
    if (wsTimedOut.current) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/chat/ws`);
    wsRef.current = ws;

    // If WebSocket doesn't connect in 3 seconds, give up and use HTTP
    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        wsTimedOut.current = true;
        ws.close();
        wsRef.current = null;
        setConnected(false);
      }
    }, 3000);

    ws.onopen = () => {
      clearTimeout(timeout);
      setConnected(true);
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      setConnected(false);
      wsRef.current = null;
      if (!wsTimedOut.current) {
        setTimeout(() => connect(), 5000);
      }
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "chat_message") {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, { id: msg.id, sender: msg.sender, message: msg.message, isAdmin: msg.isAdmin, createdAt: msg.timestamp }];
          });
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      loadMessages();
      connect();
    }
  }, [open, loadMessages, connect]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setLoading(true);
    try {
      if (wsRef.current && connected && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "chat_message",
          sessionId: getSessionId(),
          sender: "Visitor",
          message: text,
          isAdmin: false,
        }));
      } else {
        // HTTP fallback
        const msg = await api.sendChatMessage(text, "Visitor");
        setMessages((prev) => [...prev, msg]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: "error",
        sender: "System",
        message: "Failed to send. Please try again.",
        isAdmin: true,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function getSessionId(): string {
    return localStorage.getItem("ep_session_id") || "";
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--violet), var(--cyan))",
          color: "white",
          fontSize: "1.5rem",
          boxShadow: "0 4px 20px rgba(124, 58, 237, 0.4)",
          cursor: "pointer",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Open chat"
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div style={{
          position: "fixed",
          bottom: "90px",
          right: "24px",
          zIndex: 9999,
          width: "360px",
          maxWidth: "calc(100vw - 48px)",
          height: "480px",
          maxHeight: "calc(100vh - 120px)",
          background: "var(--navy-800)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "1rem 1.25rem",
            background: "var(--navy-700)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <strong style={{ fontSize: "1rem", color: "var(--text)" }}>EventPulse Support</strong>
              <div style={{ fontSize: "0.75rem", color: connected ? "var(--green)" : "var(--text-dim)" }}>
                {connected ? "● Online" : "○ Send a message — we'll reply!"}
              </div>
            </div>
          </div>

          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.85rem", marginTop: "1rem" }}>
                💬 Ask about any event, booking, or tickets. We'll reply right away!
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} style={{ alignSelf: msg.isAdmin ? "flex-start" : "flex-end", maxWidth: "80%" }}>
                <div style={{
                  background: msg.isAdmin ? "var(--navy-700)" : "linear-gradient(135deg, var(--violet), var(--cyan))",
                  color: "var(--text)",
                  padding: "0.5rem 0.875rem",
                  borderRadius: msg.isAdmin ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
                  fontSize: "0.875rem",
                  lineHeight: "1.4",
                }}>
                  {msg.message}
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: "2px", textAlign: msg.isAdmin ? "left" : "right" }}>
                  {msg.isAdmin ? "Support" : "You"} · {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={{
            padding: "0.75rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: "0.5rem",
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && send()}
              placeholder="Type a message..."
              style={{
                flex: 1,
                background: "var(--navy-900)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                padding: "0.625rem 0.75rem",
                borderRadius: "10px",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: "linear-gradient(135deg, var(--violet), var(--cyan))",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "0.625rem 1rem",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
