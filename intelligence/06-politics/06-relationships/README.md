# Politics — Relationships (Planned)

Edges use the controlled `RELATION_TYPES` and `RELATIONSHIP_BASIS` vocabularies
in `lib/intel/ontology.ts`. None are populated for politics today.

## Basis vocabulary (from `ontology.ts`)

`direct | reported | spatially-near | temporally-related | entity-overlap |
inferred-low-confidence`. The `basis` is a first-class field so an inferred or
near link is **never** presented as a hard fact.

## Time-valid office tenure (the core discipline)

Office-holder relationships carry `validFrom` and `validTo` (both on
`VaultRelationship`). A person is not "the head of government" as a static
fact — they are `HEAD_OF` a `Government` for a bounded interval:

```json
{ "from": "person:Q567", "type": "HEAD_OF", "to": "org:Q<gov>",
  "basis": "direct", "validFrom": "2005-11-22", "validTo": "2021-12-08",
  "confidence": 0.99 }
```

When an official leaves office, the existing edge's `validTo` is closed and a
new edge opens for the successor. Nothing is deleted — succession is queryable.

## Planned intra-domain edges

| From | Relation | To | Basis |
|---|---|---|---|
| PublicOfficial | `HEAD_OF` | Government | `direct` |
| PublicOfficial | `MEMBER_OF` | Parliament / Party | `direct` |
| Government | `GOVERNS` | Country | `direct` |
| Ministry | `MEMBER_OF` | Government | `direct` |
| Government | `MEMBER_OF` | InternationalOrganization (UN, EU) | `direct` |

## Planned cross-domain edges

- **Politics ↔ News** — `NewsArticle` `MENTIONS` `PublicOfficial`/`Government`
  (basis `reported`), the foundation for news person/org NER once Wikidata is
  wired.
- **Politics ↔ Sanctions** — a sanctioned `Person`/`Organization` (domain 15)
  may be the same node as a `PublicOfficial`; link only on shared identifiers
  (Wikidata QID / LEI), basis `entity-overlap`.
- **Politics ↔ Conflict** — `Government` `INVOLVES` a `ConflictEvent`
  (basis `reported`).
- **Politics ↔ Economics** — `Government` `GOVERNS` a country whose
  `EconomicIndicator` observations describe its economy.

## Conservative linking

- Cross-domain identity is asserted only on **authoritative identifiers**
  (Wikidata QID, LEI), never on name similarity alone → basis `entity-overlap`.
- News mentions are `reported`, not `direct`.
- Any purely heuristic link uses `inferred-low-confidence` with `confidence`
  well below 0.5, and is surfaced as such.
