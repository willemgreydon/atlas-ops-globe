# Sanctions — Relationships (Planned)

Edges use `RELATION_TYPES` and `RELATIONSHIP_BASIS` from
`lib/intel/ontology.ts`. None are populated for sanctions today.

## Basis vocabulary (from `ontology.ts`)

`direct | reported | spatially-near | temporally-related | entity-overlap |
inferred-low-confidence`. The `basis` field keeps a probable-but-unproven match
from ever looking like a hard fact.

## Core edges (from `RELATION_TYPES`)

| From (subject) | Relation | To | Basis |
|---|---|---|---|
| Person/Org/Vessel/Aircraft | `SANCTIONED_BY` | authority (OFAC/EU/OFSI/UN) | `direct` |
| Person/Org/Vessel/Aircraft | `SUBJECT_TO` | program | `direct` |

Both use `SANCTIONED_BY` and `SUBJECT_TO` verbatim from the ontology. The
designation date maps to the edge `validFrom`; a delisting sets `validTo`,
preserving the sanction's history rather than deleting it.

## Cross-domain edges (identifier-gated)

- **Sanctions ↔ Maritime** — sanction subject `entity-overlap` a
  `vessel:imo-<IMO>` (domain 04) **only** when the IMO/MMSI matches.
- **Sanctions ↔ Aviation** — subject → `aircraft:icao24-<hex>` (domain 03) on
  ICAO24 / registration match.
- **Sanctions ↔ Politics/Orgs** — subject → `org:LEI-<lei>` or `person:Q<qid>`
  (domain 06) on LEI / QID match.
- **Sanctions ↔ Markets** — a sanctioned issuer flags its instruments
  (domain 08) via the shared org id.

## Conservative matching (non-negotiable)

- **Never link on name similarity alone.** A cross-domain edge requires a
  shared authoritative identifier (IMO, MMSI, aircraft reg, ICAO24, LEI,
  registry id, Wikidata QID, passport). Such matches are basis
  `entity-overlap` with high `confidence`.
- **Name-only candidates** are stored as `inferred-low-confidence` edges with
  `confidence < 0.5` and are surfaced as *possible* matches for human review —
  never auto-confirmed.
- **Preserve ambiguity.** If two subjects could be the same entity but no
  strong key confirms it, both are kept distinct; the uncertainty is recorded
  in `quality.entityConfidence` and the edge `confidence`, not hidden.
- A false match and a missed match both matter — the pipeline is biased toward
  explicit uncertainty over false confidence.
