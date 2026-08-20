import { countryCentroids } from "@/data/country-centroids";
import { prov } from "@/lib/intel/provenance";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertCountry } from "../repositories";

/**
 * Seed the country backbone from bundled Natural Earth centroids (offline,
 * public domain). This is the geographic foundation other domains resolve to.
 */
export async function ingestCountries(): Promise<IngestReport> {
  return runIngestor({ domain: "global", source: "naturalearth", job: "countries-seed" }, async (c) => {
    for (const country of countryCentroids) {
      c.fetched++;
      if (!country.iso2 || !country.iso3) { c.skipped++; continue; }
      upsertCountry({
        iso2: country.iso2,
        iso3: country.iso3,
        name: country.name,
        lat: country.point.lat,
        lon: country.point.lon,
        data: {},
        provenance: [
          prov({
            provider: "naturalearth",
            dataset: "ne_110m_admin_0_countries",
            providerRecordId: country.iso3,
          }),
        ],
      });
      c.created++;
    }
  });
}
