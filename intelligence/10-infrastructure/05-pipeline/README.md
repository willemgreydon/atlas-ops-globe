# 10 — Infrastructure · Pipeline (PLANNED)

**Not wired.** No `infrastructure` ingestor exists in `lib/intel/registry.ts`
(`INGESTORS["infrastructure"]` undefined), so `bin/intel.ts sync infrastructure`
prints `! unknown domain: infrastructure`. The one registered source
(`ourairports`) is `next`/`enabled:false` and **not bulk-loaded** — the
`airports` table is empty. This is the intended pipeline.

## Intended flow

1. **Acquire** — bulk CSV (OurAirports) and Overpass/Geofabrik OSM extracts,
   honoring each `SourceAcquisition`. OurAirports: `cacheTtlSec: 604800`;
   Overpass: `minIntervalSec: 10`, `concurrency: 1`.
2. **Validate (source schema)** — CSV row schema / OSM tag schema per adapter.
3. **Transform → canonical** — map to `VaultEntity` (`Airport`/`Port`/
   `InfrastructureAsset`); resolve country via `resolve` (ISO code where present,
   else nearest-centroid → `spatially-near`).
4. **Upsert** — dedicated-table rows for airports/ports; generic `entities`
   rows for other subtypes; provenance written per source.

## Target tables (from `migrations.ts`)

- `airports(id, icao, iata, name, country_code, lat, lon, type, data,
  provenance)` — schema present, unpopulated.
- `ports(id, unlocode, name, country_code, lat, lon, data, provenance)` —
  schema present, unpopulated.
- `entities(id, type, name, country_code, lat, lon, data, quality, …)` —
  `type = 'InfrastructureAsset'` for non-airport/port assets.
- `relationships(...)`, `provenance(...)`, `fts_entities(id, name, aliases)`.

Note: `repositories.ts` has upserts for entities/countries/events/etc. but **no**
`upsertAirport`/`upsertPort` helper yet — writing to `airports`/`ports` is a
planned repository addition. `tableCounts()` already lists `airports`/`ports`
(both return 0).

## Planned CLI

- `pnpm intel:sync infrastructure` (once `INGESTORS["infrastructure"]` exists).
- `pnpm intel:status`/`intel:stats` already print `Airports` and `Ports` rows
  (currently 0).
- `pnpm intel:index` — re-emit `_core` artifacts + snapshots.

## Cadence (planned)

- OurAirports bulk: **weekly** (`cacheTtlSec` 7d). OSM/Geofabrik: **monthly**.
- Government registries: per-portal update frequency (often quarterly).

## Provenance & raster

Vector/tabular only — no raster. Each asset carries ≥1 `VaultProvenance`;
ODbL-sourced assets (OSM/Geofabrik/OpenInfraMap) record attribution and the
`review-required` redistribution stance. Multi-source assets set
`quality.sourceAgreement`.
