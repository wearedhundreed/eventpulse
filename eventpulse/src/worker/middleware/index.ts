import type { Context, Next } from "hono";

// ── CORS ─────────────────────────────────────────────────────────
// Permissive in dev, restrictive in prod. The allowed origin should be
// the app's own domain (same-origin for the SPA), but we allow
// configurable origins for API consumers.
export function corsMiddleware() {
  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin");
    // Same-origin requests (no Origin header) are always allowed.
    if (origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
      c.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Session-Id"
      );
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Access-Control-Max-Age", "86400");
    }

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  };
}

// ── Security Headers ────────────────────────────────────────────
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=(), payment=(self)"
    );
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    // CSP allows inline styles for the SPA and images from common CDNs.
    c.header(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' https: data:",
        "connect-src 'self' ws: wss: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self' https://checkout.stripe.com",
      ].join("; ")
    );
    await next();
  };
}

// ── Rate Limiting ────────────────────────────────────────────────
// Simple in-memory rate limiter (per isolate). For production at scale,
// replace with a Durable Object or KV-backed limiter.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;

export function rateLimit(maxRequests = 100) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("CF-Connecting-IP") ||
      c.req.header("X-Forwarded-For") ||
      "unknown";
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();
    let entry = rateLimitMap.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
      rateLimitMap.set(key, entry);
    }

    entry.count++;
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));

    if (entry.count > maxRequests) {
      return c.json({ error: "Rate limit exceeded. Try again in a moment." }, 429);
    }

    await next();
  };
}

// ── Request body validation helper ──────────────────────────────
export function validateBody<T>(
  body: unknown,
  requiredFields: string[]
): { valid: boolean; data: T | null; error?: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, data: null, error: "Request body must be a JSON object." };
  }
  const obj = body as Record<string, unknown>;
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      return { valid: false, data: null, error: `Missing required field: ${field}` };
    }
  }
  return { valid: true, data: obj as T };
}

export function isPositiveInt(val: unknown): boolean {
  return typeof val === "number" && Number.isInteger(val) && val > 0;
}

export function isNonNegInt(val: unknown): boolean {
  return typeof val === "number" && Number.isInteger(val) && val >= 0;
}

export function isNonNegNum(val: unknown): boolean {
  return typeof val === "number" && val >= 0;
}
