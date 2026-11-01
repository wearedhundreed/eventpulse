import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useCart } from "../hooks/useCart";

export default function Checkout() {
  const navigate = useNavigate();
  const { cart } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attendees, setAttendees] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    if (!cart || cart.items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.createCheckoutSession({
        customerName: name,
        customerEmail: email,
        attendeeDetails: attendees || undefined,
      });

      // Redirect to Stripe Checkout or demo confirmation
      window.location.href = result.checkoutUrl;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container" style={{ paddingTop: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "1rem" }}>Checkout</h1>
        <p style={{ color: "var(--text-muted)" }}>Your cart is empty.</p>
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => navigate("/")}>
          Browse Events
        </button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "1.5rem" }}>Checkout</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "2rem" }}>
        <div className="detail-section">
          <h3 style={{ marginBottom: "1.5rem" }}>Customer Information</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                Tickets will be delivered to this email.
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="attendees">Attendee Details (optional)</label>
              <textarea
                id="attendees"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                rows={3}
                placeholder="Names of attendees if different from purchaser…"
              />
            </div>

            {error && (
              <p style={{ color: "var(--red)", marginBottom: "1rem", fontSize: "0.9rem" }}>{error}</p>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Creating checkout session…" : "Continue to Payment →"}
            </button>

            <div className="checkout-trust">
              <span>🔒</span>
              <span>
                You will be redirected to a secure payment page. We never process or
                store card data directly. All totals are calculated on the server.
              </span>
            </div>
          </form>
        </div>

        <div className="cart-summary">
          <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>Order Summary</h3>
          {cart.items.map((item) => (
            <div key={item.reservationId} className="summary-row">
              <span style={{ fontSize: "0.85rem" }}>
                {item.ticketTypeName} × {item.quantity}
              </span>
              <span>${item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>${cart.subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Fees</span>
            <span>${cart.fees.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Taxes (placeholder)</span>
            <span>${cart.taxes.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>${cart.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
