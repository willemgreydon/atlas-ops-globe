# 07 · Economics Intelligence — Overview

**Status:** IMPLEMENTED (live ingestor; one source wired).

## Mission

Give every watched country a slow-moving macroeconomic baseline — population,
output, prices, labour — as a provenance-labelled time series. Economics is
cross-domain context: it powers country profiles and lets other domains
(conflict, sanctions, markets) read a country's economic footprint.

## At a glance

| Aspect | Value |
|---|---|
| Source | `worldbank` (World Bank Indicators API) — IMPLEMENTED |
| Seed set | 25 countries (`SEED_COUNTRIES`, G20 + watched) |
| Indicators | 5 per country (pop, GDP, GDP/cap, inflation, unemployment) |
| Expected rows | ~125 observations (25 × 5, minus null/no-year) |
| Entities | EconomicIndicator / EconomicObservation |
| Schema | `VaultEconomicObs` (`lib/intel/schemas.ts`) |
| Table | `economic_observations` |
| ID | `IdOf.indicatorObs` → `econobs:CC:INDICATOR:PERIOD` |
| CLI | `pnpm intel:sync economics` |
| API | joined into `GET /api/intelligence/countries/[code]` |
| Ingestor | `lib/intel/domains/economics.ts` → `ingestEconomics()` |
| Provider | `lib/providers/worldbank.ts` → `fetchCountryProfile()` |

## Indicators fetched (`worldbank.ts` INDICATORS)

| Code | Label | Unit |
|---|---|---|
| `SP.POP.TOTL` | Population | — |
| `NY.GDP.MKTP.CD` | GDP | US$ |
| `NY.GDP.PCAP.CD` | GDP per capita | US$ |
| `FP.CPI.TOTL.ZG` | Inflation | % |
| `SL.UEM.TOTL.ZS` | Unemployment | % |

Each is fetched with `mrnev=1` (most-recent non-empty value) → annual latest.

## Pipeline shape

`World Bank Indicators API → fetchCountryProfile (Zod, [meta, data] tuples) →
mapPool(4) + limiter(250ms) → upsertEconomicObs → economic_observations`.

## Key gap

Only **25 seed countries** and **annual frequency**; ~170 countries have no
observations, and there is no quarterly/monthly or market data. See §07.

## Contents

- [02 · Sources](../02-sources/README.md) — World Bank dossier
- [03 · Entities](../03-entities/README.md) — observation entity + IDs
- [04 · Schemas](../04-schemas/README.md) — `VaultEconomicObs` + example
- [05 · Pipeline](../05-pipeline/README.md) — stages, concurrency, tables
- [06 · Relationships](../06-relationships/README.md) — country linkage
- [07 · Analysis & Gaps](../07-analysis-and-gaps/README.md) — metrics, SQL, gaps
