# 03 — Aviation · Pipeline

## Stages

1. **Fetch** — `fetchOpenSkyStates()` GETs `https://opensky-network.org/api/states/all`.
2. **Validate** — envelope validated with `ResponseSchema`; each tuple read by
   column index; rows failing `isValidPoint` dropped.
3. **Bound** — `ingestAviationSnapshot(limit = 2000)` takes `states.slice(0, limit)`.
4. **Upsert** — one row per `icao24` written to `aircraft` (position overwritten
   on conflict). Counters `fetched`/`created` incremented per row.
5. **Report** — wrapped by `runIngestor({ domain: "aviation", source: "opensky",
   job: "aircraft-snapshot" })`, returning an `IngestReport`.

## CLI

```
pnpm intel:sync aviation
```

Aviation is **not** part of `BOOTSTRAP_ORDER` / `UPDATE_ORDER` — it is run
on-demand. `--limit <n>` overrides the 2000 cap. After sync the CLI writes
status and the global snapshot.

## Cadence / TTL

| Setting | Value | Source |
|---|---|---|
| Min interval | 10s | `acquisition.minIntervalSec` |
| Cache TTL | 10s | `acquisition.cacheTtlSec` |
| Provider TTL | 10,000 ms | `openSkyProvider.ttlMs` |
| Freshness SLA | 30s | provider `FRESHNESS_SLA_S` |
| Default bound | 2000 rows | ingestor `limit` |

## SQLite tables + real columns

**`aircraft`** (populated; migration v1):

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `aircraft:<icao24>` |
| `icao24` | TEXT | 24-bit hex address |
| `callsign` | TEXT | broadcast callsign or null |
| `country` | TEXT | origin country |
| `lat`, `lon`, `alt` | REAL | last position, baro altitude (m) |
| `velocity` | REAL | m/s |
| `heading` | REAL | true track deg |
| `on_ground` | INTEGER | 0/1 |
| `last_contact` | TEXT | ISO timestamp |
| `provenance` | TEXT | JSON provenance array |
| `updated_at` | TEXT | ISO write time |

**`airports`** (schema only, empty): `id, icao, iata, name, country_code, lat,
lon, type, data, provenance`.

## Provenance

Each state carries `makeProvenance({ provider: "opensky", providerRecordId:
icao24, sourceUrl: "https://opensky-network.org/", observedAt, confidence,
rawObjectHash })`, serialized into the `aircraft.provenance` JSON column.
Aircraft rows do **not** write into the global `provenance` table (unlike
vessels/events) — the ingestor writes the JSON blob inline.

## Retention

Snapshot-only: latest position per aircraft via upsert. No history, no
downsampling. The DB is **gitignored**, so the table only reflects the last
local `sync aviation`. There is no TTL sweep — stale rows persist until
overwritten or the DB is rebuilt.
