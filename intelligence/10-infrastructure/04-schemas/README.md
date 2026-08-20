# 10 — Infrastructure · Schemas (PLANNED)

`lib/intel/schemas.ts` has **no** dedicated airport/port/infrastructure schema.
Airports and ports have dedicated *tables* in `migrations.ts` but no canonical
Zod type — they would reuse the generic `VaultEntity` (typed `Airport`/`Port`/
`InfrastructureAsset`), with table-specific columns projected out at write time.
"EXISTING" = already in `schemas.ts`; "PLANNED" = intended additions.

## EXISTING — `VaultEntity` (reused)

```ts
VaultEntity = z.object({
  id: z.string(), type: z.string(),   // "Airport" | "Port" | "InfrastructureAsset"
  name: z.string(),
  countryCode: z.string().optional(),
  lat: z.number().optional(), lon: z.number().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  quality: VaultQuality.optional(),
  provenance: z.array(VaultProvenance).default([]),
})
```

## PLANNED — `AirportData` / `PortData` / `InfraAssetData`

```ts
const AirportData = z.object({
  icao: z.string().optional(), iata: z.string().optional(),
  type: z.enum(["large_airport","medium_airport","small_airport",
    "heliport","seaplane_base","closed"]).optional(),
  elevationFt: z.number().nullable().optional(),
});

const InfraAssetData = z.object({
  subtype: z.enum(["Railway","Highway","Bridge","Tunnel","PowerLine",
    "Pipeline","DataCenter","SubmarineCable","TelecomTower","Hospital",
    "GovernmentBuilding","IndustrialFacility","Dam","WaterInfrastructure"]),
  operator: z.string().optional(),
  status: z.enum(["operating","construction","planned","closed"]).optional(),
  osmId: z.string().optional(),
});
```

## Example JSON (PLANNED — Airport, not in DB)

```json
{
  "id": "airport:icao-EDDF",
  "type": "Airport",
  "name": "Frankfurt am Main Airport",
  "countryCode": "DE",
  "lat": 50.0333, "lon": 8.5706,
  "data": { "icao": "EDDF", "iata": "FRA", "type": "large_airport" },
  "quality": { "geoPrecision": "exact" },
  "provenance": [{
    "provider": "ourairports",
    "retrievedAt": "2026-08-20T00:00:00Z",
    "license": "Public domain"
  }]
}
```

Validation contract: external payload → source schema → transform →
`VaultEntity` + the relevant `*Data` guard; dedicated-table columns
(`icao`, `iata`, `unlocode`, …) projected during upsert. Malformed records logged
and skipped. All example rows are illustrative — the tables are empty.
