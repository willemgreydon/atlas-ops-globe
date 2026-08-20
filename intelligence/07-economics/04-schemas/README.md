# 07 · Economics — Schemas

Canonical schema: **`VaultEconomicObs`** in `lib/intel/schemas.ts` (Zod).
World Bank payloads are validated against the tuple schemas in
`lib/providers/worldbank.ts`, transformed into observations, then validated
against `VaultEconomicObs` before storage.

## `VaultEconomicObs` fields

| Field | Zod type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | `econobs:CC:INDICATOR:PERIOD` |
| `countryCode` | string | yes | ISO2 |
| `indicator` | string | yes | World Bank code |
| `label` | string | yes | human-readable name |
| `unit` | string | no | e.g. `US$`, `%` |
| `frequency` | string | no | `"annual"` |
| `period` | string | yes | year (e.g. `"2023"`) |
| `value` | number \| null | yes | null allowed by schema, but null values are skipped at ingest |
| `provider` | string | yes | `"worldbank"` |
| `provenance` | `VaultProvenance[]` | dflt `[]` | see below |

## Provider source schemas (`worldbank.ts`)

- `CountryMetaSchema = z.tuple([unknown, [ {id, iso2Code?, name?, region?,
  capitalCity?, longitude?, latitude?} ] | null ])`
- `IndicatorSchema = z.tuple([unknown, [ {indicator:{id,value}, date, value} ]
  | null ])`

The leading `unknown` is the pagination meta object; the second element is the
(nullable) data array. `mrnev=1` yields the latest non-empty value.

## Provenance (`VaultProvenance`)

Each observation gets one row: `provider: "worldbank"`, `dataset: <indicator
code>`, `providerRecordId: "<iso3>:<code>:<year>"`,
`observedAt: "<year>-12-31"`, `license: "CC BY 4.0"`,
`attribution: "World Bank Open Data"`, `retrievedAt` (now),
`transformation: { pipeline: "vault", version }`.

## Validation, skipping & idempotency

- Provider Zod tuple parse rejects malformed responses; a failed indicator fetch
  is caught and returns `{ value: null }` (never throws through the pool).
- Ingest skips any indicator with `value == null` or no `year` (`c.skipped++`).
- `upsertEconomicObs()` uses `ON CONFLICT(id) DO UPDATE SET value, provenance`,
  so re-sync overwrites in place — no duplicates, latest value wins.

## Example canonical record

```json
{
  "id": "econobs:AT:NY.GDP.MKTP.CD:2023",
  "countryCode": "AT",
  "indicator": "NY.GDP.MKTP.CD",
  "label": "GDP",
  "unit": "US$",
  "frequency": "annual",
  "period": "2023",
  "value": 516075000000,
  "provider": "worldbank",
  "provenance": [
    {
      "provider": "worldbank",
      "dataset": "NY.GDP.MKTP.CD",
      "providerRecordId": "AUT:NY.GDP.MKTP.CD:2023",
      "observedAt": "2023-12-31",
      "license": "CC BY 4.0",
      "attribution": "World Bank Open Data",
      "retrievedAt": "2026-08-20T09:20:11Z"
    }
  ]
}
```
