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

Domains are numerically ordered (`01-global` … `16-space`); the logical domain
KEY used in code (`global`, `maritime`, …) maps to its folder via
`lib/intel/paths.ts` (`DOMAIN_DIR`). Every domain is enriched with **7 numbered
sub-sub-folders** holding comprehensive intelligence:

```
intelligence/
  _core/                   ontology, schemas, source registry, geography, indexes, manifests
  NN-<domain>/             one folder per domain (numbered 01..16)
    manifest.json          machine-readable domain descriptor
    01-overview/           mission, status, at-a-glance, contents
    02-sources/            per-source dossiers (endpoint, auth, rate, licensing)
    03-entities/           canonical entities + universal IDs
    04-schemas/            normalized Zod record shapes + example records
    05-pipeline/           ingestion → validation → normalization → storage
    06-relationships/      cross-domain edges (typed, with basis)
    07-analysis-and-gaps/  derived metrics, example queries, coverage gaps
    raw/                   raw provider snapshots (gitignored)
    snapshots/             generated snapshots (gitignored)
lib/intel/                 the executable pipeline (ingestors, storage, queries, CLI)
bin/intel.ts               CLI entrypoint
app/api/intelligence/      read-only HTTP endpoints
data/intelligence.db       SQLite store (gitignored)
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
| maritime | Implemented (credential) | MarineTraffic adapter wired; OFFLINE until `MARINETRAFFIC_API_KEY` is set |
| conflict | Scaffolded | Planned: ReliefWeb, ACLED (credential) |
| politics | Scaffolded | Planned: Wikidata enrichment |
| markets | Scaffolded | No source wired |
| energy | Scaffolded | No source wired |
| infrastructure | Scaffolded | Planned: OurAirports (reference) |
| environment | Scaffolded | Planned: Open-Meteo, EONET overlap |
| weather | Scaffolded | Planned: Open-Meteo |
| sanctions | Scaffolded | Planned: OFAC (not wired) |

Each domain's `01-overview/README.md` links to its own 02–07 sub-sub-folders.
For cross-cutting references see `docs/08-intelligence/source-matrix.md` (full
acquisition map), `docs/08-intelligence/api-catalog.md` (per-source detail), and
`docs/08-intelligence/coverage-gaps.md` (honest blind spots).
