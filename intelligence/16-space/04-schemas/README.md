# 16 — Space · Schemas

The canonical schema is **`VaultSpaceObject`** (`lib/intel/schemas.ts`).
CelesTrak OMM payloads are validated against a source schema (`OmmSchema` in the
adapter), transformed (orbit derivation), then conform to `VaultSpaceObject`.

## Source validation (adapter)

```ts
const OmmSchema = z.array(z.object({
  OBJECT_NAME: z.string().optional(),
  OBJECT_ID: z.string().optional(),            // COSPAR
  NORAD_CAT_ID: z.union([z.number(), z.string()]),
  EPOCH: z.string().optional(),
  MEAN_MOTION: z.number().optional(),          // revs/day
  ECCENTRICITY: z.number().optional(),
  INCLINATION: z.number().optional(),
}));
```

## `VaultSpaceObject` field table

| Field | Type | Populated? | Source / derivation |
|---|---|---|---|
| `id` | string | yes | `satellite:norad-<id>` |
| `norad` | string | yes | `String(NORAD_CAT_ID)` |
| `cospar` | string | optional | `OBJECT_ID` |
| `name` | string | yes | `OBJECT_NAME` ?? `NORAD <id>` |
| `operator` | string | no | schema only (null via OMM) |
| `country` | string | no | schema only (null via OMM) |
| `objectType` | string | no | left `undefined` by adapter |
| `launchDate` | string | no | schema only (null via OMM) |
| `tleLine1` / `tleLine2` | string | no | schema only (not populated by OMM-JSON) |
| `epoch` | string | yes | `EPOCH` |
| `inclinationDeg` | number\|null | yes | `INCLINATION` |
| `periodMin` | number\|null | derived | `1440 / MEAN_MOTION` |
| `apogeeKm` | number\|null | derived | `a·(1+e) − Rₑ` |
| `perigeeKm` | number\|null | derived | `a·(1−e) − Rₑ` |
| `source` | string | yes | `"celestrak"` |
| `provenance` | VaultProvenance[] | yes | provider=celestrak, `rawHash` of the OMM record |

Derivation uses `MU = 398600.4418`, `Rₑ = 6378.137`, `a = cbrt(MU/n²)` with
`n = MEAN_MOTION·2π/86400`; values rounded to 0.1. If MEAN_MOTION ≤ 0, all three
derived fields are `null`.

## Example canonical record

```json
{
  "id": "satellite:norad-25544",
  "norad": "25544",
  "cospar": "1998-067A",
  "name": "ISS (ZARYA)",
  "epoch": "2026-08-20T04:12:33.000000",
  "inclinationDeg": 51.6,
  "periodMin": 92.9,
  "apogeeKm": 421.3,
  "perigeeKm": 415.7,
  "source": "celestrak",
  "provenance": [{
    "provider": "celestrak", "dataset": "active",
    "providerRecordId": "25544",
    "sourceUrl": "https://celestrak.org/",
    "observedAt": "2026-08-20T04:12:33.000000",
    "rawHash": "…"
  }]
}
```
