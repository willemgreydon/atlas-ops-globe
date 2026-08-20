# Overview

Orientation for **Atlas Ops Globe** — what it is, how the pipeline is shaped, and
where to read next.

## What the project is

Atlas Ops Globe is a global situational-awareness surface: an interactive 3D
globe (CesiumJS/Resium) that fuses live aviation, natural hazards, global news and
country intelligence. It is engineered as the foundation of a serious, extensible
intelligence platform, not a demo.

It has two halves:

1. **The globe** — a Next.js web client that renders normalized domain records
   returned by the app's own API routes. It shows honest **data status**
   (LIVE / CACHED / MOCK / OFFLINE) everywhere, so cached or mock data is never
   presented as live.
2. **The Intelligence Vault** — a provider-independent, provenance-first
   knowledge base beneath the globe that discovers, normalizes, enriches, links
   and indexes public/open data into a local SQLite lakehouse. It is a product in
   its own right; the globe is one way to query it. See
   [`intelligence/README.md`](../../intelligence/README.md) and the
   [intelligence docs](../08-intelligence/README.md).

## The pipeline

Every external source flows through the same clean pipeline before it reaches the
screen:

```
External sources → Provider adapters → Validation (Zod) → Normalization
→ Provenance + Confidence → Cache + Status → API envelope → Visualization
```

Rendering code never learns whether data came from OpenSky, a cache, or a mock —
only its normalized shape and its `DataStatus`. That isolation is the
architectural invariant the app depends on: sources live behind a
`ProviderDefinition`, are run through `runProvider`, and always emerge as a
uniform `ProviderResult<T>` envelope.

## What works today

Live, zero-credential feeds: OpenSky (aircraft), USGS (earthquakes), NASA EONET
(natural events), GDELT (news) and World Bank (country indicators), plus real
Natural Earth country borders. Planned layers/modes render as disabled, labelled
controls — no fake functionality. See the [feature map](feature-map.md) for the
full implemented-vs-planned picture and the root [`README.md`](../../README.md)
for a quick start.

## Documentation map

| Section | Read it for |
|---|---|
| [00 — Overview](README.md) | This page: what the project is, the pipeline, the doc map |
| [01 — Architecture](../01-architecture/README.md) | System design: what ships today vs the target architecture |
| [02 — Data model](../02-data-model/README.md) | The canonical domain model, IDs, provenance, status, confidence |
| [03 — Providers](../03-providers/README.md) | The provider framework and active/planned sources ([API catalog](../03-providers/api-catalog.md)) |
| [04 — Security](../04-security/README.md) | Security posture today and the hardening backlog |
| [05 — Licensing](../05-licensing/README.md) | Per-source licensing, redistribution and attribution |
| [06 — Roadmap](../06-roadmap/README.md) | Phased delivery and immediate next steps |
| [07 — Decisions](../07-decisions/README.md) | Architecture Decision Records |
| [08 — Intelligence](../08-intelligence/README.md) | The Intelligence Vault docs: API catalog, source matrix, coverage gaps |

## In this folder

- [feature-map.md](feature-map.md) — feature map of the globe UI and the vault: what is implemented vs planned.
- [legal-ops.md](legal-ops.md) — legal & operational notes: responsible acquisition, licensing awareness, operational cadence.
