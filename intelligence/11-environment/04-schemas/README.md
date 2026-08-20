# 11 — Environment · Schemas (PLANNED)

`lib/intel/schemas.ts` has **no** `EnvironmentalObservation` schema. Point
observations reuse the shape backing the existing `weather_observations` table;
raster products reuse the generic `VaultEntity` with an external-reference `data`
payload. "EXISTING" = in `schemas.ts`/`migrations.ts`; "PLANNED" = additions.

## EXISTING — `weather_observations` table (reused for point data)

```sql
CREATE TABLE weather_observations (
  id TEXT PRIMARY KEY, lat REAL, lon REAL, observed_at TEXT, variable TEXT,
  value REAL, unit TEXT, provider TEXT, provenance TEXT
);
```
There is currently **no** Zod schema mirroring this table — adding a
`VaultWeatherObs` / `VaultEnvObs` schema is planned.

## PLANNED — `VaultEnvObs` (point observation)

```ts
const VaultEnvObs = z.object({
  id: z.string(),
  lat: z.number(), lon: z.number(),
  observedAt: z.string(),            // ISO time — drives the time-slider
  variable: z.enum(["pm2_5","pm10","no2","so2","co","ozone","aerosol",
    "dust","smoke","sst","ndvi","soil_moisture","drought","sea_ice"]),
  value: z.number().nullable(),
  unit: z.string().optional(),
  provider: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
```

## PLANNED — raster reference (via existing `VaultEntity`)

```json
{
  "id": "envraster:cams-pm25-2026-08-20T00",
  "type": "EnvironmentalObservation",
  "name": "CAMS PM2.5 surface — 2026-08-20T00Z",
  "lat": 48.2, "lon": 16.4,
  "data": {
    "variable": "pm2_5", "dataset": "CAMS global forecast",
    "validTime": "2026-08-20T00:00:00Z",
    "bbox": [-25, 30, 45, 72], "crs": "EPSG:4326",
    "format": "NetCDF",
    "externalUrl": "s3://atlas-rasters/cams/pm25/2026-08-20T00.nc"
  },
  "quality": { "temporalPrecision": "hour", "geoPrecision": "region" },
  "provenance": [{ "provider": "cams", "retrievedAt": "2026-08-20T01:00:00Z",
    "license": "Copernicus licence", "rawPath": "s3://atlas-rasters/…" }]
}
```

## Example JSON (PLANNED — point obs)

```json
{ "id": "envobs:openmeteo:pm2_5:48.2:16.4:2026-08-20T00",
  "lat": 48.2, "lon": 16.4, "observedAt": "2026-08-20T00:00:00Z",
  "variable": "pm2_5", "value": 12.4, "unit": "µg/m³", "provider": "openmeteo",
  "provenance": [{ "provider": "openmeteo", "retrievedAt": "2026-08-20T00:05:00Z",
    "license": "CC BY 4.0", "attribution": "Open-Meteo (CC BY 4.0)" }] }
```

**Raster discipline:** the `data` blob holds a *reference* (`externalUrl` /
object-store key) and metadata — never the raster payload. `provenance.rawPath`
/`rawHash` track the external artifact. All rows above are illustrative; the
tables are empty.
