# 03 — Aviation · Analysis & Gaps

## Derived metrics (from the `aircraft` snapshot)

- **Airborne count** — `COUNT(*) WHERE on_ground = 0`.
- **Fleet by origin country** — `GROUP BY country`.
- **Density over a bbox** — count within lat/lon bounds (e.g. a chokepoint).
- **Stale contacts** — rows whose `last_contact` is older than the freshness
  SLA (30s), indicating a missed/aged state.

There is no `/api/intelligence/aviation` endpoint today; aviation is queried
directly from SQLite or joined via the `entities` table by prefix.

## Example SQL

```sql
-- Airborne aircraft right now (snapshot)
SELECT COUNT(*) FROM aircraft WHERE on_ground = 0;

-- Top origin countries
SELECT country, COUNT(*) n FROM aircraft
GROUP BY country ORDER BY n DESC LIMIT 20;

-- Aircraft over the Strait of Hormuz bbox
SELECT id, callsign, alt, velocity FROM aircraft
WHERE lat BETWEEN 25.5 AND 27.1 AND lon BETWEEN 55.0 AND 57.2;

-- Aged contacts (possible signal loss)
SELECT id, last_contact FROM aircraft
WHERE last_contact < datetime('now', '-2 minutes');
```

## Example API query (generic entity read)

No aviation-specific route exists, but stats include aircraft:

```
GET /api/intelligence/stats   → counts.aircraft (snapshot row count)
```

## Coverage gaps

- **Snapshot-only.** Latest position per aircraft (upsert), bounded ~2000,
  gitignored. **No historical trajectories, no downsampling** — this is future
  work.
- **Bound truncation.** Only the first `limit` (default 2000) states are stored;
  OpenSky may return more. Unlike space, this cap is **not logged**.
- **Airport reference not loaded.** `ourairports` (~78k, status NEXT) is not
  bulk-loaded; the `airports` table is empty, so no airport joins are possible.
- **No Flight / Airline entities.** Callsign is a raw column, not a resolved
  entity; no `OPERATED_BY` / `DEPARTED_FROM` / `ARRIVED_AT` edges.
- **On-demand only.** Not in `BOOTSTRAP_ORDER`/`UPDATE_ORDER`; freshness depends
  entirely on the last manual `sync aviation`.

## Data-quality notes

- `callsign`, `velocity`, `heading`, `on_ground` may be null when not broadcast.
- Position rows failing `isValidPoint` are dropped at the provider boundary.
- `country` is the **airframe registration** origin, not the live flight origin.
- Confidence (~0.85 base) degrades with contact age vs the 30s SLA.
- Licensing: OpenSky is non-commercial/research — commercial use and
  redistribution are **restricted**; attribution to "The OpenSky Network" is
  required.
