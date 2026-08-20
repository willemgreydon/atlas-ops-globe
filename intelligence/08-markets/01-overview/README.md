# markets

**Status: Scaffolded** (folder + schema; no source wired)

## Purpose
Financial market observations — instrument prices/values over time as economic
context.

## Current sources
- None. No source is registered for this domain yet.

## Canonical entities
- `MarketInstrument`, `MarketObservation`.

## Update frequency
- Not ingesting.

## Storage
- Target: `market_observations` (schema present); `provenance`. Empty today.

## Known limitations
- No source wired at all — entirely planned. Latency-class and redistribution
  posture of market data will require review before any source is added.

## Licensing considerations
- To be determined per source. Market data commonly carries restrictive
  redistribution terms; expect `review-required` / `restricted`.

## Next sources
- Evaluate free/open market data feeds with acceptable redistribution terms.
