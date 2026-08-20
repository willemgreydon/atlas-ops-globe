# aviation

**Status: Implemented (snapshot-only)**

## Purpose
Live aircraft situational awareness: a latest-position snapshot of airborne
aircraft. Reference airport data is planned.

## Current sources
- **OpenSky Network** (`opensky`) — live state-vector snapshot, on-demand.
  Stores only the latest position per aircraft (upsert), bounded by `--limit`
  (default 2000). Gitignored, not committed.
- **OurAirports** (`ourairports`, `next`) — ~78k airport reference CSV;
  adapter present but **not loaded** this cycle.

## Canonical entities
- `Aircraft`, `Flight`, `Airport`, `Airline` (aircraft populated; airports
  planned).

## Update frequency
- On-demand snapshot. min interval 10s, cache TTL 10s. Not part of the default
  bootstrap/update order; run via `pnpm intel:sync aviation`.

## Storage
- `aircraft` table (snapshot upsert). `airports` schema exists but is empty.

## Known limitations
- Snapshot-only — no historical trajectories or downsampling.
- Airport reference not loaded; `airports` table empty.

## Licensing considerations
- OpenSky non-commercial/research — commercial use and redistribution
  **restricted**; attribution required ("The OpenSky Network").
- OurAirports is public domain.

## Next sources
- Load OurAirports airport reference; historical trajectory storage.
