// Re-export shared types for the Worker.
export * from "../../shared/types";

// Worker-specific types

export interface CartSession {
  sessionId: string;
  userId: string | null;
}

export interface CheckoutTotals {
  subtotal: number;
  fees: number;
  taxes: number;
  total: number;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  category: string;
  venueId: string;
  organizerId: string;
  imageUrl?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  featured?: boolean;
  ticketTypes?: CreateTicketTypeInput[];
}

export interface CreateTicketTypeInput {
  name: string;
  description?: string;
  price: number;
  fees?: number;
  totalQuantity: number;
  saleStart?: string;
  saleEnd?: string;
}

export interface CheckoutInput {
  customerName: string;
  customerEmail: string;
  attendeeDetails?: string;
}

export interface AddToCartInput {
  ticketTypeId: string;
  quantity: number;
}

export interface UpdateCartInput {
  quantity: number;
}
