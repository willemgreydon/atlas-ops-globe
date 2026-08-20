# conflict

**Status: Scaffolded** (folder + planned sources; not yet ingesting)

## Purpose
Armed-conflict and political-violence event tracking — location, actors, event
type — to complement disasters with human-caused crisis data.

## Current sources
- None live. Planned: **ReliefWeb** (`reliefweb`, `next`, free) for
  humanitarian context; **ACLED** (`acled`, `credential-required`) for
  conflict event data.

## Canonical entities
- `ConflictEvent` / `Event` (target shape: `VaultEvent`).

## Update frequency
- Not ingesting. Planned polling once wired (ReliefWeb cache 1h, ACLED cache 1h).

## Storage
- Target: `events` (`kind = "conflict"`), `relationships`, `provenance`. Empty
  today.

## Known limitations
- No live coverage. ACLED is blocked on OAuth credentials
  (`ACLED_CLIENT_ID`/`ACLED_CLIENT_SECRET`).

## Licensing considerations
- ReliefWeb: OCHA terms, commercial/redistribution review-required, attribution
  required. ACLED: restricted commercial use and redistribution, attribution
  required.

## Next sources
- Wire **ReliefWeb** first (free); add **ACLED** when credentials are obtained.
