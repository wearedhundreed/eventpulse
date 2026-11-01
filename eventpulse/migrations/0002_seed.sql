-- EventPulse seed data — demo events clearly labeled as demo data.
-- Run locally:  npm run db:seed:local
-- Run on prod:   npm run db:seed:prod
--
-- All times are stored in UTC (ISO 8601 with Z suffix).
-- The `timezone` column tells the frontend how to display local time.

-- ── Venues ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO venues (id, name, city, country, address, capacity, timezone, latitude, longitude) VALUES
  ('venue_001', 'Pulse Arena', 'New York', 'US', '123 Stage Ave', 18000, 'America/New_York', 40.7589, -73.9851),
  ('venue_002', 'Harbor Stadium', 'Los Angeles', 'US', '45 Ocean Blvd', 50000, 'America/Los_Angeles', 34.0901, -118.4065),
  ('venue_003', 'Grand Theater', 'Chicago', 'US', '78 Wacker Dr', 3500, 'America/Chicago', 41.8827, -87.6233),
  ('venue_004', 'Sunset Park Amphitheater', 'Austin', 'US', '900 Riverside Dr', 12000, 'America/Chicago', 30.2672, -97.7431),
  ('venue_005', 'Tech Convention Center', 'San Francisco', 'US', '123 Howard St', 8000, 'America/Los_Angeles', 37.7837, -122.4090),
  ('venue_006', 'Neon Underground', 'Miami', 'US', '55 Collins Ave', 800, 'America/New_York', 25.7907, -80.1300),
  ('venue_007', 'Riverside Dome', 'Seattle', 'US', '200 Pier St', 6000, 'America/Los_Angeles', 47.6062, -122.3321),
  ('venue_008', 'Liberty Hall', 'Boston', 'US', '220 Tremont St', 2200, 'America/New_York', 42.3554, -71.0605);

-- ── Organizers ─────────────────────────────────────────────────
INSERT OR IGNORE INTO organizers (id, user_id, name, slug, bio) VALUES
  ('org_001', NULL, 'Pulse Live Productions', 'pulse-live', 'Premier live event production company.'),
  ('org_002', NULL, 'Harbor Sports Group', 'harbor-sports', 'Professional sports event management.'),
  ('org_003', NULL, 'Grand Arts Collective', 'grand-arts', 'Theater and performing arts.'),
  ('org_004', NULL, 'Festival Nation', 'festival-nation', 'Outdoor festivals and music events.');

-- ── Events (demo data — clearly labeled) ───────────────────────
-- start_time/end_time are UTC. Adjust the datetime values relative to
-- "now" when seeding in production so the statuses are meaningful.

INSERT OR IGNORE INTO events (id, organizer_id, venue_id, title, description, category, image_url, start_time, end_time, timezone, status, source, source_event_id, min_price, max_price, available_tickets, featured, published) VALUES
  -- Happening Now (started ~1h ago, ends ~2h from now)
  ('evt_001', 'org_001', 'venue_001', 'Neon Nights Live — Synthwave Concert',
   'An immersive synthwave experience with laser visuals and live electronic performance.',
   'concert', 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
   '2026-11-01T20:00:00Z', '2026-11-01T23:00:00Z', 'America/New_York',
   'live', 'demo', 'demo_evt_001', 45.00, 150.00, 320, 1, 1),

  ('evt_002', 'org_002', 'venue_002', 'Harbor FC vs. United — Championship Final',
   'The biggest match of the season. Championship final at Harbor Stadium.',
   'sports', 'https://images.unsplash.com/photo-1431324155629-1ef6fb15a381?w=800',
   '2026-11-01T19:30:00Z', '2026-11-01T21:45:00Z', 'America/Los_Angeles',
   'live', 'demo', 'demo_evt_002', 35.00, 220.00, 1500, 1, 1),

  -- Starting Soon (starts ~30 min from now)
  ('evt_003', 'org_003', 'venue_003', 'Shakespeare Reimagined — Hamlet',
   'A bold modern staging of Hamlet with an all-star cast.',
   'theater', 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
   '2026-11-01T21:30:00Z', '2026-11-01T23:45:00Z', 'America/Chicago',
   'scheduled', 'demo', 'demo_evt_003', 55.00, 120.00, 180, 0, 1),

  -- Upcoming
  ('evt_004', 'org_004', 'venue_004', 'Austin Sound Festival — Day 1',
   'Three stages, 20+ artists, food trucks, and art installations across two days.',
   'festival', 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
   '2026-11-03T16:00:00Z', '2026-11-04T02:00:00Z', 'America/Chicago',
   'scheduled', 'demo', 'demo_evt_004', 89.00, 350.00, 2400, 1, 1),

  ('evt_005', 'org_001', 'venue_005', 'AI Frontier Summit 2026',
   'Two days of keynotes, workshops, and networking with leaders in AI and cloud infrastructure.',
   'conference', 'https://images.unsplash.com/photo-1540575467063-178a50c2b87b?w=800',
   '2026-11-05T09:00:00Z', '2026-11-06T17:00:00Z', 'America/Los_Angeles',
   'scheduled', 'demo', 'demo_evt_005', 199.00, 799.00, 500, 1, 1),

  ('evt_006', 'org_001', 'venue_006', 'Midnight Bass — Neon Underground Night',
   'Underground electronic night featuring three DJs and immersive light installations.',
   'nightlife', 'https://images.unsplash.com/photo-1571266028243-d220c8c3c3c8?w=800',
   '2026-11-02T22:00:00Z', '2026-11-03T04:00:00Z', 'America/New_York',
   'scheduled', 'demo', 'demo_evt_006', 25.00, 75.00, 120, 0, 1),

  ('evt_007', 'org_002', 'venue_007', 'Seattle Storm vs. Phoenix — Basketball',
   'Regular season basketball at the Riverside Dome.',
   'sports', 'https://images.unsplash.com/photo-1546519638-68e109496ffc?w=800',
   '2026-11-02T19:00:00Z', '2026-11-02T21:30:00Z', 'America/Los_Angeles',
   'scheduled', 'demo', 'demo_evt_007', 30.00, 180.00, 800, 0, 1),

  ('evt_008', 'org_003', 'venue_008', 'Jazz at Liberty Hall — Trio Performance',
   'An intimate evening of contemporary jazz with the Marcus Hill Trio.',
   'concert', 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800',
   '2026-11-04T20:00:00Z', '2026-11-04T22:00:00Z', 'America/New_York',
   'scheduled', 'demo', 'demo_evt_008', 40.00, 85.00, 90, 0, 1),

  ('evt_009', 'org_004', 'venue_001', 'Comedy Night Live — Stand-Up Showcase',
   'Five comedians, one stage, one unforgettable night of stand-up comedy.',
   'theater', 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800',
   '2026-11-06T20:30:00Z', '2026-11-06T22:30:00Z', 'America/New_York',
   'scheduled', 'demo', 'demo_evt_009', 35.00, 65.00, 240, 0, 1),

  ('evt_010', 'org_001', 'venue_005', 'Cloud Native Conf 2026',
   'A one-day conference on cloud-native architecture, edge computing, and serverless.',
   'conference', 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800',
   '2026-11-10T09:00:00Z', '2026-11-10T18:00:00Z', 'America/Los_Angeles',
   'scheduled', 'demo', 'demo_evt_010', 149.00, 499.00, 300, 1, 1);

-- ── Ticket Types ───────────────────────────────────────────────
INSERT OR IGNORE INTO ticket_types (id, event_id, name, description, price, fees, total_quantity, sold_quantity, reserved_quantity) VALUES
  -- evt_001
  ('tt_001', 'evt_001', 'General Admission',  'Standing room, festival floor.', 45.00, 4.50, 1000, 600, 80),
  ('tt_002', 'evt_001', 'VIP Floor',           'Front section, early entry.', 95.00, 9.50, 300, 220, 0),
  ('tt_003', 'evt_001', 'VIP Lounge',          'Private lounge, open bar, meet & greet.', 150.00, 15.00, 100, 80, 0),
  -- evt_002
  ('tt_004', 'evt_002', 'Upper Bowl',          'Upper tier seating.', 35.00, 3.50, 20000, 16000, 500),
  ('tt_005', 'evt_002', 'Lower Bowl',          'Lower tier seating.', 85.00, 8.50, 15000, 12000, 0),
  ('tt_006', 'evt_002', 'Sideline Club',       'Club level, food included.', 220.00, 22.00, 2000, 1500, 0),
  -- evt_003
  ('tt_007', 'evt_003', 'Balcony',             'Balcony seating.', 55.00, 5.50, 1500, 1200, 120),
  ('tt_008', 'evt_003', 'Orchestra',           'Orchestra level seating.', 85.00, 8.50, 1000, 700, 0),
  ('tt_009', 'evt_003', 'Premium Box',         'Private box, 4 seats.', 120.00, 12.00, 100, 70, 0),
  -- evt_004
  ('tt_010', 'evt_004', 'General Pass',        'Single-day general admission.', 89.00, 8.90, 5000, 1800, 800),
  ('tt_011', 'evt_004', 'VIP Pass',            'VIP area, all stages, drinks.', 199.00, 19.90, 1000, 300, 0),
  ('tt_012', 'evt_004', 'Backstage Pass',      'Backstage access, meet & greet.', 350.00, 35.00, 100, 40, 0),
  -- evt_005
  ('tt_013', 'evt_005', 'Standard Pass',       'Both days, all sessions.', 199.00, 19.90, 1000, 400, 100),
  ('tt_014', 'evt_005', 'Workshop Add-On',     'Hands-on workshop pass.', 99.00, 9.90, 200, 80, 0),
  ('tt_015', 'evt_005', 'VIP Pass',            'VIP lounge, priority seating, networking dinner.', 799.00, 79.90, 100, 30, 0),
  -- evt_006
  ('tt_016', 'evt_006', 'General Entry',       'General admission.', 25.00, 2.50, 500, 300, 50),
  ('tt_017', 'evt_006', 'Express Entry',       'Skip the line, early entry.', 45.00, 4.50, 100, 60, 0),
  ('tt_018', 'evt_006', 'VIP Table',           'Reserved table, bottle service.', 75.00, 7.50, 40, 30, 0),
  -- evt_007
  ('tt_019', 'evt_007', 'Upper Level',         'Upper level seating.', 30.00, 3.00, 3000, 1800, 200),
  ('tt_020', 'evt_007', 'Courtside',           'Courtside seats.', 180.00, 18.00, 200, 120, 0),
  -- evt_008
  ('tt_021', 'evt_008', 'General Seating',     'General seating.', 40.00, 4.00, 1500, 1300, 80),
  ('tt_022', 'evt_008', 'Premium Seating',     'Premium front seating.', 85.00, 8.50, 500, 350, 0),
  -- evt_009
  ('tt_023', 'evt_009', 'General Admission',   'General admission seating.', 35.00, 3.50, 1000, 600, 160),
  ('tt_024', 'evt_009', 'Front Row',           'Front row seats.', 65.00, 6.50, 50, 30, 0),
  -- evt_010
  ('tt_025', 'evt_010', 'Standard Pass',       'All sessions.', 149.00, 14.90, 500, 150, 50),
  ('tt_026', 'evt_010', 'VIP Pass',            'VIP access, all sessions, lunch.', 499.00, 49.90, 50, 20, 0);
