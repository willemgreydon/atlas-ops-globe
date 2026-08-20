# maritime

**Status: Scaffolded** (folder + planned source; not yet ingesting)

## Purpose
Vessel tracking and maritime situational awareness — positions, voyages, ports,
and flags.

## Current sources
- None live. Planned: **AISstream** (`aisstream`, `credential-required`) for
  live AIS vessel positions over WebSocket.

## Canonical entities
- `Vessel`, `Voyage`, `Port` (target shapes; `vessels`/`ports` schema present).

## Update frequency
- Not ingesting. Planned streaming once wired (cache 15s).

## Storage
- Target: `vessels`, `ports`, `provenance`. Empty today.

## Known limitations
- No live coverage. Blocked on `AISSTREAM_API_KEY` — this is the only maritime
  source and it is credential-gated.

## Licensing considerations
- AISstream terms — commercial use and redistribution **restricted**,
  attribution required.

## Next sources
- Wire **AISstream** once an API key is available; add UN/LOCODE port reference.
