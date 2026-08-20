export type Severity = "info" | "watch" | "warning" | "critical";

export interface GeoPoint {
  lat: number;
  lon: number;
  alt?: number;
}

export interface WorldEvent {
  id: string;
  kind: "conflict" | "disaster" | "cyber" | "news" | "aviation" | "maritime";
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
}

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
}

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
}
