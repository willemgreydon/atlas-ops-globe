# Intelligence Vault — Coverage Gaps

An honest inventory of what the vault does **not** cover yet, organized by
domain. Nothing here is presented as working. Statuses reflect the real
bootstrap run and the source registry.

## Cross-cutting gaps

- **No person/organization NER.** The `persons` and `organizations` tables and
  the news `persons`/`organizations` arrays exist but are always empty. Entity
  extraction is limited to country mentions. The Wikidata adapter (`wikidata`,
  status `next`) is registered but not live-wired — until it ships, all
  person/org enrichment is absent.
- **Relationship depth is conservative by design.** Most edges are `reported`,
  `spatially-near`, or country links; there is little `direct` entity-to-entity
  linkage because upstream entity resolution (persons/orgs) is not wired.
- **Generated data is ephemeral.** The SQLite DB, raw snapshots, and indexes are
  gitignored; coverage counts are only as fresh as the last local sync.

## Global / countries

- Two territories lack ISO2 codes and are **skipped** during the country seed:
  **Northern Cyprus** and **Somaliland**. They are absent from the countries
  table and from any country-resolved joins.
- Country resolution for events without a reported code uses nearest-centroid
  (`spatially-near` basis), which can misattribute events near borders or coasts.

## News

- **GDELT rate-limiting.** GDELT enforces ~1 req/5s and returns plain text on
  rejection, so live runs may degrade or return nothing. Pipeline logic is
  proven by tests and is fixture-independent, but live volume is not guaranteed.
- Metadata and links only — no article bodies (GDELT terms + copyright).
- Story clustering is heuristic (title-based), not semantic.
- No person/org extraction (see cross-cutting).

## Economics

- Limited to **25 seed countries** (G20 + a few watched economies). ~170
  countries have no economic observations.
- Annual World Bank indicators only — no quarterly/monthly series, no markets.

## Cyber

- CISA KEV (~1671) + recent NVD (~100) only. Not the full NVD corpus; older
  CVEs outside the recent window and non-KEV vulnerabilities are absent.
- No EPSS enrichment populated in practice, no exploit-to-actor linkage.

## Space

- CelesTrak catalogue is **capped at 2000 objects per run** (of ~16399
  available). Truncation is logged, not silent, but the stored catalogue is a
  subset.
- Orbital *metadata* only (OMM/SGP4-ready elements) — positions are not
  propagated/stored.

## Aviation

- OpenSky snapshot is **on-demand and snapshot-only**: latest position per
  aircraft, upsert, gitignored. No historical trajectories, no downsampling.
- Airport reference (`ourairports`, ~78k) is **not loaded** — the `airports`
  table schema exists but is unpopulated.

## Maritime

- **No live coverage.** The only source (`aisstream`) is credential-required and
  not wired. The `vessels`/`ports` schema exists but is empty.

## Conflict

- **Scaffolded only.** `reliefweb` (free, `next`) and `acled`
  (credential-required) are not wired. No conflict events are ingested.

## Sanctions

- **Not wired.** `ofac` is free and `next` but has no live ingestor. The
  `sanctions` table is empty despite the source being zero-cost — a notable
  low-hanging gap.

## Politics

- **Scaffolded only.** Depends on the Wikidata adapter for entity enrichment;
  no political-figure or government-org data is ingested.

## Weather / Environment

- **Planned.** `openmeteo` (free, `next`) is not wired; `weather_observations`
  is empty. Environment overlaps EONET (via disasters) but has no dedicated
  live ingestion.

## Markets / Energy / Infrastructure

- **No source wired for any of the three.** `market_observations`,
  `EnergyAsset`, and `InfrastructureAsset` coverage are entirely planned.
  `ourairports` would seed infrastructure/airport reference but is not loaded.
