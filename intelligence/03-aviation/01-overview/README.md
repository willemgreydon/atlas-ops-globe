# 03 — Aviation

**Mission.** Provide a live, honest snapshot of airborne aircraft positions
(ADS-B) as the aviation layer of the Intelligence Vault, and hold the canonical
entity model (Aircraft, Flight, Airport, Airline) for future enrichment.

## Status: IMPLEMENTED (snapshot-only)

The aviation ingestor is wired and runs live against OpenSky. It is deliberately
**snapshot-only**: it stores the latest position per aircraft (upsert), bounded
to ~2000 rows, in the **gitignored** SQLite DB. There are no historical
trajectories, no downsampling, and no airport reference loaded yet.

| Aspect | Value |
|---|---|
| Live source | `opensky` (OpenSky Network, ADS-B live states) — IMPLEMENTED |
| Planned source | `ourairports` (~78k airport reference) — status **NEXT** (not loaded) |
| Auth | anonymous today; optional `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` for higher limits |
| Canonical entities | Aircraft, Flight, Airport, Airline |
| SQLite tables | `aircraft` (populated, snapshot), `airports` (schema only, empty) |
| Universal ID | `aircraft:icao24-<hex>` (lowercased) |
| CLI | `pnpm intel:sync aviation` |
| Bound | latest position per aircraft, capped at `limit` (default **2000**) |
| Persistence | gitignored DB — counts are only as fresh as the last local sync |

### At a glance

- **`aircraft` table:** populated on each `sync aviation` run, one row per
  `icao24`, position overwritten on conflict (upsert).
- **`airports` table:** schema exists (migration v1) but is **unpopulated** —
  `ourairports` is not bulk-loaded this cycle (status NEXT).
- **Flight / Airline:** ontology types only; no flight or airline records are
  ingested today (PLANNED).

## Contents

- [02-sources](../02-sources/README.md) — OpenSky (live) + OurAirports (planned) dossiers
- [03-entities](../03-entities/README.md) — Aircraft, Flight, Airport, Airline + universal IDs
- [04-schemas](../04-schemas/README.md) — normalized record shape + example
- [05-pipeline](../05-pipeline/README.md) — snapshot pipeline, CLI, cadence, `aircraft` columns
- [06-relationships](../06-relationships/README.md) — cross-domain edges (conservative)
- [07-analysis-and-gaps](../07-analysis-and-gaps/README.md) — metrics, queries, gaps
