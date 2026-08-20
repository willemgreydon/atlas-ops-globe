# 06 — Cyber Relationships

Cyber mints **no relationship edges today**. Vulnerabilities are stored in the
standalone `vulnerabilities` table and are not connected to the spatial entity
graph. This is deliberate: cyber is non-spatial and we do not fabricate links.

## Why no edges

- **No country/location** — a CVE has no meaningful geography, so there is no
  `OCCURRED_IN country` edge (unlike disasters/news).
- **No entity resolution for vendors** — `vendor`/`products` are free-text fields
  on the vulnerability, not resolved to `Company`/`Organization` nodes, so no
  `AFFECTS`/`INVOLVES` edges are created.

## Relation types that *would* apply if wired (PLANNED)

Using `RELATION_TYPES` + `RELATIONSHIP_BASIS` from `lib/intel/ontology.ts`:

| Relation | Example | Basis (would be) |
|---|---|---|
| `INVOLVES` | `cve:CVE-2024-1234 INVOLVES org:<vendor>` | `entity-overlap` |
| `AFFECTED_BY` | `org:<vendor> AFFECTED_BY cve:CVE-2024-1234` | `reported` |
| `RELATED_TO` | `cve:… RELATED_TO cve:…` (shared CWE) | `entity-overlap` |

None of these are minted — vendor/product entity resolution is not wired, and
building them would require conservative entity matching we have not validated.

## Conservative-linking discipline

- We never invent a spatial edge for a CVE to make it appear on the globe.
- Vendor strings are kept as attributes, not promoted to entity links, until a
  resolver (e.g. Wikidata `next`) can establish them with a defensible basis.
- If edges are added later, each would carry an explicit `RELATIONSHIP_BASIS`
  (likely `entity-overlap` or `reported`) rather than being presented as a hard
  fact.
