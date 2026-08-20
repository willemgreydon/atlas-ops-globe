# Sanctions — Planned Sources

Only **OFAC** has a registry entry in `lib/intel/sources.ts` (`id: "ofac"`,
`enabled: false`, `status: "next"`). The EU/UK/UN lists below are documented
intent with no code yet.

## OFAC Sanctions List Service — `ofac` — NEXT

- **Registry:** present, `enabled: false`.
- **Provider:** US Treasury OFAC · **baseUrl:**
  `https://sanctionslist.ofac.treas.gov/`
- **Type:** bulk · **auth:** none · **polling:** true.
- **Rate/cache:** default `minIntervalSec: 5`, `cacheTtlSec: 86400` (1 day),
  concurrency 2, maxRetries 3.
- **Licensing:** US Government open data — `commercialUse: allowed`,
  `redistribution: allowed`, `attributionRequired: false`.
- **Format:** bulk list (XML/CSV — SDN + Consolidated; the ADV/CONS/SDN
  advanced XML carries structured identifiers).
- **Coverage:** SDN list + non-SDN consolidated lists: persons, entities,
  vessels, aircraft, with programs, aliases, and identity documents.
- **History:** none ingested. Registry entry only.
- **Priority:** **High** — free, high value, unwired.
- **Sample:** `https://sanctionslist.ofac.treas.gov/Home/ConsolidatedList`

## EU consolidated list — RESEARCH

- **Provider:** European Commission / FISMA · **baseUrl:**
  `https://webgate.ec.europa.eu/fsd/fsf` (consolidated financial sanctions).
- **Type:** bulk/file · **auth:** token (a free access token is required).
- **Licensing:** EU terms — likely redistributable with attribution;
  **LEGAL_REVIEW**.
- **Format:** XML/CSV. **Coverage:** EU restrictive measures — persons,
  entities, with identifiers.
- **Status:** RESEARCH. Priority High (after OFAC).

## UK sanctions list (OFSI) — RESEARCH

- **Provider:** UK OFSI (HM Treasury) · **baseUrl:**
  `https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets`
- **Type:** file/bulk · **auth:** none · **licensing:** Open Government
  Licence (OGL), attribution required — **LEGAL_REVIEW** to confirm.
- **Format:** CSV/ODT/XML. **Coverage:** UK consolidated targets.
- **Status:** RESEARCH. Priority Medium.

## UN Security Council consolidated list — RESEARCH

- **Provider:** UN Security Council · **baseUrl:**
  `https://scsanctions.un.org/resources/xml/en/consolidated.xml`
- **Type:** file/bulk · **auth:** none · **licensing:** UN terms —
  **LEGAL_REVIEW**.
- **Format:** XML. **Coverage:** UN designations (individuals + entities),
  the multilateral baseline many national lists build on.
- **Status:** RESEARCH. Priority Medium.

## Acquisition discipline

Follows the registry's conservative vocabulary. OFAC is `next` (free, open,
ready to wire). EU/UK/UN remain RESEARCH pending a licensing pass and, for the
EU list, a free access token. Each authority is a distinct `authority` /
`jurisdiction` value in the `sanctions` table — lists are never merged blindly.
