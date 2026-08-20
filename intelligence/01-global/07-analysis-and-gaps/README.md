# 07 — Global Analysis & Gaps

## Derived metrics / aggregates

`buildGlobalSnapshot()` computes, purely from SQLite:

- `activeDisasters` = `COUNT(*) FROM events WHERE kind = 'disaster'`
- `earthquakes24h` = events tagged `earthquake` in the last 24h
- `majorStories` = top 8 news stories with `article_count > 1`
- `criticalAlerts` = 8 newest events with severity `critical`/`warning`
- `counts` = per-table record counts (countries, events, vulnerabilities, kev,
  spaceObjects, relationships, …)

## Example SQL

```sql
-- Aggregate counts driving the snapshot
SELECT
  (SELECT COUNT(*) FROM countries)                          AS countries,
  (SELECT COUNT(*) FROM events)                             AS events,
  (SELECT COUNT(*) FROM events WHERE kind='disaster')       AS active_disasters,
  (SELECT COUNT(*) FROM vulnerabilities)                    AS vulns,
  (SELECT COUNT(*) FROM vulnerabilities WHERE kev=1)        AS kev,
  (SELECT COUNT(*) FROM space_objects)                      AS space_objects,
  (SELECT COUNT(*) FROM relationships)                      AS relationships;

-- Critical alerts feed
SELECT id, title, severity, occurred_at FROM events
WHERE severity IN ('critical','warning')
ORDER BY occurred_at DESC LIMIT 8;
```

## API queries

| Endpoint | Returns |
|---|---|
| `GET /api/intelligence/global` | The rolled-up snapshot (counts + highlights) |
| `GET /api/intelligence/stats` | `{ generatedAt, counts }` per-table counts |
| `GET /api/intelligence/countries` | Paginated countries (iso2/iso3/name/region/capital/lat/lon) |
| `GET /api/intelligence/countries/[code]` | Country profile: metadata + economic indicators + latest events + latest news |

## Coverage gaps / blind spots

- **`markets: null`, `maritime: null`** — no market feed and no AIS provider are
  wired; these are explicitly unavailable, not empty.
- **`aircraftSnapshot`** is 0 unless a live OpenSky snapshot was just fetched
  (snapshot-only, gitignored).
- **Missing territories:** Northern Cyprus and Somaliland (no ISO2) are absent
  from `countries` and all country-resolved joins.
- **No person/org NER** — the `entities` graph is dominated by countries and
  events; person/organization enrichment (Wikidata) is not wired.

## Data quality / freshness

- Every metric is grounded in stored rows; nothing is fabricated.
- Counts are only as fresh as the last local `pnpm intel:sync` / `bootstrap`;
  the DB and `snapshots/` are gitignored.
- `nearest-centroid` country resolution can misattribute border/coast events —
  those edges carry the weaker `spatially-near` basis.
