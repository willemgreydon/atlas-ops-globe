import { z } from "zod";

/**
 * Canonical, provider-independent schemas for records stored in the vault.
 * External payloads are validated against a *source* schema in each provider,
 * then transformed and validated against these *canonical* schemas before
 * storage. Malformed records are logged and skipped, never stored raw.
 */

export const VaultProvenance = z.object({
  provider: z.string(),
  dataset: z.string().optional(),
  providerRecordId: z.string().optional(),
  sourceUrl: z.string().optional(),
  observedAt: z.string().optional(),
  publishedAt: z.string().optional(),
  retrievedAt: z.string(),
  license: z.string().optional(),
  attribution: z.string().optional(),
  rawPath: z.string().optional(),
  rawHash: z.string().optional(),
  transformation: z.object({ pipeline: z.string(), version: z.string() }).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type VaultProvenance = z.infer<typeof VaultProvenance>;

export const VaultQuality = z.object({
  freshness: z.number().min(0).max(1).optional(),
  completeness: z.number().min(0).max(1).optional(),
  geoPrecision: z.enum(["exact", "city", "admin", "country", "region", "unknown"]).optional(),
  temporalPrecision: z.enum(["second", "minute", "hour", "day", "month", "unknown"]).optional(),
  entityConfidence: z.number().min(0).max(1).optional(),
  sourceAgreement: z.number().min(0).max(1).optional(),
});
export type VaultQuality = z.infer<typeof VaultQuality>;

/** Generic node in the entity store. Domain tables hold the richer specifics. */
export const VaultEntity = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  countryCode: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  quality: VaultQuality.optional(),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultEntity = z.infer<typeof VaultEntity>;

export const VaultRelationship = z.object({
  id: z.string(),
  from: z.string(),
  type: z.string(),
  to: z.string(),
  basis: z.string(),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultRelationship = z.infer<typeof VaultRelationship>;

export const VaultEvent = z.object({
  id: z.string(),
  kind: z.string(),
  subtype: z.string().optional(),
  title: z.string(),
  summary: z.string().optional(),
  severity: z.enum(["info", "watch", "warning", "critical"]),
  occurredAt: z.string(),
  publishedAt: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  countryCode: z.string().optional(),
  source: z.string(),
  sourceUrl: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).default([]),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultEvent = z.infer<typeof VaultEvent>;

export const VaultNews = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().optional(),
  source: z.string(),
  publisher: z.string().optional(),
  publishedAt: z.string(),
  language: z.string().optional(),
  countryCode: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  persons: z.array(z.string()).default([]),
  organizations: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  storyId: z.string().optional(),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultNews = z.infer<typeof VaultNews>;

export const VaultVulnerability = z.object({
  id: z.string(), // CVE id
  title: z.string().optional(),
  cvss: z.number().nullable().optional(),
  epss: z.number().nullable().optional(),
  cwe: z.array(z.string()).default([]),
  vendor: z.string().optional(),
  products: z.array(z.string()).default([]),
  kev: z.boolean().default(false),
  kevDateAdded: z.string().optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  references: z.array(z.string()).default([]),
  source: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultVulnerability = z.infer<typeof VaultVulnerability>;

export const VaultSpaceObject = z.object({
  id: z.string(), // satellite:norad-...
  norad: z.string(),
  cospar: z.string().optional(),
  name: z.string(),
  operator: z.string().optional(),
  country: z.string().optional(),
  objectType: z.string().optional(),
  launchDate: z.string().optional(),
  tleLine1: z.string().optional(),
  tleLine2: z.string().optional(),
  epoch: z.string().optional(),
  inclinationDeg: z.number().nullable().optional(),
  periodMin: z.number().nullable().optional(),
  apogeeKm: z.number().nullable().optional(),
  perigeeKm: z.number().nullable().optional(),
  source: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultSpaceObject = z.infer<typeof VaultSpaceObject>;

export const VaultEconomicObs = z.object({
  id: z.string(),
  countryCode: z.string(),
  indicator: z.string(),
  label: z.string(),
  unit: z.string().optional(),
  frequency: z.string().optional(),
  period: z.string(),
  value: z.number().nullable(),
  provider: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultEconomicObs = z.infer<typeof VaultEconomicObs>;

export const VaultCountry = z.object({
  iso2: z.string(),
  iso3: z.string(),
  name: z.string(),
  region: z.string().optional(),
  capital: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultCountry = z.infer<typeof VaultCountry>;

export const VaultVessel = z.object({
  id: z.string(), // vessel:imo-... | vessel:mmsi-...
  imo: z.string().optional(),
  mmsi: z.string().optional(),
  name: z.string().optional(),
  vesselType: z.string().optional(),
  flag: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
  speedKn: z.number().nullable().optional(),
  courseDeg: z.number().nullable().optional(),
  headingDeg: z.number().nullable().optional(),
  navigationStatus: z.string().optional(),
  destination: z.string().optional(),
  eta: z.string().optional(),
  lastContact: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultVessel = z.infer<typeof VaultVessel>;

export const VaultWeatherObs = z.object({
  id: z.string(),
  lat: z.number(),
  lon: z.number(),
  place: z.string().optional(),
  countryCode: z.string().optional(),
  observedAt: z.string(),
  variable: z.string(), // temperature_2m | wind_speed_10m | ...
  value: z.number().nullable(),
  unit: z.string().optional(),
  provider: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultWeatherObs = z.infer<typeof VaultWeatherObs>;

export const VaultMarketObs = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string().optional(),
  assetClass: z.enum(["index", "equity", "fx", "commodity", "crypto", "rate", "bond"]),
  price: z.number().nullable(),
  change: z.number().nullable().optional(),
  changePct: z.number().nullable().optional(),
  currency: z.string().optional(),
  /** Honesty: never show delayed data as realtime. */
  latencyClass: z.enum(["realtime", "delayed", "eod", "historical"]),
  ts: z.string(),
  provider: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
export type VaultMarketObs = z.infer<typeof VaultMarketObs>;
