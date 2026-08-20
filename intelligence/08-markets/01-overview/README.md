# Markets — Overview

**Status: SCAFFOLDED** — the `market_observations` table exists
(`lib/intel/migrations.ts`) and the `MarketInstrument` / `MarketObservation`
ontology types exist (`lib/intel/ontology.ts`). **No market source is wired**
and **no market data is ingested.** Everything below is intended design.

## Mission

Provide a provider-independent view of financial markets — indices, equities,
FX, commodities, rates, bonds, and crypto — with an uncompromising separation
of concerns: **instrument metadata** (what a symbol is) is stored apart from
**observations** (a value at a timestamp). Every observation is honestly
labeled with how fresh it is.

**Critical discipline:** never display delayed or end-of-day data as real-time.
Every observation carries a `latency_class`
(`real-time` / `delayed` / `end-of-day` / `historical`) so downstream consumers
cannot mistake a 15-minute-delayed quote for a live one.

## At a glance (all PLANNED)

- **Planned sources (all CREDENTIAL_REQUIRED):** `polygon`, `finnhub`,
  `twelvedata`, `alphavantage`; plus **ECB** (Statistical Data Warehouse /
  euro FX reference rates, open) for FX and rates.
- **Planned market domains:** Indices, Equities, FX, Commodities, Rates, Bonds,
  Crypto.
- **Planned canonical entities:** `MarketInstrument` (metadata) and
  `MarketObservation` (time series) — kept separate on purpose.
- **Intended table:** `market_observations` (`symbol`, `asset_class`, `ts`,
  `value`, `currency`, `latency_class`, `provider`, `provenance`) — defined in
  `migrations.ts`, empty today. Instrument metadata lands in the generic
  `entities` table.
- **Planned CLI:** `pnpm intel:sync markets` (no ingestor registered yet).

## Contents

- [02-sources](../02-sources/README.md) — planned providers, auth, licensing, latency
- [03-entities](../03-entities/README.md) — instrument vs observation split + IDs
- [04-schemas](../04-schemas/README.md) — planned Zod shapes + example JSON
- [05-pipeline](../05-pipeline/README.md) — intended stages, CLI, target table, cadence
- [06-relationships](../06-relationships/README.md) — cross-domain edges (issuers, FX)
- [07-analysis-and-gaps](../07-analysis-and-gaps/README.md) — metrics, queries, blind spots

## Honest status

No source is wired for markets (nor for energy/infrastructure) — the manifest
lists zero sources. `market_observations` is empty. There is no live or cached
price, quote, or series of any kind. This domain is scaffolding only.
