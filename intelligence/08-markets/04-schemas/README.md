# Markets — Schemas

There is **no dedicated market Zod schema in `lib/intel/schemas.ts` yet.** The
`market_observations` table columns exist in `lib/intel/migrations.ts`, and
`MarketInstrument` / `MarketObservation` are ontology types, but the canonical
`VaultMarketObservation` schema below is **planned**, not implemented.

## Existing schemas reused (in `schemas.ts`)

- **`VaultEntity`** — generic node used for `MarketInstrument` (domain fields
  under `data`).
- **`VaultProvenance`** — lineage on every observation and instrument.
- **`VaultQuality`** — optional freshness/completeness signals.

## Planned — `VaultMarketObservation` (NOT in `schemas.ts`)

Mirrors the `market_observations` columns. A latency enum makes the freshness
label a validated, closed set:

```ts
// PLANNED — to be added to lib/intel/schemas.ts
export const VaultMarketObservation = z.object({
  id: z.string(),
  symbol: z.string(),
  assetClass: z.enum(["index","equity","fx","commodity","rate","bond","crypto"]),
  ts: z.string(),                 // ISO 8601 UTC
  value: z.number().nullable(),
  currency: z.string().optional(),
  latencyClass: z.enum(["real-time","delayed","end-of-day","historical"]),
  provider: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
```

## Planned — `VaultMarketInstrument` (NOT in `schemas.ts`)

```ts
export const VaultMarketInstrument = z.object({
  id: z.string(),                 // instrument:isin-... | instrument:<venue>-<sym>
  symbol: z.string(),
  name: z.string(),
  assetClass: z.enum(["index","equity","fx","commodity","rate","bond","crypto"]),
  currency: z.string().optional(),
  exchange: z.string().optional(),
  isin: z.string().optional(),
  figi: z.string().optional(),
  issuerId: z.string().optional(),  // org:LEI-...
  provenance: z.array(VaultProvenance).default([]),
});
```

## Example — observation JSON (planned)

```json
{
  "id": "mktobs:AAPL:2026-08-20T20:00:00Z:polygon",
  "symbol": "AAPL", "assetClass": "equity",
  "ts": "2026-08-20T20:00:00Z", "value": 231.4, "currency": "USD",
  "latencyClass": "delayed", "provider": "polygon",
  "provenance": [{
    "provider": "polygon", "sourceUrl": "https://api.polygon.io/…",
    "retrievedAt": "2026-08-20T20:15:00Z", "license": "Polygon terms"
  }]
}
```

## Example — ECB FX reference (planned)

```json
{
  "id": "mktobs:EURUSD:2026-08-20:ecb", "symbol": "EURUSD", "assetClass": "fx",
  "ts": "2026-08-20T00:00:00Z", "value": 1.0842, "currency": "USD",
  "latencyClass": "end-of-day", "provider": "ecb",
  "provenance": [{ "provider": "ecb", "retrievedAt": "2026-08-20T14:15:00Z",
    "license": "ECB open data", "attribution": "European Central Bank" }]
}
```

Validation discipline (from `schemas.ts`): provider payloads validate against a
per-provider source schema, transform to the canonical shape, then validate
again before storage. Malformed records are logged and skipped.
