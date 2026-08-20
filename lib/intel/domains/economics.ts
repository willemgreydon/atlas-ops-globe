import { fetchCountryProfile } from "@/lib/providers/worldbank";
import { prov } from "@/lib/intel/provenance";
import { mapPool, limiter } from "../pool";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertEconomicObs } from "../repositories";
import { IdOf } from "../ids";
import type { VaultEconomicObs } from "../schemas";

/** Default seed set: G20 + a few strategically-watched economies. */
export const SEED_COUNTRIES = [
  "USA", "CHN", "JPN", "DEU", "GBR", "FRA", "ITA", "CAN", "IND", "BRA",
  "RUS", "KOR", "AUS", "MEX", "IDN", "SAU", "TUR", "ZAF", "ARG", "AUT",
  "UKR", "IRN", "POL", "NLD", "CHE",
];

/**
 * World Bank indicators for a seed set of countries → economic_observations
 * time series. Bounded concurrency + pacing respects the API.
 */
export async function ingestEconomics(countries = SEED_COUNTRIES): Promise<IngestReport> {
  return runIngestor({ domain: "economics", source: "worldbank", job: "indicators-sync" }, async (c) => {
    await mapPool(countries, 4, async (iso3) => {
      await limiter.wait("worldbank", 250);
      try {
        const profile = await fetchCountryProfile(iso3);
        for (const ind of profile.indicators) {
          c.fetched++;
          if (ind.value == null || !ind.year) { c.skipped++; continue; }
          const obs: VaultEconomicObs = {
            id: IdOf.indicatorObs(profile.iso2 ?? iso3, ind.code, ind.year),
            countryCode: profile.iso2 ?? iso3,
            indicator: ind.code,
            label: ind.label,
            unit: ind.unit,
            frequency: "annual",
            period: ind.year,
            value: ind.value,
            provider: "worldbank",
            provenance: [
              prov({
                provider: "worldbank",
                dataset: ind.code,
                providerRecordId: `${iso3}:${ind.code}:${ind.year}`,
                observedAt: `${ind.year}-12-31`,
                license: "CC BY 4.0",
                attribution: "World Bank Open Data",
              }),
            ],
          };
          upsertEconomicObs(obs);
          c.created++;
        }
      } catch {
        c.failed++;
      }
    });
  });
}
