import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { IdOf } from "@/lib/intel/ids";
import type { VaultVulnerability } from "@/lib/intel/schemas";

/**
 * CISA Known Exploited Vulnerabilities catalogue (public JSON file).
 * https://www.cisa.gov/known-exploited-vulnerabilities-catalog
 */
const Schema = z.object({
  catalogVersion: z.string().optional(),
  vulnerabilities: z.array(
    z.object({
      cveID: z.string(),
      vendorProject: z.string().optional(),
      product: z.string().optional(),
      vulnerabilityName: z.string().optional(),
      dateAdded: z.string().optional(),
      shortDescription: z.string().optional(),
      cwes: z.array(z.string()).optional(),
    }),
  ),
});

const URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

export async function fetchCisaKev(): Promise<VaultVulnerability[]> {
  const raw = await fetchJson<unknown>(URL, { timeoutMs: 20_000 });
  const data = Schema.parse(raw);
  return data.vulnerabilities.map((v) => ({
    id: IdOf.cve(v.cveID),
    title: v.vulnerabilityName ?? v.shortDescription,
    cvss: null,
    epss: null,
    cwe: v.cwes ?? [],
    vendor: v.vendorProject,
    products: v.product ? [v.product] : [],
    kev: true,
    kevDateAdded: v.dateAdded,
    references: [`https://nvd.nist.gov/vuln/detail/${v.cveID}`],
    source: "cisa-kev",
    provenance: [
      prov({
        provider: "cisa-kev",
        providerRecordId: v.cveID,
        sourceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        rawHash: hashPayload(v),
      }),
    ],
  }));
}
