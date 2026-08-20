/**
 * Stable, deterministic internal IDs. A domain entity's internal ID must be
 * independent of any single provider's identifier, so the same real-world thing
 * from two providers can later be resolved to one entity.
 *
 * `stableId(kind, ...parts)` produces `kind:hash` where the hash is a stable
 * FNV-1a of the joined parts. Deterministic (no randomness) so it survives
 * process restarts and enables dedup.
 */
export function stableId(kind: string, ...parts: (string | number | undefined)[]): string {
  const key = parts.filter((p) => p !== undefined && p !== "").join("|");
  return `${kind}:${fnv1a(key)}`;
}

/** 32-bit FNV-1a hash rendered as base36. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
