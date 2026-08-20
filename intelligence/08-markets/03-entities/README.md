# Markets — Planned Canonical Entities

Two entities, deliberately separate. Both are **planned**; the ontology types
`MarketInstrument` and `MarketObservation` exist in `lib/intel/ontology.ts`,
but no rows are stored today.

## The instrument / observation split (critical)

- **`MarketInstrument`** — the *thing being priced*: a symbol, its asset class,
  currency, exchange, issuer. Slow-changing metadata. One row per instrument.
- **`MarketObservation`** — a *value at a timestamp* for an instrument.
  High-volume time series. Many rows per instrument.

Keeping these apart means instrument metadata is not duplicated on every tick,
and observations stay a clean, append-friendly series with an explicit
`latency_class`.

## Universal identity (from `lib/intel/ids.ts`)

There is **no dedicated `IdOf.instrument`** helper yet. Planned convention,
consistent with the `type:key` rule: mint `instrument:<venue>-<symbol>` (e.g.
`instrument:XNAS-AAPL`), preferring an authoritative identifier as the key
where available — ISIN (`instrument:isin-<ISIN>`), FIGI, or LEI for the issuer
org (`IdOf.org({ lei })`). A provider ticker is never the primary identity.

## MarketInstrument — planned fields (stored as `entities`)

Held in the generic `entities` table with domain fields under `data`:

- `id` — e.g. `instrument:isin-US0378331005`
- `type` — `MarketInstrument`
- `name` — "Apple Inc. common stock"
- `data` — `{ symbol, assetClass, currency, exchange, isin?, figi?, issuerId? }`
  where `assetClass ∈ {index, equity, fx, commodity, rate, bond, crypto}`.
- `provenance[]` — provider lineage.

## MarketObservation — planned fields (`market_observations` table)

Columns from `migrations.ts`:

- `id` — deterministic, e.g. hash of `symbol|ts|provider`.
- `symbol` — the instrument's symbol (join key to the instrument).
- `asset_class` — `index|equity|fx|commodity|rate|bond|crypto`.
- `ts` — observation timestamp (ISO 8601, UTC).
- `value` — the numeric value (price, rate, or level).
- `currency` — denomination (e.g. `USD`, `EUR`; null for rates/indices).
- `latency_class` — `real-time | delayed | end-of-day | historical`.
- `provider` — source id (`polygon`/`finnhub`/`ecb`/…).
- `provenance` — JSON lineage; mirrored to the `provenance` table.

## Latency labeling (non-negotiable)

`latency_class` is a required field on every observation. It reflects the
provider tier the value came from (e.g. a free-tier quote is `delayed`, an ECB
reference rate is `end-of-day`). Consumers must render this label; a delayed
value is never shown as real-time.
