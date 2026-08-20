import { twoline2satrec } from "satellite.js";
import { prov } from "@/lib/intel/provenance";
import { IdOf } from "@/lib/intel/ids";
import type { VaultSpaceObject } from "@/lib/intel/schemas";

/**
 * Shared TLE → VaultSpaceObject normalization. We store the raw TLE lines
 * (SGP4-ready) and derive human-readable orbit metadata via satellite.js.
 * The client propagates positions from the TLE; we never store position samples.
 */
const MU = 398600.4418; // km^3/s^2
const EARTH_RADIUS_KM = 6378.137;
const round = (n: number) => Math.round(n * 10) / 10;

export interface TleMeta {
  name: string;
  cospar?: string;
  operator?: string;
  country?: string;
  objectType?: string;
  launchDate?: string;
  source: string;
  dataset?: string;
}

export function tleToSpaceObject(line1: string, line2: string, meta: TleMeta): VaultSpaceObject | null {
  const l1 = line1.trim();
  const l2 = line2.trim();
  if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) return null;
  const norad = l1.slice(2, 7).trim();
  if (!norad) return null;

  let inclinationDeg: number | null = null;
  let periodMin: number | null = null;
  let apogeeKm: number | null = null;
  let perigeeKm: number | null = null;
  let epoch: string | undefined;
  try {
    const satrec = twoline2satrec(l1, l2);
    if (!satrec.error) {
      inclinationDeg = round((satrec.inclo * 180) / Math.PI);
      const revsPerDay = (satrec.no * 1440) / (2 * Math.PI); // no is rad/min
      if (revsPerDay > 0) {
        periodMin = round(1440 / revsPerDay);
        const n = (revsPerDay * 2 * Math.PI) / 86400; // rad/s
        const a = Math.cbrt(MU / (n * n));
        apogeeKm = round(a * (1 + satrec.ecco) - EARTH_RADIUS_KM);
        perigeeKm = round(a * (1 - satrec.ecco) - EARTH_RADIUS_KM);
      }
      epoch = new Date((satrec.jdsatepoch - 2440587.5) * 86400_000).toISOString();
    }
  } catch {
    return null;
  }

  return {
    id: IdOf.satellite(norad),
    norad,
    cospar: meta.cospar,
    name: meta.name || `NORAD ${norad}`,
    operator: meta.operator,
    country: meta.country,
    objectType: meta.objectType,
    launchDate: meta.launchDate,
    tleLine1: l1,
    tleLine2: l2,
    epoch,
    inclinationDeg,
    periodMin,
    apogeeKm,
    perigeeKm,
    source: meta.source,
    provenance: [
      prov({
        provider: meta.source,
        dataset: meta.dataset,
        providerRecordId: norad,
        sourceUrl: meta.source === "spacetrack" ? "https://www.space-track.org/" : "https://celestrak.org/",
        observedAt: epoch,
        attribution: meta.source === "spacetrack" ? "Space-Track.org / US Space Force" : "CelesTrak",
      }),
    ],
  };
}

/** Parse a 3-line-per-object TLE text block (CelesTrak FORMAT=tle). */
export function parseTleText(text: string, source: string, dataset?: string): VaultSpaceObject[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.length > 0);
  const out: VaultSpaceObject[] = [];
  for (let i = 0; i + 2 < lines.length + 1; i += 3) {
    const name = lines[i];
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (!l1 || !l2) break;
    const obj = tleToSpaceObject(l1, l2, { name, source, dataset });
    if (obj) out.push(obj);
  }
  return out;
}
