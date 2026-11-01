import { useEffect, useRef, useState, useCallback } from "react";
import type { EventStatus } from "../../shared/types";

// useLiveStatus — connects to the EventStatus Durable Object via WebSocket
// for real-time event status updates. Falls back to polling if the
// WebSocket connection fails or is unavailable.

interface LiveState {
  status: EventStatus | null;
  availableTickets: number | null;
  lastUpdated: number | null;
  isStale: boolean;
  connected: boolean;
}

const POLL_INTERVAL = 15_000; // 15 seconds
const STALE_THRESHOLD = 60_000; // 60 seconds without update = stale

export function useLiveStatus(eventId: string | null) {
  const [state, setState] = useState<LiveState>({
    status: null,
    availableTickets: null,
    lastUpdated: null,
    isStale: false,
    connected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!eventId) return;
    try {
      const resp = await fetch(`/api/live/${eventId}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setState((prev) => ({
        ...prev,
        status: data.status,
        availableTickets: data.availableTickets,
        lastUpdated: Date.now(),
        isStale: false,
      }));
    } catch {
      // polling failed — leave state as-is
    }
  }, [eventId]);

  const connect = useCallback(() => {
    if (!eventId) return;
    if (wsRef.current) wsRef.current.close();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/live/${eventId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
      // Stop polling if WebSocket is connected
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "status_update") {
          setState((prev) => ({
            ...prev,
            status: msg.status,
            availableTickets: msg.availableTickets,
            lastUpdated: Date.now(),
            isStale: false,
          }));
        }
      } catch {}
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
      wsRef.current = null;
      // Start polling fallback
      if (!pollRef.current) {
        poll();
        pollRef.current = setInterval(poll, POLL_INTERVAL);
      }
      // Attempt reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current === null) connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [eventId, poll]);

  useEffect(() => {
    if (!eventId) return;

    // Initial poll to get immediate data
    poll();

    // Try WebSocket first
    connect();

    // Stale checker — marks data as stale if no update in 60s
    staleRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.lastUpdated && Date.now() - prev.lastUpdated > STALE_THRESHOLD) {
          return { ...prev, isStale: true };
        }
        return prev;
      });
    }, 10_000);

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on cleanup
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollRef.current) clearInterval(pollRef.current);
      if (staleRef.current) clearInterval(staleRef.current);
    };
  }, [eventId, connect, poll]);

  return state;
}
