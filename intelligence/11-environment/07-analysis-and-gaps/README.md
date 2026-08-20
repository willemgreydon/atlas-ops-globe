# 11 — Environment · Analysis & Gaps (PLANNED)

Environment is scaffolded. `docs/08-intelligence/coverage-gaps.md`:
*"Environment overlaps EONET (via disasters) but has no dedicated live
ingestion."* This section describes intended analytics.

## Intended metrics

- **Air-quality index by area/time** — latest/mean `pm2_5`, `pm10`, `no2`, etc.
  per region, sliceable by `observed_at` (time-slider).
- **Exceedance flags** — observations over WHO/EU thresholds (e.g. PM2.5 > 15
  µg/m³ daily).
- **Anomaly detection** — SST/NDVI/soil-moisture vs seasonal baseline.
- **Plume/extent tracking** — dust/smoke raster extents `OVERLAPS` countries.
- **Coverage & freshness** — variables present, station/grid density, mean
  observation age, % with `temporalPrecision = hour`.

## Example queries (PLANNED)

```sql
-- Latest PM2.5 per location (once populated)
SELECT lat, lon, value, observed_at FROM weather_observations
WHERE variable='pm2_5' ORDER BY observed_at DESC LIMIT 100;

-- Time-slider: air quality at a moment
SELECT variable, value, unit FROM weather_observations
WHERE observed_at = ?1 AND lat BETWEEN ?2 AND ?3;

-- Countries under a dust plume
SELECT r.to_id FROM relationships r
JOIN entities e ON e.id=r.from_id
WHERE e.type='EnvironmentalObservation'
  AND json_extract(e.data,'$.variable')='dust' AND r.type='OVERLAPS';
```

All return **0 rows today**.

## Coverage gaps (HONEST)

- **No dedicated ingestion.** `INGESTORS["environment"]` absent; only the EONET
  overlap (via disasters) exists, and it produces `DisasterEvent`, not
  `EnvironmentalObservation`.
- **Open-Meteo not wired.** `openmeteo` is `next`/`enabled:false`;
  `weather_observations` is empty.
- **No env schema / writer.** No `VaultEnvObs` Zod type and no
  `upsertWeatherObs` in `repositories.ts` — both planned.
- **Raster sources unwired.** CAMS/NASA/NOAA/Sentinel are planned; the
  external-reference storage convention exists only on paper.
- **License caution.** CAMS/Sentinel are `review-required`; Open-Meteo
  redistribution `review-required`.

## Quality & raster discipline

When live: `VaultQuality` (`temporalPrecision`, `geoPrecision`), explicit
observation time for the time-slider, multi-source provenance. **Raster stays
external** — the vault stores metadata + references, never pixel blobs. Until
ingestion exists, all environment metrics are aspirational and must not be
presented as measured.
