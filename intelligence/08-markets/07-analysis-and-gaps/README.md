# Markets — Analysis & Gaps

All analysis below is **intended**. `market_observations` is empty and no
source is wired, so every query returns nothing today.

## Intended derived metrics

- **Latest value per instrument** — most recent `ts` per `symbol`, always
  carrying its `latency_class`.
- **Returns / change** — period-over-period change from consecutive
  observations (same `symbol`, ordered by `ts`).
- **FX cross-rates** — derive crosses from base pairs (e.g. EURGBP from EURUSD
  and GBPUSD), inheriting the **most conservative** `latency_class` of the
  inputs.
- **Volatility** — rolling std of returns over a window.
- **Cross-domain context** — pair FX/rates with country `EconomicIndicator`
  series (domain 07) for macro views.

## Example queries (planned)

```sql
-- Latest value per instrument, with freshness label
SELECT symbol, asset_class, value, currency, latency_class, ts, provider
FROM market_observations
WHERE (symbol, ts) IN (
  SELECT symbol, MAX(ts) FROM market_observations GROUP BY symbol
);

-- Refuse to treat delayed data as live: real-time only
SELECT symbol, value, ts FROM market_observations
WHERE latency_class = 'real-time' AND ts > datetime('now','-2 minutes');

-- Daily EUR/USD series from ECB
SELECT ts, value FROM market_observations
WHERE symbol = 'EURUSD' AND provider = 'ecb' ORDER BY ts DESC LIMIT 30;
```

## Coverage gaps / blind spots (honest)

- **Nothing wired.** No source in `lib/intel/sources.ts` for markets; the
  manifest lists zero sources. `market_observations` is empty.
- **No repository function** (`upsertMarketObservation`) and **no ingestor** in
  the registry — the pipeline does not exist yet.
- **No canonical Zod schema** for markets in `schemas.ts` — only the table and
  ontology types exist.
- **License risk dominates:** the four commercial feeds carry restrictive
  redistribution terms; ECB is the only clearly redistributable option.
- **Free-tier latency + rate limits** mean any near-term coverage would be
  `delayed`/`end-of-day` and sparse, not real-time market coverage.

## Quality / matching discipline

- **Never display delayed data as real-time.** `latency_class` is mandatory on
  every observation and must be surfaced; derived values inherit the worst
  input latency.
- **Instrument ≠ observation.** Metadata stays in `entities`; series stay in
  `market_observations`. Do not denormalize prices onto the instrument node.
- **Identifier-first matching** for issuer links (LEI/ISIN/FIGI), never ticker
  or name alone.
- **Timestamp everything in UTC**; record provider and retrieval time in
  provenance so staleness is auditable.
