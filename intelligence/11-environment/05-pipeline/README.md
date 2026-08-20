# 11 — Environment · Pipeline (PLANNED)

**Not wired.** No `environment` ingestor in `lib/intel/registry.ts`
(`INGESTORS["environment"]` undefined) → `bin/intel.ts sync environment` prints
`! unknown domain: environment`. The only live source touching this domain is
`eonet`, whose events land under **disasters**, not here. Intended pipeline:

## Intended flow

1. **Acquire** — Open-Meteo Air Quality + EPA (point/station JSON); CAMS / NASA /
   NOAA / Sentinel (**raster** NetCDF/GeoTIFF/GRIB). Honor each
   `SourceAcquisition` (Open-Meteo `minIntervalSec:1`, `cacheTtlSec:900`).
2. **Validate (source schema)** — per-adapter source schema.
3. **Split point vs raster:**
   - **Point/station** → transform to `VaultEnvObs` → insert into
     `weather_observations`.
   - **Raster** → do **not** ingest pixels. Store the raster to
     external/object storage; write an `EnvironmentalObservation` *entity* whose
     `data` holds `externalUrl`/`objectStoreKey` + extent + `validTime`, and
     record `provenance.rawPath`/`rawHash`.
4. **Country resolve** — via `resolve` where an area maps to a country.
5. **Upsert** — `weather_observations` (planned repo writer) / `upsertEntity()`;
   provenance written per source.

## Target tables (from `migrations.ts`)

- `weather_observations(id, lat, lon, observed_at, variable, value, unit,
  provider, provenance)` — reused for **point** environmental observations
  (schema present, empty).
- `entities(...)` — `type = 'EnvironmentalObservation'` for **raster references**.
- `provenance(...)`, `relationships(...)`, `fts_entities(...)`.

Note: `repositories.ts` has no `upsertWeatherObs`/env writer yet — a planned
addition. `tableCounts()` already includes `weather_observations` (0).

## Planned CLI

- `pnpm intel:sync environment` (once ingestor registered).
- `pnpm intel:index` — re-emit `_core` artifacts + snapshots.
- `intel:status` — no dedicated env stat row today; counts fold into
  `weather_observations`/`entities`.

## Cadence & time-slider

- Air quality (Open-Meteo/CAMS): **hourly**. Vegetation/SST/soil moisture:
  **daily**. Drought/ice: **weekly**.
- **Time-slider support:** every observation carries an explicit observation /
  `validTime`, so the store can be sliced/replayed by time. Forecast vs
  observation are kept distinct via provenance `observedAt`/`publishedAt`.

## Raster handling & provenance

Raster stays external — vault holds metadata + reference only. Each record
carries ≥1 `VaultProvenance` with `license`/`attribution` (CAMS/Sentinel
`review-required`; NASA/NOAA/EPA open) and `rawPath`/`rawHash` for the external
artifact.
