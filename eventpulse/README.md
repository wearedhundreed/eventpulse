# EventPulse — Full-Stack Event Ticketing Platform

A production-ready event ticketing platform built on Cloudflare Workers, featuring real-time event status, Stripe Checkout payments, and an external event provider adapter.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  React SPA  │  │  Hono API    │  │  Durable Objects    │ │
│  │ (static     │  │  /api/*      │  │  (WebSocket live     │ │
│  │  assets)    │  │  routes      │  │  status per event)   │ │
│  └─────────────┘  └──────┬───────┘  └─────────────────────┘ │
│                          │                                   │
│  ┌───────────────────────┼─────────────────────────────────┐ │
│  │     D1 Database       │   Cron Trigger (every 15 min)   │ │
│  │  events, venues,      │   - Sync external events        │ │
│  │  ticket_types,        │   - Expire reservations          │ │
│  │  orders, tickets...   │   - Auto-update event status    │ │
│  └───────────────────────┘─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                              │
    Stripe API               External Event API
    (server-side)            (provider adapter)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, React Router |
| Backend | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) |
| Real-time | Durable Objects + WebSockets |
| Payments | Stripe Checkout (server-side only) |
| Scheduled | Cron Triggers (every 15 min) |
| External events | Provider adapter pattern |

## Quick Start

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A Cloudflare account

### 1. Install dependencies

```bash
cd eventpulse
npm install
```

### 2. Create D1 database

```bash
npx wrangler d1 create eventpulse
```

Copy the `database_id` from the output into `wrangler.jsonc` (replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

### 3. Run migrations and seed data (local)

```bash
npm run db:migrate:local
npm run db:seed:local
```

### 4. Configure secrets

Copy `.env.example` to `.dev.vars` and fill in your values:

```bash
cp .env.example .dev.vars
```

Edit `.dev.vars`:

```env
# Stripe (optional — demo mode works without these)
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# External event API (optional — demo seed data is used if not set)
EVENTS_API_BASE_URL=https://api.example-events.com/v1
EVENTS_API_KEY=your_api_key
EVENTS_API_NAME=my-provider

# Organizer auth token (required for organizer dashboard)
ORGANIZER_TOKEN=generate_a_long_random_string

# App base URL
APP_BASE_URL=http://localhost:8787
```

### 5. Local development

**Terminal 1 — Vite dev server (frontend):**
```bash
npm run dev
```
Runs at `http://localhost:5173`

**Terminal 2 — Wrangler dev (Worker + D1 + DO):**
```bash
npm run dev:worker
```
Runs at `http://localhost:8787`

> **Note:** For full-stack local dev with D1 and Durable Objects, use the Wrangler dev server at `:8787`. The Vite dev server at `:5173` is for frontend-only hot reload.

### 6. Build and deploy

```bash
npm run build      # Build the React SPA
npm run deploy     # Deploy Worker + assets to Cloudflare
```

### 7. Run migrations on production

```bash
npm run db:migrate:prod
npm run db:seed:prod
```

### 8. Set production secrets

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put ORGANIZER_TOKEN
wrangler secret put EVENTS_API_KEY
```

## Configuration

### Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
3. Set `STRIPE_SECRET_KEY` as a Worker secret
4. Create a webhook endpoint pointing to `https://your-domain.com/api/payments/webhook`
5. Get the webhook signing secret and set `STRIPE_WEBHOOK_SECRET`
6. Set `APP_BASE_URL` to your deployed domain

**Without Stripe configured**, the app runs in demo mode — checkout is simulated with no real charges.

### Webhook Setup

1. In the Stripe Dashboard, go to Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/payments/webhook`
3. Subscribe to `checkout.session.completed` events
4. Copy the signing secret → `wrangler secret put STRIPE_WEBHOOK_SECRET`

For local webhook testing:
```bash
stripe listen --forward-to localhost:8787/api/payments/webhook
```

### Event API Configuration

The provider adapter fetches external events and normalizes them into the internal schema. Configure via environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `EVENTS_API_BASE_URL` | Base URL of the external event API | No |
| `EVENTS_API_KEY` | API key for authentication | No |
| `EVENTS_API_NAME` | Provider name for source tagging | No (default: `demo`) |

If no credentials are configured, the app uses seed data clearly labeled as **DEMO**.

The external API is expected to return JSON with events that include:
- `id`, `title`, `description`, `category`
- `startTime`/`start_time`, `endTime`/`end_time`, `timezone`
- `venue`/`venueName`, `city`, `country`
- `imageUrl`/`image_url`, `ticketUrl`/`ticket_url`
- `minPrice`/`min_price`, `maxPrice`/`max_price`
- `availableTickets`/`available_tickets`

Events are de-duplicated by `(source, sourceEventId)`.

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/events` | — | List/search events |
| GET | `/api/events/:id` | — | Event detail with ticket tiers |
| GET | `/api/events/cities` | — | Distinct cities (for filters) |
| GET | `/api/events/venues` | — | All venues (for filters) |
| POST | `/api/events/sync` | — | Trigger external event sync |
| GET | `/api/cart` | Session | Get current cart |
| POST | `/api/cart` | Session | Add tickets to cart |
| PATCH | `/api/cart/:id` | Session | Update ticket quantity |
| DELETE | `/api/cart/:id` | Session | Remove tickets from cart |
| POST | `/api/checkout/session` | Session | Create checkout session |
| GET | `/api/checkout/confirm` | — | Demo checkout confirmation |
| POST | `/api/payments/webhook` | Stripe sig | Payment webhook handler |
| GET | `/api/orders` | Session | List user's orders |
| GET | `/api/tickets` | Session | List user's tickets |
| POST | `/api/organizer/events` | Organizer | Create event |
| PATCH | `/api/organizer/events/:id` | Organizer | Update event status/details |
| POST | `/api/organizer/ticket-types` | Organizer | Add ticket tier |
| GET | `/api/organizer/orders` | Organizer | View all orders |
| GET | `/api/live/:eventId` | — | WebSocket upgrade or polling fallback |
| GET | `/api/health` | — | Health check |

## Database Schema

11 tables: `users`, `organizers`, `events`, `venues`, `ticket_types`, `ticket_reservations`, `carts`, `orders`, `order_items`, `tickets`, `event_updates`, `webhook_events`.

See `migrations/0001_init.sql` for the full schema.

## Real-Time Features

- **Durable Object per event** — one DO instance per event ID
- **WebSocket** — clients connect to `/api/live/:eventId` for live updates
- **Broadcasts**: status changes (scheduled→live→ended), inventory changes, reservation expiry, cancellations
- **Polling fallback** — if WebSocket fails, the frontend polls every 15 seconds
- **Stale data detection** — warns if no update received in 60 seconds
- **Auto-reconnect** — WebSocket reconnects 3 seconds after closing

## Security

- ✅ All prices, quantities, and totals are recalculated server-side
- ✅ Stripe secret keys never exposed to browser
- ✅ Webhook signatures verified via HMAC-SHA256
- ✅ Webhook idempotency via `webhook_events` table
- ✅ Duplicate order prevention
- ✅ Reservation expiry (10-min TTL) with automatic cleanup
- ✅ CORS, security headers (CSP, HSTS, X-Frame-Options, etc.)
- ✅ Rate limiting on all API routes
- ✅ Request body validation on all mutations
- ✅ Organizer routes protected by bearer token
- ✅ No raw card data processed in-app (Stripe Checkout redirect)

## Tests

```bash
npm test
```

Test coverage:
- **Ticket inventory** — quantity validation, availability checks, max-per-order
- **Checkout totals** — server-side recalculation, rounding, empty cart
- **Webhook verification** — HMAC signature validation, timestamp freshness, idempotency
- **Duplicate events** — de-duplication by (source, sourceEventId)
- **Reservation expiration** — TTL, expiry detection, time-until-expiry

## Project Structure

```
eventpulse/
├── migrations/
│   ├── 0001_init.sql          # D1 schema (11 tables)
│   └── 0002_seed.sql          # Demo seed data
├── src/
│   ├── shared/
│   │   └── types.ts           # Shared TypeScript types
│   ├── worker/
│   │   ├── index.ts           # Worker entry (fetch + scheduled)
│   │   ├── types.ts           # Worker-specific types
│   │   ├── db/
│   │   │   └── queries.ts     # D1 query functions
│   │   ├── do/
│   │   │   └── EventStatusDO.ts  # Durable Object
│   │   ├── lib/
│   │   │   ├── pricing.ts     # Server-side price calculation
│   │   │   ├── reservations.ts # Reservation TTL logic
│   │   │   ├── stripe.ts      # Stripe API + webhook verification
│   │   │   └── auth.ts        # Session + organizer auth
│   │   ├── middleware/
│   │   │   └── index.ts       # CORS, security headers, rate limit, validation
│   │   ├── providers/
│   │   │   ├── adapter.ts     # Event provider adapter + de-duplication
│   │   │   └── sync.ts        # External event sync logic
│   │   └── routes/
│   │       ├── events.ts      # GET /api/events
│   │       ├── cart.ts        # POST/PATCH/DELETE /api/cart
│   │       ├── checkout.ts    # POST /api/checkout/session
│   │       ├── payments.ts    # POST /api/payments/webhook
│   │       ├── orders.ts      # GET /api/orders, /api/tickets
│   │       ├── organizer.ts   # Organizer CRUD routes
│   │       └── live.ts        # GET /api/live/:eventId (WebSocket)
│   └── frontend/
│       ├── main.tsx           # React entry
│       ├── App.tsx            # Router
│       ├── index.css          # Dark navy/violet/cyan theme
│       ├── api.ts             # API client
│       ├── hooks/
│       │   ├── useLiveStatus.ts  # WebSocket + polling fallback
│       │   └── useCart.ts        # Cart state management
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── StatusBadge.tsx
│       │   └── EventCard.tsx
│       └── pages/
│           ├── Discover.tsx
│           ├── HappeningNow.tsx
│           ├── EventDetails.tsx
│           ├── Cart.tsx
│           ├── Checkout.tsx
│           ├── CheckoutConfirm.tsx
│           ├── MyTickets.tsx
│           └── OrganizerDashboard.tsx
├── tests/                     # Vitest test suites
├── package.json
├── wrangler.jsonc             # Worker config (D1, DO, cron, assets)
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── README.md
```

## Important Notes

- **Demo data**: Seed events are clearly labeled as `DEMO`. They are not real events.
- **Demo payments**: Without `STRIPE_SECRET_KEY`, checkout is simulated. No real charges occur.
- **Demo QR codes**: Ticket QR codes are placeholders. Replace with signed QR tokens for production use.
- **Taxes**: Tax calculation is a placeholder (0%). Implement jurisdiction-based tax logic for production.
- **Auth**: The organizer token is a simple bearer token. For production, integrate Cloudflare Access or a full identity provider.

## License

MIT
