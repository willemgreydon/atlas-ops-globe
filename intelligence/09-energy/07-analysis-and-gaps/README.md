# 09 — Energy · Analysis & Gaps (PLANNED)

Energy is **entirely planned**. `docs/08-intelligence/coverage-gaps.md` states it
plainly: *"No source wired for … Energy … `EnergyAsset` coverage [is] entirely
planned."* This section describes the metrics and queries the domain would
support once ingestion exists.

## Intended metrics

- **Installed capacity by country / fuel** — sum `data.capacityMw` grouped by
  `country_code` and `data.fuelType`.
- **Asset count by subtype** and **status mix** (operating vs construction vs
  planned vs retired).
- **Cross-border dependency** — interconnector/pipeline capacity linking country
  pairs (from endpoint geography).
- **Exposure** — assets `NEAR`/`AFFECTED_BY` active disaster or conflict events.
- **Coverage & freshness** — % assets with `geoPrecision = exact`, mean
  `provenance.confidence`, staleness vs `retrievedAt`.

## Example queries (PLANNED)

```sql
-- Capacity by country and fuel (once populated)
SELECT country_code,
       json_extract(data,'$.fuelType') AS fuel,
       SUM(json_extract(data,'$.capacityMw')) AS mw
FROM entities WHERE type='EnergyAsset'
GROUP BY country_code, fuel ORDER BY mw DESC;

-- Nuclear plants under construction
SELECT name, country_code FROM entities
WHERE type='EnergyAsset'
  AND json_extract(data,'$.subtype')='NuclearPlant'
  AND json_extract(data,'$.status')='construction';

-- Assets exposed to active disaster events
SELECT e.name FROM entities e
JOIN relationships r ON r.from_id=e.id AND r.type='AFFECTED_BY'
WHERE e.type='EnergyAsset';
```

All return **0 rows today** — the `entities` table has no `EnergyAsset` rows.

## Coverage gaps (HONEST)

- **No source wired.** `sourcesForDomain("energy")` = `[]`; no `energy` ingestor
  in `INGESTORS`; `manifest.json` `sources: []`.
- **No dedicated table.** Capacity/fuel/status live in an untyped JSON `data`
  blob on `entities`; SQL must use `json_extract`, and no `EnergyAssetData` Zod
  guard exists yet.
- **No operator resolution.** `OPERATED_BY`/`OWNED_BY` edges depend on the
  Wikidata org adapter (status `next`), so operator links are absent.
- **No grid connectivity.** Physical line-level topology needs ENTSO-E/OSM
  modelling; only proximity (`NEAR`) would be inferable initially.
- **Licensing not cleared.** GEM/ENTSO-E/OSM redistribution stances are
  `review-required`; must be reified in `sources.ts` before wiring.

## Quality posture

When live, quality would follow the vault standard: `VaultQuality`
(`geoPrecision`, `entityConfidence`, `sourceAgreement`), multi-source provenance,
and conservative confidence defaults. Until then, all energy metrics are
aspirational and must not be presented as measured.
