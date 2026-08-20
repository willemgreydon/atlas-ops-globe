# Intelligence Vault — Documentation

Reference docs for the **Intelligence Vault**: the provider-independent,
provenance-first knowledge base beneath the globe. It discovers, normalizes,
enriches, links and indexes public/open data into a local SQLite lakehouse, with
a clear separation between what is **implemented and live** and what is
**scaffolded / planned**. No inferred link is ever presented as a hard fact, and
unavailable metrics are `null`, never fabricated.

These three documents are the authoritative catalog of what the vault ingests,
what each source costs, and where the blind spots are.

## In this folder

| Doc | Description |
|---|---|
| [api-catalog.md](api-catalog.md) | Per-source reference for every entry in `lib/intel/sources.ts` (provider, endpoint, auth, rate limits, licensing, status) **plus** the internal read-only `/api/intelligence/*` endpoints. |
| [source-matrix.md](source-matrix.md) | Master acquisition map — one row per source: LIVE?, auth, cost, license, status and acquisition priority. The single table for deciding what to wire next. |
| [coverage-gaps.md](coverage-gaps.md) | Honest inventory of what the vault does **not** cover yet, by domain (no person/org NER, seed-only economics, capped space catalogue, unwired maritime/conflict/sanctions, etc.). |

## The vault itself

The vault's committed knowledge and per-domain documentation live under
[`intelligence/`](../../intelligence/README.md), organized into **16 numbered
domains** — [`01-global`](../../intelligence/01-global),
[`02-conflict`](../../intelligence/02-conflict),
[`03-aviation`](../../intelligence/03-aviation),
[`04-maritime`](../../intelligence/04-maritime),
[`05-news`](../../intelligence/05-news),
[`06-politics`](../../intelligence/06-politics),
[`07-economics`](../../intelligence/07-economics),
[`08-markets`](../../intelligence/08-markets),
[`09-energy`](../../intelligence/09-energy),
[`10-infrastructure`](../../intelligence/10-infrastructure),
[`11-environment`](../../intelligence/11-environment),
[`12-weather`](../../intelligence/12-weather),
[`13-disasters`](../../intelligence/13-disasters),
[`14-cyber`](../../intelligence/14-cyber),
[`15-sanctions`](../../intelligence/15-sanctions),
[`16-space`](../../intelligence/16-space) — each split into 7 sub-sub-folders
(`01-overview`, `02-sources`, `03-entities`, `04-schemas`, `05-pipeline`,
`06-relationships`, `07-analysis-and-gaps`). Shared ontology, schemas, the source
registry and indexes live in `intelligence/_core/`.

- [`intelligence/README.md`](../../intelligence/README.md) — vault mission, pipeline, storage model, how to run, per-domain status (16 domains).

## Related docs

- [`03-providers/`](../03-providers/README.md) — the **globe's** provider framework and its own `data/provider-registry.ts`. The globe and the vault share sources (OpenSky, USGS, EONET, GDELT, World Bank) but are distinct pipelines: the globe serves live `ProviderResult` envelopes to the client; the vault ingests into SQLite behind `/api/intelligence/*`.
- [`05-licensing/`](../05-licensing/README.md) — licensing posture that both pipelines respect.
- [`04-security/`](../04-security/README.md) — server-side secrets and API-boundary discipline.
