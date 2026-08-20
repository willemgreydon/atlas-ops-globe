import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { IdOf } from "@/lib/intel/ids";
import { isValidPoint } from "@/lib/core/geo";
import type { GeoBounds } from "@/types/domain";
import type { VaultVessel } from "@/lib/intel/schemas";

/**
 * MarineTraffic AIS Data API (Kpler) — live vessel positions.
 * Reference: services.marinetraffic.com/api (OpenAPI: AIS Data API Reference).
 *
 * Auth: a 40-char hex `api_key` embedded as a URL PATH segment. Every service
 * is credit-metered, so this is a credential-required provider — without
 * MARINETRAFFIC_API_KEY the maritime domain reports OFFLINE (never mock-as-live).
 *
 * We normalize the `protocol=jsono&msgtype=extended` array response. Numeric
 * conventions per the API: SPEED and DRAUGHT are in tenths (knots×10 / m×10).
 */
const BASE = "https://services.marinetraffic.com/api";
const SERVICE_VERSION = "8";

/** One vessel record from PS07 `exportvessels` (extended). Loosely validated. */
const VesselSchema = z.object({
  MMSI: z.union([z.string(), z.number()]).optional(),
  IMO: z.union([z.string(), z.number()]).optional(),
  SHIP_ID: z.union([z.string(), z.number()]).optional(),
  LAT: z.union([z.string(), z.number()]),
  LON: z.union([z.string(), z.number()]),
  SPEED: z.union([z.string(), z.number()]).nullable().optional(),
  HEADING: z.union([z.string(), z.number()]).nullable().optional(),
  COURSE: z.union([z.string(), z.number()]).nullable().optional(),
  STATUS: z.union([z.string(), z.number()]).nullable().optional(),
  TIMESTAMP: z.string().optional(),
  SHIPNAME: z.string().optional(),
  TYPE_NAME: z.string().optional(),
  SHIPTYPE: z.union([z.string(), z.number()]).optional(),
  FLAG: z.string().optional(),
  DESTINATION: z.string().optional(),
  ETA: z.string().optional(),
});
const ResponseSchema = z.array(VesselSchema);

export function marineTrafficConfigured(): boolean {
  return !!process.env.MARINETRAFFIC_API_KEY;
}

const num = (v: string | number | null | undefined): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const str = (v: string | number | null | undefined): string | undefined =>
  v === undefined || v === null || v === "" ? undefined : String(v);
/** Treat MarineTraffic's "0" sentinel (unknown IMO/MMSI) as absent. */
const id0 = (v: string | number | null | undefined): string | undefined => {
  const s = str(v);
  return s && s !== "0" ? s : undefined;
};

/**
 * Fetch vessel positions inside a bounding box (PS07). `timespanMin` bounds the
 * position age. Throws a descriptive error when the credential is missing so
 * the ingestion framework degrades honestly to OFFLINE.
 */
export async function fetchVesselsInBounds(
  bounds: GeoBounds,
  opts: { timespanMin?: number; apiKey?: string } = {},
): Promise<VaultVessel[]> {
  const apiKey = opts.apiKey ?? process.env.MARINETRAFFIC_API_KEY;
  if (!apiKey) throw new Error("MARINETRAFFIC_API_KEY not set");

  const qs = new URLSearchParams({
    v: SERVICE_VERSION,
    protocol: "jsono",
    msgtype: "extended",
    MINLAT: String(bounds.south),
    MAXLAT: String(bounds.north),
    MINLON: String(bounds.west),
    MAXLON: String(bounds.east),
    timespan: String(opts.timespanMin ?? 60),
  });
  const raw = await fetchJson<unknown>(`${BASE}/exportvessels/${apiKey}?${qs}`, { timeoutMs: 20_000 });
  return normalizeVessels(raw);
}

/** Exported for fixture-based testing (no network). */
export function normalizeVessels(raw: unknown): VaultVessel[] {
  const rows = ResponseSchema.parse(raw);
  return rows.flatMap((r) => {
    const lat = num(r.LAT);
    const lon = num(r.LON);
    if (!isValidPoint({ lat: lat ?? NaN, lon: lon ?? NaN })) return [];
    const imo = id0(r.IMO);
    const mmsi = id0(r.MMSI);
    if (!imo && !mmsi) return [];
    const speed = num(r.SPEED);
    return [
      {
        id: IdOf.vessel({ imo, mmsi }),
        imo,
        mmsi,
        name: r.SHIPNAME,
        vesselType: r.TYPE_NAME ?? str(r.SHIPTYPE),
        flag: r.FLAG,
        lat: lat!,
        lon: lon!,
        speedKn: speed != null ? speed / 10 : undefined, // API reports knots×10
        courseDeg: num(r.COURSE),
        headingDeg: num(r.HEADING),
        navigationStatus: str(r.STATUS),
        destination: r.DESTINATION,
        eta: r.ETA,
        lastContact: r.TIMESTAMP ?? new Date().toISOString(),
        provenance: [
          prov({
            provider: "marinetraffic",
            dataset: "exportvessels",
            providerRecordId: str(r.SHIP_ID) ?? mmsi ?? imo,
            sourceUrl: "https://www.marinetraffic.com/",
            observedAt: r.TIMESTAMP,
            license: "Property of Kpler / MarineTraffic (credential-gated)",
            attribution: "MarineTraffic",
          }),
        ],
      } satisfies VaultVessel,
    ];
  });
}
