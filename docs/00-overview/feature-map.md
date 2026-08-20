# Feature Map

What Atlas Ops Globe does today, and what is scaffolded for later — across both
the **globe UI** and the **Intelligence Vault** beneath it. This map is grounded
in what actually ships (see the root [`README.md`](../../README.md) and the
[roadmap](../06-roadmap/README.md)); planned items are labelled, never implied to
work. The project's discipline is **working vertical slices over broad unfinished
breadth**, and it stays runnable at every step.

## Globe UI

### Implemented today

- **Interactive 3D globe** (CesiumJS/Resium): rotate, zoom, atmosphere, lighting,
  OSM imagery, star field.
- **Real country borders** from Natural Earth with hover-free **click selection**.
- **Layer framework** — real toggles; planned layers render **disabled and
  labelled** (no fake functionality).
- **Operational modes** — Global / Aviation / Disasters / News are operational;
  other modes are present but planned/disabled.
- **Live aircraft** (OpenSky) with heading-oriented icons and clustering.
- **Live earthquakes** (USGS) and **natural events** (NASA EONET).
- **Global news** (GDELT DOC 2.0) — headlines and links, never full article text.
- **Inspector** — click any aircraft / event / news / country to open a detail
  panel with full **provenance** (source, retrieved-at, confidence).
- **Country inspector** with live World Bank indicators (population, GDP, GDP per
  capita, inflation, unemployment).
- **Alert center** derived from real events — click to focus the globe.
- **Honest status badges** — LIVE / CACHED / MOCK / OFFLINE surfaced everywhere,
  so degraded data is never shown as live.
- **Command palette** (⌘K / Ctrl+K) across countries, events, news and aircraft.
- **Signal ticker** — real events and news only; **no fabricated market figures**.

### Planned / scaffolded

- **Maritime layer** — vessel model (`VesselState`) exists as a type; the AIS
  provider (AISstream, credential-gated) is not wired. Trails, course arrows,
  chokepoint geofences + transit counters and AIS-gap anomaly indicators are
  planned (neutral terms only).
- **Global timeline / historical replay** — shared time-range state is the next
  UX slice; time-aware layers and viewport-based (LOD) querying follow.
- **Entity graph** — persons / organizations, Wikidata resolution, relationships
  and entity panels. News `people`/`organizations` fields are reserved but empty
  until entity extraction ships.
- **Environment & weather** — weather / wind / clouds / air quality / fire raster
  and vector layers (Open-Meteo, FIRMS) are planned.
- **Geopolitical intelligence** — ACLED, ReliefWeb and sanctions (OFAC/EU/UK/UN)
  with event fusion and thresholds.
- **Cyber / space / infrastructure UI** — CISA KEV / NVD / EPSS surfaces, CelesTrak
  + SGP4 orbits and ground tracks, energy/infrastructure layers, and a labelled
  real-time-vs-delayed markets ticker.
- **Alerting engine** — the `Alert` type exists but is not yet produced by any
  provider; source-inspector pages and saved views are planned.

## Intelligence Vault

The vault ingests public/open data into a local SQLite lakehouse with full
provenance. Sixteen domains exist; each is either **implemented** (a live ingestor
runs) or **scaffolded** (registry/adapter present, not yet live). See
[`08-intelligence/`](../08-intelligence/README.md) and
[`intelligence/README.md`](../../intelligence/README.md).

### Implemented domains (live ingestion)

| Domain | Live source(s) |
|---|---|
| global | Natural Earth — 175 countries seeded |
| disasters | USGS earthquakes + NASA EONET |
| economics | World Bank — 25 seed countries |
| cyber | CISA KEV + NVD (recent) |
| space | CelesTrak OMM (capped 2000 objects/run) |
| aviation | OpenSky snapshot (on-demand) |
| news | GDELT DOC 2.0 (rate-limited; may degrade live) |

### Scaffolded domains (planned / blocked)

| Domain | Blocker / planned source |
|---|---|
| conflict | ReliefWeb (free, next), ACLED (credential) — not wired |
| maritime | AISstream (credential) — not wired |
| politics | Wikidata enrichment (next) — not wired |
| markets | no source wired |
| energy | no source wired |
| infrastructure | OurAirports reference (next) — not loaded |
| environment | Open-Meteo (next) + EONET overlap |
| weather | Open-Meteo (next) — not wired |
| sanctions | OFAC (free, next) — not wired |

### Vault capabilities

- **Read-only API** — `/api/intelligence/{global,stats,countries,countries/[code],
  events,disasters,news,cyber,space}`, paginated, with `country` / `bbox` /
  `since` filters, reading from SQLite.
- **Provenance on every record**, `null` (never fabricated) for unavailable
  metrics, and typed relationship edges with an explicit `basis`.
- **FTS5 search** over news, events and entities; versioned SQLite migrations.

## Cross-cutting invariants

These hold across every feature above:

- Rendering code only ever sees normalized domain records and a `DataStatus` — it
  never learns the source (provider vs cache vs mock).
- Confidence is **computed and explainable**, never a hardcoded percentage.
- Every externally-derived record carries provenance (source, retrieved-at,
  confidence, raw hash).
- No charged/inferred labels without an authoritative public source and visible
  provenance (ADR-011).
