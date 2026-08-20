/**
 * Canonical domain model for the Atlas Ops Globe.
 *
 * Design rules (see docs/DATA_MODEL.md):
 *  - Every externally-derived record carries {@link Provenance}.
 *  - Coordinates are expressed as named-field {@link GeoPoint} objects to avoid
 *    lat/lon ambiguity. GeoJSON serialization always uses [lon, lat] tuples
 *    (see lib/core/geo.ts).
 *  - Every domain entity has a globally stable internal `id` independent of any
 *    provider's identifiers. Provider IDs live in provenance.providerRecordId.
 *  - Time fields are ISO-8601 strings, always explicit.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type Severity = "info" | "watch" | "warning" | "critical";

export interface GeoPoint {
  lat: number;
  lon: number;
  /** metres above ellipsoid; negative for depth (e.g. earthquake hypocentre) */
  alt?: number;
}

/** GeoJSON-style position tuple: [longitude, latitude(, altitude)]. */
export type Position = [number, number] | [number, number, number];

/** Axis-aligned geographic bounds, GeoJSON order [west, south, east, north]. */
export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Where a piece of data came from and how much we should trust it. Attached to
 * every externally-derived entity or event.
 */
export interface Provenance {
  provider: string;
  providerRecordId?: string;
  sourceUrl?: string;
  retrievedAt: string;
  observedAt?: string;
  /** 0..1 model of how much this single observation can be trusted. */
  confidence?: number;
  rawObjectHash?: string;
  transformationVersion?: string;
}

/**
 * Honest liveness state of a payload. Surfaced in the UI so mock/cached data is
 * never presented as live.
 */
export type DataStatus = "live" | "delayed" | "cached" | "mock" | "offline";

/** Standard envelope returned by every provider adapter and API route. */
export interface ProviderResult<T> {
  data: T;
  /** Provider key, e.g. "opensky". "mock" when falling back to demo data. */
  source: string;
  status: DataStatus;
  /** True when served from cache rather than a fresh upstream call. */
  cached: boolean;
  /** True when the data is older than the provider's freshness SLA. */
  stale: boolean;
  /** When the payload was produced (fetched or read from cache). */
  fetchedAt: string;
  /** Present when the upstream failed and we degraded. */
  error?: string;
  /** Number of records, for observability. */
  count?: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventKind =
  | "conflict"
  | "disaster"
  | "cyber"
  | "news"
  | "aviation"
  | "maritime"
  | "space"
  | "weather";

export interface WorldEvent {
  id: string;
  kind: EventKind;
  title: string;
  summary?: string;
  severity: Severity;
  occurredAt: string;
  location: GeoPoint;
  countryCode?: string;
  source: string;
  sourceUrl?: string;
  confidence?: number;
  tags?: string[];
  provenance?: Provenance;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface AircraftState {
  id: string;
  callsign?: string;
  country?: string;
  position: GeoPoint;
  velocityMs?: number;
  headingDeg?: number;
  verticalRateMs?: number;
  onGround?: boolean;
  lastContact: string;
  provenance?: Provenance;
}

export interface VesselState {
  id: string;
  mmsi?: string;
  imo?: string;
  name?: string;
  vesselType?: string;
  flag?: string;
  position: GeoPoint;
  courseDeg?: number;
  headingDeg?: number;
  speedKn?: number;
  navigationStatus?: string;
  destination?: string;
  eta?: string;
  lastContact: string;
  provenance?: Provenance;
}

// ---------------------------------------------------------------------------
// Information objects
// ---------------------------------------------------------------------------

export interface NewsItem {
  id: string;
  title: string;
  url?: string;
  source: string;
  publishedAt: string;
  countryCode?: string;
  people?: string[];
  organizations?: string[];
  themes?: string[];
  location?: GeoPoint;
  provenance?: Provenance;
}

export interface CountryProfile {
  iso3: string;
  iso2?: string;
  name?: string;
  region?: string;
  capital?: string;
  location?: GeoPoint;
  indicators: CountryIndicator[];
  provenance?: Provenance;
}

export interface CountryIndicator {
  code: string;
  label: string;
  value: number | null;
  unit?: string;
  year?: string;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface Alert {
  id: string;
  title: string;
  category: EventKind | "system";
  severity: Severity;
  confidence?: number;
  location?: GeoPoint;
  relatedEventId?: string;
  source: string;
  createdAt: string;
  expiresAt?: string;
}
