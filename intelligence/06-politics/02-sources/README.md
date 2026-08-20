# Politics — Planned Sources

No source is live for this domain. Only **Wikidata** has a registry entry in
`lib/intel/sources.ts` (`id: "wikidata"`, `enabled: false`, `status: "next"`);
the rest below are documented intent with no code yet.

## Wikidata — `wikidata` — NEXT

- **Registry:** present (`SOURCES` in `lib/intel/sources.ts`), `enabled: false`.
- **baseUrl:** `https://www.wikidata.org/w/api.php`
- **Type:** api · **auth:** none · **polling:** false
- **Rate/cache:** `minIntervalSec: 2`, `cacheTtlSec: 604800` (7 days),
  concurrency 2, maxRetries 3.
- **Licensing:** CC0 — `commercialUse: allowed`, `redistribution: allowed`,
  `attributionRequired: false`. The cleanest license in the registry.
- **Format:** JSON (`wbgetentities` / `wbsearchentities`; SPARQL via the
  Query Service as an alternative).
- **Coverage:** persons (QIDs), organizations, offices, positions held with
  qualifiers (P39 position held, P580 start time, P582 end time), country
  memberships, party affiliation.
- **History:** none ingested. Adapter interface referenced but not live-wired.
- **Priority:** High — unlocks person/org NER across news + politics.
- **Sample:** `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q567&format=json`

## National / EU parliament open data — RESEARCH

- **Intent:** legislature membership, committees, votes, bills. Examples:
  UK Parliament API, Bundestag/DIP, European Parliament Open Data Portal.
- **baseUrl:** varies per legislature; no single endpoint.
- **Type:** api/bulk · **auth:** mostly none, some api-key.
- **Licensing:** varies (many open-gov / CC BY); **LEGAL_REVIEW** per source.
- **Coverage:** MPs/MEPs, terms, party groups, roll-call votes.
- **Status:** RESEARCH — not in registry. Priority Medium.

## National election authorities — RESEARCH

- **Intent:** official election calendars and results (electoral commissions,
  IFES ElectionGuide as an aggregator).
- **Type:** api/scrape/file · **auth:** varies · **licensing:** varies —
  **LEGAL_REVIEW**.
- **Coverage:** upcoming election dates, offices contested, certified results.
- **Status:** RESEARCH. Priority Medium — feeds "next election" profiles.

## UN bodies — RESEARCH

- **Intent:** UN membership, Security Council/General Assembly, treaty
  depositary records (UN Treaty Collection), sanctions committees.
- **baseUrl:** e.g. `https://digitallibrary.un.org/`, `https://treaties.un.org/`
- **Type:** api/scrape · **auth:** none/optional · **licensing:** UN terms —
  **LEGAL_REVIEW**.
- **Status:** RESEARCH. Priority Medium.

## GDELT — `gdelt` (already live for news) — reuse

- Live for `news`/`global` (`status: implemented`). Planned reuse here as a
  political **event/mention** feed once person/org NER (Wikidata) exists.
- **Licensing caution:** GDELT terms — metadata/links only, redistribution
  restricted, attribution "The GDELT Project". Do not store article bodies.

## Acquisition discipline

Follows the registry's conservative vocabulary: never claim a permission not
verified. Parliament/election/UN sources each need an individual licensing
pass before wiring (hence LEGAL_REVIEW / RESEARCH, not NEXT).
