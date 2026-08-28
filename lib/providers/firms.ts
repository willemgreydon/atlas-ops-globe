import { fetchText } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { isValidPoint } from "@/lib/core/geo";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { Severity, WorldEvent } from "@/types/domain";

/**
 * NASA FIRMS — active fire / thermal-anomaly detections (VIIRS 375 m, NRT).
 * https://firms.modaps.eosdis.nasa.gov/api/area/
 *
 * This is the densest free global signal there is, and it concentrates over
 * exactly the regions the globe looked empty: African savanna burning, Siberian
 * and Canadian wildfires, agricultural fires across China and India, Australian
 * bushfires. Reachable from Vercel; needs a free instant MAP_KEY (distinct from
 * the api.nasa.gov key) — set FIRMS_MAP_KEY. Without it the provider is a no-op.
 *
 * A world/24h pull can be tens of thousands of points, so we sample evenly to a
 * bounded set that still shows the global pattern without overwhelming the globe.
 */
const SOURCE = "VIIRS_NOAA20_NRT";
const MAX_POINTS = 1200;

export function firmsConfigured(): boolean {
  return !!process.env.FIRMS_MAP_KEY;
}

interface Fire {
  lat: number;
  lon: number;
  frp: number | null; // fire radiative power, MW
  confidence: string | null;
  acquiredAt: string;
  dayNight: string | null;
}

/** Parse a FIRMS area CSV (header row + rows) into fire points, by column name. */
export function parseFirmsCsv(text: string): Fire[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iLat = idx("latitude");
  const iLon = idx("longitude");
  const iFrp = idx("frp");
  const iConf = idx("confidence");
  const iDate = idx("acq_date");
  const iTime = idx("acq_time");
  const iDn = idx("daynight");
  if (iLat < 0 || iLon < 0) return [];

  const out: Fire[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const latRaw = (c[iLat] ?? "").trim();
    const lonRaw = (c[iLon] ?? "").trim();
    if (!latRaw || !lonRaw) continue; // Number("") is 0, not NaN — reject empties
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // acq_time is "HHMM" UTC; build an ISO timestamp from date + time.
    const t = iTime >= 0 ? (c[iTime] ?? "").padStart(4, "0") : "0000";
    const date = iDate >= 0 ? c[iDate] : "";
    const acquiredAt = date ? `${date}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z` : new Date().toISOString();
    out.push({
      lat,
      lon,
      frp: iFrp >= 0 && Number.isFinite(Number(c[iFrp])) ? Number(c[iFrp]) : null,
      confidence: iConf >= 0 ? c[iConf] ?? null : null,
      acquiredAt,
      dayNight: iDn >= 0 ? c[iDn] ?? null : null,
    });
  }
  return out;
}

/** Evenly sample `n` items across the array to preserve geographic spread. */
function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function severityForFrp(frp: number | null): Severity {
  if (frp != null && frp >= 100) return "critical";
  if (frp != null && frp >= 30) return "warning";
  return "watch";
}

function toEvent(f: Fire): WorldEvent | null {
  const location = { lat: f.lat, lon: f.lon };
  if (!isValidPoint(location)) return null;
  const frpText = f.frp != null ? `${Math.round(f.frp)} MW` : "unknown intensity";
  return {
    id: `event:firms:${f.lat.toFixed(3)}:${f.lon.toFixed(3)}:${f.acquiredAt}`,
    kind: "disaster",
    title: `Active fire (${frpText})`,
    summary: `VIIRS thermal anomaly${f.confidence ? `, confidence ${f.confidence}` : ""}${f.dayNight === "N" ? ", night" : ""}.`,
    severity: severityForFrp(f.frp),
    occurredAt: f.acquiredAt,
    location,
    source: "NASA FIRMS",
    sourceUrl: "https://firms.modaps.eosdis.nasa.gov/",
    confidence: f.confidence === "h" ? 0.9 : f.confidence === "n" ? 0.6 : 0.5,
    tags: ["fire", "firms"],
    provenance: makeProvenance({
      provider: "firms",
      providerRecordId: `${f.lat},${f.lon},${f.acquiredAt}`,
      sourceUrl: "https://firms.modaps.eosdis.nasa.gov/",
      observedAt: f.acquiredAt,
    }),
  } satisfies WorldEvent;
}

export async function fetchFires(): Promise<WorldEvent[]> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return [];
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${SOURCE}/world/1`;
  const csv = await fetchText(url, { timeoutMs: 20_000 });
  if (/invalid map_key|error/i.test(csv.slice(0, 200))) throw new Error("FIRMS: invalid MAP_KEY or error response");
  const fires = sample(parseFirmsCsv(csv), MAX_POINTS);
  return fires.map(toEvent).filter((e): e is WorldEvent => e !== null);
}

export const firmsProvider: ProviderDefinition<WorldEvent[]> = {
  key: "firms",
  label: "NASA FIRMS (active fires)",
  ttlMs: 10 * 60_000,
  reliability: 0.85,
  fetch: fetchFires,
  mock: () => [],
};
