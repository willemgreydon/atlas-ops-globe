/**
 * Provider registry (see docs/LICENSING.md). Every external source we integrate
 * — or plan to — is documented here with its licensing posture so we never
 * assume "publicly accessible" means "freely redistributable".
 *
 * `status: "active"` providers are wired end-to-end. Others are planned and
 * their controls appear disabled/labelled in the UI (no fake functionality).
 */

export type ProviderStatus = "active" | "planned";
export type CommercialUse = "permitted" | "attribution" | "restricted" | "unknown";

export interface ProviderRecord {
  key: string;
  name: string;
  category: string;
  url: string;
  auth: "none" | "api-key" | "oauth" | "token";
  /** Human-readable rate-limit note. */
  rateLimit: string;
  commercialUse: CommercialUse;
  redistribution: "permitted" | "restricted" | "attribution" | "unknown";
  attribution?: string;
  status: ProviderStatus;
  /** Env var(s) required to enable, if any. */
  envKeys?: string[];
  notes?: string;
}

export const providerRegistry: ProviderRecord[] = [
  {
    key: "opensky",
    name: "OpenSky Network",
    category: "aviation",
    url: "https://opensky-network.org/",
    auth: "none",
    rateLimit: "Anonymous ~400 req/day; higher with OAuth client credentials.",
    commercialUse: "restricted",
    redistribution: "restricted",
    attribution: "Data: The OpenSky Network, https://opensky-network.org",
    status: "active",
    envKeys: ["OPENSKY_CLIENT_ID", "OPENSKY_CLIENT_SECRET"],
    notes: "Non-commercial/research terms. Commercial deployment needs a licence.",
  },
  {
    key: "usgs",
    name: "USGS Earthquake Hazards",
    category: "naturalHazards",
    url: "https://earthquake.usgs.gov/",
    auth: "none",
    rateLimit: "No hard published limit; be courteous, cache 60s+.",
    commercialUse: "permitted",
    redistribution: "permitted",
    attribution: "U.S. Geological Survey",
    status: "active",
  },
  {
    key: "eonet",
    name: "NASA EONET",
    category: "naturalHazards",
    url: "https://eonet.gsfc.nasa.gov/",
    auth: "none",
    rateLimit: "Courtesy limits; cache 5m+.",
    commercialUse: "permitted",
    redistribution: "permitted",
    attribution: "NASA Earth Observatory Natural Event Tracker",
    status: "active",
  },
  {
    key: "gdelt",
    name: "GDELT DOC 2.0",
    category: "news",
    url: "https://www.gdeltproject.org/",
    auth: "none",
    rateLimit: "Soft limits; avoid rapid polling. Cache 2m+.",
    commercialUse: "attribution",
    redistribution: "restricted",
    attribution: "The GDELT Project",
    status: "active",
    notes: "Links/metadata only; do not republish full article text.",
  },
  {
    key: "worldbank",
    name: "World Bank Indicators",
    category: "economics",
    url: "https://data.worldbank.org/",
    auth: "none",
    rateLimit: "Generous; statistics move slowly, cache 24h.",
    commercialUse: "permitted",
    redistribution: "attribution",
    attribution: "World Bank Open Data (CC BY 4.0)",
    status: "active",
  },
  // ---- Planned (controls surfaced but disabled in the UI) ----
  { key: "aisstream", name: "AISstream", category: "maritime", url: "https://aisstream.io/", auth: "api-key", rateLimit: "Streaming; key required.", commercialUse: "restricted", redistribution: "restricted", status: "planned", envKeys: ["AISSTREAM_API_KEY"] },
  { key: "marinetraffic", name: "MarineTraffic", category: "maritime", url: "https://www.marinetraffic.com/", auth: "api-key", rateLimit: "Per-plan.", commercialUse: "restricted", redistribution: "restricted", status: "planned", envKeys: ["MARINETRAFFIC_API_KEY"] },
  { key: "acled", name: "ACLED", category: "conflict", url: "https://acleddata.com/", auth: "oauth", rateLimit: "Per-plan.", commercialUse: "restricted", redistribution: "restricted", attribution: "ACLED", status: "planned", envKeys: ["ACLED_CLIENT_ID", "ACLED_CLIENT_SECRET"] },
  { key: "reliefweb", name: "ReliefWeb", category: "humanitarian", url: "https://reliefweb.int/", auth: "none", rateLimit: "1000 req/day; appname param required.", commercialUse: "attribution", redistribution: "attribution", attribution: "OCHA ReliefWeb", status: "planned", envKeys: ["RELIEFWEB_APPNAME"] },
  { key: "cisa-kev", name: "CISA Known Exploited Vulnerabilities", category: "cyber", url: "https://www.cisa.gov/kev", auth: "none", rateLimit: "Static JSON; cache hours.", commercialUse: "permitted", redistribution: "permitted", status: "planned" },
  { key: "nvd", name: "NVD CVE API", category: "cyber", url: "https://nvd.nist.gov/", auth: "api-key", rateLimit: "5 req/30s anon; 50 with key.", commercialUse: "permitted", redistribution: "permitted", status: "planned" },
  { key: "wikidata", name: "Wikidata", category: "entities", url: "https://www.wikidata.org/", auth: "none", rateLimit: "Be courteous; cache.", commercialUse: "permitted", redistribution: "permitted", attribution: "Wikidata (CC0)", status: "planned" },
  { key: "celestrak", name: "CelesTrak", category: "space", url: "https://celestrak.org/", auth: "none", rateLimit: "Cache TLEs; refresh hours.", commercialUse: "attribution", redistribution: "attribution", attribution: "CelesTrak", status: "planned" },
  { key: "openmeteo", name: "Open-Meteo", category: "weather", url: "https://open-meteo.com/", auth: "none", rateLimit: "10k req/day free.", commercialUse: "attribution", redistribution: "attribution", attribution: "Open-Meteo (CC BY 4.0)", status: "planned" },
  { key: "ofac", name: "OFAC Sanctions List Service", category: "sanctions", url: "https://sanctionslist.ofac.treas.gov/", auth: "none", rateLimit: "Bulk files; cache daily.", commercialUse: "permitted", redistribution: "permitted", status: "planned" },
];

export const activeProviders = providerRegistry.filter((p) => p.status === "active");

export function providerByKey(key: string): ProviderRecord | undefined {
  return providerRegistry.find((p) => p.key === key);
}
