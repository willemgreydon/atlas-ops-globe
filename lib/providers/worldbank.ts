import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { isValidPoint } from "@/lib/core/geo";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { CountryIndicator, CountryProfile } from "@/types/domain";
import { mockCountry } from "@/lib/mock";

/**
 * World Bank Indicators API — slow-moving country statistics.
 * https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
 *
 * Every World Bank response is `[paginationMeta, dataArray]`.
 */
const CountryMetaSchema = z.tuple([
  z.unknown(),
  z
    .array(
      z.object({
        id: z.string(),
        iso2Code: z.string().optional(),
        name: z.string().optional(),
        region: z.object({ value: z.string() }).optional(),
        capitalCity: z.string().optional(),
        longitude: z.string().optional(),
        latitude: z.string().optional(),
      }),
    )
    .nullable(),
]);

const IndicatorSchema = z.tuple([
  z.unknown(),
  z
    .array(
      z.object({
        indicator: z.object({ id: z.string(), value: z.string() }),
        date: z.string(),
        value: z.number().nullable(),
      }),
    )
    .nullable(),
]);

/** The indicators fetched for a country card. */
const INDICATORS: { code: string; label: string; unit?: string }[] = [
  { code: "SP.POP.TOTL", label: "Population" },
  { code: "NY.GDP.MKTP.CD", label: "GDP", unit: "US$" },
  { code: "NY.GDP.PCAP.CD", label: "GDP per capita", unit: "US$" },
  { code: "FP.CPI.TOTL.ZG", label: "Inflation", unit: "%" },
  { code: "SL.UEM.TOTL.ZS", label: "Unemployment", unit: "%" },
];

const BASE = "https://api.worldbank.org/v2/country";

async function latestIndicator(iso: string, code: string, label: string, unit?: string): Promise<CountryIndicator> {
  try {
    const raw = await fetchJson<unknown>(`${BASE}/${iso}/indicator/${code}?format=json&per_page=5&mrnev=1`);
    const [, rows] = IndicatorSchema.parse(raw);
    const latest = rows?.find((r) => r.value != null);
    return { code, label, unit, value: latest?.value ?? null, year: latest?.date };
  } catch {
    return { code, label, unit, value: null };
  }
}

export async function fetchCountryProfile(iso3: string): Promise<CountryProfile> {
  const iso = iso3.toUpperCase();
  const [metaRaw, ...indicators] = await Promise.all([
    fetchJson<unknown>(`${BASE}/${iso}?format=json`),
    ...INDICATORS.map((i) => latestIndicator(iso, i.code, i.label, i.unit)),
  ]);

  const [, metaRows] = CountryMetaSchema.parse(metaRaw);
  const meta = metaRows?.[0];
  const lat = meta?.latitude ? Number(meta.latitude) : NaN;
  const lon = meta?.longitude ? Number(meta.longitude) : NaN;
  const location = isValidPoint({ lat, lon }) ? { lat, lon } : undefined;

  return {
    iso3: iso,
    iso2: meta?.iso2Code,
    name: meta?.name,
    region: meta?.region?.value,
    capital: meta?.capitalCity,
    location,
    indicators,
    provenance: makeProvenance({
      provider: "worldbank",
      providerRecordId: iso,
      sourceUrl: `https://data.worldbank.org/country/${iso}`,
    }),
  };
}

export function worldBankProvider(iso3: string): ProviderDefinition<CountryProfile> {
  return {
    key: `worldbank:${iso3.toUpperCase()}`,
    label: "World Bank Indicators",
    ttlMs: 24 * 60 * 60 * 1000, // daily-ish; statistics move slowly
    reliability: 0.95,
    fetch: () => fetchCountryProfile(iso3),
    mock: () => mockCountry(iso3.toUpperCase()),
  };
}
