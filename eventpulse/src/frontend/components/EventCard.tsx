import { Link } from "react-router-dom";
import type { EventListItem } from "../../shared/types";
import { StatusBadge } from "./StatusBadge";

export function EventCard({ event }: { event: EventListItem }) {
  const date = new Date(event.startTime);
  const localDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const localTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const priceLabel = event.minPrice !== null
    ? `$${event.minPrice.toFixed(0)}${event.maxPrice && event.maxPrice > event.minPrice ? `–$${event.maxPrice.toFixed(0)}` : ""}`
    : "Free";

  return (
    <Link to={`/events/${event.id}`} className="event-card" style={{ textDecoration: "none", color: "inherit" }}>
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          className="event-card-image"
          loading="lazy"
        />
      )}
      <div className="event-card-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="event-card-category">{event.category}</span>
          <StatusBadge status={event.status} />
        </div>
        <h3 className="event-card-title">{event.title}</h3>
        <div className="event-card-meta">
          <span>📍 {event.venueName || "TBA"}</span>
          <span>·</span>
          <span>{event.city}</span>
        </div>
        <div className="event-card-meta">
          <span>📅 {localDate}</span>
          <span>·</span>
          <span>🕐 {localTime}</span>
        </div>
        <div className="event-card-footer">
          <span className="event-card-price">
            {priceLabel}
            {event.isDemo && (
              <small style={{ marginLeft: "0.5rem", color: "var(--amber)" }}>DEMO</small>
            )}
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {event.availableTickets} left
          </span>
        </div>
      </div>
    </Link>
  );
}

export function EventGrid({ events }: { events: EventListItem[] }) {
  return (
    <div className="event-grid">
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="loading">
      <div className="spinner" />
      <p>Loading events…</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state">
      <p style={{ color: "var(--red)", marginBottom: "1rem" }}>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
