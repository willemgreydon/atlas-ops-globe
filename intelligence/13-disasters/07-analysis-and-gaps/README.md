# 07 — Disasters Analysis & Gaps

## Derived metrics / aggregates

Consumed by the global snapshot (`lib/intel/global.ts`):

- `activeDisasters` = `COUNT(*) FROM events WHERE kind = 'disaster'`
- `earthquakes24h` = events tagged `earthquake` in the last 24h
- `criticalAlerts` = newest events with severity `critical`/`warning`

## Example SQL

```sql
-- Disaster count and severity mix
SELECT severity, COUNT(*) FROM events
WHERE kind='disaster' GROUP BY severity;

-- Earthquakes in the last 24h
SELECT id, title, severity, occurred_at, country_code FROM events
WHERE kind='disaster' AND tags LIKE '%earthquake%'
  AND occurred_at >= datetime('now','-1 day')
ORDER BY occurred_at DESC;

-- Disasters by country
SELECT country_code, COUNT(*) n FROM events
WHERE kind='disaster' AND country_code IS NOT NULL
GROUP BY country_code ORDER BY n DESC;
```

## API queries

| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/intelligence/disasters` | `country`, `bbox`, `since`, `limit`, `cursor` | Events filtered to `kind=disaster`, newest first |
| `GET /api/intelligence/events?kind=disaster` | `kind`, `country`, `bbox`, `since` | Same events via the generic events endpoint |
| `GET /api/intelligence/global` | — | Snapshot incl. `activeDisasters`, `earthquakes24h` |

`since` accepts `24h`/`7d`/`60m`; `bbox=west,south,east,north`.

## Coverage gaps / blind spots

- **USGS window** is M4.5+ over the last 24h only — smaller quakes and older
  events are absent.
- **EONET** returns up to 100 open events — bounded and biased toward
  currently-active phenomena; historical events drop off.
- **No humanitarian impact context** (casualties, displacement, damage). That
  requires ReliefWeb (`reliefweb`, status `next`), not yet wired.
- **Border/coast misattribution** — events resolved by nearest centroid can be
  assigned the wrong country; those edges carry the weaker `spatially-near`
  basis at confidence 0.6.
- **Open-ocean events** without a valid point are skipped entirely.

## Data quality / freshness

- Severity for USGS is deterministic from magnitude (≥6 critical, ≥5 warning,
  else watch); EONET is uniformly `watch` (no magnitude).
- Provider reliability: USGS 0.97, EONET 0.9 — folded into per-event confidence.
- Counts (~123) are as fresh as the last `pnpm intel:sync disasters`; the DB is
  gitignored.
