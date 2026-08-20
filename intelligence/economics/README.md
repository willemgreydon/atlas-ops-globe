# economics

**Status: Implemented**

## Purpose
Country-level macroeconomic indicators as time series, used for country
profiles and cross-domain economic context.

## Current sources
- **World Bank Indicators** (`worldbank`) — annual indicator series for a seed
  set of 25 countries (G20 + strategically-watched economies). ~125
  observations.

## Canonical entities
- `EconomicIndicator` / `EconomicEvent` (see `VaultEconomicObs`).

## Update frequency
- On sync. min interval 1s, concurrency 4, cache TTL 1 day. Included in
  `pnpm intel:update`.

## Storage
- `economic_observations` table; `provenance` rows. IDs via
  `IdOf.indicatorObs(country, indicator, period)`.

## Known limitations
- Only **25 seed countries**; ~170 countries have no observations.
- Annual frequency only; no quarterly/monthly or market data.
- Skips observations with null value or missing year.

## Licensing considerations
- CC BY 4.0 — commercial use and redistribution allowed; attribution required
  ("World Bank Open Data (CC BY 4.0)").

## Next sources
- Additional countries; IMF/OECD series; higher-frequency indicators.
