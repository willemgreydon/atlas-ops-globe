# Markets — Relationships (Planned)

Edges use `RELATION_TYPES` and `RELATIONSHIP_BASIS` from
`lib/intel/ontology.ts`. None are populated for markets today.

## Basis vocabulary (from `ontology.ts`)

`direct | reported | spatially-near | temporally-related | entity-overlap |
inferred-low-confidence`. The `basis` field keeps inferred links honest.

## Planned intra-domain edges

| From | Relation | To | Basis |
|---|---|---|---|
| MarketObservation | `OBSERVED_BY` | MarketInstrument (via `symbol`) | `direct` |
| MarketInstrument | `OWNED_BY` / `OPERATED_BY` | issuer Organization | `direct` |
| MarketInstrument (FX pair) | `RELATED_TO` | two currencies/countries | `direct` |
| MarketInstrument (index) | `INVOLVES` | constituent instruments | `direct` |

Note: the observation→instrument link is primarily a **join on `symbol`**, not
a stored relationship row, given the volume; explicit edges are reserved for
instrument→issuer and index→constituent relationships.

## Planned cross-domain edges

- **Markets ↔ Politics/Companies** — `MarketInstrument` `OWNED_BY` an
  `Organization`/`Company` (domain 06/generic), joined on **LEI**
  (`IdOf.org({ lei })`) — an authoritative identifier, basis `direct`.
- **Markets ↔ Economics** — an FX or rate `MarketObservation` `RELATED_TO` a
  `country:<iso2>` and its `EconomicIndicator` series (domain 07), basis
  `direct` for FX-by-currency, `reported` for looser associations.
- **Markets ↔ Energy** — commodity instruments (oil, gas, power) `RELATED_TO`
  `EnergyAsset` (domain 09), basis `reported`.
- **Markets ↔ Sanctions** — a sanctioned issuer (domain 15) makes its listed
  instruments relevant; link only via the shared org identifier (LEI/QID),
  basis `entity-overlap`.

## Conservative linking

- Instrument-to-issuer links are asserted on **LEI/ISIN/FIGI**, never on issuer
  name similarity → basis `direct` only with an authoritative id, else
  `entity-overlap`.
- Correlations between instruments (e.g. "moves with") are **not** stored as
  hard edges; if ever derived they use `inferred-low-confidence` with a
  sub-0.5 `confidence`.
- Latency matters even in relationships: never assert a real-time relationship
  from delayed observations.
