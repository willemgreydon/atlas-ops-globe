# global

**Status: Implemented**

## Purpose
The geographic backbone of the vault. Seeds the country reference set that every
other domain resolves against (by ISO code or nearest centroid) and provides the
rolled-up global snapshot.

## Current sources
- **Natural Earth** (`naturalearth`) — bundled public-domain country centroids
  (`ne_110m_admin_0_countries`), offline. 175 countries seeded.
- GDELT (`gdelt`) also tags this domain for global news coverage.

## Canonical entities
- `Country`, `Region` (see `VaultCountry` in `lib/intel/schemas.ts`).

## Update frequency
- One-off seed (cache TTL 1 year). Refreshed only on explicit re-seed; skipped
  by `pnpm intel:update`.

## Storage
- `countries` table; `provenance` rows. Global snapshot emitted to
  `intelligence/global/snapshots/` (gitignored).

## Known limitations
- Northern Cyprus and Somaliland lack ISO2 codes and are skipped (2 territories).
- Centroid-only geometry; no detailed borders in this table.

## Licensing considerations
- Public domain — commercial use and redistribution allowed, no attribution
  required.

## Next sources
- Richer geography/admin boundaries; Wikidata for country enrichment.
