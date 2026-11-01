import { Link, useLocation } from "react-router-dom";

export function Navbar({ cartCount }: { cartCount: number }) {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="logo">
          <span className="logo-mark">⚡</span>
          EventPulse
        </Link>
        <ul className="nav-links">
          <li>
            <Link to="/" className={location.pathname === "/" ? "active" : ""}>
              Discover
            </Link>
          </li>
          <li>
            <Link
              to="/happening-now"
              className={location.pathname === "/happening-now" ? "active" : ""}
            >
              Happening Now
            </Link>
          </li>
          <li>
            <Link
              to="/tickets"
              className={location.pathname === "/tickets" ? "active" : ""}
            >
              My Tickets
            </Link>
          </li>
          <li>
            <Link
              to="/organizer"
              className={location.pathname.startsWith("/organizer") ? "active" : ""}
            >
              Organizer
            </Link>
          </li>
        </ul>
        <Link to="/cart" className="nav-cart">
          🛒 Cart
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </Link>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          EventPulse — Live event ticketing on Cloudflare Workers. Demo data is
          clearly labeled. No real payments unless Stripe is configured.
        </p>
      </div>
    </footer>
  );
}
