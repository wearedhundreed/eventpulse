// API client for the frontend — all requests go to /api/* on the same origin.

import type {
  EventListItem,
  EventDetail,
  CartDTO,
  OrderDTO,
} from "../../shared/types";

const SESSION_KEY = "ep_session_id";

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Session-Id": getSessionId(),
    ...(options.headers as Record<string, string>),
  };

  const resp = await fetch(path, { ...options, headers });

  if (!resp.ok) {
    let message = `Request failed (${resp.status})`;
    try {
      const body = await resp.json();
      message = body.error || message;
    } catch {}
    throw new Error(message);
  }

  return resp.json() as Promise<T>;
}

// ── Events ────────────────────────────────────────────────────────
export const api = {
  getEvents(params?: {
    search?: string;
    city?: string;
    category?: string;
    venueId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ events: EventListItem[]; count: number }> {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) qs.set(k, v);
      }
    }
    const query = qs.toString();
    return apiFetch(`/api/events${query ? `?${query}` : ""}`);
  },

  getEvent(id: string): Promise<{ event: EventDetail }> {
    return apiFetch(`/api/events/${id}`);
  },

  getCities(): Promise<{ cities: string[] }> {
    return apiFetch("/api/events/cities");
  },

  getVenues(): Promise<{ venues: any[] }> {
    return apiFetch("/api/events/venues");
  },

  syncEvents(): Promise<any> {
    return apiFetch("/api/events/sync", { method: "POST" });
  },

  // ── Cart ──────────────────────────────────────────────────────
  getCart(): Promise<{ cart: CartDTO }> {
    return apiFetch("/api/cart");
  },

  addToCart(ticketTypeId: string, quantity: number): Promise<{ cart: CartDTO; reservationId: string }> {
    return apiFetch("/api/cart", {
      method: "POST",
      body: JSON.stringify({ ticketTypeId, quantity }),
    });
  },

  updateCart(reservationId: string, quantity: number): Promise<{ cart: CartDTO }> {
    return apiFetch(`/api/cart/${reservationId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    });
  },

  removeFromCart(reservationId: string): Promise<{ cart: CartDTO }> {
    return apiFetch(`/api/cart/${reservationId}`, { method: "DELETE" });
  },

  // ── Checkout ──────────────────────────────────────────────────
  createCheckoutSession(data: {
    customerName: string;
    customerEmail: string;
    attendeeDetails?: string;
  }): Promise<{ checkoutUrl: string; isDemo: boolean; orderId: string }> {
    return apiFetch("/api/checkout/session", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  confirmDemoCheckout(orderId: string): Promise<{ orderId: string; status: string }> {
    return apiFetch(`/api/checkout/confirm?order=${orderId}`);
  },

  // ── Orders & Tickets ──────────────────────────────────────────
  getOrders(): Promise<{ orders: OrderDTO[] }> {
    return apiFetch("/api/orders");
  },

  getTickets(): Promise<{ tickets: any[] }> {
    return apiFetch("/api/tickets");
  },

  // ── Organizer ──────────────────────────────────────────────────
  organizerEvents(data: any): Promise<any> {
    return apiFetch("/api/organizer/events", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${localStorage.getItem("ep_organizer_token") || ""}` },
    });
  },

  updateOrganizerEvent(id: string, data: any): Promise<any> {
    return apiFetch(`/api/organizer/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${localStorage.getItem("ep_organizer_token") || ""}` },
    });
  },

  createTicketType(data: any): Promise<any> {
    return apiFetch("/api/organizer/ticket-types", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${localStorage.getItem("ep_organizer_token") || ""}` },
    });
  },

  getOrganizerOrders(): Promise<any> {
    return apiFetch("/api/organizer/orders", {
      headers: { Authorization: `Bearer ${localStorage.getItem("ep_organizer_token") || ""}` },
    });
  },

  // ── Chat ──────────────────────────────────────────────────────
  getChatMessages(): Promise<{ messages: any[] }> {
    return apiFetch("/api/chat/messages");
  },

  sendChatMessage(message: string, sender: string): Promise<any> {
    return apiFetch("/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ message, sender }),
    });
  },

  // ── Health ────────────────────────────────────────────────────
  health(): Promise<any> {
    return apiFetch("/api/health");
  },
};
