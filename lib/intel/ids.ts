import { stableId } from "@/lib/core/id";

/**
 * Universal identity scheme for the Intelligence Vault.
 *
 * Rule: a provider-specific ID is NEVER the primary identity of an entity. We
 * mint stable internal IDs of the form `type:key`. Where an authoritative
 * universal identifier exists (ISO code, Wikidata QID, ICAO24, IMO, NORAD,
 * CVE id) we use it as the key; otherwise we derive a deterministic key from
 * the source identifiers with `stableId`.
 */
export const IdOf = {
  country: (iso2: string) => `country:${iso2.toUpperCase()}`,
  region: (code: string) => `region:${code.toUpperCase()}`,
  city: (geonameId: string | number) => `city:geonames-${geonameId}`,
  person: (wikidataId?: string, name?: string) =>
    wikidataId ? `person:${wikidataId}` : stableId("person", name),
  org: (opts: { wikidataId?: string; lei?: string; name?: string }) =>
    opts.wikidataId
      ? `org:${opts.wikidataId}`
      : opts.lei
        ? `org:LEI-${opts.lei}`
        : stableId("org", opts.name),
  aircraft: (icao24: string) => `aircraft:icao24-${icao24.toLowerCase()}`,
  flight: (callsign: string, day: string) => stableId("flight", callsign, day),
  vessel: (opts: { imo?: string; mmsi?: string }) =>
    opts.imo ? `vessel:imo-${opts.imo}` : `vessel:mmsi-${opts.mmsi}`,
  airport: (icao: string) => `airport:icao-${icao.toUpperCase()}`,
  port: (unlocode: string) => `port:unlocode-${unlocode.toUpperCase()}`,
  satellite: (norad: string | number) => `satellite:norad-${norad}`,
  cve: (id: string) => `cve:${id.toUpperCase()}`,
  event: (provider: string, providerId: string) => `event:${provider}:${providerId}`,
  news: (url: string) => stableId("news", url),
  story: (key: string) => stableId("story", key),
  disaster: (provider: string, providerId: string) => `disaster:${provider}:${providerId}`,
  sanction: (authority: string, programId: string) => stableId("sanction", authority, programId),
  indicatorObs: (country: string, indicator: string, period: string) =>
    `econobs:${country.toUpperCase()}:${indicator}:${period}`,
} as const;

/** Parse the `type` prefix from a universal id (`country:AT` -> `country`). */
export function typeOfId(id: string): string {
  const i = id.indexOf(":");
  return i === -1 ? "" : id.slice(0, i);
}
