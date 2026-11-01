import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { LoadingState, EmptyState } from "../components/EventCard";

export default function Cart() {
  const navigate = useNavigate();
  const { cart, loading, updateItem, removeItem, refresh } = useCart();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleUpdate(reservationId: string, quantity: number) {
    if (quantity <= 0) {
      await removeItem(reservationId);
      return;
    }
    setUpdating(true);
    try {
      await updateItem(reservationId, quantity);
    } catch {
      // error handled by hook
    } finally {
      setUpdating(false);
    }
  }

  if (loading && !cart) return <div className="container"><LoadingState /></div>;

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "1.5rem" }}>Your Cart</h1>

      {!cart || cart.items.length === 0 ? (
        <EmptyState message="Your cart is empty. Browse events and add tickets!" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "2rem" }}>
          <div>
            {cart.items.map((item) => {
              const expired = new Date(item.reservationExpiresAt).getTime() < Date.now();
              return (
                <div key={item.reservationId} className="cart-item">
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 700 }}>{item.eventTitle}</h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {item.ticketTypeName} · ${item.unitPrice.toFixed(2)} each
                    </p>
                    {expired && (
                      <p style={{ fontSize: "0.8rem", color: "var(--red)" }}>
                        ⚠ Reservation expired — remove and re-add.
                      </p>
                    )}
                  </div>
                  <div className="qty-selector">
                    <button
                      onClick={() => handleUpdate(item.reservationId, item.quantity - 1)}
                      disabled={updating}
                    >−</button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => handleUpdate(item.reservationId, item.quantity + 1)}
                      disabled={updating}
                    >+</button>
                  </div>
                  <span style={{ fontWeight: 800, minWidth: "80px", textAlign: "right" }}>
                    ${item.lineTotal.toFixed(2)}
                  </span>
                  <button
                    className="btn btn-danger"
                    style={{ padding: "0.5rem", fontSize: "0.8rem" }}
                    onClick={() => removeItem(item.reservationId)}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <div className="cart-summary">
            <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>Order Summary</h3>
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
            <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "0.75rem" }}>
              Reservations are held for 10 minutes. Complete checkout before they expire.
            </p>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: "1rem" }}
              onClick={() => navigate("/checkout")}
            >
              Proceed to Checkout →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
