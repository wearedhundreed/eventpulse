import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { EventGrid, LoadingState, EmptyState, ErrorState } from "../components/EventCard";
import type { EventListItem } from "../../shared/types";

export default function Discover() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [cities, setCities] = useState<string[]>([]);

  const categories = ["concert", "sports", "theater", "festival", "conference", "nightlife"];

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { events } = await api.getEvents({
        search: search || undefined,
        city: city || undefined,
        category: category || undefined,
      });
      setEvents(events);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, city, category]);

  useEffect(() => {
    api.getCities().then(({ cities }) => setCities(cities)).catch(() => {});
    fetchEvents();
  }, [fetchEvents]);

  const now = Date.now();
  const happeningNow = events.filter((e) => {
    const start = new Date(e.startTime).getTime();
    const end = new Date(e.endTime).getTime();
    return now >= start && now < end;
  });
  const startingSoon = events.filter((e) => {
    const start = new Date(e.startTime).getTime();
    const diff = start - now;
    return diff > 0 && diff < 2 * 60 * 60 * 1000; // within 2 hours
  });
  const upcoming = events.filter((e) => {
    const start = new Date(e.startTime).getTime();
    return start > now + 2 * 60 * 60 * 1000;
  });
  const featured = events.filter((e) => e.featured);

  const hasDemo = events.some((e) => e.isDemo);

  return (
    <div className="container">
      <section className="hero">
        <h1>Discover Live Events</h1>
        <p>Find concerts, sports, theater, festivals, and more — with real-time availability.</p>
      </section>

      {hasDemo && (
        <div className="demo-banner">
          ⚠ Showing demo data. Configure EVENTS_API_BASE_URL and EVENTS_API_KEY to fetch live events.
        </div>
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by keyword…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchEvents()}
        />
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <button className="btn-search" onClick={fetchEvents}>Search</button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={fetchEvents} />}
      {!loading && !error && events.length === 0 && (
        <EmptyState message="No events found. Try adjusting your search." />
      )}

      {!loading && !error && events.length > 0 && (
        <>
          {featured.length > 0 && (
            <>
              <div className="section-header">
                <h2>⭐ Featured</h2>
              </div>
              <EventGrid events={featured} />
            </>
          )}

          {happeningNow.length > 0 && (
            <>
              <div className="section-header">
                <h2><span className="live-dot" /> Happening Now</h2>
              </div>
              <EventGrid events={happeningNow} />
            </>
          )}

          {startingSoon.length > 0 && (
            <>
              <div className="section-header">
                <h2>⏰ Starting Soon</h2>
              </div>
              <EventGrid events={startingSoon} />
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <div className="section-header">
                <h2>📅 Upcoming</h2>
              </div>
              <EventGrid events={upcoming} />
            </>
          )}
        </>
      )}
    </div>
  );
}
