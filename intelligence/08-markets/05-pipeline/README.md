# Markets — Pipeline (Planned)

**No markets ingestor is registered** in `lib/intel/registry.ts`
(`INGESTORS`). `pnpm intel:sync markets` prints `! unknown domain: markets`
today. There is no `upsertMarketObservation` repository function yet
(`repositories.ts` covers countries, entities, relationships, events, news,
vulns, space, economics, vessels — not markets). Everything below is intent.

## Intended stages

`SOURCE → NORMALIZED → ENRICHED → RELATIONSHIPS → PRODUCTS`.

1. **SOURCE** — poll a provider (ECB first, given its open license; then the
   credentialed feeds) for a watchlist of instruments per asset class. Respect
   provider rate limits (strict on free tiers).
2. **NORMALIZED** — validate raw payload against a per-provider source schema,
   transform to the planned `VaultMarketObservation`, and derive/attach the
   correct `latencyClass` from the provider tier.
3. **ENRICHED** — upsert the `MarketInstrument` node (metadata) separately from
   the observation series; resolve the issuer org where possible
   (`IdOf.org({ lei })`).
4. **RELATIONSHIPS** — link observation → instrument (join on `symbol`),
   instrument → issuer org, FX pairs → currencies.
5. **PRODUCTS** — market panels / country economic context; observations feed
   the global snapshot once populated.

## CLI (planned)

```
pnpm intel:sync markets      # once an ingestor is registered in INGESTORS
```

Would slot into `UPDATE_ORDER` for frequent refresh, not `BOOTSTRAP_ORDER`
(which is offline-first). A new `upsertMarketObservation(...)` in
`repositories.ts` is required.

## Cadence (planned)

- Real-time/delayed quotes: minute-to-minute during market hours (tier-limited).
- ECB reference rates: daily (`end-of-day`).
- Historical backfill: on-demand, labeled `historical`.
- Cadence is bounded by each provider's rate limit — the strictest is
  Alpha Vantage (~25 req/day free).

## Target table (from `migrations.ts`)

`market_observations`:

| column | meaning |
|---|---|
| `id` | deterministic observation id |
| `symbol` | instrument symbol (join key) |
| `asset_class` | index/equity/fx/commodity/rate/bond/crypto |
| `ts` | observation timestamp (ISO, UTC) |
| `value` | numeric value/level |
| `currency` | denomination |
| `latency_class` | real-time / delayed / end-of-day / historical |
| `provider` | source id |
| `provenance` | JSON lineage (also mirrored to `provenance` table) |

Instrument metadata is stored separately in `entities` (type
`MarketInstrument`).

## Provenance

Once wired, writes flow through the repository layer, mirroring each record to
`provenance` (`provider`, `source_url`, `retrieved_at`, `license`,
`attribution`, `confidence`). Provider licensing (mostly restricted) must be
recorded per row.
