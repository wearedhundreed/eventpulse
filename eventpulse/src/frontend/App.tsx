import { Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { Navbar, Footer } from "./components/Navbar";
import { useCart } from "./hooks/useCart";
import Discover from "./pages/Discover";
import HappeningNow from "./pages/HappeningNow";
import EventDetails from "./pages/EventDetails";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import CheckoutConfirm from "./pages/CheckoutConfirm";
import MyTickets from "./pages/MyTickets";
import OrganizerDashboard from "./pages/OrganizerDashboard";

export default function App() {
  const { itemCount } = useCart();

  return (
    <div className="app">
      <Navbar cartCount={itemCount} />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/happening-now" element={<HappeningNow />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/confirm" element={<CheckoutConfirm />} />
          <Route path="/tickets" element={<MyTickets />} />
          <Route path="/organizer" element={<OrganizerDashboard />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
