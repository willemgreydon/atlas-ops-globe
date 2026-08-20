# Intelligence Vault

A provider-independent, provenance-first knowledge base for global situational
awareness. Every record is normalized to a canonical schema, tagged with its
source lineage, and stored locally in SQLite. Nothing claims a permission we
have not verified, and no inferred link is ever presented as a hard fact.

## Mission

Assemble a broad, honest, machine-readable picture of the world from public,
zero-to-low-credential data sources — countries, disasters, economics, cyber
threats, satellites, aircraft, and news — with a clear separation between what
is **implemented and live** and what is **scaffolded / planned**.

## Pipeline

```
SOURCE ──► NORMALIZED ──► ENRICHED ──► RELATIONSHIPS ──► PRODUCTS
```

- **SOURCE** — a registry entry (`lib/intel/sources.ts`) describing the
  provider, endpoint, auth, rate limits, and licensing posture. Raw payloads
  are validated against a per-provider source schema.
- **NORMALIZED** — transformed into a canonical Zod record
  (`lib/intel/schemas.ts`): events, news, vulnerabilities, space objects,
  economic observations, countries. Malformed records are logged and skipped,
  never stored raw.
- **ENRICHED** — universal IDs minted (`lib/intel/ids.ts`), country resolution
  (reported code or nearest-centroid), story clustering for news.
- **RELATIONSHIPS** — typed edges carry a `basis`
  (`direct | reported | spatially-near | temporally-related | entity-overlap |
  inferred-low-confidence`) so confidence is explicit at the edge level.
- **PRODUCTS** — the global snapshot, per-domain manifests, `_core` indexes,
  and the read-only `/api/intelligence/*` endpoints.

## Folder layout

```
intelligence/
  _core/            ontology, schemas, source registry, geography, indexes, manifests
  <domain>/         one folder per intelligence domain (README + manifest.json)
    raw/            raw provider snapshots (gitignored)
    snapshots/      generated snapshots (gitignored)
lib/intel/          the executable pipeline (ingestors, storage, queries, CLI logic)
bin/intel.ts        CLI entrypoint
app/api/intelligence/  read-only HTTP endpoints
data/intelligence.db   SQLite store (gitignored)
```

Committed: schemas, ontology, source registry, per-domain READMEs and
manifests. Gitignored: the SQLite DB (`data/*.db`), raw snapshots
(`intelligence/**/raw/`, `intelligence/**/snapshots/`), and generated indexes
(`_core/indexes/`, `_core/manifests/status.json`).

## Storage model

- Node built-in `node:sqlite` (no native dependency) at `data/intelligence.db`.
  Override with `INTEL_DB_PATH` (`:memory:` for tests).
- WAL journal, foreign keys on, versioned forward-only migrations
  (`lib/intel/migrations.ts`).
- FTS5 virtual tables (`fts_news`, `fts_events`, `fts_entities`) for search.
- Every record links to `provenance` rows: provider, dataset, source URL,
  retrieval time, license, attribution, and optional raw hash/path.

## How to run

```
pnpm intel:status              vault status + record counts
pnpm intel:sources             print the source registry
pnpm intel:sync <domain>       sync one domain
pnpm intel:sync --all          sync every implemented domain
pnpm intel:bootstrap           populate a useful baseline (offline-first order)
pnpm intel:update              incremental refresh (skips the country seed)
pnpm intel:stats               record counts
pnpm intel:validate            DB integrity + migration check
pnpm intel:index               (re)build snapshots, indexes, _core artifacts
```

Flags: `--query <q>` `--group <g>` `--limit <n>`.

Bootstrap order: `countries → disasters → economics → cyber → space → news`
(cheap/offline first, rate-limited news last).

## Domain status (16 domains)

| Domain | Status | Live ingestion |
|---|---|---|
| global | Implemented | Natural Earth — 175 countries seeded |
| disasters | Implemented | USGS earthquakes + NASA EONET (~123 events) |
| economics | Implemented | World Bank, 25 seed countries (~125 observations) |
| cyber | Implemented | CISA KEV (~1671) + NVD recent (~100) = ~1771 vulns |
| space | Implemented | CelesTrak OMM, capped 2000 of ~16399 objects |
| aviation | Implemented | OpenSky snapshot, on-demand |
| news | Implemented | GDELT DOC 2.0 (rate-limited; may degrade live) |
| conflict | Scaffolded | Planned: ReliefWeb, ACLED (credential) |
| maritime | Scaffolded | Planned: AISstream (credential) |
| politics | Scaffolded | Planned: Wikidata enrichment |
| markets | Scaffolded | No source wired |
| energy | Scaffolded | No source wired |
| infrastructure | Scaffolded | Planned: OurAirports (reference) |
| environment | Scaffolded | Planned: Open-Meteo, EONET overlap |
| weather | Scaffolded | Planned: Open-Meteo |
| sanctions | Scaffolded | Planned: OFAC (not wired) |

See `docs/intelligence/SOURCE-MATRIX.md` for the full acquisition map,
`docs/intelligence/API-CATALOG.md` for per-source detail, and
`docs/intelligence/COVERAGE-GAPS.md` for honest blind spots.
