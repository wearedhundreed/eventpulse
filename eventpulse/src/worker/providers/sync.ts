// Event sync logic — fetches events from the external provider,
// normalizes them, de-duplicates, and upserts into D1.
// Called by the cron trigger and the POST /api/events/sync endpoint.

import type { Env, NormalizedEvent } from "../../shared/types";
import { getProvider, deduplicateEvents } from "./adapter";
import { nowUTC, uuid } from "../db/queries";

export interface SyncResult {
  fetched: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: string[];
  source: string;
  isDemo: boolean;
}

export async function syncEvents(env: Env): Promise<SyncResult> {
  const provider = getProvider(env);
  const result: SyncResult = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    duplicates: 0,
    errors: [],
    source: provider.name,
    isDemo: !provider.isConfigured,
  };

  let events: NormalizedEvent[] = [];
  try {
    events = await provider.fetchEvents();
  } catch (err: any) {
    result.errors.push(err.message);
    return result;
  }

  result.fetched = events.length;
  const deduped = deduplicateEvents(events);
  result.duplicates = events.length - deduped.length;

  for (const e of deduped) {
    try {
      // Find or create venue
      const venueId = await findOrCreateVenue(env, e);
      // Upsert event by (source, sourceEventId)
      const existing = await env.DB
        .prepare(
          "SELECT id FROM events WHERE source = ? AND source_event_id = ?"
        )
        .bind(e.source, e.sourceEventId)
        .first();

      if (existing) {
        await env.DB
          .prepare(
            `UPDATE events SET
              title = ?, description = ?, category = ?, image_url = ?,
              start_time = ?, end_time = ?, timezone = ?, status = ?,
              ticket_url = ?, min_price = ?, max_price = ?, available_tickets = ?,
              updated_at = ?
            WHERE id = ?`
          )
          .bind(
            e.title, e.description, e.category, e.imageUrl,
            e.startTime, e.endTime, e.timezone, e.status,
            e.ticketUrl, e.minPrice, e.maxPrice, e.availableTickets,
            nowUTC(), (existing as any).id
          )
          .run();
        result.updated++;
      } else {
        const eventId = uuid();
        await env.DB
          .prepare(
            `INSERT INTO events
              (id, organizer_id, venue_id, title, description, category, image_url,
               start_time, end_time, timezone, status, source, source_event_id,
               ticket_url, min_price, max_price, available_tickets, featured, published)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`
          )
          .bind(
            eventId, venueId, e.title, e.description, e.category, e.imageUrl,
            e.startTime, e.endTime, e.timezone, e.status, e.source, e.sourceEventId,
            e.ticketUrl, e.minPrice, e.maxPrice, e.availableTickets
          )
          .run();
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Event ${e.sourceEventId}: ${err.message}`);
    }
  }

  return result;
}

async function findOrCreateVenue(env: Env, e: NormalizedEvent): Promise<string> {
  // Try to find by name + city
  const existing = await env.DB
    .prepare("SELECT id FROM venues WHERE name = ? AND city = ?")
    .bind(e.venue, e.city)
    .first();

  if (existing) return (existing as any).id;

  const venueId = uuid();
  await env.DB
    .prepare(
      `INSERT INTO venues (id, name, city, country, timezone)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(venueId, e.venue, e.city, e.country, e.timezone)
    .run();
  return venueId;
}
