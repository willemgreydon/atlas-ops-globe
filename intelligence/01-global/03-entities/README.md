# 03 — Global Entities

The global domain's canonical entity is `Country`. It also owns the `Region`
type. All other domains resolve to these via ISO codes or nearest centroid.

## Canonical entity types (from `lib/intel/ontology.ts`)

| Entity type | Role in global |
|---|---|
| `Country` | Primary — one row per ISO2 country, seeded from Natural Earth |
| `Region` | Supra-national grouping (e.g. World Bank region) |

Every seeded country is written both to the `countries` table and, as a generic
node, to the `entities` table with `type = "Country"` (see `upsertCountry` in
`lib/intel/repositories.ts`).

## Universal ID scheme (from `lib/intel/ids.ts`)

IDs are `type:key`. A provider-specific ID is never the primary identity; where
an authoritative universal identifier exists (here, the ISO2 code) it is the key.

| Helper | Format | Example |
|---|---|---|
| `IdOf.country(iso2)` | `country:<ISO2 upper>` | `country:AT`, `country:US` |
| `IdOf.region(code)` | `region:<CODE upper>` | `region:EU` |

`typeOfId("country:AT")` → `"country"`.

## Key attributes (`VaultCountry` → `countries` table)

| Attribute | Notes |
|---|---|
| `iso2` | Primary key, uppercase 2-letter ISO |
| `iso3` | 3-letter ISO |
| `name` | Country name |
| `region` | Optional region grouping |
| `capital` | Optional capital city |
| `lat` / `lon` | Centroid coordinates |
| `data` | Free-form JSON bag |
| `provenance` | Array of provenance records (Natural Earth seed) |

## Example entity node

```json
{
  "id": "country:AT",
  "type": "Country",
  "name": "Austria",
  "countryCode": "AT",
  "lat": 47.6,
  "lon": 14.1,
  "data": {},
  "provenance": [{ "provider": "naturalearth", "retrievedAt": "2026-08-20T00:00:00Z" }]
}
```
