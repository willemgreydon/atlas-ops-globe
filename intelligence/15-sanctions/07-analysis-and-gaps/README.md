# Sanctions — Analysis & Gaps

All analysis below is **intended**. The `sanctions` table is empty and no
source is wired, so every query returns nothing today.

## Intended derived metrics

- **Designations by authority / program** — counts grouped by `authority`,
  `program`, `jurisdiction`, `subject_type`.
- **Screening lookups** — given an IMO/MMSI/ICAO24/LEI/QID, is the subject
  listed, and under which programs.
- **Overlap coverage** — how many subjects appear on more than one list
  (OFAC ∩ EU ∩ UN), matched by strong identifier.
- **List freshness** — most recent `updated_at` per `source`; delisting churn.
- **Cross-domain flags** — sanctioned vessels currently observed (domain 04),
  sanctioned aircraft (domain 03), sanctioned issuers (domain 08).

## Example queries (planned)

```sql
-- Screen a vessel by IMO (identifier-first)
SELECT name, program, authority, listed_at FROM sanctions
WHERE subject_type = 'Vessel'
  AND json_extract(identifiers, '$.imo') = '9175265';

-- Designations by authority and program
SELECT authority, program, COUNT(*) AS n FROM sanctions
GROUP BY authority, program ORDER BY n DESC;

-- Subjects on multiple lists (strong-id overlap on LEI)
SELECT json_extract(identifiers,'$.lei') AS lei, COUNT(DISTINCT authority) AS lists
FROM sanctions WHERE json_extract(identifiers,'$.lei') IS NOT NULL
GROUP BY lei HAVING lists > 1;
```

## Coverage gaps / blind spots (honest)

- **Nothing ingested.** `sanctions` is empty; OFAC is free and `next` but
  unwired — a low-hanging gap. No EU/UK/UN lists are even in the registry.
- **No writer, no ingestor, no Zod schema** for sanctions yet — only the table
  and ontology type exist.
- **Identifier sparsity:** many listings lack strong identifiers (especially
  older person entries), so a meaningful share can only ever be low-confidence
  name matches — a permanent limitation of the source data, not a bug.
- **Transliteration/alias noise:** non-Latin names produce many alias variants;
  without identifiers these are irreducibly ambiguous.
- **No enforcement/effective-date nuance** modeled beyond `listed_at` /
  `updated_at`.

## Quality / matching discipline (the core of this domain)

- **Never sanction-match on name similarity alone.** Confirmed matches require
  a shared authoritative identifier (IMO, MMSI, aircraft reg, ICAO24, LEI,
  registry id, Wikidata QID, passport).
- **Preserve confidence and ambiguity.** Name-only candidates are surfaced with
  `confidence < 0.5` and `basis = inferred-low-confidence`, flagged for review,
  never auto-confirmed.
- **Keep lists distinct.** Each authority is its own `authority`/`jurisdiction`;
  overlap is computed by identifier, not by merging lists.
- **Audit trail.** Retain each list's `raw_hash` and retrieval time in
  provenance so any match is reproducible.
