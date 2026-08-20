# 04 — Maritime

**Mission.** Track vessel positions through strategic maritime chokepoints as
the maritime layer of the Intelligence Vault, using neutral terminology (an AIS
gap is a **signal gap**, never an accusation).

## Status: IMPLEMENTED adapter — CREDENTIAL-REQUIRED (OFFLINE without a key)

The MarineTraffic adapter and the chokepoint-scan ingestor are fully wired. The
source is **credential-gated**: without `MARINETRAFFIC_API_KEY` the maritime job
**fails fast with a clear OFFLINE message** and the `/api/intelligence/maritime`
endpoint reports `status: "offline"` — it never mocks data as live.

| Aspect | Value |
|---|---|
| Source | `marinetraffic` (Kpler AIS Data API) — adapter IMPLEMENTED, `status: credential-required` |
| Auth | 40-char hex `api_key` embedded as a **URL PATH** segment (`MARINETRAFFIC_API_KEY`) |
| Canonical entity | `Vessel` (schema `VaultVessel`); `Voyage`, `Port` modelled but not ingested |
| SQLite table | `vessels` (populated only when keyed); `ports` (schema only, empty) |
| Universal ID | `vessel:imo-<imo>` (IMO-first) or `vessel:mmsi-<mmsi>` |
| Geofences | 9 chokepoints (`lib/intel/geo/chokepoints.ts`) |
| Snapshot file | `intelligence/04-maritime/snapshots/chokepoints-latest.json` (gitignored) |
| API | `GET /api/intelligence/maritime` (bbox filter, honest live/offline) |
| CLI | `pnpm intel:sync maritime` |
| Also planned | `aisstream` (WebSocket AIS) — `status: credential-required`, not wired |

### At a glance — 9 chokepoints scanned

Hormuz · Bab el-Mandeb · Suez · Bosporus · Panama · Malacca · Gibraltar ·
Danish Straits · English Channel. Each is a bounding-box geofence queried via
MarineTraffic PS07 `exportvessels`; per-chokepoint vessel counts are written to
`chokepoints-latest.json`.

## Contents

- [02-sources](../02-sources/README.md) — MarineTraffic (+ AISstream) dossiers
- [03-entities](../03-entities/README.md) — Vessel, Voyage, Port + universal IDs
- [04-schemas](../04-schemas/README.md) — `VaultVessel` field table + example
- [05-pipeline](../05-pipeline/README.md) — chokepoint scan, CLI, `vessels` columns
- [06-relationships](../06-relationships/README.md) — cross-domain edges (conservative)
- [07-analysis-and-gaps](../07-analysis-and-gaps/README.md) — metrics, queries, gaps
