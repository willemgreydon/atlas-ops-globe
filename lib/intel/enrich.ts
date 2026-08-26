import { stableId } from "@/lib/core/id";
import { upsertRelationship } from "./repositories";
import { prov } from "./provenance";
import { IdOf } from "./ids";
import type { RelationshipBasis, RelationType } from "./ontology";
import type { DatabaseSync } from "node:sqlite";

/**
 * Enrichment helpers: create conservative, provenance-labelled relationships.
 * Every edge records HOW it was established (basis) so an inferred/near link is
 * never presented as a hard fact. We only link what the data justifies.
 */
export function relate(
  from: string,
  type: RelationType,
  to: string,
  basis: RelationshipBasis,
  confidence: number,
  db?: DatabaseSync,
): void {
  const id = stableId("rel", from, type, to);
  // Every edge is DERIVED by this pipeline from the `from` record, whose own
  // provenance chains back to the origin provider. Recording that lineage means
  // a relationship is never an unattributed assertion (audit P0-2): an inspector
  // can trace edge → source record → provider.
  const provenance = [
    prov({ provider: "atlas-enrich", dataset: "relationships", providerRecordId: from, pipeline: "enrich", confidence }),
  ];
  upsertRelationship({ id, from, type, to, basis, confidence, provenance }, db);
}

/** article OCCURRED_IN / MENTIONS country (reported basis — from source metadata). */
export function linkArticleCountry(articleId: string, iso2: string, db?: DatabaseSync): void {
  relate(articleId, "OCCURRED_IN", IdOf.country(iso2), "reported", 0.7, db);
}

/** event OCCURRED_IN country (spatially resolved). */
export function linkEventCountry(eventId: string, iso2: string, basis: RelationshipBasis, db?: DatabaseSync): void {
  relate(eventId, "OCCURRED_IN", IdOf.country(iso2), basis, basis === "reported" ? 0.85 : 0.6, db);
}
