# 09 — Energy · Pipeline (PLANNED)

**Nothing is wired.** There is no `energy` ingestor in `lib/intel/registry.ts`
(`INGESTORS["energy"]` is undefined). `bin/intel.ts sync energy` therefore prints
`! unknown domain: energy`. This section documents the intended pipeline.

## Intended flow

1. **Acquire** — per planned source (see 02-sources), respecting each
   `SourceAcquisition` (`minIntervalSec`, `cacheTtlSec`, `concurrency`,
   `maxRetries`). GEM/EIA are the primary asset inventories; ENTSO-E/Eurostat add
   flows and balances; OSM/Overpass fills geometry gaps.
2. **Validate (source schema)** — provider-specific Zod schema per adapter.
3. **Transform → canonical** — map to `VaultEntity` (type `EnergyAsset`) with the
   planned `EnergyAssetData` payload; resolve country via
   `resolve` (nearest-centroid → `spatially-near` basis when no ISO code).
4. **Entity-resolve operators** — link `operator`/`owner` to `Organization`
   entities (blocked on the Wikidata adapter, status `next`).
5. **Upsert** — via `upsertEntity()` in `repositories.ts` (idempotent
   `ON CONFLICT(id)`), which also writes `provenance` and syncs `fts_entities`.

## Target tables (from `migrations.ts`)

Reuses the **generic** store — no dedicated energy table exists:

- `entities(id, type, name, country_code, lat, lon, data, quality,
  first_seen_at, last_seen_at)` — `type = 'EnergyAsset'`; energy payload in
  `data` (JSON). Indexed by `idx_entities_type`, `idx_entities_country`.
- `relationships(...)` — asset↔asset and asset↔country edges (see 06).
- `provenance(subject_id, provider, dataset, source_url, license, attribution,
  retrieved_at, confidence, …)` — one row per contributing source.
- `fts_entities(id, name, aliases)` — full-text over asset names.

## Planned CLI

- `pnpm intel:sync energy` — sync this domain (once `INGESTORS["energy"]` exists).
- `pnpm intel:status` / `intel:stats` — would surface `EnergyAsset` counts under
  the `entities` total (no dedicated stat row today).
- `pnpm intel:index` — re-emit `_core` artifacts + snapshots.

## Cadence (planned)

- GEM / EIA capacity registries: **weekly–monthly** (`cacheTtlSec: 86400`).
- ENTSO-E flows/load: **hourly** where operational awareness is needed.
- OSM/Overpass geometry: **monthly** (`cacheTtlSec: 604800`).

## Provenance & raster

Energy is vector/tabular — no raster handling. Every asset carries ≥1
`VaultProvenance` record; multi-source assets accumulate provenance rows and set
`quality.sourceAgreement`. Attribution strings (e.g. "Global Energy Monitor",
"World Bank") are stored per the source's `attributionRequired` flag.
