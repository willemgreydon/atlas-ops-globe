# Politics — Analysis & Gaps

All analysis below is **intended**. No politics data exists in the vault, so
every query returns empty today.

## Intended derived metrics

- **Country political profile** — current head of state, head of government,
  cabinet composition, next scheduled election, per `country:<iso2>`.
- **Government stability signal** — cabinet turnover rate from the count of
  `HEAD_OF` / `MEMBER_OF` edges closed (`validTo` set) per window.
- **Office continuity** — tenure length distributions from `validFrom`/`validTo`.
- **Political salience** — `mention_count` on `persons`/`organizations`, driven
  by news `MENTIONS` edges.
- **Membership graph** — parliament/party composition and IO membership.

## Example queries (planned)

```sql
-- Who is head of government of Germany today?
SELECT p.canonical_name, r.valid_from
FROM relationships r
JOIN persons p ON p.id = r.from_id
WHERE r.type = 'HEAD_OF' AND r.to_id = 'org:Q<german-gov>'
  AND (r.valid_to IS NULL OR r.valid_to > date('now'));

-- Upcoming elections in the next 180 days
SELECT title, country_code, occurred_at
FROM events
WHERE kind = 'political' AND subtype = 'election'
  AND occurred_at BETWEEN date('now') AND date('now','+180 day')
ORDER BY occurred_at;

-- Officials by news salience
SELECT canonical_name, mention_count FROM persons
ORDER BY mention_count DESC LIMIT 20;
```

## Coverage gaps / blind spots (honest)

- **Nothing ingested.** `persons`, `organizations`, and political `events` are
  empty. No head-of-state, cabinet, election, party, or treaty data exists.
- **Depends on Wikidata NER**, which is `next` and not wired — the single
  blocking dependency for this domain.
- **Parliament / election / UN sources are RESEARCH-stage**, each pending an
  individual licensing pass; none are in the source registry.
- **Wikidata staleness** — office-holder data can lag real-world reshuffles by
  its edit latency; profiles must display `validFrom` and retrieval timestamps.
- Two territories without ISO2 (Northern Cyprus, Somaliland) are absent from
  the country seed and thus cannot anchor a political profile.

## Quality / matching discipline

- **Always timestamp office-holder data.** Never present a `HEAD_OF` fact
  without its `validFrom` (and `validTo` when applicable) and the source
  retrieval time.
- **QID-first identity.** Merge persons/orgs only on Wikidata QID (or LEI for
  orgs), never on name similarity — cross-domain overlaps use basis
  `entity-overlap`.
- **Confidence is explicit** on every edge; heuristic links stay
  `inferred-low-confidence`.
