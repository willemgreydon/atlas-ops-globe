# Markets — Planned Sources

**None of these sources appear in `lib/intel/sources.ts` yet.** The markets
manifest lists zero sources. All entries below are documented intent. Market
data commonly carries restrictive redistribution terms, so expect
`review-required` / `restricted` licensing on every commercial provider.

## polygon — CREDENTIAL_REQUIRED

- **Provider:** Polygon.io · **baseUrl:** `https://api.polygon.io/`
- **Type:** api · **auth:** api-key (`POLYGON_API_KEY`) · polling.
- **Rate limits:** tier-dependent (free tier ~5 req/min); paid tiers higher.
- **Licensing:** commercial terms — redistribution restricted; **LEGAL_REVIEW**.
- **Format:** JSON. **Coverage:** US equities, options, FX, crypto, indices;
  aggregates, trades, quotes. **Latency:** real-time on paid, else 15-min delayed.
- **Priority:** Medium. **Sample:** `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apiKey=…`

## finnhub — CREDENTIAL_REQUIRED

- **Provider:** Finnhub · **baseUrl:** `https://finnhub.io/api/v1/`
- **Type:** api · **auth:** api-key (`FINNHUB_API_KEY`) · polling.
- **Rate limits:** free tier ~60 req/min.
- **Licensing:** commercial terms — redistribution restricted; **LEGAL_REVIEW**.
- **Format:** JSON. **Coverage:** global equities, FX, crypto, quotes,
  fundamentals. **Latency:** delayed on free tier.
- **Priority:** Medium. **Sample:** `https://finnhub.io/api/v1/quote?symbol=AAPL&token=…`

## twelvedata — CREDENTIAL_REQUIRED

- **Provider:** Twelve Data · **baseUrl:** `https://api.twelvedata.com/`
- **Type:** api · **auth:** api-key (`TWELVEDATA_API_KEY`) · polling.
- **Rate limits:** free tier ~8 req/min, 800 req/day.
- **Licensing:** commercial terms — redistribution restricted; **LEGAL_REVIEW**.
- **Format:** JSON/CSV. **Coverage:** equities, FX, crypto, indices, ETFs,
  time series. **Latency:** delayed/EOD on free, real-time on paid.
- **Priority:** Medium. **Sample:** `https://api.twelvedata.com/price?symbol=AAPL&apikey=…`

## alphavantage — CREDENTIAL_REQUIRED

- **Provider:** Alpha Vantage · **baseUrl:** `https://www.alphavantage.co/query`
- **Type:** api · **auth:** api-key (`ALPHAVANTAGE_API_KEY`) · polling.
- **Rate limits:** free tier ~5 req/min, 25 req/day (strict).
- **Licensing:** commercial terms — redistribution restricted; **LEGAL_REVIEW**.
- **Format:** JSON/CSV. **Coverage:** equities, FX, crypto, commodities,
  technical indicators. **Latency:** typically EOD / delayed on free.
- **Priority:** Low (harsh free limits). **Sample:**
  `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=…`

## ECB — RESEARCH (open)

- **Provider:** European Central Bank · **baseUrl:**
  `https://data-api.ecb.europa.eu/service/data/` (SDW) and euro FX reference
  rates.
- **Type:** api/file · **auth:** none · polling.
- **Rate limits:** courteous polling; daily FX reference publication.
- **Licensing:** ECB open terms, attribution required — the most permissive
  option here; still **LEGAL_REVIEW** to confirm redistribution.
- **Format:** SDMX-JSON / CSV / XML. **Coverage:** euro FX reference rates,
  policy rates, yield curves. **Latency:** `end-of-day` (daily reference).
- **Priority:** High among these — free and redistributable. **Sample:**
  `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1`

## Acquisition discipline

Follows the registry's conservative vocabulary. No provider is `next` because
all four commercial feeds are credential- and license-gated. ECB is the likely
first wiring given its open license, but each still needs a redistribution
review before entering `lib/intel/sources.ts`.
