// Auth middleware — separates customer and organizer permissions.
// Uses a simple bearer-token scheme for organizer routes.
// In production, replace with Cloudflare Access or a full identity provider.

import type { Context } from "hono";

export interface AuthContext {
  isOrganizer: boolean;
  isCustomer: boolean;
  userId: string | null;
  sessionId: string;
}

export function getSessionId(c: Context): string {
  // Use the Authorization header bearer token or a cookie-based session ID.
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookie = c.req.header("Cookie");
  if (cookie) {
    const match = cookie.match(/ep_session=([^;]+)/);
    if (match) return match[1];
  }
  // Fall back to a generated ephemeral session — the client should send a stable ID.
  return crypto.randomUUID();
}

export function verifyOrganizerToken(
  c: Context,
  expectedToken: string | undefined
): boolean {
  if (!expectedToken) return false;
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === expectedToken;
}
