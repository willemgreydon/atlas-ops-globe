import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { IdOf } from "@/lib/intel/ids";
import type { VaultSpaceObject } from "@/lib/intel/schemas";

/**
 * CelesTrak GP (General Perturbations) element sets in OMM JSON — SGP4-ready
 * orbital elements. https://celestrak.org/NORAD/documentation/gp-data-formats.php
 * We store OMM-derived orbit metadata (not thousands of propagated positions).
 */
const OmmSchema = z.array(
  z.object({
    OBJECT_NAME: z.string().optional(),
    OBJECT_ID: z.string().optional(), // COSPAR
    NORAD_CAT_ID: z.union([z.number(), z.string()]),
    EPOCH: z.string().optional(),
    MEAN_MOTION: z.number().optional(), // revs/day
    ECCENTRICITY: z.number().optional(),
    INCLINATION: z.number().optional(),
  }),
);

const MU = 398600.4418; // km^3/s^2, Earth GM
const EARTH_RADIUS_KM = 6378.137;

/** Derive apogee/perigee (km altitude) and period (min) from OMM elements. */
function deriveOrbit(meanMotionRevDay?: number, ecc?: number) {
  if (!meanMotionRevDay || meanMotionRevDay <= 0) return { periodMin: null, apogeeKm: null, perigeeKm: null };
  const periodMin = 1440 / meanMotionRevDay;
  const n = (meanMotionRevDay * 2 * Math.PI) / 86400; // rad/s
  const a = Math.cbrt(MU / (n * n)); // semi-major axis km
  const e = ecc ?? 0;
  return {
    periodMin: round(periodMin),
    apogeeKm: round(a * (1 + e) - EARTH_RADIUS_KM),
    perigeeKm: round(a * (1 - e) - EARTH_RADIUS_KM),
  };
}
const round = (n: number) => Math.round(n * 10) / 10;

export async function fetchCelestrak(group = "active"): Promise<VaultSpaceObject[]> {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
  const raw = await fetchJson<unknown>(url, { timeoutMs: 25_000 });
  const data = OmmSchema.parse(raw);
  return data.map((o) => {
    const norad = String(o.NORAD_CAT_ID);
    const orbit = deriveOrbit(o.MEAN_MOTION, o.ECCENTRICITY);
    return {
      id: IdOf.satellite(norad),
      norad,
      cospar: o.OBJECT_ID,
      name: o.OBJECT_NAME ?? `NORAD ${norad}`,
      objectType: undefined,
      epoch: o.EPOCH,
      inclinationDeg: o.INCLINATION ?? null,
      periodMin: orbit.periodMin,
      apogeeKm: orbit.apogeeKm,
      perigeeKm: orbit.perigeeKm,
      source: "celestrak",
      provenance: [
        prov({
          provider: "celestrak",
          dataset: group,
          providerRecordId: norad,
          sourceUrl: "https://celestrak.org/",
          observedAt: o.EPOCH,
          rawHash: hashPayload(o),
        }),
      ],
    } satisfies VaultSpaceObject;
  });
}
