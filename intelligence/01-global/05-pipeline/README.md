# 05 — Global Pipeline

Global has two flows: a **seed** flow (countries) and an **aggregate** flow
(snapshot). The aggregate flow runs automatically after every sync.

## Seed flow (countries)

```
naturalearth (bundled centroids)
  → fetch (offline read)
  → validate  (VaultCountry Zod)
  → normalize (iso2/iso3/name/region/capital/lat/lon)
  → store     (upsertCountry → countries + entities)
```

- **CLI:** `pnpm intel:sync countries`
- **Cadence / TTL:** one-off seed, `cacheTtlSec = 31,536,000` (1 year). Skipped
  by `pnpm intel:update` (country seed is not re-run on incremental refresh).

## Aggregate flow (snapshot)

```
all domain tables (countries, events, news_*, vulnerabilities, space_objects, aircraft, relationships)
  → buildGlobalSnapshot()  (SQLite aggregate reads)
  → writeGlobalSnapshot()  → snapshots/latest.json + snapshots/<stamp>.json
```

- **CLI:** `pnpm intel:index` — also runs inside `sync`, `bootstrap`, `update`
  (`writeGlobalSnapshot()` is invoked at the end of each).

## SQLite tables written (real columns)

`countries` (PRIMARY KEY `iso2`):

| Column | Type |
|---|---|
| iso2 | TEXT PK |
| iso3, name, region, capital | TEXT |
| lat, lon | REAL |
| data, provenance | TEXT (JSON) |
| updated_at | TEXT |

`upsertCountry` also mirrors each row into `entities`
(`id, type, name, country_code, lat, lon, data, quality, first_seen_at,
last_seen_at`) with `type = "Country"`, and writes `provenance` rows
(`subject_id, provider, dataset, …, retrieved_at, license, attribution, …`).

Aggregate reads touch: `countries`, `events`, `news_stories`, `news_articles`,
`vulnerabilities`, `space_objects`, `aircraft`, `relationships`.

## Provenance & retention

- Each country carries a Natural Earth provenance record (public-domain, no
  attribution required).
- Snapshots are written to `snapshots/latest.json` plus a timestamped copy
  (`<YYYYMMDDTHHMMSS>Z.json`). The DB and snapshots are gitignored — retention is
  local and ephemeral (only as fresh as the last sync).
