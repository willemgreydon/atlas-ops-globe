# 05 — Disasters Pipeline

## Flow (`lib/intel/domains/disasters.ts`)

```
usgs (4.5_day.geojson) + eonet (events?status=open&limit=100)
  → fetch      (Promise.allSettled — one failing provider does not sink the other)
  → validate   (provider Zod schema; isValidPoint geometry filter)
  → normalize  (→ VaultEvent, kind="disaster"; severity from magnitude for USGS)
  → enrich     (country resolution: reported code, else nearestCountry() centroid)
  → store      (upsertEvent → events + FTS; linkEventCountry → relationships)
```

`storeEvents` counts `fetched`, `skipped` (invalid point), `created`, `failed`.
If a reported `countryCode` is absent, `nearestCountry(location)` supplies it and
the basis switches from `reported` to `spatially-near`.

## CLI

```
pnpm intel:sync disasters     # this domain
pnpm intel:sync --all         # all domains (writes global snapshot after)
pnpm intel:update             # incremental refresh (disasters included)
```

## Cadence / TTL

| Source | minIntervalSec | cacheTtlSec |
|---|---|---|
| usgs | 30 | 60 |
| eonet | 5 | 300 |

## SQLite tables written (real columns)

`events` (PK `id`):

```
id, kind, subtype, title, summary, severity, occurred_at, published_at,
lat, lon, country_code, source, source_url, confidence, tags, provenance, updated_at
```
Indexes: `idx_events_kind`, `idx_events_occurred`, `idx_events_country`.
`upsertEvent` also syncs `fts_events(id, title, body)`.

`relationships` (PK `id`): `id, from_id, type, to_id, basis, valid_from,
valid_to, confidence, provenance, created_at` — one `OCCURRED_IN` edge per
resolved event → country.

`provenance`: one row per event (`provider`, `providerRecordId`, `sourceUrl`,
`observedAt`, `confidence`, `retrievedAt`, …).

## Provenance & retention

- Each event carries a provenance record naming the provider (`usgs`/`eonet`),
  the provider record id, source URL, observed time, and confidence.
- USGS feed is a rolling 24h window; EONET returns currently-open events. Events
  upsert by id, so re-runs update in place rather than duplicating.
- DB is gitignored — retention is local and ephemeral.
