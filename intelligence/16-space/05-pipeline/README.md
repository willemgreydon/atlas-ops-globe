# 16 — Space · Pipeline

## Stages

1. **Fetch** — `fetchCelestrak(group)` GETs
   `gp.php?GROUP=<group>&FORMAT=json` (default group `active`), 25s timeout.
2. **Validate** — response parsed with `OmmSchema` (array of OMM records).
3. **Derive** — per record, `deriveOrbit(MEAN_MOTION, ECCENTRICITY)` computes
   `periodMin`, `apogeeKm`, `perigeeKm`; `inclinationDeg` from `INCLINATION`.
4. **Cap** — `ingestSpace(group, limit = 2000)` takes `objects.slice(0, limit)`.
   If more were returned, `log.warn("celestrak result capped", { records, kept })`
   and `c.skipped += overflow` — **truncation is never silent**.
5. **Upsert** — `upsertSpaceObject(o)` → `space_objects` (on conflict, updates
   name, tle lines, epoch, inclination, period, apogee, perigee, provenance).
6. **Report** — wrapped by `runIngestor({ domain: "space", source: "celestrak",
   job: \`catalog-<group>\` })`.

## CLI

```
pnpm intel:sync space --group active --limit N
```

`--group` → CelesTrak group; `--limit` → per-run cap (default 2000). Space is
included in `pnpm intel:update` (`UPDATE_ORDER`).

## Cadence / TTL

| Setting | Value |
|---|---|
| Min interval | 30s (`acquisition.minIntervalSec`) |
| Cache TTL | 7200s / 2h (`acquisition.cacheTtlSec`) |
| Concurrency | 1 |
| Default cap | 2000 objects/run |

## SQLite table + real columns

**`space_objects`** (populated; migration v1, indexed on `object_type`):

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `satellite:norad-<id>` |
| `norad` | TEXT | catalog id |
| `cospar` | TEXT | international designator |
| `name` | TEXT | object name |
| `operator`, `country`, `object_type` | TEXT | not populated via OMM (null) |
| `launch_date` | TEXT | not populated via OMM (null) |
| `tle_line1`, `tle_line2` | TEXT | not populated via OMM-JSON (null) |
| `epoch` | TEXT | element epoch |
| `inclination_deg` | REAL | inclination |
| `period_min` | REAL | derived |
| `apogee_km`, `perigee_km` | REAL | derived |
| `source` | TEXT | `celestrak` |
| `provenance` | TEXT | JSON array |
| `updated_at` | TEXT | ISO |

## Provenance

Each object carries `prov({ provider: "celestrak", dataset: group,
providerRecordId: norad, sourceUrl: "https://celestrak.org/", observedAt: EPOCH,
rawHash: hashPayload(record) })`, stored in the `space_objects.provenance` JSON
column. `upsertSpaceObject` does **not** write into the shared `provenance`
table (unlike vessels/events).

## Retention

Upsert per NORAD id (latest elements win). Catalogue is a **subset** (≤2000 of
~16,399). No SGP4 propagation, no historical element-set archive. DB is
gitignored — reflects the last `sync space`.
