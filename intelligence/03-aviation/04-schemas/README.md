# 03 — Aviation · Schemas

Aviation has **no dedicated canonical Zod schema** in `lib/intel/schemas.ts`
(unlike maritime's `VaultVessel` or space's `VaultSpaceObject`). Instead:

1. The OpenSky provider validates the raw envelope with a boundary Zod schema
   and emits an `AircraftState` (from `@/types/domain`).
2. The aviation ingestor writes those fields straight into the `aircraft` SQLite
   table (no canonical vault schema in between).

## Boundary validation (provider)

`lib/providers/opensky.ts` validates the response envelope, not each field:

```ts
const StateVectorSchema = z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]));
const ResponseSchema = z.object({
  time: z.number(),
  states: z.array(StateVectorSchema).nullable().optional(),
});
```

Each state tuple is then read by **documented column index** and normalized;
rows failing `isValidPoint(point)` are dropped, never stored.

## `AircraftState` → `aircraft` row (field table)

| Field (state) | Type | Source (tuple idx) | `aircraft` column | Validation |
|---|---|---|---|---|
| `id` | string | `aircraft:${icao24}` | `id` (PK) | derived |
| `icao24` | string | idx 0 | `icao24` | `String(...)` |
| `callsign` | string? | idx 1 | `callsign` | trimmed, else null |
| `country` | string? | idx 2 (originCountry) | `country` | trimmed, else null |
| `position.lat/lon/alt` | number | idx 6 / 5 / 7 | `lat`,`lon`,`alt` | `isValidPoint` gate |
| `velocityMs` | number? | idx 9 | `velocity` | numeric or null |
| `headingDeg` | number? | idx 10 (trueTrack) | `heading` | numeric or null |
| `onGround` | bool? | idx 8 | `on_ground` (0/1) | boolean or null |
| `lastContact` | string | idx 4 → ISO | `last_contact` | epoch×1000 → ISO |
| `provenance` | array | `makeProvenance(...)` | `provenance` (JSON) | provider=opensky |

Confidence is scored (`scoreConfidence`) from source count, provider
reliability (0.85), age vs a 30s freshness SLA, and geo precision (0.95).

## Example stored record (illustrative)

```json
{
  "id": "aircraft:3c6dd2",
  "icao24": "3c6dd2",
  "callsign": "DLH8AT",
  "country": "Germany",
  "lat": 50.11,
  "lon": 8.68,
  "alt": 11277.6,
  "velocity": 241.5,
  "heading": 92.4,
  "on_ground": 0,
  "last_contact": "2026-08-20T10:14:52.000Z",
  "provenance": [{ "provider": "opensky", "providerRecordId": "3c6dd2",
    "sourceUrl": "https://opensky-network.org/", "confidence": 0.83 }]
}
```
