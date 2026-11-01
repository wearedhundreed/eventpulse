import { useState, useEffect } from "react";
import { api } from "../api";
import { LoadingState, EmptyState } from "../components/EventCard";

interface TicketInfo {
  id: string;
  orderId: string;
  qrToken: string;
  ticketTypeName: string;
  eventTitle: string;
  eventStartTime: string;
  eventVenue: string | null;
  eventCity: string | null;
  status: string;
  seatInfo: string | null;
}

export default function MyTickets() {
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTickets()
      .then(({ tickets }) => setTickets(tickets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container"><LoadingState /></div>;
  if (error) return <div className="container"><ErrorState message={error} /></div>;

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "1.5rem" }}>My Tickets</h1>

      {tickets.length === 0 ? (
        <EmptyState message="You don't have any tickets yet. Purchase tickets from an event page." />
      ) : (
        tickets.map((t) => {
          const date = new Date(t.eventStartTime);
          return (
            <div key={t.id} className="ticket-card">
              <div className="ticket-qr">
                QR<br />Placeholder
              </div>
              <div className="ticket-info">
                <h4>{t.eventTitle}</h4>
                <div className="ticket-meta">
                  {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  {" · "}
                  {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
                <div className="ticket-meta">
                  📍 {t.eventVenue || "TBA"}{t.eventCity ? `, ${t.eventCity}` : ""}
                </div>
                <div className="ticket-meta">
                  🎫 {t.ticketTypeName}
                  {t.seatInfo && ` · Seat: ${t.seatInfo}`}
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <span className={`status-badge status-${t.status === "issued" ? "scheduled" : t.status === "checked_in" ? "live" : "ended"}`}>
                    <span className="dot" />
                    {t.status === "issued" ? "Valid" : t.status === "checked_in" ? "Checked In" : "Voided"}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.5rem" }}>
                  Ticket ID: {t.id.slice(0, 8)}… · QR token: {t.qrToken.slice(0, 8)}…
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-state">
      <p style={{ color: "var(--red)" }}>{message}</p>
    </div>
  );
}
