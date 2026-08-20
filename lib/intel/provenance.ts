import { TRANSFORMATION_VERSION } from "@/lib/core/provenance";
import type { VaultProvenance } from "./schemas";

/**
 * Build a rich {@link VaultProvenance} record. Richer than the app-side
 * `makeProvenance` (adds dataset, publishedAt, license, attribution, raw
 * pointers) — this is the provenance stored in the vault DB.
 */
export interface VaultProvenanceInput {
  provider: string;
  dataset?: string;
  providerRecordId?: string;
  sourceUrl?: string;
  observedAt?: string;
  publishedAt?: string;
  license?: string;
  attribution?: string;
  rawPath?: string;
  rawHash?: string;
  confidence?: number;
  pipeline?: string;
}

export function prov(input: VaultProvenanceInput): VaultProvenance {
  return {
    provider: input.provider,
    dataset: input.dataset,
    providerRecordId: input.providerRecordId,
    sourceUrl: input.sourceUrl,
    observedAt: input.observedAt,
    publishedAt: input.publishedAt,
    retrievedAt: new Date().toISOString(),
    license: input.license,
    attribution: input.attribution,
    rawPath: input.rawPath,
    rawHash: input.rawHash,
    transformation: { pipeline: input.pipeline ?? "vault", version: TRANSFORMATION_VERSION },
    confidence: input.confidence,
  };
}
