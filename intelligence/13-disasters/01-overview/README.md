# 13 — Disasters (Overview)

**Status: IMPLEMENTED**

## Mission

Natural-hazard situational awareness: earthquakes and NASA-tracked natural
events, normalized into canonical disaster events with country resolution and
severity scoring. Spatial by nature — every event carries a lat/lon and, where
possible, a country link.

## At a glance

| Property | Value |
|---|---|
| Sources | `usgs` (earthquakes M4.5+/day, GeoJSON), `eonet` (NASA open natural events) |
| Ingestor | `lib/intel/domains/disasters.ts` (`ingestDisasters`) |
| Providers | `lib/providers/usgs.ts`, `lib/providers/eonet.ts` |
| Primary entity | `DisasterEvent` / `Event` (`kind = "disaster"`) |
| Schema | `VaultEvent` (`lib/intel/schemas.ts`) |
| SQLite tables written | `events` (kind=`disaster`), `relationships`, `provenance` |
| CLI | `pnpm intel:sync disasters` |
| API | `GET /api/intelligence/disasters`, `GET /api/intelligence/events?kind=disaster` |
| Approx count | ~123 events across both providers |

## How it works (short)

`ingestDisasters` fetches USGS earthquakes and EONET events in parallel
(`Promise.allSettled` — one provider failing does not sink the other), validates
each against a source Zod schema, maps to `VaultEvent`, derives severity from
magnitude, resolves the country (reported code or nearest centroid), stores to
`events`, and links `event → country` in `relationships`.

## Known limitations

- Events without a reported country are attributed by nearest centroid
  (`spatially-near` basis) — imprecise near borders/coasts.
- USGS feed is M4.5+ over the last 24h; EONET is open events (limit 100). No
  humanitarian impact/casualty context (that would come from ReliefWeb, `next`).

## Contents

- [02 — Sources](../02-sources/README.md)
- [03 — Entities](../03-entities/README.md)
- [04 — Schemas](../04-schemas/README.md)
- [05 — Pipeline](../05-pipeline/README.md)
- [06 — Relationships](../06-relationships/README.md)
- [07 — Analysis & Gaps](../07-analysis-and-gaps/README.md)
