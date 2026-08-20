# politics

**Status: Scaffolded** (folder + planned source; not yet ingesting)

## Purpose
Political entities and events — public figures, government organizations, and
the relationships that make news and conflict data legible.

## Current sources
- None live. Planned: **Wikidata** (`wikidata`, `next`, free) for
  person/organization enrichment. Also underpins news person/org NER.

## Canonical entities
- `Person`, `PublicFigure`, `GovernmentOrganization`, `InternationalOrganization`,
  `PoliticalEvent`.

## Update frequency
- Not ingesting. Planned on-demand enrichment (cache 7 days).

## Storage
- Target: `persons`, `organizations`, `entities`, `relationships`. Empty today.

## Known limitations
- No live coverage. The `persons`/`organizations` tables are empty; news
  person/org arrays stay empty until Wikidata is wired.

## Licensing considerations
- Wikidata is CC0 — commercial use and redistribution allowed, no attribution
  required.

## Next sources
- Wire **Wikidata** entity resolution (high priority — unlocks NER across news).
