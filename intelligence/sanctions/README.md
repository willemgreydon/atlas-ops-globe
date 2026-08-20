# sanctions

**Status: Scaffolded** (folder + planned source; not yet wired)

## Purpose
Sanctions and designated-party awareness — who is listed, by which authority,
under which program.

## Current sources
- None live. Planned: **OFAC Sanctions List Service** (`ofac`, `next`, free)
  for the US Treasury SDN / consolidated lists. Registry entry present, not
  live-wired.

## Canonical entities
- `Sanction` (see `sanctions` table schema).

## Update frequency
- Not ingesting. Planned polling (cache 1 day) once wired.

## Storage
- Target: `sanctions` (schema present); `provenance`. Empty today.

## Known limitations
- Not wired despite the source being **free and open** — a low-hanging gap.
  `sanctions` table is empty.

## Licensing considerations
- OFAC is US Government open data — commercial use and redistribution allowed,
  no attribution required.

## Next sources
- Wire **OFAC** (high priority — free, high value); add EU/UN sanctions lists.
