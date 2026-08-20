/**
 * Confidence engine.
 *
 * Confidence is never a hardcoded UI percentage — it is computed from signals
 * and is explainable. `scoreConfidence` returns both a 0..1 score and the
 * factor breakdown so a panel can show *why* something scored the way it did.
 */

export interface ConfidenceSignals {
  /** Distinct independent sources reporting the same thing. */
  sourceCount?: number;
  /** 0..1 baseline reliability of the reporting provider(s). */
  providerReliability?: number;
  /** Age of the observation in seconds. */
  ageSeconds?: number;
  /** Freshness SLA in seconds; older than this decays confidence. */
  freshnessSlaSeconds?: number;
  /** 0..1 geospatial precision (1 = exact coords, 0 = country centroid guess). */
  geoPrecision?: number;
  /** True when independent sources disagree on key facts. */
  conflictingSources?: boolean;
}

export interface ConfidenceFactor {
  label: string;
  /** Signed contribution to the final score, for explainability. */
  weight: number;
}

export interface ConfidenceResult {
  score: number;
  factors: ConfidenceFactor[];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scoreConfidence(signals: ConfidenceSignals): ConfidenceResult {
  const factors: ConfidenceFactor[] = [];

  // Corroboration: more independent sources -> higher confidence, diminishing.
  const sources = Math.max(1, signals.sourceCount ?? 1);
  const corroboration = 1 - 1 / (sources + 1); // 1->0.5, 2->0.67, 3->0.75
  factors.push({ label: `${sources} source(s)`, weight: corroboration * 0.35 });

  // Provider reliability.
  const reliability = clamp01(signals.providerReliability ?? 0.6);
  factors.push({ label: "provider reliability", weight: reliability * 0.25 });

  // Freshness decay.
  if (signals.ageSeconds != null && signals.freshnessSlaSeconds) {
    const freshness = clamp01(1 - signals.ageSeconds / signals.freshnessSlaSeconds);
    factors.push({ label: "freshness", weight: freshness * 0.2 });
  } else {
    factors.push({ label: "freshness (unknown)", weight: 0.1 });
  }

  // Geospatial precision.
  const geo = clamp01(signals.geoPrecision ?? 0.7);
  factors.push({ label: "geo precision", weight: geo * 0.2 });

  // Penalty for conflicting sources.
  if (signals.conflictingSources) {
    factors.push({ label: "conflicting sources", weight: -0.25 });
  }

  const score = clamp01(factors.reduce((sum, f) => sum + f.weight, 0));
  return { score, factors };
}
