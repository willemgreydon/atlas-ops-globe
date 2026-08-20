# 10 — Infrastructure · Analysis & Gaps (PLANNED)

Infrastructure is scaffolded. `docs/08-intelligence/coverage-gaps.md` notes:
*"`ourairports` would seed infrastructure/airport reference but is not loaded"*
and lists Airports/Ports as empty. This section describes intended analytics.

## Intended metrics

- **Asset density by country / subtype** — counts grouped by `country_code` and
  `data.subtype` (or table).
- **Airport/port coverage** — airports by `type` (large/medium/small), ports by
  UN/LOCODE presence.
- **Anchor completeness** — % of aviation flights / maritime voyages whose
  `DEPARTED_FROM`/`ARRIVED_AT` endpoints resolve to a known Airport/Port.
- **Exposure** — assets `AFFECTED_BY` active disasters/conflict.
- **Freshness & precision** — mean `provenance` age, % `geoPrecision = exact`.

## Example queries (PLANNED)

```sql
-- Airports by type (once loaded)
SELECT type, COUNT(*) FROM airports GROUP BY type ORDER BY 2 DESC;

-- Ports per country
SELECT country_code, COUNT(*) FROM ports GROUP BY country_code;

-- Infrastructure assets by subtype
SELECT json_extract(data,'$.subtype') AS subtype, COUNT(*)
FROM entities WHERE type='InfrastructureAsset' GROUP BY subtype;

-- Data centers near power substations
SELECT e.name FROM entities e
JOIN relationships r ON r.from_id=e.id AND r.type='NEAR'
WHERE json_extract(e.data,'$.subtype')='DataCenter';
```

All return **0 rows today**.

## Coverage gaps (HONEST)

- **No live ingestion.** `INGESTORS["infrastructure"]` absent; `ourairports`
  registered but `enabled:false`/`next` and not bulk-loaded → `airports`,
  `ports` empty.
- **No airport/port repository writers.** `repositories.ts` lacks
  `upsertAirport`/`upsertPort`; writing the dedicated tables is a planned addition.
- **No non-airport/port sources wired.** OSM/Overpass/Geofabrik/OpenInfraMap and
  government portals are planned only.
- **License caution.** OSM-derived sources are ODbL (share-alike) →
  `redistribution: review-required`; must be cleared before wiring.
- **Operator resolution absent.** `OPERATED_BY`/`OWNED_BY` await the Wikidata
  org adapter (`next`).

## Quality & discipline

When live: `VaultQuality` per asset, multi-source provenance, conservative
confidence. Collection stays within legitimate public situational-awareness
detail from reputable public sources — no security-sensitive specifics. Until
ingestion exists, all infrastructure metrics are aspirational and must not be
presented as measured.
