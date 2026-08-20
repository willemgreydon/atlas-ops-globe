# 16 — Space

**Mission.** Maintain an orbital catalogue of satellites and space objects with
SGP4-ready element sets as the space layer of the Intelligence Vault, storing
orbit **metadata** (not propagated positions).

## Status: IMPLEMENTED

The space ingestor is wired and runs live against CelesTrak. It fetches GP/OMM
JSON, derives orbit metadata (period, apogee, perigee) from the mean-motion /
eccentricity / inclination elements, and stores it in `space_objects`. The
catalogue is **capped at 2000 objects per run** (of ~16,399 available);
truncation is **logged, never silent**.

| Aspect | Value |
|---|---|
| Source | `celestrak` (CelesTrak GP/OMM JSON, SGP4-ready) — IMPLEMENTED |
| Auth | none |
| Canonical entity | `Satellite` / `SpaceObject` (schema `VaultSpaceObject`); `Orbit`, `GroundStation` modelled |
| SQLite table | `space_objects` (populated), indexed on `object_type` |
| Universal ID | `satellite:norad-<id>` |
| CLI | `pnpm intel:sync space --group active --limit N` |
| Cap | 2000 per run (of ~16,399); overflow logged + counted as `skipped` |
| API | `GET /api/intelligence/space` (paginated; attribution "CelesTrak") |

### At a glance

- Stored: NORAD id, COSPAR, name, epoch, inclination, and **derived**
  `periodMin` / `apogeeKm` / `perigeeKm`.
- Not stored: propagated positions — SGP4 propagation for globe placement is
  **future work**.
- `--group` selects the CelesTrak group (default `active`); `--limit` sets the
  per-run cap (default 2000). Space is part of `pnpm intel:update`.

## Contents

- [02-sources](../02-sources/README.md) — CelesTrak dossier
- [03-entities](../03-entities/README.md) — Satellite, SpaceObject, Orbit, GroundStation + IDs
- [04-schemas](../04-schemas/README.md) — `VaultSpaceObject` field table + example
- [05-pipeline](../05-pipeline/README.md) — OMM ingest, orbit derivation, `space_objects` columns
- [06-relationships](../06-relationships/README.md) — cross-domain edges (conservative)
- [07-analysis-and-gaps](../07-analysis-and-gaps/README.md) — metrics, queries, gaps
