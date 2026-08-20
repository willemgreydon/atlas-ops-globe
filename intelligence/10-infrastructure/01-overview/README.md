# infrastructure

**Status: Scaffolded** (folder + planned reference source; not yet ingesting)

## Purpose
Critical infrastructure reference — airports, ports, and other fixed assets that
anchor other domains spatially.

## Current sources
- None live. Planned: **OurAirports** (`ourairports`, `next`, free) ~78k airport
  reference CSV (shared with aviation); adapter present, not bulk-loaded.

## Canonical entities
- `InfrastructureAsset`, `Airport`, `Port`.

## Update frequency
- Not ingesting. Planned bulk load (cache 7 days).

## Storage
- Target: `airports`, `ports`, `entities`, `provenance`. Empty today.

## Known limitations
- No live coverage. Airport reference not loaded; `airports` table empty.

## Licensing considerations
- OurAirports is public domain — commercial use and redistribution allowed,
  no attribution required.

## Next sources
- Load **OurAirports**; add port and other infrastructure registries.
