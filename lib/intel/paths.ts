import { resolve } from "node:path";

/**
 * Canonical on-disk folder names for the intelligence vault. Domain folders are
 * numerically prefixed (01-global … 16-space) for a stable, readable ordering,
 * while the logical domain KEY used across the code (registry, sources, CLI)
 * stays unprefixed. This map is the single source of truth linking the two.
 */
export const DOMAIN_DIR: Record<string, string> = {
  global: "01-global",
  conflict: "02-conflict",
  aviation: "03-aviation",
  maritime: "04-maritime",
  news: "05-news",
  politics: "06-politics",
  economics: "07-economics",
  markets: "08-markets",
  energy: "09-energy",
  infrastructure: "10-infrastructure",
  environment: "11-environment",
  weather: "12-weather",
  disasters: "13-disasters",
  cyber: "14-cyber",
  sanctions: "15-sanctions",
  space: "16-space",
};

export const INTEL_ROOT = "intelligence";
export const CORE_DIR = "_core";

/** Absolute path inside a domain's vault folder. */
export function domainPath(domainKey: string, ...parts: string[]): string {
  const dir = DOMAIN_DIR[domainKey] ?? domainKey;
  return resolve(process.cwd(), INTEL_ROOT, dir, ...parts);
}

/** Absolute path inside the shared _core folder. */
export function corePath(...parts: string[]): string {
  return resolve(process.cwd(), INTEL_ROOT, CORE_DIR, ...parts);
}
