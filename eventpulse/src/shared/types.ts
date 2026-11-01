// Shared types used by both Worker and frontend.

export type EventStatus =
  | "scheduled"
  | "live"
  | "ended"
  | "cancelled"
  | "postponed"
  | "paused";

export type EventCategory =
  | "concert"
  | "sports"
  | "theater"
  | "festival"
  | "conference"
  | "nightlife";

export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded";

export type TicketStatus = "issued" | "checked_in" | "voided";

export type ReservationStatus = "active" | "expired" | "released" | "fulfilled";

// ── Normalized external event schema ────────────────────────────
export interface NormalizedEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  venue: string;
  city: string;
  country: string;
  startTime: string; // ISO 8601 UTC
  endTime: string; // ISO 8601 UTC
  timezone: string;
  imageUrl: string | null;
  status: EventStatus;
  ticketUrl: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  availableTickets: number | null;
  source: string;
  sourceEventId: string;
}

// ── API response shapes ──────────────────────────────────────────
export interface EventListItem {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  imageUrl: string | null;
  startTime: string;
  endTime: string;
  timezone: string;
  venueName: string | null;
  city: string | null;
  country: string | null;
  status: EventStatus;
  minPrice: number | null;
  maxPrice: number | null;
  availableTickets: number;
  featured: boolean;
  source: string;
  isDemo: boolean;
}

export interface EventDetail extends EventListItem {
  organizerName: string | null;
  venueAddress: string | null;
  venueCapacity: number | null;
  ticketTypes: TicketTypeDTO[];
}

export interface TicketTypeDTO {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  price: number;
  fees: number;
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface CartItemDTO {
  ticketTypeId: string;
  eventId: string;
  eventTitle: string;
  ticketTypeName: string;
  unitPrice: number;
  fees: number;
  quantity: number;
  lineTotal: number;
  reservationId: string;
  reservationExpiresAt: string;
}

export interface CartDTO {
  id: string;
  sessionId: string;
  items: CartItemDTO[];
  subtotal: number;
  fees: number;
  taxes: number;
  total: number;
}

export interface OrderDTO {
  id: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  subtotal: number;
  fees: number;
  taxes: number;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItemDTO[];
  tickets: TicketDTO[];
}

export interface OrderItemDTO {
  id: string;
  ticketTypeName: string;
  unitPrice: number;
  fees: number;
  quantity: number;
  lineTotal: number;
  eventTitle: string;
  eventStartTime: string;
}

export interface TicketDTO {
  id: string;
  qrToken: string;
  ticketTypeName: string;
  eventTitle: string;
  eventStartTime: string;
  eventVenue: string | null;
  eventCity: string | null;
  status: TicketStatus;
  seatInfo: string | null;
}

// ── WebSocket messages ──────────────────────────────────────────
export type LiveMessage =
  | { type: "subscribe"; eventId: string }
  | { type: "unsubscribe"; eventId: string }
  | {
      type: "status_update";
      eventId: string;
      status: EventStatus;
      availableTickets: number;
      timestamp: string;
    }
  | { type: "ping" }
  | { type: "pong" };

// ── Provider adapter ─────────────────────────────────────────────
export interface EventProvider {
  name: string;
  isConfigured: boolean;
  fetchEvents(): Promise<NormalizedEvent[]>;
}

// ── Env bindings ─────────────────────────────────────────────────
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  EVENT_STATUS: DurableObjectNamespace;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  EVENTS_API_BASE_URL: string;
  EVENTS_API_KEY: string;
  EVENTS_API_NAME: string;
  ORGANIZER_TOKEN: string;
  APP_BASE_URL: string;
}
