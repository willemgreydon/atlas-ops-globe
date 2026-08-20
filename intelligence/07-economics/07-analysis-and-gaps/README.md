# 07 · Economics — Analysis & Gaps

## Derived metrics (IMPLEMENTED / possible)

- **Latest value per indicator** — surfaced directly in country profiles
  (`getCountryProfile` orders by `indicator, period DESC`).
- **Time series** — multiple periods per country×indicator support trend and
  YoY-change computation at read time (not stored).
- **Cross-country ranking** — e.g. GDP or unemployment across the 25 seed
  countries for a given year.

## Example SQL

Latest GDP for each seed country:

```sql
SELECT country_code, value, period
FROM economic_observations
WHERE indicator = 'NY.GDP.MKTP.CD'
GROUP BY country_code
HAVING period = MAX(period)
ORDER BY value DESC;
```

Full indicator panel for one country:

```sql
SELECT indicator, label, unit, period, value
FROM economic_observations
WHERE country_code = 'AT'
ORDER BY indicator, period DESC;
```

Coverage check (how many of 5 indicators per country):

```sql
SELECT country_code, COUNT(DISTINCT indicator) AS indicators
FROM economic_observations
GROUP BY country_code ORDER BY indicators;
```

## Example API queries

```
GET /api/intelligence/countries/AT
GET /api/intelligence/countries/AUT
```
Returns the country row plus `indicators` (the economic observations joined by
`country_code`) and `current.events` / `current.news`. Code must match
`^[A-Za-z]{2,3}$`; 400 on bad code, 404 if not found.

## Gaps & limitations

| Gap | Impact | Status |
|---|---|---|
| 25 seed countries only | ~170 countries have no economics | GAP |
| Annual frequency only | no quarterly/monthly signal | GAP |
| 5 indicators only | narrow macro picture | GAP |
| No markets/instruments | no equities, FX, rates, commodities | PLANNED (`markets` domain) |
| Null/no-year rows skipped | sparse coverage for lagging reporters | by design |
| `mrnev=1` latest-only in provider | provider returns one point; full history depends on ingest params | note |

## Data quality notes

- Every observation is CC BY 4.0 with full provenance (dataset, record id, year,
  attribution) — high trust, fully auditable.
- Composite id `econobs:CC:INDICATOR:PERIOD` guarantees no duplicate inflation.
- `value` can be `null` in schema but null values are filtered before storage,
  so stored rows always carry a real number.
- Reporting lag: World Bank annual data trails the calendar year; the newest
  `period` may be 1–2 years behind "today".

## Highest-value next steps

1. **Expand the seed set** toward full country coverage (cheap — same API, open
   license).
2. **Add higher-frequency / additional indicators** (trade, debt, reserves).
3. Introduce the **markets** domain for instrument-level, higher-latency data.
