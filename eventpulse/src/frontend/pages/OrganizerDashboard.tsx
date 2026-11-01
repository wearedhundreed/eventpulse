import { useState, useEffect } from "react";
import { api } from "../api";

type Tab = "events" | "create" | "orders";

export default function OrganizerDashboard() {
  const [tab, setTab] = useState<Tab>("events");
  const [token, setToken] = useState(localStorage.getItem("ep_organizer_token") || "");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Create event form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "concert",
    venueId: "",
    organizerId: "org_001",
    imageUrl: "",
    startTime: "",
    endTime: "",
    timezone: "America/New_York",
    featured: false,
  });
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);

  function handleLogin() {
    if (!token.trim()) return;
    localStorage.setItem("ep_organizer_token", token);
    setAuthed(true);
    setTab("events");
  }

  useEffect(() => {
    if (authed) {
      loadOrders();
    }
  }, [authed]);

  async function loadOrders() {
    setLoading(true);
    try {
      const { orders } = await api.getOrganizerOrders();
      setOrders(orders);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const payload = {
        ...form,
        featured: form.featured ? 1 : 0,
        ticketTypes: ticketTypes.filter((t) => t.name && t.price >= 0 && t.totalQuantity > 0),
      };
      await api.organizerEvents(payload);
      setMessage("Event created successfully!");
      setForm({ ...form, title: "", description: "" });
      setTicketTypes([]);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function addTicketTypeRow() {
    setTicketTypes([...ticketTypes, { name: "", description: "", price: 0, fees: 0, totalQuantity: 0 }]);
  }

  // ── Login gate ──────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="container" style={{ paddingTop: "3rem", maxWidth: "480px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 900, marginBottom: "1rem" }}>
          Organizer Login
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          Enter your organizer token to access the dashboard. This token is set via
          the <code>ORGANIZER_TOKEN</code> Worker secret.
        </p>
        <div className="form-group">
          <label>Organizer Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your organizer token…"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>
        <button className="btn btn-primary btn-block" onClick={handleLogin}>
          Login →
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <aside className="dashboard-sidebar">
        <h3>Dashboard</h3>
        <a
          href="#"
          className={tab === "events" ? "active" : ""}
          onClick={(e) => { e.preventDefault(); setTab("events"); }}
        >
          📅 Events
        </a>
        <a
          href="#"
          className={tab === "create" ? "active" : ""}
          onClick={(e) => { e.preventDefault(); setTab("create"); }}
        >
          ➕ Create Event
        </a>
        <a
          href="#"
          className={tab === "orders" ? "active" : ""}
          onClick={(e) => { e.preventDefault(); setTab("orders"); loadOrders(); }}
        >
          📦 Orders
        </a>
      </aside>

      <div className="dashboard-main">
        {message && (
          <div style={{
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            background: message.includes("success") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: message.includes("success") ? "var(--green)" : "var(--red)",
          }}>
            {message}
          </div>
        )}

        {tab === "events" && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>Your Events</h2>
            <p style={{ color: "var(--text-muted)" }}>
              Use the Create Event tab to add new events. Manage event status, ticket tiers, and inventory here.
            </p>
          </div>
        )}

        {tab === "create" && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>Create Event</h2>
            <form onSubmit={handleCreateEvent} style={{ maxWidth: "600px" }}>
              <div className="form-group">
                <label>Event Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {["concert", "sports", "theater", "festival", "conference", "nightlife"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Venue ID</label>
                  <input type="text" value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })} placeholder="venue_001" required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label>Start Time (UTC)</label>
                  <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>End Time (UTC)</label>
                  <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />{" "}
                  Featured event
                </label>
              </div>

              <h3 style={{ marginTop: "1.5rem", marginBottom: "0.75rem" }}>Ticket Tiers</h3>
              {ticketTypes.map((tt, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="Tier name"
                    value={tt.name}
                    onChange={(e) => {
                      const copy = [...ticketTypes];
                      copy[i].name = e.target.value;
                      setTicketTypes(copy);
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={tt.price}
                    onChange={(e) => {
                      const copy = [...ticketTypes];
                      copy[i].price = parseFloat(e.target.value) || 0;
                      setTicketTypes(copy);
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={tt.totalQuantity}
                    onChange={(e) => {
                      const copy = [...ticketTypes];
                      copy[i].totalQuantity = parseInt(e.target.value) || 0;
                      setTicketTypes(copy);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: "0.5rem" }}
                    onClick={() => setTicketTypes(ticketTypes.filter((_, idx) => idx !== i))}
                  >✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary" style={{ marginBottom: "1.5rem" }} onClick={addTicketTypeRow}>
                + Add Tier
              </button>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? "Creating…" : "Create Event"}
              </button>
            </form>
          </div>
        )}

        {tab === "orders" && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>All Orders</h2>
            {loading ? (
              <div className="spinner" />
            ) : orders.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No orders yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.id.slice(0, 8)}…</td>
                      <td>{o.customerName}<br /><span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{o.customerEmail}</span></td>
                      <td>
                        <span className={`status-badge status-${o.status === "paid" ? "live" : o.status === "pending" ? "scheduled" : "ended"}`}>
                          <span className="dot" />
                          {o.status}
                        </span>
                      </td>
                      <td>${o.total.toFixed(2)}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
