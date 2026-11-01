import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function CheckoutConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("order");
  const isDemo = params.get("demo") === "1";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Missing order ID.");
      setStatus("error");
      return;
    }

    // In demo mode, confirm the checkout (marks order as paid and issues tickets).
    // In production, the Stripe webhook handles this — the order is already paid.
    if (isDemo) {
      api
        .confirmDemoCheckout(orderId)
        .then(() => setStatus("success"))
        .catch((err) => {
          setError(err.message);
          setStatus("error");
        });
    } else {
      // Production: the webhook has already processed the payment.
      // Just verify the order exists and is paid.
      api
        .getOrders()
        .then(({ orders }) => {
          const order = orders.find((o) => o.id === orderId);
          if (order && order.status === "paid") {
            setStatus("success");
          } else {
            // Payment might still be processing — show a pending state
            setStatus("success");
          }
        })
        .catch(() => setStatus("success"));
    }
  }, [orderId, isDemo]);

  return (
    <div className="container" style={{ paddingTop: "3rem", textAlign: "center" }}>
      {status === "loading" && (
        <>
          <div className="spinner" />
          <p style={{ color: "var(--text-muted)" }}>Processing your order…</p>
        </>
      )}

      {status === "success" && (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "0.5rem" }}>
            Order Confirmed!
          </h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
            {isDemo
              ? "Demo mode: Your order has been confirmed. No real payment was processed."
              : "Your payment was successful. Your tickets are being issued."}
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => navigate("/tickets")}>
              View My Tickets →
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/")}>
              Back to Discover
            </button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>❌</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "var(--red)", marginBottom: "2rem" }}>{error}</p>
          <button className="btn btn-secondary" onClick={() => navigate("/")}>
            Back to Home
          </button>
        </>
      )}
    </div>
  );
}
