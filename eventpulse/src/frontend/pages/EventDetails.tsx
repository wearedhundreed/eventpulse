import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useCart } from "../hooks/useCart";
import { useLiveStatus } from "../hooks/useLiveStatus";
import { StatusBadge, LiveStatusIndicator } from "../components/StatusBadge";
import { LoadingState, ErrorState } from "../components/EventCard";
import type { EventDetail } from "../../shared/types";

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { addItem } = useCart();

  const live = useLiveStatus(id ?? null);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { event } = await api.getEvent(id);
      setEvent(event);
      const initQty: Record<string, number> = {};
      event.ticketTypes.forEach((tt) => (initQty[tt.id] = 0));
      setQuantities(initQty);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  function getAvailabilityClass(available: number, total: number): string {
    const pct = (available / total) * 100;
    if (pct > 50) return "availability-high";
    if (pct > 20) return "availability-medium";
    return "availability-low";
  }

  async function handleAddToCart(ticketTypeId: string) {
    const qty = quantities[ticketTypeId] || 0;
    if (qty === 0) {
      setMessage("Select a quantity first.");
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      await addItem(ticketTypeId, qty);
      setMessage(`Added ${qty} ticket(s) to cart.`);
      setQuantities((prev) => ({ ...prev, [ticketTypeId]: 0 }));
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <div className="container"><LoadingState /></div>;
  if (error) return <div className="container"><ErrorState message={error} onRetry={fetchEvent} /></div>;
  if (!event) return <div className="container"><ErrorState message="Event not found." /></div>;

  const date = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <div className="detail-hero">
        {event.imageUrl && <img src={event.imageUrl} alt={event.title} />}
        <div className="detail-hero-overlay">
          <div>
            <span className="event-card-category">{event.category}</span>
            <h1 style={{ fontSize: "2rem", fontWeight: 900, marginTop: "0.5rem" }}>{event.title}</h1>
            <div style={{ color: "var(--text-muted)", marginTop: "0.25rem" }}>
              {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} ·{" "}
              {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      {event.isDemo && (
        <div className="demo-banner">
          ⚠ This is demo data. Not a real event.
        </div>
      )}

      <div className="detail-grid">
        <div>
          {/* Overview */}
          <div className="detail-section">
            <h3>About This Event</h3>
            <p style={{ color: "var(--text-muted)" }}>{event.description || "No description available."}</p>
          </div>

          {/* Venue */}
          <div className="detail-section">
            <h3>Venue</h3>
            <p style={{ fontWeight: 700 }}>{event.venueName}</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {event.venueAddress && <span>{event.venueAddress}<br /></span>}
              {event.city}, {event.country}
            </p>
            {event.venueCapacity && (
              <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
                Capacity: {event.venueCapacity.toLocaleString()}
              </p>
            )}
          </div>

          {/* Schedule */}
          <div className="detail-section">
            <h3>Schedule</h3>
            <p style={{ color: "var(--text)" }}>
              <strong>Start:</strong> {date.toLocaleString("en-US")}
            </p>
            <p style={{ color: "var(--text)" }}>
              <strong>End:</strong> {endDate.toLocaleString("en-US")}
            </p>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
              Times shown in your local timezone. Event timezone: {event.timezone}
            </p>
          </div>

          {/* Organizer */}
          {event.organizerName && (
            <div className="detail-section">
              <h3>Organizer</h3>
              <p>{event.organizerName}</p>
            </div>
          )}
        </div>

        {/* Sidebar: live status + ticket tiers */}
        <div>
          <div className="detail-section">
            <h3>Live Status</h3>
            <LiveStatusIndicator
              status={live.status ?? event.status}
              availableTickets={live.availableTickets ?? event.availableTickets}
              lastUpdated={live.lastUpdated}
              isStale={live.isStale}
              connected={live.connected}
            />
          </div>

          <div className="detail-section">
            <h3>Ticket Tiers</h3>
            {event.ticketTypes.length === 0 && (
              <p style={{ color: "var(--text-muted)" }}>No tickets available.</p>
            )}
            {event.ticketTypes.map((tt) => {
              const available = tt.availableQuantity;
              const pct = tt.totalQuantity > 0 ? (available / tt.totalQuantity) * 100 : 0;
              return (
                <div key={tt.id} className="ticket-tier">
                  <div className="ticket-tier-info">
                    <h4>{tt.name}</h4>
                    {tt.description && <p>{tt.description}</p>}
                    <p style={{ fontSize: "0.8rem", color: available > 0 ? "var(--text-muted)" : "var(--red)" }}>
                      {available > 0 ? `${available} available` : "Sold out"}
                    </p>
                    <div className="availability-bar">
                      <div
                        className={`availability-fill ${getAvailabilityClass(available, tt.totalQuantity)}`}
                        style={{ width: `${Math.max(0, pct)}%` }}
                      />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                    <span className="ticket-tier-price">${tt.price.toFixed(2)}</span>
                    {available > 0 && (
                      <>
                        <div className="qty-selector">
                          <button
                            onClick={() =>
                              setQuantities((p) => ({ ...p, [tt.id]: Math.max(0, (p[tt.id] || 0) - 1) }))
                            }
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span>{quantities[tt.id] || 0}</span>
                          <button
                            onClick={() =>
                              setQuantities((p) => ({ ...p, [tt.id]: Math.min(10, (p[tt.id] || 0) + 1) }))
                            }
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                          disabled={adding || (quantities[tt.id] || 0) === 0}
                          onClick={() => handleAddToCart(tt.id)}
                        >
                          Add to Cart
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {message && (
              <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: message.includes("Added") ? "var(--green)" : "var(--red)" }}>
                {message}
              </p>
            )}
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: "1rem" }}
              onClick={() => navigate("/cart")}
            >
              Go to Cart →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
