// Event provider adapter — normalizes external event APIs into the
// internal NormalizedEvent schema. De-duplicates by (source, sourceEventId).
//
// Environment variables (set as Worker secrets / vars):
//   EVENTS_API_BASE_URL — base URL of the external event API
//   EVENTS_API_KEY      — API key for the external event API
//   EVENTS_API_NAME     — provider name for source tagging (default: "demo")
//
// If no credentials are configured, falls back to seed/demo data.

import type { EventProvider, NormalizedEvent, Env } from "../../shared/types";

// ── External API Provider ───────────────────────────────────────
export class ExternalEventProvider implements EventProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private name: string
  ) {}

  get isConfigured(): boolean {
    return !!this.baseUrl && !!this.apiKey;
  }

  async fetchEvents(): Promise<NormalizedEvent[]> {
    if (!this.isConfigured) return [];

    try {
      const resp = await fetch(`${this.baseUrl}/events`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      if (!resp.ok) {
        throw new Error(`External API returned ${resp.status}`);
      }

      const data = await resp.json();
      const rawEvents = Array.isArray(data) ? data : data.events ?? [];
      return rawEvents.map((e: any) => this.normalize(e));
    } catch (err) {
      console.error("ExternalEventProvider.fetchEvents error:", err);
      throw err;
    }
  }

  private normalize(raw: any): NormalizedEvent {
    const timezone = raw.timezone || "UTC";
    const startTime = safeToUTC(raw.startTime, raw.start_time, timezone);
    const endTime = safeToUTC(raw.endTime, raw.end_time, timezone);

    return {
      id: `${this.name}_${raw.id}`,
      title: String(raw.title ?? "Untitled Event"),
      description: raw.description ?? null,
      category: normalizeCategory(raw.category),
      venue: String(raw.venue ?? raw.venueName ?? "TBA"),
      city: String(raw.city ?? "Unknown"),
      country: String(raw.country ?? "US"),
      startTime,
      endTime,
      timezone,
      imageUrl: raw.imageUrl ?? raw.image_url ?? null,
      status: normalizeStatus(raw.status, startTime, endTime),
      ticketUrl: raw.ticketUrl ?? raw.ticket_url ?? null,
      minPrice: raw.minPrice ?? raw.min_price ?? null,
      maxPrice: raw.maxPrice ?? raw.max_price ?? null,
      availableTickets: raw.availableTickets ?? raw.available_tickets ?? null,
      source: this.name,
      sourceEventId: String(raw.id),
    };
  }
}

// ── Provider factory ─────────────────────────────────────────────
export function getProvider(env: Pick<Env, "EVENTS_API_BASE_URL" | "EVENTS_API_KEY" | "EVENTS_API_NAME">): EventProvider {
  const name = env.EVENTS_API_NAME || "demo";
  if (env.EVENTS_API_BASE_URL && env.EVENTS_API_KEY) {
    return new ExternalEventProvider(env.EVENTS_API_BASE_URL, env.EVENTS_API_KEY, name);
  }
  // No credentials → demo provider (returns empty; seed data is used instead)
  return {
    name: "demo",
    isConfigured: false,
    async fetchEvents() {
      return [];
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────
function safeToUTC(...candidates: any[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function normalizeCategory(cat: any): NormalizedEvent["category"] {
  const valid = ["concert", "sports", "theater", "festival", "conference", "nightlife"];
  const lower = String(cat ?? "").toLowerCase();
  return (valid.includes(lower) ? lower : "concert") as NormalizedEvent["category"];
}

function normalizeStatus(
  status: any,
  startTime: string,
  endTime: string
): NormalizedEvent["status"] {
  if (status && ["scheduled", "live", "ended", "cancelled", "postponed", "paused"].includes(status)) {
    return status;
  }
  // Derive from time
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (now >= start && now < end) return "live";
  if (now >= end) return "ended";
  return "scheduled";
}

// ── De-duplication ──────────────────────────────────────────────
export function deduplicateEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Set<string>();
  const result: NormalizedEvent[] = [];
  for (const e of events) {
    const key = `${e.source}:${e.sourceEventId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(e);
  }
  return result;
}
