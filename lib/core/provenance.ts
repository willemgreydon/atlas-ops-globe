import type { Provenance } from "@/types/domain";

/**
 * Bump when a provider's normalization logic changes in a way that alters
 * output shape/values. Lets us reason about records produced by older code.
 */
export const TRANSFORMATION_VERSION = "1.0.0";

export interface ProvenanceInput {
  provider: string;
  providerRecordId?: string;
  sourceUrl?: string;
  observedAt?: string;
  confidence?: number;
  rawObjectHash?: string;
}

export function makeProvenance(input: ProvenanceInput): Provenance {
  return {
    provider: input.provider,
    providerRecordId: input.providerRecordId,
    sourceUrl: input.sourceUrl,
    retrievedAt: new Date().toISOString(),
    observedAt: input.observedAt,
    confidence: input.confidence,
    rawObjectHash: input.rawObjectHash,
    transformationVersion: TRANSFORMATION_VERSION,
  };
}
