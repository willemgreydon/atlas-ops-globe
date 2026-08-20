# Atlas Ops Globe

A global situational-awareness surface: an interactive 3D globe that fuses live
aviation, natural hazards, global news and country intelligence — engineered as
the foundation of a serious, extensible intelligence platform rather than a demo.

The globe is one visualization on top of a clean pipeline:

```
External sources → Provider adapters → Validation (Zod) → Normalization
→ Provenance + Confidence → Cache + Status → API envelope → Visualization
```

Rendering code never sees a source-specific payload. It only sees normalized
domain records and an honest **data status** (LIVE / CACHED / MOCK / OFFLINE).

## Quick start

```bash
pnpm install
cp .env.example .env.local   # optional — the app runs live without any keys
pnpm dev                     # http://localhost:3000
```

No paid keys are required. OpenSky (aircraft), USGS (earthquakes), NASA EONET
(natural events), GDELT (news) and World Bank (country stats) are wired via
anonymous tiers. If a source fails or rate-limits, the app degrades gracefully
and **labels** the result — it never shows mock data as live.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build (Turbopack) |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm lint` | ESLint (flat config) |
| `pnpm test` | Vitest unit suite |
| `pnpm test:e2e` | Playwright smoke tests (`pnpm exec playwright install chromium` first) |

## What works today (first milestone)

- Smooth 3D globe: rotate, zoom, atmosphere, lighting, OSM imagery, star field
- Real country borders from Natural Earth — **hover-free click selection**
- Toggleable layers (real toggles; planned layers disabled & labelled)
- Operational modes (Global / Aviation / Disasters / News operational; others planned)
- Live aircraft (OpenSky) with heading-oriented icons + clustering
- Live earthquakes (USGS) and natural events (NASA EONET)
- Global news (GDELT)
- Click any aircraft / event / news / country → **Inspector** with provenance
- Country inspector with live World Bank indicators
- Alert center derived from real events (click to focus the globe)
- Honest LIVE / CACHED / MOCK / OFFLINE badges everywhere
- ⌘K / Ctrl+K command palette across countries, events, news, aircraft
- Signal ticker (real events + news; **no fabricated market figures**)

## Architecture at a glance

```
app/api/*          server routes → ProviderResult envelope
lib/core/          provider framework, cache, confidence, provenance, geo, id, logger
lib/providers/*    one adapter per source (Zod-validated, provenance-tagged)
lib/config/*       layer & mode catalogues
stores/            client app store (mode, layers, selection, polling)
components/        globe, layout, panels, search, common
data/              provider registry (licensing), generated country centroids
types/domain.ts    canonical domain model
docs/              architecture, providers, data model, roadmap, security, licensing, decisions
```

See [`docs/`](docs) for the full engineering documentation, including the ADR
log in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Production direction

The local build uses in-memory caching and a mock-fallback layer. The interfaces
(`CacheStore`, `ProviderDefinition`, `ProviderResult`) are designed so the same
call sites can later be backed by Redis, Postgres/PostGIS, a queue and an
SSE/WebSocket delta channel without touching rendering code. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).
