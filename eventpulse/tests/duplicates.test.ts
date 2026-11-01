import { describe, it, expect } from "vitest";
import { deduplicateEvents } from "../src/worker/providers/adapter";
import type { NormalizedEvent } from "../src/shared/types";

function makeEvent(source: string, sourceEventId: string, title: string = "Test"): NormalizedEvent {
  return {
    id: `${source}_${sourceEventId}`,
    title,
    description: null,
    category: "concert",
    venue: "Test Venue",
    city: "Test City",
    country: "US",
    startTime: "2026-11-01T20:00:00Z",
    endTime: "2026-11-01T23:00:00Z",
    timezone: "UTC",
    imageUrl: null,
    status: "scheduled",
    ticketUrl: null,
    minPrice: 50,
    maxPrice: 100,
    availableTickets: 100,
    source,
    sourceEventId,
  };
}

describe("Duplicate event detection", () => {
  it("removes events with same source and sourceEventId", () => {
    const events = [
      makeEvent("provider_a", "evt_1", "Event A"),
      makeEvent("provider_a", "evt_1", "Event A Duplicate"), // same source+id
      makeEvent("provider_b", "evt_1", "Event B"), // different source, same id
    ];
    const result = deduplicateEvents(events);
    expect(result.length).toBe(2);
    expect(result[0].title).toBe("Event A");
    expect(result[1].title).toBe("Event B");
  });

  it("keeps events from different sources with same sourceEventId", () => {
    const events = [
      makeEvent("source_1", "evt_100"),
      makeEvent("source_2", "evt_100"),
    ];
    const result = deduplicateEvents(events);
    expect(result.length).toBe(2);
  });

  it("keeps all unique events", () => {
    const events = [
      makeEvent("provider", "1"),
      makeEvent("provider", "2"),
      makeEvent("provider", "3"),
    ];
    const result = deduplicateEvents(events);
    expect(result.length).toBe(3);
  });

  it("handles empty array", () => {
    expect(deduplicateEvents([])).toEqual([]);
  });

  it("preserves first occurrence and drops later duplicates", () => {
    const events = [
      makeEvent("p", "1", "First"),
      makeEvent("p", "1", "Second"),
      makeEvent("p", "1", "Third"),
    ];
    const result = deduplicateEvents(events);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe("First");
  });
});
