# Politics — Overview

**Status: SCAFFOLDED** — folder, ontology types, target tables, and one
planned source (`wikidata`, `next`) exist. **No political data is ingested
today.** Everything below is the intended design, not live behavior.

## Mission

Make the world's news and conflict data legible by resolving the people and
institutions behind it: who holds power, in which office, since when, and under
what mandate. The politics domain is the identity backbone for public figures
and government/international organizations, and the home of country political
profiles (head of state, head of government, cabinet, next election).

A load-bearing discipline: **office-holder facts are time-valid**. A person is
never simply "the head of government" — they are `HEAD_OF` a `Government` with
`validFrom` and (when they leave) `validTo`. History is preserved, never
overwritten.

## At a glance (all PLANNED)

- **Planned sources:** `wikidata` (`next`, CC0) for person/org enrichment;
  then national + EU parliament open data, national election authorities, UN
  bodies, and GDELT (already live for news) as an event/mention feed.
- **Planned canonical entities:** `PublicOfficial`, `Government`, `Parliament`,
  `Ministry`, `Election`, `Party`, `Treaty`, `PoliticalOffice`,
  `PoliticalEvent` — mapped onto ontology types `Person` / `PublicFigure`,
  `GovernmentOrganization` / `InternationalOrganization`, and `PoliticalEvent`.
- **Intended tables:** `persons`, `organizations`, `entities`,
  `relationships`, `events`, `provenance` (all defined in
  `lib/intel/migrations.ts`; empty for this domain today).
- **Planned CLI:** `pnpm intel:sync politics` (no ingestor registered yet).
- **Identity:** `IdOf.person(wikidataId | name)`, `IdOf.org({ wikidataId, lei,
  name })` from `lib/intel/ids.ts`. A Wikidata QID is the preferred key.

## Contents

- [02-sources](../02-sources/README.md) — planned providers, auth, licensing, status
- [03-entities](../03-entities/README.md) — canonical entities + universal ID scheme
- [04-schemas](../04-schemas/README.md) — Zod shapes (existing vs planned) + examples
- [05-pipeline](../05-pipeline/README.md) — intended stages, CLI, target tables, cadence
- [06-relationships](../06-relationships/README.md) — cross-domain edges + time-validity
- [07-analysis-and-gaps](../07-analysis-and-gaps/README.md) — metrics, queries, blind spots

## Honest status

The `persons` and `organizations` tables exist but are always empty; news
`persons`/`organizations` arrays stay empty until Wikidata is wired. There is
no political-figure, cabinet, election, or treaty data in the vault. This
domain is documentation and scaffolding only.
