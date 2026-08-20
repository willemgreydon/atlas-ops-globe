# 12 — Weather · Analysis & Gaps (PLANNED)

Weather is scaffolded. `docs/08-intelligence/coverage-gaps.md`:
*"`openmeteo` (free, `next`) is not wired; `weather_observations` is empty."*
This section describes intended analytics.

## Intended metrics

- **Current conditions per location** — latest value per `variable` at a point.
- **Forecast timeline** — value by `targetAt` for a location (the time-slider
  over future state), grouped by issue time for skill comparison.
- **Threshold/alert flags** — wind > 25 m/s, precipitation > 50 mm/24h, extreme
  temperature, active storms/lightning.
- **Asset/event exposure** — assets `AFFECTED_BY` a WeatherSystem within a
  time+space window.
- **Coverage & freshness** — variables present, point density, mean observation
  age, % `temporalPrecision = hour`.

## Example queries (PLANNED)

```sql
-- Latest temperature per location (once populated)
SELECT lat, lon, value, observed_at FROM weather_observations
WHERE variable='temperature' ORDER BY observed_at DESC LIMIT 100;

-- High-wind points in a window
SELECT lat, lon, value, unit FROM weather_observations
WHERE variable='wind_speed' AND value > 25 AND observed_at BETWEEN ?1 AND ?2;

-- Airports affected by a weather system
SELECT r.from_id FROM relationships r
WHERE r.type='AFFECTED_BY' AND r.to_id LIKE 'wxsystem:%';
```

All return **0 rows today**.

## Coverage gaps (HONEST)

- **No live ingestion.** `INGESTORS["weather"]` absent; `openmeteo`
  `next`/`enabled:false`; `weather_observations` empty.
- **No weather schema / writer.** No `VaultWeatherObs`/`VaultWeatherForecast`
  Zod types and no `upsertWeatherObs` in `repositories.ts` — all planned.
- **Forecast entities not in ontology.** `WeatherForecast`/`WeatherSystem` are
  planned `ENTITY_TYPES` additions; only `WeatherObservation` exists today.
- **ECMWF/NOAA/DWD/MET Norway unwired.** Only Open-Meteo is registered.
- **License caution.** Open-Meteo redistribution `review-required`; ECMWF full
  IFS licensed (`review-required`).

## Quality & discipline

When live: `VaultQuality` (`temporalPrecision`, `geoPrecision`), multi-source
provenance, conservative confidence. **Forecast issue time and target time stay
separate** (target drives temporal joins; issue is provenance). **Raster GRIB
model output stays external** — vault stores references + metadata, not pixels.
Until ingestion exists, all weather metrics are aspirational and must not be
presented as measured.
