# 02 · Conflict — Pipeline

**Status: PLANNED.** No conflict ingestor exists. This is the intended design,
modelled on the IMPLEMENTED disasters ingestor
(`lib/intel/domains/disasters.ts`), which already reuses every primitive a
conflict ingestor would need.

## Intended stages

1. **Fetch** — per-source provider (ACLED / ReliefWeb / GDELT events). Zod-parse
   the payload; handle source quirks (ACLED OAuth token, GDELT plain-text
   rejection).
2. **Transform** — map each source record to `VaultEvent` with `kind: "conflict"`
   and `IdOf.event(provider, providerId)`.
3. **Geolocate** — use reported lat/lon (basis `reported`); if absent, fall back
   to `nearestCountry(point)` (basis `spatially-near`) — exactly as disasters
   does. Never geocode from ambiguous text.
4. **Persist** — `upsertEvent()` → `events` (`kind="conflict"`) + `fts_events` +
   `provenance`.
5. **Link** — `linkEventCountry(id, iso2, basis)` → `relationships`
   (`OCCURRED_IN`, confidence 0.85 reported / 0.6 spatially-near).

All of steps 3–5 use IMPLEMENTED code (`resolve.ts`, `enrich.ts`,
`repositories.ts`); only the source fetch/transform (step 1–2) is missing.

## Registration (PLANNED)

Add `conflict: () => ingestConflict()` to `INGESTORS` in
`lib/intel/registry.ts`, then it becomes available via
`pnpm intel:sync conflict` and, if added to `UPDATE_ORDER`, to
`pnpm intel:update`. The CLI framework (`runIngestor`, `writeStatus`, counters,
failure isolation) needs no changes.

## Cadence & TTL (planned)

| Source | minInterval | cacheTtl | polling |
|---|---|---|---|
| reliefweb | (default 5s) | 3600s (1h) | yes |
| acled | (default 5s) | 3600s (1h) | yes |
| gdelt events | 6s | 120s | yes |

## Tables & columns (target — all exist today)

- **`events`** — `id, kind, subtype, title, summary, severity, occurred_at,
  published_at, lat, lon, country_code, source, source_url, confidence, tags,
  provenance, updated_at`. Indexes: `kind`, `occurred_at`, `country_code`.
- **`fts_events`** — FTS5 (`id UNINDEXED, title, body`).
- **`relationships`**, **`provenance`** — shared.

## Provenance & retention (planned)

Each event would carry provenance with source-specific license/attribution
(ACLED licence / OCHA ReliefWeb / The GDELT Project) and `retrievedAt`. Upserts
idempotent on `event:<provider>:<id>`. Redistribution-restricted sources (ACLED)
constrain what may be re-served — store attributed, derived events per terms.

## Not built yet

`lib/intel/domains/conflict.ts`, per-source conflict providers, and the ACLED
OAuth token flow. Wiring **ReliefWeb** first (free) is the recommended start.
