# 07 · Economics — Entities

## Entity types (`lib/intel/ontology.ts`)

| Ontology type | Materialized? | Store | Notes |
|---|---|---|---|
| `EconomicIndicator` | Yes (as observations) | `economic_observations` | one row per country×indicator×period |
| `EconomicEvent` | Reserved | `events` | not used by this ingestor |
| `Country` | Reused | `countries` | observations FK on `country_code` |

The unit of storage is the **observation** (a single indicator value for a
country in a period), not an abstract "indicator" node. The
`VaultEconomicObs` schema models this observation directly.

## Universal identity (`lib/intel/ids.ts`)

| Entity | ID form | Function | Example |
|---|---|---|---|
| Observation | `econobs:CC:INDICATOR:PERIOD` | `IdOf.indicatorObs(country, indicator, period)` | `econobs:AT:NY.GDP.MKTP.CD:2023` |
| Country | `country:<ISO2>` | `IdOf.country(iso2)` | `country:AT` |

The country code is uppercased and taken from `profile.iso2 ?? iso3`; the
indicator is the World Bank code; the period is the year string. This makes each
observation deterministically addressable and idempotent on re-sync.

## Observation fields

`id`, `countryCode` (ISO2), `indicator` (WB code), `label` (human name),
`unit`, `frequency` (`"annual"`), `period` (year), `value` (number|null),
`provider` (`"worldbank"`), `provenance[]`.

## The five seeded indicators

| Indicator code | Label | Unit | Frequency |
|---|---|---|---|
| `SP.POP.TOTL` | Population | — | annual |
| `NY.GDP.MKTP.CD` | GDP | US$ | annual |
| `NY.GDP.PCAP.CD` | GDP per capita | US$ | annual |
| `FP.CPI.TOTL.ZG` | Inflation | % | annual |
| `SL.UEM.TOTL.ZS` | Unemployment | % | annual |

## Seed countries (`SEED_COUNTRIES`, ISO3)

`USA, CHN, JPN, DEU, GBR, FRA, ITA, CAN, IND, BRA, RUS, KOR, AUS, MEX, IDN, SAU,
TUR, ZAF, ARG, AUT, UKR, IRN, POL, NLD, CHE` — the G20 plus strategically
watched economies. Country metadata (name, region, capital, lat/lon) comes from
the World Bank country endpoint and lands in the `countries` table via the
country ingestor / profile join.

## Not modelled here

No firm-level, market-instrument, or sub-national entities. Those belong to the
`markets` domain (PLANNED). Observations with `value == null` or a missing year
are skipped and never stored.
