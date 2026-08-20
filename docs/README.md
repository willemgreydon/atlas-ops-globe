# Atlas Ops Globe — Documentation

Engineering documentation for **Atlas Ops Globe**: an interactive 3D globe that
fuses live aviation, natural hazards, global news and country intelligence on top
of a clean, provenance-first data pipeline — and the machine-readable
**Intelligence Vault** beneath it.

The globe is one visualization; the pipeline is the product. Rendering code never
sees a source-specific payload — only normalized domain records and an honest
**data status** (LIVE / CACHED / MOCK / OFFLINE). These docs describe that
pipeline as it actually ships today, and the architecture it is shaped to grow
into.

Start with [`00-overview/`](00-overview/README.md) for orientation.

## Documentation map

Each numbered subfolder is a documentation section; its main page is that
folder's `README.md`.

| Section | Description | Key files |
|---|---|---|
| [`00-overview/`](00-overview/README.md) | Orientation: what the project is, the pipeline, the doc map | [README](00-overview/README.md) · [feature-map](00-overview/feature-map.md) · [legal-ops](00-overview/legal-ops.md) |
| [`01-architecture/`](01-architecture/README.md) | System architecture — what ships today vs the target design (client, BFF, ingestion, normalization, storage, fusion, streaming) | [README](01-architecture/README.md) |
| [`02-data-model/`](02-data-model/README.md) | The canonical domain model (`types/domain.ts`): stable IDs, coordinates, provenance, data status, the `ProviderResult` envelope, the confidence model | [README](02-data-model/README.md) |
| [`03-providers/`](03-providers/README.md) | The provider framework: `runProvider`, `ProviderDefinition`, caching, Zod validation, active providers, adding a source | [README](03-providers/README.md) · [api-catalog](03-providers/api-catalog.md) |
| [`04-security/`](04-security/README.md) | Security posture today (server-side secrets, input validation, no URL proxying, graceful degradation) plus the hardening backlog | [README](04-security/README.md) |
| [`05-licensing/`](05-licensing/README.md) | Per-source licensing posture from the provider registry: commercial use, redistribution, required attribution | [README](05-licensing/README.md) |
| [`06-roadmap/`](06-roadmap/README.md) | Phased delivery — done / partial / planned, and immediate next steps | [README](06-roadmap/README.md) |
| [`07-decisions/`](07-decisions/README.md) | Architecture Decision Records (ADR-001 … ADR-011) | [README](07-decisions/README.md) |
| [`08-intelligence/`](08-intelligence/README.md) | Docs for the Intelligence Vault: API catalog, source acquisition matrix, honest coverage gaps | [README](08-intelligence/README.md) · [api-catalog](08-intelligence/api-catalog.md) · [source-matrix](08-intelligence/source-matrix.md) · [coverage-gaps](08-intelligence/coverage-gaps.md) |

## The Intelligence Vault knowledge base

Parallel to these docs lives the **Intelligence Vault** — a provider-independent,
provenance-first knowledge base that discovers, normalizes, enriches, links and
indexes public/open data into a local SQLite lakehouse. The globe is one way to
query it.

Its committed knowledge lives under [`intelligence/`](../intelligence/README.md),
organized into **16 numbered domains** (`01-global`, `02-conflict`, `03-aviation`,
… `16-space`), each split into **7 sub-sub-folders**: `01-overview`, `02-sources`,
`03-entities`, `04-schemas`, `05-pipeline`, `06-relationships`,
`07-analysis-and-gaps` (plus a `manifest.json`). Shared ontology, schemas, the
source registry and indexes live in `intelligence/_core/`.

- [`intelligence/README.md`](../intelligence/README.md) — vault mission, pipeline, storage model, how to run, per-domain status.
- [`08-intelligence/`](08-intelligence/README.md) — the reference docs for that vault (this docs tree's view of it).

See the root [`README.md`](../README.md) for a quick start and what works today.
