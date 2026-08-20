# 04 — Maritime · Pipeline

## Stages

1. **Credential gate** — `ingestMaritime` checks `marineTrafficConfigured()`. If
   `MARINETRAFFIC_API_KEY` is unset it **throws** `"… credential-required
   (OFFLINE)"` — the job fails fast, never mocks data as live.
2. **Chokepoint scan** — iterates the 9 `CHOKEPOINTS` serially
   (`mapPool(CHOKEPOINTS, 1, …)`) with `limiter.wait("marinetraffic", 1500)`
   pacing before each call (credit-metered courtesy).
3. **Fetch** — `fetchVesselsInBounds(cp.bounds, { timespanMin: 60 })` calls PS07
   `exportvessels` for that bbox. On error: `c.failed++`, count recorded as 0
   for that chokepoint (scan continues).
4. **Normalize** — `normalizeVessels` validates, filters, converts speed.
5. **Upsert** — each vessel `upsertVessel(v)` → `vessels` table + `provenance`
   table. Counters `fetched`/`created` incremented.
6. **Snapshot** — writes `intelligence/04-maritime/snapshots/chokepoints-latest.json`
   with `{ generatedAt, chokepoints: { <id>: { name, vessels } } }` (gitignored).

## CLI

```
pnpm intel:sync maritime
```

Wrapped by `runIngestor({ domain: "maritime", source: "marinetraffic", job:
"chokepoint-scan" })`.

## Cadence / TTL

| Setting | Value |
|---|---|
| Min interval | 2s (`acquisition.minIntervalSec`) |
| Cache TTL | 60s (`acquisition.cacheTtlSec`) |
| Per-chokepoint pacing | 1500 ms (`limiter.wait`) |
| Concurrency | 1 (serial) |
| Position age window | `timespan=60` min |

## SQLite tables + real columns

**`vessels`** (populated only when keyed; migration v1):

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `vessel:imo-…` / `vessel:mmsi-…` |
| `imo`, `mmsi` | TEXT | IMO-first identity |
| `name`, `vessel_type`, `flag` | TEXT | |
| `lat`, `lon` | REAL | required position |
| `speed`, `course` | REAL | knots (÷10), course deg |
| `nav_status` | TEXT | AIS status |
| `destination`, `eta` | TEXT | reported voyage hints |
| `last_contact` | TEXT | ISO |
| `provenance` | TEXT | JSON array |
| `updated_at` | TEXT | ISO |

> Note: `headingDeg` is normalized by the adapter but the `vessels` INSERT maps
> `speed`, `course`, `nav_status` — heading is not persisted to its own column.

**`ports`** (schema only, empty): `id, unlocode, name, country_code, lat, lon,
data, provenance`.

## Provenance

`upsertVessel` writes provenance into the shared `provenance` table (keyed by
`subject_id = vessel id`): provider `marinetraffic`, dataset `exportvessels`,
`providerRecordId` (SHIP_ID/MMSI/IMO), license "Property of Kpler /
MarineTraffic (credential-gated)", attribution "MarineTraffic".

## Retention

Upsert per vessel id (latest position wins). The DB and
`chokepoints-latest.json` are **gitignored** — coverage reflects the last local
keyed sync. Empty when unkeyed (OFFLINE).
