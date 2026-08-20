# space

**Status: Implemented**

## Purpose
Orbital catalogue of satellites and space objects with SGP4-ready element sets,
for orbit metadata and downstream propagation.

## Current sources
- **CelesTrak** (`celestrak`) — OMM element sets. Capped at 2000 objects per
  run (of ~16399 available); truncation is logged, never silent.

## Canonical entities
- `Satellite`, `SpaceObject`, `Orbit` (see `VaultSpaceObject`).

## Update frequency
- Polling. min interval 30s, cache TTL 2h. Included in `pnpm intel:update`.
  `--group` and `--limit` flags control catalogue group and cap.

## Storage
- `space_objects` table (indexed on `object_type`); `provenance` rows. IDs via
  `IdOf.satellite(norad)`.

## Known limitations
- **Capped at 2000 objects** per run — stored catalogue is a subset.
- Stores orbital *metadata* (elements), not propagated positions.

## Licensing considerations
- CelesTrak terms — commercial use and redistribution **review-required**;
  attribution required ("CelesTrak").

## Next sources
- Full catalogue ingestion; SATCAT metadata; launch/operator enrichment.
