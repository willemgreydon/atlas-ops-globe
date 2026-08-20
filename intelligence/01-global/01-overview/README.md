# 01 — Global Intelligence (Overview)

**Status: IMPLEMENTED** (aggregate product)

## Mission

Global is the vault's top-level product: the geographic backbone plus a single
rolled-up snapshot across every domain. It does not run a live event feed of its
own. It has two jobs:

1. **Seed the country reference layer** from Natural Earth (public-domain
   centroids, `ne_110m_admin_0_countries`, bundled/offline) — the layer every
   spatial domain resolves against by ISO code or nearest centroid.
2. **Aggregate** — `buildGlobalSnapshot()` (`lib/intel/global.ts`) reads all
   domain tables and emits `intelligence/01-global/snapshots/latest.json`.

Discipline: anything not yet ingested is emitted as `null` (explicitly
unavailable), never fabricated — e.g. `markets: null`, `maritime: null`.

## At a glance

| Property | Value |
|---|---|
| Seed source | `naturalearth` (bundled); reads every domain's tables |
| Primary entity | `Country` (also `Region`) |
| SQLite tables written | `countries`, `entities`, `relationships`; **reads** all domain tables |
| Seed CLI | `pnpm intel:sync countries` |
| Snapshot CLI | `pnpm intel:index` (also runs on every `sync` / `bootstrap` / `update`) |
| Snapshot output | `snapshots/latest.json` + timestamped copy |
| API | `GET /api/intelligence/global`, `GET /api/intelligence/stats` |

### Approximate counts (last local sync)

| Metric | Count |
|---|---|
| Countries | ~175 |
| Events | ~123 |
| Vulnerabilities | ~1,771 |
| Space objects | ~2,000 |
| Relationships | ~123 |

Counts are only as fresh as the last local sync; the SQLite DB and snapshots are
gitignored.

## Known limitations

- Northern Cyprus and Somaliland lack ISO2 codes and are **skipped** (173–175
  countries depending on seed).
- Centroid-only geometry — no detailed borders in the `countries` table.
- `markets` and `maritime` are always `null` (no live feed wired).

## Contents

- [02 — Sources](../02-sources/README.md)
- [03 — Entities](../03-entities/README.md)
- [04 — Schemas](../04-schemas/README.md)
- [05 — Pipeline](../05-pipeline/README.md)
- [06 — Relationships](../06-relationships/README.md)
- [07 — Analysis & Gaps](../07-analysis-and-gaps/README.md)
