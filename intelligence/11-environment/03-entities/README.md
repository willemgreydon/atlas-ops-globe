# 11 — Environment · Entities (PLANNED)

This domain owns one `ENTITY_TYPES` member from `lib/intel/ontology.ts`:
`EnvironmentalObservation`. It also shares `DisasterEvent` (produced by EONET
under disasters). Nothing environment-specific is populated today.

## Canonical types

- **`EnvironmentalObservation`** — a point/area measurement of an environmental
  variable at a time. Station/point observations map cleanly onto the existing
  `weather_observations` table (variable/value/unit/observed_at). Raster products
  are represented as an `EnvironmentalObservation` *entity* in `entities` whose
  `data` holds the extent + external reference (no pixels).
- **`DisasterEvent`** — shared, comes from EONET (see disasters domain).

## Universal identity (`lib/intel/ids.ts`)

`ids.ts` has **no** minter for environmental observations. Planned:
- point/station: reuse the weather pattern —
  `stableId("envobs", provider, variable, lat, lon, observedAt)`.
- raster product: `stableId("envraster", provider, dataset, variable, timeSlice)`
  → `envraster:<hash>`.

Both link to `IdOf.country(iso2)` where an area resolves to a country.

## Tracked variables (planned)

Air quality: `pm2_5`, `pm10`, `no2`, `so2`, `co`, `ozone`, `aerosol`, `dust`,
`smoke`. Also: water quality, vegetation (NDVI), drought index, soil moisture,
sea-surface temperature (`sst`), ice/sea-ice concentration.

## Planned fields

For point observations (via `weather_observations` columns): `lat`, `lon`,
`observed_at`, `variable`, `value`, `unit`, `provider`.

For raster `EnvironmentalObservation.data`:
- `variable`, `dataset`, `provider`
- `validTime` (the observation/target time — supports the time-slider)
- `bbox` / `extent`, `crs`, `resolution`
- `externalUrl` / `objectStoreKey` — pointer to the raster (NOT the data)
- `format` (NetCDF | GeoTIFF | GRIB), `sizeBytes`

Quality via `VaultQuality` (`temporalPrecision`, `geoPrecision`,
`entityConfidence`). Time-awareness is first-class: every observation carries an
explicit observation/valid time for slider queries.
