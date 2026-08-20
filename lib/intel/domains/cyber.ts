import { fetchCisaKev } from "../providers/cisa-kev";
import { fetchNvdRecent } from "../providers/nvd";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertVulnerability } from "../repositories";

/**
 * Cyber situational awareness (defensive only): CISA KEV catalogue + recent NVD
 * CVEs. KEV entries mark exploited-in-the-wild status; NVD provides CVSS/CWE.
 */
export async function ingestCyber(): Promise<IngestReport> {
  return runIngestor({ domain: "cyber", source: "cisa-kev+nvd", job: "vulns-sync" }, async (c) => {
    const [kev, nvd] = await Promise.allSettled([fetchCisaKev(), fetchNvdRecent(7)]);
    if (kev.status === "fulfilled") {
      for (const v of kev.value) { c.fetched++; upsertVulnerability(v); c.created++; }
    } else c.failed++;
    if (nvd.status === "fulfilled") {
      for (const v of nvd.value) { c.fetched++; upsertVulnerability(v); c.updated++; }
    } else c.failed++;
  });
}
