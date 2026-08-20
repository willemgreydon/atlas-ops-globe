# 02 · Conflict — Relationships

**Status: PLANNED.** No conflict edges are written today. The design reuses the
IMPLEMENTED `relate()` / `linkEventCountry()` helpers in `lib/intel/enrich.ts`
and the vocabulary in `lib/intel/ontology.ts`.

## Intended edges

| From | Type | To | Basis | Confidence |
|---|---|---|---|---|
| `event:<provider>:<id>` | `OCCURRED_IN` | `country:<ISO2>` | `reported` | 0.85 |
| `event:<provider>:<id>` | `OCCURRED_IN` | `country:<ISO2>` | `spatially-near` | 0.60 |
| conflict event | `INVOLVES` | `org:…` (actor) | `reported` | PLANNED |
| conflict event | `MENTIONS` | `person:…` (actor) | `reported` | PLANNED |

`linkEventCountry(id, iso2, basis)` is IMPLEMENTED and already sets confidence
0.85 for `reported` and 0.6 otherwise — the same call disasters uses. Actor
edges (`INVOLVES`/`MENTIONS`) require the PLANNED NER/Wikidata layer.

## Relationship basis (`RELATIONSHIP_BASIS`)

`direct`, `reported`, `spatially-near`, `temporally-related`, `entity-overlap`,
`inferred-low-confidence`. Conflict country ties use `reported` (from source
coordinates/coding) or `spatially-near` (nearest-centroid fallback). Actor ties
would be `reported`. **`inferred-low-confidence` is reserved** and must be
visibly labelled if ever used.

## Conservative linking discipline

- **Never infer casualties or outcomes** into an edge or event — only encode what
  the source reports.
- **Never convert rumours to facts.** Ambiguous actor attribution stays as a tag,
  not an `INVOLVES` edge.
- **Basis is first-class:** a `spatially-near` country tie (fallback geocode) is
  never presented as a hard, reported location — confidence and basis make the
  distinction explicit.
- **No fabricated co-occurrence.** Two events near each other in space/time are
  not linked unless a source asserts the relationship.

## Edge identity & idempotency

`stableId("rel", from, type, to)` → `upsertRelationship()` with
`ON CONFLICT(id) DO UPDATE`. Re-ingest does not duplicate edges.

## Example (target, PLANNED)

```
event:acled:0011223 --OCCURRED_IN[reported,0.85]--> country:SY
event:acled:0011223 --INVOLVES[reported]--------->  org:<armed-group QID>
```
