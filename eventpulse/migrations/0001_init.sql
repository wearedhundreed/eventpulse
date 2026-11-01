-- EventPulse D1 Schema — initial migration
-- Tables: users, organizers, events, venues, ticket_types,
--         ticket_reservations, carts, orders, order_items, tickets,
--         event_updates, webhook_events

-- ── Users (customers) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer', -- customer | organizer | admin
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Organizers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizers (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  bio           TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Venues ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  city          TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'US',
  address       TEXT,
  capacity      INTEGER,
  timezone      TEXT NOT NULL DEFAULT 'America/New_York',
  latitude      REAL,
  longitude     REAL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Events ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  organizer_id     TEXT REFERENCES organizers(id),
  venue_id         TEXT REFERENCES venues(id),
  title            TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL,          -- concert | sports | theater | festival | conference | nightlife
  image_url        TEXT,
  start_time       TEXT NOT NULL,         -- ISO 8601 UTC
  end_time         TEXT NOT NULL,         -- ISO 8601 UTC
  timezone         TEXT NOT NULL DEFAULT 'America/New_York',
  status           TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | ended | cancelled | postponed | paused
  source           TEXT NOT NULL DEFAULT 'local',     -- local | external provider name
  source_event_id  TEXT,                              -- external provider's event id
  ticket_url       TEXT,                              -- external buy link (optional)
  min_price        REAL,
  max_price        REAL,
  available_tickets INTEGER NOT NULL DEFAULT 0,
  featured         INTEGER NOT NULL DEFAULT 0,
  published        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- De-duplication: one event per (source, source_event_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_dedup
  ON events(source, source_event_id) WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_featured ON events(featured) WHERE featured = 1;

-- ── Ticket Types (tiers) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_types (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,           -- General Admission, VIP, etc.
  description     TEXT,
  price           REAL NOT NULL,            -- server-authoritative price (cents stored as REAL for D1)
  fees            REAL NOT NULL DEFAULT 0,
  total_quantity  INTEGER NOT NULL,
  sold_quantity   INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  sale_start      TEXT,
  sale_end        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);

-- ── Ticket Reservations (temporary holds) ─────────────────────
CREATE TABLE IF NOT EXISTS ticket_reservations (
  id              TEXT PRIMARY KEY,
  ticket_type_id  TEXT NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  cart_id         TEXT,
  quantity        INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active', -- active | expired | released | fulfilled
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_ticket_type ON ticket_reservations(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON ticket_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON ticket_reservations(status);

-- ── Carts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  session_id    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active', -- active | converted | abandoned
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_carts_session ON carts(session_id);

-- ── Orders ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT REFERENCES users(id),
  cart_id             TEXT REFERENCES carts(id),
  session_id          TEXT NOT NULL,
  customer_name       TEXT NOT NULL,
  customer_email      TEXT NOT NULL,
  attendee_details    TEXT,          -- JSON blob
  subtotal            REAL NOT NULL,
  fees                REAL NOT NULL DEFAULT 0,
  taxes               REAL NOT NULL DEFAULT 0,
  total               REAL NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | paid | cancelled | refunded
  payment_provider    TEXT NOT NULL DEFAULT 'stripe',
  payment_intent_id   TEXT,
  checkout_session_id TEXT,
  provider_order_id   TEXT,          -- id returned by the payment provider
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(payment_intent_id);

-- ── Order Items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id  TEXT NOT NULL REFERENCES ticket_types(id),
  event_id        TEXT NOT NULL REFERENCES events(id),
  ticket_type_name TEXT NOT NULL,
  unit_price      REAL NOT NULL,
  fees            REAL NOT NULL DEFAULT 0,
  quantity        INTEGER NOT NULL,
  line_total      REAL NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_event ON order_items(event_id);

-- ── Tickets (individual issued tickets) ────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id   TEXT NOT NULL REFERENCES order_items(id),
  event_id        TEXT NOT NULL REFERENCES events(id),
  ticket_type_id  TEXT NOT NULL REFERENCES ticket_types(id),
  ticket_type_name TEXT NOT NULL,
  seat_info      TEXT,
  qr_token       TEXT NOT NULL,        -- unique signed token for QR (placeholder)
  status         TEXT NOT NULL DEFAULT 'issued', -- issued | checked_in | voided
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_token);

-- ── Event Updates (audit log for real-time broadcast) ──────────
CREATE TABLE IF NOT EXISTS event_updates (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL,    -- status_change | inventory_change | reservation_expired | cancelled | postponed
  payload     TEXT,             -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_updates_event ON event_updates(event_id);

-- ── Webhook Events (idempotency for payment webhooks) ──────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id              TEXT PRIMARY KEY,    -- the provider event id
  provider         TEXT NOT NULL DEFAULT 'stripe',
  event_type       TEXT NOT NULL,
  payload         TEXT,                 -- raw JSON body
  processed       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
