# 04 — Maritime · Analysis & Gaps

## Derived metrics

- **Chokepoint transit counts** — per-geofence vessel totals, written to
  `chokepoints-latest.json` on each keyed scan.
- **Vessels by flag / type** — `GROUP BY flag`, `GROUP BY vessel_type`.
- **Congestion proxy** — vessel density per chokepoint bbox over time.
- **Signal gaps** — vessels whose `last_contact` is older than the scan window
  (60 min). Reported neutrally as a **signal gap**, never an accusation.

## Example SQL

```sql
-- Vessels currently in the Suez bbox
SELECT id, name, flag, speed FROM vessels
WHERE lat BETWEEN 29.9 AND 31.3 AND lon BETWEEN 32.2 AND 32.6;

-- Flag distribution
SELECT flag, COUNT(*) n FROM vessels GROUP BY flag ORDER BY n DESC;

-- Stale positions (signal gaps)
SELECT id, name, last_contact FROM vessels
WHERE last_contact < datetime('now', '-60 minutes');

-- Slow / stopped vessels
SELECT id, name, speed FROM vessels WHERE speed IS NOT NULL AND speed < 1;
```

## Example API query

```
GET /api/intelligence/maritime?bbox=55.0,25.5,57.2,27.1
→ { data: [...vessels], page: {...},
    provider: "marinetraffic",
    status: "live" | "offline",   // "offline" until MARINETRAFFIC_API_KEY is set
    attribution: "MarineTraffic" }
```

`bbox` is `west,south,east,north`. The endpoint reports `status` honestly: it is
`offline` whenever the credential is absent, even though the schema/table exist.

## Coverage gaps

- **OFFLINE without a credential.** MarineTraffic is credit-metered and gated;
  with no `MARINETRAFFIC_API_KEY` the `vessels` table is **empty** and the API
  returns `status: "offline"`. This is the primary gap.
- **Only `exportvessels` wired.** `exportvessel`, `exportvesseltrack`,
  `portcalls`, `port-congestion`, `shipsearch` exist at the provider but are not
  implemented — so no per-vessel track history, port calls, or congestion feeds.
- **AISstream not wired.** The second maritime source is credential-required and
  has no adapter.
- **No Port reference.** `ports` schema exists but is empty; no UN/LOCODE seed →
  no `DEPARTED_FROM` / `ARRIVED_AT` resolution.
- **9 chokepoints only.** Coverage is scoped to the defined geofences, not open
  ocean or arbitrary bboxes (the API supports any bbox, the scan does not).

## Data-quality notes

- **Speed units:** raw `SPEED` is knots×10; adapter divides by 10. A missed
  conversion elsewhere would inflate speeds 10×.
- **`"0"` sentinel:** unknown IMO/MMSI is `"0"` and treated as absent; records
  with neither identifier are dropped.
- **Self-reported fields:** `DESTINATION`, `ETA`, `STATUS` are AIS-crew entered,
  often stale or free-text — treat as low-confidence.
- **Licensing:** data is Property of Kpler — commercial use and redistribution
  are **restricted**; attribution to "MarineTraffic" is required. The DB and
  snapshot are gitignored.
