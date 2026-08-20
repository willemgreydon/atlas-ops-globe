import type { IntelligenceDomain } from "./ontology";

/**
 * Central intelligence source registry. Each entry documents WHAT a source is,
 * HOW to acquire it responsibly (rate limits, cache TTL), and its LICENSING
 * posture using a deliberately conservative vocabulary. We never claim a
 * permission we have not verified.
 */
export type LicenseStance = "unknown" | "review-required" | "allowed" | "restricted";
export type SourceType = "api" | "bulk" | "rss" | "file" | "scrape";
export type ImplementationStatus =
  | "implemented"
  | "next"
  | "credential-required"
  | "legal-review"
  | "research";

export interface SourceAcquisition {
  /** Minimum seconds between requests. */
  minIntervalSec: number;
  /** Cache TTL in seconds for the vault ingestion layer. */
  cacheTtlSec: number;
  /** Max concurrent requests to this source. */
  concurrency: number;
  maxRetries: number;
}

export interface SourceRecord {
  id: string;
  name: string;
  domains: IntelligenceDomain[];
  type: SourceType;
  baseUrl: string;
  auth: "none" | "optional" | "api-key" | "oauth" | "token";
  polling: boolean;
  license: string;
  commercialUse: LicenseStance;
  redistribution: LicenseStance;
  attributionRequired: boolean;
  attribution?: string;
  enabled: boolean;
  status: ImplementationStatus;
  envKeys?: string[];
  acquisition: SourceAcquisition;
  notes?: string;
}

const A = (o: Partial<SourceAcquisition>): SourceAcquisition => ({
  minIntervalSec: 5,
  cacheTtlSec: 300,
  concurrency: 2,
  maxRetries: 3,
  ...o,
});

export const SOURCES: SourceRecord[] = [
  {
    id: "naturalearth", name: "Natural Earth", domains: ["global"], type: "bulk",
    baseUrl: "https://www.naturalearthdata.com/", auth: "none", polling: false,
    license: "Public domain", commercialUse: "allowed", redistribution: "allowed",
    attributionRequired: false, enabled: true, status: "implemented",
    acquisition: A({ cacheTtlSec: 31536000 }),
    notes: "Seed country geometry/centroids (bundled).",
  },
  {
    id: "gdelt", name: "GDELT DOC 2.0", domains: ["news", "global"], type: "api",
    baseUrl: "https://api.gdeltproject.org/api/v2/doc/doc", auth: "none", polling: true,
    license: "GDELT terms; links/metadata only", commercialUse: "review-required",
    redistribution: "restricted", attributionRequired: true, attribution: "The GDELT Project",
    enabled: true, status: "implemented",
    acquisition: A({ minIntervalSec: 6, cacheTtlSec: 120, concurrency: 1 }),
    notes: "Rate-limited to 1 req / 5s; returns plain-text on rejection. Do not store full article bodies.",
  },
  {
    id: "eventregistry", name: "Event Registry (newsapi.ai)", domains: ["news", "politics"], type: "api",
    baseUrl: "https://eventregistry.org/api/v1/", auth: "api-key", polling: true,
    license: "Event Registry terms; metadata/links only", commercialUse: "review-required",
    redistribution: "restricted", attributionRequired: true, attribution: "Event Registry (newsapi.ai)",
    enabled: true, status: "implemented", envKeys: ["EVENTREGISTRY_API_KEY"],
    acquisition: A({ minIntervalSec: 2, cacheTtlSec: 180, concurrency: 1 }),
    notes: "Articles WITH linked concepts (persons/orgs/locations + Wikipedia URIs), sentiment, geolocation — builds the entity graph.",
  },
  {
    id: "newsapi", name: "NewsAPI.org", domains: ["news"], type: "api",
    baseUrl: "https://newsapi.org/v2/", auth: "api-key", polling: true,
    license: "NewsAPI developer tier — non-commercial, ~24h delayed", commercialUse: "restricted",
    redistribution: "restricted", attributionRequired: true, attribution: "NewsAPI.org",
    enabled: true, status: "implemented", envKeys: ["NEWSAPI_KEY"],
    acquisition: A({ minIntervalSec: 2, cacheTtlSec: 300, concurrency: 1 }),
    notes: "Breadth. Free tier is delayed & non-commercial — labelled as such; never shown as real-time.",
  },
  {
    id: "usgs", name: "USGS Earthquakes", domains: ["disasters"], type: "api",
    baseUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/", auth: "none", polling: true,
    license: "US Government open data", commercialUse: "allowed", redistribution: "allowed",
    attributionRequired: true, attribution: "U.S. Geological Survey", enabled: true,
    status: "implemented", acquisition: A({ minIntervalSec: 30, cacheTtlSec: 60 }),
  },
  {
    id: "eonet", name: "NASA EONET", domains: ["disasters", "environment"], type: "api",
    baseUrl: "https://eonet.gsfc.nasa.gov/api/v3/", auth: "none", polling: true,
    license: "NASA open data", commercialUse: "allowed", redistribution: "allowed",
    attributionRequired: true, attribution: "NASA EONET", enabled: true,
    status: "implemented", acquisition: A({ cacheTtlSec: 300 }),
  },
  {
    id: "worldbank", name: "World Bank Indicators", domains: ["economics"], type: "api",
    baseUrl: "https://api.worldbank.org/v2/", auth: "none", polling: false,
    license: "CC BY 4.0", commercialUse: "allowed", redistribution: "allowed",
    attributionRequired: true, attribution: "World Bank Open Data (CC BY 4.0)", enabled: true,
    status: "implemented", acquisition: A({ minIntervalSec: 1, cacheTtlSec: 86400, concurrency: 4 }),
  },
  {
    id: "cisa-kev", name: "CISA Known Exploited Vulnerabilities", domains: ["cyber"], type: "file",
    baseUrl: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    auth: "none", polling: true, license: "US Government open data", commercialUse: "allowed",
    redistribution: "allowed", attributionRequired: true, attribution: "CISA", enabled: true,
    status: "implemented", acquisition: A({ minIntervalSec: 60, cacheTtlSec: 21600 }),
  },
  {
    id: "nvd", name: "NVD CVE API 2.0", domains: ["cyber"], type: "api",
    baseUrl: "https://services.nvd.nist.gov/rest/json/cves/2.0", auth: "optional", polling: true,
    license: "US Government open data", commercialUse: "allowed", redistribution: "allowed",
    attributionRequired: true, attribution: "NVD / NIST", enabled: true, status: "implemented",
    envKeys: ["NVD_API_KEY"],
    acquisition: A({ minIntervalSec: 6, cacheTtlSec: 3600, concurrency: 1 }),
    notes: "6s interval anonymous (5 req/30s); higher with API key.",
  },
  {
    id: "celestrak", name: "CelesTrak", domains: ["space"], type: "api",
    baseUrl: "https://celestrak.org/NORAD/elements/gp.php", auth: "none", polling: true,
    license: "CelesTrak terms", commercialUse: "review-required", redistribution: "review-required",
    attributionRequired: true, attribution: "CelesTrak", enabled: true, status: "implemented",
    acquisition: A({ minIntervalSec: 30, cacheTtlSec: 7200, concurrency: 1 }),
  },
  {
    id: "opensky", name: "OpenSky Network", domains: ["aviation"], type: "api",
    baseUrl: "https://opensky-network.org/api/", auth: "optional", polling: true,
    license: "OpenSky non-commercial/research", commercialUse: "restricted",
    redistribution: "restricted", attributionRequired: true,
    attribution: "The OpenSky Network, https://opensky-network.org", enabled: true,
    status: "implemented", envKeys: ["OPENSKY_CLIENT_ID", "OPENSKY_CLIENT_SECRET"],
    acquisition: A({ minIntervalSec: 10, cacheTtlSec: 10 }),
    notes: "Live telemetry is snapshot-only; not committed to Git.",
  },
  // ---- Planned / blocked (adapter interface + fixtures, no live wiring) ----
  {
    id: "wikidata", name: "Wikidata", domains: ["politics", "news"], type: "api",
    baseUrl: "https://www.wikidata.org/w/api.php", auth: "none", polling: false,
    license: "CC0", commercialUse: "allowed", redistribution: "allowed",
    attributionRequired: false, enabled: false, status: "next",
    acquisition: A({ minIntervalSec: 2, cacheTtlSec: 604800 }),
    notes: "Entity enrichment (persons/orgs) — adapter interface present.",
  },
  {
    id: "reliefweb", name: "ReliefWeb", domains: ["disasters", "conflict"], type: "api",
    baseUrl: "https://api.reliefweb.int/v1/", auth: "none", polling: true,
    license: "OCHA terms", commercialUse: "review-required", redistribution: "review-required",
    attributionRequired: true, attribution: "OCHA ReliefWeb", enabled: false, status: "next",
    envKeys: ["RELIEFWEB_APPNAME"], acquisition: A({ cacheTtlSec: 3600 }),
  },
  {
    id: "acled", name: "ACLED (Armed Conflict Location & Event Data)", domains: ["conflict"], type: "api",
    baseUrl: "https://acleddata.com/api/acled/read", auth: "oauth", polling: true,
    license: "ACLED licence", commercialUse: "restricted", redistribution: "restricted",
    attributionRequired: true, attribution: "ACLED (acleddata.com)", enabled: false, status: "credential-required",
    envKeys: ["ACLED_USERNAME", "ACLED_PASSWORD"],
    acquisition: A({ minIntervalSec: 2, cacheTtlSec: 3600, concurrency: 1 }),
    notes: "OAuth2 password grant (client_id=acled), 24h token cached in memory. Political violence, protests, strategic developments with lat/lon + fatalities. CLI: pnpm intel:sync conflict.",
  },
  {
    id: "aisstream", name: "AISstream", domains: ["maritime"], type: "api",
    baseUrl: "wss://stream.aisstream.io/v0/stream", auth: "api-key", polling: true,
    license: "AISstream terms", commercialUse: "restricted", redistribution: "restricted",
    attributionRequired: true, enabled: false, status: "credential-required",
    envKeys: ["AISSTREAM_API_KEY"], acquisition: A({ cacheTtlSec: 15 }),
  },
  {
    id: "marinetraffic", name: "MarineTraffic AIS Data API (Kpler)", domains: ["maritime"], type: "api",
    baseUrl: "https://services.marinetraffic.com/api", auth: "api-key", polling: true,
    license: "Property of Kpler — credit-metered, redistribution restricted",
    commercialUse: "restricted", redistribution: "restricted", attributionRequired: true,
    attribution: "MarineTraffic", enabled: false, status: "credential-required",
    envKeys: ["MARINETRAFFIC_API_KEY"],
    acquisition: A({ minIntervalSec: 2, cacheTtlSec: 60, concurrency: 1 }),
    notes: "40-char hex api_key in URL path. Adapter wired: exportvessels (PS07 bbox) → vessels + chokepoint scan; endpoints also cover exportvessel, exportvesseltrack, portcalls, port-congestion, shipsearch. Credit-metered per call.",
  },
  {
    id: "ourairports", name: "OurAirports", domains: ["aviation", "infrastructure"], type: "bulk",
    baseUrl: "https://davidmegginson.github.io/ourairports-data/airports.csv", auth: "none",
    polling: false, license: "Public domain", commercialUse: "allowed", redistribution: "allowed",
    attributionRequired: false, enabled: false, status: "next", acquisition: A({ cacheTtlSec: 604800 }),
    notes: "~78k airports CSV — reference seed (adapter present, not bulk-loaded this cycle).",
  },
  {
    id: "openmeteo", name: "Open-Meteo", domains: ["weather", "environment"], type: "api",
    baseUrl: "https://api.open-meteo.com/v1/", auth: "none", polling: true,
    license: "CC BY 4.0", commercialUse: "allowed", redistribution: "review-required",
    attributionRequired: true, attribution: "Open-Meteo (CC BY 4.0)", enabled: true, status: "implemented",
    acquisition: A({ minIntervalSec: 1, cacheTtlSec: 900, concurrency: 4 }),
    notes: "Current weather for major cities (point observations). Wired for the weather domain.",
  },
  {
    id: "finnhub", name: "Finnhub", domains: ["markets"], type: "api",
    baseUrl: "https://finnhub.io/api/v1/", auth: "api-key", polling: true,
    license: "Finnhub terms", commercialUse: "review-required", redistribution: "restricted",
    attributionRequired: true, attribution: "Finnhub", enabled: true, status: "implemented",
    envKeys: ["FINNHUB_API_KEY"],
    acquisition: A({ minIntervalSec: 1, cacheTtlSec: 30, concurrency: 4 }),
    notes: "Free tier 60 req/min, real-time US equities/ETFs. Index quotes via ETF proxies (SPY/QQQ/DIA).",
  },
  {
    id: "ofac", name: "OFAC Sanctions List Service", domains: ["sanctions"], type: "bulk",
    baseUrl: "https://sanctionslist.ofac.treas.gov/", auth: "none", polling: true,
    license: "US Government open data", commercialUse: "allowed", redistribution: "allowed",
    attributionRequired: false, enabled: false, status: "next", acquisition: A({ cacheTtlSec: 86400 }),
  },
];

export function sourceById(id: string): SourceRecord | undefined {
  return SOURCES.find((s) => s.id === id);
}

export function sourcesForDomain(domain: IntelligenceDomain): SourceRecord[] {
  return SOURCES.filter((s) => s.domains.includes(domain));
}
