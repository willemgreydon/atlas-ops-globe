import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { IdOf } from "@/lib/intel/ids";
import type { VaultVulnerability } from "@/lib/intel/schemas";

/**
 * NVD CVE API 2.0 — recent CVEs by publication window.
 * https://nvd.nist.gov/developers/vulnerabilities
 * Anonymous rate limit: ~5 requests / 30s (one call per sync here).
 */
const Schema = z.object({
  vulnerabilities: z
    .array(
      z.object({
        cve: z.object({
          id: z.string(),
          published: z.string().optional(),
          lastModified: z.string().optional(),
          descriptions: z.array(z.object({ lang: z.string(), value: z.string() })).optional(),
          metrics: z.record(z.string(), z.unknown()).optional(),
          weaknesses: z
            .array(z.object({ description: z.array(z.object({ value: z.string() })) }))
            .optional(),
          references: z.array(z.object({ url: z.string() })).optional(),
        }),
      }),
    )
    .optional(),
});

/** NVD wants `YYYY-MM-DDTHH:MM:SS.SSS` (no trailing Z). */
function nvdDate(d: Date): string {
  return d.toISOString().replace("Z", "");
}

function extractCvss(metrics: Record<string, unknown> | undefined): number | null {
  if (!metrics) return null;
  for (const key of ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const arr = metrics[key];
    if (Array.isArray(arr) && arr[0]) {
      const data = (arr[0] as { cvssData?: { baseScore?: number } }).cvssData;
      if (typeof data?.baseScore === "number") return data.baseScore;
    }
  }
  return null;
}

export async function fetchNvdRecent(days = 7, apiKey = process.env.NVD_API_KEY): Promise<VaultVulnerability[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const qs = new URLSearchParams({
    pubStartDate: nvdDate(start),
    pubEndDate: nvdDate(end),
    resultsPerPage: "100",
  });
  const headers: Record<string, string> = {};
  if (apiKey) headers["apiKey"] = apiKey;
  const raw = await fetchJson<unknown>(`https://services.nvd.nist.gov/rest/json/cves/2.0?${qs}`, {
    timeoutMs: 25_000,
    // NVD's public API is heavily rate-limited and intermittently 503s; retry with
    // backoff (runs in the daily sync, which has ample time budget).
    retries: 2,
    headers,
  });
  const data = Schema.parse(raw);
  return (data.vulnerabilities ?? []).map(({ cve }) => {
    const desc = cve.descriptions?.find((d) => d.lang === "en")?.value;
    const cwe = (cve.weaknesses ?? [])
      .flatMap((w) => w.description.map((d) => d.value))
      .filter((c) => c.startsWith("CWE-"));
    return {
      id: IdOf.cve(cve.id),
      title: desc?.slice(0, 300),
      cvss: extractCvss(cve.metrics),
      epss: null,
      cwe: Array.from(new Set(cwe)),
      products: [],
      kev: false,
      publishedAt: cve.published,
      updatedAt: cve.lastModified,
      references: (cve.references ?? []).map((r) => r.url).slice(0, 8),
      source: "nvd",
      provenance: [
        prov({
          provider: "nvd",
          providerRecordId: cve.id,
          sourceUrl: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
          observedAt: cve.published,
          rawHash: hashPayload(cve),
        }),
      ],
    } satisfies VaultVulnerability;
  });
}
