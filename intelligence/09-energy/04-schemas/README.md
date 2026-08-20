# 09 — Energy · Schemas (PLANNED)

No energy-specific Zod schema exists in `lib/intel/schemas.ts`. Planned energy
assets reuse the **existing** generic `VaultEntity` schema; the energy-specific
shape lives inside its untyped `data` record. Below, "EXISTING" marks shapes
already in `schemas.ts`; "PLANNED" marks the `data` contract we intend to add.

## EXISTING — `VaultEntity` (reused as-is)

```ts
VaultEntity = z.object({
  id: z.string(),
  type: z.string(),                 // "EnergyAsset"
  name: z.string(),
  countryCode: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  data: z.record(z.string(), z.unknown()).default({}),  // energy payload here
  quality: VaultQuality.optional(),
  provenance: z.array(VaultProvenance).default([]),
})
```

`VaultProvenance` (existing) carries `provider`, `dataset`, `providerRecordId`,
`sourceUrl`, `license`, `attribution`, `retrievedAt`, `confidence`.

## PLANNED — `EnergyAssetData` (the `data` contract)

A future `EnergyAssetData` Zod schema would validate `data` before storage:

```ts
const EnergyAssetData = z.object({
  subtype: z.enum(["PowerPlant","Substation","Pipeline","Refinery",
    "LNGTerminal","OilTerminal","GasStorage","Interconnector",
    "HydroelectricDam","WindFarm","SolarFarm","NuclearPlant"]),
  fuelType: z.string().optional(),
  capacityMw: z.number().nullable().optional(),
  status: z.enum(["operating","construction","planned","mothballed","retired"]).optional(),
  operator: z.string().optional(),   // resolved org entity id
  commissionedYear: z.number().optional(),
  endpoints: z.array(z.string()).optional(),   // pipelines/interconnectors
});
```

## Example JSON (PLANNED — illustrative only, not in the DB)

```json
{
  "id": "energy-asset:8f2c1d…",
  "type": "EnergyAsset",
  "name": "Dukovany Nuclear Power Station",
  "countryCode": "CZ",
  "lat": 49.085, "lon": 16.148,
  "data": {
    "subtype": "NuclearPlant",
    "fuelType": "nuclear",
    "capacityMw": 2040,
    "status": "operating",
    "reactorCount": 4,
    "operator": "org:Q9581-CEZ"
  },
  "quality": { "geoPrecision": "exact", "entityConfidence": 0.9 },
  "provenance": [{
    "provider": "gem",
    "dataset": "Global Nuclear Power Tracker",
    "retrievedAt": "2026-08-20T00:00:00Z",
    "license": "CC BY 4.0",
    "attribution": "Global Energy Monitor"
  }]
}
```

Validation contract (same as the rest of the vault): external payload → source
schema → transform → `VaultEntity` + `EnergyAssetData`. Malformed records are
logged and skipped, never stored raw.
