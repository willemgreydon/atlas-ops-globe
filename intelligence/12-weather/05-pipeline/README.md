# 12 — Weather · Pipeline (PLANNED)

**Not wired.** No `weather` ingestor in `lib/intel/registry.ts`
(`INGESTORS["weather"]` undefined) → `bin/intel.ts sync weather` prints
`! unknown domain: weather`. `openmeteo` is `next`/`enabled:false` and
`weather_observations` is empty. Intended pipeline:

## Intended flow

1. **Acquire** — point queries from Open-Meteo / MET Norway / NOAA points,
   keyed to locations of interest (events, assets, cities). Honor Open-Meteo
   `SourceAcquisition` (`minIntervalSec:1`, `cacheTtlSec:900`, `concurrency:4`).
   GRIB model output (ECMWF/NOAA/DWD) handled as raster (see below).
2. **Validate (source schema)** — per-adapter source schema.
3. **Transform → canonical** — map to `VaultWeatherObs` (observations) or
   `VaultWeatherForecast` (forecasts), preserving **issue vs target** time.
4. **Country resolve** — via `resolve` where a point maps to a country.
5. **Upsert** — insert into `weather_observations` (planned repo writer);
   provenance written per source with attribution.

## Target table (from `migrations.ts`)

```
weather_observations(id, lat, lon, observed_at, variable, value, unit,
                     provider, provenance)
```
- **Columns:** `lat`, `lon` (point); `observed_at` (observation time, or forecast
  target time); `variable` (temperature | precipitation | wind | pressure |
  clouds | visibility | snow | humidity | storm | lightning); `value`, `unit`;
  `provider` (e.g. `openmeteo`); `provenance` (JSON, issue time in `publishedAt`).
- Schema present in migration 1; **empty**. No index beyond PK today.
- `repositories.ts` has **no** `upsertWeatherObs` yet — a planned addition.
  `tableCounts()` already lists `weather_observations` (0).

## Planned CLI

- `pnpm intel:sync weather` (once ingestor registered).
- `pnpm intel:update` — incremental refresh (weather would be an `UPDATE_ORDER`
  member once wired).
- `pnpm intel:index` — re-emit `_core` artifacts + snapshots.

## Cadence (planned)

- Point observations/forecasts: **15-min–hourly** (aligns with `cacheTtlSec:900`).
- Model (GRIB) refresh: per model cycle (ECMWF 2×/day, GFS 4×/day).

## Raster vs vector & provenance

- **Vector** point observations/forecasts → `weather_observations`.
- **Raster** GRIB grids → stored as **external references + metadata** (extent,
  variable, issue/target time, `externalUrl`), **never** pixel blobs in the DB.
- Every record carries ≥1 `VaultProvenance`; forecast **issue** time lives in
  `provenance.publishedAt`, target time in `observed_at` — kept distinct.
  Open-Meteo attribution ("Open-Meteo (CC BY 4.0)") recorded per its
  `attributionRequired` flag; redistribution stance is `review-required`.
