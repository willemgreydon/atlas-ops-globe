# 12 — Weather · Schemas (PLANNED)

`lib/intel/schemas.ts` has **no** weather schema. The `weather_observations`
table exists in `migrations.ts` but has no canonical Zod type — a
`VaultWeatherObs` (and a forecast/system schema) are planned additions.
"EXISTING" = in `migrations.ts`; "PLANNED" = additions.

## EXISTING — `weather_observations` table

```sql
CREATE TABLE weather_observations (
  id TEXT PRIMARY KEY, lat REAL, lon REAL, observed_at TEXT, variable TEXT,
  value REAL, unit TEXT, provider TEXT, provenance TEXT
);
```

## PLANNED — `VaultWeatherObs` (observation)

```ts
const VaultWeatherObs = z.object({
  id: z.string(),
  lat: z.number(), lon: z.number(),
  observedAt: z.string(),            // observation time (ISO)
  variable: z.enum(["temperature","precipitation","wind_speed","wind_direction",
    "pressure","clouds","visibility","snow","humidity","storm","lightning"]),
  value: z.number().nullable(),
  unit: z.string().optional(),       // °C, mm, m/s, hPa, %, km
  provider: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
```

## PLANNED — `VaultWeatherForecast`

```ts
const VaultWeatherForecast = VaultWeatherObs.extend({
  issuedAt: z.string(),              // model run / publish time  (NOT observedAt)
  targetAt: z.string(),              // predicted time
  leadTimeHours: z.number(),
  model: z.string().optional(),      // ECMWF-IFS | GFS | ICON
});
```
Forecasts would be stored in `weather_observations` with `observed_at = targetAt`
and the issue time carried in `provenance.publishedAt` — or in a dedicated
forecast table if added. **Issue and target time are never conflated.**

## Example JSON (PLANNED — observation, not in DB)

```json
{ "id": "wxobs:openmeteo:temperature:48.2:16.4:2026-08-20T12",
  "lat": 48.2, "lon": 16.4, "observedAt": "2026-08-20T12:00:00Z",
  "variable": "temperature", "value": 27.3, "unit": "°C", "provider": "openmeteo",
  "provenance": [{ "provider": "openmeteo", "retrievedAt": "2026-08-20T12:02:00Z",
    "license": "CC BY 4.0", "attribution": "Open-Meteo (CC BY 4.0)" }] }
```

## Example JSON (PLANNED — forecast)

```json
{ "id": "wxfcst:openmeteo:precipitation:48.2:16.4:2026-08-20T00:2026-08-21T12",
  "variable": "precipitation", "value": 4.2, "unit": "mm",
  "issuedAt": "2026-08-20T00:00:00Z", "targetAt": "2026-08-21T12:00:00Z",
  "leadTimeHours": 36, "model": "ECMWF-IFS", "provider": "openmeteo" }
```

Validation contract: source payload → source schema → transform → the relevant
canonical schema; malformed records logged and skipped. **Raster (GRIB) model
output is handled as external references + metadata, not pixel blobs.** All rows
illustrative; the table is empty.
