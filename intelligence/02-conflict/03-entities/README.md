# 02 · Conflict — Entities

All entity handling here is **PLANNED**. Types exist in the ontology
(`lib/intel/ontology.ts`); none is populated for conflict today.

## Entity types

| Ontology type | Materialized? | Store (target) | Notes |
|---|---|---|---|
| `ConflictEvent` | PLANNED | `events` (`kind="conflict"`) | one row per conflict event |
| `Event` | shared | `events` | generic parent |
| `Person` | PLANNED | `persons` | named actors — needs NER/Wikidata |
| `Organization` | PLANNED | `organizations` | armed groups, forces — needs NER |
| `MilitaryOrganization` | PLANNED | `organizations`/`entities` | subtype |
| `Country` | reused | `countries` | event location |

## Universal identity (`lib/intel/ids.ts`)

| Entity | ID form (target) | Function | Example |
|---|---|---|---|
| Conflict event | `event:<provider>:<providerId>` | `IdOf.event(provider, id)` | `event:acled:12345` |
| Country | `country:<ISO2>` | `IdOf.country(iso2)` | `country:SY` |
| Person actor | `person:<QID>` or hash | `IdOf.person(qid, name)` | `person:Q…` (PLANNED) |
| Organization | `org:<QID>` / `org:LEI-…` / hash | `IdOf.org({…})` | `org:Q…` (PLANNED) |

The rule holds: a provider ID is never the primary identity — `IdOf.event`
namespaces it as `event:<provider>:<providerId>` so ACLED and GDELT events never
collide.

## Intended ConflictEvent fields (via `VaultEvent`)

`id`, `kind: "conflict"`, `subtype` (event type, e.g. "armed clash"), `title`,
`summary`, `severity` (`info|watch|warning|critical`), `occurredAt`,
`publishedAt`, `lat`/`lon`, `countryCode`, `source`, `sourceUrl`, `confidence`,
`tags[]`, `provenance[]`.

## Actor extraction (PLANNED)

ACLED supplies `actor1`/`actor2` strings; ReliefWeb supplies narrative text.
Resolving these to `Person`/`Organization` entities requires the disabled
`wikidata` NER path (05-news §07). Until then, actors would be retained as
**tags/text on the event**, not promoted to entity nodes — never guessing an
identity.

## Country resolution (reusable, IMPLEMENTED primitives)

`lib/intel/resolve.ts` already provides `resolveCountry`,
`extractCountryMentions`, and `nearestCountry` — the same primitives the
disasters ingestor uses. A conflict ingestor would reuse them to tag events by
country (reported code, else nearest-centroid).

## Ethical labelling

Actor and event-type labels must stay **neutral and analytical**. Ambiguous
actor attribution is left unresolved rather than forced onto an entity.
