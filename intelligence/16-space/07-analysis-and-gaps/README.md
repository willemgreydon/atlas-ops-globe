# 16 — Space · Analysis & Gaps

## Derived metrics (from `space_objects`)

- **Orbit-regime buckets** — classify by `apogee_km` / `perigee_km` (LEO ≲2000
  km, MEO, GEO ≈35,786 km) and `period_min`.
- **Inclination distribution** — `GROUP BY` rounded `inclination_deg`
  (polar/sun-sync ≈98°, ISS ≈51.6°, GEO ≈0°).
- **Catalogue freshness** — spread of `epoch` values; stale epochs degrade any
  future propagation.
- **Cap headroom** — stored count vs the 2000 cap vs ~16,399 available.

## Example SQL

```sql
-- Low Earth Orbit objects
SELECT id, name, perigee_km, apogee_km, period_min FROM space_objects
WHERE apogee_km < 2000 ORDER BY period_min;

-- Near-geostationary
SELECT id, name, period_min FROM space_objects
WHERE period_min BETWEEN 1430 AND 1450;

-- Inclination histogram
SELECT ROUND(inclination_deg) inc, COUNT(*) n FROM space_objects
GROUP BY inc ORDER BY n DESC;

-- Stalest element sets
SELECT id, name, epoch FROM space_objects ORDER BY epoch ASC LIMIT 20;
```

## Example API query

```
GET /api/intelligence/space?limit=100&cursor=0
→ { data: [...space objects], page: { limit, offset, count, nextOffset },
    attribution: "CelesTrak" }
```

Node runtime, `force-dynamic`, paginated (`limit` 1–500 default 100). Returns
orbit metadata only.

## Coverage gaps

- **Capped at 2000/run** of ~16,399 available. Truncation is logged
  (`log.warn("celestrak result capped", …)`) and counted as `skipped`, but the
  stored catalogue is a **subset**.
- **Metadata only — no propagated positions.** SGP4 propagation for globe
  placement is future work; there are no live x/y/z or lat/lon for objects.
- **No SATCAT enrichment.** `operator`, `country`, `object_type`, `launch_date`
  columns exist but are **not populated** by the OMM path (null).
- **No raw TLE lines.** `tle_line1`/`tle_line2` are not populated by OMM-JSON.
- **Single group per run.** `--group` fetches one CelesTrak group; full-catalogue
  coverage requires multiple runs/groups.

## Data-quality notes

- Derived orbit values are **null** when `MEAN_MOTION ≤ 0` or absent.
- Period/apogee/perigee are two-body approximations from mean elements — good
  for classification, not for precise conjunction analysis.
- Licensing: CelesTrak terms — commercial use and redistribution are
  **review-required**; attribution to "CelesTrak" is required. DB is gitignored.
