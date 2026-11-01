import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingState, EmptyState, ErrorState } from "../components/EventCard";
import type { EventListItem } from "../../shared/types";

export default function HappeningNow() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // forces re-render for elapsed time

  // Re-render every 30 seconds to update elapsed/remaining time
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { events } = await api.getEvents();
      const now = Date.now();
      const live = events.filter((e) => {
        const start = new Date(e.startTime).getTime();
        const end = new Date(e.endTime).getTime();
        return now >= start && now < end;
      });
      setEvents(live);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    // Poll every 60 seconds for status updates (fallback for WebSocket)
    const interval = setInterval(fetchEvents, 60_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  function formatDuration(ms: number): string {
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) return `${hours}h ${remainingMins}m`;
    return `${remainingMins}m`;
  }

  return (
    <div className="container">
      <section className="hero">
        <h1>Happening Now</h1>
        <p>Events currently in progress, updated in real time.</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={fetchEvents} />}
      {!loading && !error && events.length === 0 && (
        <EmptyState message="No events are happening right now. Check back soon!" />
      )}

      {!loading && !error && events.length > 0 && (
        <div className="event-grid">
          {events.map((e) => {
            const now = Date.now();
            const start = new Date(e.startTime).getTime();
            const end = new Date(e.endTime).getTime();
            const elapsed = now - start;
            const remaining = end - now;

            return (
              <Link
                key={e.id}
                to={`/events/${e.id}`}
                className="event-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {e.imageUrl && (
                  <img src={e.imageUrl} alt={e.title} className="event-card-image" loading="lazy" />
                )}
                <div className="event-card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span className="event-card-category">{e.category}</span>
                    <StatusBadge status="live" />
                  </div>
                  <h3 className="event-card-title">{e.title}</h3>
                  <div className="event-card-meta">
                    <span>📍 {e.venueName || "TBA"}</span>
                    <span>·</span>
                    <span>{e.city}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--green)" }}>
                      ⏱ Elapsed: {formatDuration(elapsed)}
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "var(--amber)" }}>
                      ⏳ Remaining: {formatDuration(remaining)}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {e.availableTickets} tickets available
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
